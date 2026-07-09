import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { $Enums, Prisma, User as PrismaUser } from '@prisma/client';
import { Machine, MachineHistory, MachineStatus, Role, WarrantyStatus } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMachineDto, UpdateMachineDto } from './dto';
import { toConditionCheck, toMachine, toRental } from './machine.mapper';
import { computeWarranty } from './warranty';

// ponytail: enum shared dan Prisma nominal berbeda, cast di batang DB saja.
const asMachineStatus = (s: MachineStatus) => s as unknown as $Enums.MachineStatus;
const asWarrantyStatus = (s: WarrantyStatus) => s as unknown as $Enums.WarrantyStatus;

const withOwnerNama = { include: { owner: { select: { nama: true } } } } as const;

@Injectable()
export class MachinesService {
  constructor(private prisma: PrismaService) {}

  // ADMIN: semua mesin. PENYEDIA: hanya miliknya. PENYEWA/OPERATOR: katalog, hanya TERSEDIA.
  async findAll(user: PrismaUser, status?: MachineStatus): Promise<Machine[]> {
    const where =
      user.role === Role.ADMIN
        ? { status: status ? asMachineStatus(status) : undefined }
        : user.role === Role.PENYEDIA
          ? { ownerId: user.id, status: status ? asMachineStatus(status) : undefined }
          : { status: asMachineStatus(MachineStatus.TERSEDIA) };

    const machines = await this.prisma.machine.findMany({ where, ...withOwnerNama });
    return machines.map((m) => toMachine(m, m.owner.nama));
  }

  async findOne(id: string): Promise<Machine> {
    const m = await this.prisma.machine.findUnique({ where: { id }, ...withOwnerNama });
    if (!m) throw new NotFoundException('Mesin tidak ditemukan');
    return toMachine(m, m.owner.nama);
  }

  async create(user: PrismaUser, dto: CreateMachineDto): Promise<Machine> {
    await this.ensureNumberFree(dto.machineNumber);
    const warrantyStart = new Date(dto.warrantyStart);
    const { warrantyEnd, warrantyStatus } = computeWarranty(warrantyStart, dto.warrantyDurationMonths);
    const m = await this.prisma.machine.create({
      data: {
        machineNumber: dto.machineNumber,
        spesifikasi: dto.spesifikasi,
        standardRatio: dto.standardRatio,
        ownerId: user.id,
        warrantyStart,
        warrantyDurationMonths: dto.warrantyDurationMonths,
        warrantyEnd,
        warrantyStatus: asWarrantyStatus(warrantyStatus),
      },
    });
    return toMachine(m, user.nama);
  }

  async update(user: PrismaUser, id: string, dto: UpdateMachineDto): Promise<Machine> {
    const existing = await this.getOwnedOrThrow(user, id);

    // Status mesin tidak diubah di sini; transisi status hanya lewat modul Sewa.
    const data: Prisma.MachineUpdateInput = {
      spesifikasi: dto.spesifikasi,
      standardRatio: dto.standardRatio,
    };

    // Warranty dihitung ulang bila start atau durasi berubah.
    if (dto.warrantyStart !== undefined || dto.warrantyDurationMonths !== undefined) {
      const warrantyStart = dto.warrantyStart ? new Date(dto.warrantyStart) : existing.warrantyStart;
      const months = dto.warrantyDurationMonths ?? existing.warrantyDurationMonths;
      const { warrantyEnd, warrantyStatus } = computeWarranty(warrantyStart, months);
      data.warrantyStart = warrantyStart;
      data.warrantyDurationMonths = months;
      data.warrantyEnd = warrantyEnd;
      data.warrantyStatus = asWarrantyStatus(warrantyStatus);
    }

    const m = await this.prisma.machine.update({ where: { id }, data });
    return toMachine(m);
  }

  async remove(user: PrismaUser, id: string): Promise<void> {
    await this.getOwnedOrThrow(user, id);
    // ponytail: FK restrict memblok hapus mesin yang punya rental/batch/check (Prisma menolak).
    // Ubah ke 409 eksplisit kalau UX butuh pesan lebih jelas.
    await this.prisma.machine.delete({ where: { id } });
  }

  async history(user: PrismaUser, id: string): Promise<MachineHistory> {
    await this.getOwnedOrThrow(user, id);
    const [rentals, conditionChecks] = await Promise.all([
      this.prisma.rental.findMany({ where: { machineId: id }, orderBy: { createdAt: 'asc' } }),
      this.prisma.conditionCheck.findMany({ where: { machineId: id }, orderBy: { checkedAt: 'asc' } }),
    ]);
    return { rentals: rentals.map(toRental), conditionChecks: conditionChecks.map(toConditionCheck) };
  }

  private async getOwnedOrThrow(user: PrismaUser, id: string) {
    const m = await this.prisma.machine.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Mesin tidak ditemukan');
    if (user.role !== Role.ADMIN && m.ownerId !== user.id) {
      throw new ForbiddenException('Bukan mesin milik Anda');
    }
    return m;
  }

  private async ensureNumberFree(machineNumber: string) {
    const existing = await this.prisma.machine.findUnique({ where: { machineNumber } });
    if (existing) throw new ConflictException('Nomor mesin sudah dipakai');
  }
}

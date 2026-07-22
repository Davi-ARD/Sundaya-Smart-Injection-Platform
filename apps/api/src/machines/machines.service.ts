import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { $Enums, Prisma, User as PrismaUser } from '@prisma/client';
import { Machine, MachineStatus, WarrantyStatus } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMachineDto, UpdateMachineDto } from './dto';
import { toMachine } from './machine.mapper';
import { computeWarranty } from './warranty';

// ponytail: enum shared dan Prisma nominal berbeda, cast di batang DB saja.
const asMachineStatus = (s: MachineStatus) => s as unknown as $Enums.MachineStatus;
const asWarrantyStatus = (s: WarrantyStatus) => s as unknown as $Enums.WarrantyStatus;

@Injectable()
export class MachinesService {
  constructor(private prisma: PrismaService) {}

  // Single-provider: semua mesin milik Sundaya, jadi staf melihat semua.
  // Mesin yang diarsipkan disembunyikan dari daftar aktif kecuali archived=true diminta eksplisit.
  async findAll(status?: MachineStatus, archived?: boolean): Promise<Machine[]> {
    const isArchived = archived ?? false;
    const where: Prisma.MachineWhereInput = {
      status: status ? asMachineStatus(status) : undefined,
      isArchived,
    };
    const machines = await this.prisma.machine.findMany({ where });
    return machines.map(toMachine);
  }

  async findOne(id: string): Promise<Machine> {
    const m = await this.prisma.machine.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Mesin tidak ditemukan');
    return toMachine(m);
  }

  // Hanya ADMIN_SUNDAYA (dijaga controller). Owner selalu user Sundaya pembuat:
  // single-provider ditegakkan di sini, bukan lewat kolom bebas dari client.
  async create(user: PrismaUser, dto: CreateMachineDto): Promise<Machine> {
    await this.ensureNumberFree(dto.machineNumber);
    const warrantyStart = new Date(dto.warrantyStart);
    const { warrantyEnd, warrantyStatus } = computeWarranty(warrantyStart, dto.warrantyDurationMonths);
    const m = await this.prisma.machine.create({
      data: {
        machineNumber: dto.machineNumber,
        spesifikasi: dto.spesifikasi,
        tonaseTon: dto.tonaseTon,
        standardRatio: dto.standardRatio,
        ownerId: user.id,
        warrantyStart,
        warrantyDurationMonths: dto.warrantyDurationMonths,
        warrantyEnd,
        warrantyStatus: asWarrantyStatus(warrantyStatus),
      },
    });
    return toMachine(m);
  }

  async update(id: string, dto: UpdateMachineDto): Promise<Machine> {
    const existing = await this.getOrThrow(id);

    // Kedua sumbu status tidak diubah di sini: ketersediaan (status) hanya lewat
    // lifecycle jobs, realtime (operationalStatus) hanya lewat Operational Data.
    const data: Prisma.MachineUpdateInput = {
      spesifikasi: dto.spesifikasi,
      tonaseTon: dto.tonaseTon,
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

  // Arsip (soft-delete): mesin disembunyikan dari daftar aktif, data & relasi tetap utuh.
  async archive(id: string): Promise<Machine> {
    await this.getOrThrow(id);
    const m = await this.prisma.machine.update({ where: { id }, data: { isArchived: true } });
    return toMachine(m);
  }

  async unarchive(id: string): Promise<Machine> {
    await this.getOrThrow(id);
    const m = await this.prisma.machine.update({ where: { id }, data: { isArchived: false } });
    return toMachine(m);
  }

  private async getOrThrow(id: string) {
    const m = await this.prisma.machine.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Mesin tidak ditemukan');
    return m;
  }

  private async ensureNumberFree(machineNumber: string) {
    const existing = await this.prisma.machine.findUnique({ where: { machineNumber } });
    if (existing) throw new ConflictException('Nomor mesin sudah dipakai');
  }
}

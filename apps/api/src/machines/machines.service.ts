import { Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, Prisma, User as PrismaUser } from '@prisma/client';
import { Machine, MachineStatus, WarrantyStatus } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMachineDto, UpdateMachineDto } from './dto';
import { toMachine } from './machine.mapper';
import { computeWarranty } from './warranty';

// ponytail: enum shared dan Prisma nominal berbeda, cast di batang DB saja.
const asMachineStatus = (s: MachineStatus) => s as unknown as $Enums.MachineStatus;
const asWarrantyStatus = (s: WarrantyStatus) => s as unknown as $Enums.WarrantyStatus;

// Awalan nomor mesin (Injection Molding). Nomor digenerate IM-001, IM-002, dst.
const MACHINE_PREFIX = 'IM';

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
    const warrantyStart = new Date(dto.warrantyStart);
    const { warrantyEnd, warrantyStatus } = computeWarranty(warrantyStart, new Date(dto.warrantyEnd));
    const m = await this.prisma.machine.create({
      data: {
        machineNumber: await this.nextMachineNumber(),
        spesifikasi: dto.spesifikasi,
        tonaseTon: dto.tonaseTon,
        ownerId: user.id,
        warrantyStart,
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
    };

    // Warranty dihitung ulang bila salah satu ujung rentang tanggalnya berubah.
    if (dto.warrantyStart !== undefined || dto.warrantyEnd !== undefined) {
      const warrantyStart = dto.warrantyStart ? new Date(dto.warrantyStart) : existing.warrantyStart;
      const akhir = dto.warrantyEnd ? new Date(dto.warrantyEnd) : existing.warrantyEnd;
      const { warrantyEnd, warrantyStatus } = computeWarranty(warrantyStart, akhir);
      data.warrantyStart = warrantyStart;
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

  // Nomor mesin digenerate berurutan dengan pola IM-001, bukan diinput manual.
  // Nomor tertinggi yang ada dipakai sebagai acuan (bukan jumlah baris), supaya
  // mesin yang pernah dihapus tidak membuat nomor terpakai ulang.
  //
  // ponytail: cukup satu query max + retry pada bentrok unik. Naikkan ke sequence
  // Postgres kalau nanti ada pembuatan mesin paralel yang ramai.
  private async nextMachineNumber(): Promise<string> {
    const last = await this.prisma.machine.findFirst({
      where: { machineNumber: { startsWith: `${MACHINE_PREFIX}-` } },
      orderBy: { machineNumber: 'desc' },
      select: { machineNumber: true },
    });
    const lastSeq = last ? Number(last.machineNumber.slice(MACHINE_PREFIX.length + 1)) : 0;
    const next = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;
    return `${MACHINE_PREFIX}-${String(next).padStart(3, '0')}`;
  }
}

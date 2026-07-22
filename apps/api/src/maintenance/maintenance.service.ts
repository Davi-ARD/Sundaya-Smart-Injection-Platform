import { Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, Prisma, User as PrismaUser } from '@prisma/client';
import { Maintenance, MaintenanceStatus, MaintenanceType } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaintenanceDto, UpdateMaintenanceStatusDto } from './dto';
import { toMaintenance } from './maintenance.mapper';
import { nextMaintenanceStatus } from './maintenance-state';

// ponytail: enum shared dan Prisma nominal berbeda, cast di batang DB saja.
const asType = (t: MaintenanceType) => t as unknown as $Enums.MaintenanceType;
const asStatus = (s: MaintenanceStatus) => s as unknown as $Enums.MaintenanceStatus;

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  // Semua mesin milik Sundaya (single-provider), jadi staf Sundaya melihat semua.
  async findAll(machineId?: string, status?: MaintenanceStatus): Promise<Maintenance[]> {
    const where: Prisma.MaintenanceWhereInput = {
      machineId: machineId || undefined,
      status: status ? asStatus(status) : undefined,
    };
    const rows = await this.prisma.maintenance.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
    });
    return rows.map(toMaintenance);
  }

  // Hanya TEKNISI_SUNDAYA (dijaga controller). byId = teknisi pembuat.
  async create(user: PrismaUser, dto: CreateMaintenanceDto): Promise<Maintenance> {
    await this.ensureMachineExists(dto.machineId);
    const m = await this.prisma.maintenance.create({
      data: {
        machineId: dto.machineId,
        type: asType(dto.type),
        scheduledAt: new Date(dto.scheduledAt),
        notes: dto.notes,
        byId: user.id,
      },
    });
    return toMaintenance(m);
  }

  // Transisi status hanya lewat peta konstan (TERJADWAL -> BERLANGSUNG -> SELESAI).
  async updateStatus(id: string, dto: UpdateMaintenanceStatusDto): Promise<Maintenance> {
    const existing = await this.getOrThrow(id);
    const next = nextMaintenanceStatus(existing.status as unknown as MaintenanceStatus, dto.status);
    const m = await this.prisma.maintenance.update({
      where: { id },
      data: { status: asStatus(next), notes: dto.notes ?? existing.notes },
    });
    return toMaintenance(m);
  }

  private async getOrThrow(id: string) {
    const m = await this.prisma.maintenance.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Maintenance tidak ditemukan');
    return m;
  }

  private async ensureMachineExists(machineId: string) {
    const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine) throw new NotFoundException('Mesin tidak ditemukan');
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, User as PrismaUser } from '@prisma/client';
import {
  MachineOperationalStatus,
  MachineStatusCount,
  OperationalData,
} from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperationalDataDto } from './operational.dto';
import { toOperationalData } from './operational.mapper';

// ponytail: enum shared dan Prisma nominal berbeda, cast di batang DB saja.
const asOpStatus = (s: MachineOperationalStatus) =>
  s as unknown as $Enums.MachineOperationalStatus;

@Injectable()
export class OperationalService {
  constructor(private prisma: PrismaService) {}

  // Layer 1 append-only (Teknisi). Satu event = satu perubahan status realtime,
  // hanya SETUP atau RUNNING (divalidasi di DTO). Machine.operationalStatus
  // disetel ke status yang diposting. Koreksi lewat event baru, bukan update/delete.
  async append(
    user: PrismaUser,
    machineId: string,
    dto: CreateOperationalDataDto,
  ): Promise<OperationalData> {
    const machine = await this.prisma.machine.findUnique({
      where: { id: machineId },
      select: { operationalStatus: true },
    });
    if (!machine) throw new NotFoundException('Mesin tidak ditemukan');

    // Mesin yang sedang maintenance dikunci: statusnya dipulihkan modul Maintenance
    // saat maintenance selesai, jadi input Teknisi di sini akan tertimpa.
    if (machine.operationalStatus === $Enums.MachineOperationalStatus.MAINTENANCE) {
      throw new ConflictException(
        'Mesin sedang maintenance. Selesaikan maintenance dulu di tab Maintenance.',
      );
    }

    const [event] = await this.prisma.$transaction([
      this.prisma.operationalData.create({
        data: {
          machineId,
          status: asOpStatus(dto.status),
          cycleTimeSec: dto.cycleTimeSec,
          occurredAt: new Date(dto.occurredAt),
          byId: user.id,
          catatan: dto.catatan,
        },
      }),
      this.prisma.machine.update({
        where: { id: machineId },
        data: { operationalStatus: asOpStatus(dto.status) },
      }),
    ]);
    return toOperationalData(event);
  }

  // Ringkasan realtime: jumlah mesin (non-arsip) per operationalStatus, zero-fill
  // keempat status supaya papan status stabil walau ada status tanpa mesin.
  async summary(): Promise<MachineStatusCount[]> {
    const grouped = await this.prisma.machine.groupBy({
      by: ['operationalStatus'],
      where: { isArchived: false },
      _count: { _all: true },
    });
    const counts = new Map(grouped.map((g) => [g.operationalStatus as string, g._count._all]));
    return Object.values(MachineOperationalStatus).map((status) => ({
      status,
      count: counts.get(status) ?? 0,
    }));
  }
}

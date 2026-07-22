import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, User as PrismaUser } from '@prisma/client';
import {
  DowntimeReason,
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
const asReason = (r: DowntimeReason) => r as unknown as $Enums.DowntimeReason;

@Injectable()
export class OperationalService {
  constructor(private prisma: PrismaService) {}

  // Layer 1 append-only (Teknisi). Satu event = satu perubahan status realtime.
  // Machine.operationalStatus disetel ke status yang diposting (input realtime,
  // event ditulis berurutan). Koreksi lewat event baru, bukan update/delete.
  async append(
    user: PrismaUser,
    machineId: string,
    dto: CreateOperationalDataDto,
  ): Promise<OperationalData> {
    await this.ensureMachineExists(machineId);
    this.validateReason(dto.status, dto.downtimeReason);

    const [event] = await this.prisma.$transaction([
      this.prisma.operationalData.create({
        data: {
          machineId,
          status: asOpStatus(dto.status),
          downtimeReason: dto.downtimeReason ? asReason(dto.downtimeReason) : null,
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
  // kelima status supaya papan status stabil walau ada status tanpa mesin.
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

  // Reason code six big losses wajib saat non-produktif (status non-RUNNING),
  // dan dilarang saat RUNNING supaya data Layer 1 bersih.
  private validateReason(status: MachineOperationalStatus, reason?: DowntimeReason) {
    if (status === MachineOperationalStatus.RUNNING && reason) {
      throw new BadRequestException('downtimeReason tidak boleh diisi saat status RUNNING');
    }
    if (status !== MachineOperationalStatus.RUNNING && !reason) {
      throw new BadRequestException('downtimeReason wajib saat status non-RUNNING');
    }
  }

  private async ensureMachineExists(machineId: string) {
    const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine) throw new NotFoundException('Mesin tidak ditemukan');
  }
}

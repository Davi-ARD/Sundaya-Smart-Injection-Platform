import { Injectable, NotFoundException } from '@nestjs/common';
import { $Enums } from '@prisma/client';
import {
  ExtensionStatus,
  JobLifecycle,
  MachineMetrics,
  MachineOperationalStatus,
  MachineStatusCount,
  RentalMonitoring,
  SundayaDashboard,
} from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { remainingDays } from '../jobs/job-status';
import {
  computeMachineMetrics,
  CorrectiveWindow,
  OperationalEvent,
  QualityTally,
} from './metrics';

const round = (n: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

// Lifecycle job yang dianggap masih berjalan (bukan terminal DITOLAK/SELESAI).
const ACTIVE_LIFECYCLES: $Enums.JobLifecycle[] = [
  JobLifecycle.DIAJUKAN,
  JobLifecycle.DIKONFIRMASI,
  JobLifecycle.AKTIF,
] as unknown as $Enums.JobLifecycle[];

type RawEvent = { status: string; cycleTimeSec: number | null; occurredAt: Date };
type RawCorrective = { startedAt: Date | null; scheduledAt: Date; completedAt: Date | null };

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  // Metrik OEE satu mesin. Availability dan Performance dari Layer 1, Quality dari
  // Layer 2 (Log Produksi job yang memakai mesin ini), MTBF/MTTR dari maintenance
  // korektif. Tidak ada angka yang diinput manual.
  async machineMetrics(machineId: string): Promise<MachineMetrics> {
    const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine) throw new NotFoundException('Mesin tidak ditemukan');

    const [rows, corrective, quality] = await Promise.all([
      this.prisma.operationalData.findMany({
        where: { machineId },
        orderBy: { occurredAt: 'asc' },
        select: { status: true, cycleTimeSec: true, occurredAt: true },
      }),
      this.correctiveFor(machineId),
      this.qualityFor(machineId),
    ]);

    const values = computeMachineMetrics(
      this.toEvents(rows),
      this.toWindows(corrective),
      quality,
    );
    return { machineId, machineNumber: machine.machineNumber, ...values };
  }

  // Dashboard Sundaya: status realtime + rata-rata OEE/utilization armada.
  async sundaya(): Promise<SundayaDashboard> {
    const machines = await this.prisma.machine.findMany({
      where: { isArchived: false },
      select: { id: true, operationalStatus: true },
    });
    const machineIds = machines.map((m) => m.id);

    const [rows, corrective, qualityRows] = await Promise.all([
      this.prisma.operationalData.findMany({
        where: { machineId: { in: machineIds } },
        orderBy: { occurredAt: 'asc' },
        select: { machineId: true, status: true, cycleTimeSec: true, occurredAt: true },
      }),
      this.prisma.maintenance.findMany({
        where: { machineId: { in: machineIds }, type: $Enums.MaintenanceType.CORRECTIVE },
        select: { machineId: true, startedAt: true, scheduledAt: true, completedAt: true },
      }),
      // Log Produksi menyebut mesinnya sendiri, jadi tally Layer 2 langsung per mesin
      // tanpa perlu menebak lewat job (satu booking kini punya beberapa mesin).
      this.prisma.logProduksi.groupBy({
        by: ['machineId'],
        where: {
          eventType: $Enums.LogProduksiEventType.PRODUKSI_HARIAN,
          machineId: { in: machineIds },
        },
        _sum: { goodProduct: true, rejectCount: true },
      }),
    ]);

    const eventsBy = this.groupBy(rows, (r) => r.machineId);
    const correctiveBy = this.groupBy(corrective, (c) => c.machineId);
    const qualityBy = new Map<string, QualityTally>(
      qualityRows.map((q) => [
        q.machineId as string,
        { goodProduct: q._sum.goodProduct ?? 0, rejectCount: q._sum.rejectCount ?? 0 },
      ]),
    );

    // Rata-rata hanya atas mesin yang punya event Layer 1: mesin tanpa data tidak
    // menarik rata-rata armada ke nol.
    const perMachine = [...eventsBy.entries()].map(([machineId, evts]) =>
      computeMachineMetrics(
        this.toEvents(evts),
        this.toWindows(correctiveBy.get(machineId) ?? []),
        qualityBy.get(machineId) ?? { goodProduct: 0, rejectCount: 0 },
      ),
    );
    const avg = (pick: (m: { oee: number; utilization: number }) => number) =>
      perMachine.length ? round(perMachine.reduce((s, m) => s + pick(m), 0) / perMachine.length) : 0;

    const [activeBookings, rentalMonitoring] = await Promise.all([
      this.prisma.job.count({ where: { lifecycle: { in: ACTIVE_LIFECYCLES } } }),
      this.rentalMonitoring(),
    ]);

    return {
      runningMachines: machines.filter(
        (m) =>
          m.operationalStatus ===
          (MachineOperationalStatus.RUNNING as unknown as $Enums.MachineOperationalStatus),
      ).length,
      totalMachines: machines.length,
      avgOee: avg((m) => m.oee),
      utilization: avg((m) => m.utilization),
      activeBookings,
      operationalStatusCounts: this.statusCounts(machines.map((m) => m.operationalStatus as string)),
      rentalMonitoring,
    };
  }

  // Rental monitoring: bahan cek berkala Admin Sundaya. Sisa sewa terpendek dan
  // jumlah job lewat jatuh tempo dihitung dari endDate job AKTIF, pengajuan
  // perpanjangan yang menunggu dihitung dari RentalExtension berstatus DIAJUKAN.
  private async rentalMonitoring(): Promise<RentalMonitoring> {
    const [activeJobs, pendingExtensions] = await Promise.all([
      this.prisma.job.findMany({
        where: { lifecycle: JobLifecycle.AKTIF as unknown as $Enums.JobLifecycle },
        select: { endDate: true },
      }),
      this.prisma.rentalExtension.count({
        where: { status: ExtensionStatus.DIAJUKAN as unknown as $Enums.ExtensionStatus },
      }),
    ]);

    const now = new Date();
    const sisa = activeJobs
      .map((j) => remainingDays(j.endDate, now))
      .filter((d): d is number => d !== null);

    return {
      shortestRemainingDays: sisa.length ? Math.min(...sisa) : null,
      pendingExtensions,
      overdueJobs: sisa.filter((d) => d < 0).length,
    };
  }

  private correctiveFor(machineId: string) {
    return this.prisma.maintenance.findMany({
      where: { machineId, type: $Enums.MaintenanceType.CORRECTIVE },
      select: { startedAt: true, scheduledAt: true, completedAt: true },
    });
  }

  // Quality mesin ini = akumulasi produksi harian (Layer 2) yang tercatat di mesin ini.
  private async qualityFor(machineId: string): Promise<QualityTally> {
    const agg = await this.prisma.logProduksi.aggregate({
      where: {
        eventType: $Enums.LogProduksiEventType.PRODUKSI_HARIAN,
        machineId,
      },
      _sum: { goodProduct: true, rejectCount: true },
    });
    return {
      goodProduct: agg._sum.goodProduct ?? 0,
      rejectCount: agg._sum.rejectCount ?? 0,
    };
  }

  private toEvents(rows: RawEvent[]): OperationalEvent[] {
    return rows.map((r) => ({
      status: r.status as unknown as MachineOperationalStatus,
      cycleTimeSec: r.cycleTimeSec,
      occurredAt: r.occurredAt,
    }));
  }

  // Maintenance yang belum ditandai mulai dianggap mulai pada jadwalnya.
  private toWindows(rows: RawCorrective[]): CorrectiveWindow[] {
    return rows.map((r) => ({
      startedAt: r.startedAt ?? r.scheduledAt,
      endedAt: r.completedAt,
    }));
  }

  private groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const k = key(row);
      const list = map.get(k) ?? [];
      list.push(row);
      map.set(k, list);
    }
    return map;
  }

  private statusCounts(statuses: string[]): MachineStatusCount[] {
    const counts = new Map<string, number>();
    for (const s of statuses) counts.set(s, (counts.get(s) ?? 0) + 1);
    return Object.values(MachineOperationalStatus).map((status) => ({
      status,
      count: counts.get(status) ?? 0,
    }));
  }
}

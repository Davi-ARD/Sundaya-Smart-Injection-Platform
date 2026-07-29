import { Injectable, NotFoundException } from '@nestjs/common';
import { $Enums } from '@prisma/client';
import {
  DowntimeReason,
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
import { computeMachineMetrics, OperationalEvent } from './metrics';

const round = (n: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

// Lifecycle job yang dianggap masih berjalan (bukan terminal DITOLAK/SELESAI).
const ACTIVE_LIFECYCLES: $Enums.JobLifecycle[] = [
  JobLifecycle.DIAJUKAN,
  JobLifecycle.DIKONFIRMASI,
  JobLifecycle.DIKIRIM,
  JobLifecycle.AKTIF,
  JobLifecycle.SELESAI_SEWA,
  JobLifecycle.DIKEMBALIKAN,
] as unknown as $Enums.JobLifecycle[];

type RawEvent = { status: string; downtimeReason: string | null; occurredAt: Date };

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  // Metrik OEE per mesin dari OperationalData Layer 1 (bukan input manual).
  async machineMetrics(machineId: string): Promise<MachineMetrics> {
    const machine = await this.prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine) throw new NotFoundException('Mesin tidak ditemukan');

    const rows = await this.prisma.operationalData.findMany({
      where: { machineId },
      orderBy: { occurredAt: 'asc' },
      select: { status: true, downtimeReason: true, occurredAt: true },
    });
    const values = computeMachineMetrics(this.toEvents(rows));
    return { machineId, machineNumber: machine.machineNumber, ...values };
  }

  // Dashboard Sundaya: status realtime + rata-rata OEE/utilization dari Layer 1.
  async sundaya(): Promise<SundayaDashboard> {
    const machines = await this.prisma.machine.findMany({
      where: { isArchived: false },
      select: { id: true, operationalStatus: true },
    });
    const machineIds = machines.map((m) => m.id);

    const rows = await this.prisma.operationalData.findMany({
      where: { machineId: { in: machineIds } },
      orderBy: { occurredAt: 'asc' },
      select: { machineId: true, status: true, downtimeReason: true, occurredAt: true },
    });

    // Kelompokkan event per mesin lalu hitung metrik; rata-rata hanya atas mesin
    // yang punya event (mesin tanpa data tidak menarik rata-rata ke nol).
    const byMachine = new Map<string, RawEvent[]>();
    for (const r of rows) {
      const list = byMachine.get(r.machineId) ?? [];
      list.push(r);
      byMachine.set(r.machineId, list);
    }
    const perMachine = [...byMachine.values()].map((evts) => computeMachineMetrics(this.toEvents(evts)));
    const avg = (pick: (m: { oee: number; utilization: number }) => number) =>
      perMachine.length ? round(perMachine.reduce((s, m) => s + pick(m), 0) / perMachine.length) : 0;

    const [activeBookings, rentalMonitoring] = await Promise.all([
      this.prisma.job.count({ where: { lifecycle: { in: ACTIVE_LIFECYCLES } } }),
      this.rentalMonitoring(),
    ]);

    return {
      runningMachines: machines.filter(
        (m) => m.operationalStatus === (MachineOperationalStatus.RUNNING as unknown as $Enums.MachineOperationalStatus),
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

  private toEvents(rows: RawEvent[]): OperationalEvent[] {
    return rows.map((r) => ({
      status: r.status as unknown as MachineOperationalStatus,
      downtimeReason: (r.downtimeReason as unknown as DowntimeReason | null) ?? null,
      occurredAt: r.occurredAt,
    }));
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

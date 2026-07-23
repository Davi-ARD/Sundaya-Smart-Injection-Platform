import { Injectable } from '@nestjs/common';
import { $Enums, User as PrismaUser } from '@prisma/client';
import {
  DeliveryStatus,
  JobDashboard,
  JobLifecycle,
  ManagerDashboard,
  MoldTrackingStatus,
  ProgressMolding,
} from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PengirimanService } from '../pengiriman/pengiriman.service';

const round = (n: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

// Mold yang secara fisik ada di Sundaya (sudah diterima, belum dikirim balik).
const AT_SUNDAYA = [
  MoldTrackingStatus.RECEIVED,
  MoldTrackingStatus.WAITING_PRODUCTION,
  MoldTrackingStatus.ON_MACHINE,
  MoldTrackingStatus.PRODUCTION,
  MoldTrackingStatus.REPAIR,
] as unknown as $Enums.MoldTrackingStatus[];

const AKTIF = JobLifecycle.AKTIF as unknown as $Enums.JobLifecycle;

@Injectable()
export class DashboardPenyewaService {
  constructor(
    private prisma: PrismaService,
    private pengiriman: PengirimanService,
  ) {}

  // Dashboard Manager: ringkasan tenant sendiri. onTimeDeliveryRate memakai
  // ulang Log Pengiriman (B4) agar rencana vs aktual dihitung satu tempat.
  async manager(user: PrismaUser): Promise<ManagerDashboard> {
    const managerId = user.id;

    const [moldsAtSundaya, ongoing, goodAgg, targetedJobs, rows] = await Promise.all([
      this.prisma.mold.count({ where: { managerId, trackingStatus: { in: AT_SUNDAYA } } }),
      this.prisma.job.count({ where: { managerId, lifecycle: AKTIF } }),
      this.prisma.logProduksi.aggregate({
        _sum: { goodProduct: true },
        where: { job: { managerId } },
      }),
      this.prisma.job.findMany({
        where: { managerId, targetOutput: { not: null } },
        select: { id: true, targetOutput: true },
      }),
      this.pengiriman.list(user),
    ]);

    const avgAchievement = await this.avgAchievement(targetedJobs);
    const arrived = rows.filter(
      (r) => r.status === DeliveryStatus.TIBA_ONTIME || r.status === DeliveryStatus.TIBA_TERLAMBAT,
    );
    const onTime = arrived.filter((r) => r.status === DeliveryStatus.TIBA_ONTIME);
    // ponytail: tanpa kedatangan -> 100 (tidak ada yang terlambat).
    const onTimeDeliveryRate = arrived.length ? round((onTime.length / arrived.length) * 100) : 100;

    return {
      moldsAtSundaya,
      ongoing,
      totalGoodProduct: goodAgg._sum.goodProduct ?? 0,
      avgAchievement,
      onTimeDeliveryRate,
    };
  }

  private async avgAchievement(
    jobs: { id: string; targetOutput: number | null }[],
  ): Promise<number> {
    if (!jobs.length) return 0;
    const sums = await this.prisma.logProduksi.groupBy({
      by: ['jobId'],
      where: { jobId: { in: jobs.map((j) => j.id) } },
      _sum: { goodProduct: true },
    });
    const goodByJob = new Map(sums.map((s) => [s.jobId, s._sum.goodProduct ?? 0]));
    const total = jobs.reduce(
      (acc, j) => acc + (goodByJob.get(j.id) ?? 0) / (j.targetOutput as number),
      0,
    );
    return round((total / jobs.length) * 100);
  }

  // Dashboard job (Admin Penyewa di lokasi): ringkasan tiap job aktif tenant
  // induknya (parentId). Progress + produksi diturunkan dari Log Produksi.
  async job(user: PrismaUser): Promise<JobDashboard[]> {
    const managerId = user.parentId ?? '__none__';
    const jobs = await this.prisma.job.findMany({
      where: { managerId, lifecycle: AKTIF },
      orderBy: { createdAt: 'desc' },
      include: {
        machine: { select: { machineNumber: true } },
        // ponytail: muat semua log per job aktif (jumlah job aktif kecil); pindah
        // ke agregat SQL bila satu job punya ribuan event.
        logProduksi: { orderBy: { occurredAt: 'desc' } },
      },
    });

    return jobs.map((job) => {
      const logs = job.logProduksi;
      const totalGoodProduct = logs.reduce((a, l) => a + (l.goodProduct ?? 0), 0);
      const totalReject = logs.reduce((a, l) => a + (l.rejectCount ?? 0), 0);
      const latestProgress = logs.find((l) => l.progressMolding != null)?.progressMolding ?? null;
      const latestRemaining =
        logs.find((l) => l.materialRemainingKg != null)?.materialRemainingKg ?? null;

      return {
        jobId: job.id,
        jobNumber: job.jobNumber,
        lifecycle: job.lifecycle as unknown as JobLifecycle,
        machineNumber: job.machine?.machineNumber ?? null,
        progressMolding: latestProgress as unknown as ProgressMolding | null,
        totalGoodProduct,
        totalReject,
        materialRemainingKg: latestRemaining,
        latestLogAt: logs[0]?.occurredAt.toISOString() ?? null,
      };
    });
  }
}

import { Injectable } from '@nestjs/common';
import { $Enums, User as PrismaUser } from '@prisma/client';
import {
  DeliveryStatus,
  JobDashboard,
  JobLifecycle,
  JobLogEntry,
  LogProduksiEventType,
  ManagerDashboard,
  MoldPlanRow,
  MoldTrackingStatus,
  ProgressMolding,
} from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PengirimanService } from '../pengiriman/pengiriman.service';
import { remainingDays } from '../jobs/job-status';

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
        mold: { select: { kodeMold: true, namaProduk: true, cavity: true } },
        // ponytail: muat semua log per job aktif (jumlah job aktif kecil); pindah
        // ke agregat SQL bila satu job punya ribuan event.
        logProduksi: { orderBy: { occurredAt: 'desc' } },
      },
    });

    const now = new Date();
    return jobs.map((job) => {
      const stats = summarizeLogs(job.logProduksi);

      return {
        jobId: job.id,
        jobNumber: job.jobNumber,
        lifecycle: job.lifecycle as unknown as JobLifecycle,
        machineNumber: job.machine?.machineNumber ?? null,
        moldKode: job.mold.kodeMold,
        moldProduk: job.mold.namaProduk,
        moldCavity: job.mold.cavity,
        progressMolding: stats.progressMolding,
        targetOutput: job.targetOutput,
        achievement: achievementPercent(stats.totalGoodProduct, job.targetOutput),
        totalGoodProduct: stats.totalGoodProduct,
        totalReject: stats.totalReject,
        materialRemainingKg: stats.materialRemainingKg,
        endDate: job.endDate?.toISOString() ?? null,
        sisaHariSewa: remainingDays(job.endDate, now),
        latestLogAt: stats.latestLogAt,
      };
    });
  }

  // Log utama Admin Penyewa: satu timeline berisi event dari seluruh job tenant
  // induk, bukan hanya job yang sedang dipilih. Dibatasi supaya halaman tetap
  // ringan; naikkan limit atau tambah paging bila tenant punya banyak job.
  async jobLogs(user: PrismaUser, limit = 50): Promise<JobLogEntry[]> {
    const managerId = user.parentId ?? '__none__';
    const logs = await this.prisma.logProduksi.findMany({
      where: { job: { managerId } },
      orderBy: { occurredAt: 'desc' },
      take: limit,
      include: {
        job: { select: { jobNumber: true, mold: { select: { kodeMold: true } } } },
      },
    });

    return logs.map(({ job, ...log }) => ({
      ...log,
      eventType: log.eventType as unknown as LogProduksiEventType,
      progressMolding: log.progressMolding as unknown as ProgressMolding | null,
      occurredAt: log.occurredAt.toISOString(),
      createdAt: log.createdAt.toISOString(),
      jobNumber: job.jobNumber,
      moldKode: job.mold.kodeMold,
    }));
  }

  // Perkembangan plan mold (Manager Penyewa): satu baris per cetakan miliknya,
  // menggabung tracking fisik, job/mesin, capaian produksi, dan realisasi
  // material. Dipakai tabel dashboard, panel detail cepat, dan detail cetakan.
  async moldPlan(user: PrismaUser): Promise<MoldPlanRow[]> {
    const molds = await this.prisma.mold.findMany({
      where: { managerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        job: {
          include: {
            machine: { select: { machineNumber: true } },
            logProduksi: { orderBy: { occurredAt: 'desc' } },
          },
        },
      },
    });

    const now = new Date();
    return molds.map((mold) => {
      const job = mold.job;
      const stats = summarizeLogs(job?.logProduksi ?? []);
      const targetOutput = job?.targetOutput ?? mold.targetOutput;
      const totalOutput = stats.totalGoodProduct + stats.totalReject;

      return {
        moldId: mold.id,
        kodeMold: mold.kodeMold,
        namaProduk: mold.namaProduk,
        cavity: mold.cavity,
        tonaseTon: mold.tonaseTon,
        trackingStatus: mold.trackingStatus as unknown as MoldTrackingStatus,
        jobId: job?.id ?? null,
        jobNumber: job?.jobNumber ?? null,
        lifecycle: (job?.lifecycle as unknown as JobLifecycle | undefined) ?? null,
        machineNumber: job?.machine?.machineNumber ?? null,
        progressMolding: stats.progressMolding,
        targetOutput,
        totalGoodProduct: stats.totalGoodProduct,
        totalReject: stats.totalReject,
        achievement: achievementPercent(stats.totalGoodProduct, targetOutput),
        rejectRate: totalOutput ? round((stats.totalReject / totalOutput) * 100) : 0,
        sisaHariSewa: remainingDays(job?.endDate ?? null, now),
        etaHari: etaDays(stats.totalGoodProduct, targetOutput, stats.produksiHari),
        planMaterialUtama: job?.planMaterialUtama ?? mold.planMaterialUtama,
        estimasiKg: job?.estimasiMaterialKg ?? mold.estimasiKg,
        materialDatangKg: stats.materialDatangKg,
        materialTerpakaiKg:
          stats.materialRemainingKg == null
            ? null
            : round(stats.materialDatangKg - stats.materialRemainingKg),
        materialRemainingKg: stats.materialRemainingKg,
        materialTambahan: job?.materialTambahan ?? null,
        rencanaKirimMold: job?.rencanaKirimMold?.toISOString() ?? null,
        endDate: job?.endDate?.toISOString() ?? null,
      };
    });
  }
}

type LogRow = {
  eventType: string;
  occurredAt: Date;
  goodProduct: number | null;
  rejectCount: number | null;
  jumlahKg: number | null;
  materialRemainingKg: number | null;
  progressMolding: string | null;
};

// Ringkasan satu set LogProduksi (urut terbaru dulu). Satu tempat supaya angka
// di dashboard job, plan mold, dan detail cetakan tidak saling beda.
function summarizeLogs(logs: LogRow[]) {
  const produksiHari = new Set(
    logs
      .filter((l) => l.eventType === LogProduksiEventType.PRODUKSI_HARIAN)
      .map((l) => l.occurredAt.toISOString().slice(0, 10)),
  ).size;

  return {
    totalGoodProduct: logs.reduce((a, l) => a + (l.goodProduct ?? 0), 0),
    totalReject: logs.reduce((a, l) => a + (l.rejectCount ?? 0), 0),
    materialDatangKg: round(logs.reduce((a, l) => a + (l.jumlahKg ?? 0), 0)),
    materialRemainingKg: logs.find((l) => l.materialRemainingKg != null)?.materialRemainingKg ?? null,
    progressMolding:
      (logs.find((l) => l.progressMolding != null)?.progressMolding as unknown as
        | ProgressMolding
        | undefined) ?? null,
    latestLogAt: logs[0]?.occurredAt.toISOString() ?? null,
    produksiHari,
  };
}

const achievementPercent = (good: number, target: number | null) =>
  target ? round((good / target) * 100) : 0;

// ETA kasar: sisa target dibagi rata-rata output per hari produksi yang sudah
// tercatat. null bila belum ada target atau belum ada hari produksi; 0 berarti
// target sudah tercapai.
// ponytail: rata-rata sederhana, cukup untuk indikator. Ganti dengan laju
// beberapa hari terakhir bila butuh perkiraan yang lebih responsif.
function etaDays(good: number, target: number | null, produksiHari: number): number | null {
  if (!target || produksiHari === 0 || good === 0) return null;
  const sisa = target - good;
  if (sisa <= 0) return 0;
  return Math.ceil(sisa / (good / produksiHari));
}

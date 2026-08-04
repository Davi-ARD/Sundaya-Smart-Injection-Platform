import { Injectable } from '@nestjs/common';
import { $Enums, User as PrismaUser } from '@prisma/client';
import {
  DailyCycleEntry,
  JobCycleProduction,
  JobDashboard,
  JobLifecycle,
  JobLogEntry,
  LogProduksiEventType,
  ManagerDashboard,
  MoldCycleProduction,
  MoldPlanRow,
  MoldTrackingStatus,
  ProgressMolding,
} from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { remainingDays } from '../jobs/job-status';

const round = (n: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

// Mold yang secara fisik ada di Sundaya (sudah diterima, belum dikirim balik).
const AT_SUNDAYA = [
  MoldTrackingStatus.RECEIVED,
  MoldTrackingStatus.PRODUCTION,
] as unknown as $Enums.MoldTrackingStatus[];

const AKTIF = JobLifecycle.AKTIF as unknown as $Enums.JobLifecycle;

// Lifecycle booking yang masih berjalan; dipakai memilih job yang layak tampil di
// cycle production dashboard Manager.
const BERJALAN = [
  JobLifecycle.DIKONFIRMASI,
  JobLifecycle.AKTIF,
] as unknown as $Enums.JobLifecycle[];

@Injectable()
export class DashboardPenyewaService {
  constructor(private prisma: PrismaService) {}

  // Dashboard Manager: ringkasan tenant sendiri, murni turunan data yang sudah ada
  // (mold tracking, job, Log Produksi). Read-only, tanpa aksi.
  //
  // Target output kini tinggal di Mold (bukan Job), jadi pencapaian dihitung per
  // cetakan lalu dirata-rata.
  async manager(user: PrismaUser): Promise<ManagerDashboard> {
    const managerId = user.id;

    const [moldsAtSundaya, ongoing, goodAgg, targetedMolds] = await Promise.all([
      this.prisma.mold.count({ where: { managerId, trackingStatus: { in: AT_SUNDAYA } } }),
      this.prisma.job.count({ where: { managerId, lifecycle: AKTIF } }),
      this.prisma.logProduksi.aggregate({
        _sum: { goodProduct: true },
        where: { mold: { managerId } },
      }),
      this.prisma.mold.findMany({
        where: { managerId, targetOutput: { not: null } },
        select: { id: true, targetOutput: true },
      }),
    ]);

    return {
      moldsAtSundaya,
      ongoing,
      totalGoodProduct: goodAgg._sum.goodProduct ?? 0,
      avgAchievement: await this.avgAchievement(targetedMolds),
    };
  }

  private async avgAchievement(
    molds: { id: string; targetOutput: number | null }[],
  ): Promise<number> {
    if (!molds.length) return 0;
    const sums = await this.prisma.logProduksi.groupBy({
      by: ['moldId'],
      where: { moldId: { in: molds.map((m) => m.id) } },
      _sum: { goodProduct: true },
    });
    const goodByMold = new Map(sums.map((s) => [s.moldId, s._sum.goodProduct ?? 0]));
    const total = molds.reduce(
      (acc, m) => acc + (goodByMold.get(m.id) ?? 0) / (m.targetOutput as number),
      0,
    );
    return round((total / molds.length) * 100);
  }

  // Cycle production (Manager Penyewa): satu blok per booking, di dalamnya satu
  // kartu per cetakan berisi capaian terhadap target, pemakaian material terhadap
  // kuota, dan rekap harian. Semua turunan Log Produksi, tanpa input manual.
  async cycleProduction(user: PrismaUser): Promise<JobCycleProduction[]> {
    const jobs = await this.prisma.job.findMany({
      where: { managerId: user.id, lifecycle: { in: BERJALAN } },
      orderBy: { createdAt: 'desc' },
      include: {
        machines: { select: { machineNumber: true }, orderBy: { machineNumber: 'asc' } },
        molds: {
          orderBy: { kodeMold: 'asc' },
          include: {
            // ponytail: muat log per cetakan (jumlah booking berjalan kecil);
            // pindah ke agregat SQL bila satu cetakan punya ribuan event.
            logProduksi: { orderBy: { occurredAt: 'desc' } },
          },
        },
      },
    });

    const now = new Date();
    return jobs.map((job) => ({
      jobId: job.id,
      jobNumber: job.jobNumber,
      lifecycle: job.lifecycle as unknown as JobLifecycle,
      machineNumbers: job.machines.map((m) => m.machineNumber),
      requestedMachineCount: job.requestedMachineCount,
      sisaHariSewa: remainingDays(job.endDate, now),
      molds: job.molds.map((mold) => this.toMoldCycle(mold, mold.logProduksi)),
    }));
  }

  private toMoldCycle(
    mold: {
      id: string;
      kodeMold: string;
      namaProduk: string;
      targetOutput: number | null;
      planMaterialUtama: string | null;
      estimasiKg: number | null;
    },
    logs: LogRow[],
  ): MoldCycleProduction {
    const stats = summarizeLogs(logs);
    const totalOutput = stats.totalGoodProduct + stats.totalReject;
    const material = materialQuota(mold.estimasiKg, stats.materialUsedKg);

    const harian: DailyCycleEntry[] = logs
      .filter((l) => l.eventType === LogProduksiEventType.PRODUKSI_HARIAN)
      .map((l) => ({
        occurredAt: l.occurredAt.toISOString(),
        goodProduct: l.goodProduct ?? 0,
        rejectCount: l.rejectCount ?? 0,
        materialUsedKg: l.materialUsedKg,
        catatan: l.catatan,
      }));

    return {
      moldId: mold.id,
      kodeMold: mold.kodeMold,
      namaProduk: mold.namaProduk,
      targetOutput: mold.targetOutput,
      totalGoodProduct: stats.totalGoodProduct,
      totalReject: stats.totalReject,
      totalOutput,
      achievement: achievementPercent(stats.totalGoodProduct, mold.targetOutput),
      rejectRate: totalOutput ? round((stats.totalReject / totalOutput) * 100) : 0,
      remainingTarget:
        mold.targetOutput == null ? null : Math.max(mold.targetOutput - stats.totalGoodProduct, 0),
      planMaterialUtama: mold.planMaterialUtama,
      planMaterialKg: mold.estimasiKg,
      materialUsedKg: stats.materialUsedKg,
      materialRemainingKg: material.remaining,
      materialUsagePercent: material.percent,
      harian,
    };
  }

  // Dashboard job (Admin Penyewa di lokasi): satu baris per cetakan pada booking
  // aktif tenant induknya (parentId). Booking bisa memuat beberapa cetakan, jadi
  // barisnya per cetakan, bukan per job.
  async job(user: PrismaUser): Promise<JobDashboard[]> {
    const managerId = user.parentId ?? '__none__';
    const jobs = await this.prisma.job.findMany({
      where: { managerId, lifecycle: AKTIF },
      orderBy: { createdAt: 'desc' },
      include: {
        machines: { select: { machineNumber: true }, orderBy: { machineNumber: 'asc' } },
        molds: {
          orderBy: { kodeMold: 'asc' },
          include: { logProduksi: { orderBy: { occurredAt: 'desc' } } },
        },
      },
    });

    const now = new Date();
    return jobs.flatMap((job) =>
      job.molds.map((mold) => {
        const stats = summarizeLogs(mold.logProduksi);
        const material = materialQuota(mold.estimasiKg, stats.materialUsedKg);

        return {
          jobId: job.id,
          jobNumber: job.jobNumber,
          lifecycle: job.lifecycle as unknown as JobLifecycle,
          machineNumbers: job.machines.map((m) => m.machineNumber),
          moldId: mold.id,
          moldKode: mold.kodeMold,
          moldProduk: mold.namaProduk,
          moldCavity: mold.cavity,
          moldTonaseTon: mold.tonaseTon,
          progressMolding: stats.progressMolding,
          targetOutput: mold.targetOutput,
          achievement: achievementPercent(stats.totalGoodProduct, mold.targetOutput),
          totalGoodProduct: stats.totalGoodProduct,
          totalReject: stats.totalReject,
          planMaterialKg: mold.estimasiKg,
          materialUsedKg: stats.materialUsedKg,
          materialRemainingKg: material.remaining,
          endDate: job.endDate?.toISOString() ?? null,
          sisaHariSewa: remainingDays(job.endDate, now),
          latestLogAt: stats.latestLogAt,
        };
      }),
    );
  }

  // Log utama Admin Penyewa: satu timeline berisi event dari seluruh cetakan tenant
  // induk. Dibatasi supaya halaman tetap ringan; naikkan limit atau tambah paging
  // bila tenant punya banyak job.
  async jobLogs(user: PrismaUser, limit = 50): Promise<JobLogEntry[]> {
    const managerId = user.parentId ?? '__none__';
    const logs = await this.prisma.logProduksi.findMany({
      where: { job: { managerId } },
      orderBy: { occurredAt: 'desc' },
      take: limit,
      include: {
        job: { select: { jobNumber: true } },
        mold: { select: { kodeMold: true } },
        machine: { select: { machineNumber: true } },
      },
    });

    return logs.map(({ job, mold, machine, ...log }) => ({
      ...log,
      eventType: log.eventType as unknown as LogProduksiEventType,
      progressMolding: log.progressMolding as unknown as ProgressMolding | null,
      occurredAt: log.occurredAt.toISOString(),
      createdAt: log.createdAt.toISOString(),
      jobNumber: job.jobNumber,
      moldKode: mold.kodeMold,
      machineNumber: machine?.machineNumber ?? null,
    }));
  }

  // Perkembangan plan mold (Manager Penyewa): satu baris per cetakan miliknya,
  // menggabung tracking fisik, booking/mesin, capaian produksi, dan kuota material.
  // Jadi satu-satunya tabel di dashboard Manager (menggantikan tabel job terpisah).
  async moldPlan(user: PrismaUser): Promise<MoldPlanRow[]> {
    const molds = await this.prisma.mold.findMany({
      where: { managerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        logProduksi: { orderBy: { occurredAt: 'desc' } },
        job: {
          include: {
            machines: { select: { machineNumber: true }, orderBy: { machineNumber: 'asc' } },
          },
        },
      },
    });

    const now = new Date();
    return molds.map((mold) => {
      const job = mold.job;
      const stats = summarizeLogs(mold.logProduksi);
      const totalOutput = stats.totalGoodProduct + stats.totalReject;
      const material = materialQuota(mold.estimasiKg, stats.materialUsedKg);

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
        machineNumbers: job?.machines.map((m) => m.machineNumber) ?? [],
        progressMolding: stats.progressMolding,
        targetOutput: mold.targetOutput,
        totalGoodProduct: stats.totalGoodProduct,
        totalReject: stats.totalReject,
        achievement: achievementPercent(stats.totalGoodProduct, mold.targetOutput),
        rejectRate: totalOutput ? round((stats.totalReject / totalOutput) * 100) : 0,
        sisaHariSewa: remainingDays(job?.endDate ?? null, now),
        etaHari: etaDays(stats.totalGoodProduct, mold.targetOutput, stats.produksiHari),
        planMaterialUtama: mold.planMaterialUtama,
        estimasiKg: mold.estimasiKg,
        materialUsedKg: stats.materialUsedKg,
        materialRemainingKg: material.remaining,
        materialUsagePercent: material.percent,
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
  materialUsedKg: number | null;
  progressMolding: string | null;
  catatan: string | null;
};

// Ringkasan satu set LogProduksi (urut terbaru dulu). Satu tempat supaya angka di
// dashboard job, plan mold, cycle production, dan detail cetakan tidak saling beda.
function summarizeLogs(logs: LogRow[]) {
  const produksiHari = new Set(
    logs
      .filter((l) => l.eventType === LogProduksiEventType.PRODUKSI_HARIAN)
      .map((l) => l.occurredAt.toISOString().slice(0, 10)),
  ).size;

  return {
    totalGoodProduct: logs.reduce((a, l) => a + (l.goodProduct ?? 0), 0),
    totalReject: logs.reduce((a, l) => a + (l.rejectCount ?? 0), 0),
    // Material terpakai adalah akumulasi, bukan angka terakhir: plan berlaku sebagai
    // kuota untuk seluruh siklus produksi cetakan itu.
    materialUsedKg: round(logs.reduce((a, l) => a + (l.materialUsedKg ?? 0), 0)),
    progressMolding:
      (logs.find((l) => l.progressMolding != null)?.progressMolding as unknown as
        | ProgressMolding
        | undefined) ?? null,
    latestLogAt: logs[0]?.occurredAt.toISOString() ?? null,
    produksiHari,
  };
}

// Kuota material: plan adalah batas keras, jadi sisa tidak pernah negatif dan
// persentase tidak pernah lewat 100. Plan kosong berarti tidak dibatasi.
function materialQuota(plan: number | null, used: number) {
  if (plan == null) return { remaining: null, percent: null };
  return {
    remaining: round(Math.max(plan - used, 0)),
    percent: plan > 0 ? round(Math.min((used / plan) * 100, 100)) : null,
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

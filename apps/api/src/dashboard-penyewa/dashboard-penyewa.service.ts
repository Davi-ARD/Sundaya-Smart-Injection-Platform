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
  MoldRunEntry,
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

    const harian = toHarian(logs);

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
          include: {
            logProduksi: { orderBy: { occurredAt: 'desc' } },
            runs: { orderBy: { at: 'desc' }, take: 1 },
          },
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
          progressMolding: progressFor(
            stats.totalGoodProduct,
            mold.targetOutput,
            mold.runs?.[0],
          ),
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
  // Satu baris per PEMAKAIAN cetakan, bukan per cetakan. Cetakan yang dipakai di
  // beberapa booking muncul beberapa kali dengan job berbeda, dan angkanya
  // dihitung khusus untuk booking itu saja. Cetakan yang belum pernah dibooking
  // tetap muncul satu baris tanpa job.
  async moldPlan(user: PrismaUser): Promise<MoldPlanRow[]> {
    const molds = await this.prisma.mold.findMany({
      where: { managerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        logProduksi: { orderBy: { occurredAt: 'desc' } },
        runs: { orderBy: { at: 'desc' } },
        usages: {
          orderBy: { at: 'desc' },
          include: {
            job: {
              include: {
                machines: { select: { machineNumber: true }, orderBy: { machineNumber: 'asc' } },
              },
            },
          },
        },
      },
    });

    const now = new Date();
    return molds.flatMap((mold) => {
      // Tanpa riwayat pemakaian berarti belum pernah dibooking: satu baris polos.
      if (!mold.usages.length) return [this.moldPlanRow(mold, null, mold.logProduksi, mold.runs, now)];

      return mold.usages.map((usage) =>
        this.moldPlanRow(
          mold,
          usage.job,
          mold.logProduksi.filter((l) => l.jobId === usage.jobId),
          mold.runs.filter((r) => r.jobId === usage.jobId),
          now,
          { logs: mold.logProduksi, runs: mold.runs },
        ),
      );
    });
  }

  // Satu baris rencana cetakan. Log dan sesi sudah disaring pemanggil ke booking
  // yang bersangkutan, sehingga capaian satu baris tidak bercampur booking lain.
  private moldPlanRow(
    mold: MoldRow,
    job: JobRow | null,
    logs: LogRow[],
    runs: RunRow[],
    now: Date,
    // Riwayat sesi sengaja TIDAK disaring per booking: panel detail cetakan harus
    // menampilkan seluruh pemakaian cetakan itu sepanjang umurnya, bukan hanya
    // yang kebetulan jatuh di booking baris ini.
    seluruh: { logs: LogRow[]; runs: RunRow[] } = { logs, runs },
  ): MoldPlanRow {
    const stats = summarizeLogs(logs);
    const statsSeluruh = summarizeLogs(seluruh.logs);
    const totalOutput = stats.totalGoodProduct + stats.totalReject;
    const material = materialQuota(mold.estimasiKg, stats.materialUsedKg);
    // Cetakan yang sedang menempel pada booking ini menampilkan status tracking
    // berjalannya; baris booking lama tidak lagi punya status karena cetakannya
    // sudah dilepas saat booking itu tutup.
    const tracking =
      job != null && mold.jobId === job.id
        ? (mold.trackingStatus as unknown as MoldTrackingStatus | null)
        : job == null
          ? (mold.trackingStatus as unknown as MoldTrackingStatus | null)
          : null;

    return {
      moldId: mold.id,
      kodeMold: mold.kodeMold,
      namaProduk: mold.namaProduk,
      cavity: mold.cavity,
      tonaseTon: mold.tonaseTon,
      trackingStatus: tracking,
      jobId: job?.id ?? null,
      jobNumber: job?.jobNumber ?? null,
      lifecycle: (job?.lifecycle as unknown as JobLifecycle | undefined) ?? null,
      machineNumbers: job?.machines.map((m) => m.machineNumber) ?? [],
      progressMolding: progressFor(stats.totalGoodProduct, mold.targetOutput, runs[0]),
      targetOutput: runs[0]?.targetOutput ?? mold.targetOutput,
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
      harian: toHarian(logs),
      runs: toRuns(seluruh.runs, statsSeluruh.totalGoodProduct, statsSeluruh.materialUsedKg),
    };
  }
}

// Rincian per hari dari Log Produksi, terbaru dulu (mengikuti urutan query).
// Dipakai bersama oleh moldPlan dan cycleProduction supaya keduanya menampilkan
// angka harian yang sama persis.
// Riwayat sesi produksi cetakan. Capaian tiap sesi dihitung sebagai selisih
// antara titik awal sesi itu dan titik awal sesi berikutnya; sesi terbaru diukur
// terhadap akumulasi berjalan karena belum ada penutupnya.
//
// runs datang terbaru dulu, jadi "sesi berikutnya" adalah tetangga di indeks
// sebelumnya.
function toRuns(
  runs: RunRow[],
  totalGood: number,
  totalMaterial: number,
): MoldRunEntry[] {
  return runs.map((run, i) => {
    const berikutnya = i === 0 ? null : runs[i - 1];
    const goodAkhir = berikutnya ? berikutnya.goodAwal : totalGood;
    const materialAkhir = berikutnya ? berikutnya.materialAwal : totalMaterial;
    const goodProduct = round(Math.max(goodAkhir - run.goodAwal, 0));

    return {
      id: run.id,
      targetOutput: run.targetOutput,
      estimasiKg: run.estimasiKg,
      goodProduct,
      materialUsedKg: round(Math.max(materialAkhir - run.materialAwal, 0)),
      tercapai: goodProduct >= run.targetOutput,
      mulai: run.at.toISOString(),
      selesai: berikutnya ? berikutnya.at.toISOString() : null,
    };
  });
}

function toHarian(logs: LogRow[]): DailyCycleEntry[] {
  return logs
    .filter((l) => l.eventType === LogProduksiEventType.PRODUKSI_HARIAN)
    .map((l) => ({
      occurredAt: l.occurredAt.toISOString(),
      goodProduct: l.goodProduct ?? 0,
      rejectCount: l.rejectCount ?? 0,
      materialUsedKg: l.materialUsedKg,
      catatan: l.catatan,
    }));
}

// Bentuk baris yang dibaca moldPlanRow. Ditulis eksplisit supaya fungsi itu
// tidak bergantung pada tipe hasil query yang panjang.
type MoldRow = {
  id: string;
  kodeMold: string;
  namaProduk: string;
  cavity: number;
  tonaseTon: number;
  jobId: string | null;
  trackingStatus: string | null;
  planMaterialUtama: string | null;
  estimasiKg: number | null;
  targetOutput: number | null;
};

type JobRow = {
  id: string;
  jobNumber: string;
  lifecycle: string;
  endDate: Date | null;
  machines: { machineNumber: string }[];
};

type RunRow = {
  id: string;
  jobId?: string | null;
  targetOutput: number;
  estimasiKg: number | null;
  goodAwal: number;
  materialAwal: number;
  at: Date;
};

type LogRow = {
  jobId?: string;
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
// Progress cetakan diturunkan dari SESI produksi yang sedang berjalan, bukan dari
// akumulasi umur cetakan. Cetakan yang dipakai lagi punya target barunya sendiri,
// jadi hasil sesi lama tidak boleh membuatnya langsung terlihat selesai.
//
// Belum ada produksi di sesi ini berarti belum punya progress.
function progressFor(
  totalGood: number,
  target: number | null,
  sesi: { targetOutput: number; goodAwal: number } | undefined,
) {
  const targetSesi = sesi?.targetOutput ?? target;
  const goodSesi = Math.max(totalGood - (sesi?.goodAwal ?? 0), 0);
  if (goodSesi <= 0) return null;
  if (targetSesi != null && goodSesi >= targetSesi) return ProgressMolding.SUDAH_DIPRODUKSI;
  return ProgressMolding.ONGOING;
}

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

import {
  Job,
  JobMachine,
  JobMold,
  RentalExtension,
} from '@mold-tracker/shared';
import {
  Job as PrismaJob,
  Mold as PrismaMold,
  RentalExtension as PrismaRentalExtension,
} from '@prisma/client';
import { computeJobStatus } from './job-status';

// Mesin yang dipinjamkan ke booking. Tidak dipasangkan ke cetakan tertentu: pasangan
// cetakan-mesin yang benar-benar dipakai dicatat per event di Log Produksi.
export type MachineRow = {
  id: string;
  machineNumber: string;
  tonaseTon: number;
  status: string;
};

export const toJobMachine = (m: MachineRow): JobMachine => ({
  machineId: m.id,
  machineNumber: m.machineNumber,
  tonaseTon: m.tonaseTon,
  status: m.status as unknown as JobMachine['status'],
});

// Cetakan di dalam booking. Plan dan tonase dibaca dari Mold, tidak diduplikasi
// di Job, jadi tidak ada dua sumber angka rencana yang bisa berbeda.
export type MoldWithProgress = PrismaMold & {
  runs?: { jobId: string | null; targetOutput: number; goodAwal: number }[];
  logProduksi?: { goodProduct: number | null; jobId?: string }[];
};

// jobId menyebut booking yang sedang ditampilkan. Capaian dihitung terhadap SESI
// produksi booking itu, bukan seluruh umur cetakan, sehingga booking yang sudah
// selesai tetap menampilkan hasilnya sendiri dan cetakan yang dipakai ulang
// tidak langsung terlihat selesai karena hasil booking sebelumnya.
export function toJobMold(m: MoldWithProgress, jobId?: string): JobMold {
  const runs = m.runs ?? [];
  // Sesi yang relevan: sesi terbaru milik booking ini (runs sudah terurut terbaru
  // dulu). Tanpa jobId, sesi terbaru cetakan ini apa pun booking-nya.
  const idx = jobId ? runs.findIndex((r) => r.jobId === jobId) : 0;
  const sesi = idx >= 0 ? runs[idx] : undefined;

  // Hasil satu sesi adalah SELISIH antara titik awalnya dan titik awal sesi
  // sesudahnya; sesi terbaru diukur terhadap akumulasi berjalan karena belum
  // ada penutupnya. Cara ini benar walau satu booking memuat beberapa sesi.
  const lifetime = (m.logProduksi ?? []).reduce((a, l) => a + (l.goodProduct ?? 0), 0);
  const sesudahnya = idx > 0 ? runs[idx - 1] : undefined;
  const akhir = sesudahnya ? sesudahnya.goodAwal : lifetime;

  const targetSesi = sesi?.targetOutput ?? m.targetOutput;
  const goodSesi = sesi ? Math.max(akhir - sesi.goodAwal, 0) : lifetime;

  return {
    moldId: m.id,
    kodeMold: m.kodeMold,
    namaProduk: m.namaProduk,
    cavity: m.cavity,
    tonaseTon: m.tonaseTon,
    trackingStatus: m.trackingStatus as unknown as JobMold['trackingStatus'],
    planMaterialUtama: m.planMaterialUtama,
    estimasiKg: m.estimasiKg,
    targetOutput: targetSesi,
    goodProduct: goodSesi,
    // Cetakan tanpa target tidak pernah dinyatakan selesai sendiri: batasnya
    // memang tidak ada, jadi produksinya tetap terbuka.
    selesai: targetSesi != null && goodSesi >= targetSesi,
  };
}

// Batas record Prisma -> bentuk API bersama: tanggal jadi ISO string, enum di-cast.
// jobStatus dihitung saat baca dari lifecycle + endDate (bukan kolom tersimpan basi).
// ponytail: enum shared dan Prisma nominal berbeda meski nilainya sama, cast di sini saja.
export function toJob(
  j: PrismaJob & { manager?: { companyName: string | null } },
  molds: MoldWithProgress[] = [],
  machines: MachineRow[] = [],
  extensions: PrismaRentalExtension[] = [],
  now: Date = new Date(),
  jobId?: string,
): Job {
  const lifecycle = j.lifecycle as unknown as Job['lifecycle'];
  return {
    id: j.id,
    jobNumber: j.jobNumber,
    molds: molds.map((m) => toJobMold(m, jobId)),
    machines: machines.map(toJobMachine),
    requestedMachineCount: j.requestedMachineCount,
    managerId: j.managerId,
    companyName: j.manager?.companyName ?? null,
    assignedById: j.assignedById,
    lifecycle,
    jobStatus: computeJobStatus(lifecycle, j.endDate, now),
    requestedDurationDays: j.requestedDurationDays,
    startDate: j.startDate?.toISOString() ?? null,
    endDate: j.endDate?.toISOString() ?? null,
    catatan: j.catatan,
    confirmedAt: j.confirmedAt?.toISOString() ?? null,
    receivedAt: j.receivedAt?.toISOString() ?? null,
    rejectionReason: j.rejectionReason,
    createdAt: j.createdAt.toISOString(),
    extensions: extensions.map(toRentalExtension),
  };
}

export function toRentalExtension(e: PrismaRentalExtension): RentalExtension {
  return {
    id: e.id,
    jobId: e.jobId,
    additionalDays: e.additionalDays,
    status: e.status as unknown as RentalExtension['status'],
    requestedAt: e.requestedAt.toISOString(),
    decidedAt: e.decidedAt?.toISOString() ?? null,
  };
}

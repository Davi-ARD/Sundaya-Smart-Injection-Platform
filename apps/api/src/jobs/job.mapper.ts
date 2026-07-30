import { Job, JobMold, RentalExtension } from '@mold-tracker/shared';
import {
  Job as PrismaJob,
  Mold as PrismaMold,
  RentalExtension as PrismaRentalExtension,
} from '@prisma/client';
import { computeJobStatus } from './job-status';

// Cetakan di dalam booking. Plan dan tonase dibaca dari Mold, tidak diduplikasi
// di Job, jadi tidak ada dua sumber angka rencana yang bisa berbeda.
export function toJobMold(m: PrismaMold): JobMold {
  return {
    moldId: m.id,
    kodeMold: m.kodeMold,
    namaProduk: m.namaProduk,
    cavity: m.cavity,
    tonaseTon: m.tonaseTon,
    trackingStatus: m.trackingStatus as unknown as JobMold['trackingStatus'],
    planMaterialUtama: m.planMaterialUtama,
    estimasiKg: m.estimasiKg,
    targetOutput: m.targetOutput,
  };
}

// Batas record Prisma -> bentuk API bersama: tanggal jadi ISO string, enum di-cast.
// jobStatus dihitung saat baca dari lifecycle + endDate (bukan kolom tersimpan basi).
// ponytail: enum shared dan Prisma nominal berbeda meski nilainya sama, cast di sini saja.
export function toJob(
  j: PrismaJob & { manager?: { companyName: string | null } },
  molds: PrismaMold[] = [],
  machineNumber?: string,
  extensions: PrismaRentalExtension[] = [],
  now: Date = new Date(),
): Job {
  const lifecycle = j.lifecycle as unknown as Job['lifecycle'];
  return {
    id: j.id,
    jobNumber: j.jobNumber,
    molds: molds.map(toJobMold),
    managerId: j.managerId,
    machineId: j.machineId,
    machineNumber,
    companyName: j.manager?.companyName ?? null,
    assignedById: j.assignedById,
    lifecycle,
    jobStatus: computeJobStatus(lifecycle, j.endDate, now),
    requestedDurationDays: j.requestedDurationDays,
    startDate: j.startDate?.toISOString() ?? null,
    endDate: j.endDate?.toISOString() ?? null,
    catatan: j.catatan,
    confirmedAt: j.confirmedAt?.toISOString() ?? null,
    shippedAt: j.shippedAt?.toISOString() ?? null,
    receivedAt: j.receivedAt?.toISOString() ?? null,
    returnedAt: j.returnedAt?.toISOString() ?? null,
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

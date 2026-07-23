import { Job, RentalExtension } from '@mold-tracker/shared';
import {
  Job as PrismaJob,
  RentalExtension as PrismaRentalExtension,
} from '@prisma/client';
import { computeJobStatus } from './job-status';

// Batas record Prisma -> bentuk API bersama: tanggal jadi ISO string, enum di-cast.
// jobStatus dihitung saat baca dari lifecycle + endDate (bukan kolom tersimpan basi).
// ponytail: enum shared dan Prisma nominal berbeda meski nilainya sama, cast di sini saja.
export function toJob(
  j: PrismaJob,
  machineNumber?: string,
  extensions: PrismaRentalExtension[] = [],
  now: Date = new Date(),
): Job {
  const lifecycle = j.lifecycle as unknown as Job['lifecycle'];
  return {
    id: j.id,
    jobNumber: j.jobNumber,
    moldId: j.moldId,
    managerId: j.managerId,
    machineId: j.machineId,
    machineNumber,
    assignedById: j.assignedById,
    lifecycle,
    jobStatus: computeJobStatus(lifecycle, j.endDate, now),
    requestedDurationDays: j.requestedDurationDays,
    destinationLocation: j.destinationLocation,
    startDate: j.startDate?.toISOString() ?? null,
    endDate: j.endDate?.toISOString() ?? null,
    planMaterialUtama: j.planMaterialUtama,
    estimasiMaterialKg: j.estimasiMaterialKg,
    materialTambahan: j.materialTambahan,
    targetOutput: j.targetOutput,
    rencanaKirimMold: j.rencanaKirimMold?.toISOString() ?? null,
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

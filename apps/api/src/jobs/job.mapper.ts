import { Job, MoldTrackingStatus, RentalExtension } from '@mold-tracker/shared';
import {
  Job as PrismaJob,
  RentalExtension as PrismaRentalExtension,
} from '@prisma/client';
import { computeJobStatus } from './job-status';

// Ringkasan mold sebagaimana dimuat via include Prisma di jobs.service.ts.
type MoldSummary = {
  id: string;
  kodeMold: string;
  namaProduk: string;
  trackingStatus: string;
  tonaseTon: number;
} | null;

// Batas record Prisma -> bentuk API bersama: tanggal jadi ISO string, enum di-cast.
// jobStatus dihitung saat baca dari lifecycle + endDate (bukan kolom tersimpan basi).
// ponytail: enum shared dan Prisma nominal berbeda meski nilainya sama, cast di sini saja.
export function toJob(
  j: PrismaJob & { manager?: { companyName: string | null } },
  machineNumber?: string,
  extensions: PrismaRentalExtension[] = [],
  mold?: MoldSummary,
  now: Date = new Date(),
): Job {
  const lifecycle = j.lifecycle as unknown as Job['lifecycle'];
  return {
    id: j.id,
    jobNumber: j.jobNumber,
    moldId: j.moldId,
    mold: mold
      ? {
          id: mold.id,
          kodeMold: mold.kodeMold,
          namaProduk: mold.namaProduk,
          trackingStatus: mold.trackingStatus as unknown as MoldTrackingStatus,
          tonaseTon: mold.tonaseTon,
        }
      : undefined,
    managerId: j.managerId,
    machineId: j.machineId,
    machineNumber,
    companyName: j.manager?.companyName ?? null,
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

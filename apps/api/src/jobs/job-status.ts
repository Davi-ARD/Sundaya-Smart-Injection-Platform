import {
  JobLifecycle,
  JobStatus,
  RENTAL_CRITICAL_DAYS,
  RENTAL_WARNING_DAYS,
} from '@mold-tracker/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

// Sisa masa sewa dalam hari. Negatif berarti sudah lewat jatuh tempo; null bila
// job belum aktif (endDate baru diisi saat mesin diaktifkan).
export function remainingDays(endDate: Date | null, now: Date = new Date()): number | null {
  if (!endDate) return null;
  return Math.ceil((endDate.getTime() - now.getTime()) / DAY_MS);
}

// jobStatus untuk dashboard Sundaya dihitung dari sisa sewa, bukan disimpan basi
// (PROJECT_CONTEXT bagian 8: jangan input manual angka yang bisa dihitung).
// COMPLETED bila lifecycle sudah SELESAI; selain itu dari sisa hari sampai endDate.
// Overdue (sisa < 0) masuk CRITICAL karena JobStatus tidak punya state overdue sendiri.
export function computeJobStatus(
  lifecycle: JobLifecycle,
  endDate: Date | null,
  now: Date = new Date(),
): JobStatus {
  if (lifecycle === JobLifecycle.SELESAI) return JobStatus.COMPLETED;
  if (!endDate) return JobStatus.ON_SCHEDULE;

  const remaining = remainingDays(endDate, now) as number;
  if (remaining <= RENTAL_CRITICAL_DAYS) return JobStatus.CRITICAL;
  if (remaining <= RENTAL_WARNING_DAYS) return JobStatus.WARNING;
  return JobStatus.ON_SCHEDULE;
}

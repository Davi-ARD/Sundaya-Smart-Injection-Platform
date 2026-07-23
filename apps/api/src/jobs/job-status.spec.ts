import { JobLifecycle, JobStatus } from '@mold-tracker/shared';
import { computeJobStatus } from './job-status';

const now = new Date('2026-07-23T00:00:00.000Z');
const inDays = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

describe('computeJobStatus', () => {
  it('COMPLETED bila lifecycle SELESAI (abaikan tanggal)', () => {
    expect(computeJobStatus(JobLifecycle.SELESAI, inDays(30), now)).toBe(JobStatus.COMPLETED);
  });

  it('ON_SCHEDULE bila endDate null (belum aktif)', () => {
    expect(computeJobStatus(JobLifecycle.DIKONFIRMASI, null, now)).toBe(JobStatus.ON_SCHEDULE);
  });

  it('ON_SCHEDULE bila sisa > 3 hari', () => {
    expect(computeJobStatus(JobLifecycle.AKTIF, inDays(10), now)).toBe(JobStatus.ON_SCHEDULE);
  });

  it('WARNING bila sisa <= 3 hari', () => {
    expect(computeJobStatus(JobLifecycle.AKTIF, inDays(3), now)).toBe(JobStatus.WARNING);
  });

  it('CRITICAL bila sisa <= 1 hari', () => {
    expect(computeJobStatus(JobLifecycle.AKTIF, inDays(1), now)).toBe(JobStatus.CRITICAL);
  });

  it('CRITICAL bila sudah overdue (sisa negatif)', () => {
    expect(computeJobStatus(JobLifecycle.AKTIF, inDays(-2), now)).toBe(JobStatus.CRITICAL);
  });
});

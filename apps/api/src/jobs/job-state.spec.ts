import { ConflictException } from '@nestjs/common';
import { JobLifecycle } from '@mold-tracker/shared';
import { nextJobLifecycle } from './job-state';

describe('nextJobLifecycle', () => {
  it('mengizinkan DIAJUKAN -> DIKONFIRMASI', () => {
    expect(nextJobLifecycle(JobLifecycle.DIAJUKAN, JobLifecycle.DIKONFIRMASI)).toBe(
      JobLifecycle.DIKONFIRMASI,
    );
  });

  it('mengizinkan DIAJUKAN -> DITOLAK', () => {
    expect(nextJobLifecycle(JobLifecycle.DIAJUKAN, JobLifecycle.DITOLAK)).toBe(
      JobLifecycle.DITOLAK,
    );
  });

  it('mengizinkan rantai penuh DIKONFIRMASI..SELESAI', () => {
    let s = JobLifecycle.DIKONFIRMASI;
    for (const next of [JobLifecycle.AKTIF, JobLifecycle.SELESAI]) {
      s = nextJobLifecycle(s, next);
    }
    expect(s).toBe(JobLifecycle.SELESAI);
  });

  it('menolak lompat DIAJUKAN -> AKTIF', () => {
    expect(() => nextJobLifecycle(JobLifecycle.DIAJUKAN, JobLifecycle.AKTIF)).toThrow(
      ConflictException,
    );
  });

  it('menolak lompat DIKONFIRMASI -> SELESAI tanpa lewat AKTIF', () => {
    expect(() => nextJobLifecycle(JobLifecycle.DIKONFIRMASI, JobLifecycle.SELESAI)).toThrow(
      ConflictException,
    );
  });

  it('menolak transisi dari status final SELESAI', () => {
    expect(() => nextJobLifecycle(JobLifecycle.SELESAI, JobLifecycle.AKTIF)).toThrow(
      ConflictException,
    );
  });

  it('menolak transisi dari DITOLAK', () => {
    expect(() => nextJobLifecycle(JobLifecycle.DITOLAK, JobLifecycle.DIKONFIRMASI)).toThrow(
      ConflictException,
    );
  });
});

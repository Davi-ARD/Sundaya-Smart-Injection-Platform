import { ConflictException } from '@nestjs/common';
import { MachineStatus as MS } from '@mold-tracker/shared';
import { machineWalk } from './machine-state';

describe('machineWalk (sumbu ketersediaan mesin)', () => {
  it('mengizinkan transisi satu langkah yang sah', () => {
    expect(machineWalk(MS.TERSEDIA, MS.DIAJUKAN)).toBe(MS.DIAJUKAN);
  });

  it('mengizinkan rangkaian transisi sah dari booking sampai kembali tersedia', () => {
    const akhir = machineWalk(
      MS.TERSEDIA,
      MS.DIAJUKAN,
      MS.DIKONFIRMASI,
      MS.DIKIRIM,
      MS.AKTIF,
      MS.SELESAI_SEWA,
      MS.DIKEMBALIKAN,
      MS.PENGECEKAN,
      MS.TERSEDIA,
    );
    expect(akhir).toBe(MS.TERSEDIA);
  });

  it('mengizinkan penolakan sewa: DIAJUKAN kembali ke TERSEDIA', () => {
    expect(machineWalk(MS.DIAJUKAN, MS.TERSEDIA)).toBe(MS.TERSEDIA);
  });

  it('mengizinkan cabang maintenance: PENGECEKAN ke MAINTENANCE lalu TERSEDIA', () => {
    expect(machineWalk(MS.PENGECEKAN, MS.MAINTENANCE, MS.TERSEDIA)).toBe(MS.TERSEDIA);
  });

  it('menolak transisi tidak sah (TERSEDIA langsung ke AKTIF)', () => {
    expect(() => machineWalk(MS.TERSEDIA, MS.AKTIF)).toThrow(ConflictException);
  });

  it('menolak lompat status (DIAJUKAN langsung ke DIKIRIM)', () => {
    expect(() => machineWalk(MS.DIAJUKAN, MS.DIKIRIM)).toThrow(ConflictException);
  });
});

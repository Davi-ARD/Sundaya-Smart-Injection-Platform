import { ConflictException } from '@nestjs/common';
import { MachineStatus as MS } from '@mold-tracker/shared';
import { machineWalk } from './machine-state';

describe('machineWalk (sumbu ketersediaan mesin)', () => {
  it('mengizinkan transisi satu langkah yang sah', () => {
    expect(machineWalk(MS.TERSEDIA, MS.DIKONFIRMASI)).toBe(MS.DIKONFIRMASI);
  });

  it('mengizinkan rangkaian transisi sah dari booking sampai kembali tersedia', () => {
    const akhir = machineWalk(
      MS.TERSEDIA,
      MS.DIKONFIRMASI,
      MS.AKTIF,
      MS.PENGECEKAN,
      MS.TERSEDIA,
    );
    expect(akhir).toBe(MS.TERSEDIA);
  });

  it('mengizinkan mesin ditarik dari booking yang belum berjalan (booking ditolak atau ditukar)', () => {
    expect(machineWalk(MS.DIKONFIRMASI, MS.TERSEDIA)).toBe(MS.TERSEDIA);
  });

  it('mengizinkan cabang maintenance: PENGECEKAN ke MAINTENANCE lalu TERSEDIA', () => {
    expect(machineWalk(MS.PENGECEKAN, MS.MAINTENANCE, MS.TERSEDIA)).toBe(MS.TERSEDIA);
  });

  it('menolak lompat status (TERSEDIA langsung ke AKTIF)', () => {
    expect(() => machineWalk(MS.TERSEDIA, MS.AKTIF)).toThrow(ConflictException);
  });

  it('menolak mesin AKTIF langsung TERSEDIA tanpa pengecekan', () => {
    expect(() => machineWalk(MS.AKTIF, MS.TERSEDIA)).toThrow(ConflictException);
  });
});

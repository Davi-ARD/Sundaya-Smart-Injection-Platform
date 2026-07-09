import { MachineStatus as MS } from '@mold-tracker/shared';
import { machineWalk } from './rental-state';

describe('machineWalk', () => {
  it('transisi valid: TERSEDIA -> DIAJUKAN', () => {
    expect(machineWalk(MS.TERSEDIA, MS.DIAJUKAN)).toBe(MS.DIAJUKAN);
  });

  it('transisi valid berantai: AKTIF -> SELESAI_SEWA -> DIKEMBALIKAN', () => {
    expect(machineWalk(MS.AKTIF, MS.SELESAI_SEWA, MS.DIKEMBALIKAN)).toBe(MS.DIKEMBALIKAN);
  });

  it('transisi tidak valid: TERSEDIA -> AKTIF ditolak', () => {
    expect(() => machineWalk(MS.TERSEDIA, MS.AKTIF)).toThrow();
  });

  it('transisi tidak valid: DIKIRIM -> TERSEDIA ditolak', () => {
    expect(() => machineWalk(MS.DIKIRIM, MS.TERSEDIA)).toThrow();
  });
});

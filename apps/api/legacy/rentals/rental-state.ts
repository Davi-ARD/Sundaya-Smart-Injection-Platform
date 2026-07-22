import { ConflictException } from '@nestjs/common';
import { MachineStatus as MS } from '@mold-tracker/shared';

// Peta transisi status mesin sepanjang siklus sewa. Sumber kebenaran tunggal:
// status mesin hanya berpindah lewat salah satu sisi yang terdaftar di sini.
// ponytail: cukup satu record konstan, bukan library state machine atau kelas per state.
export const MACHINE_FLOW: Record<MS, MS[]> = {
  [MS.TERSEDIA]: [MS.DIAJUKAN],
  [MS.DIAJUKAN]: [MS.DIKONFIRMASI, MS.TERSEDIA], // TERSEDIA saat sewa ditolak
  [MS.DIKONFIRMASI]: [MS.DIKIRIM],
  [MS.DIKIRIM]: [MS.AKTIF],
  [MS.AKTIF]: [MS.SELESAI_SEWA],
  [MS.SELESAI_SEWA]: [MS.DIKEMBALIKAN],
  [MS.DIKEMBALIKAN]: [MS.PENGECEKAN],
  [MS.PENGECEKAN]: [MS.TERSEDIA, MS.MAINTENANCE],
  [MS.MAINTENANCE]: [MS.TERSEDIA],
};

// Terapkan rangkaian transisi dan kembalikan status akhir. Tiap langkah divalidasi
// terhadap MACHINE_FLOW; satu langkah tak sah membatalkan seluruh jalur.
// Dipakai untuk endpoint yang melewati status transien (return, condition-check).
export function machineWalk(from: MS, ...path: MS[]): MS {
  let current = from;
  for (const next of path) {
    if (!MACHINE_FLOW[current].includes(next)) {
      throw new ConflictException(`Transisi mesin ${current} -> ${next} tidak sah`);
    }
    current = next;
  }
  return current;
}

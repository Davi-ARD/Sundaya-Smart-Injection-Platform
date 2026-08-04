import { ConflictException } from '@nestjs/common';
import { JobLifecycle as JL } from '@mold-tracker/shared';

// Peta transisi lifecycle job (booking). Sumber kebenaran tunggal: lifecycle job
// hanya berpindah lewat sisi yang terdaftar di sini. Sumbu ini terpisah dari
// sumbu ketersediaan mesin (MACHINE_FLOW di modul machines) yang berjalan lockstep.
// ponytail: cukup satu record konstan, bukan library state machine.
// DIKONFIRMASI ditekan Admin Sundaya lewat assign mesin pertama; DIAJUKAN ->
// DITOLAK lewat tombol tolak. Dua sisa lainnya otomatis dari event domain:
// DIKONFIRMASI -> AKTIF saat cetakan pertama diterima Sundaya (Log Penerimaan),
// AKTIF -> SELESAI saat seluruh cetakan booking sudah kembali ke penyewa.
export const JOB_LIFECYCLE_FLOW: Record<JL, JL[]> = {
  [JL.DIAJUKAN]: [JL.DIKONFIRMASI, JL.DITOLAK],
  [JL.DIKONFIRMASI]: [JL.AKTIF],
  [JL.AKTIF]: [JL.SELESAI],
  [JL.DITOLAK]: [],
  [JL.SELESAI]: [],
};

// Validasi satu transisi lifecycle; lempar 409 bila tidak sah.
export function nextJobLifecycle(from: JL, to: JL): JL {
  if (!JOB_LIFECYCLE_FLOW[from].includes(to)) {
    throw new ConflictException(`Transisi job ${from} -> ${to} tidak sah`);
  }
  return to;
}

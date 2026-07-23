import { ConflictException, ForbiddenException } from '@nestjs/common';
import { MoldTrackingStatus as MT, Role } from '@mold-tracker/shared';

// Peta transisi tracking fisik mold (10-state linear, cabang REPAIR). Sumber
// kebenaran tunggal: trackingStatus hanya berpindah lewat sisi terdaftar di sini.
// Sumbu ini independen dari lifecycle job dan status mesin.
// ponytail: satu record konstan, bukan library state machine.
export const MOLD_TRACKING_FLOW: Record<MT, MT[]> = {
  [MT.PLANNING]: [MT.READY_DELIVERY],
  [MT.READY_DELIVERY]: [MT.DELIVERY],
  [MT.DELIVERY]: [MT.RECEIVED],
  [MT.RECEIVED]: [MT.WAITING_PRODUCTION],
  [MT.WAITING_PRODUCTION]: [MT.ON_MACHINE],
  [MT.ON_MACHINE]: [MT.PRODUCTION],
  [MT.PRODUCTION]: [MT.REPAIR, MT.SEND_BACK],
  [MT.REPAIR]: [MT.ON_MACHINE],
  [MT.SEND_BACK]: [MT.COMPLETED],
  [MT.COMPLETED]: [],
};

// Transisi lantai produksi/setup yang boleh dijalankan TEKNISI_SUNDAYA. Transisi
// logistik (delivery, received, send back, completed) khusus ADMIN_SUNDAYA.
const TEKNISI_ALLOWED: ReadonlyArray<readonly [MT, MT]> = [
  [MT.WAITING_PRODUCTION, MT.ON_MACHINE],
  [MT.ON_MACHINE, MT.PRODUCTION],
  [MT.PRODUCTION, MT.REPAIR],
  [MT.REPAIR, MT.ON_MACHINE],
];

// Validasi transisi struktural (409 bila tidak sah menurut peta).
export function assertMoldTransition(from: MT, to: MT): void {
  if (!MOLD_TRACKING_FLOW[from].includes(to)) {
    throw new ConflictException(`Transisi mold ${from} -> ${to} tidak sah`);
  }
}

// Otorisasi per transisi: Admin Sundaya semua; Teknisi hanya subset setup/produksi.
export function assertRoleMayTransition(role: Role, from: MT, to: MT): void {
  if (role === Role.ADMIN_SUNDAYA) return;
  if (
    role === Role.TEKNISI_SUNDAYA &&
    TEKNISI_ALLOWED.some(([f, t]) => f === from && t === to)
  ) {
    return;
  }
  throw new ForbiddenException('Teknisi hanya boleh transisi setup/produksi mold');
}

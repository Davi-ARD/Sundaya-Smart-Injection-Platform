import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  MOLD_TEKNISI_ALLOWED,
  MOLD_TRACKING_FLOW,
  MoldTrackingStatus as MT,
  Role,
} from '@mold-tracker/shared';

// Peta transisi (MOLD_TRACKING_FLOW) dan subset Teknisi (MOLD_TEKNISI_ALLOWED)
// tinggal di packages/shared: satu sumber kebenaran dipakai api (guard) dan web
// (tombol transisi). Sumbu ini independen dari lifecycle job dan status mesin.

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
    MOLD_TEKNISI_ALLOWED.some(([f, t]) => f === from && t === to)
  ) {
    return;
  }
  throw new ForbiddenException('Teknisi hanya boleh transisi setup/produksi mold');
}

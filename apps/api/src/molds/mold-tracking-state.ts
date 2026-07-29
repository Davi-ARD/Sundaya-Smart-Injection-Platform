import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  MOLD_MANUAL_TRANSITIONS,
  MOLD_TRACKING_FLOW,
  MoldTrackingStatus as MT,
  Role,
} from '@mold-tracker/shared';

// Urutan linear 6-state. Indeks dipakai untuk membandingkan maju/mundur pada
// transisi otomatis (idempoten: event domain yang terulang tidak menurunkan status).
export const MOLD_ORDER: MT[] = [
  MT.PLANNING,
  MT.DELIVERY,
  MT.RECEIVED,
  MT.PRODUCTION,
  MT.SEND_BACK,
  MT.COMPLETED,
];

export const moldRank = (status: MT): number => MOLD_ORDER.indexOf(status);

// Validasi transisi manual: hanya satu langkah maju sesuai MOLD_TRACKING_FLOW.
export function assertMoldTransition(from: MT, to: MT): void {
  if (!MOLD_TRACKING_FLOW[from].includes(to)) {
    throw new ConflictException(`Transisi mold ${from} -> ${to} tidak sah`);
  }
}

// Empat status pertama hanya boleh berpindah lewat event domain (Log Pengiriman,
// Log Penerimaan, Log Produksi), bukan tombol. Tombol hanya untuk SEND_BACK dan
// COMPLETED, dan hanya Admin Sundaya yang berwenang.
export function assertManualTransition(role: Role, to: MT): void {
  if (!MOLD_MANUAL_TRANSITIONS.includes(to)) {
    throw new ConflictException(
      `Status ${to} disetel otomatis dari event domain, tidak lewat tombol`,
    );
  }
  if (role !== Role.ADMIN_SUNDAYA) {
    throw new ForbiddenException('Hanya Admin Sundaya boleh menutup siklus mold');
  }
}

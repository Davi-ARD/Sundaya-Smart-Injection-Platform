import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  MOLD_MANUAL_TRANSITIONS,
  MOLD_TRACKING_FLOW,
  MoldTrackingStatus as MT,
  Role,
} from '@mold-tracker/shared';

// Posisi status pada urutan linear, dibaca langsung dari MOLD_TRACKING_FLOW supaya
// tidak ada daftar kedua yang harus dijaga sinkron dengan peta transisi. Dipakai
// transisi otomatis untuk membandingkan maju/mundur (idempoten: event domain yang
// terulang tidak menurunkan status).
export const moldRank = (status: MT): number => Object.keys(MOLD_TRACKING_FLOW).indexOf(status);

// Validasi transisi manual: hanya satu langkah maju sesuai MOLD_TRACKING_FLOW.
export function assertMoldTransition(from: MT, to: MT): void {
  if (!MOLD_TRACKING_FLOW[from].includes(to)) {
    throw new ConflictException(`Transisi mold ${from} -> ${to} tidak sah`);
  }
}

// Empat status pertama hanya boleh berpindah lewat event domain (Log Pengiriman,
// Log Penerimaan, Log Produksi), bukan tombol. Dua status penutup punya tombol,
// tapi pemiliknya berbeda: Sundaya menyatakan cetakan sudah dikirim balik
// (SEND_BACK), penyewa yang menyatakan cetakan itu benar-benar sudah sampai
// kembali (COMPLETED). Approval pengembalian karena itu berlaku per cetakan.
export function assertManualTransition(role: Role, to: MT): void {
  const berwenang = MOLD_MANUAL_TRANSITIONS[to];
  if (!berwenang) {
    throw new ConflictException(
      `Status ${to} disetel otomatis dari event domain, tidak lewat tombol`,
    );
  }
  if (role !== berwenang) {
    const pesan =
      to === MT.SEND_BACK
        ? 'Hanya Admin Sundaya boleh menyatakan cetakan siap dikirim balik'
        : 'Hanya Manager Penyewa pemilik cetakan boleh mengonfirmasi cetakan sudah diterima kembali';
    throw new ForbiddenException(pesan);
  }
}

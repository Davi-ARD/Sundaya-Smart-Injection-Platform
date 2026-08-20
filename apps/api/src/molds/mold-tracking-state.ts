import { MOLD_TRACKING_FLOW, MoldTrackingStatus as MT } from '@mold-tracker/shared';

// Posisi status pada urutan linear, dibaca langsung dari MOLD_TRACKING_FLOW supaya
// tidak ada daftar kedua yang harus dijaga sinkron dengan peta transisi. Dipakai
// transisi otomatis untuk membandingkan maju/mundur (idempoten: event domain yang
// terulang tidak menurunkan status).
//
// Cetakan yang belum disetujui booking-nya belum punya status sama sekali (null)
// dan diberi peringkat -1: apa pun status pertamanya dianggap maju.
export const moldRank = (status: MT | null): number =>
  status === null ? -1 : Object.keys(MOLD_TRACKING_FLOW).indexOf(status);

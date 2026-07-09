import { WarrantyStatus } from '@mold-tracker/shared';

// Fungsi hitung biasa (bukan service): warrantyEnd = start + durasi bulan,
// status ditentukan relatif terhadap now.
// ponytail: setMonth bisa overflow hari (31 Jan + 1 bln), cukup untuk warranty bulanan.
export function computeWarranty(
  warrantyStart: Date,
  durationMonths: number,
  now: Date = new Date(),
): { warrantyEnd: Date; warrantyStatus: WarrantyStatus } {
  const warrantyEnd = new Date(warrantyStart);
  warrantyEnd.setMonth(warrantyEnd.getMonth() + durationMonths);
  return {
    warrantyEnd,
    warrantyStatus: warrantyEnd > now ? WarrantyStatus.AKTIF : WarrantyStatus.HABIS,
  };
}

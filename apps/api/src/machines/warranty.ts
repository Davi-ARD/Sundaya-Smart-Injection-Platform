import { BadRequestException } from '@nestjs/common';
import { WarrantyStatus } from '@mold-tracker/shared';

// Fungsi hitung biasa (bukan service): garansi diinput sebagai rentang tanggal
// (mulai dan berakhir), bukan durasi bulan. Status ditentukan relatif terhadap now.
export function computeWarranty(
  warrantyStart: Date,
  warrantyEnd: Date,
  now: Date = new Date(),
): { warrantyEnd: Date; warrantyStatus: WarrantyStatus } {
  if (warrantyEnd <= warrantyStart) {
    throw new BadRequestException('Tanggal akhir garansi harus setelah tanggal mulai');
  }
  return {
    warrantyEnd,
    warrantyStatus: warrantyEnd > now ? WarrantyStatus.AKTIF : WarrantyStatus.HABIS,
  };
}

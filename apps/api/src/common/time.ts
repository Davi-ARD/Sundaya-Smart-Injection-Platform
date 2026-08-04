import { BadRequestException } from '@nestjs/common';

// Toleransi jam klien yang sedikit maju dari server.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

// Event yang mencatat kejadian nyata (status mesin Layer 1, Log Produksi Layer 2,
// penerimaan barang) tidak boleh bertanggal masa depan: durasi antar-event dihitung
// dari occurredAt, jadi satu timestamp masa depan merusak seluruh hitungan OEE.
// Rencana pengiriman justru memang bertanggal depan, jadi tidak lewat sini.
//
// `label` adalah nama field seperti yang tertulis di form (mis. "Waktu diterima"),
// bukan nama field API: pesannya dibaca langsung oleh pengguna lewat toast.
export function assertNotFuture(value: string | Date, label: string, now: Date = new Date()): void {
  const at = value instanceof Date ? value : new Date(value);
  if (at.getTime() > now.getTime() + CLOCK_SKEW_MS) {
    throw new BadRequestException(
      `${label} tidak boleh melewati waktu sekarang. Log ini mencatat kejadian yang sudah terjadi, bukan rencana.`,
    );
  }
}

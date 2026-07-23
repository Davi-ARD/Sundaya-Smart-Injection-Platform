import { DeliveryStatus } from '@mold-tracker/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

// Hitung selisih (hari) + DeliveryStatus dari rencana vs aktual tiba. Fungsi murni
// (dipakai Log Pengiriman B4 dan on-time rate dashboard Manager B5).
// inTransit: mold sudah dikirim tapi belum diterima (status DELIVERY/READY_DELIVERY).
export function computeDelivery(
  rencana: Date | null,
  aktual: Date | null,
  now: Date = new Date(),
  inTransit = false,
): { selisihHari: number | null; status: DeliveryStatus } {
  if (aktual) {
    const selisihHari =
      rencana != null ? Math.round((aktual.getTime() - rencana.getTime()) / DAY_MS) : null;
    return {
      selisihHari,
      status:
        selisihHari != null && selisihHari > 0
          ? DeliveryStatus.TIBA_TERLAMBAT
          : DeliveryStatus.TIBA_ONTIME,
    };
  }
  if (inTransit) return { selisihHari: null, status: DeliveryStatus.DIKIRIM };
  if (rencana != null && now.getTime() > rencana.getTime()) {
    return { selisihHari: null, status: DeliveryStatus.BELUM_TIBA };
  }
  return { selisihHari: null, status: DeliveryStatus.DIRENCANAKAN };
}

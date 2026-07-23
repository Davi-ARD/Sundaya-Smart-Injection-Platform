import { DeliveryStatus } from '@mold-tracker/shared';
import { computeDelivery } from './delivery';

const d = (s: string) => new Date(s);

describe('computeDelivery', () => {
  it('aktual sebelum/sama rencana -> TIBA_ONTIME, selisih <= 0', () => {
    const r = computeDelivery(d('2026-08-10'), d('2026-08-08'));
    expect(r.status).toBe(DeliveryStatus.TIBA_ONTIME);
    expect(r.selisihHari).toBe(-2);
  });

  it('aktual setelah rencana -> TIBA_TERLAMBAT, selisih > 0', () => {
    const r = computeDelivery(d('2026-08-10'), d('2026-08-13'));
    expect(r.status).toBe(DeliveryStatus.TIBA_TERLAMBAT);
    expect(r.selisihHari).toBe(3);
  });

  it('belum tiba, rencana sudah lewat -> BELUM_TIBA', () => {
    const r = computeDelivery(d('2026-08-10'), null, d('2026-08-15'));
    expect(r.status).toBe(DeliveryStatus.BELUM_TIBA);
    expect(r.selisihHari).toBeNull();
  });

  it('belum tiba, rencana belum lewat -> DIRENCANAKAN', () => {
    const r = computeDelivery(d('2026-08-20'), null, d('2026-08-15'));
    expect(r.status).toBe(DeliveryStatus.DIRENCANAKAN);
  });

  it('belum tiba tapi sedang dikirim -> DIKIRIM (menang atas overdue)', () => {
    const r = computeDelivery(d('2026-08-10'), null, d('2026-08-15'), true);
    expect(r.status).toBe(DeliveryStatus.DIKIRIM);
  });
});

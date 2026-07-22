import { WarrantyStatus } from '@mold-tracker/shared';
import { computeWarranty } from './warranty';

describe('computeWarranty', () => {
  it('warrantyEnd = start + durasi bulan', () => {
    const { warrantyEnd } = computeWarranty(new Date('2025-01-01'), 24);
    expect(warrantyEnd.toISOString().slice(0, 10)).toBe('2027-01-01');
  });

  it('AKTIF bila end masih di masa depan', () => {
    const { warrantyStatus } = computeWarranty(new Date('2025-01-01'), 24, new Date('2026-01-01'));
    expect(warrantyStatus).toBe(WarrantyStatus.AKTIF);
  });

  it('HABIS bila end sudah lewat', () => {
    const { warrantyStatus } = computeWarranty(new Date('2020-01-01'), 12, new Date('2026-01-01'));
    expect(warrantyStatus).toBe(WarrantyStatus.HABIS);
  });
});

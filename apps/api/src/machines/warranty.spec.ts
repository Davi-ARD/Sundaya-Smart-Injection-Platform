import { BadRequestException } from '@nestjs/common';
import { WarrantyStatus } from '@mold-tracker/shared';
import { computeWarranty } from './warranty';

describe('computeWarranty', () => {
  it('warrantyEnd mengikuti tanggal akhir yang diinput', () => {
    const { warrantyEnd } = computeWarranty(new Date('2025-01-01'), new Date('2030-01-01'));
    expect(warrantyEnd.toISOString().slice(0, 10)).toBe('2030-01-01');
  });

  it('AKTIF bila end masih di masa depan', () => {
    const { warrantyStatus } = computeWarranty(
      new Date('2025-01-01'),
      new Date('2030-01-01'),
      new Date('2026-01-01'),
    );
    expect(warrantyStatus).toBe(WarrantyStatus.AKTIF);
  });

  it('HABIS bila end sudah lewat', () => {
    const { warrantyStatus } = computeWarranty(
      new Date('2020-01-01'),
      new Date('2021-01-01'),
      new Date('2026-01-01'),
    );
    expect(warrantyStatus).toBe(WarrantyStatus.HABIS);
  });

  it('menolak tanggal akhir yang tidak setelah tanggal mulai', () => {
    expect(() => computeWarranty(new Date('2025-01-01'), new Date('2024-01-01'))).toThrow(
      BadRequestException,
    );
  });
});

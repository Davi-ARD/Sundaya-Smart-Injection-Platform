import { ConflictException, ForbiddenException } from '@nestjs/common';
import { MoldTrackingStatus as MT, Role } from '@mold-tracker/shared';
import { assertManualTransition, assertMoldTransition, moldRank } from './mold-tracking-state';

describe('assertMoldTransition', () => {
  it('mengizinkan langkah linear berurutan', () => {
    expect(() => assertMoldTransition(MT.PLANNING, MT.DELIVERY)).not.toThrow();
    expect(() => assertMoldTransition(MT.DELIVERY, MT.RECEIVED)).not.toThrow();
    expect(() => assertMoldTransition(MT.RECEIVED, MT.PRODUCTION)).not.toThrow();
    expect(() => assertMoldTransition(MT.PRODUCTION, MT.SEND_BACK)).not.toThrow();
    expect(() => assertMoldTransition(MT.SEND_BACK, MT.COMPLETED)).not.toThrow();
  });

  it('menolak lompat PLANNING -> COMPLETED', () => {
    expect(() => assertMoldTransition(MT.PLANNING, MT.COMPLETED)).toThrow(ConflictException);
  });

  it('menolak langkah mundur', () => {
    expect(() => assertMoldTransition(MT.PRODUCTION, MT.RECEIVED)).toThrow(ConflictException);
  });

  it('menolak transisi dari status final COMPLETED', () => {
    expect(() => assertMoldTransition(MT.COMPLETED, MT.SEND_BACK)).toThrow(ConflictException);
  });
});

describe('assertManualTransition', () => {
  it('Admin Sundaya boleh menutup siklus (SEND_BACK, COMPLETED)', () => {
    expect(() => assertManualTransition(Role.ADMIN_SUNDAYA, MT.SEND_BACK)).not.toThrow();
    expect(() => assertManualTransition(Role.ADMIN_SUNDAYA, MT.COMPLETED)).not.toThrow();
  });

  it('menolak status yang seharusnya otomatis dari event domain', () => {
    for (const status of [MT.DELIVERY, MT.RECEIVED, MT.PRODUCTION]) {
      expect(() => assertManualTransition(Role.ADMIN_SUNDAYA, status)).toThrow(ConflictException);
    }
  });

  it('Teknisi tidak boleh menutup siklus mold', () => {
    expect(() => assertManualTransition(Role.TEKNISI_SUNDAYA, MT.SEND_BACK)).toThrow(
      ForbiddenException,
    );
  });

  it('Manager Penyewa tidak boleh menutup siklus mold', () => {
    expect(() => assertManualTransition(Role.MANAGER_PENYEWA, MT.COMPLETED)).toThrow(
      ForbiddenException,
    );
  });
});

describe('moldRank', () => {
  it('naik monoton mengikuti urutan siklus', () => {
    const urutan = [
      MT.PLANNING,
      MT.DELIVERY,
      MT.RECEIVED,
      MT.PRODUCTION,
      MT.SEND_BACK,
      MT.COMPLETED,
    ];
    const ranks = urutan.map(moldRank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(urutan.length);
  });
});

import { ConflictException, ForbiddenException } from '@nestjs/common';
import { MoldTrackingStatus as MT, Role } from '@mold-tracker/shared';
import { assertMoldTransition, assertRoleMayTransition } from './mold-tracking-state';

describe('assertMoldTransition', () => {
  it('mengizinkan langkah linear PLANNING -> READY_DELIVERY', () => {
    expect(() => assertMoldTransition(MT.PLANNING, MT.READY_DELIVERY)).not.toThrow();
  });

  it('mengizinkan cabang PRODUCTION -> REPAIR dan REPAIR -> ON_MACHINE', () => {
    expect(() => assertMoldTransition(MT.PRODUCTION, MT.REPAIR)).not.toThrow();
    expect(() => assertMoldTransition(MT.REPAIR, MT.ON_MACHINE)).not.toThrow();
  });

  it('mengizinkan PRODUCTION -> SEND_BACK', () => {
    expect(() => assertMoldTransition(MT.PRODUCTION, MT.SEND_BACK)).not.toThrow();
  });

  it('menolak lompat PLANNING -> COMPLETED', () => {
    expect(() => assertMoldTransition(MT.PLANNING, MT.COMPLETED)).toThrow(ConflictException);
  });

  it('menolak transisi dari status final COMPLETED', () => {
    expect(() => assertMoldTransition(MT.COMPLETED, MT.SEND_BACK)).toThrow(ConflictException);
  });
});

describe('assertRoleMayTransition', () => {
  it('Admin Sundaya boleh transisi logistik', () => {
    expect(() => assertRoleMayTransition(Role.ADMIN_SUNDAYA, MT.DELIVERY, MT.RECEIVED)).not.toThrow();
  });

  it('Teknisi boleh transisi setup WAITING_PRODUCTION -> ON_MACHINE', () => {
    expect(() =>
      assertRoleMayTransition(Role.TEKNISI_SUNDAYA, MT.WAITING_PRODUCTION, MT.ON_MACHINE),
    ).not.toThrow();
  });

  it('Teknisi boleh PRODUCTION -> REPAIR dan REPAIR -> ON_MACHINE', () => {
    expect(() => assertRoleMayTransition(Role.TEKNISI_SUNDAYA, MT.PRODUCTION, MT.REPAIR)).not.toThrow();
    expect(() => assertRoleMayTransition(Role.TEKNISI_SUNDAYA, MT.REPAIR, MT.ON_MACHINE)).not.toThrow();
  });

  it('Teknisi ditolak pada transisi logistik DELIVERY -> RECEIVED', () => {
    expect(() =>
      assertRoleMayTransition(Role.TEKNISI_SUNDAYA, MT.DELIVERY, MT.RECEIVED),
    ).toThrow(ForbiddenException);
  });

  it('Teknisi ditolak pada SEND_BACK -> COMPLETED', () => {
    expect(() =>
      assertRoleMayTransition(Role.TEKNISI_SUNDAYA, MT.SEND_BACK, MT.COMPLETED),
    ).toThrow(ForbiddenException);
  });
});

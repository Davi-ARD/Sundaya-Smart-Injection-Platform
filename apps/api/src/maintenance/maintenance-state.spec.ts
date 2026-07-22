import { ConflictException } from '@nestjs/common';
import { MaintenanceStatus } from '@mold-tracker/shared';
import { nextMaintenanceStatus } from './maintenance-state';

describe('nextMaintenanceStatus', () => {
  it('mengizinkan TERJADWAL -> BERLANGSUNG', () => {
    expect(nextMaintenanceStatus(MaintenanceStatus.TERJADWAL, MaintenanceStatus.BERLANGSUNG)).toBe(
      MaintenanceStatus.BERLANGSUNG,
    );
  });

  it('mengizinkan BERLANGSUNG -> SELESAI', () => {
    expect(nextMaintenanceStatus(MaintenanceStatus.BERLANGSUNG, MaintenanceStatus.SELESAI)).toBe(
      MaintenanceStatus.SELESAI,
    );
  });

  it('menolak lompat TERJADWAL -> SELESAI', () => {
    expect(() =>
      nextMaintenanceStatus(MaintenanceStatus.TERJADWAL, MaintenanceStatus.SELESAI),
    ).toThrow(ConflictException);
  });

  it('menolak mundur BERLANGSUNG -> TERJADWAL', () => {
    expect(() =>
      nextMaintenanceStatus(MaintenanceStatus.BERLANGSUNG, MaintenanceStatus.TERJADWAL),
    ).toThrow(ConflictException);
  });

  it('menolak transisi dari status final SELESAI', () => {
    expect(() =>
      nextMaintenanceStatus(MaintenanceStatus.SELESAI, MaintenanceStatus.BERLANGSUNG),
    ).toThrow(ConflictException);
  });
});

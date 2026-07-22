import { ConflictException } from '@nestjs/common';
import { MaintenanceStatus as MStat } from '@mold-tracker/shared';

// Peta transisi status maintenance (linear satu arah). Sumber kebenaran tunggal:
// status hanya berpindah lewat sisi yang terdaftar di sini.
// ponytail: cukup satu record konstan, bukan library state machine.
export const MAINTENANCE_STATUS_FLOW: Record<MStat, MStat[]> = {
  [MStat.TERJADWAL]: [MStat.BERLANGSUNG],
  [MStat.BERLANGSUNG]: [MStat.SELESAI],
  [MStat.SELESAI]: [],
};

// Validasi satu transisi; lempar 409 bila tidak sah.
export function nextMaintenanceStatus(from: MStat, to: MStat): MStat {
  if (!MAINTENANCE_STATUS_FLOW[from].includes(to)) {
    throw new ConflictException(`Transisi maintenance ${from} -> ${to} tidak sah`);
  }
  return to;
}

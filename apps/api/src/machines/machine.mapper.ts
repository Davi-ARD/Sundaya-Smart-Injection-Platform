import { Machine } from '@mold-tracker/shared';
import { Machine as PrismaMachine } from '@prisma/client';

// Batas record Prisma -> bentuk API bersama: tanggal jadi ISO string, enum di-cast.
// ponytail: enum shared dan Prisma nominal berbeda meski nilainya sama, cast di sini saja.
// Machine punya dua sumbu status terpisah: status (ketersediaan) dan
// operationalStatus (realtime Layer 1).
export function toMachine(m: PrismaMachine): Machine {
  return {
    id: m.id,
    machineNumber: m.machineNumber,
    spesifikasi: m.spesifikasi,
    tonaseTon: m.tonaseTon,
    status: m.status as unknown as Machine['status'],
    operationalStatus: m.operationalStatus as unknown as Machine['operationalStatus'],
    statusBeforeMaintenance:
      m.statusBeforeMaintenance as unknown as Machine['statusBeforeMaintenance'],
    ownerId: m.ownerId,
    warrantyStart: m.warrantyStart.toISOString(),
    warrantyDurationMonths: m.warrantyDurationMonths,
    warrantyEnd: m.warrantyEnd.toISOString(),
    warrantyStatus: m.warrantyStatus as unknown as Machine['warrantyStatus'],
    isArchived: m.isArchived,
    createdAt: m.createdAt.toISOString(),
  };
}

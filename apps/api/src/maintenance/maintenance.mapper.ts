import { Maintenance } from '@mold-tracker/shared';
import { Maintenance as PrismaMaintenance } from '@prisma/client';

// Batas record Prisma -> bentuk API bersama: tanggal jadi ISO string, enum di-cast.
// ponytail: enum shared dan Prisma nominal berbeda meski nilainya sama, cast di sini saja.
export function toMaintenance(m: PrismaMaintenance): Maintenance {
  return {
    id: m.id,
    machineId: m.machineId,
    type: m.type as unknown as Maintenance['type'],
    status: m.status as unknown as Maintenance['status'],
    scheduledAt: m.scheduledAt.toISOString(),
    startedAt: m.startedAt?.toISOString() ?? null,
    completedAt: m.completedAt?.toISOString() ?? null,
    notes: m.notes,
    byId: m.byId,
    createdAt: m.createdAt.toISOString(),
  };
}

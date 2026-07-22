import { OperationalData } from '@mold-tracker/shared';
import { OperationalData as PrismaOperationalData } from '@prisma/client';

// Batas record Prisma -> bentuk API bersama: tanggal jadi ISO string, enum di-cast.
// ponytail: enum shared dan Prisma nominal berbeda meski nilainya sama, cast di sini saja.
export function toOperationalData(o: PrismaOperationalData): OperationalData {
  return {
    id: o.id,
    machineId: o.machineId,
    status: o.status as unknown as OperationalData['status'],
    downtimeReason: o.downtimeReason as unknown as OperationalData['downtimeReason'],
    cycleTimeSec: o.cycleTimeSec,
    occurredAt: o.occurredAt.toISOString(),
    byId: o.byId,
    catatan: o.catatan,
    createdAt: o.createdAt.toISOString(),
  };
}

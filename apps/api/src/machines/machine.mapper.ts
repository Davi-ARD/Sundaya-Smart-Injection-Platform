import { Machine } from '@mold-tracker/shared';
import { Machine as PrismaMachine } from '@prisma/client';

// toRental/toConditionCheck pindah ke modul Sewa (B3); re-export supaya modul
// Mesin (history) tetap satu sumber tanpa duplikasi.
export { toRental, toConditionCheck } from '../rentals/rental.mapper';

// Batas record Prisma -> bentuk API bersama: tanggal jadi ISO string, enum di-cast.
// ponytail: enum shared dan Prisma nominal berbeda meski nilainya sama, cast di sini saja.
export function toMachine(m: PrismaMachine, ownerNama?: string): Machine {
  return {
    id: m.id,
    machineNumber: m.machineNumber,
    spesifikasi: m.spesifikasi,
    standardRatio: m.standardRatio,
    status: m.status as unknown as Machine['status'],
    ownerId: m.ownerId,
    ownerNama,
    warrantyStart: m.warrantyStart.toISOString(),
    warrantyDurationMonths: m.warrantyDurationMonths,
    warrantyEnd: m.warrantyEnd.toISOString(),
    warrantyStatus: m.warrantyStatus as unknown as Machine['warrantyStatus'],
    createdAt: m.createdAt.toISOString(),
  };
}

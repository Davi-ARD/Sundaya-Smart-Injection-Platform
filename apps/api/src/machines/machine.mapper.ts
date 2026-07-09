import { ConditionCheck, Machine, Rental } from '@mold-tracker/shared';
import {
  ConditionCheck as PrismaConditionCheck,
  Machine as PrismaMachine,
  Rental as PrismaRental,
} from '@prisma/client';

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

// ponytail: toRental/toConditionCheck ada di sini karena history (B2) konsumen pertama.
// Modul Sewa (B3) boleh memindahkannya ke rentals/ saat dibangun.
export function toRental(r: PrismaRental): Rental {
  return {
    id: r.id,
    machineId: r.machineId,
    penyewaId: r.penyewaId,
    penyediaId: r.penyediaId,
    status: r.status as unknown as Rental['status'],
    requestedDurationDays: r.requestedDurationDays,
    destinationLocation: r.destinationLocation,
    startDate: r.startDate?.toISOString() ?? null,
    endDate: r.endDate?.toISOString() ?? null,
    confirmedAt: r.confirmedAt?.toISOString() ?? null,
    shippedAt: r.shippedAt?.toISOString() ?? null,
    receivedAt: r.receivedAt?.toISOString() ?? null,
    returnedAt: r.returnedAt?.toISOString() ?? null,
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt.toISOString(),
  };
}

export function toConditionCheck(c: PrismaConditionCheck): ConditionCheck {
  return {
    id: c.id,
    machineId: c.machineId,
    rentalId: c.rentalId,
    checkedById: c.checkedById,
    result: c.result as unknown as ConditionCheck['result'],
    notes: c.notes,
    checkedAt: c.checkedAt.toISOString(),
  };
}

import { ConditionCheck, Rental, RentalExtension } from '@mold-tracker/shared';
import {
  ConditionCheck as PrismaConditionCheck,
  Rental as PrismaRental,
  RentalExtension as PrismaRentalExtension,
} from '@prisma/client';

// Batas record Prisma -> bentuk API bersama: tanggal jadi ISO string, enum di-cast.
// ponytail: enum shared dan Prisma nominal berbeda meski nilainya sama, cast di sini saja.
export function toRental(r: PrismaRental, machineNumber?: string): Rental {
  return {
    id: r.id,
    machineId: r.machineId,
    machineNumber,
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

export function toRentalExtension(e: PrismaRentalExtension): RentalExtension {
  return {
    id: e.id,
    rentalId: e.rentalId,
    additionalDays: e.additionalDays,
    status: e.status as unknown as RentalExtension['status'],
    requestedAt: e.requestedAt.toISOString(),
    decidedAt: e.decidedAt?.toISOString() ?? null,
  };
}

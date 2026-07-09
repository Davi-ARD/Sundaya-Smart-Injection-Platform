import { ProductionBatch } from '@mold-tracker/shared';
import { ProductionBatch as PrismaProductionBatch } from '@prisma/client';

// ponytail: enum shared dan Prisma nominal berbeda meski nilainya sama, cast di sini saja.
export function toBatch(b: PrismaProductionBatch): ProductionBatch {
  return {
    id: b.id,
    rentalId: b.rentalId,
    machineId: b.machineId,
    operatorId: b.operatorId,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    materialInputKg: b.materialInputKg,
    targetOutput: b.targetOutput,
    actualOutput: b.actualOutput,
    rejectCount: b.rejectCount,
    causeCategory: b.causeCategory as unknown as ProductionBatch['causeCategory'],
    efficiency: b.efficiency,
    flaggedMachineIssue: b.flaggedMachineIssue,
    reviewStatus: b.reviewStatus as unknown as ProductionBatch['reviewStatus'],
    createdAt: b.createdAt.toISOString(),
  };
}

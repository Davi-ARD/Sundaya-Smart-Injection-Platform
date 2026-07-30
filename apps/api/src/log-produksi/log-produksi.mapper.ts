import { LogProduksi } from '@mold-tracker/shared';
import { LogProduksi as PrismaLogProduksi } from '@prisma/client';

// Batas record Prisma -> bentuk API bersama: tanggal jadi ISO string, enum di-cast.
// ponytail: satu titik konversi enum shared <-> prisma.
export function toLogProduksi(l: PrismaLogProduksi): LogProduksi {
  return {
    id: l.id,
    jobId: l.jobId,
    moldId: l.moldId,
    eventType: l.eventType as unknown as LogProduksi['eventType'],
    occurredAt: l.occurredAt.toISOString(),
    byId: l.byId,
    catatan: l.catatan,
    materialName: l.materialName,
    jumlahKg: l.jumlahKg,
    noSuratJalan: l.noSuratJalan,
    goodProduct: l.goodProduct,
    rejectCount: l.rejectCount,
    materialUsedKg: l.materialUsedKg,
    progressMolding: l.progressMolding as unknown as LogProduksi['progressMolding'],
    keteranganProgress: l.keteranganProgress,
    createdAt: l.createdAt.toISOString(),
  };
}

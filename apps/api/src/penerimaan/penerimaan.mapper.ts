import { LogPenerimaan as PrismaLogPenerimaan } from '@prisma/client';
import { ItemPengiriman, LogPenerimaan } from '@mold-tracker/shared';

export function toLogPenerimaan(row: PrismaLogPenerimaan, jobNumber?: string): LogPenerimaan {
  return {
    id: row.id,
    jobId: row.jobId,
    jobNumber,
    item: row.item as unknown as ItemPengiriman,
    diterimaAt: row.diterimaAt.toISOString(),
    materialName: row.materialName,
    jumlahKg: row.jumlahKg,
    noSuratJalan: row.noSuratJalan,
    kondisi: row.kondisi,
    catatan: row.catatan,
    byId: row.byId,
    createdAt: row.createdAt.toISOString(),
  };
}

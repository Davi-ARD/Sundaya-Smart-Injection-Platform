import { LogPengiriman as PrismaLogPengiriman } from '@prisma/client';
import { ItemPengiriman, LogPengiriman } from '@mold-tracker/shared';

export function toLogPengiriman(
  row: PrismaLogPengiriman,
  jobNumber?: string,
): LogPengiriman {
  return {
    id: row.id,
    jobId: row.jobId,
    jobNumber,
    item: row.item as unknown as ItemPengiriman,
    rencanaKirim: row.rencanaKirim.toISOString(),
    materialName: row.materialName,
    jumlahKg: row.jumlahKg,
    noSuratJalan: row.noSuratJalan,
    catatan: row.catatan,
    byId: row.byId,
    createdAt: row.createdAt.toISOString(),
  };
}

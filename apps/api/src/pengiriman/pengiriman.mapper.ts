import { LogPengiriman as PrismaLogPengiriman } from '@prisma/client';
import {
  ItemPengiriman,
  LogPengiriman,
  MaterialType,
} from '@mold-tracker/shared';

export function toLogPengiriman(
  row: PrismaLogPengiriman,
  jobNumber?: string,
  kodeMold?: string,
): LogPengiriman {
  return {
    id: row.id,
    jobId: row.jobId,
    jobNumber,
    moldId: row.moldId,
    kodeMold,
    item: row.item as unknown as ItemPengiriman,
    rencanaKirim: row.rencanaKirim.toISOString(),
    materialName: row.materialName as unknown as MaterialType | null,
    jumlahKg: row.jumlahKg,
    noSuratJalan: row.noSuratJalan,
    catatan: row.catatan,
    byId: row.byId,
    createdAt: row.createdAt.toISOString(),
  };
}

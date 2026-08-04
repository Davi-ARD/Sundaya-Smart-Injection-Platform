import { Mold } from '@mold-tracker/shared';
import { Mold as PrismaMold } from '@prisma/client';

// Batas record Prisma <-> bentuk API bersama: tanggal jadi ISO string, enum
// shared dan Prisma tipe nominal berbeda meski nilainya sama, di-cast di sini.
// ponytail: satu titik konversi, jangan sebar cast.
export function toMold(m: PrismaMold): Mold {
  return {
    id: m.id,
    kodeMold: m.kodeMold,
    namaProduk: m.namaProduk,
    cavity: m.cavity,
    tonaseTon: m.tonaseTon,
    deskripsi: m.deskripsi,
    managerId: m.managerId,
    jobId: m.jobId,
    trackingStatus: m.trackingStatus as unknown as Mold['trackingStatus'],
    planMaterialUtama: m.planMaterialUtama,
    estimasiKg: m.estimasiKg,
    targetOutput: m.targetOutput,
    createdAt: m.createdAt.toISOString(),
  };
}

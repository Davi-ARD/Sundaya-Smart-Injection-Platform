import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ItemPengiriman } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';

// Aturan referensi yang dipakai bersama tiga log berbasis booking: Log Produksi
// (Admin Penyewa), Log Pengiriman (Manager), dan Log Penerimaan (Admin Sundaya).
// Satu booking memuat beberapa cetakan dan beberapa mesin, jadi tiap baris log harus
// menunjuk cetakan (dan untuk produksi juga mesin) yang benar-benar ada di booking itu.

// Baris MOLD tidak memakai field material, baris MATERIAL wajib nama dan jumlah
// supaya barisnya tidak setengah terisi.
export function assertMaterialFields(
  item: ItemPengiriman,
  materialName?: string,
  jumlahKg?: number,
): void {
  if (item !== ItemPengiriman.MATERIAL) return;
  if (!materialName || jumlahKg == null) {
    throw new BadRequestException('materialName dan jumlahKg wajib untuk item MATERIAL');
  }
}

// Item MOLD harus menyebut cetakan mana, karena transisi tracking hanya boleh
// menyentuh cetakan yang dimaksud.
export function assertMoldRef(item: ItemPengiriman, moldId?: string): void {
  if (item === ItemPengiriman.MOLD && !moldId) {
    throw new BadRequestException('moldId wajib untuk item MOLD');
  }
}

export type MoldInJob = {
  id: string;
  kodeMold: string;
  namaProduk: string;
  tonaseTon: number;
  targetOutput: number | null;
  estimasiKg: number | null;
};

// Cetakan harus benar-benar ada di booking yang disebut; kalau bukan, 404 supaya
// cetakan booking lain tidak bisa disentuh dari log mana pun.
export async function moldInJob(
  prisma: PrismaService,
  jobId: string,
  moldId: string,
): Promise<MoldInJob> {
  const mold = await prisma.mold.findFirst({
    where: { id: moldId, jobId },
    select: {
      id: true,
      kodeMold: true,
      namaProduk: true,
      tonaseTon: true,
      targetOutput: true,
      estimasiKg: true,
    },
  });
  if (!mold) throw new NotFoundException('Cetakan tidak ada di booking ini');
  return mold;
}

// Mesin harus salah satu mesin yang dipinjamkan ke booking ini, dan clamping force-nya
// harus sanggup menahan cetakan yang dicatat. Penyewa bebas memasangkan cetakan ke
// mesin mana pun, jadi kecocokan tonase baru bisa diperiksa di sini, bukan saat assign.
export async function machineForMold(
  prisma: PrismaService,
  jobId: string,
  machineId: string,
  mold: { kodeMold: string; tonaseTon: number },
): Promise<{ id: string; machineNumber: string }> {
  const machine = await prisma.machine.findFirst({
    where: { id: machineId, jobs: { some: { id: jobId } } },
    select: { id: true, machineNumber: true, tonaseTon: true },
  });
  if (!machine) throw new NotFoundException('Mesin tidak ada di booking ini');
  if (machine.tonaseTon < mold.tonaseTon) {
    throw new BadRequestException(
      `Mesin ${machine.machineNumber} (${machine.tonaseTon} ton) tidak sanggup menjalankan cetakan ${mold.kodeMold} (${mold.tonaseTon} ton)`,
    );
  }
  return { id: machine.id, machineNumber: machine.machineNumber };
}

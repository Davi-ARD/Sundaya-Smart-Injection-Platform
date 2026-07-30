import { BadRequestException } from '@nestjs/common';
import { ItemPengiriman } from '@mold-tracker/shared';

// Log Pengiriman (Manager) dan Log Penerimaan (Admin Sundaya) memakai satu tabel
// dengan kolom item: baris MOLD tidak memakai field material, baris MATERIAL wajib
// nama dan jumlah supaya barisnya tidak setengah terisi. Aturannya sama di kedua
// modul, jadi tinggal di sini.
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

// Item MOLD harus menyebut cetakan mana, karena satu booking bisa memuat beberapa
// cetakan dan transisi tracking hanya boleh menyentuh cetakan yang dimaksud.
export function assertMoldRef(item: ItemPengiriman, moldId?: string): void {
  if (item === ItemPengiriman.MOLD && !moldId) {
    throw new BadRequestException('moldId wajib untuk item MOLD');
  }
}

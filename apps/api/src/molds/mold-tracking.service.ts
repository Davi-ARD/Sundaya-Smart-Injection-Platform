import { Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, Prisma } from '@prisma/client';
import { MoldTrackingStatus } from '@mold-tracker/shared';
import { moldRank } from './mold-tracking-state';

// ponytail: enum shared dan Prisma nominal berbeda, cast di batang DB saja.
const asTracking = (s: MoldTrackingStatus) => s as unknown as $Enums.MoldTrackingStatus;

// Seluruh status cetakan bergerak otomatis dari event domain; tidak ada lagi
// tombol transisi manual. Karena itu service ini hanya menyediakan advance()
// yang dipanggil service lain dari dalam transaksi mereka.
@Injectable()
export class MoldTrackingService {
  // Log Pengiriman mold -> DELIVERY, Log Aktivitas mold -> RECEIVED, produksi
  // harian -> PRODUCTION, progress SUDAH_DIPRODUKSI -> COMPLETED.
  //
  // Idempoten dan hanya maju: event domain yang terulang (mis. Manager mencatat
  // pengiriman dua kali) tidak menurunkan status dan tidak menulis event ganda.
  // Lompatan maju diizinkan karena fisiknya mungkin terjadi (Sundaya menerima mold
  // tanpa Manager mencatat pengiriman lebih dulu); status menyusul ke kenyataan.
  async advance(
    tx: Prisma.TransactionClient,
    moldId: string,
    target: MoldTrackingStatus,
    byId: string,
  ): Promise<void> {
    const mold = await tx.mold.findUnique({
      where: { id: moldId },
      select: { trackingStatus: true },
    });
    if (!mold) throw new NotFoundException('Cetakan tidak ditemukan');

    const current = mold.trackingStatus as unknown as MoldTrackingStatus | null;
    if (moldRank(current) >= moldRank(target)) return;

    await tx.mold.update({ where: { id: moldId }, data: { trackingStatus: asTracking(target) } });
    await tx.moldTrackingEvent.create({ data: { moldId, status: asTracking(target), byId } });
  }

  // Satu-satunya langkah mundur yang diizinkan: cetakan yang sudah COMPLETED
  // dipakai lagi untuk mencetak produk yang sama. Dipicu saat Manager menaikkan
  // target output, jadi cetakan kembali ke PRODUCTION tanpa perlu dikirim ulang
  // (fisiknya masih di Sundaya). Selain dari COMPLETED, panggilan ini diabaikan
  // supaya tidak ada jalan mundur lain yang ikut terbuka.
  async reopen(tx: Prisma.TransactionClient, moldId: string, byId: string): Promise<void> {
    const mold = await tx.mold.findUnique({
      where: { id: moldId },
      select: { trackingStatus: true },
    });
    if (!mold) throw new NotFoundException('Cetakan tidak ditemukan');
    if ((mold.trackingStatus as unknown as MoldTrackingStatus | null) !== MoldTrackingStatus.COMPLETED) {
      return;
    }

    const target = asTracking(MoldTrackingStatus.PRODUCTION);
    await tx.mold.update({ where: { id: moldId }, data: { trackingStatus: target } });
    await tx.moldTrackingEvent.create({ data: { moldId, status: target, byId } });
  }
}

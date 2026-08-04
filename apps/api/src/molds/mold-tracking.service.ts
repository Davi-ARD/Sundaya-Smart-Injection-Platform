import { Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, Prisma, User as PrismaUser } from '@prisma/client';
import { Mold, MoldTrackingStatus, Role } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { completeJobIfAllMoldsReturned } from '../jobs/job-transitions';
import { toMold } from './mold.mapper';
import { assertManualTransition, assertMoldTransition, moldRank } from './mold-tracking-state';
import { UpdateMoldTrackingDto } from './mold-tracking.dto';

// ponytail: enum shared dan Prisma nominal berbeda, cast di batang DB saja.
const asTracking = (s: MoldTrackingStatus) => s as unknown as $Enums.MoldTrackingStatus;

@Injectable()
export class MoldTrackingService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // Dua transisi penutup siklus, masing-masing punya pemilik tombol sendiri:
  // PRODUCTION -> SEND_BACK ditekan Admin Sundaya (produksi selesai, cetakan
  // dikirim balik), SEND_BACK -> COMPLETED ditekan Manager Penyewa pemilik
  // cetakan sebagai approval bahwa cetakan sudah sampai kembali. Status
  // sebelumnya digerakkan otomatis lewat advance() dari event domain, jadi
  // endpoint ini menolak status yang seharusnya otomatis.
  //
  // Cetakan terakhir sebuah booking yang dikonfirmasi kembali sekaligus menutup
  // booking itu (job SELESAI, mesinnya masuk pengecekan) dalam transaksi yang sama.
  async transition(user: PrismaUser, moldId: string, dto: UpdateMoldTrackingDto): Promise<Mold> {
    const mold = await this.prisma.mold.findUnique({ where: { id: moldId } });
    if (!mold) throw new NotFoundException('Cetakan tidak ditemukan');

    const from = mold.trackingStatus as unknown as MoldTrackingStatus;
    assertManualTransition(user.role as Role, dto.status);
    // Cetakan tenant lain sama dengan tidak ada: jangan bocorkan keberadaannya.
    if (user.role === Role.MANAGER_PENYEWA && mold.managerId !== user.id) {
      throw new NotFoundException('Cetakan tidak ditemukan');
    }
    assertMoldTransition(from, dto.status);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.mold.update({
        where: { id: moldId },
        data: { trackingStatus: asTracking(dto.status) },
      });
      await tx.moldTrackingEvent.create({
        data: { moldId, status: asTracking(dto.status), byId: user.id },
      });
      if (dto.status === MoldTrackingStatus.COMPLETED && row.jobId) {
        await completeJobIfAllMoldsReturned(tx, row.jobId);
      }
      return row;
    });

    // Hanya arah Sundaya ke penyewa yang diberi notifikasi: cuma di sisi itu ada
    // tindakan yang harus menyusul (konfirmasi terima). Arah sebaliknya sudah
    // terbaca sendiri di papan tracking dan menutup booking tanpa campur tangan.
    if (dto.status === MoldTrackingStatus.SEND_BACK) {
      await this.notifications.create(
        updated.managerId,
        'Cetakan dikirim balik',
        `Produksi cetakan ${updated.kodeMold} sudah selesai dan cetakan dikirim kembali. Konfirmasi di tab Cetakan begitu barang sampai.`,
        '/molds',
      );
    }
    return toMold(updated);
  }

  // Transisi otomatis yang dipanggil service domain lain di dalam transaksi mereka:
  // Log Pengiriman mold -> DELIVERY, Log Penerimaan mold -> RECEIVED, produksi
  // harian pertama -> PRODUCTION.
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

    const current = mold.trackingStatus as unknown as MoldTrackingStatus;
    if (moldRank(current) >= moldRank(target)) return;

    await tx.mold.update({ where: { id: moldId }, data: { trackingStatus: asTracking(target) } });
    await tx.moldTrackingEvent.create({ data: { moldId, status: asTracking(target), byId } });
  }
}

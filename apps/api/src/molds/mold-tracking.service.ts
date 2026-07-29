import { Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, Prisma, User as PrismaUser } from '@prisma/client';
import { Mold, MoldTrackingStatus, Role } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toMold } from './mold.mapper';
import { assertManualTransition, assertMoldTransition, moldRank } from './mold-tracking-state';
import { UpdateMoldTrackingDto } from './mold-tracking.dto';

// ponytail: enum shared dan Prisma nominal berbeda, cast di batang DB saja.
const asTracking = (s: MoldTrackingStatus) => s as unknown as $Enums.MoldTrackingStatus;

@Injectable()
export class MoldTrackingService {
  constructor(private prisma: PrismaService) {}

  // Transisi manual penutup siklus (ADMIN_SUNDAYA): PRODUCTION -> SEND_BACK ->
  // COMPLETED. Status sebelumnya digerakkan otomatis lewat advance() dari event
  // domain, jadi endpoint ini menolak status yang seharusnya otomatis.
  async transition(user: PrismaUser, moldId: string, dto: UpdateMoldTrackingDto): Promise<Mold> {
    const mold = await this.prisma.mold.findUnique({ where: { id: moldId } });
    if (!mold) throw new NotFoundException('Cetakan tidak ditemukan');

    const from = mold.trackingStatus as unknown as MoldTrackingStatus;
    assertManualTransition(user.role as Role, dto.status);
    assertMoldTransition(from, dto.status);

    const [updated] = await this.prisma.$transaction([
      this.prisma.mold.update({
        where: { id: moldId },
        data: { trackingStatus: asTracking(dto.status) },
      }),
      this.prisma.moldTrackingEvent.create({
        data: { moldId, status: asTracking(dto.status), byId: user.id },
      }),
    ]);
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

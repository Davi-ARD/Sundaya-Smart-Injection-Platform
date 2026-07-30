import { Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, User as PrismaUser } from '@prisma/client';
import { ItemPengiriman, LogPenerimaan, MoldTrackingStatus, Role } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MoldTrackingService } from '../molds/mold-tracking.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertMaterialFields, assertMoldRef } from '../common/item-pengiriman';
import { assertNotFuture } from '../common/time';
import { CreateLogPenerimaanDto } from './dto';
import { toLogPenerimaan } from './penerimaan.mapper';

const STAF_SUNDAYA: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA];

// ponytail: enum shared dan Prisma nominal berbeda, cast di batang DB saja.
const asItem = (i: ItemPengiriman) => i as unknown as $Enums.ItemPengiriman;

@Injectable()
export class PenerimaanService {
  constructor(
    private prisma: PrismaService,
    private moldTracking: MoldTrackingService,
    private notifications: NotificationsService,
  ) {}

  // Log Penerimaan (ADMIN_SUNDAYA): konfirmasi mold atau material tiba di lokasi
  // Sundaya. Dalam satu transaksi: tulis log, dan untuk item MOLD majukan tracking
  // mold ke RECEIVED. Manager pemilik job diberi notifikasi setelah transaksi sukses.
  //
  // Berbeda dari LogProduksi MATERIAL_DATANG (Layer 2): yang ini kedatangan di
  // gerbang Sundaya (tanggung jawab Sundaya), yang itu material masuk stok lantai
  // produksi (tanggung jawab Penyewa). Dua kejadian fisik yang berbeda.
  async create(user: PrismaUser, dto: CreateLogPenerimaanDto): Promise<LogPenerimaan> {
    // Penerimaan mencatat barang yang sudah tiba, bukan rencana kedatangan.
    assertNotFuture(dto.diterimaAt, 'diterimaAt');

    const job = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
      select: { id: true, jobNumber: true, managerId: true },
    });
    if (!job) throw new NotFoundException('Job tidak ditemukan');
    assertMaterialFields(dto.item, dto.materialName, dto.jumlahKg);
    assertMoldRef(dto.item, dto.moldId);
    const kodeMold = dto.moldId ? await this.moldKodeInJob(dto.jobId, dto.moldId) : undefined;

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.logPenerimaan.create({
        data: {
          jobId: dto.jobId,
          moldId: dto.moldId,
          item: asItem(dto.item),
          diterimaAt: new Date(dto.diterimaAt),
          materialName: dto.materialName,
          jumlahKg: dto.jumlahKg,
          noSuratJalan: dto.noSuratJalan,
          kondisi: dto.kondisi,
          catatan: dto.catatan,
          byId: user.id,
        },
      });
      if (dto.item === ItemPengiriman.MOLD && dto.moldId) {
        await this.moldTracking.advance(tx, dto.moldId, MoldTrackingStatus.RECEIVED, user.id);
      }
      return created;
    });

    await this.notifyManager(job.managerId, job.jobNumber, dto, kodeMold);
    return toLogPenerimaan(row, job.jobNumber, kodeMold);
  }

  // Cetakan harus benar-benar ada di booking yang disebut; kalau bukan, 404 supaya
  // cetakan booking lain tidak bisa disentuh dari sini.
  private async moldKodeInJob(jobId: string, moldId: string): Promise<string> {
    const mold = await this.prisma.mold.findUnique({
      where: { id: moldId },
      select: { kodeMold: true, jobId: true },
    });
    if (!mold || mold.jobId !== jobId) {
      throw new NotFoundException('Cetakan tidak ada di booking ini');
    }
    return mold.kodeMold;
  }

  // Staf Sundaya lihat semua (opsional filter jobId); Manager hanya job miliknya.
  async list(user: PrismaUser, jobId?: string): Promise<LogPenerimaan[]> {
    const rows = await this.prisma.logPenerimaan.findMany({
      where: {
        jobId,
        job: STAF_SUNDAYA.includes(user.role as Role) ? undefined : { managerId: user.id },
      },
      orderBy: { diterimaAt: 'desc' },
      include: { job: { select: { jobNumber: true } }, mold: { select: { kodeMold: true } } },
    });
    return rows.map((r) => toLogPenerimaan(r, r.job.jobNumber, r.mold?.kodeMold));
  }

  private async notifyManager(
    managerId: string,
    jobNumber: string,
    dto: CreateLogPenerimaanDto,
    kodeMold?: string,
  ) {
    const barang =
      dto.item === ItemPengiriman.MOLD
        ? `Cetakan ${kodeMold ?? ''}`.trim()
        : `Material ${dto.materialName ?? ''}`.trim();
    const tanggal = new Date(dto.diterimaAt).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    await this.notifications.create(
      managerId,
      'Barang diterima Sundaya',
      `${barang} untuk job ${jobNumber} tercatat tiba di Sundaya pada ${tanggal}.`,
      '/pengiriman',
    );
  }
}

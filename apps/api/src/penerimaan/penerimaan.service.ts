import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, User as PrismaUser } from '@prisma/client';
import { ItemPengiriman, LogPenerimaan, MoldTrackingStatus, Role } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MoldTrackingService } from '../molds/mold-tracking.service';
import { NotificationsService } from '../notifications/notifications.service';
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
    const job = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
      select: { id: true, jobNumber: true, managerId: true, moldId: true },
    });
    if (!job) throw new NotFoundException('Job tidak ditemukan');
    this.validateItemFields(dto);

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.logPenerimaan.create({
        data: {
          jobId: dto.jobId,
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
      if (dto.item === ItemPengiriman.MOLD) {
        await this.moldTracking.advance(tx, job.moldId, MoldTrackingStatus.RECEIVED, user.id);
      }
      return created;
    });

    await this.notifyManager(job.managerId, job.jobNumber, dto);
    return toLogPenerimaan(row, job.jobNumber);
  }

  // Staf Sundaya lihat semua (opsional filter jobId); Manager hanya job miliknya.
  async list(user: PrismaUser, jobId?: string): Promise<LogPenerimaan[]> {
    const rows = await this.prisma.logPenerimaan.findMany({
      where: {
        jobId,
        job: STAF_SUNDAYA.includes(user.role as Role) ? undefined : { managerId: user.id },
      },
      orderBy: { diterimaAt: 'desc' },
      include: { job: { select: { jobNumber: true } } },
    });
    return rows.map((r) => toLogPenerimaan(r, r.job.jobNumber));
  }

  private validateItemFields(dto: CreateLogPenerimaanDto) {
    if (dto.item !== ItemPengiriman.MATERIAL) return;
    if (!dto.materialName || dto.jumlahKg == null) {
      throw new BadRequestException('materialName dan jumlahKg wajib untuk item MATERIAL');
    }
  }

  private async notifyManager(managerId: string, jobNumber: string, dto: CreateLogPenerimaanDto) {
    const barang =
      dto.item === ItemPengiriman.MOLD ? 'Mold' : `Material ${dto.materialName ?? ''}`.trim();
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

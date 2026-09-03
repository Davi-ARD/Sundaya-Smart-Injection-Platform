import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, User as PrismaUser } from '@prisma/client';
import {
  ItemPengiriman,
  KONDISI_WAJIB_CATATAN,
  LogPenerimaan,
  MoldTrackingStatus,
  Role,
} from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MoldTrackingService } from '../molds/mold-tracking.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertMaterialFields, assertMoldRef, moldInJob } from '../common/log-refs';
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

  // Log Aktivitas (ADMIN_PENYEWA): catatan mold atau material tiba di lokasi
  // Sundaya. Admin Penyewa memang bertugas di lokasi Sundaya, jadi dialah yang
  // menyaksikan barang datang dan mencatatnya; Manager perusahaannya diberi tahu
  // lewat notifikasi supaya tahu barangnya sudah sampai.
  //
  // Pencatatan tidak memvalidasi status apa pun dan tidak menjalankan booking:
  // masa sewa mengikuti jadwal yang diinput penyewa, dan job berpindah ke AKTIF
  // saat produksi harian pertama dicatat. Untuk item MOLD status cetakan tetap
  // dimajukan ke RECEIVED sebagai catatan posisi fisiknya.
  async create(user: PrismaUser, dto: CreateLogPenerimaanDto): Promise<LogPenerimaan> {
    // Penerimaan mencatat barang yang sudah tiba, bukan rencana kedatangan.
    assertNotFuture(dto.diterimaAt, 'Waktu diterima');

    // Job wajib milik tenant pencatat: tanpa ini satu penyewa bisa menulis log
    // pada booking penyewa lain. Job tenant lain dibalas 404, bukan 403.
    const job = await this.getJobInTenant(user, dto.jobId);
    assertMaterialFields(dto.item, dto.materialName, dto.jumlahKg);
    // Barang yang tidak sepenuhnya baik wajib disertai alasan supaya engineering
    // dan purchasing tahu persis apa masalahnya, bukan sekadar label kondisi.
    if (dto.kondisi && KONDISI_WAJIB_CATATAN.includes(dto.kondisi) && !dto.catatan?.trim()) {
      throw new BadRequestException(
        'Catatan wajib diisi untuk kondisi selain Baik, jelaskan masalahnya',
      );
    }
    await this.assertSuratJalanCocok(dto);
    assertMoldRef(dto.item, dto.moldId);
    const kodeMold = dto.moldId
      ? (await moldInJob(this.prisma, dto.jobId, dto.moldId)).kodeMold
      : undefined;

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


  // Staf Sundaya lihat semua (opsional filter jobId); sisi penyewa hanya job
  // tenantnya sendiri. Admin Penyewa bernaung di bawah Manager lewat parentId,
  // jadi tenant-nya dibaca dari sana, bukan dari id-nya sendiri.
  async list(user: PrismaUser, jobId?: string): Promise<LogPenerimaan[]> {
    const rows = await this.prisma.logPenerimaan.findMany({
      where: {
        jobId,
        job: STAF_SUNDAYA.includes(user.role as Role) ? undefined : { managerId: this.tenantId(user) },
      },
      orderBy: { diterimaAt: 'desc' },
      include: { job: { select: { jobNumber: true } }, mold: { select: { kodeMold: true } } },
    });
    return rows.map((r) => toLogPenerimaan(r, r.job.jobNumber, r.mold?.kodeMold));
  }

  // Nomor surat jalan yang dicatat penerima harus sama dengan salah satu rencana
  // kirim yang sudah diumumkan Manager untuk job itu. Tanpa ini penerima bisa
  // mencatat kiriman yang tidak pernah direncanakan, sehingga rencana dan
  // penerimaan tidak lagi bisa dicocokkan.
  //
  // Hanya berlaku bila Manager memang sudah mencantumkan nomor surat jalan; job
  // yang rencananya tanpa nomor tidak punya acuan untuk dibandingkan.
  private async assertSuratJalanCocok(dto: CreateLogPenerimaanDto): Promise<void> {
    const diisi = dto.noSuratJalan?.trim();
    if (!diisi) return;

    const rencana = await this.prisma.logPengiriman.findMany({
      where: {
        jobId: dto.jobId,
        item: asItem(ItemPengiriman.MATERIAL),
        noSuratJalan: { not: null },
      },
      select: { noSuratJalan: true },
    });
    if (!rencana.length) return;

    const sah = rencana.map((r) => r.noSuratJalan?.trim().toLowerCase());
    if (!sah.includes(diisi.toLowerCase())) {
      throw new BadRequestException(
        `Nomor surat jalan "${diisi}" tidak ada di rencana kirim Manager. Nomor yang terdaftar: ${rencana
          .map((r) => r.noSuratJalan)
          .join(', ')}`,
      );
    }
  }

  private tenantId(user: PrismaUser): string {
    return (user.role === Role.ADMIN_PENYEWA ? user.parentId : user.id) ?? '__none__';
  }

  // Job harus milik tenant pengakses. Staf Sundaya boleh membaca semuanya.
  private async getJobInTenant(user: PrismaUser, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, jobNumber: true, managerId: true },
    });
    if (!job) throw new NotFoundException('Job tidak ditemukan');
    if (STAF_SUNDAYA.includes(user.role as Role)) return job;
    if (job.managerId !== this.tenantId(user)) throw new NotFoundException('Job tidak ditemukan');
    return job;
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
      'Barang diterima admin',
      `${barang} untuk job ${jobNumber} tercatat tiba di Sundaya pada ${tanggal}.`,
      '/pengiriman',
    );
  }
}

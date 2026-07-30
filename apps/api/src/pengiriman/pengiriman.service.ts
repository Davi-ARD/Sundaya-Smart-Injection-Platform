import { Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, User as PrismaUser } from '@prisma/client';
import { ItemPengiriman, LogPengiriman, MoldTrackingStatus, Role } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MoldTrackingService } from '../molds/mold-tracking.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertMaterialFields, assertMoldRef } from '../common/item-pengiriman';
import { CreateLogPengirimanDto } from './dto';
import { toLogPengiriman } from './pengiriman.mapper';

const STAF_SUNDAYA: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA];

// ponytail: enum shared dan Prisma nominal berbeda, cast di batang DB saja.
const asItem = (i: ItemPengiriman) => i as unknown as $Enums.ItemPengiriman;

@Injectable()
export class PengirimanService {
  constructor(
    private prisma: PrismaService,
    private moldTracking: MoldTrackingService,
    private notifications: NotificationsService,
  ) {}

  // Log Pengiriman (MANAGER_PENYEWA): catatan kapan mold atau material akan
  // dikirim ke Sundaya. Dalam satu transaksi: tulis log, dan untuk item MOLD
  // majukan tracking mold ke DELIVERY. Notifikasi ke Admin Sundaya dikirim
  // setelah transaksi sukses supaya tidak terkirim untuk transaksi yang gagal.
  async create(user: PrismaUser, dto: CreateLogPengirimanDto): Promise<LogPengiriman> {
    const job = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
      select: { id: true, jobNumber: true, managerId: true },
    });
    // Job milik tenant lain sama dengan tidak ada: jangan bocorkan keberadaannya.
    if (!job || job.managerId !== user.id) throw new NotFoundException('Job tidak ditemukan');
    assertMaterialFields(dto.item, dto.materialName, dto.jumlahKg);
    assertMoldRef(dto.item, dto.moldId);
    const kodeMold = dto.moldId ? await this.moldKodeInJob(dto.jobId, dto.moldId) : undefined;

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.logPengiriman.create({
        data: {
          jobId: dto.jobId,
          moldId: dto.moldId,
          item: asItem(dto.item),
          rencanaKirim: new Date(dto.rencanaKirim),
          materialName: dto.materialName,
          jumlahKg: dto.jumlahKg,
          noSuratJalan: dto.noSuratJalan,
          catatan: dto.catatan,
          byId: user.id,
        },
      });
      if (dto.item === ItemPengiriman.MOLD && dto.moldId) {
        await this.moldTracking.advance(tx, dto.moldId, MoldTrackingStatus.DELIVERY, user.id);
      }
      return created;
    });

    await this.notifySundaya(user, job.jobNumber, dto, kodeMold);
    return toLogPengiriman(row, job.jobNumber, kodeMold);
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

  // Scoping tenant: Manager lihat log job miliknya; staf Sundaya lihat semua
  // (opsional filter jobId). Admin Penyewa tidak mengakses modul ini.
  async list(user: PrismaUser, jobId?: string): Promise<LogPengiriman[]> {
    const rows = await this.prisma.logPengiriman.findMany({
      where: {
        jobId,
        job: STAF_SUNDAYA.includes(user.role as Role) ? undefined : { managerId: user.id },
      },
      orderBy: { rencanaKirim: 'desc' },
      include: { job: { select: { jobNumber: true } }, mold: { select: { kodeMold: true } } },
    });
    return rows.map((r) => toLogPengiriman(r, r.job.jobNumber, r.mold?.kodeMold));
  }

  private async notifySundaya(
    user: PrismaUser,
    jobNumber: string,
    dto: CreateLogPengirimanDto,
    kodeMold?: string,
  ) {
    const staf = await this.prisma.user.findMany({
      where: { role: $Enums.Role.ADMIN_SUNDAYA, isActive: true },
      select: { id: true },
    });
    const barang =
      dto.item === ItemPengiriman.MOLD
        ? `Cetakan ${kodeMold ?? ''}`.trim()
        : `Material ${dto.materialName ?? ''}`.trim();
    const tanggal = new Date(dto.rencanaKirim).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    await this.notifications.createMany(
      staf.map((s) => s.id),
      'Rencana pengiriman baru',
      `${user.nama} menjadwalkan ${barang} untuk job ${jobNumber} dikirim ${tanggal}.`,
      '/penerimaan',
    );
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, User as PrismaUser } from '@prisma/client';
import { ItemPengiriman, LogPengiriman, MoldTrackingStatus, Role } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MoldTrackingService } from '../molds/mold-tracking.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertMaterialFields, assertMoldRef, moldInJob } from '../common/log-refs';
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
    const kodeMold = dto.moldId
      ? (await moldInJob(this.prisma, dto.jobId, dto.moldId)).kodeMold
      : undefined;

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

    await this.notifikasiRencanaKirim(user, job, dto, kodeMold);
    return toLogPengiriman(row, job.jobNumber, kodeMold);
  }


  // Scoping tenant: Manager lihat log job miliknya; staf Sundaya lihat semua
  // (opsional filter jobId). Admin Penyewa tidak mengakses modul ini.
  async list(user: PrismaUser, jobId?: string): Promise<LogPengiriman[]> {
    const rows = await this.prisma.logPengiriman.findMany({
      where: {
        jobId,
        job: STAF_SUNDAYA.includes(user.role as Role)
          ? undefined
          : { managerId: (user.role === Role.ADMIN_PENYEWA ? user.parentId : user.id) ?? '__none__' },
      },
      orderBy: { rencanaKirim: 'desc' },
      include: { job: { select: { jobNumber: true } }, mold: { select: { kodeMold: true } } },
    });
    return rows.map((r) => toLogPengiriman(r, r.job.jobNumber, r.mold?.kodeMold));
  }

  // Dua pihak diberi tahu saat Manager menjadwalkan pengiriman:
  //
  // - Admin Penyewa tenant itu: dialah yang mencatat penerimaan barang di Log
  //   Aktivitas, jadi notifikasinya menaut langsung ke halaman itu.
  // - Staf Sundaya: barangnya masuk ke lokasi mereka, jadi perlu tahu untuk
  //   bersiap. Tanpa tautan karena pencatatan bukan lagi wewenang mereka.
  private async notifikasiRencanaKirim(
    user: PrismaUser,
    job: { jobNumber: string; managerId: string },
    dto: CreateLogPengirimanDto,
    kodeMold?: string,
  ) {
    const barang =
      dto.item === ItemPengiriman.MOLD
        ? `Cetakan ${kodeMold ?? ''}`.trim()
        : `Material ${dto.materialName ?? ''}`.trim();
    const tanggal = new Date(dto.rencanaKirim).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const pesan = `${user.nama} menjadwalkan ${barang} untuk job ${job.jobNumber} dikirim ${tanggal}.`;

    const [adminPenyewa, stafSundaya] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: $Enums.Role.ADMIN_PENYEWA,
          parentId: job.managerId,
          isActive: true,
        },
        select: { id: true },
      }),
      this.prisma.user.findMany({
        where: { role: $Enums.Role.ADMIN_SUNDAYA, isActive: true },
        select: { id: true },
      }),
    ]);

    await this.notifications.createMany(
      adminPenyewa.map((u) => u.id),
      'Barang dalam perjalanan',
      `${pesan} Catat penerimaannya di Log Aktivitas begitu barang tiba.`,
      '/penerimaan',
    );
    await this.notifications.createMany(
      stafSundaya.map((u) => u.id),
      'Rencana pengiriman baru',
      pesan,
    );
  }
}

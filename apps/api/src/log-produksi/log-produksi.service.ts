import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, User as PrismaUser } from '@prisma/client';
import {
  LogProduksi,
  MoldTrackingStatus,
  ProgressMolding,
  Role,
} from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MoldTrackingService } from '../molds/mold-tracking.service';
import { activateJobOnProduksi } from '../jobs/job-transitions';
import { assertNotFuture } from '../common/time';
import { machineForMold, moldInJob } from '../common/log-refs';
import { CreateLogProduksiDto } from './dto';
import { toLogProduksi } from './log-produksi.mapper';

const STAF_SUNDAYA: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA];

@Injectable()
export class LogProduksiService {
  constructor(
    private prisma: PrismaService,
    private moldTracking: MoldTrackingService,
  ) {}

  // Timeline event Layer 2 satu job (urut kejadian). Semua pihak tenant + staf baca.
  // Kode cetakan dan nomor mesin ikut dimuat supaya timeline bisa menyebut pasangan
  // "cetakan X di mesin Y" tanpa pemanggilan tambahan dari web.
  async findAll(user: PrismaUser, jobId: string): Promise<LogProduksi[]> {
    await this.getJobInTenant(user, jobId);
    const logs = await this.prisma.logProduksi.findMany({
      where: { jobId },
      orderBy: { occurredAt: 'asc' },
      include: {
        mold: { select: { kodeMold: true } },
        machine: { select: { machineNumber: true } },
      },
    });
    return logs.map((l) => toLogProduksi(l, l.mold.kodeMold, l.machine.machineNumber));
  }

  // Append-only (Admin Penyewa): hanya field milik eventType yang disimpan.
  // Koreksi dilakukan lewat event baru, bukan update/delete.
  //
  // Dua jenis event saja: produksi harian dan progress molding. Kedatangan material
  // tidak dicatat di sini, sudah ada di Log Pengiriman Manager dan Log Penerimaan
  // Admin Sundaya; yang tersisa di Layer 2 adalah pemakaian materialnya per hari.
  //
  // Event dicatat per pasangan cetakan-mesin. Batas output dan material ditetapkan per
  // cetakan, dan booking meminjamkan beberapa mesin tanpa memasangkannya ke cetakan,
  // jadi log inilah satu-satunya tempat yang tahu cetakan mana berjalan di mesin mana.
  // Event PRODUKSI_HARIAN menandai cetakan itu benar-benar dipakai di mesin, jadi
  // statusnya ikut maju ke PRODUCTION dan booking-nya berpindah ke AKTIF: mengisi
  // produksi harian sekaligus jadi bukti job sudah berjalan (idempoten, karena
  // advance() hanya bergerak maju dan aktivasi mensyaratkan lifecycle DIKONFIRMASI).
  // Progress molding SUDAH_DIPRODUKSI menutup siklus cetakan langsung ke COMPLETED
  // tanpa langkah kirim balik terpisah; cetakan terakhir menutup booking-nya.
  async append(user: PrismaUser, jobId: string, dto: CreateLogProduksiDto): Promise<LogProduksi> {
    // Event Layer 2 mencatat kejadian yang sudah terjadi, bukan rencana.
    assertNotFuture(dto.occurredAt, 'Waktu kejadian');
    const job = await this.getJobInTenant(user, jobId);
    this.assertSewaMasihBerjalan(job);
    const mold = await moldInJob(this.prisma, jobId, dto.moldId);
    // Event terjadi di atas mesin: mesin harus salah satu mesin pinjaman booking
    // dan tonasenya harus sanggup menahan cetakan itu.
    const machine = await machineForMold(this.prisma, jobId, dto.machineId, mold);

    // Batas produksi dibaca dari SESI berjalan, bukan akumulasi seumur hidup
    // cetakan. Cetakan yang dipakai lagi punya sesi baru dengan targetnya
    // sendiri, jadi hasil sesi lama tidak ikut membebani sesi sekarang.
    const akum = await this.akumulasi(dto.moldId);
    const sesi = await this.sesiBerjalan(dto.moldId);
    const sebelumnya = {
      goodProduct: akum.goodProduct - (sesi?.goodAwal ?? 0),
      materialUsedKg: akum.materialUsedKg - (sesi?.materialAwal ?? 0),
    };
    // Tanpa sesi (cetakan lama yang belum pernah diberi target) batasnya jatuh
    // kembali ke plan cetakan itu sendiri, jadi perilakunya sama seperti sebelum
    // sesi produksi diperkenalkan.
    const batas = {
      kodeMold: mold.kodeMold,
      targetOutput: sesi?.targetOutput ?? mold.targetOutput,
      estimasiKg: sesi?.estimasiKg ?? mold.estimasiKg,
    };
    this.assertMasihBolehProduksi(batas, sebelumnya.goodProduct);
    this.assertWithinPlan(batas, dto, sebelumnya);

    // Progress dihitung server, bukan dipilih Admin Penyewa: begitu produk baik
    // sesi ini menyentuh targetnya, sesi itu dinyatakan selesai.
    const totalGood = sebelumnya.goodProduct + dto.goodProduct;
    const targetTercapai = batas.targetOutput != null && totalGood >= batas.targetOutput;
    const progress = targetTercapai ? ProgressMolding.SUDAH_DIPRODUKSI : ProgressMolding.ONGOING;

    return this.prisma.$transaction(async (tx) => {
      const log = await tx.logProduksi.create({
        data: {
          jobId,
          moldId: dto.moldId,
          machineId: machine.id,
          byId: user.id,
          eventType: $Enums.LogProduksiEventType.PRODUKSI_HARIAN,
          occurredAt: new Date(dto.occurredAt),
          catatan: dto.catatan,
          goodProduct: dto.goodProduct,
          rejectCount: dto.rejectCount,
          materialUsedKg: dto.materialUsedKg,
          progressMolding: progress as unknown as $Enums.ProgressMolding,
        },
      });
      await this.moldTracking.advance(tx, dto.moldId, MoldTrackingStatus.PRODUCTION, user.id);
      await activateJobOnProduksi(tx, jobId);
      // Cetakan yang menyentuh target dinyatakan selesai, tapi booking-nya TIDAK
      // ikut ditutup: selama masa sewa berjalan penyewa masih boleh memakai mesin
      // untuk cetakan lain, atau cetakan ini lagi setelah Manager menaikkan target.
      if (targetTercapai) {
        await this.moldTracking.advance(tx, dto.moldId, MoldTrackingStatus.COMPLETED, user.id);
      }
      return toLogProduksi(log, mold.kodeMold, machine.machineNumber);
    });
  }

  // Sesi produksi yang sedang berjalan: baris MoldProductionRun terbaru cetakan
  // itu. Cetakan tanpa sesi (target output belum pernah diisi) berarti tidak
  // dibatasi, sama seperti perilaku lama.
  private async sesiBerjalan(moldId: string) {
    return this.prisma.moldProductionRun.findFirst({
      where: { moldId },
      orderBy: { at: 'desc' },
      select: { targetOutput: true, estimasiKg: true, goodAwal: true, materialAwal: true },
    });
  }

  // Akumulasi produksi cetakan sejauh ini, dipakai validasi batas sekaligus
  // penentuan progress. Satu query, dipakai bersama supaya angkanya konsisten.
  private async akumulasi(moldId: string) {
    const agg = await this.prisma.logProduksi.aggregate({
      where: { moldId, eventType: $Enums.LogProduksiEventType.PRODUKSI_HARIAN },
      _sum: { goodProduct: true, materialUsedKg: true },
    });
    return {
      goodProduct: agg._sum.goodProduct ?? 0,
      materialUsedKg: agg._sum.materialUsedKg ?? 0,
    };
  }

  // Cetakan yang sudah menyentuh target output dianggap selesai: produksi harian
  // berikutnya ditolak, bukan sekadar dibatasi sisanya. Ini yang menghentikan
  // Admin Penyewa melanjutkan progres pada cetakan yang sudah tuntas.
  private assertMasihBolehProduksi(
    mold: { kodeMold: string; targetOutput: number | null },
    goodSebelumnya: number,
  ) {
    if (mold.targetOutput == null) return;
    if (goodSebelumnya >= mold.targetOutput) {
      throw new BadRequestException(
        `Cetakan ${mold.kodeMold} sudah mencapai target output ${mold.targetOutput} produk baik, produksinya dinyatakan selesai dan tidak bisa ditambah lagi`,
      );
    }
  }

  // Plan cetakan adalah batas keras: akumulasi produk baik tidak boleh melewati
  // targetOutput, dan material terpakai tidak boleh melewati estimasiKg. Plan yang
  // kosong berarti tidak dibatasi. Akumulasi diterima sebagai argumen supaya tidak
  // menghitung ulang query yang sama.
  private assertWithinPlan(
    mold: { kodeMold: string; targetOutput: number | null; estimasiKg: number | null },
    dto: CreateLogProduksiDto,
    sebelumnya: { goodProduct: number; materialUsedKg: number },
  ) {
    if (mold.targetOutput != null) {
      const totalGood = sebelumnya.goodProduct + dto.goodProduct;
      if (totalGood > mold.targetOutput) {
        const sisa = mold.targetOutput - sebelumnya.goodProduct;
        throw new BadRequestException(
          `Produk baik melewati target cetakan ${mold.kodeMold}: target ${mold.targetOutput}, sisa ${sisa}`,
        );
      }
    }

    if (mold.estimasiKg != null && dto.materialUsedKg != null) {
      const totalMaterial = sebelumnya.materialUsedKg + dto.materialUsedKg;
      if (totalMaterial > mold.estimasiKg) {
        const sisa = mold.estimasiKg - sebelumnya.materialUsedKg;
        throw new BadRequestException(
          `Material terpakai melewati plan cetakan ${mold.kodeMold}: plan ${mold.estimasiKg} kg, sisa ${sisa} kg`,
        );
      }
    }
  }

  // Produksi hanya boleh dicatat selama masa sewa berjalan. Setelah booking
  // ditutup mesinnya sudah kembali ke kolam Sundaya dan bisa dipinjamkan ke
  // penyewa lain, jadi pencatatan susulan akan mengklaim mesin yang bukan lagi
  // milik penyewa ini.
  private assertSewaMasihBerjalan(job: { lifecycle: string; endDate: Date | null }) {
    const selesai = job.lifecycle === ($Enums.JobLifecycle.SELESAI as string);
    const lewatMasaSewa = job.endDate != null && job.endDate.getTime() < Date.now();
    if (selesai || lewatMasaSewa) {
      throw new BadRequestException(
        'Masa sewa booking ini sudah berakhir, produksi tidak bisa dicatat lagi. Ajukan booking baru untuk melanjutkan produksi.',
      );
    }
  }

  private async getJobInTenant(user: PrismaUser, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, managerId: true, lifecycle: true, endDate: true },
    });
    if (!job) throw new NotFoundException('Job tidak ditemukan');
    if (STAF_SUNDAYA.includes(user.role as Role)) return job;
    const tenantId = user.role === Role.ADMIN_PENYEWA ? user.parentId : user.id;
    if (job.managerId !== tenantId) throw new NotFoundException('Job tidak ditemukan');
    return job;
  }
}

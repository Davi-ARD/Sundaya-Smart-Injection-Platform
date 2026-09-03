import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, Prisma } from '@prisma/client';
import { JobLifecycle, Mold } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMoldDto, UpdateMoldDto } from './dto';
import { toMold } from './mold.mapper';
import { MoldTrackingService } from './mold-tracking.service';

@Injectable()
export class MoldsService {
  constructor(
    private prisma: PrismaService,
    private moldTracking: MoldTrackingService,
  ) {}

  // Scoping tenant: mold selalu milik Manager (tenant root). Manager hanya
  // melihat mold dengan managerId dirinya sendiri.
  async findAll(managerId: string): Promise<Mold[]> {
    const molds = await this.prisma.mold.findMany({
      where: { managerId },
      orderBy: { createdAt: 'desc' },
    });
    return molds.map(toMold);
  }

  async findOne(managerId: string, id: string): Promise<Mold> {
    return toMold(await this.getOwned(managerId, id));
  }

  // Staf Sundaya: baca semua mold (single-provider, tanpa scoping tenant),
  // dipakai untuk approval booking dan transisi tracking.
  async findAllStaff(): Promise<Mold[]> {
    const molds = await this.prisma.mold.findMany({ orderBy: { createdAt: 'desc' } });
    return molds.map(toMold);
  }

  async findOneStaff(id: string): Promise<Mold> {
    const mold = await this.prisma.mold.findUnique({ where: { id } });
    if (!mold) throw new NotFoundException('Cetakan tidak ditemukan');
    return toMold(mold);
  }

  // trackingStatus di-default PLANNING oleh schema; tidak diterima dari client.
  async create(managerId: string, dto: CreateMoldDto): Promise<Mold> {
    try {
      const mold = await this.prisma.mold.create({
        data: {
          kodeMold: dto.kodeMold,
          namaProduk: dto.namaProduk,
          cavity: dto.cavity,
          tonaseTon: dto.tonaseTon,
          deskripsi: dto.deskripsi,
          planMaterialUtama: dto.planMaterialUtama,
          estimasiKg: dto.estimasiKg,
          targetOutput: dto.targetOutput,
          managerId,
        },
      });
      // Cetakan yang langsung diberi target output memulai sesi produksi
      // pertamanya, supaya validasi target punya acuan sejak awal.
      if (mold.targetOutput != null) {
        await this.prisma.moldProductionRun.create({
          data: {
            moldId: mold.id,
            targetOutput: mold.targetOutput,
            estimasiKg: mold.estimasiKg,
            byId: managerId,
          },
        });
      }
      return toMold(mold);
    } catch (error) {
      throw this.mapKodeConflict(error);
    }
  }

  // Update field plan saja. trackingStatus tidak diubah di sini (transisi lewat
  // modul tracking, service-guarded). kodeMold tidak boleh ganti.
  async update(managerId: string, id: string, dto: UpdateMoldDto): Promise<Mold> {
    const sebelum = await this.getOwned(managerId, id);

    return this.prisma.$transaction(async (tx) => {
      const mold = await tx.mold.update({
        where: { id },
        data: {
          namaProduk: dto.namaProduk,
          cavity: dto.cavity,
          tonaseTon: dto.tonaseTon,
          deskripsi: dto.deskripsi,
          planMaterialUtama: dto.planMaterialUtama,
          estimasiKg: dto.estimasiKg,
          targetOutput: dto.targetOutput,
        },
      });

      // Target output diganti berarti penyewa memulai sesi produksi baru dengan
      // cetakan ini. Target barunya boleh lebih besar maupun lebih kecil dari
      // sesi sebelumnya: yang dibandingkan adalah hasil sesi barunya sendiri,
      // bukan akumulasi seumur hidup cetakan.
      const targetBaru = dto.targetOutput;
      if (targetBaru != null && targetBaru !== sebelum.targetOutput) {
        await this.mulaiSesiBaru(tx, id, managerId, sebelum.jobId, targetBaru, mold.estimasiKg);
      }
      return toMold(mold);
    });
  }

  // Membuka sesi produksi baru untuk satu cetakan. Akumulasi berjalan disimpan
  // sebagai titik awal sesi, sehingga capaian sesi ini dihitung sebagai selisih
  // dan hasil sesi lama tetap utuh sebagai riwayat.
  //
  // Cetakan yang tadinya COMPLETED dikembalikan ke PRODUCTION supaya bisa
  // diproduksi lagi, tapi hanya bila booking-nya masih dalam masa sewa. Di luar
  // masa sewa mesin sudah kembali ke Sundaya, jadi sesi baru tetap tercatat
  // sebagai rencana namun cetakannya tidak dibuka.
  private async mulaiSesiBaru(
    tx: Prisma.TransactionClient,
    moldId: string,
    byId: string,
    jobId: string | null,
    targetOutput: number,
    estimasiKg: number | null,
  ): Promise<void> {
    const agg = await tx.logProduksi.aggregate({
      where: { moldId, eventType: $Enums.LogProduksiEventType.PRODUKSI_HARIAN },
      _sum: { goodProduct: true, materialUsedKg: true },
    });

    await tx.moldProductionRun.create({
      data: {
        moldId,
        jobId,
        targetOutput,
        estimasiKg,
        goodAwal: agg._sum.goodProduct ?? 0,
        materialAwal: agg._sum.materialUsedKg ?? 0,
        byId,
      },
    });

    if (await this.sewaMasihBerjalan(tx, jobId)) {
      await this.moldTracking.reopen(tx, moldId, byId);
    }
  }

  private async sewaMasihBerjalan(
    tx: Prisma.TransactionClient,
    jobId: string | null,
  ): Promise<boolean> {
    if (!jobId) return false;
    const job = await tx.job.findUnique({
      where: { id: jobId },
      select: { lifecycle: true, endDate: true },
    });
    return (
      job != null &&
      job.lifecycle === (JobLifecycle.AKTIF as unknown as $Enums.JobLifecycle) &&
      (job.endDate == null || job.endDate.getTime() >= Date.now())
    );
  }

  // Mold milik Manager lain (atau tidak ada) sama-sama NotFound: jangan bocorkan
  // keberadaan data tenant lain.
  private async getOwned(managerId: string, id: string) {
    const mold = await this.prisma.mold.findUnique({ where: { id } });
    if (!mold || mold.managerId !== managerId) {
      throw new NotFoundException('Cetakan tidak ditemukan');
    }
    return mold;
  }

  private mapKodeConflict(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('Kode mold sudah terpakai');
    }
    return error;
  }
}

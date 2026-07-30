import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, Prisma, User as PrismaUser } from '@prisma/client';
import {
  LogProduksi,
  LogProduksiEventType,
  MoldTrackingStatus,
  Role,
} from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MoldTrackingService } from '../molds/mold-tracking.service';
import { assertNotFuture } from '../common/time';
import { machineForMold, moldInJob } from '../common/log-refs';
import { CreateLogProduksiDto } from './dto';
import { toLogProduksi } from './log-produksi.mapper';

const STAF_SUNDAYA: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA];

// Event yang benar-benar terjadi di atas mesin, jadi wajib menyebut mesin mana.
// MATERIAL_DATANG tidak menyentuh mesin.
const EVENT_DI_MESIN: LogProduksiEventType[] = [
  LogProduksiEventType.PRODUKSI_HARIAN,
  LogProduksiEventType.PROGRESS_MOLDING,
];

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
    return logs.map((l) => toLogProduksi(l, l.mold.kodeMold, l.machine?.machineNumber ?? null));
  }

  // Append-only (Admin Penyewa): hanya field milik eventType yang disimpan.
  // Koreksi dilakukan lewat event baru, bukan update/delete.
  //
  // Event dicatat per pasangan cetakan-mesin. Batas output dan material ditetapkan per
  // cetakan, dan booking meminjamkan beberapa mesin tanpa memasangkannya ke cetakan,
  // jadi log inilah satu-satunya tempat yang tahu cetakan mana berjalan di mesin mana.
  // Event PRODUKSI_HARIAN menandai cetakan itu benar-benar dipakai di mesin, jadi
  // tracking-nya ikut maju ke PRODUCTION (idempoten: event kedua dan seterusnya tidak
  // mengubah apa pun karena advance() hanya bergerak maju).
  async append(user: PrismaUser, jobId: string, dto: CreateLogProduksiDto): Promise<LogProduksi> {
    // Event Layer 2 mencatat kejadian yang sudah terjadi, bukan rencana.
    assertNotFuture(dto.occurredAt, 'occurredAt');
    await this.getJobInTenant(user, jobId);
    const mold = await moldInJob(this.prisma, jobId, dto.moldId);
    const machine = await this.resolveMachine(jobId, dto, mold);
    const eventData = this.buildEventData(dto);
    if (dto.eventType === LogProduksiEventType.PRODUKSI_HARIAN) {
      await this.assertWithinPlan(mold, dto);
    }

    return this.prisma.$transaction(async (tx) => {
      const log = await tx.logProduksi.create({
        data: {
          jobId,
          moldId: dto.moldId,
          machineId: machine?.id ?? null,
          byId: user.id,
          eventType: dto.eventType as unknown as $Enums.LogProduksiEventType,
          occurredAt: new Date(dto.occurredAt),
          catatan: dto.catatan,
          ...eventData,
        },
      });
      if (dto.eventType === LogProduksiEventType.PRODUKSI_HARIAN) {
        await this.moldTracking.advance(tx, dto.moldId, MoldTrackingStatus.PRODUCTION, user.id);
      }
      return toLogProduksi(log, mold.kodeMold, machine?.machineNumber ?? null);
    });
  }

  // Event yang berjalan di atas mesin wajib menyebut mesinnya; mesin harus salah satu
  // mesin booking dan tonasenya harus sanggup menahan cetakan itu.
  private async resolveMachine(
    jobId: string,
    dto: CreateLogProduksiDto,
    mold: { kodeMold: string; tonaseTon: number },
  ) {
    if (!EVENT_DI_MESIN.includes(dto.eventType)) return null;
    if (!dto.machineId) {
      throw new BadRequestException(`${dto.eventType} wajib menyebut machineId`);
    }
    return machineForMold(this.prisma, jobId, dto.machineId, mold);
  }

  // Plan cetakan adalah batas keras, bukan sekadar pembanding: akumulasi produk baik
  // tidak boleh melewati targetOutput, dan akumulasi material terpakai tidak boleh
  // melewati estimasiKg. Plan yang kosong berarti tidak dibatasi.
  private async assertWithinPlan(
    mold: { kodeMold: string; targetOutput: number | null; estimasiKg: number | null },
    dto: CreateLogProduksiDto,
  ) {
    const terpakai = await this.prisma.logProduksi.aggregate({
      where: { moldId: dto.moldId, eventType: $Enums.LogProduksiEventType.PRODUKSI_HARIAN },
      _sum: { goodProduct: true, materialUsedKg: true },
    });

    if (mold.targetOutput != null) {
      const totalGood = (terpakai._sum.goodProduct ?? 0) + (dto.goodProduct ?? 0);
      if (totalGood > mold.targetOutput) {
        const sisa = mold.targetOutput - (terpakai._sum.goodProduct ?? 0);
        throw new BadRequestException(
          `Produk baik melewati target cetakan ${mold.kodeMold}: target ${mold.targetOutput}, sisa ${sisa}`,
        );
      }
    }

    if (mold.estimasiKg != null && dto.materialUsedKg != null) {
      const totalMaterial = (terpakai._sum.materialUsedKg ?? 0) + dto.materialUsedKg;
      if (totalMaterial > mold.estimasiKg) {
        const sisa = mold.estimasiKg - (terpakai._sum.materialUsedKg ?? 0);
        throw new BadRequestException(
          `Material terpakai melewati plan cetakan ${mold.kodeMold}: plan ${mold.estimasiKg} kg, sisa ${sisa} kg`,
        );
      }
    }
  }

  // Field wajib per eventType ditegakkan di sini; hanya field milik tipe yang lolos
  // (field lintas-tipe diabaikan agar timeline tidak tercampur).
  private buildEventData(
    dto: CreateLogProduksiDto,
  ): Partial<Prisma.LogProduksiUncheckedCreateInput> {
    switch (dto.eventType) {
      case LogProduksiEventType.MATERIAL_DATANG:
        if (!dto.materialName || dto.jumlahKg == null) {
          throw new BadRequestException('MATERIAL_DATANG wajib materialName dan jumlahKg');
        }
        return {
          materialName: dto.materialName,
          jumlahKg: dto.jumlahKg,
          noSuratJalan: dto.noSuratJalan,
        };
      case LogProduksiEventType.PRODUKSI_HARIAN:
        if (dto.goodProduct == null || dto.rejectCount == null) {
          throw new BadRequestException('PRODUKSI_HARIAN wajib goodProduct dan rejectCount');
        }
        return {
          goodProduct: dto.goodProduct,
          rejectCount: dto.rejectCount,
          materialUsedKg: dto.materialUsedKg,
        };
      case LogProduksiEventType.PROGRESS_MOLDING:
        if (!dto.progressMolding) {
          throw new BadRequestException('PROGRESS_MOLDING wajib progressMolding');
        }
        return {
          progressMolding: dto.progressMolding as unknown as $Enums.ProgressMolding,
          keteranganProgress: dto.keteranganProgress,
        };
      default:
        throw new BadRequestException('eventType tidak dikenal');
    }
  }

  // Job harus milik tenant pengakses; job tenant lain / tidak ada -> 404 (tidak
  // dibocorkan keberadaannya). Staf Sundaya lihat semua.
  private async getJobInTenant(user: PrismaUser, jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, managerId: true },
    });
    if (!job) throw new NotFoundException('Job tidak ditemukan');
    if (STAF_SUNDAYA.includes(user.role as Role)) return job;
    const tenantId = user.role === Role.ADMIN_PENYEWA ? user.parentId : user.id;
    if (job.managerId !== tenantId) throw new NotFoundException('Job tidak ditemukan');
    return job;
  }
}

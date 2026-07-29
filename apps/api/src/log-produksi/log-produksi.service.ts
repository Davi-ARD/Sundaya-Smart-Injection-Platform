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
  async findAll(user: PrismaUser, jobId: string): Promise<LogProduksi[]> {
    await this.getJobInTenant(user, jobId);
    const logs = await this.prisma.logProduksi.findMany({
      where: { jobId },
      orderBy: { occurredAt: 'asc' },
    });
    return logs.map(toLogProduksi);
  }

  // Append-only (Admin Penyewa): hanya field milik eventType yang disimpan.
  // Koreksi dilakukan lewat event baru, bukan update/delete.
  //
  // Event PRODUKSI_HARIAN menandai mold benar-benar dipakai di mesin, jadi tracking
  // mold ikut maju ke PRODUCTION (idempoten: event kedua dan seterusnya tidak
  // mengubah apa pun karena advance() hanya bergerak maju).
  async append(user: PrismaUser, jobId: string, dto: CreateLogProduksiDto): Promise<LogProduksi> {
    const job = await this.getJobInTenant(user, jobId);
    const eventData = this.buildEventData(dto);

    return this.prisma.$transaction(async (tx) => {
      const log = await tx.logProduksi.create({
        data: {
          jobId,
          byId: user.id,
          eventType: dto.eventType as unknown as $Enums.LogProduksiEventType,
          occurredAt: new Date(dto.occurredAt),
          catatan: dto.catatan,
          ...eventData,
        },
      });
      if (dto.eventType === LogProduksiEventType.PRODUKSI_HARIAN) {
        await this.moldTracking.advance(tx, job.moldId, MoldTrackingStatus.PRODUCTION, user.id);
      }
      return toLogProduksi(log);
    });
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
          materialRemainingKg: dto.materialRemainingKg,
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
      select: { id: true, managerId: true, moldId: true },
    });
    if (!job) throw new NotFoundException('Job tidak ditemukan');
    if (STAF_SUNDAYA.includes(user.role as Role)) return job;
    const tenantId = user.role === Role.ADMIN_PENYEWA ? user.parentId : user.id;
    if (job.managerId !== tenantId) throw new NotFoundException('Job tidak ditemukan');
    return job;
  }
}

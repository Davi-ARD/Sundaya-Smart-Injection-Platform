import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { $Enums, Prisma, User as PrismaUser } from '@prisma/client';
import {
  DEFAULT_EFFICIENCY_THRESHOLD,
  MachineEfficiency,
  MachineStatus,
  OperatorEfficiency,
  ProductionBatch,
  ReviewStatus,
  Role,
} from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBatchDto, ReviewBatchDto } from './dto';
import { toBatch } from './batch.mapper';
import { computeBatchMetrics } from './efficiency';

// ponytail: ambang cukup satu konstanta yang bisa ditimpa env; belum butuh tabel setting.
const EFFICIENCY_THRESHOLD = Number(process.env.EFFICIENCY_THRESHOLD) || DEFAULT_EFFICIENCY_THRESHOLD;

const asMachineStatus = (s: MachineStatus) => s as unknown as $Enums.MachineStatus;
const asReviewStatus = (s: ReviewStatus) => s as unknown as $Enums.ReviewStatus;

interface BatchFilters {
  rentalId?: string;
  machineId?: string;
  operatorId?: string;
  flagged?: boolean;
}

@Injectable()
export class ProductionService {
  constructor(private prisma: PrismaService) {}

  // OPERATOR input batch untuk mesin yang AKTIF di sewa induk (PENYEWA-nya).
  async create(user: PrismaUser, dto: CreateBatchDto): Promise<ProductionBatch> {
    const rental = await this.prisma.rental.findUnique({
      where: { id: dto.rentalId },
      include: { machine: { select: { status: true, standardRatio: true } } },
    });
    if (!rental) throw new NotFoundException('Sewa tidak ditemukan');
    // Operator hanya boleh input untuk sewa milik PENYEWA induknya.
    if (rental.penyewaId !== user.parentId) {
      throw new ForbiddenException('Bukan sewa milik penyewa Anda');
    }
    if (rental.machine.status !== asMachineStatus(MachineStatus.AKTIF)) {
      throw new ConflictException('Mesin belum AKTIF di sewa ini');
    }

    const { targetOutput, efficiency, flaggedMachineIssue } = computeBatchMetrics(
      {
        materialInputKg: dto.materialInputKg,
        standardRatio: rental.machine.standardRatio,
        targetOutput: dto.targetOutput,
        actualOutput: dto.actualOutput,
        causeCategory: dto.causeCategory ?? null,
      },
      EFFICIENCY_THRESHOLD,
    );

    // Batch di-flag butuh persetujuan ADMIN dulu; yang bersih langsung APPROVED (masuk laporan).
    const reviewStatus = flaggedMachineIssue ? ReviewStatus.PENDING : ReviewStatus.APPROVED;

    const batch = await this.prisma.productionBatch.create({
      data: {
        rentalId: rental.id,
        machineId: rental.machineId,
        operatorId: user.id,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        materialInputKg: dto.materialInputKg,
        targetOutput,
        actualOutput: dto.actualOutput,
        rejectCount: dto.rejectCount,
        causeCategory: dto.causeCategory
          ? (dto.causeCategory as unknown as $Enums.CauseCategory)
          : null,
        efficiency,
        flaggedMachineIssue,
        reviewStatus: asReviewStatus(reviewStatus),
      },
    });
    return toBatch(batch);
  }

  async findAll(user: PrismaUser, filters: BatchFilters): Promise<ProductionBatch[]> {
    const batches = await this.prisma.productionBatch.findMany({
      where: {
        ...this.scopeFor(user),
        rentalId: filters.rentalId,
        machineId: filters.machineId,
        operatorId: filters.operatorId,
        flaggedMachineIssue: filters.flagged,
      },
      orderBy: { createdAt: 'desc' },
    });
    return batches.map(toBatch);
  }

  async findOne(user: PrismaUser, id: string): Promise<ProductionBatch> {
    const batch = await this.prisma.productionBatch.findFirst({
      where: { id, ...this.scopeFor(user) },
    });
    if (!batch) throw new NotFoundException('Batch tidak ditemukan');
    return toBatch(batch);
  }

  // ADMIN menyetujui/menolak batch yang di-flag sebelum masuk laporan resmi.
  async review(id: string, dto: ReviewBatchDto): Promise<ProductionBatch> {
    const batch = await this.prisma.productionBatch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException('Batch tidak ditemukan');
    if (batch.reviewStatus !== asReviewStatus(ReviewStatus.PENDING)) {
      throw new ConflictException('Batch tidak menunggu review');
    }
    const updated = await this.prisma.productionBatch.update({
      where: { id },
      data: { reviewStatus: asReviewStatus(dto.reviewStatus) },
    });
    return toBatch(updated);
  }

  // Rekap hanya menghitung batch APPROVED: yang PENDING/REJECTED tidak masuk laporan resmi.
  async efficiencyByOperator(
    user: PrismaUser,
    filters: Pick<BatchFilters, 'rentalId' | 'machineId'>,
  ): Promise<OperatorEfficiency[]> {
    const batches = await this.prisma.productionBatch.findMany({
      where: {
        ...this.scopeFor(user),
        reviewStatus: asReviewStatus(ReviewStatus.APPROVED),
        rentalId: filters.rentalId,
        machineId: filters.machineId,
      },
      include: { operator: { select: { nama: true } } },
    });

    // ponytail: agregasi di aplikasi cukup untuk volume awal; pindah ke groupBy SQL kalau membesar.
    const acc = new Map<string, { nama: string; sum: number; count: number }>();
    for (const b of batches) {
      const e = acc.get(b.operatorId) ?? { nama: b.operator.nama, sum: 0, count: 0 };
      e.sum += b.efficiency;
      e.count += 1;
      acc.set(b.operatorId, e);
    }
    return [...acc].map(([operatorId, e]) => ({
      operatorId,
      nama: e.nama,
      avgEfficiency: e.sum / e.count,
      batchCount: e.count,
    }));
  }

  async efficiencyByMachine(user: PrismaUser): Promise<MachineEfficiency[]> {
    const batches = await this.prisma.productionBatch.findMany({
      where: { ...this.scopeFor(user), reviewStatus: asReviewStatus(ReviewStatus.APPROVED) },
      include: { machine: { select: { machineNumber: true } } },
    });

    const acc = new Map<
      string,
      { machineNumber: string; sum: number; count: number; rejects: number; output: number }
    >();
    for (const b of batches) {
      const e =
        acc.get(b.machineId) ??
        { machineNumber: b.machine.machineNumber, sum: 0, count: 0, rejects: 0, output: 0 };
      e.sum += b.efficiency;
      e.count += 1;
      e.rejects += b.rejectCount;
      e.output += b.actualOutput;
      acc.set(b.machineId, e);
    }
    return [...acc].map(([machineId, e]) => ({
      machineId,
      machineNumber: e.machineNumber,
      avgEfficiency: e.sum / e.count,
      batchCount: e.count,
      // rejectRate: reject sebagai persen dari total unit (output + reject).
      rejectRate: e.rejects + e.output === 0 ? 0 : (e.rejects / (e.rejects + e.output)) * 100,
    }));
  }

  // Penyaringan kepemilikan per role, dipakai semua query batch.
  private scopeFor(user: PrismaUser): Prisma.ProductionBatchWhereInput {
    switch (user.role) {
      case Role.ADMIN:
        return {};
      case Role.PENYEDIA:
        return { machine: { ownerId: user.id } };
      case Role.PENYEWA:
        return { rental: { penyewaId: user.id } };
      default: // OPERATOR
        return { operatorId: user.id };
    }
  }
}

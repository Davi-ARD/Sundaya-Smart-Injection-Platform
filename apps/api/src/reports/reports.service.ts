import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { $Enums, Prisma, User as PrismaUser } from '@prisma/client';
import {
  AdminDashboard,
  MachineStatus,
  MachineStatusCount,
  PenyediaDashboard,
  PenyewaDashboard,
  ProductionBatch,
  RentalStatus,
  ReviewStatus,
  Role,
  WarrantyStatus,
} from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toMachine } from '../machines/machine.mapper';
import { toBatch } from '../production/batch.mapper';
import { buildCsv } from './csv';

const asRentalStatus = (s: RentalStatus) => s as unknown as $Enums.RentalStatus;
const asReviewStatus = (s: ReviewStatus) => s as unknown as $Enums.ReviewStatus;

const DAY_MS = 24 * 60 * 60 * 1000;

interface IssueFilters {
  rentalId?: string;
  machineId?: string;
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async penyediaDashboard(user: PrismaUser): Promise<PenyediaDashboard> {
    const ownerId = user.id;
    const [machineStatusCounts, machineUtilization, recurringIssueMachines, warrantySummary] =
      await Promise.all([
        this.machineStatusCounts({ ownerId }),
        this.utilization(ownerId),
        this.recurringIssueMachines(ownerId),
        this.warrantySummary(ownerId),
      ]);
    return { machineStatusCounts, machineUtilization, recurringIssueMachines, warrantySummary };
  }

  async penyewaDashboard(user: PrismaUser): Promise<PenyewaDashboard> {
    const penyewaId = user.id;
    const approved = asReviewStatus(ReviewStatus.APPROVED);

    const [activeRentalsRaw, batchesRaw, rejectAgg, issueBatches] = await Promise.all([
      this.prisma.rental.findMany({
        where: { penyewaId, status: asRentalStatus(RentalStatus.AKTIF) },
        include: { machine: { select: { machineNumber: true } } },
      }),
      this.prisma.productionBatch.findMany({
        where: { rental: { penyewaId }, reviewStatus: approved },
        include: { machine: { select: { machineNumber: true } } },
        orderBy: { startAt: 'asc' },
      }),
      this.prisma.productionBatch.aggregate({
        where: { rental: { penyewaId }, reviewStatus: approved },
        _sum: { rejectCount: true, actualOutput: true },
      }),
      this.prisma.productionBatch.findMany({
        where: { rental: { penyewaId }, flaggedMachineIssue: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const now = Date.now();
    const rejects = rejectAgg._sum.rejectCount ?? 0;
    const output = rejectAgg._sum.actualOutput ?? 0;

    return {
      activeRentals: activeRentalsRaw.map((r) => ({
        rentalId: r.id,
        machineNumber: r.machine.machineNumber,
        remainingDays: r.endDate ? Math.max(0, Math.ceil((r.endDate.getTime() - now) / DAY_MS)) : 0,
      })),
      efficiencyByBatch: batchesRaw.map((b) => ({
        batchId: b.id,
        machineNumber: b.machine.machineNumber,
        date: b.startAt.toISOString(),
        efficiency: b.efficiency,
      })),
      rejectRate: rejects + output === 0 ? 0 : (rejects / (rejects + output)) * 100,
      machineIssueBatches: issueBatches.map(toBatch),
    };
  }

  async adminDashboard(): Promise<AdminDashboard> {
    const [totalUsers, totalMachines, machineStatusCounts, totalActiveRentals, flaggedPendingReview] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.machine.count(),
        this.machineStatusCounts({}),
        this.prisma.rental.count({ where: { status: asRentalStatus(RentalStatus.AKTIF) } }),
        this.prisma.productionBatch.count({
          where: { flaggedMachineIssue: true, reviewStatus: asReviewStatus(ReviewStatus.PENDING) },
        }),
      ]);
    return {
      totalUsers,
      totalMachines,
      machineStatusCounts,
      totalActiveRentals,
      flaggedPendingReview,
    };
  }

  // Batch masalah mesin yang sudah APPROVED (masuk laporan resmi). PENYEWA hanya miliknya.
  async machineIssues(user: PrismaUser, filters: IssueFilters): Promise<ProductionBatch[]> {
    const scope = user.role === Role.ADMIN ? {} : { rental: { penyewaId: user.id } };
    const batches = await this.prisma.productionBatch.findMany({
      where: {
        ...scope,
        flaggedMachineIssue: true,
        reviewStatus: asReviewStatus(ReviewStatus.APPROVED),
        rentalId: filters.rentalId,
        machineId: filters.machineId,
      },
      orderBy: { createdAt: 'desc' },
    });
    return batches.map(toBatch);
  }

  toCsv(batches: ProductionBatch[]): string {
    const headers = [
      'id',
      'rentalId',
      'machineId',
      'operatorId',
      'startAt',
      'endAt',
      'efficiency',
      'rejectCount',
      'causeCategory',
      'reviewStatus',
    ];
    const rows = batches.map((b) => [
      b.id,
      b.rentalId,
      b.machineId,
      b.operatorId,
      b.startAt,
      b.endAt,
      b.efficiency,
      b.rejectCount,
      b.causeCategory ?? '',
      b.reviewStatus,
    ]);
    return buildCsv(headers, rows);
  }

  // ponytail: satu dependensi ringan (pdfkit), bukan generator PDF buatan sendiri.
  // Laporan kecil, jadi kumpulkan ke Buffer lalu StreamableFile yang mengirim.
  pdfBuffer(batches: ProductionBatch[]): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    doc.fontSize(16).text('Laporan Batch Berindikasi Masalah Mesin');
    doc.moveDown().fontSize(10);
    if (batches.length === 0) doc.text('Tidak ada data.');
    for (const b of batches) {
      doc.text(
        `${b.startAt.slice(0, 10)}  mesin=${b.machineId}  operator=${b.operatorId}  ` +
          `eff=${b.efficiency.toFixed(1)}%  reject=${b.rejectCount}  ${b.causeCategory ?? '-'}`,
      );
    }
    doc.end();
    return done;
  }

  private async machineStatusCounts(
    where: Prisma.MachineWhereInput,
  ): Promise<MachineStatusCount[]> {
    const grouped = await this.prisma.machine.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    return grouped.map((g) => ({
      status: g.status as unknown as MachineStatus,
      count: g._count._all,
    }));
  }

  // Utilisasi: DB menjumlah hari tersewa (receivedAt s.d. returnedAt/now) per mesin.
  private async utilization(ownerId: string) {
    const rows = await this.prisma.$queryRaw<
      { machineId: string; machineNumber: string; daysRented: number; daysSinceCreated: number }[]
    >`
      SELECT m.id AS "machineId", m."machineNumber",
        COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(r."returnedAt", NOW()) - r."receivedAt")) / 86400), 0)::float AS "daysRented",
        (EXTRACT(EPOCH FROM (NOW() - m."createdAt")) / 86400)::float AS "daysSinceCreated"
      FROM "Machine" m
      LEFT JOIN "Rental" r ON r."machineId" = m.id AND r."receivedAt" IS NOT NULL
      WHERE m."ownerId" = ${ownerId}
      GROUP BY m.id, m."machineNumber", m."createdAt"
    `;
    return rows.map((r) => {
      const daysRented = Math.round(r.daysRented);
      return {
        machineId: r.machineId,
        machineNumber: r.machineNumber,
        daysRented,
        daysIdle: Math.max(0, Math.round(r.daysSinceCreated) - daysRented),
      };
    });
  }

  // Mesin dengan masalah mesin berulang: >=2 batch flagged + APPROVED.
  private async recurringIssueMachines(ownerId: string) {
    const grouped = await this.prisma.productionBatch.groupBy({
      by: ['machineId'],
      where: {
        flaggedMachineIssue: true,
        reviewStatus: asReviewStatus(ReviewStatus.APPROVED),
        machine: { ownerId },
      },
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    });
    const ids = grouped.map((g) => g.machineId);
    if (ids.length === 0) return [];
    const machines = await this.prisma.machine.findMany({
      where: { id: { in: ids } },
      include: { owner: { select: { nama: true } } },
    });
    return machines.map((m) => toMachine(m, m.owner.nama));
  }

  private async warrantySummary(ownerId: string) {
    const machines = await this.prisma.machine.findMany({
      where: { ownerId },
      select: { id: true, machineNumber: true, warrantyStatus: true, warrantyEnd: true },
    });
    return machines.map((m) => ({
      machineId: m.id,
      machineNumber: m.machineNumber,
      warrantyStatus: m.warrantyStatus as unknown as WarrantyStatus,
      warrantyEnd: m.warrantyEnd.toISOString(),
    }));
  }
}

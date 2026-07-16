import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { $Enums, Prisma, User as PrismaUser } from '@prisma/client';
import {
  AdminDashboard,
  CauseCategory,
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

interface IssueFilters {
  rentalId?: string;
  machineId?: string;
}

// Baris laporan yang sudah "human-readable": ID mentah diganti nomor mesin/nama orang,
// dipakai khusus untuk export CSV/PDF (data pendukung klaim garansi ke penyedia/pabrikan).
interface IssueReportRow {
  batchId: string;
  date: Date;
  machineNumber: string;
  operatorNama: string;
  penyewaNama: string;
  destinationLocation: string;
  materialInputKg: number;
  targetOutput: number;
  actualOutput: number;
  rejectCount: number;
  rejectRate: number;
  efficiency: number;
  causeCategory: CauseCategory | null;
  reviewStatus: ReviewStatus;
}

const causeCategoryLabel: Record<CauseCategory, string> = {
  [CauseCategory.SETTING_OPERATOR]: 'Setting Operator',
  [CauseCategory.KUALITAS_MATERIAL]: 'Kualitas Material',
  [CauseCategory.KONDISI_MESIN]: 'Kondisi Mesin/Mold',
  [CauseCategory.LAIN]: 'Faktor Lain',
};

const reviewStatusLabel: Record<ReviewStatus, string> = {
  [ReviewStatus.PENDING]: 'Menunggu Review',
  [ReviewStatus.APPROVED]: 'Disetujui',
  [ReviewStatus.REJECTED]: 'Ditolak',
};

const formatDateTime = (d: Date) =>
  d.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

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

    const rejects = rejectAgg._sum.rejectCount ?? 0;
    const output = rejectAgg._sum.actualOutput ?? 0;

    return {
      // endDate mentah dikirim, bukan remainingDays terhitung server — frontend menampilkan
      // lewat CountdownTimer yang sama dipakai di Status Sewa (live, jam-menit, tidak dibulatkan).
      activeRentals: activeRentalsRaw.map((r) => ({
        rentalId: r.id,
        machineNumber: r.machine.machineNumber,
        endDate: (r.endDate ?? r.createdAt).toISOString(),
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

  // Sama seperti machineIssues(), tapi dengan relasi mesin/operator/penyewa di-include
  // dan field turunan (reject %) dihitung — khusus dipakai untuk export CSV/PDF supaya
  // isinya nama yang bisa dibaca, bukan ID mentah.
  private async machineIssuesDetailed(
    user: PrismaUser,
    filters: IssueFilters,
  ): Promise<IssueReportRow[]> {
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
      include: {
        machine: { select: { machineNumber: true } },
        operator: { select: { nama: true } },
        rental: { select: { destinationLocation: true, penyewa: { select: { nama: true } } } },
      },
    });
    return batches.map((b) => ({
      batchId: b.id,
      date: b.startAt,
      machineNumber: b.machine.machineNumber,
      operatorNama: b.operator.nama,
      penyewaNama: b.rental.penyewa.nama,
      destinationLocation: b.rental.destinationLocation,
      materialInputKg: b.materialInputKg,
      targetOutput: b.targetOutput,
      actualOutput: b.actualOutput,
      rejectCount: b.rejectCount,
      rejectRate:
        b.actualOutput + b.rejectCount > 0
          ? (b.rejectCount / (b.actualOutput + b.rejectCount)) * 100
          : 0,
      efficiency: b.efficiency,
      causeCategory: b.causeCategory as unknown as CauseCategory | null,
      reviewStatus: b.reviewStatus as unknown as ReviewStatus,
    }));
  }

  async exportMachineIssues(
    user: PrismaUser,
    filters: IssueFilters,
    format: 'csv' | 'pdf',
  ): Promise<{ buffer: Buffer | string; contentType: string; filename: string }> {
    const rows = await this.machineIssuesDetailed(user, filters);
    if (format === 'pdf') {
      return {
        buffer: await this.pdfBuffer(rows),
        contentType: 'application/pdf',
        filename: 'laporan-masalah-mesin.pdf',
      };
    }
    return {
      buffer: this.toCsv(rows),
      contentType: 'text/csv',
      filename: 'laporan-masalah-mesin.csv',
    };
  }

  private toCsv(rows: IssueReportRow[]): string {
    const headers = [
      'Tanggal',
      'Mesin',
      'Operator',
      'Penyewa',
      'Lokasi',
      'Material Input (kg)',
      'Target Output',
      'Output Aktual',
      'Jumlah Reject',
      'Reject (%)',
      'Efisiensi (%)',
      'Penyebab',
      'Status Review',
    ];
    const csvRows = rows.map((r) => [
      formatDateTime(r.date),
      r.machineNumber,
      r.operatorNama,
      r.penyewaNama,
      r.destinationLocation,
      r.materialInputKg,
      r.targetOutput,
      r.actualOutput,
      r.rejectCount,
      r.rejectRate.toFixed(1),
      r.efficiency.toFixed(1),
      r.causeCategory ? causeCategoryLabel[r.causeCategory] : '-',
      reviewStatusLabel[r.reviewStatus],
    ]);
    return buildCsv(headers, csvRows);
  }

  // ponytail: satu dependensi ringan (pdfkit), bukan generator PDF buatan sendiri.
  // Landscape A4 supaya kolom tabel muat tanpa terpotong. Laporan kecil, jadi
  // kumpulkan ke Buffer lalu StreamableFile yang mengirim.
  private pdfBuffer(rows: IssueReportRow[]): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    const pageBottom = doc.page.height - doc.page.margins.bottom;
    const columns: { key: keyof IssueReportRow; label: string; x: number; width: number; align?: 'left' | 'right' }[] =
      [
        { key: 'date', label: 'Tanggal', x: 40, width: 75 },
        { key: 'machineNumber', label: 'Mesin', x: 115, width: 55 },
        { key: 'operatorNama', label: 'Operator', x: 170, width: 90 },
        { key: 'penyewaNama', label: 'Penyewa', x: 260, width: 90 },
        { key: 'destinationLocation', label: 'Lokasi', x: 350, width: 100 },
        { key: 'materialInputKg', label: 'Material (kg)', x: 450, width: 55, align: 'right' },
        { key: 'targetOutput', label: 'Target', x: 505, width: 50, align: 'right' },
        { key: 'actualOutput', label: 'Aktual', x: 555, width: 50, align: 'right' },
        { key: 'rejectRate', label: 'Reject %', x: 605, width: 50, align: 'right' },
        { key: 'efficiency', label: 'Efisiensi %', x: 655, width: 55, align: 'right' },
        { key: 'causeCategory', label: 'Penyebab', x: 710, width: 92 },
      ];

    const cellText = (row: IssueReportRow, key: (typeof columns)[number]['key']): string => {
      switch (key) {
        case 'date':
          return formatDateTime(row.date);
        case 'materialInputKg':
          return row.materialInputKg.toFixed(1);
        case 'targetOutput':
          return row.targetOutput.toFixed(1);
        case 'actualOutput':
          return row.actualOutput.toFixed(1);
        case 'rejectRate':
          return row.rejectRate.toFixed(1);
        case 'efficiency':
          return row.efficiency.toFixed(1);
        case 'causeCategory':
          return row.causeCategory ? causeCategoryLabel[row.causeCategory] : '-';
        default:
          return String(row[key as keyof IssueReportRow] ?? '');
      }
    };

    const drawHeader = (y: number) => {
      doc.font('Helvetica-Bold').fontSize(9);
      for (const col of columns) {
        doc.text(col.label, col.x, y, { width: col.width, align: col.align ?? 'left' });
      }
      doc
        .moveTo(40, y + 14)
        .lineTo(doc.page.width - doc.page.margins.right, y + 14)
        .strokeColor('#cbd5e1')
        .stroke();
      doc.font('Helvetica').fontSize(9);
      return y + 20;
    };

    doc.font('Helvetica-Bold').fontSize(16).text('Laporan Data Pendukung Klaim Garansi');
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#64748b')
      .text('Rekap batch produksi yang disetujui dan ditandai berindikasi masalah mesin.')
      .text(`Dicetak: ${formatDateTime(new Date())}`)
      .fillColor('#000000');
    doc.moveDown(0.5);

    if (rows.length > 0) {
      const avgEfficiency = rows.reduce((sum, r) => sum + r.efficiency, 0) / rows.length;
      const totalReject = rows.reduce((sum, r) => sum + r.rejectCount, 0);
      doc
        .fontSize(9)
        .text(
          `Total batch: ${rows.length}   |   Rata-rata efisiensi: ${avgEfficiency.toFixed(1)}%   |   Total reject: ${totalReject}`,
        );
    }
    doc.moveDown(0.75);

    if (rows.length === 0) {
      doc.text('Tidak ada data.');
      doc.end();
      return done;
    }

    let y = drawHeader(doc.y);
    for (const row of rows) {
      if (y + 16 > pageBottom) {
        doc.addPage();
        y = drawHeader(doc.page.margins.top);
      }
      for (const col of columns) {
        doc.text(cellText(row, col.key), col.x, y, { width: col.width, align: col.align ?? 'left' });
      }
      y += 16;
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

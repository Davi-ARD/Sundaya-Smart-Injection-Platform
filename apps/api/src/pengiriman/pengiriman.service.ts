import { Injectable } from '@nestjs/common';
import { Prisma, User as PrismaUser } from '@prisma/client';
import { DeliveryRow, MoldTrackingStatus, Role } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { computeDelivery } from './delivery';

const STAF_SUNDAYA: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA];

// Mold sudah dikirim tapi belum diterima.
const IN_TRANSIT: MoldTrackingStatus[] = [
  MoldTrackingStatus.READY_DELIVERY,
  MoldTrackingStatus.DELIVERY,
];

const jobWithSources = {
  include: {
    mold: {
      select: {
        kodeMold: true,
        namaProduk: true,
        trackingStatus: true,
        trackingEvents: {
          where: { status: 'RECEIVED' as const },
          orderBy: { at: 'asc' as const },
          take: 1,
        },
      },
    },
    logProduksi: {
      where: { eventType: 'MATERIAL_DATANG' as const },
      orderBy: { occurredAt: 'asc' as const },
      take: 1,
    },
  },
} as const;

type JobWithSources = Prisma.JobGetPayload<typeof jobWithSources>;

@Injectable()
export class PengirimanService {
  constructor(private prisma: PrismaService) {}

  // Log Pengiriman: turunan read-only. Rencana dari Job, aktual dari Layer 2
  // (LogProduksi MATERIAL_DATANG) dan Mold Tracking (event RECEIVED). Tanpa tabel.
  // Scoping tenant: Manager lihat miliknya; staf Sundaya semua (opsional filter
  // managerId). Hanya job yang punya rencana/plan yang memunculkan baris.
  async list(user: PrismaUser, managerId?: string, now: Date = new Date()): Promise<DeliveryRow[]> {
    const scope: Prisma.JobWhereInput = STAF_SUNDAYA.includes(user.role as Role)
      ? managerId
        ? { managerId }
        : {}
      : { managerId: user.id };

    const jobs = await this.prisma.job.findMany({
      where: {
        ...scope,
        OR: [{ rencanaKirimMold: { not: null } }, { planMaterialUtama: { not: null } }],
      },
      orderBy: { createdAt: 'desc' },
      ...jobWithSources,
    });

    return jobs.flatMap((job) => this.rowsForJob(job, now));
  }

  private rowsForJob(job: JobWithSources, now: Date): DeliveryRow[] {
    const rencana = job.rencanaKirimMold;
    const sumberRencana = `Booking ${job.jobNumber}`;
    const rows: DeliveryRow[] = [];

    // Baris mold: aktual = event RECEIVED; DIKIRIM bila mold masih dalam perjalanan.
    const receivedAt = job.mold.trackingEvents[0]?.at ?? null;
    const inTransit = IN_TRANSIT.includes(job.mold.trackingStatus as unknown as MoldTrackingStatus);
    const mold = computeDelivery(rencana, receivedAt, now, inTransit);
    rows.push({
      jobId: job.id,
      jobNumber: job.jobNumber,
      item: `Mold ${job.mold.kodeMold} (${job.mold.namaProduk})`,
      sumberRencana,
      rencanaTiba: rencana?.toISOString() ?? null,
      aktualTiba: receivedAt?.toISOString() ?? null,
      selisihHari: mold.selisihHari,
      status: mold.status,
    });

    // Baris material: hanya bila ada plan material atau event material datang.
    const materialAt = job.logProduksi[0]?.occurredAt ?? null;
    if (job.planMaterialUtama || materialAt) {
      const material = computeDelivery(rencana, materialAt, now);
      rows.push({
        jobId: job.id,
        jobNumber: job.jobNumber,
        item: `Material ${job.planMaterialUtama ?? job.logProduksi[0]?.materialName ?? ''}`.trim(),
        sumberRencana,
        rencanaTiba: rencana?.toISOString() ?? null,
        aktualTiba: materialAt?.toISOString() ?? null,
        selisihHari: material.selisihHari,
        status: material.status,
      });
    }

    return rows;
  }
}

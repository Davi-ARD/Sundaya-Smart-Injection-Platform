import {
  JobLifecycle,
  LogProduksiEventType,
  MoldTrackingStatus,
  ProgressMolding,
  Role,
} from '@mold-tracker/shared';
import { User as PrismaUser } from '@prisma/client';
import { DashboardPenyewaService } from './dashboard-penyewa.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY_MS);

function prismaMock() {
  return {
    mold: { count: jest.fn(), findMany: jest.fn() },
    job: { count: jest.fn(), findMany: jest.fn() },
    logProduksi: { aggregate: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
  };
}

const manager = { id: 'mgr-1', role: Role.MANAGER_PENYEWA } as unknown as PrismaUser;
const adminPenyewa = { id: 'ap-1', role: Role.ADMIN_PENYEWA, parentId: 'mgr-1' } as unknown as PrismaUser;

function svc(prisma: ReturnType<typeof prismaMock>) {
  return new DashboardPenyewaService(prisma as unknown as PrismaService);
}

describe('DashboardPenyewaService.manager', () => {
  it('agregasi mold di Sundaya, job berjalan, produk baik, dan avgAchievement', async () => {
    const prisma = prismaMock();
    prisma.mold.count.mockResolvedValue(3);
    prisma.job.count.mockResolvedValue(2);
    prisma.logProduksi.aggregate.mockResolvedValue({ _sum: { goodProduct: 900 } });
    prisma.job.findMany.mockResolvedValue([
      { id: 'j1', targetOutput: 1000 },
      { id: 'j2', targetOutput: 500 },
    ]);
    prisma.logProduksi.groupBy.mockResolvedValue([
      { jobId: 'j1', _sum: { goodProduct: 500 } }, // 50%
      { jobId: 'j2', _sum: { goodProduct: 500 } }, // 100%
    ]);

    const result = await svc(prisma).manager(manager);

    expect(result.moldsAtSundaya).toBe(3);
    expect(result.ongoing).toBe(2);
    expect(result.totalGoodProduct).toBe(900);
    expect(result.avgAchievement).toBe(75); // (50 + 100) / 2
  });

  it('mold di Sundaya hanya menghitung status RECEIVED dan PRODUCTION', async () => {
    const prisma = prismaMock();
    prisma.mold.count.mockResolvedValue(1);
    prisma.job.count.mockResolvedValue(0);
    prisma.logProduksi.aggregate.mockResolvedValue({ _sum: { goodProduct: null } });
    prisma.job.findMany.mockResolvedValue([]);

    await svc(prisma).manager(manager);

    const where = prisma.mold.count.mock.calls[0][0].where;
    expect(where.trackingStatus.in).toEqual([
      MoldTrackingStatus.RECEIVED,
      MoldTrackingStatus.PRODUCTION,
    ]);
    expect(where.managerId).toBe('mgr-1');
  });

  it('tanpa target -> avgAchievement 0', async () => {
    const prisma = prismaMock();
    prisma.mold.count.mockResolvedValue(0);
    prisma.job.count.mockResolvedValue(0);
    prisma.logProduksi.aggregate.mockResolvedValue({ _sum: { goodProduct: null } });
    prisma.job.findMany.mockResolvedValue([]);

    const result = await svc(prisma).manager(manager);
    expect(result.totalGoodProduct).toBe(0);
    expect(result.avgAchievement).toBe(0);
  });
});

const produksi = (occurredAt: Date, extra: Record<string, unknown>) => ({
  eventType: LogProduksiEventType.PRODUKSI_HARIAN,
  occurredAt,
  goodProduct: null,
  rejectCount: null,
  jumlahKg: null,
  materialRemainingKg: null,
  progressMolding: null,
  ...extra,
});

describe('DashboardPenyewaService.job', () => {
  it('scope parentId + reduksi log per job aktif', async () => {
    const prisma = prismaMock();
    prisma.job.findMany.mockResolvedValue([
      {
        id: 'j1',
        jobNumber: 'SSIP-0001',
        lifecycle: JobLifecycle.AKTIF,
        targetOutput: 300,
        endDate: inDays(4),
        machine: { machineNumber: 'IM-03' },
        mold: { kodeMold: 'MD-112', namaProduk: 'Housing cover', cavity: 4 },
        logProduksi: [
          produksi(new Date('2026-08-12'), {
            goodProduct: 100,
            rejectCount: 5,
            materialRemainingKg: 20,
            progressMolding: ProgressMolding.ONGOING,
          }),
          produksi(new Date('2026-08-11'), { goodProduct: 50, rejectCount: 2 }),
        ],
      },
    ]);

    const result = await svc(prisma).job(adminPenyewa);

    expect(prisma.job.findMany.mock.calls[0][0].where.managerId).toBe('mgr-1');
    expect(result).toHaveLength(1);
    expect(result[0].totalGoodProduct).toBe(150);
    expect(result[0].totalReject).toBe(7);
    expect(result[0].progressMolding).toBe(ProgressMolding.ONGOING);
    expect(result[0].materialRemainingKg).toBe(20); // terbaru yang tidak null
    expect(result[0].machineNumber).toBe('IM-03');
    expect(result[0].moldKode).toBe('MD-112'); // cetakan yang dipakai job
    expect(result[0].moldCavity).toBe(4);
    expect(result[0].achievement).toBe(50); // 150 dari target 300
    expect(result[0].sisaHariSewa).toBe(4);
    expect(result[0].latestLogAt).toBe(new Date('2026-08-12').toISOString());
  });
});

describe('DashboardPenyewaService.jobLogs', () => {
  it('log semua job tenant induk dalam satu timeline', async () => {
    const prisma = prismaMock();
    prisma.logProduksi.findMany.mockResolvedValue([
      {
        id: 'l1',
        jobId: 'j1',
        eventType: LogProduksiEventType.MATERIAL_DATANG,
        occurredAt: new Date('2026-08-12T09:30:00Z'),
        createdAt: new Date('2026-08-12T09:31:00Z'),
        progressMolding: null,
        job: { jobNumber: 'SSIP-0001', mold: { kodeMold: 'MD-112' } },
      },
    ]);

    const result = await svc(prisma).jobLogs(adminPenyewa);

    expect(prisma.logProduksi.findMany.mock.calls[0][0].where.job.managerId).toBe('mgr-1');
    expect(result[0].jobNumber).toBe('SSIP-0001');
    expect(result[0].moldKode).toBe('MD-112');
    expect(result[0].occurredAt).toBe(new Date('2026-08-12T09:30:00Z').toISOString());
    expect(result[0]).not.toHaveProperty('job');
  });
});

describe('DashboardPenyewaService.moldPlan', () => {
  it('menggabung tracking, job, capaian produksi, dan realisasi material', async () => {
    const prisma = prismaMock();
    prisma.mold.findMany.mockResolvedValue([
      {
        id: 'md-1',
        kodeMold: 'MD-112',
        namaProduk: 'Housing cover',
        cavity: 4,
        tonaseTon: 150,
        trackingStatus: MoldTrackingStatus.PRODUCTION,
        planMaterialUtama: 'ABS Resin',
        estimasiKg: 800,
        targetOutput: 1000,
        job: {
          id: 'j1',
          jobNumber: 'SSIP-0231',
          lifecycle: JobLifecycle.AKTIF,
          targetOutput: 1000,
          estimasiMaterialKg: 1000,
          planMaterialUtama: 'ABS Resin',
          materialTambahan: null,
          rencanaKirimMold: null,
          endDate: inDays(4),
          machine: { machineNumber: 'IM-03' },
          logProduksi: [
            produksi(new Date('2026-08-12'), {
              goodProduct: 400,
              rejectCount: 10,
              materialRemainingKg: 420,
              progressMolding: ProgressMolding.ONGOING,
            }),
            produksi(new Date('2026-08-11'), { goodProduct: 200, rejectCount: 5 }),
            {
              eventType: LogProduksiEventType.MATERIAL_DATANG,
              occurredAt: new Date('2026-08-10'),
              goodProduct: null,
              rejectCount: null,
              jumlahKg: 1000,
              materialRemainingKg: null,
              progressMolding: null,
            },
          ],
        },
      },
      // Cetakan yang belum dibooking: tanpa job, angka produksi nol.
      {
        id: 'md-2',
        kodeMold: 'MD-220',
        namaProduk: 'Bracket motor',
        cavity: 2,
        tonaseTon: 150,
        trackingStatus: MoldTrackingStatus.PLANNING,
        planMaterialUtama: null,
        estimasiKg: null,
        targetOutput: null,
        job: null,
      },
    ]);

    const [aktif, planning] = await svc(prisma).moldPlan(manager);

    expect(prisma.mold.findMany.mock.calls[0][0].where.managerId).toBe('mgr-1');
    expect(aktif.jobNumber).toBe('SSIP-0231');
    expect(aktif.machineNumber).toBe('IM-03');
    expect(aktif.totalGoodProduct).toBe(600);
    expect(aktif.achievement).toBe(60);
    expect(aktif.rejectRate).toBe(2.4); // 15 dari 615
    expect(aktif.materialDatangKg).toBe(1000);
    expect(aktif.materialTerpakaiKg).toBe(580); // 1000 datang - 420 sisa
    expect(aktif.sisaHariSewa).toBe(4);
    expect(aktif.etaHari).toBe(2); // sisa 400 pada laju 300/hari (2 hari produksi)

    expect(planning.jobNumber).toBeNull();
    expect(planning.totalGoodProduct).toBe(0);
    expect(planning.achievement).toBe(0);
    expect(planning.etaHari).toBeNull();
  });
});

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
const adminPenyewa = {
  id: 'ap-1',
  role: Role.ADMIN_PENYEWA,
  parentId: 'mgr-1',
} as unknown as PrismaUser;

function svc(prisma: ReturnType<typeof prismaMock>) {
  return new DashboardPenyewaService(prisma as unknown as PrismaService);
}

// Event produksi harian. materialUsedKg = material yang dipakai hari itu; plan
// cetakan berlaku sebagai kuota, jadi pemakaian diakumulasi bukan diambil terakhir.
const produksi = (occurredAt: Date, extra: Record<string, unknown> = {}) => ({
  eventType: LogProduksiEventType.PRODUKSI_HARIAN,
  occurredAt,
  goodProduct: null,
  rejectCount: null,
  materialUsedKg: null,
  progressMolding: null,
  catatan: null,
  ...extra,
});

describe('DashboardPenyewaService.manager', () => {
  it('agregasi mold di Sundaya, job berjalan, produk baik, dan avgAchievement per cetakan', async () => {
    const prisma = prismaMock();
    prisma.mold.count.mockResolvedValue(3);
    prisma.job.count.mockResolvedValue(2);
    prisma.logProduksi.aggregate.mockResolvedValue({ _sum: { goodProduct: 900 } });
    // Target output kini di Mold, bukan Job.
    prisma.mold.findMany.mockResolvedValue([
      { id: 'md-1', targetOutput: 1000 },
      { id: 'md-2', targetOutput: 500 },
    ]);
    prisma.logProduksi.groupBy.mockResolvedValue([
      { moldId: 'md-1', _sum: { goodProduct: 500 } }, // 50%
      { moldId: 'md-2', _sum: { goodProduct: 500 } }, // 100%
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
    prisma.mold.findMany.mockResolvedValue([]);

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
    prisma.mold.findMany.mockResolvedValue([]);

    const result = await svc(prisma).manager(manager);
    expect(result.totalGoodProduct).toBe(0);
    expect(result.avgAchievement).toBe(0);
  });
});

describe('DashboardPenyewaService.job', () => {
  it('satu baris per cetakan pada booking aktif, log diringkas per cetakan', async () => {
    const prisma = prismaMock();
    prisma.job.findMany.mockResolvedValue([
      {
        id: 'j1',
        jobNumber: 'SSIP-0001',
        lifecycle: JobLifecycle.AKTIF,
        endDate: inDays(4),
        machines: [{ machineNumber: 'IM-03' }],
        molds: [
          {
            id: 'md-1',
            kodeMold: 'MD-112',
            namaProduk: 'Housing cover',
            cavity: 4,
            targetOutput: 300,
            estimasiKg: 500,
            planMaterialUtama: 'ABS Resin',
            logProduksi: [
              produksi(new Date('2026-08-12'), {
                goodProduct: 100,
                rejectCount: 5,
                materialUsedKg: 180,
                progressMolding: ProgressMolding.ONGOING,
              }),
              produksi(new Date('2026-08-11'), {
                goodProduct: 50,
                rejectCount: 2,
                materialUsedKg: 100,
              }),
            ],
          },
        ],
      },
    ]);

    const result = await svc(prisma).job(adminPenyewa);

    expect(prisma.job.findMany.mock.calls[0][0].where.managerId).toBe('mgr-1');
    expect(result).toHaveLength(1);
    expect(result[0].totalGoodProduct).toBe(150);
    expect(result[0].totalReject).toBe(7);
    expect(result[0].progressMolding).toBe(ProgressMolding.ONGOING);
    // Material terpakai diakumulasi, sisa dihitung dari plan.
    expect(result[0].materialUsedKg).toBe(280);
    expect(result[0].materialRemainingKg).toBe(220);
    expect(result[0].machineNumbers).toEqual(['IM-03']);
    expect(result[0].moldKode).toBe('MD-112');
    expect(result[0].moldCavity).toBe(4);
    expect(result[0].achievement).toBe(50); // 150 dari target 300
    expect(result[0].sisaHariSewa).toBe(4);
    expect(result[0].latestLogAt).toBe(new Date('2026-08-12').toISOString());
  });

  it('booking dengan dua cetakan menghasilkan dua baris', async () => {
    const prisma = prismaMock();
    prisma.job.findMany.mockResolvedValue([
      {
        id: 'j1',
        jobNumber: 'SSIP-0001',
        lifecycle: JobLifecycle.AKTIF,
        endDate: inDays(10),
        machines: [{ machineNumber: 'IM-03' }],
        molds: [
          {
            id: 'md-1',
            kodeMold: 'MD-1',
            namaProduk: 'A',
            cavity: 2,
            targetOutput: 100,
            estimasiKg: null,
            planMaterialUtama: null,
            logProduksi: [],
          },
          {
            id: 'md-2',
            kodeMold: 'MD-2',
            namaProduk: 'B',
            cavity: 4,
            targetOutput: 200,
            estimasiKg: null,
            planMaterialUtama: null,
            logProduksi: [],
          },
        ],
      },
    ]);

    const result = await svc(prisma).job(adminPenyewa);
    expect(result.map((r) => r.moldKode)).toEqual(['MD-1', 'MD-2']);
    expect(result.every((r) => r.jobNumber === 'SSIP-0001')).toBe(true);
  });
});

describe('DashboardPenyewaService.jobLogs', () => {
  it('log semua cetakan tenant induk dalam satu timeline', async () => {
    const prisma = prismaMock();
    prisma.logProduksi.findMany.mockResolvedValue([
      {
        id: 'l1',
        jobId: 'j1',
        moldId: 'md-1',
        eventType: LogProduksiEventType.MATERIAL_DATANG,
        occurredAt: new Date('2026-08-12T09:30:00Z'),
        createdAt: new Date('2026-08-12T09:31:00Z'),
        progressMolding: null,
        job: { jobNumber: 'SSIP-0001' },
        mold: { kodeMold: 'MD-112' },
      },
    ]);

    const result = await svc(prisma).jobLogs(adminPenyewa);

    expect(prisma.logProduksi.findMany.mock.calls[0][0].where.job.managerId).toBe('mgr-1');
    expect(result[0].jobNumber).toBe('SSIP-0001');
    expect(result[0].moldKode).toBe('MD-112');
    expect(result[0].occurredAt).toBe(new Date('2026-08-12T09:30:00Z').toISOString());
    expect(result[0]).not.toHaveProperty('job');
    expect(result[0]).not.toHaveProperty('mold');
  });
});

describe('DashboardPenyewaService.cycleProduction', () => {
  it('satu blok per booking, satu kartu per cetakan, plus rekap harian', async () => {
    const prisma = prismaMock();
    prisma.job.findMany.mockResolvedValue([
      {
        id: 'j1',
        jobNumber: 'SSIP-0231',
        lifecycle: JobLifecycle.AKTIF,
        endDate: inDays(6),
        machines: [{ machineNumber: 'IM-03' }],
        molds: [
          {
            id: 'md-1',
            kodeMold: 'MD-112',
            namaProduk: 'Housing cover',
            targetOutput: 10000,
            estimasiKg: 500,
            planMaterialUtama: 'ABS Resin',
            logProduksi: [
              produksi(new Date('2026-07-20'), {
                goodProduct: 1200,
                rejectCount: 24,
                materialUsedKg: 120,
                catatan: null,
              }),
              produksi(new Date('2026-07-19'), {
                goodProduct: 1150,
                rejectCount: 30,
                materialUsedKg: 110,
                catatan: 'Material lembab',
              }),
            ],
          },
        ],
      },
    ]);

    const [blok] = await svc(prisma).cycleProduction(manager);

    expect(blok.jobNumber).toBe('SSIP-0231');
    expect(blok.machineNumbers).toEqual(['IM-03']);
    expect(blok.molds).toHaveLength(1);

    const cycle = blok.molds[0];
    expect(cycle.totalGoodProduct).toBe(2350);
    expect(cycle.totalReject).toBe(54);
    expect(cycle.totalOutput).toBe(2404);
    expect(cycle.remainingTarget).toBe(7650);
    expect(cycle.achievement).toBe(23.5);
    expect(cycle.rejectRate).toBe(2.2);
    // Kuota material: 230 dari plan 500.
    expect(cycle.materialUsedKg).toBe(230);
    expect(cycle.materialRemainingKg).toBe(270);
    expect(cycle.materialUsagePercent).toBe(46);
    // Rekap harian terbaru dulu, hanya event produksi harian.
    expect(cycle.harian).toHaveLength(2);
    expect(cycle.harian[0].goodProduct).toBe(1200);
    expect(cycle.harian[1].catatan).toBe('Material lembab');
  });

  it('plan material kosong berarti tanpa batas: sisa dan persen null', async () => {
    const prisma = prismaMock();
    prisma.job.findMany.mockResolvedValue([
      {
        id: 'j1',
        jobNumber: 'SSIP-1',
        lifecycle: JobLifecycle.AKTIF,
        endDate: null,
        machines: [],
        molds: [
          {
            id: 'md-1',
            kodeMold: 'MD-1',
            namaProduk: 'A',
            targetOutput: null,
            estimasiKg: null,
            planMaterialUtama: null,
            logProduksi: [produksi(new Date('2026-07-20'), { goodProduct: 10, materialUsedKg: 5 })],
          },
        ],
      },
    ]);

    const [blok] = await svc(prisma).cycleProduction(manager);
    const cycle = blok.molds[0];
    expect(cycle.materialRemainingKg).toBeNull();
    expect(cycle.materialUsagePercent).toBeNull();
    expect(cycle.remainingTarget).toBeNull();
    expect(cycle.achievement).toBe(0);
  });
});

describe('DashboardPenyewaService.moldPlan', () => {
  it('menggabung tracking, booking, capaian produksi, dan kuota material', async () => {
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
        logProduksi: [
          produksi(new Date('2026-08-12'), {
            goodProduct: 400,
            rejectCount: 10,
            materialUsedKg: 380,
            progressMolding: ProgressMolding.ONGOING,
          }),
          produksi(new Date('2026-08-11'), {
            goodProduct: 200,
            rejectCount: 5,
            materialUsedKg: 200,
          }),
        ],
        job: {
          id: 'j1',
          jobNumber: 'SSIP-0231',
          lifecycle: JobLifecycle.AKTIF,
          endDate: inDays(4),
          machines: [{ machineNumber: 'IM-03' }],
        },
      },
      // Cetakan yang belum dibooking: tanpa job, angka produksi nol.
      {
        id: 'md-2',
        kodeMold: 'MD-220',
        namaProduk: 'Bracket',
        cavity: 2,
        tonaseTon: 100,
        trackingStatus: MoldTrackingStatus.PLANNING,
        planMaterialUtama: null,
        estimasiKg: null,
        targetOutput: null,
        logProduksi: [],
        job: null,
      },
    ]);

    const [aktif, planning] = await svc(prisma).moldPlan(manager);

    expect(aktif.jobNumber).toBe('SSIP-0231');
    expect(aktif.machineNumbers).toEqual(['IM-03']);
    expect(aktif.totalGoodProduct).toBe(600);
    expect(aktif.totalReject).toBe(15);
    expect(aktif.achievement).toBe(60);
    expect(aktif.progressMolding).toBe(ProgressMolding.ONGOING);
    // Kuota material: 580 terpakai dari plan 800.
    expect(aktif.materialUsedKg).toBe(580);
    expect(aktif.materialRemainingKg).toBe(220);
    expect(aktif.materialUsagePercent).toBe(72.5);

    expect(planning.jobNumber).toBeNull();
    expect(planning.machineNumbers).toEqual([]);
    expect(planning.totalGoodProduct).toBe(0);
    expect(planning.materialRemainingKg).toBeNull();
    expect(planning.etaHari).toBeNull();
  });
});

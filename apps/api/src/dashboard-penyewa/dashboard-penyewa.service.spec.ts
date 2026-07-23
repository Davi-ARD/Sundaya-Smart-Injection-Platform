import { DeliveryStatus, JobLifecycle, ProgressMolding, Role } from '@mold-tracker/shared';
import { User as PrismaUser } from '@prisma/client';
import { DashboardPenyewaService } from './dashboard-penyewa.service';
import { PrismaService } from '../prisma/prisma.service';
import { PengirimanService } from '../pengiriman/pengiriman.service';

function prismaMock() {
  return {
    mold: { count: jest.fn() },
    job: { count: jest.fn(), findMany: jest.fn() },
    logProduksi: { aggregate: jest.fn(), groupBy: jest.fn() },
  };
}

const manager = { id: 'mgr-1', role: Role.MANAGER_PENYEWA } as unknown as PrismaUser;
const adminPenyewa = { id: 'ap-1', role: Role.ADMIN_PENYEWA, parentId: 'mgr-1' } as unknown as PrismaUser;

function svc(prisma: ReturnType<typeof prismaMock>, rows: unknown[] = []) {
  const pengiriman = { list: jest.fn().mockResolvedValue(rows) } as unknown as PengirimanService;
  return new DashboardPenyewaService(prisma as unknown as PrismaService, pengiriman);
}

describe('DashboardPenyewaService.manager', () => {
  it('agregasi + onTimeDeliveryRate dari Log Pengiriman + avgAchievement', async () => {
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
    // 3 tiba: 2 ontime, 1 terlambat -> 66.7%
    const rows = [
      { status: DeliveryStatus.TIBA_ONTIME },
      { status: DeliveryStatus.TIBA_ONTIME },
      { status: DeliveryStatus.TIBA_TERLAMBAT },
      { status: DeliveryStatus.BELUM_TIBA }, // belum tiba tidak dihitung
    ];

    const result = await svc(prisma, rows).manager(manager);

    expect(result.moldsAtSundaya).toBe(3);
    expect(result.ongoing).toBe(2);
    expect(result.totalGoodProduct).toBe(900);
    expect(result.avgAchievement).toBe(75); // (50 + 100) / 2
    expect(result.onTimeDeliveryRate).toBe(66.7);
  });

  it('tanpa kedatangan -> onTimeDeliveryRate 100; tanpa target -> avgAchievement 0', async () => {
    const prisma = prismaMock();
    prisma.mold.count.mockResolvedValue(0);
    prisma.job.count.mockResolvedValue(0);
    prisma.logProduksi.aggregate.mockResolvedValue({ _sum: { goodProduct: null } });
    prisma.job.findMany.mockResolvedValue([]);

    const result = await svc(prisma, []).manager(manager);
    expect(result.totalGoodProduct).toBe(0);
    expect(result.avgAchievement).toBe(0);
    expect(result.onTimeDeliveryRate).toBe(100);
  });
});

describe('DashboardPenyewaService.job', () => {
  it('scope parentId + reduksi log per job aktif', async () => {
    const prisma = prismaMock();
    prisma.job.findMany.mockResolvedValue([
      {
        id: 'j1',
        jobNumber: 'SSIP-0001',
        lifecycle: JobLifecycle.AKTIF,
        machine: { machineNumber: 'IM-03' },
        logProduksi: [
          { occurredAt: new Date('2026-08-12'), goodProduct: 100, rejectCount: 5, materialRemainingKg: 20, progressMolding: ProgressMolding.ONGOING },
          { occurredAt: new Date('2026-08-11'), goodProduct: 50, rejectCount: 2, materialRemainingKg: null, progressMolding: null },
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
    expect(result[0].latestLogAt).toBe(new Date('2026-08-12').toISOString());
  });
});

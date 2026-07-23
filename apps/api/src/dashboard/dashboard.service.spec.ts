import { NotFoundException } from '@nestjs/common';
import { MachineOperationalStatus } from '@mold-tracker/shared';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

function prismaMock() {
  return {
    machine: { findUnique: jest.fn(), findMany: jest.fn() },
    operationalData: { findMany: jest.fn() },
    job: { count: jest.fn() },
  };
}

describe('DashboardService.sundaya', () => {
  it('agregasi status, rata-rata OEE/util, dan activeBookings', async () => {
    const prisma = prismaMock();
    prisma.machine.findMany.mockResolvedValue([
      { id: 'm1', operationalStatus: 'RUNNING' },
      { id: 'm2', operationalStatus: 'STANDBY' },
    ]);
    // Hanya m1 punya event (satu RUNNING -> OEE & utilization 100). m2 tanpa event.
    prisma.operationalData.findMany.mockResolvedValue([
      { machineId: 'm1', status: 'RUNNING', downtimeReason: null, occurredAt: new Date('2026-07-23T00:00:00Z') },
    ]);
    prisma.job.count.mockResolvedValue(3);

    const service = new DashboardService(prisma as unknown as PrismaService);
    const d = await service.sundaya();

    expect(d.totalMachines).toBe(2);
    expect(d.runningMachines).toBe(1);
    expect(d.activeBookings).toBe(3);
    expect(d.avgOee).toBe(100);
    expect(d.utilization).toBe(100);

    const byStatus = Object.fromEntries(d.operationalStatusCounts.map((c) => [c.status, c.count]));
    expect(byStatus[MachineOperationalStatus.RUNNING]).toBe(1);
    expect(byStatus[MachineOperationalStatus.STANDBY]).toBe(1);
    expect(byStatus[MachineOperationalStatus.BREAKDOWN]).toBe(0);
    expect(d.operationalStatusCounts).toHaveLength(Object.values(MachineOperationalStatus).length);
  });

  it('rata-rata 0 saat tak ada mesin dengan event', async () => {
    const prisma = prismaMock();
    prisma.machine.findMany.mockResolvedValue([{ id: 'm1', operationalStatus: 'STANDBY' }]);
    prisma.operationalData.findMany.mockResolvedValue([]);
    prisma.job.count.mockResolvedValue(0);

    const service = new DashboardService(prisma as unknown as PrismaService);
    const d = await service.sundaya();
    expect(d.avgOee).toBe(0);
    expect(d.utilization).toBe(0);
  });
});

describe('DashboardService.machineMetrics', () => {
  it('404 bila mesin tidak ada', async () => {
    const prisma = prismaMock();
    prisma.machine.findUnique.mockResolvedValue(null);

    const service = new DashboardService(prisma as unknown as PrismaService);
    await expect(service.machineMetrics('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('mengembalikan MachineMetrics dengan machineNumber', async () => {
    const prisma = prismaMock();
    prisma.machine.findUnique.mockResolvedValue({ id: 'm1', machineNumber: 'IM-03' });
    prisma.operationalData.findMany.mockResolvedValue([
      { status: 'RUNNING', downtimeReason: null, occurredAt: new Date('2026-07-23T00:00:00Z') },
    ]);

    const service = new DashboardService(prisma as unknown as PrismaService);
    const m = await service.machineMetrics('m1');
    expect(m.machineId).toBe('m1');
    expect(m.machineNumber).toBe('IM-03');
    expect(m.oee).toBe(100);
  });
});

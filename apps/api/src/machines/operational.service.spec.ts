import { ConflictException, NotFoundException } from '@nestjs/common';
import { MachineOperationalStatus, Role } from '@mold-tracker/shared';
import { User as PrismaUser } from '@prisma/client';
import { OperationalService } from './operational.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperationalDataDto } from './operational.dto';

function prismaMock() {
  return {
    machine: { findUnique: jest.fn(), update: jest.fn(), groupBy: jest.fn() },
    operationalData: { create: jest.fn() },
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.resolve(ops)),
  };
}

const teknisi = { id: 'teknisi-1', role: Role.TEKNISI_SUNDAYA } as unknown as PrismaUser;

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'op-1',
    machineId: 'm-1',
    status: 'RUNNING',
    cycleTimeSec: 32,
    occurredAt: new Date('2026-07-22T08:00:00.000Z'),
    byId: 'teknisi-1',
    catatan: null,
    createdAt: new Date('2026-07-22T08:00:00.000Z'),
    ...overrides,
  };
}

const runningDto: CreateOperationalDataDto = {
  status: MachineOperationalStatus.RUNNING,
  cycleTimeSec: 32,
  occurredAt: '2026-07-22T08:00:00.000Z',
};

describe('OperationalService.append', () => {
  it('menulis event dan memperbarui Machine.operationalStatus ke status yang diposting', async () => {
    const prisma = prismaMock();
    prisma.machine.findUnique.mockResolvedValue({ operationalStatus: 'STANDBY' });
    prisma.operationalData.create.mockReturnValue(eventRow());
    prisma.machine.update.mockReturnValue({ id: 'm-1', operationalStatus: 'RUNNING' });

    const service = new OperationalService(prisma as unknown as PrismaService);
    const result = await service.append(teknisi, 'm-1', runningDto);

    expect(prisma.machine.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { operationalStatus: 'RUNNING' },
    });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.status).toBe(MachineOperationalStatus.RUNNING);
    expect(result.byId).toBe('teknisi-1');
  });

  it('menerima SETUP tanpa perlu reason code (reason code sudah dihapus)', async () => {
    const prisma = prismaMock();
    prisma.machine.findUnique.mockResolvedValue({ operationalStatus: 'RUNNING' });
    prisma.operationalData.create.mockReturnValue(
      eventRow({ status: 'SETUP', cycleTimeSec: null }),
    );
    prisma.machine.update.mockReturnValue({ id: 'm-1', operationalStatus: 'SETUP' });

    const service = new OperationalService(prisma as unknown as PrismaService);
    const result = await service.append(teknisi, 'm-1', {
      status: MachineOperationalStatus.SETUP,
      occurredAt: '2026-07-22T08:00:00.000Z',
    });
    expect(result.status).toBe(MachineOperationalStatus.SETUP);
  });

  it('menolak (409) bila mesin sedang MAINTENANCE: status dipulihkan modul Maintenance', async () => {
    const prisma = prismaMock();
    prisma.machine.findUnique.mockResolvedValue({ operationalStatus: 'MAINTENANCE' });

    const service = new OperationalService(prisma as unknown as PrismaService);
    await expect(service.append(teknisi, 'm-1', runningDto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.operationalData.create).not.toHaveBeenCalled();
  });

  it('menolak (404) bila mesin tidak ada', async () => {
    const prisma = prismaMock();
    prisma.machine.findUnique.mockResolvedValue(null);

    const service = new OperationalService(prisma as unknown as PrismaService);
    await expect(service.append(teknisi, 'tidak-ada', runningDto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('OperationalService.summary', () => {
  it('menghitung per status dan zero-fill keempat status', async () => {
    const prisma = prismaMock();
    prisma.machine.groupBy.mockResolvedValue([
      { operationalStatus: 'RUNNING', _count: { _all: 3 } },
      { operationalStatus: 'STANDBY', _count: { _all: 1 } },
    ]);

    const service = new OperationalService(prisma as unknown as PrismaService);
    const result = await service.summary();

    expect(result).toHaveLength(Object.values(MachineOperationalStatus).length);
    const byStatus = Object.fromEntries(result.map((r) => [r.status, r.count]));
    expect(byStatus[MachineOperationalStatus.RUNNING]).toBe(3);
    expect(byStatus[MachineOperationalStatus.STANDBY]).toBe(1);
    expect(byStatus[MachineOperationalStatus.MAINTENANCE]).toBe(0);
    expect(byStatus[MachineOperationalStatus.SETUP]).toBe(0);
  });
});

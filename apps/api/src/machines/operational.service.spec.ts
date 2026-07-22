import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  DowntimeReason,
  MachineOperationalStatus,
  Role,
} from '@mold-tracker/shared';
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
    downtimeReason: null,
    cycleTimeSec: 12.5,
    occurredAt: new Date('2026-07-22T08:00:00.000Z'),
    byId: 'teknisi-1',
    catatan: null,
    createdAt: new Date('2026-07-22T08:00:00.000Z'),
    ...overrides,
  };
}

const runningDto: CreateOperationalDataDto = {
  status: MachineOperationalStatus.RUNNING,
  cycleTimeSec: 12.5,
  occurredAt: '2026-07-22T08:00:00.000Z',
};

describe('OperationalService.append', () => {
  it('menulis event dan memperbarui Machine.operationalStatus ke status yang diposting', async () => {
    const prisma = prismaMock();
    prisma.machine.findUnique.mockResolvedValue({ id: 'm-1' });
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

  it('menolak (400) bila status non-RUNNING tanpa downtimeReason', async () => {
    const prisma = prismaMock();
    prisma.machine.findUnique.mockResolvedValue({ id: 'm-1' });

    const service = new OperationalService(prisma as unknown as PrismaService);
    await expect(
      service.append(teknisi, 'm-1', {
        status: MachineOperationalStatus.BREAKDOWN,
        occurredAt: '2026-07-22T08:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.operationalData.create).not.toHaveBeenCalled();
  });

  it('menerima status non-RUNNING dengan downtimeReason', async () => {
    const prisma = prismaMock();
    prisma.machine.findUnique.mockResolvedValue({ id: 'm-1' });
    prisma.operationalData.create.mockReturnValue(
      eventRow({ status: 'BREAKDOWN', downtimeReason: 'BREAKDOWN', cycleTimeSec: null }),
    );
    prisma.machine.update.mockReturnValue({ id: 'm-1', operationalStatus: 'BREAKDOWN' });

    const service = new OperationalService(prisma as unknown as PrismaService);
    const result = await service.append(teknisi, 'm-1', {
      status: MachineOperationalStatus.BREAKDOWN,
      downtimeReason: DowntimeReason.BREAKDOWN,
      occurredAt: '2026-07-22T08:00:00.000Z',
    });
    expect(result.downtimeReason).toBe(DowntimeReason.BREAKDOWN);
  });

  it('menolak (400) bila status RUNNING tapi downtimeReason diisi', async () => {
    const prisma = prismaMock();
    prisma.machine.findUnique.mockResolvedValue({ id: 'm-1' });

    const service = new OperationalService(prisma as unknown as PrismaService);
    await expect(
      service.append(teknisi, 'm-1', {
        status: MachineOperationalStatus.RUNNING,
        downtimeReason: DowntimeReason.MINOR_STOP,
        occurredAt: '2026-07-22T08:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
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
  it('menghitung per status dan zero-fill kelima status', async () => {
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
    expect(byStatus[MachineOperationalStatus.BREAKDOWN]).toBe(0);
  });
});

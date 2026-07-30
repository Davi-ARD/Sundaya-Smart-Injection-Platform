import { ConflictException, NotFoundException } from '@nestjs/common';
import { MaintenanceStatus, MaintenanceType, Role } from '@mold-tracker/shared';
import { User as PrismaUser } from '@prisma/client';
import { MaintenanceService } from './maintenance.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaintenanceDto } from './dto';

// updateStatus berjalan di dalam $transaction: mock meneruskan klien tx yang sama
// supaya panggilan di dalam callback bisa diperiksa.
function prismaMock() {
  const client = {
    machine: { findUnique: jest.fn(), update: jest.fn() },
    maintenance: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  return {
    ...client,
    $transaction: jest.fn().mockImplementation((fn: (tx: typeof client) => unknown) => fn(client)),
  };
}

const teknisi = { id: 'teknisi-1', role: Role.TEKNISI_SUNDAYA } as unknown as PrismaUser;

const createDto: CreateMaintenanceDto = {
  machineId: 'm-1',
  type: MaintenanceType.PREVENTIVE,
  scheduledAt: '2026-08-01',
  notes: 'ganti oli',
};

function maintenanceRow(o: Record<string, unknown> = {}) {
  return {
    id: 'mt-1',
    machineId: 'm-1',
    type: 'PREVENTIVE',
    status: 'TERJADWAL',
    scheduledAt: new Date('2026-08-01'),
    startedAt: null,
    completedAt: null,
    notes: null,
    byId: 'teknisi-1',
    createdAt: new Date('2026-07-22'),
    ...o,
  };
}

describe('MaintenanceService.create', () => {
  it('menyimpan byId teknisi dan type; default status TERJADWAL dari DB', async () => {
    const prisma = prismaMock();
    prisma.machine.findUnique.mockResolvedValue({ id: 'm-1' });
    prisma.maintenance.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      maintenanceRow(data),
    );

    const service = new MaintenanceService(prisma as unknown as PrismaService);
    const result = await service.create(teknisi, createDto);

    const data = prisma.maintenance.create.mock.calls[0][0].data;
    expect(data.byId).toBe('teknisi-1');
    expect(data.type).toBe(MaintenanceType.PREVENTIVE);
    expect(result.status).toBe(MaintenanceStatus.TERJADWAL);
  });

  it('menolak 404 bila mesin tidak ada', async () => {
    const prisma = prismaMock();
    prisma.machine.findUnique.mockResolvedValue(null);

    const service = new MaintenanceService(prisma as unknown as PrismaService);
    await expect(service.create(teknisi, createDto)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.maintenance.create).not.toHaveBeenCalled();
  });
});

describe('MaintenanceService.updateStatus', () => {
  it('BERLANGSUNG: mesin jadi MAINTENANCE dan status semula disimpan', async () => {
    const prisma = prismaMock();
    prisma.maintenance.findUnique.mockResolvedValue(maintenanceRow());
    prisma.maintenance.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      maintenanceRow(data),
    );
    prisma.machine.findUnique.mockResolvedValue({ operationalStatus: 'RUNNING' });

    const service = new MaintenanceService(prisma as unknown as PrismaService);
    const result = await service.updateStatus('mt-1', { status: MaintenanceStatus.BERLANGSUNG });

    expect(result.status).toBe(MaintenanceStatus.BERLANGSUNG);
    expect(result.startedAt).not.toBeNull();
    expect(prisma.machine.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { statusBeforeMaintenance: 'RUNNING', operationalStatus: 'MAINTENANCE' },
    });
  });

  it('BERLANGSUNG: tidak menimpa statusBeforeMaintenance bila mesin sudah MAINTENANCE', async () => {
    const prisma = prismaMock();
    prisma.maintenance.findUnique.mockResolvedValue(maintenanceRow());
    prisma.maintenance.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      maintenanceRow(data),
    );
    prisma.machine.findUnique.mockResolvedValue({ operationalStatus: 'MAINTENANCE' });

    const service = new MaintenanceService(prisma as unknown as PrismaService);
    await service.updateStatus('mt-1', { status: MaintenanceStatus.BERLANGSUNG });

    expect(prisma.machine.update).not.toHaveBeenCalled();
  });

  it('SELESAI: mesin dipulihkan ke status sebelum maintenance', async () => {
    const prisma = prismaMock();
    prisma.maintenance.findUnique.mockResolvedValue(
      maintenanceRow({ status: 'BERLANGSUNG', startedAt: new Date('2026-08-01T08:00:00Z') }),
    );
    prisma.maintenance.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      maintenanceRow(data),
    );
    prisma.machine.findUnique.mockResolvedValue({ statusBeforeMaintenance: 'SETUP' });

    const service = new MaintenanceService(prisma as unknown as PrismaService);
    const result = await service.updateStatus('mt-1', { status: MaintenanceStatus.SELESAI });

    expect(result.completedAt).not.toBeNull();
    expect(prisma.machine.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { operationalStatus: 'SETUP', statusBeforeMaintenance: null },
    });
  });

  it('SELESAI tanpa jejak status semula: mesin kembali ke STANDBY', async () => {
    const prisma = prismaMock();
    prisma.maintenance.findUnique.mockResolvedValue(maintenanceRow({ status: 'BERLANGSUNG' }));
    prisma.maintenance.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      maintenanceRow(data),
    );
    prisma.machine.findUnique.mockResolvedValue({ statusBeforeMaintenance: null });

    const service = new MaintenanceService(prisma as unknown as PrismaService);
    await service.updateStatus('mt-1', { status: MaintenanceStatus.SELESAI });

    expect(prisma.machine.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { operationalStatus: 'STANDBY', statusBeforeMaintenance: null },
    });
  });

  it('menolak transisi tidak sah TERJADWAL -> SELESAI (409)', async () => {
    const prisma = prismaMock();
    prisma.maintenance.findUnique.mockResolvedValue(maintenanceRow());

    const service = new MaintenanceService(prisma as unknown as PrismaService);
    await expect(
      service.updateStatus('mt-1', { status: MaintenanceStatus.SELESAI }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.maintenance.update).not.toHaveBeenCalled();
  });

  it('menolak 404 bila maintenance tidak ada', async () => {
    const prisma = prismaMock();
    prisma.maintenance.findUnique.mockResolvedValue(null);

    const service = new MaintenanceService(prisma as unknown as PrismaService);
    await expect(
      service.updateStatus('tidak-ada', { status: MaintenanceStatus.BERLANGSUNG }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

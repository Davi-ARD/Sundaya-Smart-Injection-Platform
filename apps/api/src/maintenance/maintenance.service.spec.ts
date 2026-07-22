import { ConflictException, NotFoundException } from '@nestjs/common';
import { MaintenanceStatus, MaintenanceType, Role } from '@mold-tracker/shared';
import { User as PrismaUser } from '@prisma/client';
import { MaintenanceService } from './maintenance.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaintenanceDto } from './dto';

function prismaMock() {
  return {
    machine: { findUnique: jest.fn() },
    maintenance: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

const teknisi = { id: 'teknisi-1', role: Role.TEKNISI_SUNDAYA } as unknown as PrismaUser;

const createDto: CreateMaintenanceDto = {
  machineId: 'm-1',
  type: MaintenanceType.PREVENTIVE,
  scheduledAt: '2026-08-01',
  notes: 'ganti oli',
};

describe('MaintenanceService.create', () => {
  it('menyimpan byId teknisi dan type; default status TERJADWAL dari DB', async () => {
    const prisma = prismaMock();
    prisma.machine.findUnique.mockResolvedValue({ id: 'm-1' });
    prisma.maintenance.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'mt-1',
      ...data,
      status: 'TERJADWAL',
      createdAt: new Date('2026-07-22'),
    }));

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
  it('mengizinkan transisi sah TERJADWAL -> BERLANGSUNG', async () => {
    const prisma = prismaMock();
    prisma.maintenance.findUnique.mockResolvedValue({ id: 'mt-1', status: 'TERJADWAL', notes: null });
    prisma.maintenance.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'mt-1',
      machineId: 'm-1',
      type: 'PREVENTIVE',
      scheduledAt: new Date('2026-08-01'),
      byId: 'teknisi-1',
      createdAt: new Date('2026-07-22'),
      notes: null,
      ...data,
    }));

    const service = new MaintenanceService(prisma as unknown as PrismaService);
    const result = await service.updateStatus('mt-1', { status: MaintenanceStatus.BERLANGSUNG });
    expect(result.status).toBe(MaintenanceStatus.BERLANGSUNG);
  });

  it('menolak transisi tidak sah TERJADWAL -> SELESAI (409)', async () => {
    const prisma = prismaMock();
    prisma.maintenance.findUnique.mockResolvedValue({ id: 'mt-1', status: 'TERJADWAL', notes: null });

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

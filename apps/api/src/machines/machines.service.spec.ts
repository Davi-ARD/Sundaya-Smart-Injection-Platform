import { NotFoundException } from '@nestjs/common';
import { Role, WarrantyStatus } from '@mold-tracker/shared';
import { User as PrismaUser } from '@prisma/client';
import { MachinesService } from './machines.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMachineDto } from './dto';

// Prisma mock minimal: hanya method machine yang dipakai service.
function prismaMock() {
  return {
    machine: {
      findUnique: jest.fn(),
      // findFirst dipakai generator nomor mesin untuk mencari nomor tertinggi.
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

const adminSundaya = { id: 'admin-1', role: Role.ADMIN_SUNDAYA } as unknown as PrismaUser;

const createDto: CreateMachineDto = {
  spesifikasi: 'Injection molding 150 ton',
  tonaseTon: 150,
  warrantyStart: '2025-01-01',
  warrantyEnd: '2030-01-01T00:00:00.000Z',
};

describe('MachinesService.create', () => {
  it('menyimpan tonaseTon, owner = user Sundaya pembuat, dan warranty dihitung', async () => {
    const prisma = prismaMock();
    prisma.machine.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'm-1',
      ...data,
      status: 'TERSEDIA',
      operationalStatus: 'STANDBY',
      statusBeforeMaintenance: null,
      isArchived: false,
      createdAt: new Date('2025-01-01'),
    }));

    const service = new MachinesService(prisma as unknown as PrismaService);
    const result = await service.create(adminSundaya, createDto);

    const data = prisma.machine.create.mock.calls[0][0].data;
    expect(data.tonaseTon).toBe(150);
    expect(data.ownerId).toBe('admin-1');
    expect(data.warrantyEnd.toISOString().slice(0, 10)).toBe('2030-01-01');
    expect(data.warrantyStatus).toBe(WarrantyStatus.AKTIF);
    expect(result.tonaseTon).toBe(150);
    expect(result.operationalStatus).toBe('STANDBY');
  });

  it('menghasilkan nomor mesin pertama IM-001 saat belum ada mesin', async () => {
    const prisma = prismaMock();
    prisma.machine.findFirst.mockResolvedValue(null);
    prisma.machine.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'm-1',
      ...data,
      status: 'TERSEDIA',
      operationalStatus: 'STANDBY',
      statusBeforeMaintenance: null,
      isArchived: false,
      createdAt: new Date('2025-01-01'),
    }));

    const service = new MachinesService(prisma as unknown as PrismaService);
    const result = await service.create(adminSundaya, createDto);
    expect(result.machineNumber).toBe('IM-001');
  });

  it('melanjutkan nomor dari yang tertinggi, bukan dari jumlah baris', async () => {
    const prisma = prismaMock();
    prisma.machine.findFirst.mockResolvedValue({ machineNumber: 'IM-014' });
    prisma.machine.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'm-2',
      ...data,
      status: 'TERSEDIA',
      operationalStatus: 'STANDBY',
      statusBeforeMaintenance: null,
      isArchived: false,
      createdAt: new Date('2025-01-01'),
    }));

    const service = new MachinesService(prisma as unknown as PrismaService);
    const result = await service.create(adminSundaya, createDto);
    expect(result.machineNumber).toBe('IM-015');
  });
});

describe('MachinesService.update', () => {
  it('melempar 404 bila mesin tidak ada', async () => {
    const prisma = prismaMock();
    prisma.machine.findUnique.mockResolvedValue(null);

    const service = new MachinesService(prisma as unknown as PrismaService);
    await expect(service.update('tidak-ada', { tonaseTon: 200 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

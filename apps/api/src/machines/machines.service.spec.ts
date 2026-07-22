import { ConflictException, NotFoundException } from '@nestjs/common';
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
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

const adminSundaya = { id: 'admin-1', role: Role.ADMIN_SUNDAYA } as unknown as PrismaUser;

const createDto: CreateMachineDto = {
  machineNumber: 'IM-10',
  spesifikasi: 'Injection molding 150 ton',
  tonaseTon: 150,
  standardRatio: 2,
  warrantyStart: '2025-01-01',
  warrantyDurationMonths: 24,
};

describe('MachinesService.create', () => {
  it('menyimpan tonaseTon, owner = user Sundaya pembuat, dan warranty dihitung', async () => {
    const prisma = prismaMock();
    prisma.machine.findUnique.mockResolvedValue(null); // nomor bebas
    prisma.machine.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 'm-1',
      ...data,
      status: 'TERSEDIA',
      operationalStatus: 'STANDBY',
      isArchived: false,
      createdAt: new Date('2025-01-01'),
    }));

    const service = new MachinesService(prisma as unknown as PrismaService);
    const result = await service.create(adminSundaya, createDto);

    const data = prisma.machine.create.mock.calls[0][0].data;
    expect(data.tonaseTon).toBe(150);
    expect(data.ownerId).toBe('admin-1');
    expect(data.warrantyEnd.toISOString().slice(0, 10)).toBe('2027-01-01');
    expect(data.warrantyStatus).toBe(WarrantyStatus.AKTIF);
    expect(result.tonaseTon).toBe(150);
    expect(result.operationalStatus).toBe('STANDBY');
  });

  it('menolak nomor mesin duplikat dengan 409', async () => {
    const prisma = prismaMock();
    prisma.machine.findUnique.mockResolvedValue({ id: 'ada' }); // nomor terpakai

    const service = new MachinesService(prisma as unknown as PrismaService);
    await expect(service.create(adminSundaya, createDto)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.machine.create).not.toHaveBeenCalled();
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

import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MoldTrackingStatus } from '@mold-tracker/shared';
import { MoldsService } from './molds.service';
import { PrismaService } from '../prisma/prisma.service';

function mockPrisma() {
  return {
    mold: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

function svc(prisma: ReturnType<typeof mockPrisma>) {
  return new MoldsService(prisma as unknown as PrismaService);
}

// Row lengkap: toMold membaca semua field (createdAt harus Date).
const moldRow = (over: Record<string, unknown>) => ({
  id: 'mold1',
  kodeMold: 'MLD-001',
  namaProduk: 'Tutup Botol',
  cavity: 4,
  tonaseTon: 150,
  deskripsi: null,
  managerId: 'm1',
  trackingStatus: MoldTrackingStatus.PLANNING,
  planMaterialUtama: null,
  estimasiKg: null,
  targetOutput: null,
  createdAt: new Date(),
  ...over,
});

const createDto = {
  kodeMold: 'MLD-001',
  namaProduk: 'Tutup Botol',
  cavity: 4,
  tonaseTon: 150,
};

describe('MoldsService', () => {
  it('create menetapkan managerId actor dan default PLANNING', async () => {
    const prisma = mockPrisma();
    prisma.mold.create.mockResolvedValue(moldRow({}));
    await svc(prisma).create('m1', createDto as never);

    const data = prisma.mold.create.mock.calls[0][0].data;
    expect(data.managerId).toBe('m1');
    // Service tidak mengirim trackingStatus: schema default PLANNING.
    expect(data.trackingStatus).toBeUndefined();
  });

  it('findAll hanya mold milik Manager sendiri', async () => {
    const prisma = mockPrisma();
    prisma.mold.findMany.mockResolvedValue([moldRow({})]);
    await svc(prisma).findAll('m1');
    expect(prisma.mold.findMany.mock.calls[0][0].where).toEqual({ managerId: 'm1' });
  });

  it('findOne mold Manager lain -> NotFound', async () => {
    const prisma = mockPrisma();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ managerId: 'other' }));
    await expect(svc(prisma).findOne('m1', 'mold1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update mold Manager lain -> NotFound, tidak menulis', async () => {
    const prisma = mockPrisma();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ managerId: 'other' }));
    await expect(svc(prisma).update('m1', 'mold1', {} as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.mold.update).not.toHaveBeenCalled();
  });

  it('kodeMold duplikat (P2002) -> Conflict', async () => {
    const prisma = mockPrisma();
    prisma.mold.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );
    await expect(svc(prisma).create('m1', createDto as never)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('findAllStaff tanpa filter tenant (baca semua)', async () => {
    const prisma = mockPrisma();
    prisma.mold.findMany.mockResolvedValue([moldRow({}), moldRow({ id: 'mold2', managerId: 'other' })]);
    const result = await svc(prisma).findAllStaff();
    expect(prisma.mold.findMany.mock.calls[0][0].where).toBeUndefined();
    expect(result).toHaveLength(2);
  });

  it('findOneStaff mold manapun tanpa cek managerId', async () => {
    const prisma = mockPrisma();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ managerId: 'other' }));
    const result = await svc(prisma).findOneStaff('mold1');
    expect(result.id).toBe('mold1');
  });

  it('findOneStaff mold tidak ada -> NotFound', async () => {
    const prisma = mockPrisma();
    prisma.mold.findUnique.mockResolvedValue(null);
    await expect(svc(prisma).findOneStaff('x')).rejects.toBeInstanceOf(NotFoundException);
  });
});

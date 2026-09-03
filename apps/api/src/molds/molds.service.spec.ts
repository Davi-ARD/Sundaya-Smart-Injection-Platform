import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MoldTrackingStatus } from '@mold-tracker/shared';
import { MoldsService } from './molds.service';
import { MoldTrackingService } from './mold-tracking.service';
import { PrismaService } from '../prisma/prisma.service';

function mockPrisma() {
  return {
    mold: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    job: { findUnique: jest.fn() },
    logProduksi: { aggregate: jest.fn() },
    moldProductionRun: { create: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
}

function svc(prisma: ReturnType<typeof mockPrisma>) {
  return new MoldsService(
    prisma as unknown as PrismaService,
    trackingMock() as unknown as MoldTrackingService,
  );
}

// Tracking hanya dipanggil saat cetakan dibuka lagi; test di sini menguji CRUD
// plan, jadi cukup mata-mata kosong.
const trackingMock = () => ({ advance: jest.fn(), reopen: jest.fn() });

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

// Menaikkan target output adalah cara penyewa memakai lagi cetakan yang sudah
// selesai selama masa sewa masih berjalan. Ini menguji syaratnya, karena salah
// satu saja longgar berarti cetakan bisa dibuka di luar masa sewa.
describe('update: sesi produksi baru saat target output diganti', () => {
  const siapkan = (over: { lifecycle?: string; endDate?: Date | null; sudahBaik?: number } = {}) => {
    const prisma = mockPrisma();
    prisma.mold.findUnique.mockResolvedValue(
      moldRow({ managerId: 'mgr1', jobId: 'job-1', trackingStatus: 'COMPLETED', targetOutput: 200 }),
    );
    prisma.mold.update.mockResolvedValue(moldRow({ targetOutput: 350, estimasiKg: 2000 }));
    prisma.job.findUnique.mockResolvedValue({
      lifecycle: over.lifecycle ?? 'AKTIF',
      endDate: over.endDate === undefined ? new Date(Date.now() + 86_400_000) : over.endDate,
    });
    prisma.logProduksi.aggregate.mockResolvedValue({
      _sum: { goodProduct: over.sudahBaik ?? 200, materialUsedKg: 500 },
    });
    prisma.moldProductionRun.create.mockResolvedValue({});
    prisma.$transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
    const tracking = { advance: jest.fn(), reopen: jest.fn() };
    const service = new MoldsService(
      prisma as unknown as PrismaService,
      tracking as unknown as MoldTrackingService,
    );
    return { service, tracking, prisma };
  };

  it('target diganti saat sewa berjalan: sesi baru dibuka dan cetakan kembali diproduksi', async () => {
    const { service, tracking, prisma } = siapkan();
    await service.update('mgr1', 'mold1', { targetOutput: 350 });

    // Akumulasi berjalan jadi titik awal sesi, sehingga hasil sesi lama tidak
    // ikut membebani sesi baru.
    expect(prisma.moldProductionRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        moldId: 'mold1',
        targetOutput: 350,
        goodAwal: 200,
        materialAwal: 500,
        byId: 'mgr1',
      }),
    });
    expect(tracking.reopen).toHaveBeenCalledWith(expect.anything(), 'mold1', 'mgr1');
  });

  it('target baru lebih KECIL dari sesi sebelumnya tetap diterima', async () => {
    const { service, tracking, prisma } = siapkan();
    await service.update('mgr1', 'mold1', { targetOutput: 50 });

    expect(prisma.moldProductionRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ targetOutput: 50, goodAwal: 200 }),
    });
    expect(tracking.reopen).toHaveBeenCalled();
  });

  it('target tidak berubah: tidak membuka sesi baru', async () => {
    const { service, tracking, prisma } = siapkan();
    await service.update('mgr1', 'mold1', { targetOutput: 200 });

    expect(prisma.moldProductionRun.create).not.toHaveBeenCalled();
    expect(tracking.reopen).not.toHaveBeenCalled();
  });

  it('masa sewa sudah lewat: sesi tercatat tapi cetakan tidak dibuka', async () => {
    const { service, tracking, prisma } = siapkan({ endDate: new Date(Date.now() - 86_400_000) });
    await service.update('mgr1', 'mold1', { targetOutput: 350 });

    expect(prisma.moldProductionRun.create).toHaveBeenCalled();
    expect(tracking.reopen).not.toHaveBeenCalled();
  });

  it('booking sudah Selesai: cetakan tidak dibuka', async () => {
    const { service, tracking } = siapkan({ lifecycle: 'SELESAI' });
    await service.update('mgr1', 'mold1', { targetOutput: 350 });
    expect(tracking.reopen).not.toHaveBeenCalled();
  });
});

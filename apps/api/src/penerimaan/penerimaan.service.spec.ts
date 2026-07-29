import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ItemPengiriman, MoldTrackingStatus, Role } from '@mold-tracker/shared';
import { User as PrismaUser } from '@prisma/client';
import { PenerimaanService } from './penerimaan.service';
import { PrismaService } from '../prisma/prisma.service';
import { MoldTrackingService } from '../molds/mold-tracking.service';
import { NotificationsService } from '../notifications/notifications.service';

function prismaMock() {
  const client = {
    job: { findUnique: jest.fn() },
    logPenerimaan: { create: jest.fn(), findMany: jest.fn() },
  };
  return {
    ...client,
    $transaction: jest.fn().mockImplementation((fn: (tx: typeof client) => unknown) => fn(client)),
  };
}

function svc(prisma: ReturnType<typeof prismaMock>, advance = jest.fn(), create = jest.fn()) {
  return new PenerimaanService(
    prisma as unknown as PrismaService,
    { advance } as unknown as MoldTrackingService,
    { create } as unknown as NotificationsService,
  );
}

const PAST_ISO = new Date(Date.now() - 60_000).toISOString();

const adminSundaya = { id: 'adm-1', role: Role.ADMIN_SUNDAYA } as unknown as PrismaUser;
const manager = { id: 'mgr-1', role: Role.MANAGER_PENYEWA } as unknown as PrismaUser;

const jobRow = { id: 'job-1', jobNumber: 'SSIP-1', managerId: 'mgr-1', moldId: 'mold-1' };

const row = (over: Record<string, unknown> = {}) => ({
  id: 'lt-1',
  jobId: 'job-1',
  item: ItemPengiriman.MOLD,
  diterimaAt: new Date('2026-08-06'),
  materialName: null,
  jumlahKg: null,
  noSuratJalan: null,
  kondisi: null,
  catatan: null,
  byId: 'adm-1',
  createdAt: new Date('2026-08-06'),
  ...over,
});

describe('PenerimaanService.create', () => {
  it('item MOLD memajukan tracking mold ke RECEIVED', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);
    prisma.logPenerimaan.create.mockResolvedValue(row());
    const advance = jest.fn();

    await svc(prisma, advance).create(adminSundaya, {
      jobId: 'job-1',
      item: ItemPengiriman.MOLD,
      diterimaAt: PAST_ISO,
    });

    expect(advance).toHaveBeenCalledWith(
      expect.anything(),
      'mold-1',
      MoldTrackingStatus.RECEIVED,
      'adm-1',
    );
  });

  it('item MATERIAL tidak menyentuh tracking mold', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);
    prisma.logPenerimaan.create.mockResolvedValue(
      row({ item: ItemPengiriman.MATERIAL, materialName: 'PP Resin', jumlahKg: 500 }),
    );
    const advance = jest.fn();

    await svc(prisma, advance).create(adminSundaya, {
      jobId: 'job-1',
      item: ItemPengiriman.MATERIAL,
      diterimaAt: PAST_ISO,
      materialName: 'PP Resin',
      jumlahKg: 500,
    });

    expect(advance).not.toHaveBeenCalled();
  });

  it('item MATERIAL tanpa jumlah -> 400, tidak menulis', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);

    await expect(
      svc(prisma).create(adminSundaya, {
        jobId: 'job-1',
        item: ItemPengiriman.MATERIAL,
        diterimaAt: PAST_ISO,
        materialName: 'PP Resin',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.logPenerimaan.create).not.toHaveBeenCalled();
  });

  it('memberi notifikasi ke Manager pemilik job', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);
    prisma.logPenerimaan.create.mockResolvedValue(row());
    const notify = jest.fn();

    await svc(prisma, jest.fn(), notify).create(adminSundaya, {
      jobId: 'job-1',
      item: ItemPengiriman.MOLD,
      diterimaAt: PAST_ISO,
    });

    expect(notify).toHaveBeenCalledWith(
      'mgr-1',
      expect.any(String),
      expect.stringContaining('SSIP-1'),
      '/pengiriman',
    );
  });

  it('job tidak ada -> 404', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(null);

    await expect(
      svc(prisma).create(adminSundaya, {
        jobId: 'x',
        item: ItemPengiriman.MOLD,
        diterimaAt: PAST_ISO,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PenerimaanService.list', () => {
  it('staf Sundaya melihat semua tenant', async () => {
    const prisma = prismaMock();
    prisma.logPenerimaan.findMany.mockResolvedValue([]);

    await svc(prisma).list(adminSundaya);

    expect(prisma.logPenerimaan.findMany.mock.calls[0][0].where.job).toBeUndefined();
  });

  it('Manager disaring ke job miliknya', async () => {
    const prisma = prismaMock();
    prisma.logPenerimaan.findMany.mockResolvedValue([]);

    await svc(prisma).list(manager);

    expect(prisma.logPenerimaan.findMany.mock.calls[0][0].where.job).toEqual({
      managerId: 'mgr-1',
    });
  });
});

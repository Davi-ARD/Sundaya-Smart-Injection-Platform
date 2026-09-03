import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MaterialType, ItemPengiriman, MoldTrackingStatus, Role } from '@mold-tracker/shared';
import { User as PrismaUser } from '@prisma/client';
import { PengirimanService } from './pengiriman.service';
import { PrismaService } from '../prisma/prisma.service';
import { MoldTrackingService } from '../molds/mold-tracking.service';
import { NotificationsService } from '../notifications/notifications.service';

function prismaMock() {
  const client = {
    job: { findUnique: jest.fn() },
    mold: { findFirst: jest.fn().mockResolvedValue({ kodeMold: 'MLD-001' }) },
    logPengiriman: { create: jest.fn(), findMany: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'adm-1' }]) },
  };
  return {
    ...client,
    $transaction: jest.fn().mockImplementation((fn: (tx: typeof client) => unknown) => fn(client)),
  };
}

function svc(
  prisma: ReturnType<typeof prismaMock>,
  advance = jest.fn(),
  createMany = jest.fn(),
) {
  return new PengirimanService(
    prisma as unknown as PrismaService,
    { advance } as unknown as MoldTrackingService,
    { createMany } as unknown as NotificationsService,
  );
}

const manager = {
  id: 'mgr-1',
  nama: 'Manager Nusantara',
  role: Role.MANAGER_PENYEWA,
} as unknown as PrismaUser;

const adminSundaya = { id: 'adm-1', role: Role.ADMIN_SUNDAYA } as unknown as PrismaUser;

const jobRow = { id: 'job-1', jobNumber: 'SSIP-1', managerId: 'mgr-1', moldId: 'mold-1' };

const row = (over: Record<string, unknown> = {}) => ({
  id: 'lp-1',
  jobId: 'job-1',
  moldId: 'mold-1',
  item: ItemPengiriman.MOLD,
  rencanaKirim: new Date('2026-08-05'),
  materialName: null,
  jumlahKg: null,
  noSuratJalan: null,
  catatan: null,
  byId: 'mgr-1',
  createdAt: new Date('2026-08-01'),
  ...over,
});

describe('PengirimanService.create', () => {
  it('item MOLD memajukan tracking mold ke DELIVERY', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);
    prisma.logPengiriman.create.mockResolvedValue(row());
    const advance = jest.fn();

    await svc(prisma, advance).create(manager, {
      jobId: 'job-1',
      item: ItemPengiriman.MOLD,
      moldId: 'mold-1',
      rencanaKirim: '2026-08-05T00:00:00.000Z',
    });

    expect(advance).toHaveBeenCalledWith(
      expect.anything(),
      'mold-1',
      MoldTrackingStatus.DELIVERY,
      'mgr-1',
    );
  });

  it('item MATERIAL tidak menyentuh tracking mold', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);
    prisma.logPengiriman.create.mockResolvedValue(
      row({ item: ItemPengiriman.MATERIAL, materialName: MaterialType.PP, jumlahKg: 500 }),
    );
    const advance = jest.fn();

    await svc(prisma, advance).create(manager, {
      jobId: 'job-1',
      item: ItemPengiriman.MATERIAL,
      rencanaKirim: '2026-08-05T00:00:00.000Z',
      materialName: MaterialType.PP,
      jumlahKg: 500,
    });

    expect(advance).not.toHaveBeenCalled();
  });

  it('item MATERIAL tanpa nama atau jumlah -> 400, tidak menulis', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);

    await expect(
      svc(prisma).create(manager, {
        jobId: 'job-1',
        item: ItemPengiriman.MATERIAL,
        rencanaKirim: '2026-08-05T00:00:00.000Z',
        materialName: MaterialType.PP,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.logPengiriman.create).not.toHaveBeenCalled();
  });

  it('item MOLD tanpa moldId -> 400: booking bisa memuat beberapa cetakan', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);

    await expect(
      svc(prisma).create(manager, {
        jobId: 'job-1',
        item: ItemPengiriman.MOLD,
        rencanaKirim: '2026-08-05T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.logPengiriman.create).not.toHaveBeenCalled();
  });

  it('cetakan di luar booking -> 404', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);
    // findFirst menyaring jobId, jadi cetakan booking lain tidak ketemu.
    prisma.mold.findFirst.mockResolvedValue(null);

    await expect(
      svc(prisma).create(manager, {
        jobId: 'job-1',
        item: ItemPengiriman.MOLD,
        moldId: 'mold-9',
        rencanaKirim: '2026-08-05T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.logPengiriman.create).not.toHaveBeenCalled();
  });

  it('memberi tahu Admin Penyewa tenant itu, menaut ke Log Aktivitas', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);
    prisma.logPengiriman.create.mockResolvedValue(row());
    // Panggilan pertama: Admin Penyewa (anak Manager). Kedua: staf Sundaya.
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: 'ap-1' }])
      .mockResolvedValueOnce([{ id: 'adm-1' }]);
    const createMany = jest.fn();

    await svc(prisma, jest.fn(), createMany).create(manager, {
      jobId: 'job-1',
      item: ItemPengiriman.MOLD,
      moldId: 'mold-1',
      rencanaKirim: '2026-08-05T00:00:00.000Z',
    });

    // Admin Penyewa disaring lewat parentId = managerId job, bukan seluruh tenant.
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ parentId: 'mgr-1', isActive: true }),
      }),
    );
    expect(createMany).toHaveBeenNthCalledWith(
      1,
      ['ap-1'],
      'Barang dalam perjalanan',
      expect.stringContaining('SSIP-1'),
      '/penerimaan',
    );
  });

  it('staf Sundaya ikut diberi tahu, tanpa tautan ke halaman milik penyewa', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);
    prisma.logPengiriman.create.mockResolvedValue(row());
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: 'ap-1' }])
      .mockResolvedValueOnce([{ id: 'adm-1' }]);
    const createMany = jest.fn();

    await svc(prisma, jest.fn(), createMany).create(manager, {
      jobId: 'job-1',
      item: ItemPengiriman.MOLD,
      moldId: 'mold-1',
      rencanaKirim: '2026-08-05T00:00:00.000Z',
    });

    expect(createMany).toHaveBeenNthCalledWith(
      2,
      ['adm-1'],
      'Rencana pengiriman baru',
      expect.stringContaining('SSIP-1'),
    );
  });

  it('job tenant lain -> 404, tidak menulis dan tidak menotifikasi', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ ...jobRow, managerId: 'lain' });
    const createMany = jest.fn();

    await expect(
      svc(prisma, jest.fn(), createMany).create(manager, {
        jobId: 'job-1',
        item: ItemPengiriman.MOLD,
        moldId: 'mold-1',
        rencanaKirim: '2026-08-05T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.logPengiriman.create).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
  });
});

describe('PengirimanService.list', () => {
  it('Manager disaring ke job miliknya', async () => {
    const prisma = prismaMock();
    prisma.logPengiriman.findMany.mockResolvedValue([{ ...row(), job: { jobNumber: 'SSIP-1' }, mold: { kodeMold: 'MLD-001' } }]);

    await svc(prisma).list(manager);

    expect(prisma.logPengiriman.findMany.mock.calls[0][0].where.job).toEqual({
      managerId: 'mgr-1',
    });
  });

  it('staf Sundaya melihat semua tenant', async () => {
    const prisma = prismaMock();
    prisma.logPengiriman.findMany.mockResolvedValue([]);

    await svc(prisma).list(adminSundaya);

    expect(prisma.logPengiriman.findMany.mock.calls[0][0].where.job).toBeUndefined();
  });
});

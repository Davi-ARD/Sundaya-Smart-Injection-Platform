import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MaterialType, ItemPengiriman, KondisiBarang, MoldTrackingStatus, Role } from '@mold-tracker/shared';
import { User as PrismaUser } from '@prisma/client';
import { PenerimaanService } from './penerimaan.service';
import { PrismaService } from '../prisma/prisma.service';
import { MoldTrackingService } from '../molds/mold-tracking.service';
import { NotificationsService } from '../notifications/notifications.service';

function prismaMock() {
  const client = {
    job: { findUnique: jest.fn() },
    mold: { findFirst: jest.fn().mockResolvedValue({ kodeMold: 'MLD-001' }) },
    logPenerimaan: { create: jest.fn(), findMany: jest.fn() },
    logPengiriman: { findMany: jest.fn().mockResolvedValue([]) },
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
const adminPenyewa = {
  id: 'ap-1',
  role: Role.ADMIN_PENYEWA,
  parentId: 'mgr-1',
} as unknown as PrismaUser;

const jobRow = { id: 'job-1', jobNumber: 'SSIP-1', managerId: 'mgr-1', moldId: 'mold-1' };

const row = (over: Record<string, unknown> = {}) => ({
  id: 'lt-1',
  jobId: 'job-1',
  moldId: 'mold-1',
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
      moldId: 'mold-1',
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
      row({ item: ItemPengiriman.MATERIAL, materialName: MaterialType.PP, jumlahKg: 500 }),
    );
    const advance = jest.fn();

    await svc(prisma, advance).create(adminSundaya, {
      jobId: 'job-1',
      item: ItemPengiriman.MATERIAL,
      diterimaAt: PAST_ISO,
      materialName: MaterialType.PP,
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
        materialName: MaterialType.PP,
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
      moldId: 'mold-1',
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
        moldId: 'mold-1',
        diterimaAt: PAST_ISO,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PenerimaanService.create (penjagaan tenant Admin Penyewa)', () => {
  const dtoMold = {
    jobId: 'job-1',
    moldId: 'mold-1',
    item: ItemPengiriman.MOLD,
    diterimaAt: PAST_ISO,
  };

  it('Admin Penyewa boleh mencatat penerimaan job tenantnya sendiri', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow); // managerId 'mgr-1' = parentId aktor
    prisma.logPenerimaan.create.mockResolvedValue(row());
    const advance = jest.fn();

    await svc(prisma, advance).create(adminPenyewa, dtoMold);

    expect(prisma.logPenerimaan.create).toHaveBeenCalled();
    expect(advance).toHaveBeenCalledWith(
      expect.anything(),
      'mold-1',
      MoldTrackingStatus.RECEIVED,
      'ap-1',
    );
  });

  it('Admin Penyewa ditolak 404 pada job tenant lain, tidak menulis apa pun', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ ...jobRow, managerId: 'mgr-lain' });

    await expect(svc(prisma).create(adminPenyewa, dtoMold)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.logPenerimaan.create).not.toHaveBeenCalled();
  });
});

describe('PenerimaanService.create (catatan wajib untuk kondisi bermasalah)', () => {
  const dasar = {
    jobId: 'job-1',
    moldId: 'mold-1',
    item: ItemPengiriman.MOLD,
    diterimaAt: PAST_ISO,
  };

  it.each([KondisiBarang.CUKUP_BAIK, KondisiBarang.TIDAK_BAIK])(
    'kondisi %s tanpa catatan -> 400 dan tidak menulis apa pun',
    async (kondisi) => {
      const prisma = prismaMock();
      prisma.job.findUnique.mockResolvedValue(jobRow);

      await expect(
        svc(prisma).create(adminPenyewa, { ...dasar, kondisi }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.logPenerimaan.create).not.toHaveBeenCalled();
    },
  );

  it('catatan berisi spasi saja dianggap kosong', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);

    await expect(
      svc(prisma).create(adminPenyewa, {
        ...dasar,
        kondisi: KondisiBarang.TIDAK_BAIK,
        catatan: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.logPenerimaan.create).not.toHaveBeenCalled();
  });

  it('kondisi bermasalah dengan catatan terisi -> tersimpan', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);
    prisma.logPenerimaan.create.mockResolvedValue(row({ kondisi: KondisiBarang.CUKUP_BAIK }));

    await svc(prisma).create(adminPenyewa, {
      ...dasar,
      kondisi: KondisiBarang.CUKUP_BAIK,
      catatan: 'Plat cetakan berkarat di sisi kanan',
    });

    expect(prisma.logPenerimaan.create).toHaveBeenCalled();
  });

  it('kondisi BAIK tidak menuntut catatan', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);
    prisma.logPenerimaan.create.mockResolvedValue(row({ kondisi: KondisiBarang.BAIK }));

    await svc(prisma).create(adminPenyewa, { ...dasar, kondisi: KondisiBarang.BAIK });

    expect(prisma.logPenerimaan.create).toHaveBeenCalled();
  });
});

describe('PenerimaanService.create (nomor surat jalan harus cocok rencana Manager)', () => {
  const dasarMaterial = {
    jobId: 'job-1',
    item: ItemPengiriman.MATERIAL,
    diterimaAt: PAST_ISO,
    materialName: MaterialType.PP,
    jumlahKg: 100,
  };

  it('nomor yang tidak ada di rencana Manager -> 400 dan tidak menulis', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);
    prisma.logPengiriman.findMany.mockResolvedValue([{ noSuratJalan: 'SJ-001' }]);

    await expect(
      svc(prisma).create(adminPenyewa, { ...dasarMaterial, noSuratJalan: 'SJ-999' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.logPenerimaan.create).not.toHaveBeenCalled();
  });

  it('nomor yang cocok -> tersimpan', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);
    prisma.logPengiriman.findMany.mockResolvedValue([{ noSuratJalan: 'SJ-001' }]);
    prisma.logPenerimaan.create.mockResolvedValue(row({ item: ItemPengiriman.MATERIAL }));

    await svc(prisma).create(adminPenyewa, { ...dasarMaterial, noSuratJalan: 'SJ-001' });

    expect(prisma.logPenerimaan.create).toHaveBeenCalled();
  });

  it('cocok meski beda huruf besar-kecil dan berspasi', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);
    prisma.logPengiriman.findMany.mockResolvedValue([{ noSuratJalan: 'SJ-001' }]);
    prisma.logPenerimaan.create.mockResolvedValue(row({ item: ItemPengiriman.MATERIAL }));

    await svc(prisma).create(adminPenyewa, { ...dasarMaterial, noSuratJalan: '  sj-001 ' });

    expect(prisma.logPenerimaan.create).toHaveBeenCalled();
  });

  it('cocok dengan salah satu dari beberapa rencana', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);
    prisma.logPengiriman.findMany.mockResolvedValue([
      { noSuratJalan: 'SJ-001' },
      { noSuratJalan: 'SJ-002' },
    ]);
    prisma.logPenerimaan.create.mockResolvedValue(row({ item: ItemPengiriman.MATERIAL }));

    await svc(prisma).create(adminPenyewa, { ...dasarMaterial, noSuratJalan: 'SJ-002' });

    expect(prisma.logPenerimaan.create).toHaveBeenCalled();
  });

  it('job tanpa rencana bernomor: tidak ada acuan, jadi tidak diblokir', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow);
    prisma.logPengiriman.findMany.mockResolvedValue([]);
    prisma.logPenerimaan.create.mockResolvedValue(row({ item: ItemPengiriman.MATERIAL }));

    await svc(prisma).create(adminPenyewa, { ...dasarMaterial, noSuratJalan: 'SJ-BEBAS' });

    expect(prisma.logPenerimaan.create).toHaveBeenCalled();
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

  it('Admin Penyewa disaring lewat parentId, bukan id-nya sendiri', async () => {
    const prisma = prismaMock();
    prisma.logPenerimaan.findMany.mockResolvedValue([]);

    await svc(prisma).list(adminPenyewa);

    expect(prisma.logPenerimaan.findMany.mock.calls[0][0].where.job).toEqual({
      managerId: 'mgr-1',
    });
  });
});

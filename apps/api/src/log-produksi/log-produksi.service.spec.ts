import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LogProduksiEventType, ProgressMolding, Role } from '@mold-tracker/shared';
import { User as PrismaUser } from '@prisma/client';
import { LogProduksiService } from './log-produksi.service';
import { PrismaService } from '../prisma/prisma.service';

function prismaMock() {
  return {
    job: { findUnique: jest.fn() },
    logProduksi: { findMany: jest.fn(), create: jest.fn() },
  };
}

function svc(prisma: ReturnType<typeof prismaMock>) {
  return new LogProduksiService(prisma as unknown as PrismaService);
}

const adminPenyewa = { id: 'ap-1', role: Role.ADMIN_PENYEWA, parentId: 'mgr-1' } as unknown as PrismaUser;

// Row lengkap: toLogProduksi butuh semua field (tanggal harus Date).
const logRow = (over: Record<string, unknown>) => ({
  id: 'log-1',
  jobId: 'job-1',
  eventType: LogProduksiEventType.MATERIAL_DATANG,
  occurredAt: new Date('2026-08-01'),
  byId: 'ap-1',
  catatan: null,
  materialName: null,
  jumlahKg: null,
  noSuratJalan: null,
  goodProduct: null,
  rejectCount: null,
  materialRemainingKg: null,
  progressMolding: null,
  keteranganProgress: null,
  createdAt: new Date('2026-08-01'),
  ...over,
});

describe('LogProduksiService.append', () => {
  it('MATERIAL_DATANG: simpan field material + byId actor + occurredAt', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1' });
    prisma.logProduksi.create.mockResolvedValue(logRow({}));

    await svc(prisma).append(adminPenyewa, 'job-1', {
      eventType: LogProduksiEventType.MATERIAL_DATANG,
      occurredAt: '2026-08-01T00:00:00.000Z',
      materialName: 'PP Resin',
      jumlahKg: 500,
    } as never);

    const data = prisma.logProduksi.create.mock.calls[0][0].data;
    expect(data.byId).toBe('ap-1');
    expect(data.materialName).toBe('PP Resin');
    expect(data.jumlahKg).toBe(500);
    expect(data.occurredAt).toBeInstanceOf(Date);
    // Field lintas-tipe tidak ikut.
    expect(data.goodProduct).toBeUndefined();
  });

  it('MATERIAL_DATANG tanpa jumlahKg -> 400, tidak menulis', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1' });
    await expect(
      svc(prisma).append(adminPenyewa, 'job-1', {
        eventType: LogProduksiEventType.MATERIAL_DATANG,
        occurredAt: '2026-08-01T00:00:00.000Z',
        materialName: 'PP Resin',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.logProduksi.create).not.toHaveBeenCalled();
  });

  it('PRODUKSI_HARIAN tanpa goodProduct -> 400', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1' });
    await expect(
      svc(prisma).append(adminPenyewa, 'job-1', {
        eventType: LogProduksiEventType.PRODUKSI_HARIAN,
        occurredAt: '2026-08-01T00:00:00.000Z',
        rejectCount: 2,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PROGRESS_MOLDING tanpa progressMolding -> 400', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1' });
    await expect(
      svc(prisma).append(adminPenyewa, 'job-1', {
        eventType: LogProduksiEventType.PROGRESS_MOLDING,
        occurredAt: '2026-08-01T00:00:00.000Z',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PROGRESS_MOLDING sukses simpan enum', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1' });
    prisma.logProduksi.create.mockResolvedValue(
      logRow({ eventType: LogProduksiEventType.PROGRESS_MOLDING, progressMolding: ProgressMolding.ONGOING }),
    );
    await svc(prisma).append(adminPenyewa, 'job-1', {
      eventType: LogProduksiEventType.PROGRESS_MOLDING,
      occurredAt: '2026-08-01T00:00:00.000Z',
      progressMolding: ProgressMolding.ONGOING,
    } as never);
    expect(prisma.logProduksi.create.mock.calls[0][0].data.progressMolding).toBe(ProgressMolding.ONGOING);
  });

  it('job tenant lain (managerId != parentId) -> 404, tidak menulis', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'other' });
    await expect(
      svc(prisma).append(adminPenyewa, 'job-1', {
        eventType: LogProduksiEventType.MATERIAL_DATANG,
        occurredAt: '2026-08-01T00:00:00.000Z',
        materialName: 'X',
        jumlahKg: 1,
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.logProduksi.create).not.toHaveBeenCalled();
  });
});

describe('LogProduksiService.findAll', () => {
  it('timeline job milik tenant, urut occurredAt asc', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1' });
    prisma.logProduksi.findMany.mockResolvedValue([logRow({})]);
    const result = await svc(prisma).findAll(adminPenyewa, 'job-1');
    expect(prisma.logProduksi.findMany.mock.calls[0][0]).toEqual({
      where: { jobId: 'job-1' },
      orderBy: { occurredAt: 'asc' },
    });
    expect(result).toHaveLength(1);
  });

  it('job tidak ada -> 404', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(null);
    await expect(svc(prisma).findAll(adminPenyewa, 'x')).rejects.toBeInstanceOf(NotFoundException);
  });
});

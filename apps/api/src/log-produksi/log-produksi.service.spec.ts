import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LogProduksiEventType, ProgressMolding, Role } from '@mold-tracker/shared';
import { User as PrismaUser } from '@prisma/client';
import { LogProduksiService } from './log-produksi.service';
import { PrismaService } from '../prisma/prisma.service';
import { MoldTrackingService } from '../molds/mold-tracking.service';

// append berjalan di dalam $transaction: mock meneruskan klien tx yang sama supaya
// panggilan create di dalam callback tetap bisa diperiksa.
function prismaMock() {
  const client = {
    job: { findUnique: jest.fn() },
    // Cetakan harus bagian dari booking (findFirst dengan jobId di where); plan kosong
    // berarti tanpa batas.
    mold: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'mold-1',
        kodeMold: 'MLD-001',
        namaProduk: 'Panel',
        tonaseTon: 100,
        targetOutput: null,
        estimasiKg: null,
      }),
    },
    // Mesin harus salah satu mesin booking dan tonasenya cukup.
    machine: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'mesin-1',
        machineNumber: 'IM-001',
        tonaseTon: 150,
      }),
    },
    logProduksi: {
      findMany: jest.fn(),
      create: jest.fn(),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { goodProduct: null, materialUsedKg: null } }),
    },
  };
  return {
    ...client,
    $transaction: jest.fn().mockImplementation((fn: (tx: typeof client) => unknown) => fn(client)),
  };
}

// MoldTrackingService.advance dipanggil saat PRODUKSI_HARIAN; di-stub agar
// pengujian di sini fokus ke aturan Layer 2.
function svc(prisma: ReturnType<typeof prismaMock>, advance = jest.fn()) {
  return new LogProduksiService(prisma as unknown as PrismaService, {
    advance,
  } as unknown as MoldTrackingService);
}

const PAST_ISO = new Date(Date.now() - 60_000).toISOString();

const adminPenyewa = { id: 'ap-1', role: Role.ADMIN_PENYEWA, parentId: 'mgr-1' } as unknown as PrismaUser;

// Row lengkap: toLogProduksi butuh semua field (tanggal harus Date).
const logRow = (over: Record<string, unknown>) => ({
  id: 'log-1',
  jobId: 'job-1',
  moldId: 'mold-1',
  machineId: null,
  eventType: LogProduksiEventType.MATERIAL_DATANG,
  occurredAt: new Date('2026-08-01'),
  byId: 'ap-1',
  catatan: null,
  materialName: null,
  jumlahKg: null,
  noSuratJalan: null,
  goodProduct: null,
  rejectCount: null,
  materialUsedKg: null,
  progressMolding: null,
  keteranganProgress: null,
  createdAt: new Date('2026-08-01'),
  ...over,
});

describe('LogProduksiService.append', () => {
  it('MATERIAL_DATANG: simpan field material + byId actor + occurredAt', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1', moldId: 'mold-1' });
    prisma.logProduksi.create.mockResolvedValue(logRow({}));

    await svc(prisma).append(adminPenyewa, 'job-1', {
      moldId: 'mold-1',
      eventType: LogProduksiEventType.MATERIAL_DATANG,
      occurredAt: PAST_ISO,
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
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1', moldId: 'mold-1' });
    await expect(
      svc(prisma).append(adminPenyewa, 'job-1', {
        moldId: 'mold-1',
      eventType: LogProduksiEventType.MATERIAL_DATANG,
        occurredAt: PAST_ISO,
        materialName: 'PP Resin',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.logProduksi.create).not.toHaveBeenCalled();
  });

  it('PRODUKSI_HARIAN tanpa goodProduct -> 400', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1', moldId: 'mold-1' });
    await expect(
      svc(prisma).append(adminPenyewa, 'job-1', {
        moldId: 'mold-1',
      eventType: LogProduksiEventType.PRODUKSI_HARIAN,
        occurredAt: PAST_ISO,
        rejectCount: 2,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PROGRESS_MOLDING tanpa progressMolding -> 400', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1', moldId: 'mold-1' });
    await expect(
      svc(prisma).append(adminPenyewa, 'job-1', {
        moldId: 'mold-1',
      eventType: LogProduksiEventType.PROGRESS_MOLDING,
        machineId: 'mesin-1',
        occurredAt: PAST_ISO,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('PROGRESS_MOLDING sukses simpan enum', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1', moldId: 'mold-1' });
    prisma.logProduksi.create.mockResolvedValue(
      logRow({ eventType: LogProduksiEventType.PROGRESS_MOLDING, progressMolding: ProgressMolding.ONGOING }),
    );
    await svc(prisma).append(adminPenyewa, 'job-1', {
      moldId: 'mold-1',
      eventType: LogProduksiEventType.PROGRESS_MOLDING,
      machineId: 'mesin-1',
      occurredAt: PAST_ISO,
      progressMolding: ProgressMolding.ONGOING,
    } as never);
    expect(prisma.logProduksi.create.mock.calls[0][0].data.progressMolding).toBe(ProgressMolding.ONGOING);
  });

  it('PRODUKSI_HARIAN memajukan tracking mold ke PRODUCTION', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1', moldId: 'mold-1' });
    prisma.logProduksi.create.mockResolvedValue(
      logRow({ eventType: LogProduksiEventType.PRODUKSI_HARIAN, goodProduct: 100, rejectCount: 2 }),
    );
    const advance = jest.fn();

    await svc(prisma, advance).append(adminPenyewa, 'job-1', {
      moldId: 'mold-1',
      eventType: LogProduksiEventType.PRODUKSI_HARIAN,
      machineId: 'mesin-1',
      occurredAt: PAST_ISO,
      goodProduct: 100,
      rejectCount: 2,
    } as never);

    expect(advance).toHaveBeenCalledWith(expect.anything(), 'mold-1', 'PRODUCTION', 'ap-1');
  });

  it('event selain PRODUKSI_HARIAN tidak menyentuh tracking mold', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1', moldId: 'mold-1' });
    prisma.logProduksi.create.mockResolvedValue(logRow({}));
    const advance = jest.fn();

    await svc(prisma, advance).append(adminPenyewa, 'job-1', {
      moldId: 'mold-1',
      eventType: LogProduksiEventType.MATERIAL_DATANG,
      occurredAt: PAST_ISO,
      materialName: 'PP Resin',
      jumlahKg: 500,
    } as never);

    expect(advance).not.toHaveBeenCalled();
  });

  it('produk baik melewati target cetakan -> 400, tidak menulis', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1' });
    prisma.mold.findFirst.mockResolvedValue({
      id: 'mold-1',
      kodeMold: 'MLD-001',
      namaProduk: 'Panel',
      tonaseTon: 100,
      targetOutput: 500,
      estimasiKg: null,
    });
    prisma.logProduksi.aggregate.mockResolvedValue({
      _sum: { goodProduct: 480, materialUsedKg: null },
    });

    await expect(
      svc(prisma).append(adminPenyewa, 'job-1', {
        moldId: 'mold-1',
        eventType: LogProduksiEventType.PRODUKSI_HARIAN,
        machineId: 'mesin-1',
        occurredAt: PAST_ISO,
        goodProduct: 50,
        rejectCount: 0,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.logProduksi.create).not.toHaveBeenCalled();
  });

  it('material terpakai melewati plan cetakan -> 400, tidak menulis', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1' });
    prisma.mold.findFirst.mockResolvedValue({
      id: 'mold-1',
      kodeMold: 'MLD-001',
      namaProduk: 'Panel',
      tonaseTon: 100,
      targetOutput: null,
      estimasiKg: 500,
    });
    prisma.logProduksi.aggregate.mockResolvedValue({
      _sum: { goodProduct: null, materialUsedKg: 460 },
    });

    await expect(
      svc(prisma).append(adminPenyewa, 'job-1', {
        moldId: 'mold-1',
        eventType: LogProduksiEventType.PRODUKSI_HARIAN,
        machineId: 'mesin-1',
        occurredAt: PAST_ISO,
        goodProduct: 10,
        rejectCount: 0,
        materialUsedKg: 60,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.logProduksi.create).not.toHaveBeenCalled();
  });

  it('tepat sampai batas plan masih diterima', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1' });
    prisma.mold.findFirst.mockResolvedValue({
      id: 'mold-1',
      kodeMold: 'MLD-001',
      namaProduk: 'Panel',
      tonaseTon: 100,
      targetOutput: 500,
      estimasiKg: 500,
    });
    prisma.logProduksi.aggregate.mockResolvedValue({
      _sum: { goodProduct: 450, materialUsedKg: 450 },
    });
    prisma.logProduksi.create.mockResolvedValue(
      logRow({ eventType: LogProduksiEventType.PRODUKSI_HARIAN, goodProduct: 50 }),
    );

    await svc(prisma).append(adminPenyewa, 'job-1', {
      moldId: 'mold-1',
      eventType: LogProduksiEventType.PRODUKSI_HARIAN,
      machineId: 'mesin-1',
      occurredAt: PAST_ISO,
      goodProduct: 50,
      rejectCount: 0,
      materialUsedKg: 50,
    } as never);

    expect(prisma.logProduksi.create).toHaveBeenCalled();
  });

  it('cetakan di luar booking -> 404', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1' });
    // findFirst menyaring jobId, jadi cetakan booking lain tidak ketemu.
    prisma.mold.findFirst.mockResolvedValue(null);

    await expect(
      svc(prisma).append(adminPenyewa, 'job-1', {
        moldId: 'mold-9',
        eventType: LogProduksiEventType.PRODUKSI_HARIAN,
        machineId: 'mesin-1',
        occurredAt: PAST_ISO,
        goodProduct: 1,
        rejectCount: 0,
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('PRODUKSI_HARIAN tanpa machineId -> 400: log harus menyebut mesinnya', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1' });

    await expect(
      svc(prisma).append(adminPenyewa, 'job-1', {
        moldId: 'mold-1',
        eventType: LogProduksiEventType.PRODUKSI_HARIAN,
        occurredAt: PAST_ISO,
        goodProduct: 10,
        rejectCount: 0,
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.logProduksi.create).not.toHaveBeenCalled();
  });

  it('mesin di luar booking -> 404', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1' });
    prisma.machine.findFirst.mockResolvedValue(null);

    await expect(
      svc(prisma).append(adminPenyewa, 'job-1', {
        moldId: 'mold-1',
        eventType: LogProduksiEventType.PRODUKSI_HARIAN,
        machineId: 'mesin-lain',
        occurredAt: PAST_ISO,
        goodProduct: 10,
        rejectCount: 0,
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('mesin bertonase di bawah cetakan -> 400 walau mesin ada di booking', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1' });
    prisma.mold.findFirst.mockResolvedValue({
      id: 'mold-1',
      kodeMold: 'MLD-001',
      namaProduk: 'Panel',
      tonaseTon: 200,
      targetOutput: null,
      estimasiKg: null,
    });
    prisma.machine.findFirst.mockResolvedValue({
      id: 'mesin-1',
      machineNumber: 'IM-001',
      tonaseTon: 150,
    });

    await expect(
      svc(prisma).append(adminPenyewa, 'job-1', {
        moldId: 'mold-1',
        eventType: LogProduksiEventType.PRODUKSI_HARIAN,
        machineId: 'mesin-1',
        occurredAt: PAST_ISO,
        goodProduct: 10,
        rejectCount: 0,
      } as never),
    ).rejects.toThrow(/IM-001/);
    expect(prisma.logProduksi.create).not.toHaveBeenCalled();
  });

  it('MATERIAL_DATANG tidak menyimpan mesin', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1' });
    prisma.logProduksi.create.mockResolvedValue(logRow({}));

    await svc(prisma).append(adminPenyewa, 'job-1', {
      moldId: 'mold-1',
      eventType: LogProduksiEventType.MATERIAL_DATANG,
      occurredAt: PAST_ISO,
      materialName: 'PP Resin',
      jumlahKg: 500,
    } as never);

    expect(prisma.logProduksi.create.mock.calls[0][0].data.machineId).toBeNull();
    expect(prisma.machine.findFirst).not.toHaveBeenCalled();
  });

  it('job tenant lain (managerId != parentId) -> 404, tidak menulis', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'other' });
    await expect(
      svc(prisma).append(adminPenyewa, 'job-1', {
        moldId: 'mold-1',
      eventType: LogProduksiEventType.MATERIAL_DATANG,
        occurredAt: PAST_ISO,
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
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', managerId: 'mgr-1', moldId: 'mold-1' });
    prisma.logProduksi.findMany.mockResolvedValue([
      { ...logRow({}), mold: { kodeMold: 'MLD-001' }, machine: { machineNumber: 'IM-001' } },
    ]);
    const result = await svc(prisma).findAll(adminPenyewa, 'job-1');
    const args = prisma.logProduksi.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ jobId: 'job-1' });
    expect(args.orderBy).toEqual({ occurredAt: 'asc' });
    expect(result[0].kodeMold).toBe('MLD-001');
    expect(result[0].machineNumber).toBe('IM-001');
  });

  it('job tidak ada -> 404', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(null);
    await expect(svc(prisma).findAll(adminPenyewa, 'x')).rejects.toBeInstanceOf(NotFoundException);
  });
});

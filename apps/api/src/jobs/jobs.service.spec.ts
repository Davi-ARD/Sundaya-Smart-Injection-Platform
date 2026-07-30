import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ExtensionStatus, JobLifecycle, MachineStatus, Role } from '@mold-tracker/shared';
import { User as PrismaUser } from '@prisma/client';
import { JobsService } from './jobs.service';
import { PrismaService } from '../prisma/prisma.service';

function prismaMock() {
  return {
    job: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    machine: { findUnique: jest.fn(), update: jest.fn() },
    mold: { findUnique: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    rentalExtension: {
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    // Bentuk array dipakai assign dan transisi lifecycle; create dan reject
    // memakai bentuk callback dan menimpanya per test.
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.resolve(ops)),
  };
}

const adminSundaya = { id: 'admin-1', role: Role.ADMIN_SUNDAYA } as unknown as PrismaUser;
const manager = { id: 'mgr-1', role: Role.MANAGER_PENYEWA } as unknown as PrismaUser;

function jobRow(o: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    jobNumber: 'SSIP-0001',
    managerId: 'mgr-1',
    assignedById: null,
    lifecycle: 'DIAJUKAN',
    jobStatus: 'ON_SCHEDULE',
    requestedMachineCount: 1,
    requestedDurationDays: 30,
    startDate: null,
    endDate: null,
    catatan: null,
    confirmedAt: null,
    shippedAt: null,
    receivedAt: null,
    returnedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-07-01'),
    molds: [],
    machines: [],
    extensions: [],
    ...o,
  };
}

const machineTersedia = {
  id: 'm-1',
  machineNumber: 'IM-03',
  status: 'TERSEDIA',
  tonaseTon: 150,
};

// Mesin yang sudah dipinjamkan ke booking, dipakai test lepas mesin.
const machineDipinjam = (o: Record<string, unknown> = {}) => ({
  id: 'm-1',
  status: 'DIKONFIRMASI',
  ...o,
});

describe('JobsService.create (booking)', () => {
  const dto = {
    moldIds: ['mold-1', 'mold-2'],
    requestedMachineCount: 2,
    requestedDurationDays: 30,
    startDate: '2026-08-01T00:00:00.000Z',
    catatan: 'Kirim bertahap',
  };

  // create membuat job lalu menautkan cetakan di satu transaksi callback.
  function mockCreateTx(prisma: ReturnType<typeof prismaMock>, row: Record<string, unknown>) {
    const tx = {
      job: {
        create: jest.fn().mockResolvedValue({ id: 'job-1' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(row),
      },
      mold: { updateMany: jest.fn() },
    };
    // Sekuens nomor job diambil di dalam transaksi yang sama.
    (tx.job as unknown as { count: jest.Mock }).count = jest.fn().mockResolvedValue(4);
    prisma.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
    return tx;
  }

  it('booking sukses: managerId actor, lifecycle DIAJUKAN, jumlah mesin tersimpan', async () => {
    const prisma = prismaMock();
    prisma.mold.findMany.mockResolvedValue([
      { id: 'mold-1', kodeMold: 'MLD-1', jobId: null },
      { id: 'mold-2', kodeMold: 'MLD-2', jobId: null },
    ]);
    const tx = mockCreateTx(prisma, jobRow({ startDate: new Date('2026-08-01') }));

    const service = new JobsService(prisma as unknown as PrismaService);
    const result = await service.create(manager, dto);

    const data = tx.job.create.mock.calls[0][0].data;
    expect(data.managerId).toBe('mgr-1');
    expect(data.catatan).toBe('Kirim bertahap');
    expect(data.lifecycle).toBeUndefined(); // default DIAJUKAN dari schema
    expect(data.requestedMachineCount).toBe(2);
    // Nomor job menyebut kode cetakannya plus sekuens, bukan timestamp acak.
    expect(data.jobNumber).toBe('JOB-MLD1-MLD2-005');
    // Cetakan ditautkan ke job, bukan disimpan sebagai kolom di Job.
    expect(tx.mold.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['mold-1', 'mold-2'] } },
      data: { jobId: 'job-1' },
    });
    expect(result.lifecycle).toBe(JobLifecycle.DIAJUKAN);
  });

  it('404 bila sebagian cetakan bukan milik Manager (tidak bocorkan tenant lain)', async () => {
    const prisma = prismaMock();
    prisma.mold.findMany.mockResolvedValue([{ id: 'mold-1', kodeMold: 'MLD-1', jobId: null }]);

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.create(manager, dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('409 bila cetakan sudah dibooking, sebut kodenya', async () => {
    const prisma = prismaMock();
    prisma.mold.findMany.mockResolvedValue([
      { id: 'mold-1', kodeMold: 'MLD-1', jobId: null },
      { id: 'mold-2', kodeMold: 'MLD-2', jobId: 'job-lain' },
    ]);

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.create(manager, dto)).rejects.toThrow(/MLD-2/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('JobsService.assign (pinjamkan mesin)', () => {
  const jobDiajukan = (o: Record<string, unknown> = {}) => ({
    id: 'job-1',
    lifecycle: 'DIAJUKAN',
    molds: [{ kodeMold: 'MLD-1', tonaseTon: 150 }],
    machines: [],
    ...o,
  });

  it('mesin pertama menyetujui booking dan keluar dari TERSEDIA', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobDiajukan());
    prisma.machine.findUnique.mockResolvedValue(machineTersedia);
    prisma.job.update.mockReturnValue(
      jobRow({
        assignedById: 'admin-1',
        lifecycle: 'DIKONFIRMASI',
        machines: [machineDipinjam({ machineNumber: 'IM-03', tonaseTon: 150 })],
      }),
    );
    prisma.machine.update.mockReturnValue(machineTersedia);

    const service = new JobsService(prisma as unknown as PrismaService);
    const result = await service.assign(adminSundaya, 'job-1', { machineId: 'm-1' });

    const jobData = prisma.job.update.mock.calls[0][0].data;
    expect(jobData.machines).toEqual({ connect: { id: 'm-1' } });
    expect(jobData.assignedById).toBe('admin-1');
    expect(jobData.lifecycle).toBe(JobLifecycle.DIKONFIRMASI);
    expect(jobData.confirmedAt).toBeInstanceOf(Date);
    expect(prisma.machine.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { status: MachineStatus.DIKONFIRMASI },
    });
    expect(result.lifecycle).toBe(JobLifecycle.DIKONFIRMASI);
    expect(result.machines).toHaveLength(1);
  });

  it('mesin kedua hanya menambah, tidak menyetujui ulang', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(
      jobDiajukan({ lifecycle: 'DIKONFIRMASI', machines: [{ id: 'm-0' }] }),
    );
    prisma.machine.findUnique.mockResolvedValue(machineTersedia);
    prisma.job.update.mockReturnValue(jobRow({ lifecycle: 'DIKONFIRMASI' }));
    prisma.machine.update.mockReturnValue(machineTersedia);

    const service = new JobsService(prisma as unknown as PrismaService);
    await service.assign(adminSundaya, 'job-1', { machineId: 'm-1' });

    const jobData = prisma.job.update.mock.calls[0][0].data;
    expect(jobData.machines).toEqual({ connect: { id: 'm-1' } });
    expect(jobData.lifecycle).toBeUndefined();
    expect(jobData.confirmedAt).toBeUndefined();
  });

  it('menolak mesin yang sudah dipinjamkan ke booking ini (409)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(
      jobDiajukan({ lifecycle: 'DIKONFIRMASI', machines: [{ id: 'm-1' }] }),
    );

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.assign(adminSundaya, 'job-1', { machineId: 'm-1' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('menolak mesin non-TERSEDIA (409)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobDiajukan());
    prisma.machine.findUnique.mockResolvedValue({ ...machineTersedia, status: 'AKTIF' });

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.assign(adminSundaya, 'job-1', { machineId: 'm-1' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('menolak mesin yang tidak sanggup satu cetakan pun di booking (400)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(
      jobDiajukan({ molds: [{ kodeMold: 'MLD-1', tonaseTon: 200 }] }),
    );
    prisma.machine.findUnique.mockResolvedValue(machineTersedia); // 150 ton

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.assign(adminSundaya, 'job-1', { machineId: 'm-1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('menerima mesin bertonase lebih besar dari cetakan: tonase adalah batas atas', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(
      jobDiajukan({ molds: [{ kodeMold: 'MLD-1', tonaseTon: 100 }] }),
    );
    prisma.machine.findUnique.mockResolvedValue(machineTersedia); // 150 ton
    prisma.job.update.mockReturnValue(jobRow({ lifecycle: 'DIKONFIRMASI' }));
    prisma.machine.update.mockReturnValue(machineTersedia);

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.assign(adminSundaya, 'job-1', { machineId: 'm-1' })).resolves.toBeDefined();
  });

  it('cukup sanggup cetakan terkecil: mesin sedang tetap diterima untuk booking campuran', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(
      jobDiajukan({
        molds: [
          { kodeMold: 'MLD-1', tonaseTon: 100 },
          { kodeMold: 'MLD-2', tonaseTon: 200 },
        ],
      }),
    );
    prisma.machine.findUnique.mockResolvedValue(machineTersedia); // 150 ton
    prisma.job.update.mockReturnValue(jobRow({ lifecycle: 'DIKONFIRMASI' }));
    prisma.machine.update.mockReturnValue(machineTersedia);

    // Cetakan tidak dipasangkan ke mesin, jadi mesin 150 ton tetap berguna untuk MLD-1.
    // Kecocokan MLD-2 baru ditegakkan saat Log Produksi dicatat.
    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.assign(adminSundaya, 'job-1', { machineId: 'm-1' })).resolves.toBeDefined();
  });

  it('menolak tambah mesin setelah mesin dikirim (409)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobDiajukan({ lifecycle: 'AKTIF' }));

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.assign(adminSundaya, 'job-1', { machineId: 'm-1' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('404 bila job tidak ada', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(null);

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.assign(adminSundaya, 'x', { machineId: 'm-1' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('JobsService.releaseMachine', () => {
  it('mesin kembali TERSEDIA saat ditarik dari booking', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({
      id: 'job-1',
      lifecycle: 'DIKONFIRMASI',
      machines: [machineDipinjam(), machineDipinjam({ id: 'm-2' })],
    });
    prisma.job.update.mockReturnValue(jobRow({ lifecycle: 'DIKONFIRMASI' }));
    prisma.machine.update.mockReturnValue({ id: 'm-1' });

    const service = new JobsService(prisma as unknown as PrismaService);
    await service.releaseMachine('job-1', 'm-1');

    expect(prisma.job.update.mock.calls[0][0].data).toEqual({
      machines: { disconnect: { id: 'm-1' } },
    });
    expect(prisma.machine.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { status: MachineStatus.TERSEDIA },
    });
  });

  it('menolak melepas mesin terakhir (409)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({
      id: 'job-1',
      lifecycle: 'DIKONFIRMASI',
      machines: [machineDipinjam()],
    });

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.releaseMachine('job-1', 'm-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('404 bila mesin bukan bagian booking', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({
      id: 'job-1',
      lifecycle: 'DIKONFIRMASI',
      machines: [machineDipinjam({ id: 'm-9' })],
    });

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.releaseMachine('job-1', 'm-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('menolak melepas mesin setelah dikirim (409)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({
      id: 'job-1',
      lifecycle: 'AKTIF',
      machines: [machineDipinjam({ status: 'AKTIF' }), machineDipinjam({ id: 'm-2' })],
    });

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.releaseMachine('job-1', 'm-1')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('JobsService.reject', () => {
  it('menolak job: DIAJUKAN -> DITOLAK dengan alasan', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow({ lifecycle: 'DIAJUKAN' }));
    prisma.job.update.mockResolvedValue(
      jobRow({ lifecycle: 'DITOLAK', rejectionReason: 'mesin penuh' }),
    );

    prisma.$transaction.mockImplementation((fn: (t: unknown) => unknown) =>
      fn({ job: { update: prisma.job.update }, mold: { updateMany: jest.fn() } }),
    );
    const service = new JobsService(prisma as unknown as PrismaService);
    const result = await service.reject(adminSundaya, 'job-1', { reason: 'mesin penuh' });

    const data = prisma.job.update.mock.calls[0][0].data;
    expect(data.lifecycle).toBe(JobLifecycle.DITOLAK);
    expect(data.rejectionReason).toBe('mesin penuh');
    expect(result.lifecycle).toBe(JobLifecycle.DITOLAK);
  });
});

describe('JobsService.ship (transisi pasca-assign)', () => {
  it('DIKONFIRMASI -> DIKIRIM dan seluruh mesin booking ikut ke DIKIRIM', async () => {
    const prisma = prismaMock();
    const machines = [
      machineDipinjam({ machineNumber: 'IM-03', tonaseTon: 150 }),
      machineDipinjam({ id: 'm-2', machineNumber: 'IM-04', tonaseTon: 200 }),
    ];
    prisma.job.findUnique.mockResolvedValue(jobRow({ lifecycle: 'DIKONFIRMASI', machines }));
    prisma.job.update.mockReturnValue(jobRow({ lifecycle: 'DIKIRIM', machines }));
    prisma.machine.update.mockReturnValue({ id: 'm-1' });

    const service = new JobsService(prisma as unknown as PrismaService);
    const result = await service.ship(adminSundaya, 'job-1');

    expect(prisma.machine.update).toHaveBeenCalledTimes(2);
    expect(prisma.machine.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { status: MachineStatus.DIKIRIM },
    });
    expect(prisma.machine.update).toHaveBeenCalledWith({
      where: { id: 'm-2' },
      data: { status: MachineStatus.DIKIRIM },
    });
    expect(result.lifecycle).toBe(JobLifecycle.DIKIRIM);
  });

  it('menolak transisi bila job belum punya mesin (409)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow({ lifecycle: 'DIKONFIRMASI', machines: [] }));

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.ship(adminSundaya, 'job-1')).rejects.toBeInstanceOf(ConflictException);
  });
});

const extensionRow = (o: Record<string, unknown> = {}) => ({
  id: 'ext-1',
  jobId: 'job-1',
  additionalDays: 7,
  status: 'DIAJUKAN',
  requestedAt: new Date('2026-07-20'),
  decidedAt: null,
  ...o,
});

describe('JobsService.requestExtension', () => {
  it('menolak bila job belum AKTIF (409)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow({ lifecycle: 'DIKIRIM' }));

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(
      service.requestExtension(manager, 'job-1', { additionalDays: 7 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('menolak bila masih ada pengajuan yang menunggu keputusan (409)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow({ lifecycle: 'AKTIF' }));
    prisma.rentalExtension.count.mockResolvedValue(1);

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(
      service.requestExtension(manager, 'job-1', { additionalDays: 7 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('menolak job milik tenant lain (403)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow({ lifecycle: 'AKTIF', managerId: 'mgr-lain' }));

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(
      service.requestExtension(manager, 'job-1', { additionalDays: 7 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('membuat pengajuan berstatus DIAJUKAN', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow({ lifecycle: 'AKTIF' }));
    prisma.rentalExtension.count.mockResolvedValue(0);
    prisma.rentalExtension.create.mockResolvedValue(extensionRow());

    const service = new JobsService(prisma as unknown as PrismaService);
    const result = await service.requestExtension(manager, 'job-1', { additionalDays: 7 });

    expect(prisma.rentalExtension.create).toHaveBeenCalledWith({
      data: { jobId: 'job-1', additionalDays: 7 },
    });
    expect(result.status).toBe(ExtensionStatus.DIAJUKAN);
  });
});

describe('JobsService.decideExtension', () => {
  it('DITERIMA menggeser endDate dan menambah durasi sewa', async () => {
    const prisma = prismaMock();
    prisma.rentalExtension.findUnique.mockResolvedValue(
      extensionRow({
        job: { id: 'job-1', endDate: new Date('2026-08-01'), requestedDurationDays: 14 },
      }),
    );
    prisma.rentalExtension.update.mockReturnValue(
      extensionRow({ status: 'DITERIMA', decidedAt: new Date('2026-07-21') }),
    );

    const service = new JobsService(prisma as unknown as PrismaService);
    const result = await service.decideExtension('ext-1', {
      decision: ExtensionStatus.DITERIMA,
    });

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { requestedDurationDays: 21, endDate: new Date('2026-08-08') },
    });
    expect(result.status).toBe(ExtensionStatus.DITERIMA);
  });

  it('DITOLAK tidak menyentuh job', async () => {
    const prisma = prismaMock();
    prisma.rentalExtension.findUnique.mockResolvedValue(
      extensionRow({
        job: { id: 'job-1', endDate: new Date('2026-08-01'), requestedDurationDays: 14 },
      }),
    );
    prisma.rentalExtension.update.mockResolvedValue(
      extensionRow({ status: 'DITOLAK', decidedAt: new Date('2026-07-21') }),
    );

    const service = new JobsService(prisma as unknown as PrismaService);
    const result = await service.decideExtension('ext-1', { decision: ExtensionStatus.DITOLAK });

    expect(prisma.job.update).not.toHaveBeenCalled();
    expect(result.status).toBe(ExtensionStatus.DITOLAK);
  });

  it('menolak pengajuan yang sudah diputuskan (409)', async () => {
    const prisma = prismaMock();
    prisma.rentalExtension.findUnique.mockResolvedValue(extensionRow({ status: 'DITERIMA' }));

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(
      service.decideExtension('ext-1', { decision: ExtensionStatus.DITERIMA }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

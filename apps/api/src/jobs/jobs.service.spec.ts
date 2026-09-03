import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ExtensionStatus,
  JobLifecycle,
  MachineStatus,
  MoldTrackingStatus,
  Role,
} from '@mold-tracker/shared';
import { User as PrismaUser } from '@prisma/client';
import { JobsService } from './jobs.service';
import { activateJobOnProduksi, closeExpiredJobs } from './job-transitions';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// Transaksi yang dipinjamkan service pemicu (Log Penerimaan, Mold Tracking) ke
// helper transisi otomatis.
function txMock() {
  return {
    job: { findUnique: jest.fn(), update: jest.fn() },
    machine: { update: jest.fn() },
    // Menutup booking ikut melepas cetakannya supaya bisa dibooking lagi.
    mold: { updateMany: jest.fn() },
    moldJobUsage: { createMany: jest.fn(), deleteMany: jest.fn() },
  };
}

function prismaMock() {
  return {
    user: { findMany: jest.fn().mockResolvedValue([]) },
    job: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    machine: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
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

// Notifikasi tidak jadi fokus pengujian modul ini (sudah dipastikan terpanggil
// lewat pengecekan mock.calls di tes yang relevan); default no-op di sini.
function notificationsMock() {
  return { create: jest.fn(), createMany: jest.fn() };
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
    receivedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-07-01'),
    molds: [],
    // Cetakan booking dibaca dari riwayat pemakaian, bukan keterikatan langsung.
    moldUsages: [],
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
      // Riwayat pemakaian cetakan per booking dicatat di transaksi yang sama.
      moldJobUsage: { createMany: jest.fn(), deleteMany: jest.fn() },
      // Cetakan yang masuk booking membuka sesi produksi baru di transaksi ini.
      moldProductionRun: { createMany: jest.fn(), deleteMany: jest.fn() },
      logProduksi: { groupBy: jest.fn().mockResolvedValue([]) },
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
    prisma.user.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'super-1' }]);
    const notifications = notificationsMock();

    const service = new JobsService(prisma as unknown as PrismaService, notifications as unknown as NotificationsService);
    const result = await service.create({ ...manager, nama: 'Manager Nusantara' } as unknown as typeof manager, dto);

    const data = tx.job.create.mock.calls[0][0].data;
    expect(data.managerId).toBe('mgr-1');
    expect(data.catatan).toBe('Kirim bertahap');
    expect(data.lifecycle).toBeUndefined(); // default DIAJUKAN dari schema
    expect(data.requestedMachineCount).toBe(2);
    // Nomor job menyebut kode cetakannya plus sekuens, bukan timestamp acak.
    expect(data.jobNumber).toBe('JOB-MLD1-MLD2-005');
    // Sekuens dihitung per perusahaan, bukan seluruh tabel: tanpa filter ini
    // penyewa bisa menebak jumlah booking tenant lain dari nomor job sendiri.
    expect((tx.job as unknown as { count: jest.Mock }).count).toHaveBeenCalledWith({
      where: { managerId: 'mgr-1' },
    });
    // Cetakan ditautkan ke job, bukan disimpan sebagai kolom di Job.
    // Booking baru diberitahukan ke seluruh staf Sundaya aktif, bukan cuma dicatat diam-diam.
    expect(notifications.createMany).toHaveBeenCalledWith(
      ['admin-1', 'super-1'],
      'Booking baru menunggu approval',
      expect.stringContaining('Manager Nusantara'),
      '/staff/booking',
    );
    expect(tx.mold.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['mold-1', 'mold-2'] } },
      data: { jobId: 'job-1' },
    });
    expect(result.lifecycle).toBe(JobLifecycle.DIAJUKAN);
  });

  it('404 bila sebagian cetakan bukan milik Manager (tidak bocorkan tenant lain)', async () => {
    const prisma = prismaMock();
    prisma.mold.findMany.mockResolvedValue([{ id: 'mold-1', kodeMold: 'MLD-1', jobId: null }]);

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
    await expect(service.create(manager, dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('tenant baru mulai dari 001 walau tabel Job sudah berisi booking tenant lain', async () => {
    const prisma = prismaMock();
    prisma.mold.findMany.mockResolvedValue([{ id: 'mold-1', kodeMold: 'KMD1', jobId: null }]);
    const tx = mockCreateTx(prisma, jobRow());
    // Tenant ini belum punya booking sama sekali; count sudah tersaring managerId.
    (tx.job as unknown as { count: jest.Mock }).count = jest.fn().mockResolvedValue(0);
    prisma.user.findMany.mockResolvedValue([]);

    const service = new JobsService(
      prisma as unknown as PrismaService,
      notificationsMock() as unknown as NotificationsService,
    );
    await service.create(manager, { ...dto, moldIds: ['mold-1'] });

    expect(tx.job.create.mock.calls[0][0].data.jobNumber).toBe('JOB-KMD1-001');
  });

  it('cetakan yang dibooking ulang membuka sesi baru dari akumulasi terakhir', async () => {
    const prisma = prismaMock();
    // Cetakan sudah menghasilkan 50 pcs di booking sebelumnya dan targetnya 50.
    prisma.mold.findMany.mockResolvedValue([
      { id: 'mold-1', kodeMold: 'MLD1', jobId: null, targetOutput: 50, estimasiKg: 100 },
    ]);
    const tx = mockCreateTx(prisma, jobRow());
    (tx as unknown as { logProduksi: { groupBy: jest.Mock } }).logProduksi.groupBy = jest
      .fn()
      .mockResolvedValue([{ moldId: 'mold-1', _sum: { goodProduct: 50, materialUsedKg: 80 } }]);
    prisma.user.findMany.mockResolvedValue([]);

    const service = new JobsService(
      prisma as unknown as PrismaService,
      notificationsMock() as unknown as NotificationsService,
    );
    await service.create(manager, { ...dto, moldIds: ['mold-1'] });

    // Titik awal sesi = akumulasi terakhir, sehingga capaian booking baru mulai
    // dari nol. Tanpa ini cetakan langsung terhitung selesai dan produksinya
    // terkunci sejak booking pertama kali dibuat.
    const runs = (tx as unknown as { moldProductionRun: { createMany: jest.Mock } })
      .moldProductionRun.createMany;
    expect(runs).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ moldId: 'mold-1', targetOutput: 50, goodAwal: 50, materialAwal: 80 }),
      ],
    });
  });

  it('409 bila cetakan sudah dibooking, sebut kodenya', async () => {
    const prisma = prismaMock();
    prisma.mold.findMany.mockResolvedValue([
      { id: 'mold-1', kodeMold: 'MLD-1', jobId: null },
      { id: 'mold-2', kodeMold: 'MLD-2', jobId: 'job-lain' },
    ]);

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
    await expect(service.create(manager, dto)).rejects.toThrow(/MLD-2/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('JobsService.assign (pinjamkan mesin)', () => {
  const jobDiajukan = (o: Record<string, unknown> = {}) => ({
    id: 'job-1',
    jobNumber: 'JOB-MLD1-001',
    managerId: 'mgr-1',
    lifecycle: 'DIAJUKAN',
    molds: [{ id: 'mold-1', kodeMold: 'MLD-1', tonaseTon: 150 }],
    machines: [],
    ...o,
  });

  it('mesin pertama menyetujui booking dan keluar dari TERSEDIA', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobDiajukan());
    prisma.machine.findMany.mockResolvedValue([machineTersedia]);
    prisma.job.update.mockReturnValue(
      jobRow({
        assignedById: 'admin-1',
        lifecycle: 'DIKONFIRMASI',
        machines: [machineDipinjam({ machineNumber: 'IM-03', tonaseTon: 150 })],
      }),
    );
    prisma.machine.updateMany.mockReturnValue({ count: 1 });
    const notifications = notificationsMock();

    const service = new JobsService(prisma as unknown as PrismaService, notifications as unknown as NotificationsService);
    const result = await service.assign(adminSundaya, 'job-1', { machineIds: ['m-1'] });

    const jobData = prisma.job.update.mock.calls[0][0].data;
    expect(jobData.machines).toEqual({ connect: [{ id: 'm-1' }] });
    expect(jobData.assignedById).toBe('admin-1');
    expect(jobData.lifecycle).toBe(JobLifecycle.DIKONFIRMASI);
    expect(jobData.confirmedAt).toBeInstanceOf(Date);
    expect(prisma.machine.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['m-1'] } },
      data: { status: MachineStatus.DIKONFIRMASI },
    });
    expect(result.lifecycle).toBe(JobLifecycle.DIKONFIRMASI);
    expect(result.machines).toHaveLength(1);
    // Approval pertama harus memberi tahu Manager pemilik booking.
    expect(notifications.create).toHaveBeenCalledWith(
      'mgr-1',
      'Booking disetujui',
      expect.any(String),
      '/booking',
    );
  });

  it('mesin kedua hanya menambah, tidak menyetujui ulang', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(
      jobDiajukan({ lifecycle: 'DIKONFIRMASI', machines: [{ id: 'm-0' }] }),
    );
    prisma.machine.findMany.mockResolvedValue([machineTersedia]);
    prisma.job.update.mockReturnValue(jobRow({ lifecycle: 'DIKONFIRMASI' }));
    prisma.machine.updateMany.mockReturnValue({ count: 1 });

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
    await service.assign(adminSundaya, 'job-1', { machineIds: ['m-1'] });

    const jobData = prisma.job.update.mock.calls[0][0].data;
    expect(jobData.machines).toEqual({ connect: [{ id: 'm-1' }] });
    expect(jobData.lifecycle).toBeUndefined();
    expect(jobData.confirmedAt).toBeUndefined();
  });

  it('menolak mesin yang sudah dipinjamkan ke booking ini (409)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(
      jobDiajukan({ lifecycle: 'DIKONFIRMASI', machines: [{ id: 'm-1' }] }),
    );

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
    await expect(service.assign(adminSundaya, 'job-1', { machineIds: ['m-1'] })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('memilih beberapa mesin sekaligus dalam satu aksi assign', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobDiajukan());
    prisma.machine.findMany.mockResolvedValue([
      machineTersedia,
      { ...machineTersedia, id: 'm-2', machineNumber: 'IM-04' },
    ]);
    prisma.job.update.mockReturnValue(jobRow({ lifecycle: 'DIKONFIRMASI' }));
    prisma.machine.updateMany.mockReturnValue({ count: 2 });

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
    await service.assign(adminSundaya, 'job-1', { machineIds: ['m-1', 'm-2'] });

    const jobData = prisma.job.update.mock.calls[0][0].data;
    expect(jobData.machines).toEqual({ connect: [{ id: 'm-1' }, { id: 'm-2' }] });
    expect(prisma.machine.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['m-1', 'm-2'] } },
      data: { status: MachineStatus.DIKONFIRMASI },
    });
  });

  it('booking yang disetujui menempatkan seluruh cetakannya ke PLANNING', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobDiajukan());
    prisma.machine.findMany.mockResolvedValue([machineTersedia]);
    prisma.job.update.mockReturnValue(jobRow({ lifecycle: 'DIKONFIRMASI' }));
    prisma.machine.updateMany.mockReturnValue({ count: 1 });

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
    await service.assign(adminSundaya, 'job-1', { machineIds: ['m-1'] });

    const jobData = prisma.job.update.mock.calls[0][0].data;
    expect(jobData.molds).toEqual({
      updateMany: { where: {}, data: { trackingStatus: MoldTrackingStatus.PLANNING } },
    });
  });

  it('menolak mesin melebihi jumlah yang dipesan penyewa (400)', async () => {
    const prisma = prismaMock();
    // Penyewa memesan 1 mesin dan 1 sudah dipinjamkan: tidak boleh ditambah lagi.
    prisma.job.findUnique.mockResolvedValue(
      jobRow({
        requestedMachineCount: 1,
        machines: [{ id: 'm-lama' }],
        molds: [{ id: 'md-1', kodeMold: 'MLD1', tonaseTon: 50 }],
      }),
    );

    const service = new JobsService(
      prisma as unknown as PrismaService,
      notificationsMock() as unknown as NotificationsService,
    );

    await expect(service.assign(adminSundaya, 'job-1', { machineIds: ['m-2'] })).rejects.toThrow(
      /sudah dipenuhi 1 mesin sesuai permintaan penyewa/,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('menolak permintaan yang totalnya melewati pesanan, sebut sisa kuotanya (400)', async () => {
    const prisma = prismaMock();
    // Pesan 2, sudah ada 1, minta 2 sekaligus: hanya sisa 1 yang boleh.
    prisma.job.findUnique.mockResolvedValue(
      jobRow({
        requestedMachineCount: 2,
        machines: [{ id: 'm-lama' }],
        molds: [{ id: 'md-1', kodeMold: 'MLD1', tonaseTon: 50 }],
      }),
    );

    const service = new JobsService(
      prisma as unknown as PrismaService,
      notificationsMock() as unknown as NotificationsService,
    );

    await expect(
      service.assign(adminSundaya, 'job-1', { machineIds: ['m-2', 'm-3'] }),
    ).rejects.toThrow(/hanya bisa menambah 1 mesin lagi/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('menolak mesin non-TERSEDIA (409)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobDiajukan());
    prisma.machine.findMany.mockResolvedValue([{ ...machineTersedia, status: 'AKTIF' }]);

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
    await expect(service.assign(adminSundaya, 'job-1', { machineIds: ['m-1'] })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('menolak mesin yang tidak sanggup satu cetakan pun di booking (400)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(
      jobDiajukan({ molds: [{ kodeMold: 'MLD-1', tonaseTon: 200 }] }),
    );
    prisma.machine.findMany.mockResolvedValue([machineTersedia]); // 150 ton

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
    await expect(service.assign(adminSundaya, 'job-1', { machineIds: ['m-1'] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('menerima mesin bertonase lebih besar dari cetakan: tonase adalah batas atas', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(
      jobDiajukan({ molds: [{ kodeMold: 'MLD-1', tonaseTon: 100 }] }),
    );
    prisma.machine.findMany.mockResolvedValue([machineTersedia]); // 150 ton
    prisma.job.update.mockReturnValue(jobRow({ lifecycle: 'DIKONFIRMASI' }));
    prisma.machine.updateMany.mockReturnValue({ count: 1 });

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
    await expect(service.assign(adminSundaya, 'job-1', { machineIds: ['m-1'] })).resolves.toBeDefined();
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
    prisma.machine.findMany.mockResolvedValue([machineTersedia]); // 150 ton
    prisma.job.update.mockReturnValue(jobRow({ lifecycle: 'DIKONFIRMASI' }));
    prisma.machine.updateMany.mockReturnValue({ count: 1 });

    // Cetakan tidak dipasangkan ke mesin, jadi mesin 150 ton tetap berguna untuk MLD-1.
    // Kecocokan MLD-2 baru ditegakkan saat Log Produksi dicatat.
    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
    await expect(service.assign(adminSundaya, 'job-1', { machineIds: ['m-1'] })).resolves.toBeDefined();
  });

  it('menolak tambah mesin setelah mesin dikirim (409)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobDiajukan({ lifecycle: 'AKTIF' }));

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
    await expect(service.assign(adminSundaya, 'job-1', { machineIds: ['m-1'] })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('404 bila job tidak ada', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(null);

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
    await expect(service.assign(adminSundaya, 'x', { machineIds: ['m-1'] })).rejects.toBeInstanceOf(
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

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
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

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
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

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
    await expect(service.releaseMachine('job-1', 'm-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('menolak melepas mesin setelah dikirim (409)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({
      id: 'job-1',
      lifecycle: 'AKTIF',
      machines: [machineDipinjam({ status: 'AKTIF' }), machineDipinjam({ id: 'm-2' })],
    });

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
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

    const moldUpdate = jest.fn();
    const usageDelete = jest.fn();
    prisma.$transaction.mockImplementation((fn: (t: unknown) => unknown) =>
      fn({
        job: { update: prisma.job.update },
        mold: { updateMany: moldUpdate },
        moldJobUsage: { deleteMany: usageDelete },
        moldProductionRun: { deleteMany: jest.fn() },
      }),
    );
    const notifications = notificationsMock();
    const service = new JobsService(prisma as unknown as PrismaService, notifications as unknown as NotificationsService);
    const result = await service.reject(adminSundaya, 'job-1', { reason: 'mesin penuh' });

    const data = prisma.job.update.mock.calls[0][0].data;
    expect(data.lifecycle).toBe(JobLifecycle.DITOLAK);
    expect(data.rejectionReason).toBe('mesin penuh');
    // Booking yang ditolak tidak pernah terjadi: cetakannya bebas lagi dan
    // riwayat pemakaiannya dihapus, bukan disimpan sebagai pemakaian palsu.
    expect(moldUpdate).toHaveBeenCalledWith({
      where: { jobId: 'job-1' },
      data: { jobId: null, trackingStatus: null },
    });
    expect(usageDelete).toHaveBeenCalledWith({ where: { jobId: 'job-1' } });
    expect(result.lifecycle).toBe(JobLifecycle.DITOLAK);
    // Manager pemilik booking harus tahu kenapa bookingnya ditolak.
    expect(notifications.create).toHaveBeenCalledWith(
      'mgr-1',
      'Booking ditolak',
      expect.stringContaining('mesin penuh'),
      '/booking',
    );
  });
});

// Tidak ada lagi tombol "kirim mesin": mesin tidak pernah keluar dari Sundaya.
// Dua perpindahan sisa berjalan otomatis dari event domain, diuji di sini karena
// keduanya menggerakkan job + mesin bersama-sama.
describe('activateJobOnProduksi (produksi harian -> booking berjalan)', () => {
  it('DIKONFIRMASI -> AKTIF, seluruh mesin pinjaman ikut AKTIF, tanggal tidak digeser', async () => {
    const tx = txMock();
    tx.job.findUnique.mockResolvedValue({
      lifecycle: 'DIKONFIRMASI',
      requestedDurationDays: 30,
      machines: [machineDipinjam(), machineDipinjam({ id: 'm-2' })],
    });

    await activateJobOnProduksi(tx as unknown as Parameters<typeof activateJobOnProduksi>[0], 'job-1');

    expect(tx.machine.update).toHaveBeenCalledTimes(2);
    expect(tx.machine.update).toHaveBeenCalledWith({
      where: { id: 'm-2' },
      data: { status: MachineStatus.AKTIF },
    });
    const data = tx.job.update.mock.calls[0][0].data;
    expect(data.lifecycle).toBe(JobLifecycle.AKTIF);
    // Masa sewa ditetapkan dari jadwal penyewa saat booking dibuat, jadi aktivasi
    // tidak lagi menyentuh tanggal apa pun.
    expect(data.startDate).toBeUndefined();
    expect(data.endDate).toBeUndefined();
  });

  it('booking yang belum dikonfirmasi tidak ikut berjalan', async () => {
    const tx = txMock();
    tx.job.findUnique.mockResolvedValue({
      lifecycle: 'DIAJUKAN',
      requestedDurationDays: 30,
      machines: [],
    });

    await activateJobOnProduksi(tx as unknown as Parameters<typeof activateJobOnProduksi>[0], 'job-1');
    expect(tx.job.update).not.toHaveBeenCalled();
  });

  it('idempoten: produksi harian berikutnya tidak mengubah apa pun', async () => {
    const tx = txMock();
    tx.job.findUnique.mockResolvedValue({
      lifecycle: 'AKTIF',
      requestedDurationDays: 30,
      machines: [machineDipinjam({ status: 'AKTIF' })],
    });

    await activateJobOnProduksi(tx as unknown as Parameters<typeof activateJobOnProduksi>[0], 'job-1');
    expect(tx.job.update).not.toHaveBeenCalled();
    expect(tx.machine.update).not.toHaveBeenCalled();
  });
});

describe('closeExpiredJobs (masa sewa habis -> booking tutup)', () => {
  const prismaMockFor = (jobs: unknown[], tx: ReturnType<typeof txMock>) => ({
    job: { findMany: jest.fn().mockResolvedValue(jobs) },
    $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  });

  it('menutup booking yang endDate-nya sudah lewat dan membebaskan mesinnya', async () => {
    const tx = txMock();
    const prisma = prismaMockFor([{ id: 'job-1', machines: [machineDipinjam({ status: 'AKTIF' })] }], tx);

    const jumlah = await closeExpiredJobs(
      prisma as unknown as Parameters<typeof closeExpiredJobs>[0],
      new Date('2026-08-01'),
    );

    expect(jumlah).toBe(1);
    expect(tx.machine.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { status: MachineStatus.TERSEDIA },
    });
    // Cetakan ikut dilepas supaya bisa dibooking lagi, dan status trackingnya
    // direset agar di master data kembali terbaca "belum dibooking". Tanpa ini
    // cetakan terkunci permanen pada booking yang sudah selesai.
    expect(tx.mold.updateMany).toHaveBeenCalledWith({
      where: { jobId: 'job-1' },
      data: { jobId: null, trackingStatus: null },
    });
    expect(tx.job.update.mock.calls[0][0].data.lifecycle).toBe(JobLifecycle.SELESAI);
  });

  it('hanya menyaring job AKTIF yang endDate-nya lewat, bukan yang produksinya selesai', async () => {
    const tx = txMock();
    const prisma = prismaMockFor([], tx);
    const now = new Date('2026-08-01');

    const jumlah = await closeExpiredJobs(
      prisma as unknown as Parameters<typeof closeExpiredJobs>[0],
      now,
    );

    expect(jumlah).toBe(0);
    // Penyaringnya masa sewa; status cetakan sama sekali tidak ikut menentukan.
    expect(prisma.job.findMany).toHaveBeenCalledWith({
      where: { lifecycle: JobLifecycle.AKTIF, endDate: { lt: now } },
      select: { id: true, machines: { select: { id: true, status: true } } },
    });
    expect(tx.job.update).not.toHaveBeenCalled();
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
    prisma.job.findUnique.mockResolvedValue(jobRow({ lifecycle: 'DIKONFIRMASI' }));

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
    await expect(
      service.requestExtension(manager, 'job-1', { additionalDays: 7 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('menolak bila masih ada pengajuan yang menunggu keputusan (409)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow({ lifecycle: 'AKTIF' }));
    prisma.rentalExtension.count.mockResolvedValue(1);

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
    await expect(
      service.requestExtension(manager, 'job-1', { additionalDays: 7 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('menolak job milik tenant lain (403)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow({ lifecycle: 'AKTIF', managerId: 'mgr-lain' }));

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
    await expect(
      service.requestExtension(manager, 'job-1', { additionalDays: 7 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('membuat pengajuan berstatus DIAJUKAN', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow({ lifecycle: 'AKTIF' }));
    prisma.rentalExtension.count.mockResolvedValue(0);
    prisma.rentalExtension.create.mockResolvedValue(extensionRow());

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
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
        job: {
          id: 'job-1',
          managerId: 'mgr-1',
          jobNumber: 'JOB-MLD1-001',
          endDate: new Date('2026-08-01'),
          requestedDurationDays: 14,
        },
      }),
    );
    prisma.rentalExtension.update.mockReturnValue(
      extensionRow({ status: 'DITERIMA', decidedAt: new Date('2026-07-21') }),
    );
    const notifications = notificationsMock();

    const service = new JobsService(prisma as unknown as PrismaService, notifications as unknown as NotificationsService);
    const result = await service.decideExtension('ext-1', {
      decision: ExtensionStatus.DITERIMA,
    });

    expect(prisma.job.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { requestedDurationDays: 21, endDate: new Date('2026-08-08') },
    });
    expect(result.status).toBe(ExtensionStatus.DITERIMA);
    expect(notifications.create).toHaveBeenCalledWith(
      'mgr-1',
      'Perpanjangan sewa disetujui',
      expect.any(String),
      '/booking',
    );
  });

  it('DITOLAK tidak menyentuh job', async () => {
    const prisma = prismaMock();
    prisma.rentalExtension.findUnique.mockResolvedValue(
      extensionRow({
        job: {
          id: 'job-1',
          managerId: 'mgr-1',
          jobNumber: 'JOB-MLD1-001',
          endDate: new Date('2026-08-01'),
          requestedDurationDays: 14,
        },
      }),
    );
    prisma.rentalExtension.update.mockResolvedValue(
      extensionRow({ status: 'DITOLAK', decidedAt: new Date('2026-07-21') }),
    );
    const notifications = notificationsMock();

    const service = new JobsService(prisma as unknown as PrismaService, notifications as unknown as NotificationsService);
    const result = await service.decideExtension('ext-1', { decision: ExtensionStatus.DITOLAK });

    expect(prisma.job.update).not.toHaveBeenCalled();
    expect(notifications.create).toHaveBeenCalledWith(
      'mgr-1',
      'Perpanjangan sewa ditolak',
      expect.any(String),
      '/booking',
    );
    expect(result.status).toBe(ExtensionStatus.DITOLAK);
  });

  it('menolak pengajuan yang sudah diputuskan (409)', async () => {
    const prisma = prismaMock();
    prisma.rentalExtension.findUnique.mockResolvedValue(extensionRow({ status: 'DITERIMA' }));

    const service = new JobsService(prisma as unknown as PrismaService, notificationsMock() as unknown as NotificationsService);
    await expect(
      service.decideExtension('ext-1', { decision: ExtensionStatus.DITERIMA }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

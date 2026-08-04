import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MoldTrackingStatus, Role } from '@mold-tracker/shared';
import { Prisma, User as PrismaUser } from '@prisma/client';
import { MoldTrackingService } from './mold-tracking.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// transition() berjalan di dalam $transaction bentuk callback: mock meneruskan
// klien tx yang sama supaya tulisan di dalamnya tetap bisa diperiksa.
function prismaMock() {
  const client = {
    mold: { findUnique: jest.fn(), update: jest.fn() },
    moldTrackingEvent: { create: jest.fn() },
    job: { findUnique: jest.fn().mockResolvedValue(null) },
    machine: { update: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return {
    ...client,
    $transaction: jest
      .fn()
      .mockImplementation((fn: (tx: typeof client) => unknown) => fn(client)),
  };
}

const notifications = { create: jest.fn() } as unknown as NotificationsService;

const svc = (prisma: ReturnType<typeof prismaMock>) =>
  new MoldTrackingService(prisma as unknown as PrismaService, notifications);

// Klien transaksi untuk menguji advance(): dipanggil service domain lain.
function txMock(trackingStatus: string | null) {
  return {
    mold: {
      findUnique: jest.fn().mockResolvedValue(trackingStatus ? { trackingStatus } : null),
      update: jest.fn().mockResolvedValue({}),
    },
    moldTrackingEvent: { create: jest.fn().mockResolvedValue({}) },
  };
}

const adminSundaya = { id: 'admin-1', role: Role.ADMIN_SUNDAYA } as unknown as PrismaUser;
const teknisi = { id: 'tek-1', role: Role.TEKNISI_SUNDAYA } as unknown as PrismaUser;
const manager = { id: 'mgr-1', role: Role.MANAGER_PENYEWA } as unknown as PrismaUser;
const managerLain = { id: 'mgr-2', role: Role.MANAGER_PENYEWA } as unknown as PrismaUser;

function moldRow(o: Record<string, unknown> = {}) {
  return {
    id: 'mold-1',
    kodeMold: 'MLD-001',
    namaProduk: 'Tutup Botol',
    cavity: 4,
    tonaseTon: 150,
    deskripsi: null,
    managerId: 'mgr-1',
    jobId: null,
    trackingStatus: 'PLANNING',
    planMaterialUtama: null,
    estimasiKg: null,
    targetOutput: null,
    createdAt: new Date('2026-07-01'),
    ...o,
  };
}

describe('MoldTrackingService.transition (manual, penutup siklus)', () => {
  it('PRODUCTION -> SEND_BACK oleh Admin Sundaya: update status dan append event', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ trackingStatus: 'PRODUCTION' }));
    prisma.mold.update.mockResolvedValue(moldRow({ trackingStatus: 'SEND_BACK' }));

    const result = await svc(prisma).transition(adminSundaya, 'mold-1', {
      status: MoldTrackingStatus.SEND_BACK,
    });

    expect(prisma.moldTrackingEvent.create).toHaveBeenCalledWith({
      data: { moldId: 'mold-1', status: MoldTrackingStatus.SEND_BACK, byId: 'admin-1' },
    });
    expect(result.trackingStatus).toBe(MoldTrackingStatus.SEND_BACK);
  });

  // Approval pengembalian ada di sisi penyewa dan berlaku per cetakan, bukan per job.
  it('SEND_BACK -> COMPLETED oleh Manager pemilik: approval cetakan sudah diterima', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ trackingStatus: 'SEND_BACK' }));
    prisma.mold.update.mockResolvedValue(
      moldRow({ trackingStatus: 'COMPLETED', jobId: 'job-1' }),
    );

    const result = await svc(prisma).transition(manager, 'mold-1', {
      status: MoldTrackingStatus.COMPLETED,
    });

    expect(prisma.moldTrackingEvent.create).toHaveBeenCalledWith({
      data: { moldId: 'mold-1', status: MoldTrackingStatus.COMPLETED, byId: 'mgr-1' },
    });
    expect(result.trackingStatus).toBe(MoldTrackingStatus.COMPLETED);
  });

  it('menolak Admin Sundaya menutup sendiri ke COMPLETED (403)', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ trackingStatus: 'SEND_BACK' }));

    await expect(
      svc(prisma).transition(adminSundaya, 'mold-1', { status: MoldTrackingStatus.COMPLETED }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('menolak Manager menyatakan cetakan dikirim balik (403)', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ trackingStatus: 'PRODUCTION' }));

    await expect(
      svc(prisma).transition(manager, 'mold-1', { status: MoldTrackingStatus.SEND_BACK }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('cetakan tenant lain -> 404, tidak dibocorkan keberadaannya', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ trackingStatus: 'SEND_BACK' }));

    await expect(
      svc(prisma).transition(managerLain, 'mold-1', { status: MoldTrackingStatus.COMPLETED }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('menolak status otomatis lewat tombol, mis. RECEIVED (409)', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ trackingStatus: 'DELIVERY' }));

    await expect(
      svc(prisma).transition(adminSundaya, 'mold-1', { status: MoldTrackingStatus.RECEIVED }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('menolak Teknisi menutup siklus (403)', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ trackingStatus: 'PRODUCTION' }));

    await expect(
      svc(prisma).transition(teknisi, 'mold-1', { status: MoldTrackingStatus.SEND_BACK }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('menolak urutan tidak sah PRODUCTION -> COMPLETED (409)', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ trackingStatus: 'PRODUCTION' }));

    await expect(
      svc(prisma).transition(manager, 'mold-1', { status: MoldTrackingStatus.COMPLETED }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('404 bila mold tidak ada', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(null);

    await expect(
      svc(prisma).transition(adminSundaya, 'x', { status: MoldTrackingStatus.SEND_BACK }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('MoldTrackingService.advance (otomatis dari event domain)', () => {
  const service = new MoldTrackingService({} as unknown as PrismaService, notifications);

  it('memajukan status dan menulis event bila target di depan', async () => {
    const tx = txMock('PLANNING');
    await service.advance(
      tx as unknown as Prisma.TransactionClient,
      'mold-1',
      MoldTrackingStatus.DELIVERY,
      'mgr-1',
    );

    expect(tx.mold.update).toHaveBeenCalledWith({
      where: { id: 'mold-1' },
      data: { trackingStatus: MoldTrackingStatus.DELIVERY },
    });
    expect(tx.moldTrackingEvent.create).toHaveBeenCalledWith({
      data: { moldId: 'mold-1', status: MoldTrackingStatus.DELIVERY, byId: 'mgr-1' },
    });
  });

  it('idempoten: event domain terulang pada status yang sama tidak menulis apa pun', async () => {
    const tx = txMock('DELIVERY');
    await service.advance(
      tx as unknown as Prisma.TransactionClient,
      'mold-1',
      MoldTrackingStatus.DELIVERY,
      'mgr-1',
    );

    expect(tx.mold.update).not.toHaveBeenCalled();
    expect(tx.moldTrackingEvent.create).not.toHaveBeenCalled();
  });

  it('tidak menurunkan status: mold di PRODUCTION tidak kembali ke RECEIVED', async () => {
    const tx = txMock('PRODUCTION');
    await service.advance(
      tx as unknown as Prisma.TransactionClient,
      'mold-1',
      MoldTrackingStatus.RECEIVED,
      'admin-1',
    );

    expect(tx.mold.update).not.toHaveBeenCalled();
    expect(tx.moldTrackingEvent.create).not.toHaveBeenCalled();
  });

  it('mengizinkan lompatan maju: PLANNING langsung ke RECEIVED bila barang tiba tanpa log kirim', async () => {
    const tx = txMock('PLANNING');
    await service.advance(
      tx as unknown as Prisma.TransactionClient,
      'mold-1',
      MoldTrackingStatus.RECEIVED,
      'admin-1',
    );

    expect(tx.mold.update).toHaveBeenCalledWith({
      where: { id: 'mold-1' },
      data: { trackingStatus: MoldTrackingStatus.RECEIVED },
    });
  });

  it('404 bila mold tidak ada', async () => {
    const tx = txMock(null);
    await expect(
      service.advance(
        tx as unknown as Prisma.TransactionClient,
        'x',
        MoldTrackingStatus.DELIVERY,
        'mgr-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

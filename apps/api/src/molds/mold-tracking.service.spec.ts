import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MoldTrackingStatus, Role } from '@mold-tracker/shared';
import { Prisma, User as PrismaUser } from '@prisma/client';
import { MoldTrackingService } from './mold-tracking.service';
import { PrismaService } from '../prisma/prisma.service';

function prismaMock() {
  return {
    mold: { findUnique: jest.fn(), update: jest.fn() },
    moldTrackingEvent: { create: jest.fn() },
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.resolve(ops)),
  };
}

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

function moldRow(o: Record<string, unknown> = {}) {
  return {
    id: 'mold-1',
    kodeMold: 'MLD-001',
    namaProduk: 'Tutup Botol',
    cavity: 4,
    tonaseTon: 150,
    deskripsi: null,
    managerId: 'mgr-1',
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
    prisma.mold.update.mockReturnValue(moldRow({ trackingStatus: 'SEND_BACK' }));
    prisma.moldTrackingEvent.create.mockReturnValue({ id: 'ev-1' });

    const service = new MoldTrackingService(prisma as unknown as PrismaService);
    const result = await service.transition(adminSundaya, 'mold-1', {
      status: MoldTrackingStatus.SEND_BACK,
    });

    expect(prisma.moldTrackingEvent.create).toHaveBeenCalledWith({
      data: { moldId: 'mold-1', status: MoldTrackingStatus.SEND_BACK, byId: 'admin-1' },
    });
    expect(result.trackingStatus).toBe(MoldTrackingStatus.SEND_BACK);
  });

  it('menolak status otomatis lewat tombol, mis. RECEIVED (409)', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ trackingStatus: 'DELIVERY' }));

    const service = new MoldTrackingService(prisma as unknown as PrismaService);
    await expect(
      service.transition(adminSundaya, 'mold-1', { status: MoldTrackingStatus.RECEIVED }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('menolak Teknisi menutup siklus (403)', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ trackingStatus: 'PRODUCTION' }));

    const service = new MoldTrackingService(prisma as unknown as PrismaService);
    await expect(
      service.transition(teknisi, 'mold-1', { status: MoldTrackingStatus.SEND_BACK }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('menolak urutan tidak sah PRODUCTION -> COMPLETED (409)', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ trackingStatus: 'PRODUCTION' }));

    const service = new MoldTrackingService(prisma as unknown as PrismaService);
    await expect(
      service.transition(adminSundaya, 'mold-1', { status: MoldTrackingStatus.COMPLETED }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('404 bila mold tidak ada', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(null);

    const service = new MoldTrackingService(prisma as unknown as PrismaService);
    await expect(
      service.transition(adminSundaya, 'x', { status: MoldTrackingStatus.SEND_BACK }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('MoldTrackingService.advance (otomatis dari event domain)', () => {
  const service = new MoldTrackingService({} as unknown as PrismaService);

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

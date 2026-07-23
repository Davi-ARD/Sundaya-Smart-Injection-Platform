import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MoldTrackingStatus, Role } from '@mold-tracker/shared';
import { User as PrismaUser } from '@prisma/client';
import { MoldTrackingService } from './mold-tracking.service';
import { PrismaService } from '../prisma/prisma.service';

function prismaMock() {
  return {
    mold: { findUnique: jest.fn(), update: jest.fn() },
    moldTrackingEvent: { create: jest.fn() },
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.resolve(ops)),
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

describe('MoldTrackingService.transition', () => {
  it('transisi sah: update trackingStatus dan append MoldTrackingEvent', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ trackingStatus: 'PLANNING' }));
    prisma.mold.update.mockReturnValue(moldRow({ trackingStatus: 'READY_DELIVERY' }));
    prisma.moldTrackingEvent.create.mockReturnValue({ id: 'ev-1' });

    const service = new MoldTrackingService(prisma as unknown as PrismaService);
    const result = await service.transition(adminSundaya, 'mold-1', {
      status: MoldTrackingStatus.READY_DELIVERY,
    });

    expect(prisma.moldTrackingEvent.create).toHaveBeenCalledWith({
      data: { moldId: 'mold-1', status: MoldTrackingStatus.READY_DELIVERY, byId: 'admin-1' },
    });
    expect(result.trackingStatus).toBe(MoldTrackingStatus.READY_DELIVERY);
  });

  it('Teknisi boleh transisi setup WAITING_PRODUCTION -> ON_MACHINE', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ trackingStatus: 'WAITING_PRODUCTION' }));
    prisma.mold.update.mockReturnValue(moldRow({ trackingStatus: 'ON_MACHINE' }));
    prisma.moldTrackingEvent.create.mockReturnValue({ id: 'ev-2' });

    const service = new MoldTrackingService(prisma as unknown as PrismaService);
    const result = await service.transition(teknisi, 'mold-1', {
      status: MoldTrackingStatus.ON_MACHINE,
    });
    expect(result.trackingStatus).toBe(MoldTrackingStatus.ON_MACHINE);
  });

  it('menolak transisi tidak sah PLANNING -> COMPLETED (409)', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ trackingStatus: 'PLANNING' }));

    const service = new MoldTrackingService(prisma as unknown as PrismaService);
    await expect(
      service.transition(adminSundaya, 'mold-1', { status: MoldTrackingStatus.COMPLETED }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('menolak Teknisi pada transisi logistik DELIVERY -> RECEIVED (403)', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(moldRow({ trackingStatus: 'DELIVERY' }));

    const service = new MoldTrackingService(prisma as unknown as PrismaService);
    await expect(
      service.transition(teknisi, 'mold-1', { status: MoldTrackingStatus.RECEIVED }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('404 bila mold tidak ada', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue(null);

    const service = new MoldTrackingService(prisma as unknown as PrismaService);
    await expect(
      service.transition(adminSundaya, 'x', { status: MoldTrackingStatus.READY_DELIVERY }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

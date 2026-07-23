import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JobLifecycle, MachineStatus, Role } from '@mold-tracker/shared';
import { Prisma, User as PrismaUser } from '@prisma/client';
import { JobsService } from './jobs.service';
import { PrismaService } from '../prisma/prisma.service';

function prismaMock() {
  return {
    job: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), create: jest.fn() },
    machine: { findUnique: jest.fn(), update: jest.fn() },
    mold: { findUnique: jest.fn() },
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => Promise.resolve(ops)),
  };
}

const adminSundaya = { id: 'admin-1', role: Role.ADMIN_SUNDAYA } as unknown as PrismaUser;
const manager = { id: 'mgr-1', role: Role.MANAGER_PENYEWA } as unknown as PrismaUser;

function jobRow(o: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    jobNumber: 'SSIP-0001',
    moldId: 'mold-1',
    managerId: 'mgr-1',
    machineId: null,
    assignedById: null,
    lifecycle: 'DIAJUKAN',
    jobStatus: 'ON_SCHEDULE',
    requestedDurationDays: 30,
    destinationLocation: 'Sundaya, Bandung',
    startDate: null,
    endDate: null,
    planMaterialUtama: null,
    estimasiMaterialKg: null,
    materialTambahan: null,
    targetOutput: null,
    rencanaKirimMold: null,
    confirmedAt: null,
    shippedAt: null,
    receivedAt: null,
    returnedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-07-01'),
    machine: null,
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

describe('JobsService.create (booking)', () => {
  const dto = {
    moldId: 'mold-1',
    requestedDurationDays: 30,
    destinationLocation: 'Sundaya, Bandung',
    startDate: '2026-08-01T00:00:00.000Z',
  };

  it('booking sukses: managerId actor, lifecycle DIAJUKAN, tanpa mesin', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue({ id: 'mold-1', managerId: 'mgr-1' });
    prisma.job.create.mockResolvedValue(jobRow({ startDate: new Date('2026-08-01') }));

    const service = new JobsService(prisma as unknown as PrismaService);
    const result = await service.create(manager, dto);

    const data = prisma.job.create.mock.calls[0][0].data;
    expect(data.managerId).toBe('mgr-1');
    expect(data.machineId).toBeUndefined();
    expect(data.lifecycle).toBeUndefined(); // default DIAJUKAN dari schema
    expect(String(data.jobNumber)).toMatch(/^SSIP-/);
    expect(result.lifecycle).toBe(JobLifecycle.DIAJUKAN);
  });

  it('404 bila mold bukan milik Manager (tidak bocorkan tenant lain)', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue({ id: 'mold-1', managerId: 'other' });

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.create(manager, dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it('409 bila mold sudah dibooking (moldId unik, P2002)', async () => {
    const prisma = prismaMock();
    prisma.mold.findUnique.mockResolvedValue({ id: 'mold-1', managerId: 'mgr-1' });
    prisma.job.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.create(manager, dto)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('JobsService.assign', () => {
  it('assign sukses: set mesin, DIKONFIRMASI, dan mesin keluar dari TERSEDIA', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', lifecycle: 'DIAJUKAN', mold: { tonaseTon: 150 } });
    prisma.machine.findUnique.mockResolvedValue(machineTersedia);
    prisma.job.update.mockReturnValue(
      jobRow({
        machineId: 'm-1',
        assignedById: 'admin-1',
        lifecycle: 'DIKONFIRMASI',
        machine: { machineNumber: 'IM-03', status: 'DIKONFIRMASI' },
      }),
    );
    prisma.machine.update.mockReturnValue(machineTersedia);

    const service = new JobsService(prisma as unknown as PrismaService);
    const result = await service.assign(adminSundaya, 'job-1', { machineId: 'm-1' });

    const jobData = prisma.job.update.mock.calls[0][0].data;
    expect(jobData.machineId).toBe('m-1');
    expect(jobData.assignedById).toBe('admin-1');
    expect(jobData.lifecycle).toBe(JobLifecycle.DIKONFIRMASI);
    expect(jobData.confirmedAt).toBeInstanceOf(Date);
    expect(prisma.machine.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { status: MachineStatus.DIKONFIRMASI },
    });
    expect(result.lifecycle).toBe(JobLifecycle.DIKONFIRMASI);
  });

  it('menolak mesin non-TERSEDIA (409)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', lifecycle: 'DIAJUKAN', mold: { tonaseTon: 150 } });
    prisma.machine.findUnique.mockResolvedValue({ ...machineTersedia, status: 'AKTIF' });

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.assign(adminSundaya, 'job-1', { machineId: 'm-1' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('menolak tonase mesin tidak cocok mold (400)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', lifecycle: 'DIAJUKAN', mold: { tonaseTon: 200 } });
    prisma.machine.findUnique.mockResolvedValue(machineTersedia);

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.assign(adminSundaya, 'job-1', { machineId: 'm-1' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('menolak assign bila job bukan DIAJUKAN (409)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', lifecycle: 'AKTIF', mold: { tonaseTon: 150 } });

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

describe('JobsService.reject', () => {
  it('menolak job: DIAJUKAN -> DITOLAK dengan alasan', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow({ lifecycle: 'DIAJUKAN' }));
    prisma.job.update.mockResolvedValue(
      jobRow({ lifecycle: 'DITOLAK', rejectionReason: 'mesin penuh' }),
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
  it('DIKONFIRMASI -> DIKIRIM dan mesin ikut ke DIKIRIM', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(
      jobRow({
        lifecycle: 'DIKONFIRMASI',
        machineId: 'm-1',
        machine: { machineNumber: 'IM-03', status: 'DIKONFIRMASI' },
      }),
    );
    prisma.job.update.mockReturnValue(
      jobRow({ lifecycle: 'DIKIRIM', machineId: 'm-1', machine: { machineNumber: 'IM-03', status: 'DIKIRIM' } }),
    );
    prisma.machine.update.mockReturnValue({ id: 'm-1' });

    const service = new JobsService(prisma as unknown as PrismaService);
    const result = await service.ship(adminSundaya, 'job-1');

    expect(prisma.machine.update).toHaveBeenCalledWith({
      where: { id: 'm-1' },
      data: { status: MachineStatus.DIKIRIM },
    });
    expect(result.lifecycle).toBe(JobLifecycle.DIKIRIM);
  });

  it('menolak transisi bila job belum punya mesin (409)', async () => {
    const prisma = prismaMock();
    prisma.job.findUnique.mockResolvedValue(jobRow({ lifecycle: 'DIKONFIRMASI', machineId: null, machine: null }));

    const service = new JobsService(prisma as unknown as PrismaService);
    await expect(service.ship(adminSundaya, 'job-1')).rejects.toBeInstanceOf(ConflictException);
  });
});

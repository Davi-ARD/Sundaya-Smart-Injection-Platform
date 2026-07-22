import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@mold-tracker/shared';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock Prisma: cukup method user yang dipakai service.
function mockPrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function svc(prisma: ReturnType<typeof mockPrisma>) {
  return new UsersService(prisma as unknown as PrismaService);
}

// Row lengkap: toUser membaca semua field ini (createdAt harus Date).
const fullRow = (over: Record<string, unknown>) => ({
  id: 'x',
  nama: 'N',
  email: 'n@x.test',
  role: Role.ADMIN_PENYEWA,
  parentId: null,
  companyName: null,
  isActive: true,
  avatarUrl: null,
  createdAt: new Date(),
  ...over,
});
const managerRow = (id: string) => fullRow({ id, role: Role.MANAGER_PENYEWA });
const adminRow = (id: string, parentId: string | null) =>
  fullRow({ id, role: Role.ADMIN_PENYEWA, parentId });

describe('UsersService tenant hierarchy', () => {
  it('menonaktifkan Manager ikut menonaktifkan Admin Penyewa child-nya', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(managerRow('m1'));
    prisma.user.update.mockResolvedValue({ ...managerRow('m1'), isActive: false });

    await svc(prisma).deactivate('super', 'm1');

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { parentId: 'm1' },
      data: { isActive: false },
    });
  });

  it('tidak cascade untuk target non-Manager', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(adminRow('a1', 'm1'));
    prisma.user.update.mockResolvedValue({ ...adminRow('a1', 'm1'), isActive: false });

    await svc(prisma).deactivate('super', 'a1');

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('menolak menonaktifkan akun sendiri', async () => {
    const prisma = mockPrisma();
    await expect(svc(prisma).deactivate('m1', 'm1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('Manager tidak bisa mengelola Admin Penyewa milik Manager lain', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(adminRow('a1', 'lain'));

    await expect(
      svc(prisma).setPenyewaAdminActive('m1', 'a1', false),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('menolak target yang bukan Admin Penyewa', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(managerRow('x'));

    await expect(
      svc(prisma).removePenyewaAdmin('m1', 'x'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('createPenyewaAdmin menetapkan role ADMIN_PENYEWA dan parentId = Manager', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(null); // email bebas
    prisma.user.create.mockResolvedValue({
      id: 'a1',
      nama: 'A',
      email: 'a@x.test',
      role: Role.ADMIN_PENYEWA,
      parentId: 'm1',
      companyName: null,
      isActive: true,
      avatarUrl: null,
      createdAt: new Date(),
    });

    await svc(prisma).createPenyewaAdmin('m1', {
      nama: 'A',
      email: 'a@x.test',
      password: 'secret123',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: Role.ADMIN_PENYEWA, parentId: 'm1' }),
      }),
    );
  });
});

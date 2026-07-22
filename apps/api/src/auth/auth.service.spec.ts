import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@mold-tracker/shared';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

function mockPrisma() {
  return { user: { findUnique: jest.fn(), create: jest.fn() } };
}

const jwt = { signAsync: jest.fn().mockResolvedValue('tok') } as unknown as JwtService;

function svc(prisma: ReturnType<typeof mockPrisma>) {
  return new AuthService(prisma as unknown as PrismaService, jwt);
}

const fullUser = (over: Record<string, unknown>) => ({
  id: 'u1',
  nama: 'N',
  email: 'n@x.test',
  passwordHash: '$2a$10$abcdefghijklmnopqrstuv', // hash palsu, tak dipakai di register
  role: Role.MANAGER_PENYEWA,
  parentId: null,
  companyName: 'PT X',
  isActive: true,
  avatarUrl: null,
  createdAt: new Date(),
  ...over,
});

describe('AuthService', () => {
  it('register selalu membuat MANAGER_PENYEWA dengan companyName', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue(fullUser({}));

    const res = await svc(prisma).register({
      nama: 'N',
      email: 'n@x.test',
      password: 'secret123',
      companyName: 'PT X',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: Role.MANAGER_PENYEWA, companyName: 'PT X' }),
      }),
    );
    expect(res.user.role).toBe(Role.MANAGER_PENYEWA);
    expect(res.accessToken).toBe('tok');
  });

  it('login menolak akun nonaktif', async () => {
    const prisma = mockPrisma();
    prisma.user.findUnique.mockResolvedValue(fullUser({ isActive: false }));

    await expect(
      svc(prisma).login({ identifier: 'n@x.test', password: 'secret123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

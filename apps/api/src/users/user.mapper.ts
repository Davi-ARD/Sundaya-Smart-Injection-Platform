import { User } from '@mold-tracker/shared';
import { User as PrismaUser } from '@prisma/client';

// Batas antara record Prisma dan bentuk API bersama: buang passwordHash,
// tanggal jadi ISO string. Enum shared dan Prisma tipe nominal berbeda meski
// nilainya sama, jadi di-cast di sini.
// ponytail: satu titik konversi enum shared <-> prisma, jangan sebar cast.
export function toUser(u: PrismaUser): User {
  return {
    id: u.id,
    nama: u.nama,
    email: u.email,
    role: u.role as unknown as User['role'],
    parentId: u.parentId,
    isActive: u.isActive,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt.toISOString(),
  };
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { $Enums, Prisma } from '@prisma/client';
import { Role, User } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperatorDto, CreateUserDto, UpdateUserDto } from './dto';
import { toUser } from './user.mapper';

// ponytail: enum shared dan Prisma nominal berbeda, cast di batang DB saja.
const asPrismaRole = (role: Role) => role as unknown as $Enums.Role;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(filter: { role?: Role; isActive?: boolean }): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: filter.role ? asPrismaRole(filter.role) : undefined,
        isActive: filter.isActive,
      },
    });
    return users.map(toUser);
  }

  async create(dto: CreateUserDto): Promise<User> {
    if (dto.role !== Role.OPERATOR && !dto.email) {
      throw new BadRequestException('Email wajib untuk role selain OPERATOR');
    }
    if (dto.email) await this.ensureEmailFree(dto.email);

    // parentId cuma berlaku untuk OPERATOR (id Penyewa induknya) — role lain diabaikan
    // meski terisi, dan divalidasi dulu di sini supaya tidak jatuh ke FK error (P2003) mentah.
    let parentId: string | null = null;
    if (dto.role === Role.OPERATOR && dto.parentId) {
      const parent = await this.prisma.user.findUnique({ where: { id: dto.parentId } });
      if (!parent || parent.role !== asPrismaRole(Role.PENYEWA)) {
        throw new BadRequestException('Parent ID tidak valid. Pilih akun Penyewa yang terdaftar.');
      }
      parentId = dto.parentId;
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: {
          nama: dto.nama,
          email: dto.role === Role.OPERATOR ? null : dto.email,
          passwordHash,
          role: asPrismaRole(dto.role),
          parentId,
        },
      });
      return toUser(user);
    } catch (error) {
      throw this.mapUniqueConstraintError(error);
    }
  }

  async update(adminId: string, id: string, dto: UpdateUserDto): Promise<User> {
    await this.getOrThrow(id);
    if (dto.isActive === false && adminId === id) {
      throw new ForbiddenException('Tidak bisa menonaktifkan akun sendiri yang sedang login');
    }
    if (dto.email) await this.ensureEmailFree(dto.email, id);
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          nama: dto.nama,
          email: dto.email,
          role: dto.role ? asPrismaRole(dto.role) : undefined,
          isActive: dto.isActive,
        },
      });
      return toUser(user);
    } catch (error) {
      throw this.mapUniqueConstraintError(error);
    }
  }

  // Cegah lockout tidak sengaja: ADMIN tidak bisa menonaktifkan akun sendiri yang sedang login
  // (sama seperti guard di remove()) — kalau terlanjur, akun jadi tidak bisa login lagi dan
  // hanya bisa dipulihkan lewat akses database langsung.
  async deactivate(adminId: string, id: string): Promise<User> {
    if (adminId === id) {
      throw new ForbiddenException('Tidak bisa menonaktifkan akun sendiri yang sedang login');
    }
    await this.getOrThrow(id);
    const user = await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    return toUser(user);
  }

  // ADMIN menghapus akun apa pun kecuali dirinya sendiri (cegah lockout tidak sengaja).
  // Ditolak FK (P2003) kalau akun itu masih punya riwayat data (mesin, sewa, batch, dst).
  async remove(adminId: string, id: string): Promise<void> {
    if (adminId === id) {
      throw new ForbiddenException('Tidak bisa menghapus akun sendiri yang sedang login');
    }
    await this.getOrThrow(id);

    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(
          'Akun ini masih punya riwayat data terkait dan tidak bisa dihapus. Nonaktifkan saja akunnya.',
        );
      }
      throw error;
    }
  }

  async createOperator(penyewaId: string, dto: CreateOperatorDto): Promise<User> {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: {
          nama: dto.nama,
          email: null,
          passwordHash,
          role: asPrismaRole(Role.OPERATOR),
          parentId: penyewaId,
        },
      });
      return toUser(user);
    } catch (error) {
      throw this.mapUniqueConstraintError(error);
    }
  }

  async listOperators(penyewaId: string): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: { parentId: penyewaId, role: asPrismaRole(Role.OPERATOR) },
    });
    return users.map(toUser);
  }

  // PENYEWA menghapus sub-akun Operator miliknya. Ditolak FK (P2003) kalau
  // operator itu sudah punya riwayat batch produksi — itu data audit, bukan boleh hilang.
  async removeOperator(penyewaId: string, operatorId: string): Promise<void> {
    const operator = await this.prisma.user.findUnique({ where: { id: operatorId } });
    if (!operator || operator.role !== asPrismaRole(Role.OPERATOR)) {
      throw new NotFoundException('Operator tidak ditemukan');
    }
    if (operator.parentId !== penyewaId) {
      throw new ForbiddenException('Bukan operator milik Anda');
    }

    try {
      await this.prisma.user.delete({ where: { id: operatorId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(
          'Operator ini punya riwayat batch produksi dan tidak bisa dihapus. Minta Admin menonaktifkannya saja.',
        );
      }
      throw error;
    }
  }

  private async getOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User tidak ditemukan');
    return user;
  }

  private async ensureEmailFree(email: string, exceptId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== exceptId) throw new ConflictException('Email sudah terdaftar');
  }

  // nama unik per role (constraint @@unique([nama, role])) — dipakai lookup login OPERATOR.
  private mapUniqueConstraintError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('Nama sudah digunakan untuk role ini');
    }
    return error;
  }
}

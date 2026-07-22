import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { $Enums, Prisma } from '@prisma/client';
import { Role, User } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePenyewaAdminDto, CreateStaffDto, UpdateUserDto } from './dto';
import { toUser } from './user.mapper';

// ponytail: enum shared dan Prisma nominal berbeda, cast di batang DB saja.
const asPrismaRole = (role: Role) => role as unknown as $Enums.Role;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // --- Staf Sundaya (dikelola Super Admin) ---

  async findAll(filter: { role?: Role; isActive?: boolean }): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: filter.role ? asPrismaRole(filter.role) : undefined,
        isActive: filter.isActive,
      },
    });
    return users.map(toUser);
  }

  async createStaff(dto: CreateStaffDto): Promise<User> {
    await this.ensureEmailFree(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: { nama: dto.nama, email: dto.email, passwordHash, role: asPrismaRole(dto.role) },
      });
      return toUser(user);
    } catch (error) {
      throw this.mapEmailConflict(error);
    }
  }

  async update(actorId: string, id: string, dto: UpdateUserDto): Promise<User> {
    await this.getOrThrow(id);
    if (dto.isActive === false && actorId === id) {
      throw new ForbiddenException('Tidak bisa menonaktifkan akun sendiri yang sedang login');
    }
    if (dto.email) await this.ensureEmailFree(dto.email, id);
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { nama: dto.nama, email: dto.email, isActive: dto.isActive },
      });
      // Nonaktifkan Manager berarti nonaktifkan seluruh Admin Penyewa child-nya
      // (child tidak boleh berdiri tanpa Manager aktif).
      if (dto.isActive === false && user.role === $Enums.Role.MANAGER_PENYEWA) {
        await this.deactivateChildren(user.id);
      }
      return toUser(user);
    } catch (error) {
      throw this.mapEmailConflict(error);
    }
  }

  // Cegah lockout: tidak bisa menonaktifkan akun sendiri yang sedang login.
  async deactivate(actorId: string, id: string): Promise<User> {
    if (actorId === id) {
      throw new ForbiddenException('Tidak bisa menonaktifkan akun sendiri yang sedang login');
    }
    const target = await this.getOrThrow(id);
    const user = await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    if (target.role === $Enums.Role.MANAGER_PENYEWA) await this.deactivateChildren(id);
    return toUser(user);
  }

  async remove(actorId: string, id: string): Promise<void> {
    if (actorId === id) {
      throw new ForbiddenException('Tidak bisa menghapus akun sendiri yang sedang login');
    }
    await this.getOrThrow(id);
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(
          'Akun ini masih punya data terkait dan tidak bisa dihapus. Nonaktifkan saja akunnya.',
        );
      }
      throw error;
    }
  }

  // --- Admin Penyewa (child, dikelola Manager Penyewa) ---

  async createPenyewaAdmin(managerId: string, dto: CreatePenyewaAdminDto): Promise<User> {
    await this.ensureEmailFree(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: {
          nama: dto.nama,
          email: dto.email,
          passwordHash,
          role: $Enums.Role.ADMIN_PENYEWA,
          parentId: managerId,
        },
      });
      return toUser(user);
    } catch (error) {
      throw this.mapEmailConflict(error);
    }
  }

  async listPenyewaAdmins(managerId: string): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: { parentId: managerId, role: $Enums.Role.ADMIN_PENYEWA },
    });
    return users.map(toUser);
  }

  async setPenyewaAdminActive(managerId: string, id: string, isActive: boolean): Promise<User> {
    const admin = await this.getOwnedPenyewaAdmin(managerId, id);
    const updated = await this.prisma.user.update({ where: { id: admin.id }, data: { isActive } });
    return toUser(updated);
  }

  async removePenyewaAdmin(managerId: string, id: string): Promise<void> {
    const admin = await this.getOwnedPenyewaAdmin(managerId, id);
    try {
      await this.prisma.user.delete({ where: { id: admin.id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(
          'Admin ini punya riwayat log produksi dan tidak bisa dihapus. Nonaktifkan saja.',
        );
      }
      throw error;
    }
  }

  // --- helper ---

  private async deactivateChildren(managerId: string) {
    await this.prisma.user.updateMany({ where: { parentId: managerId }, data: { isActive: false } });
  }

  private async getOwnedPenyewaAdmin(managerId: string, id: string) {
    const admin = await this.prisma.user.findUnique({ where: { id } });
    if (!admin || admin.role !== $Enums.Role.ADMIN_PENYEWA) {
      throw new NotFoundException('Admin Penyewa tidak ditemukan');
    }
    if (admin.parentId !== managerId) {
      throw new ForbiddenException('Bukan Admin Penyewa milik Anda');
    }
    return admin;
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

  private mapEmailConflict(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('Email sudah terdaftar');
    }
    return error;
  }
}

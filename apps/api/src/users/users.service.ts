import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { $Enums } from '@prisma/client';
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
    await this.ensureEmailFree(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        nama: dto.nama,
        email: dto.email,
        passwordHash,
        role: asPrismaRole(dto.role),
        parentId: dto.parentId ?? null,
      },
    });
    return toUser(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    await this.getOrThrow(id);
    if (dto.email) await this.ensureEmailFree(dto.email, id);
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
  }

  async deactivate(id: string): Promise<User> {
    await this.getOrThrow(id);
    const user = await this.prisma.user.update({ where: { id }, data: { isActive: false } });
    return toUser(user);
  }

  async createOperator(penyewaId: string, dto: CreateOperatorDto): Promise<User> {
    await this.ensureEmailFree(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        nama: dto.nama,
        email: dto.email,
        passwordHash,
        role: asPrismaRole(Role.OPERATOR),
        parentId: penyewaId,
      },
    });
    return toUser(user);
  }

  async listOperators(penyewaId: string): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: { parentId: penyewaId, role: asPrismaRole(Role.OPERATOR) },
    });
    return users.map(toUser);
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
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { $Enums, Prisma, User as PrismaUser } from '@prisma/client';
import { AuthResponse, User } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toUser } from '../users/user.mapper';
import { LoginDto, RegisterDto, UpdateProfileDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  // Register publik hanya membuat Manager Penyewa (tenant root). Staf Sundaya
  // dan Admin Penyewa dibuat lewat modul users, bukan di sini.
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email sudah terdaftar');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        nama: dto.nama,
        email: dto.email,
        passwordHash,
        role: $Enums.Role.MANAGER_PENYEWA,
        companyName: dto.companyName,
      },
    });
    return this.buildAuth(user);
  }

  // Satu form login untuk semua role; role akun dideteksi dari database, tidak
  // diminta di form (frontend hanya mengelompokkan tab Penyewa/Internal untuk
  // tampilan, tidak dikirim ke backend).
  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.identifier } });
    if (!user || !user.isActive) throw new UnauthorizedException('Email Salah');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Password Salah');
    return this.buildAuth(user);
  }

  // Edit profil sendiri untuk semua role. JWT keyed by user.id, jadi ganti
  // nama/email tidak membatalkan sesi.
  async updateProfile(user: PrismaUser, dto: UpdateProfileDto): Promise<User> {
    const data: Prisma.UserUpdateInput = {};

    if (dto.nama !== undefined) data.nama = dto.nama;

    if (dto.email !== undefined) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing && existing.id !== user.id) {
        throw new ConflictException('Email sudah terdaftar');
      }
      data.email = dto.email;
    }

    // companyName hanya relevan untuk Manager Penyewa (identitas perusahaan).
    if (dto.companyName !== undefined) {
      if (user.role !== $Enums.Role.MANAGER_PENYEWA) {
        throw new BadRequestException('Hanya Manager Penyewa yang punya nama perusahaan');
      }
      data.companyName = dto.companyName;
    }

    if (dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Password saat ini wajib diisi untuk mengganti password');
      }
      const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!ok) throw new UnauthorizedException('Password saat ini salah');
      data.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    }

    try {
      const updated = await this.prisma.user.update({ where: { id: user.id }, data });
      return toUser(updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Email sudah terdaftar');
      }
      throw error;
    }
  }

  // Simpan path avatar baru dan bersihkan file lama (best-effort, tidak fatal bila gagal).
  async updateAvatar(user: PrismaUser, avatarUrl: string): Promise<User> {
    const previous = user.avatarUrl;
    const updated = await this.prisma.user.update({ where: { id: user.id }, data: { avatarUrl } });
    if (previous) {
      await unlink(join(process.cwd(), previous.replace(/^\/+/, ''))).catch(() => undefined);
    }
    return toUser(updated);
  }

  private async buildAuth(user: PrismaUser): Promise<AuthResponse> {
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { accessToken, user: toUser(user) };
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Mold } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMoldDto, UpdateMoldDto } from './dto';
import { toMold } from './mold.mapper';

@Injectable()
export class MoldsService {
  constructor(private prisma: PrismaService) {}

  // Scoping tenant: mold selalu milik Manager (tenant root). Manager hanya
  // melihat mold dengan managerId dirinya sendiri.
  async findAll(managerId: string): Promise<Mold[]> {
    const molds = await this.prisma.mold.findMany({
      where: { managerId },
      orderBy: { createdAt: 'desc' },
    });
    return molds.map(toMold);
  }

  async findOne(managerId: string, id: string): Promise<Mold> {
    return toMold(await this.getOwned(managerId, id));
  }

  // Staf Sundaya: baca semua mold (single-provider, tanpa scoping tenant),
  // dipakai untuk approval booking dan transisi tracking.
  async findAllStaff(): Promise<Mold[]> {
    const molds = await this.prisma.mold.findMany({ orderBy: { createdAt: 'desc' } });
    return molds.map(toMold);
  }

  async findOneStaff(id: string): Promise<Mold> {
    const mold = await this.prisma.mold.findUnique({ where: { id } });
    if (!mold) throw new NotFoundException('Cetakan tidak ditemukan');
    return toMold(mold);
  }

  // trackingStatus di-default PLANNING oleh schema; tidak diterima dari client.
  async create(managerId: string, dto: CreateMoldDto): Promise<Mold> {
    try {
      const mold = await this.prisma.mold.create({
        data: {
          kodeMold: dto.kodeMold,
          namaProduk: dto.namaProduk,
          cavity: dto.cavity,
          tonaseTon: dto.tonaseTon,
          deskripsi: dto.deskripsi,
          planMaterialUtama: dto.planMaterialUtama,
          estimasiKg: dto.estimasiKg,
          targetOutput: dto.targetOutput,
          managerId,
        },
      });
      return toMold(mold);
    } catch (error) {
      throw this.mapKodeConflict(error);
    }
  }

  // Update field plan saja. trackingStatus tidak diubah di sini (transisi lewat
  // modul tracking, service-guarded). kodeMold tidak boleh ganti.
  async update(managerId: string, id: string, dto: UpdateMoldDto): Promise<Mold> {
    await this.getOwned(managerId, id);
    const mold = await this.prisma.mold.update({
      where: { id },
      data: {
        namaProduk: dto.namaProduk,
        cavity: dto.cavity,
        tonaseTon: dto.tonaseTon,
        deskripsi: dto.deskripsi,
        planMaterialUtama: dto.planMaterialUtama,
        estimasiKg: dto.estimasiKg,
        targetOutput: dto.targetOutput,
      },
    });
    return toMold(mold);
  }

  // Mold milik Manager lain (atau tidak ada) sama-sama NotFound: jangan bocorkan
  // keberadaan data tenant lain.
  private async getOwned(managerId: string, id: string) {
    const mold = await this.prisma.mold.findUnique({ where: { id } });
    if (!mold || mold.managerId !== managerId) {
      throw new NotFoundException('Cetakan tidak ditemukan');
    }
    return mold;
  }

  private mapKodeConflict(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException('Kode mold sudah terpakai');
    }
    return error;
  }
}

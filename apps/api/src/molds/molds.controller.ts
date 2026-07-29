import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { Mold, Role } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { MoldsService } from './molds.service';
import { CreateMoldDto, UpdateMoldDto } from './dto';

// Cetakan (Mold). CRUD milik Manager Penyewa. Transisi tracking status ada di
// endpoint terpisah (modul tracking, Dev A).
// ponytail: GET dibuka juga untuk staf Sundaya (baca semua, single-provider
// jadi tanpa scoping tenant) karena mereka butuh melihat mold untuk approval
// booking dan transisi tracking (ADMIN_SUNDAYA semua transisi, TEKNISI setup).
// SUPER_ADMIN ikut membaca supaya halaman staf (Dashboard, Booking, Mold
// Tracking) tidak 403 untuknya, sejalan dengan modul Mesin.
const STAF_TRACKING = [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA] as const;

@Roles(Role.MANAGER_PENYEWA)
@Controller('molds')
export class MoldsController {
  constructor(private molds: MoldsService) {}

  @Roles(Role.MANAGER_PENYEWA, ...STAF_TRACKING)
  @Get()
  findAll(@CurrentUser() actor: PrismaUser): Promise<Mold[]> {
    if (actor.role === Role.MANAGER_PENYEWA) return this.molds.findAll(actor.id);
    return this.molds.findAllStaff();
  }

  @Roles(Role.MANAGER_PENYEWA, ...STAF_TRACKING)
  @Get(':id')
  findOne(@CurrentUser() actor: PrismaUser, @Param('id') id: string): Promise<Mold> {
    if (actor.role === Role.MANAGER_PENYEWA) return this.molds.findOne(actor.id, id);
    return this.molds.findOneStaff(id);
  }

  @Post()
  create(@CurrentUser() actor: PrismaUser, @Body() dto: CreateMoldDto): Promise<Mold> {
    return this.molds.create(actor.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: PrismaUser,
    @Param('id') id: string,
    @Body() dto: UpdateMoldDto,
  ): Promise<Mold> {
    return this.molds.update(actor.id, id, dto);
  }
}

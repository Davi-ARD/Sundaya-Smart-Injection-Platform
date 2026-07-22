import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { Mold, Role } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { MoldsService } from './molds.service';
import { CreateMoldDto, UpdateMoldDto } from './dto';

// Cetakan (Mold). CRUD milik Manager Penyewa. Transisi tracking status ada di
// endpoint terpisah (modul tracking, Dev A).
@Roles(Role.MANAGER_PENYEWA)
@Controller('molds')
export class MoldsController {
  constructor(private molds: MoldsService) {}

  @Get()
  findAll(@CurrentUser() actor: PrismaUser): Promise<Mold[]> {
    return this.molds.findAll(actor.id);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: PrismaUser, @Param('id') id: string): Promise<Mold> {
    return this.molds.findOne(actor.id, id);
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

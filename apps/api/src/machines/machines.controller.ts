import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { Machine, MachineStatus, Role } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { MachinesService } from './machines.service';
import { CreateMachineDto, UpdateMachineDto } from './dto';

// Modul internal Sundaya. Semua endpoint hanya untuk staf Sundaya; Penyewa
// tidak pernah mengakses katalog mesin (booking lewat mold, bukan pilih mesin).
const STAF_SUNDAYA = [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA] as const;

@Controller('machines')
export class MachinesController {
  constructor(private machines: MachinesService) {}

  @Roles(...STAF_SUNDAYA)
  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('archived') archived?: string,
  ): Promise<Machine[]> {
    const statusFilter =
      status && (Object.values(MachineStatus) as string[]).includes(status)
        ? (status as MachineStatus)
        : undefined;
    return this.machines.findAll(statusFilter, archived === 'true');
  }

  @Roles(...STAF_SUNDAYA)
  @Get(':id')
  findOne(@Param('id') id: string): Promise<Machine> {
    return this.machines.findOne(id);
  }

  @Roles(Role.ADMIN_SUNDAYA)
  @Post()
  create(@CurrentUser() user: PrismaUser, @Body() dto: CreateMachineDto): Promise<Machine> {
    return this.machines.create(user, dto);
  }

  @Roles(Role.ADMIN_SUNDAYA)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMachineDto): Promise<Machine> {
    return this.machines.update(id, dto);
  }

  @Roles(Role.ADMIN_SUNDAYA)
  @Patch(':id/archive')
  archive(@Param('id') id: string): Promise<Machine> {
    return this.machines.archive(id);
  }

  @Roles(Role.ADMIN_SUNDAYA)
  @Patch(':id/unarchive')
  unarchive(@Param('id') id: string): Promise<Machine> {
    return this.machines.unarchive(id);
  }
}

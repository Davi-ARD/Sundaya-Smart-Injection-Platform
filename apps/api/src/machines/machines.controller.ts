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
import {
  Machine,
  MachineStatus,
  MachineStatusCount,
  OperationalData,
  Role,
} from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { MachinesService } from './machines.service';
import { OperationalService } from './operational.service';
import { CreateMachineDto, UpdateMachineDto } from './dto';
import { CreateOperationalDataDto } from './operational.dto';

// Modul internal Sundaya. Semua endpoint hanya untuk staf Sundaya; Penyewa
// tidak pernah mengakses katalog mesin (booking lewat mold, bukan pilih mesin).
const STAF_SUNDAYA = [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA] as const;

// Super Admin punya seluruh wewenang Admin Sundaya; bedanya hanya Super Admin
// yang bisa mengelola pengguna.
const ADMIN_DAN_SUPER = [Role.ADMIN_SUNDAYA, Role.SUPER_ADMIN] as const;

@Controller('machines')
export class MachinesController {
  constructor(
    private machines: MachinesService,
    private operational: OperationalService,
  ) {}

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

  // Dideklarasikan sebelum GET :id agar route statis 'operational' tidak
  // tertangkap oleh parameter :id.
  @Roles(Role.TEKNISI_SUNDAYA, ...ADMIN_DAN_SUPER)
  @Get('operational')
  operationalSummary(): Promise<MachineStatusCount[]> {
    return this.operational.summary();
  }

  @Roles(...STAF_SUNDAYA)
  @Get(':id')
  findOne(@Param('id') id: string): Promise<Machine> {
    return this.machines.findOne(id);
  }

  // Layer 1 (Teknisi): append event status realtime + reason code. Append-only.
  @Roles(Role.TEKNISI_SUNDAYA)
  @Post(':id/operational')
  appendOperational(
    @CurrentUser() user: PrismaUser,
    @Param('id') id: string,
    @Body() dto: CreateOperationalDataDto,
  ): Promise<OperationalData> {
    return this.operational.append(user, id, dto);
  }

  @Roles(...ADMIN_DAN_SUPER)
  @Post()
  create(@CurrentUser() user: PrismaUser, @Body() dto: CreateMachineDto): Promise<Machine> {
    return this.machines.create(user, dto);
  }

  @Roles(...ADMIN_DAN_SUPER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMachineDto): Promise<Machine> {
    return this.machines.update(id, dto);
  }

  @Roles(...ADMIN_DAN_SUPER)
  @Patch(':id/archive')
  archive(@Param('id') id: string): Promise<Machine> {
    return this.machines.archive(id);
  }

  @Roles(...ADMIN_DAN_SUPER)
  @Patch(':id/unarchive')
  unarchive(@Param('id') id: string): Promise<Machine> {
    return this.machines.unarchive(id);
  }
}

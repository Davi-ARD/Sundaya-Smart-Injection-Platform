import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { Maintenance, MaintenanceStatus, Role } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceDto, UpdateMaintenanceStatusDto } from './dto';

// Modul internal Sundaya. Teknisi menulis (jadwal + transisi), Admin Sundaya baca.
@Controller('maintenance')
export class MaintenanceController {
  constructor(private maintenance: MaintenanceService) {}

  @Roles(Role.TEKNISI_SUNDAYA, Role.ADMIN_SUNDAYA)
  @Get()
  findAll(
    @Query('machineId') machineId?: string,
    @Query('status') status?: string,
  ): Promise<Maintenance[]> {
    const statusFilter =
      status && (Object.values(MaintenanceStatus) as string[]).includes(status)
        ? (status as MaintenanceStatus)
        : undefined;
    return this.maintenance.findAll(machineId, statusFilter);
  }

  @Roles(Role.TEKNISI_SUNDAYA)
  @Post()
  create(
    @CurrentUser() user: PrismaUser,
    @Body() dto: CreateMaintenanceDto,
  ): Promise<Maintenance> {
    return this.maintenance.create(user, dto);
  }

  @Roles(Role.TEKNISI_SUNDAYA)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceStatusDto,
  ): Promise<Maintenance> {
    return this.maintenance.updateStatus(id, dto);
  }
}

import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { LogPenerimaan, Role } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { PenerimaanService } from './penerimaan.service';
import { CreateLogPenerimaanDto } from './dto';

// Log Penerimaan: milik Admin Sundaya, mencatat mold dan material yang tiba di
// lokasi Sundaya. Manager Penyewa boleh membaca log job miliknya (dan menerima
// notifikasi tiap penerimaan baru).
@Controller('penerimaan')
export class PenerimaanController {
  constructor(private penerimaan: PenerimaanService) {}

  @Roles(Role.ADMIN_SUNDAYA, Role.SUPER_ADMIN, Role.MANAGER_PENYEWA)
  @Get()
  list(@CurrentUser() user: PrismaUser, @Query('jobId') jobId?: string): Promise<LogPenerimaan[]> {
    return this.penerimaan.list(user, jobId);
  }

  @Roles(Role.ADMIN_SUNDAYA)
  @Post()
  create(
    @CurrentUser() user: PrismaUser,
    @Body() dto: CreateLogPenerimaanDto,
  ): Promise<LogPenerimaan> {
    return this.penerimaan.create(user, dto);
  }
}

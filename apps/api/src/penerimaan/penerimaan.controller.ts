import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { LogPenerimaan, Role } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { PenerimaanService } from './penerimaan.service';
import { CreateLogPenerimaanDto } from './dto';

// Log Aktivitas: milik Admin Penyewa, yang bertugas di lokasi Sundaya dan
// menyaksikan langsung mold serta material datang. Manager Penyewa membaca log
// job miliknya dan menerima notifikasi tiap ada penerimaan baru; staf Sundaya
// boleh membaca semuanya karena barangnya masuk ke lokasi mereka.
@Controller('penerimaan')
export class PenerimaanController {
  constructor(private penerimaan: PenerimaanService) {}

  @Roles(Role.ADMIN_PENYEWA, Role.MANAGER_PENYEWA, Role.ADMIN_SUNDAYA, Role.SUPER_ADMIN)
  @Get()
  list(@CurrentUser() user: PrismaUser, @Query('jobId') jobId?: string): Promise<LogPenerimaan[]> {
    return this.penerimaan.list(user, jobId);
  }

  @Roles(Role.ADMIN_PENYEWA)
  @Post()
  create(
    @CurrentUser() user: PrismaUser,
    @Body() dto: CreateLogPenerimaanDto,
  ): Promise<LogPenerimaan> {
    return this.penerimaan.create(user, dto);
  }
}

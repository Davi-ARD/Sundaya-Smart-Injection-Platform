import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { LogPengiriman, Role } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { PengirimanService } from './pengiriman.service';
import { CreateLogPengirimanDto } from './dto';

// Log Pengiriman: log informasi milik Manager Penyewa soal kapan mold atau
// material akan dikirim ke Sundaya. Staf Sundaya membaca untuk mengantisipasi
// kedatangan (dan menerima notifikasi tiap log baru).
@Controller('pengiriman')
export class PengirimanController {
  constructor(private pengiriman: PengirimanService) {}

  @Roles(Role.MANAGER_PENYEWA, Role.ADMIN_PENYEWA, Role.ADMIN_SUNDAYA, Role.SUPER_ADMIN)
  @Get()
  list(@CurrentUser() user: PrismaUser, @Query('jobId') jobId?: string): Promise<LogPengiriman[]> {
    return this.pengiriman.list(user, jobId);
  }

  @Roles(Role.MANAGER_PENYEWA)
  @Post()
  create(
    @CurrentUser() user: PrismaUser,
    @Body() dto: CreateLogPengirimanDto,
  ): Promise<LogPengiriman> {
    return this.pengiriman.create(user, dto);
  }
}

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { LogProduksi, Role } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { LogProduksiService } from './log-produksi.service';
import { CreateLogProduksiDto } from './dto';

// Log Produksi (Layer 2). Timeline dibaca pihak tenant + staf; append hanya
// Admin Penyewa (di lokasi Sundaya). Append-only: tanpa PATCH/DELETE.
@Controller('jobs/:jobId/logs')
export class LogProduksiController {
  constructor(private logs: LogProduksiService) {}

  @Roles(Role.ADMIN_PENYEWA, Role.MANAGER_PENYEWA, Role.ADMIN_SUNDAYA, Role.SUPER_ADMIN)
  @Get()
  findAll(@CurrentUser() user: PrismaUser, @Param('jobId') jobId: string): Promise<LogProduksi[]> {
    return this.logs.findAll(user, jobId);
  }

  @Roles(Role.ADMIN_PENYEWA)
  @Post()
  append(
    @CurrentUser() user: PrismaUser,
    @Param('jobId') jobId: string,
    @Body() dto: CreateLogProduksiDto,
  ): Promise<LogProduksi> {
    return this.logs.append(user, jobId, dto);
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { DeliveryRow, Role } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { PengirimanService } from './pengiriman.service';

// Log Pengiriman: turunan read-only (rencana vs aktual kirim). Milik Manager;
// staf Sundaya boleh baca. Tanpa endpoint tulis (aturan domain).
@Controller('pengiriman')
export class PengirimanController {
  constructor(private pengiriman: PengirimanService) {}

  @Roles(Role.MANAGER_PENYEWA, Role.ADMIN_SUNDAYA, Role.SUPER_ADMIN)
  @Get()
  list(@CurrentUser() user: PrismaUser, @Query('managerId') managerId?: string): Promise<DeliveryRow[]> {
    return this.pengiriman.list(user, managerId);
  }
}

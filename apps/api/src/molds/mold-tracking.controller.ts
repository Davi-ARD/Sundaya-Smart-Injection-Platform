import { Body, Controller, Param, Patch } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { Mold, Role } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { MoldTrackingService } from './mold-tracking.service';
import { UpdateMoldTrackingDto } from './mold-tracking.dto';

// Transisi tracking mold, terpisah dari MoldsController (CRUD Manager). Hanya
// dua transisi penutup siklus yang manual; sisanya otomatis dari event domain.
// Kedua role diizinkan di guard, lalu service menegakkan siapa boleh status mana
// (SEND_BACK milik Admin Sundaya, COMPLETED milik Manager pemilik cetakan).
// Path :id/tracking tidak bertabrakan dengan :id (update).
@Controller('molds')
export class MoldTrackingController {
  constructor(private tracking: MoldTrackingService) {}

  @Roles(Role.ADMIN_SUNDAYA, Role.MANAGER_PENYEWA)
  @Patch(':id/tracking')
  transition(
    @CurrentUser() user: PrismaUser,
    @Param('id') id: string,
    @Body() dto: UpdateMoldTrackingDto,
  ): Promise<Mold> {
    return this.tracking.transition(user, id, dto);
  }
}

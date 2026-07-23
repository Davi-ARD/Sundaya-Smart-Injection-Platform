import { Body, Controller, Param, Patch } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { Mold, Role } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { MoldTrackingService } from './mold-tracking.service';
import { UpdateMoldTrackingDto } from './mold-tracking.dto';

// Transisi tracking mold (Dev A), terpisah dari MoldsController (CRUD Manager).
// ADMIN_SUNDAYA boleh semua transisi; TEKNISI_SUNDAYA hanya setup/produksi
// (ditegakkan di service). Path :id/tracking tidak bertabrakan dengan :id (update).
@Controller('molds')
export class MoldTrackingController {
  constructor(private tracking: MoldTrackingService) {}

  @Roles(Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA)
  @Patch(':id/tracking')
  transition(
    @CurrentUser() user: PrismaUser,
    @Param('id') id: string,
    @Body() dto: UpdateMoldTrackingDto,
  ): Promise<Mold> {
    return this.tracking.transition(user, id, dto);
  }
}

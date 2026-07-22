import { Body, Controller, Param, Patch } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { RentalExtension, Role } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { RentalsService } from './rentals.service';
import { DecideExtensionDto } from './dto';

// Prefix /extensions terpisah dari /rentals; tetap dilayani RentalsService.
@Controller('extensions')
export class ExtensionsController {
  constructor(private rentals: RentalsService) {}

  @Roles(Role.PENYEDIA, Role.ADMIN)
  @Patch(':id/decide')
  decide(
    @CurrentUser() user: PrismaUser,
    @Param('id') id: string,
    @Body() dto: DecideExtensionDto,
  ): Promise<RentalExtension> {
    return this.rentals.decideExtension(user, id, dto);
  }
}

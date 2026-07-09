import { Module } from '@nestjs/common';
import { RentalsService } from './rentals.service';
import { RentalsController } from './rentals.controller';
import { ExtensionsController } from './extensions.controller';

@Module({
  controllers: [RentalsController, ExtensionsController],
  providers: [RentalsService],
})
export class RentalsModule {}

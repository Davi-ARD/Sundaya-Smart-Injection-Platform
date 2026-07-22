import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalsService } from './rentals.service';
import { RentalsController } from './rentals.controller';
import { ExtensionsController } from './extensions.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [RentalsController, ExtensionsController],
  providers: [RentalsService],
})
export class RentalsModule {}

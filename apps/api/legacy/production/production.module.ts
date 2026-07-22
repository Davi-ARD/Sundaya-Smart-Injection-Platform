import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProductionService } from './production.service';
import { ProductionController } from './production.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [ProductionController],
  providers: [ProductionService],
})
export class ProductionModule {}

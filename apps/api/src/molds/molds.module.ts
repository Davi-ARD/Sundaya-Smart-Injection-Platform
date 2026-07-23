import { Module } from '@nestjs/common';
import { MoldsService } from './molds.service';
import { MoldsController } from './molds.controller';
import { MoldTrackingService } from './mold-tracking.service';
import { MoldTrackingController } from './mold-tracking.controller';

@Module({
  controllers: [MoldsController, MoldTrackingController],
  providers: [MoldsService, MoldTrackingService],
})
export class MoldsModule {}

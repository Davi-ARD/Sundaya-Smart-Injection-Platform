import { Module } from '@nestjs/common';
import { MoldsService } from './molds.service';
import { MoldsController } from './molds.controller';

@Module({
  controllers: [MoldsController],
  providers: [MoldsService],
})
export class MoldsModule {}

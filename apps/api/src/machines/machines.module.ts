import { Module } from '@nestjs/common';
import { MachinesService } from './machines.service';
import { OperationalService } from './operational.service';
import { MachinesController } from './machines.controller';

@Module({
  controllers: [MachinesController],
  providers: [MachinesService, OperationalService],
})
export class MachinesModule {}

import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { MachineMetricsController } from './machine-metrics.controller';

@Module({
  controllers: [DashboardController, MachineMetricsController],
  providers: [DashboardService],
})
export class DashboardModule {}

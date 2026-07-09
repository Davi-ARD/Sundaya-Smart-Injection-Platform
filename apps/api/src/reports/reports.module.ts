import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { DashboardController } from './dashboard.controller';
import { ReportsController } from './reports.controller';

@Module({
  controllers: [DashboardController, ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}

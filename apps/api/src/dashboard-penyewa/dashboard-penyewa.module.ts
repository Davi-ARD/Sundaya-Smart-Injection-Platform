import { Module } from '@nestjs/common';
import { DashboardPenyewaService } from './dashboard-penyewa.service';
import { DashboardPenyewaController } from './dashboard-penyewa.controller';

@Module({
  controllers: [DashboardPenyewaController],
  providers: [DashboardPenyewaService],
})
export class DashboardPenyewaModule {}

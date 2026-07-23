import { Module } from '@nestjs/common';
import { PengirimanModule } from '../pengiriman/pengiriman.module';
import { DashboardPenyewaService } from './dashboard-penyewa.service';
import { DashboardPenyewaController } from './dashboard-penyewa.controller';

@Module({
  imports: [PengirimanModule],
  controllers: [DashboardPenyewaController],
  providers: [DashboardPenyewaService],
})
export class DashboardPenyewaModule {}

import { Module } from '@nestjs/common';
import { MoldsService } from './molds.service';
import { MoldsController } from './molds.controller';
import { MoldTrackingService } from './mold-tracking.service';
import { MoldTrackingController } from './mold-tracking.controller';

// MoldTrackingService diekspor: modul pengiriman, penerimaan, dan log-produksi
// memanggil advance() untuk transisi otomatis di dalam transaksi mereka.
@Module({
  controllers: [MoldsController, MoldTrackingController],
  providers: [MoldsService, MoldTrackingService],
  exports: [MoldTrackingService],
})
export class MoldsModule {}

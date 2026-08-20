import { Module } from '@nestjs/common';
import { MoldsService } from './molds.service';
import { MoldsController } from './molds.controller';
import { MoldTrackingService } from './mold-tracking.service';

// MoldTrackingService diekspor: modul pengiriman, penerimaan, dan log-produksi
// memanggil advance() untuk transisi otomatis di dalam transaksi mereka. Tidak ada
// controller tracking: seluruh status cetakan bergerak otomatis dari event domain.
@Module({
  controllers: [MoldsController],
  providers: [MoldsService, MoldTrackingService],
  exports: [MoldTrackingService],
})
export class MoldsModule {}

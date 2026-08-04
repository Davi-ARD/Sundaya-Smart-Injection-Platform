import { Module } from '@nestjs/common';
import { MoldsService } from './molds.service';
import { MoldsController } from './molds.controller';
import { MoldTrackingService } from './mold-tracking.service';
import { MoldTrackingController } from './mold-tracking.controller';
import { NotificationsModule } from '../notifications/notifications.module';

// MoldTrackingService diekspor: modul pengiriman, penerimaan, dan log-produksi
// memanggil advance() untuk transisi otomatis di dalam transaksi mereka.
// NotificationsModule dipakai memberi tahu pihak seberang saat cetakan dikirim
// balik dan saat penyewa mengonfirmasi cetakan itu sudah diterima kembali.
@Module({
  imports: [NotificationsModule],
  controllers: [MoldsController, MoldTrackingController],
  providers: [MoldsService, MoldTrackingService],
  exports: [MoldTrackingService],
})
export class MoldsModule {}

import { Module } from '@nestjs/common';
import { MoldsModule } from '../molds/molds.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PenerimaanService } from './penerimaan.service';
import { PenerimaanController } from './penerimaan.controller';

// MoldsModule untuk transisi otomatis mold ke RECEIVED, NotificationsModule
// untuk memberi tahu Manager Penyewa bahwa barangnya sudah tiba.
@Module({
  imports: [MoldsModule, NotificationsModule],
  controllers: [PenerimaanController],
  providers: [PenerimaanService],
})
export class PenerimaanModule {}

import { Module } from '@nestjs/common';
import { MoldsModule } from '../molds/molds.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PengirimanService } from './pengiriman.service';
import { PengirimanController } from './pengiriman.controller';

// MoldsModule untuk transisi otomatis mold ke DELIVERY, NotificationsModule
// untuk memberi tahu Admin Sundaya tiap ada rencana pengiriman baru.
@Module({
  imports: [MoldsModule, NotificationsModule],
  controllers: [PengirimanController],
  providers: [PengirimanService],
})
export class PengirimanModule {}

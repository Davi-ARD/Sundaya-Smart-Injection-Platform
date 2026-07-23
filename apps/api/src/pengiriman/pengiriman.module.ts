import { Module } from '@nestjs/common';
import { PengirimanService } from './pengiriman.service';
import { PengirimanController } from './pengiriman.controller';

@Module({
  controllers: [PengirimanController],
  providers: [PengirimanService],
})
export class PengirimanModule {}

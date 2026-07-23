import { Module } from '@nestjs/common';
import { LogProduksiService } from './log-produksi.service';
import { LogProduksiController } from './log-produksi.controller';

@Module({
  controllers: [LogProduksiController],
  providers: [LogProduksiService],
})
export class LogProduksiModule {}

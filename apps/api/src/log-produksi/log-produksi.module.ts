import { Module } from '@nestjs/common';
import { MoldsModule } from '../molds/molds.module';
import { LogProduksiService } from './log-produksi.service';
import { LogProduksiController } from './log-produksi.controller';

// MoldsModule untuk transisi otomatis mold ke PRODUCTION saat produksi harian
// pertama dicatat.
@Module({
  imports: [MoldsModule],
  controllers: [LogProduksiController],
  providers: [LogProduksiService],
})
export class LogProduksiModule {}

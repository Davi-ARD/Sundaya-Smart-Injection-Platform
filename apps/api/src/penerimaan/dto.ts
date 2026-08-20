import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import {
  CreateLogPenerimaanRequest,
  ItemPengiriman,
  MaterialType,
} from '@mold-tracker/shared';

// Log Penerimaan dibuat Admin Sundaya saat barang tiba di lokasi Sundaya. Field
// material hanya wajib untuk item MATERIAL (ditegakkan di service).
export class CreateLogPenerimaanDto implements CreateLogPenerimaanRequest {
  @IsString()
  @MinLength(1)
  jobId: string;

  // Wajib untuk item MOLD (ditegakkan di service): booking bisa memuat beberapa cetakan.
  @IsOptional()
  @IsString()
  @MinLength(1)
  moldId?: string;

  @IsEnum(ItemPengiriman)
  item: ItemPengiriman;

  @IsDateString()
  diterimaAt: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  materialName?: MaterialType;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  jumlahKg?: number;

  @IsOptional()
  @IsString()
  noSuratJalan?: string;

  @IsOptional()
  @IsString()
  kondisi?: string;

  @IsOptional()
  @IsString()
  catatan?: string;
}

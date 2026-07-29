import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import { CreateLogPengirimanRequest, ItemPengiriman } from '@mold-tracker/shared';

// Log Pengiriman dibuat Manager Penyewa. Field material hanya wajib untuk item
// MATERIAL; aturan bergantung nilai field lain ditegakkan di service.
export class CreateLogPengirimanDto implements CreateLogPengirimanRequest {
  @IsString()
  @MinLength(1)
  jobId: string;

  @IsEnum(ItemPengiriman)
  item: ItemPengiriman;

  @IsDateString()
  rencanaKirim: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  materialName?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  jumlahKg?: number;

  @IsOptional()
  @IsString()
  noSuratJalan?: string;

  @IsOptional()
  @IsString()
  catatan?: string;
}

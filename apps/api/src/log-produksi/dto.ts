import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { CreateLogProduksiRequest, LogProduksiEventType, ProgressMolding } from '@mold-tracker/shared';

// Layer 2 append-only. Field bersifat per-eventType: tipe divalidasi di sini,
// kewajiban field per eventType ditegakkan di service (assertEventFields).
export class CreateLogProduksiDto implements CreateLogProduksiRequest {
  @IsEnum(LogProduksiEventType)
  eventType: LogProduksiEventType;

  @IsDateString()
  occurredAt: string;

  @IsOptional()
  @IsString()
  catatan?: string;

  // MATERIAL_DATANG
  @IsOptional()
  @IsString()
  @MinLength(1)
  materialName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  jumlahKg?: number;

  @IsOptional()
  @IsString()
  noSuratJalan?: string;

  // PRODUKSI_HARIAN
  @IsOptional()
  @IsInt()
  @Min(0)
  goodProduct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rejectCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  materialRemainingKg?: number;

  // PROGRESS_MOLDING
  @IsOptional()
  @IsEnum(ProgressMolding)
  progressMolding?: ProgressMolding;

  @IsOptional()
  @IsString()
  keteranganProgress?: string;
}

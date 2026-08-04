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
  // Cetakan yang dicatat: batas output dan material ditetapkan per cetakan.
  @IsString()
  @MinLength(1)
  moldId: string;

  // Mesin yang menjalankan cetakan itu. Kedua jenis event terjadi di atas mesin,
  // jadi selalu wajib; kecocokan mesin-cetakan ditegakkan service.
  @IsString()
  @MinLength(1)
  machineId: string;

  @IsEnum(LogProduksiEventType)
  eventType: LogProduksiEventType;

  @IsDateString()
  occurredAt: string;

  @IsOptional()
  @IsString()
  catatan?: string;

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
  materialUsedKg?: number;

  // PROGRESS_MOLDING
  @IsOptional()
  @IsEnum(ProgressMolding)
  progressMolding?: ProgressMolding;

  @IsOptional()
  @IsString()
  keteranganProgress?: string;
}

import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { CreateLogProduksiRequest } from '@mold-tracker/shared';

// Layer 2 append-only. Hanya satu jenis event yang diinput: produksi harian.
// Progress molding tidak diterima dari client melainkan dihitung service dari
// capaian terhadap target output cetakan.
export class CreateLogProduksiDto implements CreateLogProduksiRequest {
  // Cetakan yang dicatat: batas output dan material ditetapkan per cetakan.
  @IsString()
  @MinLength(1)
  moldId: string;

  // Mesin yang menjalankan cetakan itu; kecocokan mesin-cetakan ditegakkan service.
  @IsString()
  @MinLength(1)
  machineId: string;

  @IsDateString()
  occurredAt: string;

  @IsInt()
  @Min(0)
  goodProduct: number;

  @IsInt()
  @Min(0)
  rejectCount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  materialUsedKg?: number;

  @IsOptional()
  @IsString()
  catatan?: string;
}

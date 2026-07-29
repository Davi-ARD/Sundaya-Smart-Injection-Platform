import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MinLength,
} from 'class-validator';
import {
  AssignJobRequest,
  CreateExtensionRequest,
  CreateJobRequest,
  DecideExtensionRequest,
  ExtensionStatus,
  RejectJobRequest,
} from '@mold-tracker/shared';

// Booking oleh MANAGER_PENYEWA. Tanpa machineId: mesin di-assign Admin Sundaya.
// jobNumber dan lifecycle (DIAJUKAN) diset service, bukan diterima dari client.
export class CreateJobDto implements CreateJobRequest {
  @IsString()
  @MinLength(1)
  moldId: string;

  @IsInt()
  @IsPositive()
  requestedDurationDays: number;

  @IsString()
  @MinLength(1)
  destinationLocation: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsString()
  planMaterialUtama?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  estimasiMaterialKg?: number;

  @IsOptional()
  @IsString()
  materialTambahan?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  targetOutput?: number;

  @IsOptional()
  @IsDateString()
  rencanaKirimMold?: string;
}

export class AssignJobDto implements AssignJobRequest {
  @IsString()
  @MinLength(1)
  machineId: string;
}

export class RejectJobDto implements RejectJobRequest {
  @IsString()
  @MinLength(1)
  reason: string;
}

// Perpanjangan sewa diajukan MANAGER_PENYEWA. Batas atas 365 hari supaya salah
// ketik tidak mengunci mesin bertahun-tahun.
export class CreateExtensionDto implements CreateExtensionRequest {
  @IsInt()
  @IsPositive()
  @Max(365)
  additionalDays: number;
}

export class DecideExtensionDto implements DecideExtensionRequest {
  @IsIn([ExtensionStatus.DITERIMA, ExtensionStatus.DITOLAK])
  decision: ExtensionStatus.DITERIMA | ExtensionStatus.DITOLAK;
}

import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import { AssignJobRequest, CreateJobRequest, RejectJobRequest } from '@mold-tracker/shared';

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

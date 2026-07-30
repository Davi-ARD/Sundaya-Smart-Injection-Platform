import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
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

// Booking oleh MANAGER_PENYEWA: satu atau lebih cetakan, tanpa machineId (mesin
// di-assign Admin Sundaya). Plan material dan target output tidak ditanyakan lagi
// karena sudah tersimpan di masing-masing cetakan. jobNumber dan lifecycle
// (DIAJUKAN) diset service, bukan diterima dari client.
export class CreateJobDto implements CreateJobRequest {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  moldIds: string[];

  @IsInt()
  @IsPositive()
  requestedDurationDays: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsString()
  catatan?: string;
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

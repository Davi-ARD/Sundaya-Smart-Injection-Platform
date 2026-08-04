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

// Booking oleh MANAGER_PENYEWA: satu atau lebih cetakan plus jumlah mesin yang ingin
// dipinjam, tanpa menentukan mesin mana (itu wewenang Admin Sundaya). Plan material dan
// target output tidak ditanyakan lagi karena sudah tersimpan di masing-masing cetakan.
// jobNumber dan lifecycle (DIAJUKAN) diset service, bukan diterima dari client.
export class CreateJobDto implements CreateJobRequest {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  moldIds: string[];

  // Batas atas menjaga salah ketik tidak memesan seluruh armada sekaligus.
  @IsInt()
  @IsPositive()
  @Max(20)
  requestedMachineCount: number;

  @IsInt()
  @IsPositive()
  requestedDurationDays: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsString()
  catatan?: string;
}

// Menambah satu mesin ke booking. Dipanggil berulang sampai jumlah permintaan terpenuhi.
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

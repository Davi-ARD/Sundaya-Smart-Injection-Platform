import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import {
  CreateOperationalDataRequest,
  MachineOperationalStatus,
  TEKNISI_INPUT_STATUS,
} from '@mold-tracker/shared';

// Teknisi hanya boleh menyetel SETUP atau RUNNING. STANDBY hanya status awal
// mesin baru; MAINTENANCE disetel modul Maintenance, bukan diinput di sini.
export class CreateOperationalDataDto implements CreateOperationalDataRequest {
  @IsIn(TEKNISI_INPUT_STATUS)
  status: MachineOperationalStatus;

  // Durasi satu siklus molding penuh dalam detik. UI merakitnya dari input
  // jam + menit + detik lewat hmsToSeconds di packages/shared.
  @IsOptional()
  @IsNumber()
  @IsPositive()
  cycleTimeSec?: number;

  @IsDateString()
  occurredAt: string;

  @IsOptional()
  @IsString()
  catatan?: string;
}

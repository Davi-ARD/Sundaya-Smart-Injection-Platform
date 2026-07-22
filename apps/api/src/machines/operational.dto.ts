import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import {
  CreateOperationalDataRequest,
  DowntimeReason,
  MachineOperationalStatus,
} from '@mold-tracker/shared';

// Validasi bentuk dasar di DTO; aturan bergantung status (reason wajib/dilarang)
// ditegakkan di service karena bergantung nilai field lain.
export class CreateOperationalDataDto implements CreateOperationalDataRequest {
  @IsEnum(MachineOperationalStatus)
  status: MachineOperationalStatus;

  @IsOptional()
  @IsEnum(DowntimeReason)
  downtimeReason?: DowntimeReason;

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

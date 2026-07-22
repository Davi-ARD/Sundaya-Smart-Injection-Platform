import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import {
  CreateMaintenanceRequest,
  MaintenanceStatus,
  MaintenanceType,
  UpdateMaintenanceStatusRequest,
} from '@mold-tracker/shared';

export class CreateMaintenanceDto implements CreateMaintenanceRequest {
  @IsString()
  @MinLength(1)
  machineId: string;

  @IsEnum(MaintenanceType)
  type: MaintenanceType;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMaintenanceStatusDto implements UpdateMaintenanceStatusRequest {
  @IsEnum(MaintenanceStatus)
  status: MaintenanceStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

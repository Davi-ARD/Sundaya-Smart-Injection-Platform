import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';
import {
  ConditionResult,
  CreateConditionCheckRequest,
  CreateExtensionRequest,
  CreateRentalRequest,
  DecideExtensionRequest,
  ExtensionStatus,
  RejectRentalRequest,
} from '@mold-tracker/shared';

export class CreateRentalDto implements CreateRentalRequest {
  @IsString()
  @MinLength(1)
  machineId: string;

  @IsInt()
  @IsPositive()
  requestedDurationDays: number;

  @IsString()
  @MinLength(1)
  destinationLocation: string;

  @IsDateString()
  startDate: string;
}

export class RejectRentalDto implements RejectRentalRequest {
  @IsString()
  @MinLength(1)
  reason: string;
}

export class CreateConditionCheckDto implements CreateConditionCheckRequest {
  @IsEnum(ConditionResult)
  result: ConditionResult;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateExtensionDto implements CreateExtensionRequest {
  @IsInt()
  @IsPositive()
  additionalDays: number;
}

export class DecideExtensionDto implements DecideExtensionRequest {
  // Hanya DITERIMA atau DITOLAK; DIAJUKAN bukan keputusan yang sah.
  @IsIn([ExtensionStatus.DITERIMA, ExtensionStatus.DITOLAK])
  decision: ExtensionStatus.DITERIMA | ExtensionStatus.DITOLAK;
}

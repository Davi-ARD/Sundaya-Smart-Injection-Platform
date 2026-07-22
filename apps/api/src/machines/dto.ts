import { IsDateString, IsInt, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';
import { CreateMachineRequest, UpdateMachineRequest } from '@mold-tracker/shared';

export class CreateMachineDto implements CreateMachineRequest {
  @IsString()
  @MinLength(1)
  machineNumber: string;

  @IsString()
  @MinLength(1)
  spesifikasi: string;

  @IsInt()
  @IsPositive()
  tonaseTon: number;

  @IsNumber()
  @IsPositive()
  standardRatio: number;

  @IsDateString()
  warrantyStart: string;

  @IsInt()
  @IsPositive()
  warrantyDurationMonths: number;
}

export class UpdateMachineDto implements UpdateMachineRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  spesifikasi?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  tonaseTon?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  standardRatio?: number;

  @IsOptional()
  @IsDateString()
  warrantyStart?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  warrantyDurationMonths?: number;
}

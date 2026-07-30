import { IsDateString, IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';
import { CreateMachineRequest, UpdateMachineRequest } from '@mold-tracker/shared';

// machineNumber tidak diterima dari client: digenerate service berurutan.
export class CreateMachineDto implements CreateMachineRequest {
  @IsString()
  @MinLength(1)
  spesifikasi: string;

  // Clamping force mesin. Mesin hanya boleh menjalankan mold bertonase <= angka ini.
  @IsInt()
  @IsPositive()
  tonaseTon: number;

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
  @IsDateString()
  warrantyStart?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  warrantyDurationMonths?: number;
}

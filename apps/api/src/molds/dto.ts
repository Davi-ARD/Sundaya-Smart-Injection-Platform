import { IsInt, IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';
import {
  CreateMoldRequest,
  UpdateMoldRequest,
} from '@mold-tracker/shared';

// Cetakan dibuat Manager Penyewa. trackingStatus tidak diterima dari client:
// service memaksa PLANNING (transisi hanya lewat service layer, modul tracking).
export class CreateMoldDto implements CreateMoldRequest {
  @IsString()
  @MinLength(1)
  kodeMold: string;

  @IsString()
  @MinLength(1)
  namaProduk: string;

  @IsInt()
  @IsPositive()
  cavity: number;

  @IsInt()
  @IsPositive()
  tonaseTon: number;

  @IsOptional()
  @IsString()
  deskripsi?: string;

  @IsOptional()
  @IsString()
  planMaterialUtama?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  estimasiKg?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  targetOutput?: number;
}

export class UpdateMoldDto implements UpdateMoldRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  namaProduk?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  cavity?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  tonaseTon?: number;

  @IsOptional()
  @IsString()
  deskripsi?: string;

  @IsOptional()
  @IsString()
  planMaterialUtama?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  estimasiKg?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  targetOutput?: number;
}

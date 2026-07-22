import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import {
  CreatePenyewaAdminRequest,
  CreateStaffRequest,
  Role,
  UpdateUserRequest,
} from '@mold-tracker/shared';

const STAFF_ROLES = [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA];

// Dibuat Super Admin. Hanya role staf Sundaya yang boleh.
export class CreateStaffDto implements CreateStaffRequest {
  @IsString()
  @MinLength(1)
  nama: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsIn(STAFF_ROLES)
  role: Role.SUPER_ADMIN | Role.ADMIN_SUNDAYA | Role.TEKNISI_SUNDAYA;
}

// Dibuat Manager Penyewa untuk sub-akun Admin Penyewa (child).
export class CreatePenyewaAdminDto implements CreatePenyewaAdminRequest {
  @IsString()
  @MinLength(1)
  nama: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class UpdateUserDto implements UpdateUserRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nama?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

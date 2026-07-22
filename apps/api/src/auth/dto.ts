import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { LoginRequest, RegisterRequest, UpdateProfileRequest } from '@mold-tracker/shared';

// Register publik hanya untuk Manager Penyewa (tenant root). Role dipaksa di service.
export class RegisterDto implements RegisterRequest {
  @IsString()
  @MinLength(1)
  nama: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(1)
  companyName: string;
}

export class LoginDto implements LoginRequest {
  @IsEmail()
  identifier: string;

  @IsString()
  password: string;
}

export class UpdateProfileDto implements UpdateProfileRequest {
  @IsOptional()
  @IsString()
  @MinLength(1)
  nama?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  companyName?: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  newPassword?: string;
}

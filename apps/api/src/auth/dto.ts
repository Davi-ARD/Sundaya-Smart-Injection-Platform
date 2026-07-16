import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { LoginRequest, RegisterRequest, Role, UpdateProfileRequest } from '@mold-tracker/shared';

export class RegisterDto implements RegisterRequest {
  @IsString()
  @MinLength(1)
  nama: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsIn([Role.PENYEWA, Role.PENYEDIA])
  role: Role.PENYEWA | Role.PENYEDIA;
}

export class LoginDto implements LoginRequest {
  // Email untuk ADMIN/PENYEDIA/PENYEWA, nama untuk OPERATOR.
  @IsString()
  @MinLength(1)
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
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  newPassword?: string;
}

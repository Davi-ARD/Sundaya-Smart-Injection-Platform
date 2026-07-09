import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { LoginRequest, RegisterRequest, Role } from '@mold-tracker/shared';

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
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import {
  CreateOperatorRequest,
  CreateUserRequest,
  Role,
  UpdateUserRequest,
} from '@mold-tracker/shared';

export class CreateUserDto implements CreateUserRequest {
  @IsString()
  @MinLength(1)
  nama: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsString()
  parentId?: string;
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
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateOperatorDto implements CreateOperatorRequest {
  @IsString()
  @MinLength(1)
  nama: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

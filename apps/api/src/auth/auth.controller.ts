import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { User as PrismaUser } from '@prisma/client';
import { AuthResponse, User } from '@mold-tracker/shared';
import { AuthService } from './auth.service';
import { avatarUploadOptions } from './avatar-upload.config';
import { CurrentUser, Public } from './decorators';
import { LoginDto, RegisterDto, UpdateProfileDto } from './dto';
import { toUser } from '../users/user.mapper';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.auth.register(dto);
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.auth.login(dto);
  }

  @Get('me')
  me(@CurrentUser() user: PrismaUser): User {
    return toUser(user);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: PrismaUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<User> {
    return this.auth.updateProfile(user, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('avatar', avatarUploadOptions))
  updateAvatar(
    @CurrentUser() user: PrismaUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<User> {
    if (!file) throw new BadRequestException('File avatar wajib diunggah');
    return this.auth.updateAvatar(user, `/uploads/avatars/${file.filename}`);
  }
}

import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { AuthResponse, User } from '@mold-tracker/shared';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from './decorators';
import { LoginDto, RegisterDto } from './dto';
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
}

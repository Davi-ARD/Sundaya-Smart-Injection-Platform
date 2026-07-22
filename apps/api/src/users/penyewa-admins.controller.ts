import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { Role, User } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { UsersService } from './users.service';
import { CreatePenyewaAdminDto } from './dto';

// Manager Penyewa mengelola sub-akun Admin Penyewa (child) di bawah tenant-nya.
@Roles(Role.MANAGER_PENYEWA)
@Controller('penyewa-admins')
export class PenyewaAdminsController {
  constructor(private users: UsersService) {}

  @Post()
  create(@CurrentUser() manager: PrismaUser, @Body() dto: CreatePenyewaAdminDto): Promise<User> {
    return this.users.createPenyewaAdmin(manager.id, dto);
  }

  @Get()
  list(@CurrentUser() manager: PrismaUser): Promise<User[]> {
    return this.users.listPenyewaAdmins(manager.id);
  }

  @Patch(':id/deactivate')
  deactivate(@CurrentUser() manager: PrismaUser, @Param('id') id: string): Promise<User> {
    return this.users.setPenyewaAdminActive(manager.id, id, false);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() manager: PrismaUser, @Param('id') id: string): Promise<void> {
    return this.users.removePenyewaAdmin(manager.id, id);
  }
}

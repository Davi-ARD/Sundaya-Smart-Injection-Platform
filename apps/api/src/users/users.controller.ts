import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { Role, User } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { UsersService } from './users.service';
import { CreateStaffDto, UpdateUserDto } from './dto';

// Kelola akun staf Sundaya. Hanya Super Admin.
@Roles(Role.SUPER_ADMIN)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  findAll(@Query('role') role?: string, @Query('isActive') isActive?: string): Promise<User[]> {
    const roleFilter =
      role && (Object.values(Role) as string[]).includes(role) ? (role as Role) : undefined;
    return this.users.findAll({
      role: roleFilter,
      isActive: isActive === undefined ? undefined : isActive === 'true',
    });
  }

  @Post()
  create(@Body() dto: CreateStaffDto): Promise<User> {
    return this.users.createStaff(dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: PrismaUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.users.update(actor.id, id, dto);
  }

  @Patch(':id/deactivate')
  deactivate(@CurrentUser() actor: PrismaUser, @Param('id') id: string): Promise<User> {
    return this.users.deactivate(actor.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() actor: PrismaUser, @Param('id') id: string): Promise<void> {
    return this.users.remove(actor.id, id);
  }
}

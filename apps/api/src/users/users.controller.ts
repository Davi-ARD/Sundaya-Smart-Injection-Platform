import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role, User } from '@mold-tracker/shared';
import { Roles } from '../auth/decorators';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';

@Roles(Role.ADMIN)
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
  create(@Body() dto: CreateUserDto): Promise<User> {
    return this.users.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<User> {
    return this.users.update(id, dto);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string): Promise<User> {
    return this.users.deactivate(id);
  }
}

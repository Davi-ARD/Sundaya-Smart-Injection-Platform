import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { Role, User } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { UsersService } from './users.service';
import { CreateOperatorDto } from './dto';

@Roles(Role.PENYEWA)
@Controller('operators')
export class OperatorsController {
  constructor(private users: UsersService) {}

  @Post()
  create(@CurrentUser() penyewa: PrismaUser, @Body() dto: CreateOperatorDto): Promise<User> {
    return this.users.createOperator(penyewa.id, dto);
  }

  @Get()
  list(@CurrentUser() penyewa: PrismaUser): Promise<User[]> {
    return this.users.listOperators(penyewa.id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() penyewa: PrismaUser, @Param('id') id: string): Promise<void> {
    return this.users.removeOperator(penyewa.id, id);
  }
}

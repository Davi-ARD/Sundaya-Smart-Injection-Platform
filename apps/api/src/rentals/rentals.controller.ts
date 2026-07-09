import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import {
  ConditionCheck,
  Rental,
  RentalExtension,
  RentalStatus,
  Role,
} from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { RentalsService } from './rentals.service';
import {
  CreateConditionCheckDto,
  CreateExtensionDto,
  CreateRentalDto,
  RejectRentalDto,
} from './dto';

@Controller('rentals')
export class RentalsController {
  constructor(private rentals: RentalsService) {}

  // Semua terautentikasi; penyaringan kepemilikan di service.
  @Get()
  findAll(@CurrentUser() user: PrismaUser, @Query('status') status?: string): Promise<Rental[]> {
    const statusFilter =
      status && (Object.values(RentalStatus) as string[]).includes(status)
        ? (status as RentalStatus)
        : undefined;
    return this.rentals.findAll(user, statusFilter);
  }

  @Get(':id')
  findOne(@CurrentUser() user: PrismaUser, @Param('id') id: string): Promise<Rental> {
    return this.rentals.findOne(user, id);
  }

  @Roles(Role.PENYEWA)
  @Post()
  create(@CurrentUser() user: PrismaUser, @Body() dto: CreateRentalDto): Promise<Rental> {
    return this.rentals.create(user, dto);
  }

  @Roles(Role.PENYEDIA, Role.ADMIN)
  @Patch(':id/confirm')
  confirm(@CurrentUser() user: PrismaUser, @Param('id') id: string): Promise<Rental> {
    return this.rentals.confirm(user, id);
  }

  @Roles(Role.PENYEDIA, Role.ADMIN)
  @Patch(':id/reject')
  reject(
    @CurrentUser() user: PrismaUser,
    @Param('id') id: string,
    @Body() dto: RejectRentalDto,
  ): Promise<Rental> {
    return this.rentals.reject(user, id, dto);
  }

  @Roles(Role.PENYEDIA, Role.ADMIN)
  @Patch(':id/ship')
  ship(@CurrentUser() user: PrismaUser, @Param('id') id: string): Promise<Rental> {
    return this.rentals.ship(user, id);
  }

  @Roles(Role.PENYEWA, Role.ADMIN)
  @Patch(':id/receive')
  receive(@CurrentUser() user: PrismaUser, @Param('id') id: string): Promise<Rental> {
    return this.rentals.receive(user, id);
  }

  @Roles(Role.PENYEWA, Role.ADMIN)
  @Patch(':id/return')
  return(@CurrentUser() user: PrismaUser, @Param('id') id: string): Promise<Rental> {
    return this.rentals.return(user, id);
  }

  @Roles(Role.PENYEDIA, Role.ADMIN)
  @Post(':id/condition-check')
  conditionCheck(
    @CurrentUser() user: PrismaUser,
    @Param('id') id: string,
    @Body() dto: CreateConditionCheckDto,
  ): Promise<ConditionCheck> {
    return this.rentals.conditionCheck(user, id, dto);
  }

  @Roles(Role.PENYEWA, Role.ADMIN)
  @Post(':id/extensions')
  requestExtension(
    @CurrentUser() user: PrismaUser,
    @Param('id') id: string,
    @Body() dto: CreateExtensionDto,
  ): Promise<RentalExtension> {
    return this.rentals.requestExtension(user, id, dto);
  }
}

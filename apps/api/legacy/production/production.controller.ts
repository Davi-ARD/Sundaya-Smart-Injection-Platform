import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import {
  MachineEfficiency,
  OperatorEfficiency,
  ProductionBatch,
  Role,
} from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { ProductionService } from './production.service';
import { CreateBatchDto, ReviewBatchDto } from './dto';

@Controller('batches')
export class ProductionController {
  constructor(private production: ProductionService) {}

  @Roles(Role.OPERATOR)
  @Post()
  create(@CurrentUser() user: PrismaUser, @Body() dto: CreateBatchDto): Promise<ProductionBatch> {
    return this.production.create(user, dto);
  }

  // Semua terautentikasi; penyaringan kepemilikan di service.
  @Get()
  findAll(
    @CurrentUser() user: PrismaUser,
    @Query('rentalId') rentalId?: string,
    @Query('machineId') machineId?: string,
    @Query('operatorId') operatorId?: string,
    @Query('flagged') flagged?: string,
  ): Promise<ProductionBatch[]> {
    return this.production.findAll(user, {
      rentalId,
      machineId,
      operatorId,
      flagged: flagged === undefined ? undefined : flagged === 'true',
    });
  }

  // Rute statik efisiensi harus sebelum ':id' agar tidak tertangkap param.
  @Roles(Role.PENYEWA, Role.ADMIN)
  @Get('efficiency/by-operator')
  byOperator(
    @CurrentUser() user: PrismaUser,
    @Query('rentalId') rentalId?: string,
    @Query('machineId') machineId?: string,
  ): Promise<OperatorEfficiency[]> {
    return this.production.efficiencyByOperator(user, { rentalId, machineId });
  }

  @Roles(Role.PENYEWA, Role.PENYEDIA, Role.ADMIN)
  @Get('efficiency/by-machine')
  byMachine(@CurrentUser() user: PrismaUser): Promise<MachineEfficiency[]> {
    return this.production.efficiencyByMachine(user);
  }

  @Get(':id')
  findOne(@CurrentUser() user: PrismaUser, @Param('id') id: string): Promise<ProductionBatch> {
    return this.production.findOne(user, id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewBatchDto): Promise<ProductionBatch> {
    return this.production.review(id, dto);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { Machine, MachineHistory, MachineStatus, Role } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { MachinesService } from './machines.service';
import { CreateMachineDto, UpdateMachineDto } from './dto';

@Controller('machines')
export class MachinesController {
  constructor(private machines: MachinesService) {}

  // Semua terautentikasi. Penyaringan per role dilakukan di service.
  @Get()
  findAll(@CurrentUser() user: PrismaUser, @Query('status') status?: string): Promise<Machine[]> {
    const statusFilter =
      status && (Object.values(MachineStatus) as string[]).includes(status)
        ? (status as MachineStatus)
        : undefined;
    return this.machines.findAll(user, statusFilter);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Machine> {
    return this.machines.findOne(id);
  }

  @Roles(Role.PENYEDIA, Role.ADMIN)
  @Post()
  create(@CurrentUser() user: PrismaUser, @Body() dto: CreateMachineDto): Promise<Machine> {
    return this.machines.create(user, dto);
  }

  @Roles(Role.PENYEDIA, Role.ADMIN)
  @Patch(':id')
  update(
    @CurrentUser() user: PrismaUser,
    @Param('id') id: string,
    @Body() dto: UpdateMachineDto,
  ): Promise<Machine> {
    return this.machines.update(user, id, dto);
  }

  @Roles(Role.PENYEDIA, Role.ADMIN)
  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: PrismaUser, @Param('id') id: string): Promise<void> {
    return this.machines.remove(user, id);
  }

  @Roles(Role.PENYEDIA, Role.ADMIN)
  @Get(':id/history')
  history(@CurrentUser() user: PrismaUser, @Param('id') id: string): Promise<MachineHistory> {
    return this.machines.history(user, id);
  }
}

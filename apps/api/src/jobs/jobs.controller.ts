import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { Job, JobLifecycle, Role } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { JobsService } from './jobs.service';
import { AssignJobDto, CreateJobDto, RejectJobDto } from './dto';

// Modul jobs dipakai berdua (koordinasi Dev A/Dev B). Pemilik file = Dev A
// (assign + lifecycle). Endpoint booking `POST /jobs` (MANAGER_PENYEWA, tanpa
// mesin) ditambahkan Dev B; taruh di controller ini agar satu resource satu file.
@Controller('jobs')
export class JobsController {
  constructor(private jobs: JobsService) {}

  // Booking: MANAGER_PENYEWA mengajukan job tanpa memilih mesin (Dev B).
  @Roles(Role.MANAGER_PENYEWA)
  @Post()
  create(@CurrentUser() user: PrismaUser, @Body() dto: CreateJobDto): Promise<Job> {
    return this.jobs.create(user, dto);
  }

  // Semua terautentikasi; scoping tenant per role dilakukan di service.
  @Get()
  findAll(@CurrentUser() user: PrismaUser, @Query('lifecycle') lifecycle?: string): Promise<Job[]> {
    const filter =
      lifecycle && (Object.values(JobLifecycle) as string[]).includes(lifecycle)
        ? (lifecycle as JobLifecycle)
        : undefined;
    return this.jobs.findAll(user, filter);
  }

  @Get(':id')
  findOne(@CurrentUser() user: PrismaUser, @Param('id') id: string): Promise<Job> {
    return this.jobs.findOne(user, id);
  }

  @Roles(Role.ADMIN_SUNDAYA)
  @Patch(':id/assign')
  assign(
    @CurrentUser() user: PrismaUser,
    @Param('id') id: string,
    @Body() dto: AssignJobDto,
  ): Promise<Job> {
    return this.jobs.assign(user, id, dto);
  }

  @Roles(Role.ADMIN_SUNDAYA)
  @Patch(':id/reject')
  reject(
    @CurrentUser() user: PrismaUser,
    @Param('id') id: string,
    @Body() dto: RejectJobDto,
  ): Promise<Job> {
    return this.jobs.reject(user, id, dto);
  }

  @Roles(Role.ADMIN_SUNDAYA)
  @Patch(':id/ship')
  ship(@CurrentUser() user: PrismaUser, @Param('id') id: string): Promise<Job> {
    return this.jobs.ship(user, id);
  }

  @Roles(Role.ADMIN_SUNDAYA)
  @Patch(':id/activate')
  activate(@CurrentUser() user: PrismaUser, @Param('id') id: string): Promise<Job> {
    return this.jobs.activate(user, id);
  }

  @Roles(Role.ADMIN_SUNDAYA)
  @Patch(':id/return')
  returnJob(@CurrentUser() user: PrismaUser, @Param('id') id: string): Promise<Job> {
    return this.jobs.return(user, id);
  }

  @Roles(Role.ADMIN_SUNDAYA)
  @Patch(':id/collect')
  collect(@CurrentUser() user: PrismaUser, @Param('id') id: string): Promise<Job> {
    return this.jobs.collect(user, id);
  }

  @Roles(Role.ADMIN_SUNDAYA)
  @Patch(':id/complete')
  complete(@CurrentUser() user: PrismaUser, @Param('id') id: string): Promise<Job> {
    return this.jobs.complete(user, id);
  }
}

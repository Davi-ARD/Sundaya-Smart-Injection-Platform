import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import {
  ExtensionRequestRow,
  Job,
  JobLifecycle,
  RentalExtension,
  Role,
} from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { JobsService } from './jobs.service';
import {
  AssignJobDto,
  CreateExtensionDto,
  CreateJobDto,
  DecideExtensionDto,
  RejectJobDto,
} from './dto';

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

  // Antrean perpanjangan sewa (rental monitoring, tab Booking Sundaya).
  // Dideklarasikan sebelum GET :id supaya 'extensions' tidak tertangkap sebagai id.
  @Roles(Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA)
  @Get('extensions')
  listExtensions(): Promise<ExtensionRequestRow[]> {
    return this.jobs.listExtensions();
  }

  @Roles(Role.ADMIN_SUNDAYA)
  @Patch('extensions/:extensionId/decide')
  decideExtension(
    @Param('extensionId') extensionId: string,
    @Body() dto: DecideExtensionDto,
  ): Promise<RentalExtension> {
    return this.jobs.decideExtension(extensionId, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() user: PrismaUser, @Param('id') id: string): Promise<Job> {
    return this.jobs.findOne(user, id);
  }

  // Manager Penyewa mengajukan perpanjangan sewa untuk job miliknya yang AKTIF.
  @Roles(Role.MANAGER_PENYEWA)
  @Post(':id/extensions')
  requestExtension(
    @CurrentUser() user: PrismaUser,
    @Param('id') id: string,
    @Body() dto: CreateExtensionDto,
  ): Promise<RentalExtension> {
    return this.jobs.requestExtension(user, id, dto);
  }

  // Meminjamkan satu mesin ke booking. Dipanggil berulang: mesin pertama sekaligus
  // menyetujui booking, mesin berikutnya menambah jumlah pinjaman.
  @Roles(Role.ADMIN_SUNDAYA)
  @Patch(':id/assign')
  assign(
    @CurrentUser() user: PrismaUser,
    @Param('id') id: string,
    @Body() dto: AssignJobDto,
  ): Promise<Job> {
    return this.jobs.assign(user, id, dto);
  }

  // Menarik satu mesin dari booking yang belum dikirim.
  @Roles(Role.ADMIN_SUNDAYA)
  @Delete(':id/machines/:machineId')
  releaseMachine(
    @Param('id') id: string,
    @Param('machineId') machineId: string,
  ): Promise<Job> {
    return this.jobs.releaseMachine(id, machineId);
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

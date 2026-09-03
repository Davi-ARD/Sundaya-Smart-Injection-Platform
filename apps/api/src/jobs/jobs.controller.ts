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
  AddMoldsDto,
  AssignJobDto,
  CreateExtensionDto,
  CreateJobDto,
  DecideExtensionDto,
  RejectJobDto,
  ReplaceMachineDto,
} from './dto';

// Modul jobs dipakai berdua (koordinasi Dev A/Dev B). Pemilik file = Dev A
// (assign + lifecycle). Endpoint booking `POST /jobs` (MANAGER_PENYEWA, tanpa
// mesin) ditambahkan Dev B; taruh di controller ini agar satu resource satu file.
// Super Admin punya seluruh wewenang Admin Sundaya; bedanya hanya Super Admin
// yang bisa mengelola pengguna. Dipakai satu konstanta supaya Super Admin tidak
// lagi tertinggal diam-diam saat aksi baru ditambahkan.
const ADMIN_DAN_SUPER = [Role.ADMIN_SUNDAYA, Role.SUPER_ADMIN] as const;

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

  @Roles(...ADMIN_DAN_SUPER)
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
  @Roles(...ADMIN_DAN_SUPER)
  @Patch(':id/assign')
  assign(
    @CurrentUser() user: PrismaUser,
    @Param('id') id: string,
    @Body() dto: AssignJobDto,
  ): Promise<Job> {
    return this.jobs.assign(user, id, dto);
  }

  // Menarik satu mesin dari booking yang belum berjalan.
  @Roles(...ADMIN_DAN_SUPER)
  @Delete(':id/machines/:machineId')
  releaseMachine(
    @Param('id') id: string,
    @Param('machineId') machineId: string,
  ): Promise<Job> {
    return this.jobs.releaseMachine(id, machineId);
  }

  // Menukar satu mesin booking dengan mesin lain, mis. mesin masuk maintenance.
  // Berbeda dari releaseMachine, ini juga berlaku saat booking sudah berjalan.
  @Roles(...ADMIN_DAN_SUPER)
  @Patch(':id/machines/:machineId/replace')
  replaceMachine(
    @Param('id') id: string,
    @Param('machineId') machineId: string,
    @Body() dto: ReplaceMachineDto,
  ): Promise<Job> {
    return this.jobs.replaceMachine(id, machineId, dto);
  }

  // Tambah cetakan ke booking berjalan: mesin dan durasi tidak berubah, jadi
  // tidak butuh approval ulang Sundaya.
  @Roles(Role.MANAGER_PENYEWA)
  @Post(':id/molds')
  addMolds(
    @CurrentUser() user: PrismaUser,
    @Param('id') id: string,
    @Body() dto: AddMoldsDto,
  ): Promise<Job> {
    return this.jobs.addMolds(user, id, dto.moldIds);
  }

  // Akhiri sewa lebih awal: hak Manager Penyewa atas booking-nya sendiri.
  @Roles(Role.MANAGER_PENYEWA)
  @Patch(':id/end-rental')
  endRental(@CurrentUser() user: PrismaUser, @Param('id') id: string): Promise<Job> {
    return this.jobs.endRental(user, id);
  }

  @Roles(...ADMIN_DAN_SUPER)
  @Patch(':id/reject')
  reject(
    @CurrentUser() user: PrismaUser,
    @Param('id') id: string,
    @Body() dto: RejectJobDto,
  ): Promise<Job> {
    return this.jobs.reject(user, id, dto);
  }

  // Tidak ada endpoint tombol lifecycle lain. Mesin tidak pernah dikirim ke penyewa,
  // jadi tidak ada "kirim mesin": booking jadi AKTIF sendiri saat cetakan pertama
  // diterima Sundaya, dan SELESAI sendiri saat seluruh cetakannya sudah kembali ke
  // penyewa. Lihat jobs/job-transitions.ts.
}

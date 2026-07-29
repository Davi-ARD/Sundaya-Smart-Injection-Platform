import { Controller, Get } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import {
  JobDashboard,
  JobLogEntry,
  ManagerDashboard,
  MoldPlanRow,
  Role,
} from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { DashboardPenyewaService } from './dashboard-penyewa.service';

// Dashboard sisi Penyewa. Berbagi prefix /dashboard dengan Dashboard Sundaya
// (Dev A) tapi controller/modul terpisah. Scoping tenant di service.
@Controller('dashboard')
export class DashboardPenyewaController {
  constructor(private dashboard: DashboardPenyewaService) {}

  @Roles(Role.MANAGER_PENYEWA)
  @Get('manager')
  manager(@CurrentUser() user: PrismaUser): Promise<ManagerDashboard> {
    return this.dashboard.manager(user);
  }

  // Perkembangan plan mold: dipakai tabel dashboard Manager, panel detail cepat,
  // dan detail cetakan di halaman Cetakan.
  @Roles(Role.MANAGER_PENYEWA)
  @Get('manager/mold-plan')
  moldPlan(@CurrentUser() user: PrismaUser): Promise<MoldPlanRow[]> {
    return this.dashboard.moldPlan(user);
  }

  @Roles(Role.ADMIN_PENYEWA)
  @Get('job')
  job(@CurrentUser() user: PrismaUser): Promise<JobDashboard[]> {
    return this.dashboard.job(user);
  }

  // Log utama: seluruh event dari semua job tenant dalam satu timeline.
  @Roles(Role.ADMIN_PENYEWA)
  @Get('job/logs')
  jobLogs(@CurrentUser() user: PrismaUser): Promise<JobLogEntry[]> {
    return this.dashboard.jobLogs(user);
  }
}

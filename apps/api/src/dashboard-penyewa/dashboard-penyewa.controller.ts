import { Controller, Get } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { JobDashboard, ManagerDashboard, Role } from '@mold-tracker/shared';
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

  @Roles(Role.ADMIN_PENYEWA)
  @Get('job')
  job(@CurrentUser() user: PrismaUser): Promise<JobDashboard[]> {
    return this.dashboard.job(user);
  }
}

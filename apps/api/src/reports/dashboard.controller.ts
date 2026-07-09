import { Controller, Get } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { AdminDashboard, PenyediaDashboard, PenyewaDashboard, Role } from '@mold-tracker/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import { ReportsService } from './reports.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private reports: ReportsService) {}

  @Roles(Role.PENYEDIA)
  @Get('penyedia')
  penyedia(@CurrentUser() user: PrismaUser): Promise<PenyediaDashboard> {
    return this.reports.penyediaDashboard(user);
  }

  @Roles(Role.PENYEWA)
  @Get('penyewa')
  penyewa(@CurrentUser() user: PrismaUser): Promise<PenyewaDashboard> {
    return this.reports.penyewaDashboard(user);
  }

  @Roles(Role.ADMIN)
  @Get('admin')
  admin(): Promise<AdminDashboard> {
    return this.reports.adminDashboard();
  }
}

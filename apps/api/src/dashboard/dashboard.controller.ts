import { Controller, Get } from '@nestjs/common';
import { Role, SundayaDashboard } from '@mold-tracker/shared';
import { Roles } from '../auth/decorators';
import { DashboardService } from './dashboard.service';

// Dashboard Sundaya (OEE monitoring). Read staf Sundaya (Admin RW, Teknisi R).
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA)
  @Get('sundaya')
  sundaya(): Promise<SundayaDashboard> {
    return this.dashboard.sundaya();
  }
}

import { Controller, Get, Param } from '@nestjs/common';
import { MachineMetrics, Role } from '@mold-tracker/shared';
import { Roles } from '../auth/decorators';
import { DashboardService } from './dashboard.service';

// Metrik OEE per mesin. Controller prefix 'machines' terpisah dari MachinesController
// (modul machines); path :id/metrics tidak bertabrakan dengan :id.
@Controller('machines')
export class MachineMetricsController {
  constructor(private dashboard: DashboardService) {}

  @Roles(Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA)
  @Get(':id/metrics')
  metrics(@Param('id') id: string): Promise<MachineMetrics> {
    return this.dashboard.machineMetrics(id);
  }
}

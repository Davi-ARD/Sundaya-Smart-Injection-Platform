import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MachinesModule } from './machines/machines.module';
import { MoldsModule } from './molds/molds.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { JobsModule } from './jobs/jobs.module';
import { LogProduksiModule } from './log-produksi/log-produksi.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health.controller';

// Modul domain SSIP ditulis ulang per fase (lihat docs/ssip-spec.md). Modul lama
// (production, reports, notifications) masih dikarantina di ../legacy sampai
// diremodel; belum di-wire agar build tetap hijau.
@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    MachinesModule,
    MoldsModule,
    MaintenanceModule,
    JobsModule,
    LogProduksiModule,
    DashboardModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

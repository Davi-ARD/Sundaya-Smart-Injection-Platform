import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MachinesModule } from './machines/machines.module';
import { MoldsModule } from './molds/molds.module';
import { HealthController } from './health.controller';

// Modul domain SSIP ditulis ulang per fase (lihat docs/ssip-spec.md). Modul lama
// (rentals, production, reports, notifications) masih dikarantina di ../legacy
// sampai diremodel; belum di-wire agar build tetap hijau.
@Module({
  imports: [PrismaModule, AuthModule, UsersModule, MachinesModule, MoldsModule],
  controllers: [HealthController],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MachinesModule } from './machines/machines.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, MachinesModule],
  controllers: [HealthController],
})
export class AppModule {}

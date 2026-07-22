import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PenyewaAdminsController } from './penyewa-admins.controller';

@Module({
  controllers: [UsersController, PenyewaAdminsController],
  providers: [UsersService],
})
export class UsersModule {}

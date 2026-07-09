import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { OperatorsController } from './operators.controller';

@Module({
  controllers: [UsersController, OperatorsController],
  providers: [UsersService],
})
export class UsersModule {}

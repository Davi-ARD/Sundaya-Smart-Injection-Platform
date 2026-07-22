import { Controller, Get, HttpCode, Param, Patch, Query } from '@nestjs/common';
import { User as PrismaUser } from '@prisma/client';
import { AppNotification } from '@mold-tracker/shared';
import { CurrentUser } from '../auth/decorators';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: PrismaUser, @Query('unreadOnly') unreadOnly?: string): Promise<AppNotification[]> {
    return this.notifications.findAllForUser(user.id, unreadOnly === 'true');
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: PrismaUser, @Param('id') id: string): Promise<AppNotification> {
    return this.notifications.markRead(user.id, id);
  }

  @Patch('read-all')
  @HttpCode(204)
  markAllRead(@CurrentUser() user: PrismaUser): Promise<void> {
    return this.notifications.markAllRead(user.id);
  }
}

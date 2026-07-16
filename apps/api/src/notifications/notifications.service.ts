import { Injectable, NotFoundException } from '@nestjs/common';
import { AppNotification } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toNotification } from './notification.mapper';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  // Dipanggil dari service lain (rentals, production) di titik transisi yang relevan
  // bagi pihak lawan, bukan lewat endpoint publik.
  async create(userId: string, title: string, message: string, link?: string): Promise<void> {
    await this.prisma.notification.create({ data: { userId, title, message, link } });
  }

  async createMany(userIds: string[], title: string, message: string, link?: string): Promise<void> {
    if (!userIds.length) return;
    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({ userId, title, message, link })),
    });
  }

  async findAllForUser(userId: string, unreadOnly?: boolean): Promise<AppNotification[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId, isRead: unreadOnly ? false : undefined },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return notifications.map(toNotification);
  }

  async markRead(userId: string, id: string): Promise<AppNotification> {
    const existing = await this.prisma.notification.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new NotFoundException('Notifikasi tidak ditemukan');
    const updated = await this.prisma.notification.update({ where: { id }, data: { isRead: true } });
    return toNotification(updated);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  }
}

import { AppNotification } from '@mold-tracker/shared';
import { Notification as PrismaNotification } from '@prisma/client';

export function toNotification(n: PrismaNotification): AppNotification {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    link: n.link,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  };
}

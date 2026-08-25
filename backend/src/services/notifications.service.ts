import { prisma } from '../lib/prisma';
import { mapNotification } from '../lib/mappers';

export const getNotifications = async (userId: string) => {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(mapNotification);
};

export const markNotificationRead = async (
  notificationId: string,
  userId: string,
) => {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });

  return mapNotification(updated);
};

export const markAllRead = async (userId: string) => {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });

  return getNotifications(userId);
};

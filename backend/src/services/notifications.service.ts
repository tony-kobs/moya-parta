import { db } from '../data/seed';

export const getNotifications = (userId: string) => {
  return db.notifications
    .filter((item) => item.userId === userId)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
};

export const markNotificationRead = (notificationId: string, userId: string) => {
  const notification = db.notifications.find(
    (item) => item.id === notificationId && item.userId === userId,
  );

  if (!notification) {
    return null;
  }

  notification.read = true;
  return notification;
};

export const markAllRead = (userId: string) => {
  db.notifications
    .filter((item) => item.userId === userId)
    .forEach((item) => {
      item.read = true;
    });

  return getNotifications(userId);
};

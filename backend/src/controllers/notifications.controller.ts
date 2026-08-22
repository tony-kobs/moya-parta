import { Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { getParam } from '../helpers/params';
import { sendError, sendSuccess } from '../helpers/response';
import { AuthRequest } from '../middlewares/auth';
import * as notificationsService from '../services/notifications.service';

export const getNotifications = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  sendSuccess(res, notificationsService.getNotifications(req.user.id));
};

export const markRead = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const notification = notificationsService.markNotificationRead(
    getParam(req.params.id),
    req.user.id,
  );

  if (!notification) {
    sendError(res, 'Сповіщення не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, notification);
};

export const markAllRead = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  sendSuccess(res, notificationsService.markAllRead(req.user.id));
};

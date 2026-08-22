import { Response } from 'express';
import { z } from 'zod';
import { HTTP_STATUS } from '../constants';
import { getParam } from '../helpers/params';
import { sendError, sendSuccess } from '../helpers/response';
import { AuthRequest } from '../middlewares/auth';
import * as chatService from '../services/chat.service';

const messageSchema = z.object({
  text: z.string().min(1, 'Напиши повідомлення').max(500),
});

export const getContacts = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  sendSuccess(res, chatService.getChatContacts(req.user));
};

export const getClassChat = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  sendSuccess(res, chatService.getClassChat(req.user));
};

export const sendClassMessage = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = messageSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Перевір дані');
    return;
  }

  try {
    const message = chatService.sendClassMessage(req.user, parsed.data.text);
    sendSuccess(res, message, HTTP_STATUS.CREATED);
  } catch {
    sendError(res, 'Не вдалося надіслати');
  }
};

export const getDirectThread = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const thread = chatService.getDirectThread(
    req.user,
    getParam(req.params.userId),
  );

  if (!thread) {
    sendError(res, 'Цю людину не знайдено у твоєму класі', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, thread);
};

export const sendDirectMessage = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = messageSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Перевір дані');
    return;
  }

  try {
    const message = chatService.sendDirectMessage(
      req.user,
      getParam(req.params.userId),
      parsed.data.text,
    );
    sendSuccess(res, message, HTTP_STATUS.CREATED);
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_CLASSMATE') {
      sendError(res, 'Можна писати лише однокласникам і вчителю', HTTP_STATUS.FORBIDDEN);
      return;
    }
    sendError(res, 'Не вдалося надіслати');
  }
};

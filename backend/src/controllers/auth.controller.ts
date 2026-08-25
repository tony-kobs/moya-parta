import { Response } from 'express';
import { z } from 'zod';
import { HTTP_STATUS } from '../constants';
import { sendError, sendSuccess } from '../helpers/response';
import { AuthRequest } from '../middlewares/auth';
import * as authService from '../services/auth.service';

const loginSchema = z.object({
  email: z.string().min(3, 'Введи логін'),
  password: z.string().min(4, 'Пароль занадто короткий'),
});

const teacherRegisterSchema = z.object({
  displayName: z.string().min(2, 'Напиши своє імʼя'),
  login: z.string().min(3, 'Придумай логін'),
  password: z.string().min(4, 'Пароль занадто короткий'),
  avatarEmoji: z.string().optional(),
});

const studentRegisterSchema = z.object({
  inviteCode: z.string().min(3, 'Введи код класу'),
  displayName: z.string().min(2, 'Напиши своє імʼя'),
  login: z.string().min(3, 'Придумай логін'),
  password: z.string().min(4, 'Пароль занадто короткий'),
  avatarEmoji: z.string().optional(),
});

export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Перевір дані');
    return;
  }

  try {
    const result = await authService.loginUser(
      parsed.data.email,
      parsed.data.password,
    );

    if (!result) {
      sendError(res, 'Невірний логін або пароль', HTTP_STATUS.UNAUTHORIZED);
      return;
    }

    sendSuccess(res, result);
  } catch (error) {
    console.error(error);
    sendError(res, 'Щось пішло не так', HTTP_STATUS.INTERNAL);
  }
};

export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const user = await authService.getCurrentUser(req.user.id);

  if (!user) {
    sendError(res, 'Користувача не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, user);
};

export const registerTeacher = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const parsed = teacherRegisterSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Перевір дані');
    return;
  }

  try {
    const result = await authService.registerTeacher(parsed.data);
    sendSuccess(res, result, HTTP_STATUS.CREATED);
  } catch (error) {
    if (error instanceof Error && error.message === 'LOGIN_TAKEN') {
      sendError(res, 'Такий логін уже зайнятий', HTTP_STATUS.CONFLICT);
      return;
    }
    console.error(error);
    sendError(res, 'Щось пішло не так', HTTP_STATUS.INTERNAL);
  }
};

export const getInvitePreview = async (req: AuthRequest, res: Response): Promise<void> => {
  const code = String(req.params.code ?? '');
  const preview = await authService.getInvitePreview(code);

  if (!preview) {
    sendError(res, 'Такого коду класу немає', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, preview);
};

export const registerStudent = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  const parsed = studentRegisterSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Перевір дані');
    return;
  }

  try {
    const result = await authService.registerStudentByInvite(parsed.data);
    sendSuccess(res, result, HTTP_STATUS.CREATED);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INVITE_NOT_FOUND') {
        sendError(res, 'Такого коду класу немає', HTTP_STATUS.NOT_FOUND);
        return;
      }
      if (error.message === 'LOGIN_TAKEN') {
        sendError(res, 'Такий логін уже зайнятий', HTTP_STATUS.CONFLICT);
        return;
      }
    }
    console.error(error);
    sendError(res, 'Щось пішло не так', HTTP_STATUS.INTERNAL);
  }
};

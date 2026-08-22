import { Response } from 'express';
import { z } from 'zod';
import { HTTP_STATUS } from '../constants';
import { getParam } from '../helpers/params';
import { sendError, sendSuccess } from '../helpers/response';
import { AuthRequest } from '../middlewares/auth';
import * as postsService from '../services/posts.service';
import * as studentService from '../services/student.service';

export const getDesk = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const desk = studentService.getStudentDesk(req.user.id);

  if (!desk) {
    sendError(res, 'Парту не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, desk);
};

export const getBackpack = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  sendSuccess(res, studentService.getBackpack(req.user.id));
};

export const completeOnboarding = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const profile = studentService.completeOnboarding(req.user.id);

  if (!profile) {
    sendError(res, 'Профіль не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, profile);
};

export const getClass = (req: AuthRequest, res: Response): void => {
  if (!req.user?.classId) {
    sendError(res, 'Клас не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  const overview = postsService.getClassOverview(
    req.user.classId,
    req.user.schoolId,
  );

  if (!overview) {
    sendError(res, 'Клас не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, overview);
};

export const getMyBoard = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  sendSuccess(res, postsService.getMyPosts(req.user.id));
};

const createPostSchema = z.object({
  text: z.string().min(1, 'Напиши щось у публікації'),
  imageEmoji: z.string().optional(),
  category: z.string().optional(),
});

export const createPost = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = createPostSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Перевір дані');
    return;
  }

  try {
    const post = postsService.createPost(req.user, parsed.data);
    sendSuccess(res, post, HTTP_STATUS.CREATED);
  } catch {
    sendError(res, 'Не вдалося поділитися', HTTP_STATUS.BAD_REQUEST);
  }
};

const reactionSchema = z.object({
  reaction: z.string().min(1),
});

export const reactToPost = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = reactionSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, 'Обери реакцію');
    return;
  }

  try {
    const post = postsService.reactToPost(
      getParam(req.params.id),
      req.user.id,
      parsed.data.reaction,
    );

    if (!post) {
      sendError(res, 'Публікацію не знайдено', HTTP_STATUS.NOT_FOUND);
      return;
    }

    sendSuccess(res, post);
  } catch {
    sendError(res, 'Цю реакцію не можна використати');
  }
};

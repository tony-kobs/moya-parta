import { Response } from 'express';
import { z } from 'zod';
import { HTTP_STATUS } from '../constants';
import { getParam } from '../helpers/params';
import { sendError, sendSuccess } from '../helpers/response';
import { AuthRequest } from '../middlewares/auth';
import * as postsService from '../services/posts.service';
import * as studentService from '../services/student.service';

export const getDesk = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const desk = await studentService.getStudentDesk(req.user.id);

  if (!desk) {
    sendError(res, 'Парту не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, desk);
};

export const getBackpack = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  sendSuccess(res, await studentService.getBackpack(req.user.id));
};

export const completeOnboarding = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const profile = await studentService.completeOnboarding(req.user.id);

  if (!profile) {
    sendError(res, 'Профіль не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, profile);
};

export const getClass = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user?.classId) {
    sendError(res, 'Клас не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  const overview = await postsService.getClassOverview(
    req.user.classId,
    req.user.schoolId,
  );

  if (!overview) {
    sendError(res, 'Клас не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, overview);
};

export const getMyBoard = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  sendSuccess(res, await postsService.getMyPosts(req.user.id));
};

const createPostSchema = z.object({
  text: z.string().min(1, 'Напиши щось у публікації'),
  imageEmoji: z.string().optional(),
  category: z.string().optional(),
});

export const createPost = async (req: AuthRequest, res: Response): Promise<void> => {
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
    const post = await postsService.createPost(req.user, parsed.data);
    sendSuccess(res, post, HTTP_STATUS.CREATED);
  } catch {
    sendError(res, 'Не вдалося поділитися', HTTP_STATUS.BAD_REQUEST);
  }
};

const reactionSchema = z.object({
  reaction: z.string().min(1),
});

export const reactToPost = async (req: AuthRequest, res: Response): Promise<void> => {
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
    const post = await postsService.reactToPost(
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

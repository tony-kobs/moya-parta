import { Response } from 'express';
import { z } from 'zod';
import { HTTP_STATUS } from '../constants';
import { getParam } from '../helpers/params';
import { sendError, sendSuccess } from '../helpers/response';
import { AuthRequest } from '../middlewares/auth';
import * as learningService from '../services/learning.service';

export const getLearning = (req: AuthRequest, res: Response): void => {
  if (!req.user?.classId) {
    sendError(res, 'Клас не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  const data = learningService.getLearningForStudent(
    req.user.id,
    req.user.classId,
  );

  sendSuccess(res, data);
};

const submitHomeworkSchema = z.object({
  answer: z.string().min(1, 'Напиши відповідь або як ти виконав завдання'),
});

export const submitHomework = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = submitHomeworkSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Перевір дані');
    return;
  }

  const result = learningService.submitHomework(
    getParam(req.params.id),
    req.user.id,
    parsed.data.answer,
  );

  if (!result) {
    sendError(res, 'Завдання не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, result);
};

export const getQuiz = (req: AuthRequest, res: Response): void => {
  const quiz = learningService.getQuizById(getParam(req.params.id));

  if (!quiz) {
    sendError(res, 'Тест не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  const safeQuiz = {
    ...quiz,
    questions: quiz.questions.map(({ correctIndex: _correctIndex, ...rest }) => rest),
  };

  sendSuccess(res, safeQuiz);
};

const submitQuizSchema = z.object({
  answers: z.array(z.number()),
});

export const submitQuiz = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = submitQuizSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, 'Обери відповіді');
    return;
  }

  const result = learningService.submitQuizAttempt(
    getParam(req.params.id),
    req.user.id,
    parsed.data.answers,
  );

  if (!result) {
    sendError(res, 'Тест не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, result);
};

export const advanceQuest = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const result = learningService.advanceQuest(
    getParam(req.params.id),
    req.user.id,
  );

  if (!result) {
    sendError(res, 'Квест не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, result);
};

export const getAchievements = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  sendSuccess(res, learningService.getAchievementsForStudent(req.user.id));
};

export const getEvents = (req: AuthRequest, res: Response): void => {
  if (!req.user?.classId) {
    sendError(res, 'Клас не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, learningService.getEvents(req.user.classId));
};

export const joinEvent = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  try {
    const event = learningService.joinEvent(
      getParam(req.params.id),
      req.user.id,
    );

    if (!event) {
      sendError(res, 'Подію не знайдено', HTTP_STATUS.NOT_FOUND);
      return;
    }

    sendSuccess(res, event);
  } catch (error) {
    if (error instanceof Error && error.message === 'EVENT_ENDED') {
      sendError(res, 'Подія вже завершилась');
      return;
    }
    sendError(res, 'Не вдалося приєднатися');
  }
};

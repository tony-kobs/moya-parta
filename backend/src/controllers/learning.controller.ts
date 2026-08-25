import { Response } from 'express';
import { z } from 'zod';
import { HTTP_STATUS } from '../constants';
import { getParam } from '../helpers/params';
import { sendError, sendSuccess } from '../helpers/response';
import { AuthRequest } from '../middlewares/auth';
import * as learningService from '../services/learning.service';

export const getLearning = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user?.classId) {
    sendError(res, 'Клас не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  const data = await learningService.getLearningForStudent(
    req.user.id,
    req.user.classId,
  );

  sendSuccess(res, data);
};

const submitHomeworkSchema = z.object({
  answer: z.string().min(1, 'Напиши відповідь або як ти виконав завдання'),
});

export const submitHomework = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = submitHomeworkSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Перевір дані');
    return;
  }

  const result = await learningService.submitHomework(
    getParam(req.params.id),
    req.user.id,
    parsed.data.answer,
  );

  if (!result) {
    sendError(res, 'Завдання не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  if ('error' in result && result.error === 'CLOSED') {
    sendError(
      res,
      'Термін завдання закінчився. Нові відповіді більше не приймаються.',
      HTTP_STATUS.BAD_REQUEST,
    );
    return;
  }

  sendSuccess(res, result);
};

export const getQuiz = async (req: AuthRequest, res: Response): Promise<void> => {
  const quiz = await learningService.getQuizById(getParam(req.params.id));

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

export const submitQuiz = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = submitQuizSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, 'Обери відповіді');
    return;
  }

  const result = await learningService.submitQuizAttempt(
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

export const advanceQuest = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const result = await learningService.advanceQuest(getParam(req.params.id), req.user);

  if (!result) {
    sendError(res, 'Квест не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  if ('error' in result && result.error === 'INTERACTIVE_ONLY') {
    sendError(
      res,
      'Цей квест проходиться по кроках з відповідями.',
      HTTP_STATUS.BAD_REQUEST,
    );
    return;
  }

  sendSuccess(res, result);
};

export const getQuest = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const quest = await learningService.getQuestForStudent(
    getParam(req.params.id),
    req.user,
  );

  if (!quest) {
    sendError(res, 'Квест не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, quest);
};

const answerQuestSchema = z.object({
  stepIndex: z.number().int().min(0),
  optionIndex: z.number().int().min(0),
});

export const answerQuest = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = answerQuestSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, 'Обери відповідь', HTTP_STATUS.BAD_REQUEST);
    return;
  }

  const result = await learningService.answerQuestStep(
    getParam(req.params.id),
    req.user,
    parsed.data.stepIndex,
    parsed.data.optionIndex,
  );

  if (!result) {
    sendError(res, 'Квест не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  if ('error' in result) {
    if (result.error === 'NOT_INTERACTIVE') {
      sendError(
        res,
        'Цей квест не має покрокових питань.',
        HTTP_STATUS.BAD_REQUEST,
      );
      return;
    }
    sendError(res, 'Цей крок уже пройдено або недоступний.', HTTP_STATUS.BAD_REQUEST);
    return;
  }

  sendSuccess(res, result);
};

export const getAchievements = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  sendSuccess(res, await learningService.getAchievementsForStudent(req.user.id));
};

export const getEvents = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user?.classId) {
    sendError(res, 'Клас не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, await learningService.getEvents(req.user.classId));
};

export const joinEvent = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  try {
    const event = await learningService.joinEvent(
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

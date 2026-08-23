import { Response } from 'express';
import { z } from 'zod';
import { HTTP_STATUS } from '../constants';
import { getParam } from '../helpers/params';
import { sendError, sendSuccess } from '../helpers/response';
import { AuthRequest } from '../middlewares/auth';
import * as learningService from '../services/learning.service';
import * as postsService from '../services/posts.service';
import * as teacherService from '../services/teacher.service';

export const getDashboard = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const dashboard = teacherService.getTeacherDashboard(req.user);
  sendSuccess(res, dashboard);
};

const homeworkSchema = z
  .object({
    subject: z.enum(['math', 'ukrainian', 'reading', 'science', 'art', 'other']),
    title: z.string().min(1, 'Напиши назву завдання'),
    description: z.string().min(1, 'Додай короткий опис'),
    startsAt: z.string().min(1).optional(),
    endsAt: z.string().min(1).optional(),
    dueDate: z.string().min(1).optional(),
    xpReward: z.number().min(5).max(100),
    linkedQuizId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const startsAt = value.startsAt;
    const endsAt = value.endsAt ?? value.dueDate;
    if (!endsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Вкажи дату закінчення',
        path: ['endsAt'],
      });
      return;
    }
    if (!startsAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Вкажи дату початку',
        path: ['startsAt'],
      });
      return;
    }
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Дата «до» має бути пізніше за «від»',
        path: ['endsAt'],
      });
    }
  });

export const createHomework = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = homeworkSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Перевір дані');
    return;
  }

  try {
    const startsAt = parsed.data.startsAt!;
    const endsAt = parsed.data.endsAt ?? parsed.data.dueDate!;
    const homework = learningService.createHomework(req.user, {
      subject: parsed.data.subject,
      title: parsed.data.title,
      description: parsed.data.description,
      startsAt,
      endsAt,
      xpReward: parsed.data.xpReward,
      linkedQuizId: parsed.data.linkedQuizId,
    });
    sendSuccess(res, homework, HTTP_STATUS.CREATED);
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_RANGE') {
      sendError(res, 'Дата «до» має бути пізніше за «від»');
      return;
    }
    sendError(res, 'Не вдалося створити завдання');
  }
};

export const getHomeworkAnalytics = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const analytics = learningService.getHomeworkAnalytics(
    getParam(req.params.id),
    req.user,
  );

  if (!analytics) {
    sendError(res, 'Завдання не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, analytics);
};

export const deleteHomework = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const homework = learningService.deleteHomework(
    getParam(req.params.id),
    req.user,
  );

  if (!homework) {
    sendError(res, 'Завдання не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, homework);
};

const reviewSchema = z.object({
  decision: z.enum(['accept', 'revise', 'redo_test']),
  comment: z.string().max(500).default(''),
});

export const reviewSubmission = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = reviewSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, 'Обери рішення і за потреби додай коментар');
    return;
  }

  const submission = learningService.reviewSubmission(
    getParam(req.params.id),
    req.user,
    parsed.data,
  );

  if (!submission) {
    sendError(res, 'Роботу не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, submission);
};

export const getQuizTemplates = (req: AuthRequest, res: Response): void => {
  const subject =
    typeof req.query.subject === 'string' ? req.query.subject : undefined;
  sendSuccess(res, learningService.getQuizTemplates(subject));
};

export const getClassQuizzes = (req: AuthRequest, res: Response): void => {
  if (!req.user?.classId) {
    sendError(res, 'Клас не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, learningService.getClassQuizzes(req.user.classId));
};

export const assignQuizFromTemplate = (
  req: AuthRequest,
  res: Response,
): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const templateId = z.string().min(1).safeParse(req.body.templateId);

  if (!templateId.success) {
    sendError(res, 'Обери тест із бази');
    return;
  }

  try {
    const quiz = learningService.assignQuizFromTemplate(
      req.user,
      templateId.data,
    );

    if (!quiz) {
      sendError(res, 'Тест не знайдено', HTTP_STATUS.NOT_FOUND);
      return;
    }

    sendSuccess(res, quiz, HTTP_STATUS.CREATED);
  } catch {
    sendError(res, 'Не вдалося додати тест');
  }
};

const createQuizSchema = z.object({
  subject: z.enum(['math', 'ukrainian', 'reading', 'science', 'art', 'other']),
  title: z.string().min(1),
  xpReward: z.number().min(5).max(100),
  questions: z
    .array(
      z.object({
        text: z.string().min(1),
        options: z.array(z.string()).min(2),
        correctIndex: z.number().min(0),
      }),
    )
    .min(1),
});

export const createQuiz = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = createQuizSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, 'Перевір питання тесту');
    return;
  }

  try {
    const quiz = learningService.createClassQuiz(req.user, parsed.data);
    sendSuccess(res, quiz, HTTP_STATUS.CREATED);
  } catch {
    sendError(res, 'Не вдалося створити тест');
  }
};

export const deleteQuiz = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const quiz = learningService.deleteQuiz(getParam(req.params.id), req.user);

  if (!quiz) {
    sendError(res, 'Тест не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, quiz);
};

export const deleteEvent = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const event = learningService.deleteEvent(getParam(req.params.id), req.user);

  if (!event) {
    sendError(res, 'Подію не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, event);
};

export const getEvents = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  sendSuccess(res, teacherService.getTeacherEvents(req.user));
};

export const getPendingPosts = (req: AuthRequest, res: Response): void => {
  if (!req.user?.classId) {
    sendError(res, 'Клас не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(
    res,
    postsService.getPendingPosts(req.user.classId, req.user.schoolId),
  );
};

const moderateSchema = z.object({
  status: z.enum(['published', 'rejected', 'hidden']),
});

export const moderatePost = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = moderateSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, 'Обери дію');
    return;
  }

  const post = postsService.moderatePost(
    getParam(req.params.id),
    parsed.data.status,
    req.user,
  );

  if (!post) {
    sendError(res, 'Публікацію не знайдено', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, post);
};

const questSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  illustration: z.string().min(1),
  xpReward: z.number().min(10),
  totalSteps: z.number().min(1).max(20),
});

export const createQuest = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = questSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, 'Перевір дані квесту');
    return;
  }

  try {
    const quest = teacherService.createQuest(req.user, parsed.data);
    sendSuccess(res, quest, HTTP_STATUS.CREATED);
  } catch {
    sendError(res, 'Не вдалося створити квест');
  }
};

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  materials: z.array(z.string()).optional(),
});

export const createEvent = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = eventSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, 'Перевір дані події');
    return;
  }

  try {
    const event = teacherService.createEvent(req.user, parsed.data);
    sendSuccess(res, event, HTTP_STATUS.CREATED);
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_RANGE') {
      sendError(res, 'Кінець має бути пізніше за початок');
      return;
    }
    sendError(res, 'Не вдалося створити подію');
  }
};

const publishSchema = z.object({
  comment: z.string().min(1, 'Додай коментар'),
  materials: z.array(z.string()).default([]),
});

export const publishEventReview = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = publishSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Перевір дані');
    return;
  }

  try {
    const result = teacherService.publishEventReview(
      req.user,
      getParam(req.params.id),
      parsed.data,
    );

    if (!result) {
      sendError(res, 'Подію не знайдено', HTTP_STATUS.NOT_FOUND);
      return;
    }

    sendSuccess(res, result);
  } catch (error) {
    if (error instanceof Error && error.message === 'EVENT_NOT_ENDED') {
      sendError(res, 'Спочатку дочекайся кінця події');
      return;
    }
    if (error instanceof Error && error.message === 'ALREADY_PUBLISHED') {
      sendError(res, 'Підсумок уже на дошці');
      return;
    }
    if (error instanceof Error && error.message === 'NO_COMMENT') {
      sendError(res, 'Додай коментар до підсумку');
      return;
    }
    sendError(res, 'Не вдалося опублікувати');
  }
};

const classSchema = z.object({
  name: z.string().min(1, 'Напиши назву класу'),
});

export const createClass = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = classSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, parsed.error.issues[0]?.message ?? 'Перевір дані');
    return;
  }

  try {
    const classRoom = teacherService.createClassForTeacher(req.user, parsed.data);
    sendSuccess(res, classRoom, HTTP_STATUS.CREATED);
  } catch (error) {
    if (error instanceof Error && error.message === 'CLASS_EXISTS') {
      sendError(res, 'У тебе вже є клас');
      return;
    }
    sendError(res, 'Не вдалося створити клас');
  }
};

export const getInvite = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const invite = teacherService.getTeacherInvite(req.user);

  if (!invite) {
    sendError(res, 'Спочатку створи клас', HTTP_STATUS.NOT_FOUND);
    return;
  }

  sendSuccess(res, invite);
};

export const regenerateInvite = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  try {
    const invite = teacherService.regenerateInvite(req.user);
    sendSuccess(res, invite);
  } catch {
    sendError(res, 'Спочатку створи клас', HTTP_STATUS.NOT_FOUND);
  }
};

import { z } from 'zod';
import { HTTP_STATUS } from '@/server/constants';
import { fail, getAuthUser, handle, ok, readJson, requireRoles } from '@/server/http';
import * as learningService from '@/server/services/learning.service';
import * as periodicService from '@/server/services/periodic.service';
import * as postsService from '@/server/services/posts.service';
import * as scheduleService from '@/server/services/schedule.service';
import * as teacherService from '@/server/services/teacher.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ path?: string[] }> };
const keyOf = (path: string[]) => path.join('/');

const homeworkSchema = z
  .object({
    subject: z.enum(['math', 'ukrainian', 'reading', 'science', 'art', 'other']),
    title: z.string().min(1, 'Напиши назву завдання'),
    description: z.string().min(1, 'Додай короткий опис'),
    startsAt: z.string().min(1),
    endsAt: z.string().min(1),
    xpReward: z.number().min(5).max(100),
    linkedQuizId: z.string().optional(),
  })
  .refine((values) => new Date(values.endsAt) > new Date(values.startsAt), {
    message: 'Кінець має бути пізніше за початок',
    path: ['endsAt'],
  });

const reviewSchema = z.object({
  decision: z.enum(['accept', 'revise', 'redo_test']),
  comment: z.string().max(500).default(''),
});

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

const moderateSchema = z.object({
  status: z.enum(['published', 'rejected', 'hidden']),
});

const boardPostUpdateSchema = z.object({
  text: z.string().min(1).optional(),
  imageEmoji: z.string().optional(),
  pinned: z.boolean().optional(),
  status: z.enum(['published', 'rejected', 'hidden']).optional(),
});

const createBoardPostSchema = z.object({
  text: z.string().min(1, 'Напиши текст публікації'),
  imageEmoji: z.string().optional(),
  category: z.string().optional(),
});

const questSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  illustration: z.string().min(1),
  xpReward: z.number().min(10),
  totalSteps: z.number().min(1).max(20),
});

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  materials: z.array(z.string()).optional(),
});

const publishSchema = z.object({
  comment: z.string().min(1, 'Додай коментар'),
  materials: z.array(z.string()).default([]),
});

const classSchema = z.object({
  name: z.string().min(1, 'Напиши назву класу'),
});

const lessonSlotSchema = z.object({
  dayOfWeek: z.number().int().min(1).max(5),
  period: z.number().int().min(1).max(10),
  startsAtTime: z.string().min(1),
  endsAtTime: z.string().min(1),
  subject: z.string().min(1),
  room: z.string().optional(),
  teacherNote: z.string().optional(),
});

const periodicTaskSchema = z.object({
  cadence: z.enum(['daily', 'weekly']),
  title: z.string().min(1),
  description: z.string().min(1),
  xpReward: z.number().min(5).max(100),
});

const teacherUser = async (req: Request) => {
  const user = await getAuthUser(req);
  requireRoles(user, 'teacher');
  return user;
};

export async function GET(req: Request, ctx: Ctx) {
  const path = (await ctx.params).path ?? [];
  const key = keyOf(path);

  return handle(async () => {
    const user = await teacherUser(req);

    if (key === 'dashboard') {
      return ok(await teacherService.getTeacherDashboard(user));
    }

    if (key === 'quiz-templates') {
      const url = new URL(req.url);
      const subject = url.searchParams.get('subject') ?? undefined;
      return ok(await learningService.getQuizTemplates(subject));
    }

    if (key === 'quizzes') {
      if (!user.classId) {
        return fail('Клас не знайдено', HTTP_STATUS.NOT_FOUND);
      }
      return ok(await learningService.getClassQuizzes(user.classId));
    }

    if (key === 'events') {
      return ok(await teacherService.getTeacherEvents(user));
    }

    if (key === 'moderation/posts' || key === 'board/posts') {
      return ok(await postsService.getTeacherBoardPosts(user));
    }

    if (key === 'schedule') {
      if (!user.classId) {
        return fail('Клас не знайдено', HTTP_STATUS.NOT_FOUND);
      }
      return ok(await scheduleService.getSchedule(user.classId));
    }

    if (key === 'periodic-tasks') {
      return ok(await periodicService.listTeacherPeriodicTasks(user));
    }

    if (key === 'invite') {
      const invite = await teacherService.getTeacherInvite(user);
      if (!invite) {
        return fail('Спочатку створи клас', HTTP_STATUS.NOT_FOUND);
      }
      return ok(invite);
    }

    if (path[0] === 'homework' && path[2] === 'analytics' && path[1]) {
      const analytics = await learningService.getHomeworkAnalytics(path[1], user);
      if (!analytics) {
        return fail('Завдання не знайдено', HTTP_STATUS.NOT_FOUND);
      }
      return ok(analytics);
    }

    return fail('Такої сторінки немає', HTTP_STATUS.NOT_FOUND);
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const path = (await ctx.params).path ?? [];
  const key = keyOf(path);
  const body = await readJson(req);

  return handle(async () => {
    const user = await teacherUser(req);

    if (key === 'homework') {
      const parsed = homeworkSchema.safeParse(body);
      if (!parsed.success) {
        return fail(parsed.error.issues[0]?.message ?? 'Перевір дані');
      }
      try {
        return ok(
          await learningService.createHomework(user, parsed.data),
          HTTP_STATUS.CREATED,
        );
      } catch (error) {
        if (error instanceof Error && error.message === 'INVALID_RANGE') {
          return fail('Кінець має бути пізніше за початок');
        }
        return fail('Не вдалося створити завдання');
      }
    }

    if (path[0] === 'submissions' && path[2] === 'review' && path[1]) {
      const parsed = reviewSchema.safeParse(body);
      if (!parsed.success) {
        return fail('Обери рішення і за потреби додай коментар');
      }
      const submission = await learningService.reviewSubmission(path[1], user, parsed.data);
      if (!submission) {
        return fail('Роботу не знайдено', HTTP_STATUS.NOT_FOUND);
      }
      return ok(submission);
    }

    if (key === 'quizzes/from-template') {
      const templateId = z.string().min(1).safeParse(body.templateId);
      if (!templateId.success) {
        return fail('Обери тест із бази');
      }
      try {
        const quiz = await learningService.assignQuizFromTemplate(user, templateId.data);
        if (!quiz) {
          return fail('Тест не знайдено', HTTP_STATUS.NOT_FOUND);
        }
        return ok(quiz, HTTP_STATUS.CREATED);
      } catch {
        return fail('Не вдалося додати тест');
      }
    }

    if (key === 'quizzes') {
      const parsed = createQuizSchema.safeParse(body);
      if (!parsed.success) {
        return fail('Перевір питання тесту');
      }
      try {
        return ok(
          await learningService.createClassQuiz(user, parsed.data),
          HTTP_STATUS.CREATED,
        );
      } catch {
        return fail('Не вдалося створити тест');
      }
    }

    if (key === 'events') {
      const parsed = eventSchema.safeParse(body);
      if (!parsed.success) {
        return fail('Перевір дані події');
      }
      try {
        return ok(await teacherService.createEvent(user, parsed.data), HTTP_STATUS.CREATED);
      } catch (error) {
        if (error instanceof Error && error.message === 'INVALID_RANGE') {
          return fail('Кінець має бути пізніше за початок');
        }
        return fail('Не вдалося створити подію');
      }
    }

    if (path[0] === 'events' && path[2] === 'publish' && path[1]) {
      const parsed = publishSchema.safeParse(body);
      if (!parsed.success) {
        return fail(parsed.error.issues[0]?.message ?? 'Перевір дані');
      }
      try {
        const result = await teacherService.publishEventReview(user, path[1], parsed.data);
        if (!result) {
          return fail('Подію не знайдено', HTTP_STATUS.NOT_FOUND);
        }
        return ok(result);
      } catch (error) {
        if (error instanceof Error && error.message === 'EVENT_NOT_ENDED') {
          return fail('Спочатку дочекайся кінця події');
        }
        if (error instanceof Error && error.message === 'ALREADY_PUBLISHED') {
          return fail('Підсумок уже на дошці');
        }
        if (error instanceof Error && error.message === 'NO_COMMENT') {
          return fail('Додай коментар до підсумку');
        }
        return fail('Не вдалося опублікувати');
      }
    }

    if (path[0] === 'moderation' && path[1] === 'posts' && path[2]) {
      const parsed = moderateSchema.safeParse(body);
      if (!parsed.success) {
        return fail('Обери дію');
      }
      const post = await postsService.moderatePost(path[2], parsed.data.status, user);
      if (!post) {
        return fail('Публікацію не знайдено', HTTP_STATUS.NOT_FOUND);
      }
      return ok(post);
    }

    if (key === 'board/posts') {
      const parsed = createBoardPostSchema.safeParse(body);
      if (!parsed.success) {
        return fail(parsed.error.issues[0]?.message ?? 'Перевір дані');
      }
      try {
        return ok(await postsService.createPost(user, parsed.data), HTTP_STATUS.CREATED);
      } catch {
        return fail('Не вдалося опублікувати');
      }
    }

    if (key === 'schedule') {
      const parsed = lessonSlotSchema.safeParse(body);
      if (!parsed.success) {
        return fail(parsed.error.issues[0]?.message ?? 'Перевір дані уроку');
      }
      try {
        return ok(
          await scheduleService.createLessonSlot(user, parsed.data),
          HTTP_STATUS.CREATED,
        );
      } catch (error) {
        if (error instanceof Error && error.message === 'INVALID_DAY') {
          return fail('День має бути з понеділка по пʼятницю');
        }
        return fail('Не вдалося додати урок');
      }
    }

    if (key === 'periodic-tasks') {
      const parsed = periodicTaskSchema.safeParse(body);
      if (!parsed.success) {
        return fail(parsed.error.issues[0]?.message ?? 'Перевір дані');
      }
      try {
        return ok(
          await periodicService.createPeriodicTask(user, parsed.data),
          HTTP_STATUS.CREATED,
        );
      } catch {
        return fail('Не вдалося створити завдання');
      }
    }

    if (key === 'quests') {
      const parsed = questSchema.safeParse(body);
      if (!parsed.success) {
        return fail('Перевір дані квесту');
      }
      try {
        return ok(await teacherService.createQuest(user, parsed.data), HTTP_STATUS.CREATED);
      } catch {
        return fail('Не вдалося створити квест');
      }
    }

    if (key === 'classes') {
      const parsed = classSchema.safeParse(body);
      if (!parsed.success) {
        return fail(parsed.error.issues[0]?.message ?? 'Перевір дані');
      }
      try {
        return ok(
          await teacherService.createClassForTeacher(user, parsed.data),
          HTTP_STATUS.CREATED,
        );
      } catch (error) {
        if (error instanceof Error && error.message === 'CLASS_EXISTS') {
          return fail('У тебе вже є клас');
        }
        return fail('Не вдалося створити клас');
      }
    }

    if (key === 'invite/regenerate') {
      try {
        return ok(await teacherService.regenerateInvite(user));
      } catch {
        return fail('Спочатку створи клас', HTTP_STATUS.NOT_FOUND);
      }
    }

    return fail('Такої сторінки немає', HTTP_STATUS.NOT_FOUND);
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const path = (await ctx.params).path ?? [];
  const body = await readJson(req);

  return handle(async () => {
    const user = await teacherUser(req);

    if (path[0] === 'board' && path[1] === 'posts' && path[2]) {
      const parsed = boardPostUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return fail('Перевір дані');
      }
      const post = await postsService.updateTeacherPost(path[2], user, parsed.data);
      if (!post) {
        return fail('Публікацію не знайдено', HTTP_STATUS.NOT_FOUND);
      }
      return ok(post);
    }

    if (path[0] === 'schedule' && path[1]) {
      const parsed = lessonSlotSchema.partial().safeParse(body);
      if (!parsed.success) {
        return fail('Перевір дані уроку');
      }
      const slot = await scheduleService.updateLessonSlot(path[1], user, parsed.data);
      if (!slot) {
        return fail('Урок не знайдено', HTTP_STATUS.NOT_FOUND);
      }
      return ok(slot);
    }

    if (path[0] === 'periodic-tasks' && path[1]) {
      const parsed = z
        .object({
          title: z.string().min(1).optional(),
          description: z.string().min(1).optional(),
          xpReward: z.number().min(5).max(100).optional(),
          active: z.boolean().optional(),
        })
        .safeParse(body);
      if (!parsed.success) {
        return fail('Перевір дані');
      }
      const task = await periodicService.updatePeriodicTask(path[1], user, parsed.data);
      if (!task) {
        return fail('Завдання не знайдено', HTTP_STATUS.NOT_FOUND);
      }
      return ok(task);
    }

    return fail('Такої сторінки немає', HTTP_STATUS.NOT_FOUND);
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const path = (await ctx.params).path ?? [];

  return handle(async () => {
    const user = await teacherUser(req);

    if (path[0] === 'homework' && path[1] && path.length === 2) {
      const homework = await learningService.deleteHomework(path[1], user);
      if (!homework) {
        return fail('Завдання не знайдено', HTTP_STATUS.NOT_FOUND);
      }
      return ok(homework);
    }

    if (path[0] === 'quizzes' && path[1] && path.length === 2) {
      const quiz = await learningService.deleteQuiz(path[1], user);
      if (!quiz) {
        return fail('Тест не знайдено', HTTP_STATUS.NOT_FOUND);
      }
      return ok(quiz);
    }

    if (path[0] === 'events' && path[1] && path.length === 2) {
      const event = await learningService.deleteEvent(path[1], user);
      if (!event) {
        return fail('Подію не знайдено', HTTP_STATUS.NOT_FOUND);
      }
      return ok(event);
    }

    if (path[0] === 'board' && path[1] === 'posts' && path[2]) {
      const post = await postsService.deleteTeacherPost(path[2], user);
      if (!post) {
        return fail('Публікацію не знайдено', HTTP_STATUS.NOT_FOUND);
      }
      return ok(post);
    }

    if (path[0] === 'schedule' && path[1]) {
      const slot = await scheduleService.deleteLessonSlot(path[1], user);
      if (!slot) {
        return fail('Урок не знайдено', HTTP_STATUS.NOT_FOUND);
      }
      return ok(slot);
    }

    if (path[0] === 'periodic-tasks' && path[1]) {
      const task = await periodicService.deletePeriodicTask(path[1], user);
      if (!task) {
        return fail('Завдання не знайдено', HTTP_STATUS.NOT_FOUND);
      }
      return ok(task);
    }

    return fail('Такої сторінки немає', HTTP_STATUS.NOT_FOUND);
  });
}

import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
  getClassStudentIds,
  loadClassRoom,
  mapClassEvent,
  mapHomework,
  mapHomeworkSubmission,
  mapPost,
} from '../lib/mappers';
import { createId } from '../helpers/response';
import { createInviteCode, normalizeInviteCode } from './auth.service';
import { enrichEvent, eventEndsAt, eventStartsAt } from '../helpers/events';
import {
  homeworkEndsAt,
  homeworkStartsAt,
  isHomeworkActive,
  isHomeworkEnded,
} from '../helpers/homework';
import type { AuthUser, ClassRoom, Grade, Quest } from '../types';
import * as postsService from './posts.service';

export const getTeacherDashboard = async (teacher: AuthUser) => {
  if (!teacher.classId) {
    return {
      greetingName: teacher.displayName,
      className: '',
      hasClass: false,
      today: {
        newWorks: 0,
        doneTasks: 0,
        activeQuest: 0,
        nextEventTitle: null,
        nextEventDate: null,
        nextEventEndsAt: null,
        pendingPosts: 0,
      },
      homeworks: [],
      checkingWorks: [],
      goal: null,
      recentPosts: [],
    };
  }

  const classRoom = await loadClassRoom(teacher.classId);
  const pendingPosts = await prisma.post.count({
    where: { classId: teacher.classId, status: 'pending' },
  });

  const homeworks = await prisma.homework.findMany({
    where: { classId: teacher.classId },
  });
  const homeworkIds = homeworks.map((h) => h.id);
  const submissions = homeworkIds.length
    ? await prisma.homeworkSubmission.findMany({
        where: { homeworkId: { in: homeworkIds } },
      })
    : [];

  const checkingWorks = submissions
    .map(mapHomeworkSubmission)
    .filter((sub) => sub.status === 'checking');

  const now = new Date();
  const doneToday = submissions.filter((sub) => {
    if (!sub.submittedAt) {
      return false;
    }
    return sub.submittedAt.toDateString() === now.toDateString();
  }).length;

  const activeQuest = await prisma.quest.findFirst({
    where: { classId: teacher.classId },
  });

  const events = await prisma.classEvent.findMany({
    where: { classId: teacher.classId },
  });
  const nextEvent = events
    .map(mapClassEvent)
    .filter(
      (event) =>
        new Date(eventEndsAt(event)).getTime() >= Date.now() &&
        !event.publishedPostId,
    )
    .sort(
      (a, b) =>
        new Date(eventStartsAt(a)).getTime() -
        new Date(eventStartsAt(b)).getTime(),
    )[0];

  const recentPostRows = await prisma.post.findMany({
    where: { classId: teacher.classId, status: 'published' },
    orderBy: { createdAt: 'desc' },
    take: 4,
  });
  const authorIds = [...new Set(recentPostRows.map((p) => p.authorId))];
  const authors = authorIds.length
    ? await prisma.user.findMany({ where: { id: { in: authorIds } } })
    : [];
  const authorById = new Map(authors.map((a) => [a.id, a]));

  const recentPosts = recentPostRows.map((row) => {
    const post = mapPost(row);
    const author = authorById.get(post.authorId);
    return {
      ...post,
      authorName: author?.displayName ?? 'Учень',
    };
  });

  const mappedHomeworks = homeworks.map(mapHomework);
  const studentIds = checkingWorks.map((s) => s.studentId);
  const students = studentIds.length
    ? await prisma.user.findMany({ where: { id: { in: studentIds } } })
    : [];
  const studentById = new Map(students.map((s) => [s.id, s]));
  const hwById = new Map(mappedHomeworks.map((h) => [h.id, h]));

  return {
    greetingName: teacher.displayName,
    className: classRoom?.name ?? '',
    hasClass: true,
    today: {
      newWorks: checkingWorks.length,
      doneTasks: doneToday,
      activeQuest: activeQuest ? 1 : 0,
      nextEventTitle: nextEvent?.title ?? null,
      nextEventDate: nextEvent ? eventStartsAt(nextEvent) : null,
      nextEventEndsAt: nextEvent ? eventEndsAt(nextEvent) : null,
      pendingPosts,
    },
    homeworks: mappedHomeworks.map((hw) => ({
      ...hw,
      startsAt: homeworkStartsAt(hw),
      endsAt: homeworkEndsAt(hw),
      dueDate: homeworkEndsAt(hw),
      active: isHomeworkActive(hw),
      ended: isHomeworkEnded(hw),
    })),
    activeHomeworks: mappedHomeworks
      .filter((hw) => !isHomeworkEnded(hw))
      .map((hw) => ({
        ...hw,
        startsAt: homeworkStartsAt(hw),
        endsAt: homeworkEndsAt(hw),
        dueDate: homeworkEndsAt(hw),
        active: isHomeworkActive(hw),
        ended: false,
      })),
    endedHomeworks: mappedHomeworks
      .filter((hw) => isHomeworkEnded(hw))
      .map((hw) => ({
        ...hw,
        startsAt: homeworkStartsAt(hw),
        endsAt: homeworkEndsAt(hw),
        dueDate: homeworkEndsAt(hw),
        active: false,
        ended: true,
      })),
    checkingWorks: checkingWorks.map((sub) => {
      const student = studentById.get(sub.studentId);
      const homework = hwById.get(sub.homeworkId);
      return {
        ...sub,
        studentName: student?.displayName,
        homeworkTitle: homework?.title,
        homeworkId: homework?.id,
        linkedQuizId: homework?.linkedQuizId,
        subject: homework?.subject,
      };
    }),
    goal: classRoom
      ? {
          title: classRoom.goalTitle,
          current: classRoom.goalCurrentXp,
          target: classRoom.goalTargetXp,
        }
      : null,
    recentPosts,
  };
};

export const createQuest = async (
  teacher: AuthUser,
  payload: Omit<Quest, 'id' | 'classId'>,
) => {
  if (!teacher.classId) {
    throw new Error('NO_CLASS');
  }

  const row = await prisma.quest.create({
    data: {
      id: createId('quest'),
      classId: teacher.classId,
      title: payload.title,
      description: payload.description,
      illustration: payload.illustration,
      xpReward: payload.xpReward,
      totalSteps: payload.totalSteps,
      questions: payload.questions
        ? (payload.questions as unknown as Prisma.InputJsonValue)
        : undefined,
      questionSource: payload.questionSource ?? null,
    },
  });

  return {
    id: row.id,
    classId: row.classId,
    title: row.title,
    description: row.description,
    illustration: row.illustration,
    xpReward: row.xpReward,
    totalSteps: row.totalSteps,
    questions: (row.questions as unknown as Quest['questions']) ?? undefined,
    questionSource:
      row.questionSource === 'grade-math' ? ('grade-math' as const) : undefined,
  };
};

export const createEvent = async (
  teacher: AuthUser,
  payload: {
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    materials?: string[];
  },
) => {
  if (!teacher.classId) {
    throw new Error('NO_CLASS');
  }

  if (new Date(payload.endsAt).getTime() <= new Date(payload.startsAt).getTime()) {
    throw new Error('INVALID_RANGE');
  }

  const row = await prisma.classEvent.create({
    data: {
      id: createId('event'),
      classId: teacher.classId,
      title: payload.title,
      description: payload.description,
      startsAt: new Date(payload.startsAt),
      endsAt: new Date(payload.endsAt),
      date: new Date(payload.startsAt),
      participantIds: [],
      progress: 0,
      materials: payload.materials ?? [],
    },
  });

  const event = mapClassEvent(row);
  const studentIds = await getClassStudentIds(teacher.classId);

  if (studentIds.length > 0) {
    await prisma.notification.createMany({
      data: studentIds.map((studentId) => ({
        id: createId('notif'),
        userId: studentId,
        title: 'Подія класу',
        body: `У класі нова подія — ${event.title}`,
        read: false,
        createdAt: new Date(),
        type: 'event',
      })),
    });
  }

  return enrichEvent(event);
};

export const getTeacherEvents = async (teacher: AuthUser) => {
  if (!teacher.classId) {
    return [];
  }

  const rows = await prisma.classEvent.findMany({
    where: { classId: teacher.classId },
  });

  const events = rows
    .map(mapClassEvent)
    .sort(
      (a, b) =>
        new Date(eventStartsAt(b)).getTime() -
        new Date(eventStartsAt(a)).getTime(),
    );

  return Promise.all(events.map(enrichEvent));
};

export const publishEventReview = async (
  teacher: AuthUser,
  eventId: string,
  payload: { comment: string; materials: string[] },
) => {
  if (!teacher.classId) {
    throw new Error('NO_CLASS');
  }

  const row = await prisma.classEvent.findFirst({
    where: { id: eventId, classId: teacher.classId },
  });

  if (!row) {
    return null;
  }

  const event = mapClassEvent(row);

  if (new Date(eventEndsAt(event)).getTime() > Date.now()) {
    throw new Error('EVENT_NOT_ENDED');
  }

  if (event.publishedPostId) {
    throw new Error('ALREADY_PUBLISHED');
  }

  const comment = payload.comment.trim();
  if (!comment) {
    throw new Error('NO_COMMENT');
  }

  const materials = payload.materials
    .map((item) => item.trim())
    .filter(Boolean);

  const participants = event.participantIds.length
    ? (
        await prisma.user.findMany({
          where: { id: { in: event.participantIds } },
        })
      ).map((u) => u.displayName)
    : [];

  const start = new Date(eventStartsAt(event));
  const end = new Date(eventEndsAt(event));
  const rangeLabel = `${start.toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })} — ${end.toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const materialsBlock =
    materials.length > 0
      ? `\n\nМатеріали:\n${materials.map((item) => `• ${item}`).join('\n')}`
      : '';

  const participantsBlock =
    participants.length > 0
      ? `\n\nБрали участь (${participants.length}): ${participants.join(', ')}`
      : '\n\nУчасників поки не було.';

  const post = await postsService.createPost(teacher, {
    text: `${comment}\n\n📅 ${event.title}\n${rangeLabel}${participantsBlock}${materialsBlock}`,
    imageEmoji: '🎉',
    category: 'подія',
  });

  const updated = await prisma.classEvent.update({
    where: { id: eventId },
    data: {
      materials,
      reviewComment: comment,
      reviewedAt: new Date(),
      progress: 100,
      publishedPostId: post.id,
    },
  });

  const studentIds = await getClassStudentIds(teacher.classId);
  if (studentIds.length > 0) {
    await prisma.notification.createMany({
      data: studentIds.map((studentId) => ({
        id: createId('notif'),
        userId: studentId,
        title: 'Підсумок події',
        body: `Учитель опублікував підсумок «${event.title}» на дошці`,
        read: false,
        createdAt: new Date(),
        type: 'event',
      })),
    });
  }

  return {
    event: await enrichEvent(mapClassEvent(updated)),
    post,
  };
};

export const createClassForTeacher = async (
  teacher: AuthUser,
  payload: { name: string; grade: Grade },
) => {
  if (teacher.classId) {
    const existing = await prisma.classRoom.findUnique({
      where: { id: teacher.classId },
    });
    if (existing) {
      throw new Error('CLASS_EXISTS');
    }
  }

  const inviteCode = createInviteCode(payload.name);
  const classId = createId('class');

  await prisma.classRoom.create({
    data: {
      id: classId,
      schoolId: teacher.schoolId,
      name: payload.name.trim(),
      grade: payload.grade,
      teacherId: teacher.id,
      inviteCode,
      goalTargetXp: 1000,
      goalCurrentXp: 0,
      goalTitle: 'Разом збираємо 1000 XP',
    },
  });

  await prisma.user.update({
    where: { id: teacher.id },
    data: { classId },
  });

  return (await loadClassRoom(classId)) as ClassRoom;
};

export const getTeacherInvite = async (teacher: AuthUser) => {
  if (!teacher.classId) {
    return null;
  }

  let classRoom = await loadClassRoom(teacher.classId);

  if (!classRoom) {
    return null;
  }

  if (classRoom.inviteCode !== normalizeInviteCode(classRoom.inviteCode)) {
    const inviteCode = createInviteCode(classRoom.name);
    await prisma.classRoom.update({
      where: { id: classRoom.id },
      data: { inviteCode },
    });
    classRoom = { ...classRoom, inviteCode };
  }

  return {
    classId: classRoom.id,
    className: classRoom.name,
    inviteCode: classRoom.inviteCode,
    invitePath: `/join/${encodeURIComponent(classRoom.inviteCode)}`,
    studentsCount: classRoom.studentIds.length,
  };
};

export const regenerateInvite = async (teacher: AuthUser) => {
  if (!teacher.classId) {
    throw new Error('NO_CLASS');
  }

  const classRoom = await prisma.classRoom.findUnique({
    where: { id: teacher.classId },
  });

  if (!classRoom) {
    throw new Error('NO_CLASS');
  }

  await prisma.classRoom.update({
    where: { id: classRoom.id },
    data: { inviteCode: createInviteCode(classRoom.name) },
  });

  return getTeacherInvite(teacher);
};

import { prisma } from '../lib/prisma';
import {
  mapClassEvent,
  mapHomework,
  mapHomeworkSubmission,
} from '../lib/mappers';
import type { AuthUser } from '../types';
import { eventEndsAt } from '../helpers/events';
import {
  homeworkEndsAt,
  isHomeworkActive,
} from '../helpers/homework';

export type NavSection =
  | 'chat'
  | 'board'
  | 'learning'
  | 'tasks'
  | 'events'
  | 'notifications'
  | 'wins';

export interface NavBadges {
  chat: number;
  board: number;
  learning: number;
  tasks: number;
  events: number;
  notifications: number;
  wins: number;
}

const EMPTY: NavBadges = {
  chat: 0,
  board: 0,
  learning: 0,
  tasks: 0,
  events: 0,
  notifications: 0,
  wins: 0,
};

const seenAt = async (userId: string, section: NavSection): Promise<number> => {
  const row = await prisma.navSeen.findUnique({
    where: { userId_section: { userId, section } },
  });
  return row ? row.seenAt.getTime() : 0;
};

const unreadNotifications = async (userId: string, type?: string) =>
  prisma.notification.count({
    where: {
      userId,
      read: false,
      ...(type ? { type } : {}),
    },
  });

const countUnreadChat = async (user: AuthUser): Promise<number> => {
  if (!user.classId) {
    return 0;
  }

  const since = await seenAt(user.id, 'chat');
  const sinceDate = new Date(since);

  return prisma.chatMessage.count({
    where: {
      classId: user.classId,
      senderId: { not: user.id },
      createdAt: { gt: sinceDate },
      OR: [
        { kind: 'class' },
        { kind: 'direct', recipientId: user.id },
      ],
    },
  });
};

const countNewPosts = async (user: AuthUser): Promise<number> => {
  if (!user.classId) {
    return 0;
  }

  const since = await seenAt(user.id, 'board');

  return prisma.post.count({
    where: {
      classId: user.classId,
      status: 'published',
      authorId: { not: user.id },
      createdAt: { gt: new Date(since) },
    },
  });
};

const countStudentLearning = async (user: AuthUser): Promise<number> => {
  if (!user.classId) {
    return 0;
  }

  const day = 1000 * 60 * 60 * 24;
  const now = Date.now();
  let count = 0;

  const homeworks = await prisma.homework.findMany({
    where: { classId: user.classId },
  });
  const submissions = await prisma.homeworkSubmission.findMany({
    where: { studentId: user.id },
  });
  const subByHw = new Map(submissions.map((s) => [s.homeworkId, s]));

  for (const hwRow of homeworks) {
    const homework = mapHomework(hwRow);
    const submissionRow = subByHw.get(homework.id);
    const submission = submissionRow
      ? mapHomeworkSubmission(submissionRow)
      : undefined;

    if (submission?.status === 'revise') {
      count += 1;
      continue;
    }

    if (
      (!submission || submission.status === 'new') &&
      isHomeworkActive(homework, now) &&
      new Date(homeworkEndsAt(homework)).getTime() < now + day * 2
    ) {
      count += 1;
    }
  }

  const quizzes = await prisma.quiz.findMany({
    where: { classId: user.classId },
  });
  for (const quiz of quizzes) {
    const attempt = await prisma.quizAttempt.findFirst({
      where: { quizId: quiz.id, studentId: user.id },
    });
    if (!attempt) {
      count += 1;
    }
  }

  return count;
};

const countTeacherTasks = async (user: AuthUser): Promise<number> => {
  if (!user.classId) {
    return 0;
  }

  const homeworks = await prisma.homework.findMany({
    where: { classId: user.classId },
    select: { id: true },
  });
  const homeworkIds = homeworks.map((h) => h.id);

  if (homeworkIds.length === 0) {
    return 0;
  }

  return prisma.homeworkSubmission.count({
    where: { homeworkId: { in: homeworkIds }, status: 'checking' },
  });
};

const countEvents = async (user: AuthUser): Promise<number> => {
  if (!user.classId) {
    return 0;
  }

  const now = Date.now();
  const since = await seenAt(user.id, 'events');
  const events = await prisma.classEvent.findMany({
    where: { classId: user.classId },
  });

  return events.map(mapClassEvent).filter((event) => {
    if (new Date(eventEndsAt(event)).getTime() < now) {
      return false;
    }

    if (event.publishedPostId) {
      return false;
    }

    if (user.role === 'student' && event.participantIds.includes(user.id)) {
      return false;
    }

    if (since === 0) {
      return true;
    }

    return false;
  }).length;
};

export const getNavBadges = async (user: AuthUser): Promise<NavBadges> => {
  if (!user.classId && user.role === 'teacher') {
    return { ...EMPTY };
  }

  const eventsSince = await seenAt(user.id, 'events');
  const [
    chat,
    board,
    learning,
    tasks,
    eventsCount,
    eventNotifs,
    notifications,
    wins,
  ] = await Promise.all([
    countUnreadChat(user),
    countNewPosts(user),
    user.role === 'student' ? countStudentLearning(user) : Promise.resolve(0),
    user.role === 'teacher' ? countTeacherTasks(user) : Promise.resolve(0),
    countEvents(user),
    eventsSince > 0
      ? unreadNotifications(user.id, 'event')
      : Promise.resolve(0),
    unreadNotifications(user.id),
    user.role === 'student'
      ? unreadNotifications(user.id, 'achievement')
      : Promise.resolve(0),
  ]);

  return {
    chat,
    board,
    learning,
    tasks,
    events: eventsCount + eventNotifs,
    notifications,
    wins,
  };
};

export const markNavSectionSeen = async (
  user: AuthUser,
  section: NavSection,
): Promise<NavBadges> => {
  const now = new Date();
  await prisma.navSeen.upsert({
    where: { userId_section: { userId: user.id, section } },
    create: { userId: user.id, section, seenAt: now },
    update: { seenAt: now },
  });

  if (section === 'notifications') {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
  }

  if (section === 'chat') {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false, type: 'chat' },
      data: { read: true },
    });
  }

  if (section === 'wins') {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false, type: 'achievement' },
      data: { read: true },
    });
  }

  if (section === 'events') {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false, type: 'event' },
      data: { read: true },
    });
  }

  return getNavBadges(user);
};

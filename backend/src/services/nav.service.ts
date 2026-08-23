import { db } from '../data/seed';
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

const seenAt = (userId: string, section: NavSection): number => {
  const value = db.navSeen[userId]?.[section];
  return value ? new Date(value).getTime() : 0;
};

const unreadNotifications = (userId: string, type?: string) =>
  db.notifications.filter(
    (item) =>
      item.userId === userId &&
      !item.read &&
      (type ? item.type === type : true),
  ).length;

const countUnreadChat = (user: AuthUser): number => {
  if (!user.classId) {
    return 0;
  }

  const since = seenAt(user.id, 'chat');

  return db.chatMessages.filter((msg) => {
    if (msg.classId !== user.classId || msg.senderId === user.id) {
      return false;
    }

    if (new Date(msg.createdAt).getTime() <= since) {
      return false;
    }

    if (msg.kind === 'class') {
      return true;
    }

    return msg.kind === 'direct' && msg.recipientId === user.id;
  }).length;
};

const countNewPosts = (user: AuthUser): number => {
  if (!user.classId) {
    return 0;
  }

  const since = seenAt(user.id, 'board');

  return db.posts.filter(
    (post) =>
      post.classId === user.classId &&
      post.status === 'published' &&
      post.authorId !== user.id &&
      new Date(post.createdAt).getTime() > since,
  ).length;
};

const countStudentLearning = (user: AuthUser): number => {
  if (!user.classId) {
    return 0;
  }

  const day = 1000 * 60 * 60 * 24;
  const now = Date.now();
  let count = 0;

  for (const homework of db.homeworks.filter(
    (item) => item.classId === user.classId,
  )) {
    const submission = db.homeworkSubmissions.find(
      (item) =>
        item.homeworkId === homework.id && item.studentId === user.id,
    );

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

  const quizzes = db.quizzes.filter((quiz) => quiz.classId === user.classId);
  for (const quiz of quizzes) {
    const attempt = db.quizAttempts.find(
      (item) => item.quizId === quiz.id && item.studentId === user.id,
    );
    if (!attempt) {
      count += 1;
    }
  }

  return count;
};

const countTeacherTasks = (user: AuthUser): number => {
  if (!user.classId) {
    return 0;
  }

  const homeworkIds = new Set(
    db.homeworks
      .filter((item) => item.classId === user.classId)
      .map((item) => item.id),
  );

  return db.homeworkSubmissions.filter(
    (item) => homeworkIds.has(item.homeworkId) && item.status === 'checking',
  ).length;
};

const countEvents = (user: AuthUser): number => {
  if (!user.classId) {
    return 0;
  }

  const now = Date.now();
  const since = seenAt(user.id, 'events');

  return db.events.filter((event) => {
    if (event.classId !== user.classId) {
      return false;
    }

    if (new Date(eventEndsAt(event)).getTime() < now) {
      return false;
    }

    if (event.publishedPostId) {
      return false;
    }

    if (user.role === 'student' && event.participantIds.includes(user.id)) {
      return false;
    }

    // Without createdAt — show upcoming until user opens events once
    // After first visit, only unread event notifications keep the badge warm
    if (since === 0) {
      return true;
    }

    return false;
  }).length;
};

export const getNavBadges = (user: AuthUser): NavBadges => {
  if (!user.classId && user.role === 'teacher') {
    return { ...EMPTY };
  }

  const badges: NavBadges = {
    chat: countUnreadChat(user),
    board: countNewPosts(user),
    learning: user.role === 'student' ? countStudentLearning(user) : 0,
    tasks: user.role === 'teacher' ? countTeacherTasks(user) : 0,
    events:
      countEvents(user) +
      (seenAt(user.id, 'events') > 0
        ? unreadNotifications(user.id, 'event')
        : 0),
    notifications: unreadNotifications(user.id),
    wins:
      user.role === 'student' ? unreadNotifications(user.id, 'achievement') : 0,
  };

  return badges;
};

export const markNavSectionSeen = (
  user: AuthUser,
  section: NavSection,
): NavBadges => {
  const now = new Date().toISOString();
  const current = db.navSeen[user.id] ?? {};
  db.navSeen[user.id] = { ...current, [section]: now };

  if (section === 'notifications') {
    db.notifications
      .filter((item) => item.userId === user.id && !item.read)
      .forEach((item) => {
        item.read = true;
      });
  }

  if (section === 'chat') {
    db.notifications
      .filter(
        (item) =>
          item.userId === user.id && !item.read && item.type === 'chat',
      )
      .forEach((item) => {
        item.read = true;
      });
  }

  if (section === 'wins') {
    db.notifications
      .filter(
        (item) =>
          item.userId === user.id &&
          !item.read &&
          item.type === 'achievement',
      )
      .forEach((item) => {
        item.read = true;
      });
  }

  if (section === 'events') {
    db.notifications
      .filter(
        (item) =>
          item.userId === user.id && !item.read && item.type === 'event',
      )
      .forEach((item) => {
        item.read = true;
      });
  }

  return getNavBadges(user);
};

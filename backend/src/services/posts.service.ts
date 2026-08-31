import { prisma } from '../lib/prisma';
import {
  getClassStudentIds,
  loadClassRoom,
  mapClassEvent,
  mapPost,
  mapQuest,
  mapUser,
} from '../lib/mappers';
import { createId, toPublicUser } from '../helpers/response';
import { enrichEvent } from '../helpers/events';
import type { AuthUser, Post, PostStatus } from '../types';
import { enrichPost } from './student.service';

const SAFE_REACTIONS = ['❤️', '👏', '⭐', '😊', '🎉', '👍'] as const;

const withReactionCounts = async (post: Post) => {
  const enriched = await enrichPost(post);
  return {
    ...enriched,
    reactionCounts: Object.fromEntries(
      Object.entries(post.reactions).map(([emoji, users]) => [
        emoji,
        users.length,
      ]),
    ),
  };
};

export const getClassBoard = async (classId: string, schoolId: string) => {
  const rows = await prisma.post.findMany({
    where: { classId, schoolId, status: 'published' },
    orderBy: { createdAt: 'desc' },
  });
  return Promise.all(rows.map((row) => withReactionCounts(mapPost(row))));
};

export const getMyPosts = async (userId: string) => {
  const rows = await prisma.post.findMany({
    where: { authorId: userId, status: { not: 'rejected' } },
    orderBy: { createdAt: 'desc' },
  });
  return Promise.all(rows.map((row) => withReactionCounts(mapPost(row))));
};

export const createPost = async (
  user: AuthUser,
  payload: { text: string; imageEmoji?: string; category?: string },
) => {
  if (!user.classId) {
    throw new Error('NO_CLASS');
  }

  const row = await prisma.post.create({
    data: {
      id: createId('post'),
      authorId: user.id,
      classId: user.classId,
      schoolId: user.schoolId,
      text: payload.text.trim(),
      imageEmoji: payload.imageEmoji,
      category: payload.category,
      status: 'published',
      createdAt: new Date(),
      reactions: {},
    },
  });

  return withReactionCounts(mapPost(row));
};

export const reactToPost = async (
  postId: string,
  userId: string,
  reaction: string,
) => {
  if (!SAFE_REACTIONS.includes(reaction as (typeof SAFE_REACTIONS)[number])) {
    throw new Error('INVALID_REACTION');
  }

  const row = await prisma.post.findFirst({
    where: { id: postId, status: 'published' },
  });

  if (!row) {
    return null;
  }

  const post = mapPost(row);
  const reactions = { ...post.reactions };

  for (const key of Object.keys(reactions)) {
    reactions[key] = reactions[key].filter((id) => id !== userId);
    if (reactions[key].length === 0) {
      delete reactions[key];
    }
  }

  if (!reactions[reaction]) {
    reactions[reaction] = [];
  }
  reactions[reaction].push(userId);

  const updated = await prisma.post.update({
    where: { id: postId },
    data: { reactions },
  });

  if (post.authorId !== userId) {
    const reactor = await prisma.user.findUnique({ where: { id: userId } });
    await prisma.notification.create({
      data: {
        id: createId('notif'),
        userId: post.authorId,
        title: 'Підтримка',
        body: `${reactor?.displayName ?? 'Хтось'} підтримав твою публікацію`,
        read: false,
        createdAt: new Date(),
        type: 'reaction',
      },
    });
  }

  return withReactionCounts(mapPost(updated));
};

export const moderatePost = async (
  postId: string,
  status: PostStatus,
  moderator: AuthUser,
) => {
  const row = await prisma.post.findUnique({ where: { id: postId } });

  if (!row || row.schoolId !== moderator.schoolId) {
    return null;
  }

  if (moderator.role === 'teacher' && row.classId !== moderator.classId) {
    return null;
  }

  const updated = await prisma.post.update({
    where: { id: postId },
    data: { status },
  });

  if (status === 'published') {
    await prisma.notification.create({
      data: {
        id: createId('notif'),
        userId: updated.authorId,
        title: 'Твою роботу показали!',
        body: 'Учитель відкрив твою публікацію для класу',
        read: false,
        createdAt: new Date(),
        type: 'moderation',
      },
    });
  }

  return withReactionCounts(mapPost(updated));
};

export const getPendingPosts = async (classId: string, schoolId: string) => {
  const rows = await prisma.post.findMany({
    where: { classId, schoolId, status: 'pending' },
  });
  return Promise.all(rows.map((row) => withReactionCounts(mapPost(row))));
};

export const getClassOverview = async (classId: string, schoolId: string) => {
  const classRoom = await loadClassRoom(classId);

  if (!classRoom || classRoom.schoolId !== schoolId) {
    return null;
  }

  const teacherRow = await prisma.user.findUnique({
    where: { id: classRoom.teacherId },
  });
  const studentIds = await getClassStudentIds(classId);
  const studentRows = studentIds.length
    ? await prisma.user.findMany({ where: { id: { in: studentIds } } })
    : [];
  const byId = new Map(studentRows.map((u) => [u.id, u]));
  const students = studentIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((user) => toPublicUser(mapUser(user!)));

  const eventRows = await prisma.classEvent.findMany({ where: { classId } });
  const events = await Promise.all(
    eventRows.map((e) => enrichEvent(mapClassEvent(e))),
  );
  const questRows = await prisma.quest.findMany({ where: { classId } });

  return {
    class: classRoom,
    teacher: teacherRow ? toPublicUser(mapUser(teacherRow)) : null,
    students,
    board: await getClassBoard(classId, schoolId),
    events,
    quests: questRows.map(mapQuest),
    goal: {
      title: classRoom.goalTitle,
      current: classRoom.goalCurrentXp,
      target: classRoom.goalTargetXp,
    },
  };
};

import { db } from '../data/seed';
import { createId, toPublicUser } from '../helpers/response';
import { enrichEvent } from '../helpers/events';
import type { AuthUser, Post, PostStatus } from '../types';

const SAFE_REACTIONS = ['❤️', '👏', '⭐', '😊', '🎉', '👍'] as const;

const enrichPost = (post: Post) => {
  const author = db.users.find((user) => user.id === post.authorId);

  return {
    ...post,
    author: author
      ? {
          id: author.id,
          displayName: author.displayName,
          avatarColor: author.avatarColor,
          avatarEmoji: author.avatarEmoji,
        }
      : null,
    reactionCounts: Object.fromEntries(
      Object.entries(post.reactions).map(([emoji, users]) => [
        emoji,
        users.length,
      ]),
    ),
  };
};

export const getClassBoard = (classId: string, schoolId: string) => {
  return db.posts
    .filter(
      (post) =>
        post.classId === classId &&
        post.schoolId === schoolId &&
        post.status === 'published',
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map(enrichPost);
};

export const getMyPosts = (userId: string) => {
  return db.posts
    .filter((post) => post.authorId === userId && post.status !== 'rejected')
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map(enrichPost);
};

export const createPost = (
  user: AuthUser,
  payload: { text: string; imageEmoji?: string; category?: string },
) => {
  if (!user.classId) {
    throw new Error('NO_CLASS');
  }

  const post: Post = {
    id: createId('post'),
    authorId: user.id,
    classId: user.classId,
    schoolId: user.schoolId,
    text: payload.text.trim(),
    imageEmoji: payload.imageEmoji,
    category: payload.category,
    status: 'published',
    createdAt: new Date().toISOString(),
    reactions: {},
  };

  db.posts.unshift(post);

  return enrichPost(post);
};

export const reactToPost = (
  postId: string,
  userId: string,
  reaction: string,
) => {
  if (!SAFE_REACTIONS.includes(reaction as (typeof SAFE_REACTIONS)[number])) {
    throw new Error('INVALID_REACTION');
  }

  const post = db.posts.find(
    (item) => item.id === postId && item.status === 'published',
  );

  if (!post) {
    return null;
  }

  for (const key of Object.keys(post.reactions)) {
    post.reactions[key] = post.reactions[key].filter((id) => id !== userId);
    if (post.reactions[key].length === 0) {
      delete post.reactions[key];
    }
  }

  if (!post.reactions[reaction]) {
    post.reactions[reaction] = [];
  }

  post.reactions[reaction].push(userId);

  if (post.authorId !== userId) {
    const reactor = db.users.find((user) => user.id === userId);
    db.notifications.unshift({
      id: createId('notif'),
      userId: post.authorId,
      title: 'Підтримка',
      body: `${reactor?.displayName ?? 'Хтось'} підтримав твою публікацію`,
      read: false,
      createdAt: new Date().toISOString(),
      type: 'reaction',
    });
  }

  return enrichPost(post);
};

export const moderatePost = (
  postId: string,
  status: PostStatus,
  moderator: AuthUser,
) => {
  const post = db.posts.find((item) => item.id === postId);

  if (!post || post.schoolId !== moderator.schoolId) {
    return null;
  }

  if (
    moderator.role === 'teacher' &&
    post.classId !== moderator.classId
  ) {
    return null;
  }

  post.status = status;

  if (status === 'published') {
    db.notifications.unshift({
      id: createId('notif'),
      userId: post.authorId,
      title: 'Твою роботу показали!',
      body: 'Учитель відкрив твою публікацію для класу',
      read: false,
      createdAt: new Date().toISOString(),
      type: 'moderation',
    });
  }

  return enrichPost(post);
};

export const getPendingPosts = (classId: string, schoolId: string) => {
  return db.posts
    .filter(
      (post) =>
        post.classId === classId &&
        post.schoolId === schoolId &&
        post.status === 'pending',
    )
    .map(enrichPost);
};

export const getClassOverview = (classId: string, schoolId: string) => {
  const classRoom = db.classes.find(
    (item) => item.id === classId && item.schoolId === schoolId,
  );

  if (!classRoom) {
    return null;
  }

  const teacher = db.users.find((user) => user.id === classRoom.teacherId);
  const students = classRoom.studentIds
    .map((id) => db.users.find((user) => user.id === id))
    .filter(Boolean)
    .map((user) => toPublicUser(user!));

  return {
    class: classRoom,
    teacher: teacher ? toPublicUser(teacher) : null,
    students,
    board: getClassBoard(classId, schoolId),
    events: db.events
      .filter((event) => event.classId === classId)
      .map(enrichEvent),
    quests: db.quests.filter((quest) => quest.classId === classId),
    goal: {
      title: classRoom.goalTitle,
      current: classRoom.goalCurrentXp,
      target: classRoom.goalTargetXp,
    },
  };
};

import { XP_PER_LEVEL } from '../constants';
import { db } from '../data/seed';
import { createId, toPublicUser } from '../helpers/response';
import {
  enrichEvent,
  eventEndsAt,
  eventStartsAt,
} from '../helpers/events';
import { isHomeworkActive } from '../helpers/homework';
import type { BackpackItem, StudentProfile } from '../types';

export const getStudentDesk = (studentId: string) => {
  const user = db.users.find((item) => item.id === studentId);
  const profile = db.studentProfiles.find((item) => item.userId === studentId);
  const classRoom = db.classes.find((item) => item.id === user?.classId);
  const teacher = db.users.find((item) => item.id === classRoom?.teacherId);

  if (!user || !profile || !classRoom) {
    return null;
  }

  const todayHomework = db.homeworks
    .filter((hw) => hw.classId === classRoom.id && isHomeworkActive(hw))
    .map((hw) => {
      const submission = db.homeworkSubmissions.find(
        (sub) => sub.homeworkId === hw.id && sub.studentId === studentId,
      );
      return {
        ...hw,
        status: submission?.status ?? 'new',
      };
    })
    .filter((hw) => hw.status === 'new')
    .slice(0, 2);

  const latestPosts = db.posts
    .filter(
      (post) =>
        post.classId === classRoom.id && post.status === 'published',
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 3)
    .map((post) => enrichPost(post));

  const nextEvent = db.events
    .filter(
      (event) =>
        event.classId === classRoom.id &&
        new Date(eventEndsAt(event)).getTime() >= Date.now() &&
        !event.publishedPostId,
    )
    .sort(
      (a, b) =>
        new Date(eventStartsAt(a)).getTime() -
        new Date(eventStartsAt(b)).getTime(),
    )
    .map(enrichEvent)[0];

  const recentAchievements = db.studentAchievements
    .filter((item) => item.studentId === studentId)
    .map((item) => {
      const achievement = db.achievements.find(
        (ach) => ach.id === item.achievementId,
      );
      return achievement
        ? { ...achievement, unlockedAt: item.unlockedAt }
        : null;
    })
    .filter(Boolean)
    .slice(0, 3);

  return {
    user: toPublicUser(user),
    profile,
    className: classRoom.name,
    teacherName: teacher?.displayName ?? 'Учитель',
    todayHomework,
    latestPosts,
    nextEvent,
    recentAchievements,
    classGoal: {
      title: classRoom.goalTitle,
      current: classRoom.goalCurrentXp,
      target: classRoom.goalTargetXp,
    },
    dailyGoal: {
      title: 'Виконай одне завдання',
      xp: 20,
    },
  };
};

export const getStudentProfile = (
  studentId: string,
): StudentProfile | null => {
  return db.studentProfiles.find((item) => item.userId === studentId) ?? null;
};

export const addXp = (
  studentId: string,
  amount: number,
  reason: string,
): StudentProfile | null => {
  const profile = db.studentProfiles.find((item) => item.userId === studentId);

  if (!profile) {
    return null;
  }

  profile.xp += amount;

  while (profile.xp >= profile.xpToNextLevel) {
    profile.xp -= profile.xpToNextLevel;
    profile.level += 1;
    profile.xpToNextLevel = XP_PER_LEVEL;
  }

  db.xpTransactions.unshift({
    id: createId('xp'),
    studentId,
    amount,
    reason,
    createdAt: new Date().toISOString(),
  });

  const classRoom = db.classes.find((room) =>
    room.studentIds.includes(studentId),
  );

  if (classRoom) {
    classRoom.goalCurrentXp = Math.min(
      classRoom.goalTargetXp,
      classRoom.goalCurrentXp + amount,
    );
  }

  return profile;
};

export const completeOnboarding = (studentId: string): StudentProfile | null => {
  const profile = db.studentProfiles.find((item) => item.userId === studentId);

  if (!profile) {
    return null;
  }

  profile.onboardingCompleted = true;
  return profile;
};

export const getBackpack = (studentId: string): BackpackItem[] => {
  const profile = db.studentProfiles.find((item) => item.userId === studentId);
  const unlocked = new Set(profile?.unlockedItems ?? []);

  return db.backpackItems.map((item) => ({
    ...item,
    unlocked: unlocked.has(item.id) || item.unlocked,
  }));
};

export const getClassmates = (classId: string, schoolId: string) => {
  const classRoom = db.classes.find(
    (item) => item.id === classId && item.schoolId === schoolId,
  );

  if (!classRoom) {
    return [];
  }

  return classRoom.studentIds
    .map((id) => db.users.find((user) => user.id === id))
    .filter(Boolean)
    .map((user) => toPublicUser(user!));
};

const enrichPost = (post: (typeof db.posts)[number]) => {
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
  };
};

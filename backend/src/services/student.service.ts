import { XP_PER_LEVEL } from '../constants';
import { prisma } from '../lib/prisma';
import {
  getClassStudentIds,
  loadClassRoom,
  mapBackpackItem,
  mapClassEvent,
  mapHomework,
  mapHomeworkSubmission,
  mapPost,
  mapStudentAchievement,
  mapStudentProfile,
  mapUser,
} from '../lib/mappers';
import { createId, toPublicUser } from '../helpers/response';
import {
  enrichEvent,
  eventEndsAt,
  eventStartsAt,
} from '../helpers/events';
import { isHomeworkActive } from '../helpers/homework';
import type { BackpackItem, StudentProfile } from '../types';

export const getStudentDesk = async (studentId: string) => {
  const userRow = await prisma.user.findUnique({ where: { id: studentId } });
  const profileRow = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
  });

  if (!userRow || !profileRow || !userRow.classId) {
    return null;
  }

  const user = mapUser(userRow);
  const profile = mapStudentProfile(profileRow);
  const classRoom = await loadClassRoom(userRow.classId);

  if (!classRoom) {
    return null;
  }

  const teacherRow = await prisma.user.findUnique({
    where: { id: classRoom.teacherId },
  });

  const homeworks = await prisma.homework.findMany({
    where: { classId: classRoom.id },
  });
  const submissions = await prisma.homeworkSubmission.findMany({
    where: { studentId },
  });
  const subByHw = new Map(submissions.map((s) => [s.homeworkId, s]));

  const todayHomework = homeworks
    .map(mapHomework)
    .filter((hw) => isHomeworkActive(hw))
    .map((hw) => {
      const submission = subByHw.get(hw.id);
      return {
        ...hw,
        status: submission
          ? mapHomeworkSubmission(submission).status
          : ('new' as const),
      };
    })
    .filter((hw) => hw.status === 'new')
    .slice(0, 2);

  const posts = await prisma.post.findMany({
    where: { classId: classRoom.id, status: 'published' },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  const latestPosts = await Promise.all(posts.map((p) => enrichPost(mapPost(p))));

  const events = await prisma.classEvent.findMany({
    where: { classId: classRoom.id },
  });
  const nextEventCandidates = events
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
    );

  const nextEvent = nextEventCandidates[0]
    ? await enrichEvent(nextEventCandidates[0])
    : undefined;

  const studentAchs = await prisma.studentAchievement.findMany({
    where: { studentId },
    take: 3,
    orderBy: { unlockedAt: 'desc' },
  });
  const achIds = studentAchs.map((a) => a.achievementId);
  const achievements = achIds.length
    ? await prisma.achievement.findMany({ where: { id: { in: achIds } } })
    : [];
  const achById = new Map(achievements.map((a) => [a.id, a]));

  const recentAchievements = studentAchs
    .map((item) => {
      const mapped = mapStudentAchievement(item);
      const achievement = achById.get(item.achievementId);
      return achievement
        ? { ...achievement, unlockedAt: mapped.unlockedAt }
        : null;
    })
    .filter(Boolean);

  return {
    user: toPublicUser(user),
    profile,
    className: classRoom.name,
    teacherName: teacherRow?.displayName ?? 'Учитель',
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

export const getStudentProfile = async (
  studentId: string,
): Promise<StudentProfile | null> => {
  const row = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
  });
  return row ? mapStudentProfile(row) : null;
};

export const addXp = async (
  studentId: string,
  amount: number,
  reason: string,
): Promise<StudentProfile | null> => {
  const profileRow = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
  });

  if (!profileRow) {
    return null;
  }

  let xp = profileRow.xp + amount;
  let level = profileRow.level;
  let xpToNextLevel = profileRow.xpToNextLevel;

  while (xp >= xpToNextLevel) {
    xp -= xpToNextLevel;
    level += 1;
    xpToNextLevel = XP_PER_LEVEL;
  }

  const updated = await prisma.studentProfile.update({
    where: { userId: studentId },
    data: { xp, level, xpToNextLevel },
  });

  await prisma.xpTransaction.create({
    data: {
      id: createId('xp'),
      studentId,
      amount,
      reason,
      createdAt: new Date(),
    },
  });

  const membership = await prisma.classMembership.findFirst({
    where: { studentId },
  });

  if (membership) {
    const classRoom = await prisma.classRoom.findUnique({
      where: { id: membership.classId },
    });
    if (classRoom) {
      await prisma.classRoom.update({
        where: { id: classRoom.id },
        data: {
          goalCurrentXp: Math.min(
            classRoom.goalTargetXp,
            classRoom.goalCurrentXp + amount,
          ),
        },
      });
    }
  }

  return mapStudentProfile(updated);
};

export const completeOnboarding = async (
  studentId: string,
): Promise<StudentProfile | null> => {
  const existing = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.studentProfile.update({
    where: { userId: studentId },
    data: { onboardingCompleted: true },
  });

  return mapStudentProfile(updated);
};

export const getBackpack = async (studentId: string): Promise<BackpackItem[]> => {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: studentId },
  });
  const unlocked = new Set(
    ((profile?.unlockedItems as string[]) ?? []) as string[],
  );
  const items = await prisma.backpackItem.findMany();

  return items.map((item) => {
    const mapped = mapBackpackItem(item);
    return {
      ...mapped,
      unlocked: unlocked.has(item.id) || mapped.unlocked,
    };
  });
};

export const getClassmates = async (classId: string, schoolId: string) => {
  const classRoom = await prisma.classRoom.findFirst({
    where: { id: classId, schoolId },
  });

  if (!classRoom) {
    return [];
  }

  const studentIds = await getClassStudentIds(classId);
  if (studentIds.length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: { id: { in: studentIds } },
  });
  const byId = new Map(users.map((u) => [u.id, u]));

  return studentIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((user) => toPublicUser(mapUser(user!)));
};

export const enrichPost = async (post: ReturnType<typeof mapPost>) => {
  const authorRow = await prisma.user.findUnique({
    where: { id: post.authorId },
  });
  const author = authorRow ? mapUser(authorRow) : null;

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

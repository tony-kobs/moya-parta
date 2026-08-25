import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { getClassStudentIds, mapUser } from '../lib/mappers';
import { createId, toPublicUser } from '../helpers/response';
import type { AuthUser, User } from '../types';

const AVATAR_COLORS = ['#E9A6B8', '#B8DDF5', '#C9B8EA', '#F4C95D', '#7BC6A4', '#6C8CF5'];
const AVATAR_EMOJIS = ['🦊', '🐻', '🐰', '🐯', '🐸', '🐼', '🦄', '🐧'];

const signUser = (user: AuthUser): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET is missing');
  }

  return jwt.sign(user, secret, { expiresIn: '7d' });
};

const createSession = (user: User) => {
  const publicUser = toPublicUser(user) as AuthUser;
  return { token: signUser(publicUser), user: publicUser };
};

export const loginUser = async (
  login: string,
  password: string,
): Promise<{ token: string; user: AuthUser } | null> => {
  const row = await prisma.user.findFirst({
    where: { email: login.toLowerCase() },
  });

  if (!row) {
    return null;
  }

  const user = mapUser(row);
  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    return null;
  }

  return createSession(user);
};

export const getCurrentUser = async (userId: string): Promise<AuthUser | null> => {
  const row = await prisma.user.findUnique({ where: { id: userId } });
  return row ? (toPublicUser(mapUser(row)) as AuthUser) : null;
};

const CYRILLIC_TO_LATIN: Record<string, string> = {
  А: 'A',
  Б: 'B',
  В: 'V',
  Г: 'H',
  Ґ: 'G',
  Д: 'D',
  Е: 'E',
  Є: 'YE',
  Ж: 'ZH',
  З: 'Z',
  И: 'Y',
  І: 'I',
  Ї: 'YI',
  Й: 'Y',
  К: 'K',
  Л: 'L',
  М: 'M',
  Н: 'N',
  О: 'O',
  П: 'P',
  Р: 'R',
  С: 'S',
  Т: 'T',
  У: 'U',
  Ф: 'F',
  Х: 'KH',
  Ц: 'TS',
  Ч: 'CH',
  Ш: 'SH',
  Щ: 'SHCH',
  Ю: 'YU',
  Я: 'YA',
  Ь: '',
  Ъ: '',
};

/** Коди лише латиницею — надійні в URL і на дошці. */
export const normalizeInviteCode = (code: string): string => {
  const decoded = (() => {
    try {
      return decodeURIComponent(code);
    } catch {
      return code;
    }
  })();

  return decoded
    .trim()
    .toUpperCase()
    .split('')
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join('')
    .replace(/[^A-Z0-9-]/g, '');
};

export const createInviteCode = (className: string): string => {
  const prefix =
    normalizeInviteCode(className).replace(/-/g, '').slice(0, 4) || 'CLASS';
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
};

export const registerTeacher = async (payload: {
  displayName: string;
  login: string;
  password: string;
  avatarEmoji?: string;
}): Promise<{ token: string; user: AuthUser }> => {
  const exists = await prisma.user.findFirst({
    where: { email: payload.login.toLowerCase() },
  });

  if (exists) {
    throw new Error('LOGIN_TAKEN');
  }

  const schoolId = createId('school');
  await prisma.school.create({
    data: {
      id: schoolId,
      name: `Клас ${payload.displayName}`,
    },
  });

  const allowedTeacherAvatars = ['🧑‍🏫', '👨‍🏫', '👩‍🏫'];
  const avatarEmoji =
    payload.avatarEmoji && allowedTeacherAvatars.includes(payload.avatarEmoji)
      ? payload.avatarEmoji
      : '🧑‍🏫';

  const [firstName, ...rest] = payload.displayName.trim().split(/\s+/);
  const userId = createId('user');
  const row = await prisma.user.create({
    data: {
      id: userId,
      email: payload.login.toLowerCase(),
      passwordHash: await bcrypt.hash(payload.password, 8),
      role: 'teacher',
      firstName: firstName || payload.displayName,
      lastName: rest.join(' '),
      displayName: payload.displayName.trim(),
      schoolId,
      avatarColor: '#7BC6A4',
      avatarEmoji,
    },
  });

  return createSession(mapUser(row));
};

export const getInvitePreview = async (inviteCode: string) => {
  const normalized = normalizeInviteCode(inviteCode);
  const classes = await prisma.classRoom.findMany();
  const classRoom = classes.find(
    (item) => normalizeInviteCode(item.inviteCode) === normalized,
  );

  if (!classRoom) {
    return null;
  }

  const teacher = await prisma.user.findUnique({
    where: { id: classRoom.teacherId },
  });
  const studentsCount = (await getClassStudentIds(classRoom.id)).length;

  return {
    classId: classRoom.id,
    className: classRoom.name,
    inviteCode: classRoom.inviteCode,
    teacherName: teacher?.displayName ?? 'Учитель',
    studentsCount,
  };
};

export const registerStudentByInvite = async (payload: {
  inviteCode: string;
  displayName: string;
  login: string;
  password: string;
  avatarEmoji?: string;
}): Promise<{ token: string; user: AuthUser }> => {
  const classes = await prisma.classRoom.findMany();
  const classRoom = classes.find(
    (item) =>
      normalizeInviteCode(item.inviteCode) ===
      normalizeInviteCode(payload.inviteCode),
  );

  if (!classRoom) {
    throw new Error('INVITE_NOT_FOUND');
  }

  const exists = await prisma.user.findFirst({
    where: { email: payload.login.toLowerCase() },
  });

  if (exists) {
    throw new Error('LOGIN_TAKEN');
  }

  const emoji =
    payload.avatarEmoji && AVATAR_EMOJIS.includes(payload.avatarEmoji)
      ? payload.avatarEmoji
      : AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];

  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const userId = createId('user');

  const row = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        id: userId,
        email: payload.login.toLowerCase(),
        passwordHash: await bcrypt.hash(payload.password, 8),
        role: 'student',
        firstName: payload.displayName.trim(),
        lastName: '',
        displayName: payload.displayName.trim(),
        schoolId: classRoom.schoolId,
        classId: classRoom.id,
        avatarColor: color,
        avatarEmoji: emoji,
      },
    });

    await tx.classMembership.create({
      data: {
        classId: classRoom.id,
        studentId: user.id,
      },
    });

    await tx.studentProfile.create({
      data: {
        userId: user.id,
        level: 1,
        xp: 0,
        xpToNextLevel: 1000,
        unlockedItems: [],
        onboardingCompleted: false,
      },
    });

    return user;
  });

  return createSession(mapUser(row));
};

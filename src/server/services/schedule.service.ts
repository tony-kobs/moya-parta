import { prisma } from '../db';
import { createId } from '../helpers/response';
import type { AuthUser } from '../types';

export type LessonSlotView = {
  id: string;
  classId: string;
  dayOfWeek: number;
  period: number;
  startsAtTime: string;
  endsAtTime: string;
  subject: string;
  room?: string;
  teacherNote?: string;
};

const toSlot = (row: {
  id: string;
  classId: string;
  dayOfWeek: number;
  period: number;
  startsAtTime: string;
  endsAtTime: string;
  subject: string;
  room: string | null;
  teacherNote: string | null;
}): LessonSlotView => ({
  id: row.id,
  classId: row.classId,
  dayOfWeek: row.dayOfWeek,
  period: row.period,
  startsAtTime: row.startsAtTime,
  endsAtTime: row.endsAtTime,
  subject: row.subject,
  room: row.room ?? undefined,
  teacherNote: row.teacherNote ?? undefined,
});

export const getSchedule = async (classId: string) => {
  const rows = await prisma.lessonSlot.findMany({
    where: { classId },
    orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
  });
  return rows.map(toSlot);
};

export const createLessonSlot = async (
  teacher: AuthUser,
  payload: {
    dayOfWeek: number;
    period: number;
    startsAtTime: string;
    endsAtTime: string;
    subject: string;
    room?: string;
    teacherNote?: string;
  },
) => {
  if (!teacher.classId) {
    throw new Error('NO_CLASS');
  }

  if (payload.dayOfWeek < 1 || payload.dayOfWeek > 5) {
    throw new Error('INVALID_DAY');
  }

  const row = await prisma.lessonSlot.create({
    data: {
      id: createId('slot'),
      classId: teacher.classId,
      dayOfWeek: payload.dayOfWeek,
      period: payload.period,
      startsAtTime: payload.startsAtTime,
      endsAtTime: payload.endsAtTime,
      subject: payload.subject.trim(),
      room: payload.room?.trim() || null,
      teacherNote: payload.teacherNote?.trim() || null,
    },
  });

  return toSlot(row);
};

export const updateLessonSlot = async (
  slotId: string,
  teacher: AuthUser,
  payload: Partial<{
    dayOfWeek: number;
    period: number;
    startsAtTime: string;
    endsAtTime: string;
    subject: string;
    room: string | null;
    teacherNote: string | null;
  }>,
) => {
  const existing = await prisma.lessonSlot.findFirst({
    where: { id: slotId, classId: teacher.classId ?? '' },
  });

  if (!existing) {
    return null;
  }

  const row = await prisma.lessonSlot.update({
    where: { id: slotId },
    data: {
      ...(payload.dayOfWeek !== undefined ? { dayOfWeek: payload.dayOfWeek } : {}),
      ...(payload.period !== undefined ? { period: payload.period } : {}),
      ...(payload.startsAtTime !== undefined ? { startsAtTime: payload.startsAtTime } : {}),
      ...(payload.endsAtTime !== undefined ? { endsAtTime: payload.endsAtTime } : {}),
      ...(payload.subject !== undefined ? { subject: payload.subject.trim() } : {}),
      ...(payload.room !== undefined ? { room: payload.room } : {}),
      ...(payload.teacherNote !== undefined ? { teacherNote: payload.teacherNote } : {}),
    },
  });

  return toSlot(row);
};

export const deleteLessonSlot = async (slotId: string, teacher: AuthUser) => {
  const existing = await prisma.lessonSlot.findFirst({
    where: { id: slotId, classId: teacher.classId ?? '' },
  });

  if (!existing) {
    return null;
  }

  await prisma.lessonSlot.delete({ where: { id: slotId } });
  return toSlot(existing);
};

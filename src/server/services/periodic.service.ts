import { prisma, notifyMany, studentIdsOf } from '../db';
import { createId } from '../helpers/response';
import type { AuthUser } from '../types';
import { addXp } from './student.service';

export type PeriodicCadence = 'daily' | 'weekly';

export type PeriodicTaskView = {
  id: string;
  classId: string;
  cadence: PeriodicCadence;
  title: string;
  description: string;
  xpReward: number;
  active: boolean;
  createdAt: string;
  completed?: boolean;
  periodKey?: string;
};

const toTask = (row: {
  id: string;
  classId: string;
  cadence: string;
  title: string;
  description: string;
  xpReward: number;
  active: boolean;
  createdAt: Date;
}): PeriodicTaskView => ({
  id: row.id,
  classId: row.classId,
  cadence: row.cadence as PeriodicCadence,
  title: row.title,
  description: row.description,
  xpReward: row.xpReward,
  active: row.active,
  createdAt: row.createdAt.toISOString(),
});

/** YYYY-MM-DD in local timezone */
export const dailyPeriodKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** ISO week key YYYY-Www */
export const weeklyPeriodKey = (date = new Date()) => {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

export const periodKeyFor = (cadence: PeriodicCadence, date = new Date()) =>
  cadence === 'daily' ? dailyPeriodKey(date) : weeklyPeriodKey(date);

export const listTeacherPeriodicTasks = async (teacher: AuthUser) => {
  if (!teacher.classId) {
    return [];
  }

  const rows = await prisma.periodicTask.findMany({
    where: { classId: teacher.classId },
    orderBy: [{ cadence: 'asc' }, { createdAt: 'desc' }],
  });

  return rows.map(toTask);
};

export const createPeriodicTask = async (
  teacher: AuthUser,
  payload: {
    cadence: PeriodicCadence;
    title: string;
    description: string;
    xpReward: number;
  },
) => {
  if (!teacher.classId) {
    throw new Error('NO_CLASS');
  }

  const row = await prisma.periodicTask.create({
    data: {
      id: createId('ptask'),
      classId: teacher.classId,
      cadence: payload.cadence,
      title: payload.title.trim(),
      description: payload.description.trim(),
      xpReward: payload.xpReward,
      active: true,
      createdBy: teacher.id,
    },
  });

  await notifyMany(await studentIdsOf(teacher.classId), {
    title: payload.cadence === 'daily' ? 'Нове щоденне завдання' : 'Нове щотижневе завдання',
    body: payload.title.trim(),
    type: 'homework',
  });

  return toTask(row);
};

export const updatePeriodicTask = async (
  taskId: string,
  teacher: AuthUser,
  payload: Partial<{
    title: string;
    description: string;
    xpReward: number;
    active: boolean;
  }>,
) => {
  const existing = await prisma.periodicTask.findFirst({
    where: { id: taskId, classId: teacher.classId ?? '' },
  });

  if (!existing) {
    return null;
  }

  const row = await prisma.periodicTask.update({
    where: { id: taskId },
    data: {
      ...(payload.title !== undefined ? { title: payload.title.trim() } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description.trim() }
        : {}),
      ...(payload.xpReward !== undefined ? { xpReward: payload.xpReward } : {}),
      ...(payload.active !== undefined ? { active: payload.active } : {}),
    },
  });

  return toTask(row);
};

export const deletePeriodicTask = async (taskId: string, teacher: AuthUser) => {
  const existing = await prisma.periodicTask.findFirst({
    where: { id: taskId, classId: teacher.classId ?? '' },
  });

  if (!existing) {
    return null;
  }

  await prisma.periodicTask.delete({ where: { id: taskId } });
  return toTask(existing);
};

export const getStudentPeriodicTasks = async (studentId: string, classId: string) => {
  const rows = await prisma.periodicTask.findMany({
    where: { classId, active: true },
    orderBy: [{ cadence: 'asc' }, { createdAt: 'desc' }],
  });

  const completions = await prisma.periodicTaskCompletion.findMany({
    where: { userId: studentId },
  });

  const doneKeys = new Set(
    completions.map((item) => `${item.taskId}:${item.periodKey}`),
  );

  return rows.map((row) => {
    const task = toTask(row);
    const periodKey = periodKeyFor(task.cadence);
    return {
      ...task,
      periodKey,
      completed: doneKeys.has(`${task.id}:${periodKey}`),
    };
  });
};

export const completePeriodicTask = async (taskId: string, studentId: string) => {
  const taskRow = await prisma.periodicTask.findUnique({ where: { id: taskId } });
  if (!taskRow || !taskRow.active) {
    return null;
  }

  const membership = await prisma.classMembership.findFirst({
    where: { studentId, classId: taskRow.classId },
  });
  if (!membership) {
    throw new Error('FORBIDDEN');
  }

  const cadence = taskRow.cadence as PeriodicCadence;
  const periodKey = periodKeyFor(cadence);

  const existing = await prisma.periodicTaskCompletion.findUnique({
    where: {
      taskId_userId_periodKey: { taskId, userId: studentId, periodKey },
    },
  });

  if (existing) {
    return {
      task: toTask(taskRow),
      periodKey,
      alreadyCompleted: true,
      xpEarned: 0,
      profile: null,
    };
  }

  await prisma.periodicTaskCompletion.create({
    data: {
      id: createId('ptc'),
      taskId,
      userId: studentId,
      periodKey,
    },
  });

  const profile = await addXp(
    studentId,
    taskRow.xpReward,
    `${cadence === 'daily' ? 'Щоденне' : 'Щотижневе'}: ${taskRow.title}`,
  );

  return {
    task: { ...toTask(taskRow), completed: true, periodKey },
    periodKey,
    alreadyCompleted: false,
    xpEarned: taskRow.xpReward,
    profile,
  };
};

import type { Homework } from '../types';

/** Normalize legacy homework that only had dueDate */
export const homeworkStartsAt = (homework: Homework): string => {
  return homework.startsAt ?? homework.dueDate;
};

export const homeworkEndsAt = (homework: Homework): string => {
  return homework.endsAt ?? homework.dueDate;
};

export const isHomeworkStarted = (
  homework: Homework,
  now = Date.now(),
): boolean => {
  return new Date(homeworkStartsAt(homework)).getTime() <= now;
};

export const isHomeworkEnded = (
  homework: Homework,
  now = Date.now(),
): boolean => {
  return new Date(homeworkEndsAt(homework)).getTime() < now;
};

/** Visible in student «завдання» / active teacher list */
export const isHomeworkActive = (
  homework: Homework,
  now = Date.now(),
): boolean => {
  return isHomeworkStarted(homework, now) && !isHomeworkEnded(homework, now);
};

export const canStudentSubmitHomework = (
  homework: Homework,
  status: string | undefined,
  now = Date.now(),
): boolean => {
  if (status === 'revise') {
    return true;
  }

  return isHomeworkActive(homework, now);
};

import type {
  Achievement,
  BackpackItem,
  ChatMessage,
  ClassEvent,
  ClassRoom,
  Grade,
  Homework,
  HomeworkSubmission,
  LearningMaterial,
  NotificationItem,
  Post,
  Quest,
  QuestProgress,
  Quiz,
  QuizAttempt,
  QuizQuestion,
  QuizTemplate,
  School,
  StudentAchievement,
  StudentProfile,
  User,
  XPTransaction,
} from '../types';

const iso = (value: Date | string | null | undefined): string | undefined => {
  if (value == null) {
    return undefined;
  }
  return value instanceof Date ? value.toISOString() : value;
};

const isoRequired = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;

export const mapSchool = (row: {
  id: string;
  name: string;
}): School => ({
  id: row.id,
  name: row.name,
});

export const mapUser = (row: {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  firstName: string;
  lastName: string;
  displayName: string;
  schoolId: string;
  classId: string | null;
  avatarColor: string;
  avatarEmoji: string;
}): User => ({
  id: row.id,
  email: row.email,
  passwordHash: row.passwordHash,
  role: row.role as User['role'],
  firstName: row.firstName,
  lastName: row.lastName,
  displayName: row.displayName,
  schoolId: row.schoolId,
  classId: row.classId ?? undefined,
  avatarColor: row.avatarColor,
  avatarEmoji: row.avatarEmoji,
});

export const mapClassRoom = (
  row: {
    id: string;
    schoolId: string;
    name: string;
    grade: number;
    teacherId: string;
    inviteCode: string;
    goalTargetXp: number;
    goalCurrentXp: number;
    goalTitle: string;
  },
  studentIds: string[] = [],
): ClassRoom => ({
  id: row.id,
  schoolId: row.schoolId,
  name: row.name,
  grade: row.grade as Grade,
  teacherId: row.teacherId,
  inviteCode: row.inviteCode,
  studentIds,
  goalTargetXp: row.goalTargetXp,
  goalCurrentXp: row.goalCurrentXp,
  goalTitle: row.goalTitle,
});

export const mapStudentProfile = (row: {
  userId: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  unlockedItems: unknown;
  onboardingCompleted: boolean;
}): StudentProfile => ({
  userId: row.userId,
  level: row.level,
  xp: row.xp,
  xpToNextLevel: row.xpToNextLevel,
  unlockedItems: (row.unlockedItems as string[]) ?? [],
  onboardingCompleted: row.onboardingCompleted,
});

export const mapPost = (row: {
  id: string;
  authorId: string;
  classId: string;
  schoolId: string;
  text: string;
  imageEmoji: string | null;
  category: string | null;
  status: string;
  createdAt: Date;
  reactions: unknown;
}): Post => ({
  id: row.id,
  authorId: row.authorId,
  classId: row.classId,
  schoolId: row.schoolId,
  text: row.text,
  imageEmoji: row.imageEmoji ?? undefined,
  category: row.category ?? undefined,
  status: row.status as Post['status'],
  createdAt: isoRequired(row.createdAt),
  reactions: (row.reactions as Record<string, string[]>) ?? {},
});

export const mapHomework = (row: {
  id: string;
  classId: string;
  subject: string;
  title: string;
  description: string;
  dueDate: Date;
  startsAt: Date;
  endsAt: Date;
  xpReward: number;
  createdBy: string;
  linkedQuizId: string | null;
}): Homework => ({
  id: row.id,
  classId: row.classId,
  subject: row.subject as Homework['subject'],
  title: row.title,
  description: row.description,
  dueDate: isoRequired(row.dueDate),
  startsAt: isoRequired(row.startsAt),
  endsAt: isoRequired(row.endsAt),
  xpReward: row.xpReward,
  createdBy: row.createdBy,
  linkedQuizId: row.linkedQuizId ?? undefined,
});

export const mapHomeworkSubmission = (row: {
  id: string;
  homeworkId: string;
  studentId: string;
  status: string;
  answer: string | null;
  teacherComment: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
}): HomeworkSubmission => ({
  id: row.id,
  homeworkId: row.homeworkId,
  studentId: row.studentId,
  status: row.status as HomeworkSubmission['status'],
  answer: row.answer ?? undefined,
  teacherComment: row.teacherComment ?? undefined,
  submittedAt: iso(row.submittedAt),
  reviewedAt: iso(row.reviewedAt),
});

export const mapQuizTemplate = (row: {
  id: string;
  subject: string;
  title: string;
  description: string;
  xpReward: number;
  questions: unknown;
}): QuizTemplate => ({
  id: row.id,
  subject: row.subject as QuizTemplate['subject'],
  title: row.title,
  description: row.description,
  xpReward: row.xpReward,
  questions: row.questions as QuizQuestion[],
});

export const mapQuiz = (row: {
  id: string;
  classId: string;
  subject: string;
  title: string;
  xpReward: number;
  questions: unknown;
  templateId: string | null;
}): Quiz => ({
  id: row.id,
  classId: row.classId,
  subject: row.subject as Quiz['subject'],
  title: row.title,
  xpReward: row.xpReward,
  questions: row.questions as QuizQuestion[],
  templateId: row.templateId ?? undefined,
});

export const mapQuizAttempt = (row: {
  id: string;
  quizId: string;
  studentId: string;
  answers: unknown;
  score: number;
  total: number;
  xpEarned: number;
  completedAt: Date;
}): QuizAttempt => ({
  id: row.id,
  quizId: row.quizId,
  studentId: row.studentId,
  answers: row.answers as number[],
  score: row.score,
  total: row.total,
  xpEarned: row.xpEarned,
  completedAt: isoRequired(row.completedAt),
});

export const mapQuest = (row: {
  id: string;
  classId: string;
  title: string;
  description: string;
  illustration: string;
  xpReward: number;
  totalSteps: number;
  questions: unknown;
  questionSource: string | null;
}): Quest => ({
  id: row.id,
  classId: row.classId,
  title: row.title,
  description: row.description,
  illustration: row.illustration,
  xpReward: row.xpReward,
  totalSteps: row.totalSteps,
  questions: (row.questions as Quest['questions']) ?? undefined,
  questionSource:
    row.questionSource === 'grade-math' ? 'grade-math' : undefined,
});

export const mapQuestProgress = (row: {
  questId: string;
  studentId: string;
  currentStep: number;
  completed: boolean;
}): QuestProgress => ({
  questId: row.questId,
  studentId: row.studentId,
  currentStep: row.currentStep,
  completed: row.completed,
});

export const mapAchievement = (row: {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  hidden: boolean;
}): Achievement => ({
  id: row.id,
  title: row.title,
  description: row.description,
  category: row.category,
  icon: row.icon,
  hidden: row.hidden,
});

export const mapStudentAchievement = (row: {
  studentId: string;
  achievementId: string;
  unlockedAt: Date;
}): StudentAchievement => ({
  studentId: row.studentId,
  achievementId: row.achievementId,
  unlockedAt: isoRequired(row.unlockedAt),
});

export const mapClassEvent = (row: {
  id: string;
  classId: string;
  title: string;
  description: string;
  date: Date | null;
  startsAt: Date;
  endsAt: Date;
  participantIds: unknown;
  progress: number;
  materials: unknown;
  reviewComment: string | null;
  reviewedAt: Date | null;
  publishedPostId: string | null;
}): ClassEvent => ({
  id: row.id,
  classId: row.classId,
  title: row.title,
  description: row.description,
  date: iso(row.date),
  startsAt: isoRequired(row.startsAt),
  endsAt: isoRequired(row.endsAt),
  participantIds: (row.participantIds as string[]) ?? [],
  progress: row.progress,
  materials: (row.materials as string[]) ?? [],
  reviewComment: row.reviewComment ?? undefined,
  reviewedAt: iso(row.reviewedAt),
  publishedPostId: row.publishedPostId ?? undefined,
});

export const mapNotification = (row: {
  id: string;
  userId: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
  type: string;
}): NotificationItem => ({
  id: row.id,
  userId: row.userId,
  title: row.title,
  body: row.body,
  read: row.read,
  createdAt: isoRequired(row.createdAt),
  type: row.type,
});

export const mapXpTransaction = (row: {
  id: string;
  studentId: string;
  amount: number;
  reason: string;
  createdAt: Date;
}): XPTransaction => ({
  id: row.id,
  studentId: row.studentId,
  amount: row.amount,
  reason: row.reason,
  createdAt: isoRequired(row.createdAt),
});

export const mapBackpackItem = (row: {
  id: string;
  title: string;
  category: string;
  icon: string;
  unlocked: boolean;
}): BackpackItem => ({
  id: row.id,
  title: row.title,
  category: row.category as BackpackItem['category'],
  icon: row.icon,
  unlocked: row.unlocked,
});

export const mapLearningMaterial = (row: {
  id: string;
  classId: string;
  subject: string;
  title: string;
  summary: string;
  missedLesson: boolean;
}): LearningMaterial => ({
  id: row.id,
  classId: row.classId,
  subject: row.subject as LearningMaterial['subject'],
  title: row.title,
  summary: row.summary,
  missedLesson: row.missedLesson,
});

export const mapChatMessage = (row: {
  id: string;
  classId: string;
  schoolId: string;
  kind: string;
  senderId: string;
  recipientId: string | null;
  text: string;
  createdAt: Date;
}): ChatMessage => ({
  id: row.id,
  classId: row.classId,
  schoolId: row.schoolId,
  kind: row.kind as ChatMessage['kind'],
  senderId: row.senderId,
  recipientId: row.recipientId,
  text: row.text,
  createdAt: isoRequired(row.createdAt),
});

import { prisma } from './prisma';

export async function getClassStudentIds(classId: string): Promise<string[]> {
  const memberships = await prisma.classMembership.findMany({
    where: { classId },
    select: { studentId: true },
  });
  return memberships.map((m) => m.studentId);
}

export async function loadClassRoom(classId: string): Promise<ClassRoom | null> {
  const row = await prisma.classRoom.findUnique({ where: { id: classId } });
  if (!row) {
    return null;
  }
  const studentIds = await getClassStudentIds(classId);
  return mapClassRoom(row, studentIds);
}

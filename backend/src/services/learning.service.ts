import { prisma } from '../lib/prisma';
import { mathExpeditionQuestionsByGrade } from '../data/mathExpeditionQuestions';
import {
  getClassStudentIds,
  loadClassRoom,
  mapAchievement,
  mapClassEvent,
  mapHomework,
  mapHomeworkSubmission,
  mapLearningMaterial,
  mapQuest,
  mapQuestProgress,
  mapQuiz,
  mapQuizAttempt,
  mapQuizTemplate,
  mapStudentAchievement,
  mapUser,
} from '../lib/mappers';
import { createId } from '../helpers/response';
import { enrichEvent, getEventLifecycle } from '../helpers/events';
import {
  canStudentSubmitHomework,
  homeworkEndsAt,
  homeworkStartsAt,
  isHomeworkActive,
  isHomeworkEnded,
  isHomeworkStarted,
} from '../helpers/homework';
import { addXp } from './student.service';
import type { AuthUser, Grade, Homework, Quest, QuestQuestion, Quiz } from '../types';

const resolveQuestQuestions = async (
  quest: Quest,
): Promise<QuestQuestion[] | undefined> => {
  if (quest.questionSource === 'grade-math') {
    const classRoom = await prisma.classRoom.findUnique({
      where: { id: quest.classId },
    });
    return classRoom
      ? mathExpeditionQuestionsByGrade[classRoom.grade as Grade]
      : undefined;
  }

  return quest.questions;
};

const resolveQuestGrade = async (quest: Quest): Promise<Grade | undefined> => {
  if (quest.questionSource !== 'grade-math') {
    return undefined;
  }

  const classRoom = await prisma.classRoom.findUnique({
    where: { id: quest.classId },
  });
  return classRoom ? (classRoom.grade as Grade) : undefined;
};

const sanitizeQuest = async (quest: Quest) => ({
  ...quest,
  questions: (await resolveQuestQuestions(quest))?.map(
    ({ correctIndex: _correctIndex, ...rest }) => rest,
  ),
  grade: await resolveQuestGrade(quest),
});

export const getLearningForStudent = async (
  studentId: string,
  classId: string,
) => {
  const homeworkRows = await prisma.homework.findMany({ where: { classId } });
  const submissions = await prisma.homeworkSubmission.findMany({
    where: { studentId },
  });
  const subByHw = new Map(submissions.map((s) => [s.homeworkId, s]));

  const homework = homeworkRows
    .map(mapHomework)
    .map((hw) => {
      const submissionRow = subByHw.get(hw.id);
      const submission = submissionRow
        ? mapHomeworkSubmission(submissionRow)
        : undefined;
      const ends = new Date(homeworkEndsAt(hw)).getTime();
      const starts = new Date(homeworkStartsAt(hw)).getTime();
      const now = Date.now();
      let bucket: 'today' | 'waiting' | 'later' | 'done' = 'later';

      if (submission?.status === 'revise') {
        bucket = 'waiting';
      } else if (submission && submission.status !== 'new') {
        bucket = 'done';
      } else if (!isHomeworkStarted(hw, now)) {
        bucket = 'later';
      } else if (isHomeworkEnded(hw, now)) {
        bucket = 'waiting';
      } else if (ends - now < 1000 * 60 * 60 * 24) {
        bucket = 'today';
      } else if (starts <= now) {
        bucket = 'today';
      }

      return {
        ...hw,
        startsAt: homeworkStartsAt(hw),
        endsAt: homeworkEndsAt(hw),
        dueDate: homeworkEndsAt(hw),
        status: submission?.status ?? 'new',
        teacherComment: submission?.teacherComment,
        bucket,
        linkedQuizId: hw.linkedQuizId,
        ended: isHomeworkEnded(hw, now),
        active: isHomeworkActive(hw, now),
      };
    })
    .filter((hw) => {
      if (hw.status === 'revise' || hw.status === 'checking') {
        return true;
      }
      if (hw.status === 'reviewed' || hw.status === 'done') {
        return true;
      }
      return !hw.ended && (hw.active || hw.bucket === 'later');
    });

  const quizRows = await prisma.quiz.findMany({ where: { classId } });
  const quizzes = quizRows.map(mapQuiz);

  const questRows = await prisma.quest.findMany({ where: { classId } });
  const progressRows = await prisma.questProgress.findMany({
    where: { studentId },
  });
  const progressByQuest = new Map(
    progressRows.map((p) => [p.questId, mapQuestProgress(p)]),
  );

  const quests = await Promise.all(
    questRows.map(async (row) => {
      const quest = mapQuest(row);
      const progress = progressByQuest.get(quest.id);
      return {
        ...(await sanitizeQuest(quest)),
        currentStep: progress?.currentStep ?? 0,
        completed: progress?.completed ?? false,
      };
    }),
  );

  const materialRows = await prisma.learningMaterial.findMany({
    where: { classId },
  });

  return {
    homework,
    quizzes,
    quests,
    materials: materialRows.map(mapLearningMaterial),
  };
};

export const submitHomework = async (
  homeworkId: string,
  studentId: string,
  answer: string,
) => {
  const homeworkRow = await prisma.homework.findUnique({
    where: { id: homeworkId },
  });

  if (!homeworkRow) {
    return null;
  }

  const homework = mapHomework(homeworkRow);
  let submissionRow = await prisma.homeworkSubmission.findUnique({
    where: {
      homeworkId_studentId: { homeworkId, studentId },
    },
  });

  if (!canStudentSubmitHomework(homework, submissionRow?.status as never)) {
    return { error: 'CLOSED' as const };
  }

  if (!submissionRow) {
    submissionRow = await prisma.homeworkSubmission.create({
      data: {
        id: createId('sub'),
        homeworkId,
        studentId,
        status: 'checking',
        answer,
        submittedAt: new Date(),
      },
    });

    const profile = await addXp(
      studentId,
      homework.xpReward,
      `Завдання: ${homework.title}`,
    );

    await prisma.notification.create({
      data: {
        id: createId('notif'),
        userId: homework.createdBy,
        title: 'Нова робота',
        body: 'Учень надіслав роботу на перевірку',
        read: false,
        createdAt: new Date(),
        type: 'homework',
      },
    });

    return {
      submission: mapHomeworkSubmission(submissionRow),
      xpEarned: homework.xpReward,
      profile,
      message: `Готово! +${homework.xpReward} XP`,
    };
  }

  submissionRow = await prisma.homeworkSubmission.update({
    where: { id: submissionRow.id },
    data: {
      status: 'checking',
      answer,
      submittedAt: new Date(),
      teacherComment: null,
    },
  });

  await prisma.notification.create({
    data: {
      id: createId('notif'),
      userId: homework.createdBy,
      title: 'Роботу оновлено',
      body: 'Учень надіслав роботу знову',
      read: false,
      createdAt: new Date(),
      type: 'homework',
    },
  });

  return {
    submission: mapHomeworkSubmission(submissionRow),
    xpEarned: 0,
    profile: null,
    message: 'Надіслано на перевірку!',
  };
};

export const getQuizById = async (quizId: string): Promise<Quiz | null> => {
  const row = await prisma.quiz.findUnique({ where: { id: quizId } });
  return row ? mapQuiz(row) : null;
};

export const submitQuizAttempt = async (
  quizId: string,
  studentId: string,
  answers: number[],
) => {
  const quizRow = await prisma.quiz.findUnique({ where: { id: quizId } });

  if (!quizRow) {
    return null;
  }

  const quiz = mapQuiz(quizRow);
  let score = 0;
  const review = quiz.questions.map((question, index) => {
    const selected = answers[index] ?? -1;
    const isCorrect = selected === question.correctIndex;
    if (isCorrect) {
      score += 1;
    }
    return {
      questionId: question.id,
      text: question.text,
      selected,
      correctIndex: question.correctIndex,
      isCorrect,
      options: question.options,
    };
  });

  const ratio = score / quiz.questions.length;
  const xpEarned = Math.round(quiz.xpReward * Math.max(ratio, 0.3));
  const profile = await addXp(studentId, xpEarned, `Тест: ${quiz.title}`);

  const attemptRow = await prisma.quizAttempt.create({
    data: {
      id: createId('attempt'),
      quizId,
      studentId,
      answers,
      score,
      total: quiz.questions.length,
      xpEarned,
      completedAt: new Date(),
    },
  });

  return {
    attempt: mapQuizAttempt(attemptRow),
    review,
    profile,
    message: 'Ти завершив тест!',
  };
};

export const advanceQuest = async (questId: string, student: AuthUser) => {
  const questRow = await prisma.quest.findFirst({
    where: { id: questId, classId: student.classId },
  });

  if (!questRow) {
    return null;
  }

  const quest = mapQuest(questRow);
  const interactiveQuestions = await resolveQuestQuestions(quest);
  if (interactiveQuestions && interactiveQuestions.length > 0) {
    return { error: 'INTERACTIVE_ONLY' as const };
  }

  let progressRow = await prisma.questProgress.findUnique({
    where: {
      questId_studentId: { questId, studentId: student.id },
    },
  });

  if (!progressRow) {
    progressRow = await prisma.questProgress.create({
      data: {
        questId,
        studentId: student.id,
        currentStep: 0,
        completed: false,
      },
    });
  }

  let progress = mapQuestProgress(progressRow);

  if (progress.completed) {
    return {
      quest: await sanitizeQuest(quest),
      progress,
      xpEarned: 0,
      profile: null,
    };
  }

  const currentStep = Math.min(progress.currentStep + 1, quest.totalSteps);
  const completed = currentStep >= quest.totalSteps;

  progressRow = await prisma.questProgress.update({
    where: { id: progressRow.id },
    data: { currentStep, completed },
  });
  progress = mapQuestProgress(progressRow);

  if (completed) {
    const profile = await addXp(
      student.id,
      quest.xpReward,
      `Квест: ${quest.title}`,
    );
    return {
      quest: await sanitizeQuest(quest),
      progress,
      xpEarned: quest.xpReward,
      profile,
      message: `Квест завершено! +${quest.xpReward} XP`,
    };
  }

  return {
    quest: await sanitizeQuest(quest),
    progress,
    xpEarned: 0,
    profile: null,
    message: 'Ще один маленький крок!',
  };
};

export const getQuestForStudent = async (
  questId: string,
  student: AuthUser,
) => {
  const questRow = await prisma.quest.findFirst({
    where: { id: questId, classId: student.classId },
  });

  if (!questRow) {
    return null;
  }

  const progressRow = await prisma.questProgress.findUnique({
    where: {
      questId_studentId: { questId, studentId: student.id },
    },
  });
  const progress = progressRow ? mapQuestProgress(progressRow) : null;

  return {
    ...(await sanitizeQuest(mapQuest(questRow))),
    currentStep: progress?.currentStep ?? 0,
    completed: progress?.completed ?? false,
  };
};

export const answerQuestStep = async (
  questId: string,
  student: AuthUser,
  stepIndex: number,
  optionIndex: number,
) => {
  const questRow = await prisma.quest.findFirst({
    where: { id: questId, classId: student.classId },
  });

  if (!questRow) {
    return null;
  }

  const quest = mapQuest(questRow);
  const questions = await resolveQuestQuestions(quest);

  if (!questions || questions.length === 0) {
    return { error: 'NOT_INTERACTIVE' as const };
  }

  let progressRow = await prisma.questProgress.findUnique({
    where: {
      questId_studentId: { questId, studentId: student.id },
    },
  });

  if (!progressRow) {
    progressRow = await prisma.questProgress.create({
      data: {
        questId,
        studentId: student.id,
        currentStep: 0,
        completed: false,
      },
    });
  }

  let progress = mapQuestProgress(progressRow);

  if (progress.completed) {
    return {
      correct: true,
      progress,
      xpEarned: 0,
      profile: null,
      message: 'Квест уже завершено!',
    };
  }

  if (stepIndex !== progress.currentStep) {
    return { error: 'INVALID_STEP' as const };
  }

  const question = questions[stepIndex];

  if (!question) {
    return { error: 'INVALID_STEP' as const };
  }

  const correct = optionIndex === question.correctIndex;

  if (!correct) {
    return {
      correct: false,
      progress,
      xpEarned: 0,
      profile: null,
      message: 'Спробуй ще раз!',
    };
  }

  const currentStep = Math.min(progress.currentStep + 1, quest.totalSteps);
  const completed = currentStep >= quest.totalSteps;

  progressRow = await prisma.questProgress.update({
    where: { id: progressRow.id },
    data: { currentStep, completed },
  });
  progress = mapQuestProgress(progressRow);

  if (completed) {
    const profile = await addXp(
      student.id,
      quest.xpReward,
      `Квест: ${quest.title}`,
    );
    return {
      correct: true,
      progress,
      xpEarned: quest.xpReward,
      profile,
      message: `Квест завершено! +${quest.xpReward} XP`,
    };
  }

  return {
    correct: true,
    progress,
    xpEarned: 0,
    profile: null,
    message: 'Правильно! Ще один крок вперед!',
  };
};

export const getAchievementsForStudent = async (studentId: string) => {
  const [achievements, studentAchs] = await Promise.all([
    prisma.achievement.findMany(),
    prisma.studentAchievement.findMany({ where: { studentId } }),
  ]);

  const unlocked = new Set(studentAchs.map((item) => item.achievementId));
  const unlockedAtById = new Map(
    studentAchs.map((item) => [
      item.achievementId,
      mapStudentAchievement(item).unlockedAt,
    ]),
  );

  return achievements.map((row) => {
    const achievement = mapAchievement(row);
    const isUnlocked = unlocked.has(achievement.id);
    return {
      ...achievement,
      title: achievement.hidden && !isUnlocked ? '???' : achievement.title,
      description:
        achievement.hidden && !isUnlocked
          ? 'Секретна перемога. Ще трохи — і відкриється!'
          : achievement.description,
      icon: achievement.hidden && !isUnlocked ? '🔒' : achievement.icon,
      unlocked: isUnlocked,
      unlockedAt: unlockedAtById.get(achievement.id),
    };
  });
};

export const joinEvent = async (eventId: string, studentId: string) => {
  const row = await prisma.classEvent.findUnique({ where: { id: eventId } });

  if (!row) {
    return null;
  }

  const event = mapClassEvent(row);
  const lifecycle = getEventLifecycle(event);
  if (lifecycle === 'ended' || lifecycle === 'published') {
    throw new Error('EVENT_ENDED');
  }

  if (!event.participantIds.includes(studentId)) {
    const participantIds = [...event.participantIds, studentId];
    const progress = Math.min(100, event.progress + 10);
    const updated = await prisma.classEvent.update({
      where: { id: eventId },
      data: { participantIds, progress },
    });
    await addXp(studentId, 10, `Подія: ${event.title}`);
    return enrichEvent(mapClassEvent(updated));
  }

  return enrichEvent(event);
};

export const getEvents = async (classId: string) => {
  const rows = await prisma.classEvent.findMany({ where: { classId } });
  const events = rows
    .map(mapClassEvent)
    .sort(
      (a, b) =>
        new Date(a.startsAt ?? a.date ?? 0).getTime() -
        new Date(b.startsAt ?? b.date ?? 0).getTime(),
    );
  return Promise.all(events.map(enrichEvent));
};

export const createHomework = async (
  teacher: AuthUser,
  payload: {
    subject: Homework['subject'];
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    dueDate?: string;
    xpReward: number;
    linkedQuizId?: string;
  },
) => {
  if (!teacher.classId) {
    throw new Error('NO_CLASS');
  }

  const startsAt = payload.startsAt;
  const endsAt = payload.endsAt;

  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new Error('INVALID_RANGE');
  }

  const row = await prisma.homework.create({
    data: {
      id: createId('hw'),
      classId: teacher.classId,
      createdBy: teacher.id,
      subject: payload.subject,
      title: payload.title,
      description: payload.description,
      startsAt: new Date(startsAt),
      endsAt: new Date(endsAt),
      dueDate: new Date(endsAt),
      xpReward: payload.xpReward,
      linkedQuizId: payload.linkedQuizId,
    },
  });

  const homework = mapHomework(row);
  const studentIds = await getClassStudentIds(teacher.classId);

  if (studentIds.length > 0) {
    await prisma.notification.createMany({
      data: studentIds.map((studentId) => ({
        id: createId('notif'),
        userId: studentId,
        title: 'Нове завдання',
        body: `Учитель додав: ${homework.title}`,
        read: false,
        createdAt: new Date(),
        type: 'homework',
      })),
    });
  }

  return homework;
};

export const getHomeworkAnalytics = async (
  homeworkId: string,
  teacher: AuthUser,
) => {
  const homeworkRow = await prisma.homework.findFirst({
    where: { id: homeworkId, classId: teacher.classId },
  });

  if (!homeworkRow || !teacher.classId) {
    return null;
  }

  const homework = mapHomework(homeworkRow);
  const classRoom = await loadClassRoom(teacher.classId);
  if (!classRoom) {
    return null;
  }

  const quizRow = homework.linkedQuizId
    ? await prisma.quiz.findUnique({ where: { id: homework.linkedQuizId } })
    : null;
  const quiz = quizRow ? mapQuiz(quizRow) : null;

  const students = classRoom.studentIds.length
    ? await prisma.user.findMany({
        where: { id: { in: classRoom.studentIds } },
      })
    : [];
  const studentById = new Map(students.map((s) => [s.id, mapUser(s)]));

  const submissions = await prisma.homeworkSubmission.findMany({
    where: { homeworkId: homework.id },
  });
  const subByStudent = new Map(
    submissions.map((s) => [s.studentId, mapHomeworkSubmission(s)]),
  );

  const attempts = quiz
    ? await prisma.quizAttempt.findMany({ where: { quizId: quiz.id } })
    : [];

  const participants = classRoom.studentIds.map((studentId) => {
    const student = studentById.get(studentId);
    const submission = subByStudent.get(studentId);
    const attempt = quiz
      ? attempts
          .filter((item) => item.studentId === studentId)
          .map(mapQuizAttempt)
          .sort(
            (a, b) =>
              new Date(b.completedAt).getTime() -
              new Date(a.completedAt).getTime(),
          )[0]
      : undefined;

    const quizPercent =
      attempt && attempt.total > 0
        ? Math.round((attempt.score / attempt.total) * 100)
        : null;

    return {
      studentId,
      displayName: student?.displayName ?? 'Учень',
      avatarEmoji: student?.avatarEmoji ?? '🙂',
      avatarColor: student?.avatarColor ?? '#B8DDF5',
      status: submission?.status ?? 'not_started',
      submittedAt: submission?.submittedAt,
      answerPreview: submission?.answer?.slice(0, 120),
      quizScore: attempt?.score ?? null,
      quizTotal: attempt?.total ?? null,
      quizPercent,
      participated:
        Boolean(submission && submission.status !== 'new') || Boolean(attempt),
    };
  });

  const ranked = quiz
    ? [...participants]
        .filter((item) => item.quizPercent !== null)
        .sort((a, b) => (b.quizPercent ?? 0) - (a.quizPercent ?? 0))
        .map((item, index) => ({ ...item, rank: index + 1 }))
    : [];

  const rankedMap = new Map(ranked.map((item) => [item.studentId, item.rank]));
  const withRank = participants.map((item) => ({
    ...item,
    rank: rankedMap.get(item.studentId) ?? null,
  }));

  const completedQuiz = ranked.length;
  const averagePercent =
    completedQuiz > 0
      ? Math.round(
          ranked.reduce((sum, item) => sum + (item.quizPercent ?? 0), 0) /
            completedQuiz,
        )
      : null;

  return {
    homework: {
      ...homework,
      startsAt: homeworkStartsAt(homework),
      endsAt: homeworkEndsAt(homework),
      dueDate: homeworkEndsAt(homework),
      ended: isHomeworkEnded(homework),
      active: isHomeworkActive(homework),
      isQuizLinked: Boolean(quiz),
    },
    studentsTotal: classRoom.studentIds.length,
    participatedCount: withRank.filter((item) => item.participated).length,
    checkingCount: withRank.filter((item) => item.status === 'checking').length,
    participants: withRank.sort((a, b) => {
      if (quiz) {
        return (b.quizPercent ?? -1) - (a.quizPercent ?? -1);
      }
      if (a.participated !== b.participated) {
        return a.participated ? -1 : 1;
      }
      return a.displayName.localeCompare(b.displayName, 'uk');
    }),
    quizSummary: quiz
      ? {
          quizId: quiz.id,
          quizTitle: quiz.title,
          questionsCount: quiz.questions.length,
          completedCount: completedQuiz,
          averagePercent,
          topScorers: ranked.slice(0, 5),
        }
      : null,
  };
};

export const deleteHomework = async (
  homeworkId: string,
  teacher: AuthUser,
) => {
  const row = await prisma.homework.findFirst({
    where: { id: homeworkId, classId: teacher.classId },
  });

  if (!row) {
    return null;
  }

  const removed = mapHomework(row);
  await prisma.homeworkSubmission.deleteMany({ where: { homeworkId } });
  await prisma.homework.delete({ where: { id: homeworkId } });
  return removed;
};

export const getQuizTemplates = async (subject?: string) => {
  const rows = subject
    ? await prisma.quizTemplate.findMany({ where: { subject } })
    : await prisma.quizTemplate.findMany();
  return rows.map(mapQuizTemplate);
};

export const assignQuizFromTemplate = async (
  teacher: AuthUser,
  templateId: string,
) => {
  if (!teacher.classId) {
    throw new Error('NO_CLASS');
  }

  const templateRow = await prisma.quizTemplate.findUnique({
    where: { id: templateId },
  });

  if (!templateRow) {
    return null;
  }

  const template = mapQuizTemplate(templateRow);
  const questions = template.questions.map((question) => ({
    ...question,
    id: createId('q'),
  }));

  const row = await prisma.quiz.create({
    data: {
      id: createId('quiz'),
      classId: teacher.classId,
      subject: template.subject,
      title: template.title,
      xpReward: template.xpReward,
      templateId: template.id,
      questions,
    },
  });

  const quiz = mapQuiz(row);
  const studentIds = await getClassStudentIds(teacher.classId);

  if (studentIds.length > 0) {
    await prisma.notification.createMany({
      data: studentIds.map((studentId) => ({
        id: createId('notif'),
        userId: studentId,
        title: 'Новий тест',
        body: `Учитель додав тест: ${quiz.title}`,
        read: false,
        createdAt: new Date(),
        type: 'quiz',
      })),
    });
  }

  return quiz;
};

export const createClassQuiz = async (
  teacher: AuthUser,
  payload: {
    subject: Homework['subject'];
    title: string;
    xpReward: number;
    questions: Array<{
      text: string;
      options: string[];
      correctIndex: number;
    }>;
  },
) => {
  if (!teacher.classId) {
    throw new Error('NO_CLASS');
  }

  const questions = payload.questions.map((question) => ({
    id: createId('q'),
    ...question,
  }));

  const row = await prisma.quiz.create({
    data: {
      id: createId('quiz'),
      classId: teacher.classId,
      subject: payload.subject,
      title: payload.title,
      xpReward: payload.xpReward,
      questions,
    },
  });

  const quiz = mapQuiz(row);
  const studentIds = await getClassStudentIds(teacher.classId);

  if (studentIds.length > 0) {
    await prisma.notification.createMany({
      data: studentIds.map((studentId) => ({
        id: createId('notif'),
        userId: studentId,
        title: 'Новий тест',
        body: `Учитель додав тест: ${quiz.title}`,
        read: false,
        createdAt: new Date(),
        type: 'quiz',
      })),
    });
  }

  return quiz;
};

export const deleteQuiz = async (quizId: string, teacher: AuthUser) => {
  const row = await prisma.quiz.findFirst({
    where: { id: quizId, classId: teacher.classId },
  });

  if (!row) {
    return null;
  }

  const removed = mapQuiz(row);
  await prisma.quizAttempt.deleteMany({ where: { quizId } });
  await prisma.quiz.delete({ where: { id: quizId } });
  return removed;
};

export const getClassQuizzes = async (classId: string) => {
  const rows = await prisma.quiz.findMany({ where: { classId } });
  return rows.map(mapQuiz);
};

export const reviewSubmission = async (
  submissionId: string,
  teacher: AuthUser,
  payload: {
    decision: 'accept' | 'revise' | 'redo_test';
    comment: string;
  },
) => {
  const submissionRow = await prisma.homeworkSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submissionRow) {
    return null;
  }

  const homeworkRow = await prisma.homework.findUnique({
    where: { id: submissionRow.homeworkId },
  });

  if (!homeworkRow || homeworkRow.classId !== teacher.classId) {
    return null;
  }

  const homework = mapHomework(homeworkRow);
  let status: string = submissionRow.status;

  if (payload.decision === 'accept') {
    status = 'reviewed';
    await prisma.notification.create({
      data: {
        id: createId('notif'),
        userId: submissionRow.studentId,
        title: 'Роботу прийнято',
        body: payload.comment.trim() || `Учитель прийняв «${homework.title}»`,
        read: false,
        createdAt: new Date(),
        type: 'homework',
      },
    });
  } else if (payload.decision === 'revise') {
    status = 'revise';
    await prisma.notification.create({
      data: {
        id: createId('notif'),
        userId: submissionRow.studentId,
        title: 'Потрібно доробити',
        body:
          payload.comment.trim() ||
          `Подивись коментар і дороби «${homework.title}»`,
        read: false,
        createdAt: new Date(),
        type: 'homework',
      },
    });
  } else {
    status = 'revise';
    const quizId = homework.linkedQuizId;
    if (quizId) {
      await prisma.quizAttempt.deleteMany({
        where: { quizId, studentId: submissionRow.studentId },
      });
    }

    await prisma.notification.create({
      data: {
        id: createId('notif'),
        userId: submissionRow.studentId,
        title: 'Пройди тест ще раз',
        body:
          payload.comment.trim() ||
          `Учитель просить переробити тест до «${homework.title}»`,
        read: false,
        createdAt: new Date(),
        type: 'quiz',
      },
    });
  }

  const updated = await prisma.homeworkSubmission.update({
    where: { id: submissionId },
    data: {
      teacherComment: payload.comment.trim(),
      reviewedAt: new Date(),
      status,
    },
  });

  return mapHomeworkSubmission(updated);
};

export const deleteEvent = async (eventId: string, teacher: AuthUser) => {
  const row = await prisma.classEvent.findFirst({
    where: { id: eventId, classId: teacher.classId },
  });

  if (!row) {
    return null;
  }

  const removed = mapClassEvent(row);
  await prisma.classEvent.delete({ where: { id: eventId } });
  return removed;
};

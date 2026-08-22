import { db } from '../data/seed';
import { createId } from '../helpers/response';
import { enrichEvent, getEventLifecycle } from '../helpers/events';
import { addXp } from './student.service';
import type { AuthUser, Homework, Quiz } from '../types';

export const getLearningForStudent = (studentId: string, classId: string) => {
  const homework = db.homeworks
    .filter((item) => item.classId === classId)
    .map((hw) => {
      const submission = db.homeworkSubmissions.find(
        (sub) => sub.homeworkId === hw.id && sub.studentId === studentId,
      );
      const due = new Date(hw.dueDate).getTime();
      const now = Date.now();
      let bucket: 'today' | 'waiting' | 'later' | 'done' = 'later';

      if (submission?.status === 'revise') {
        bucket = 'waiting';
      } else if (submission && submission.status !== 'new') {
        bucket = 'done';
      } else if (due < now) {
        bucket = 'waiting';
      } else if (due - now < 1000 * 60 * 60 * 24) {
        bucket = 'today';
      }

      return {
        ...hw,
        status: submission?.status ?? 'new',
        teacherComment: submission?.teacherComment,
        bucket,
        linkedQuizId: hw.linkedQuizId,
      };
    });

  const quizzes = db.quizzes.filter((quiz) => quiz.classId === classId);
  const quests = db.quests
    .filter((quest) => quest.classId === classId)
    .map((quest) => {
      const progress = db.questProgress.find(
        (item) => item.questId === quest.id && item.studentId === studentId,
      );
      return {
        ...quest,
        currentStep: progress?.currentStep ?? 0,
        completed: progress?.completed ?? false,
      };
    });

  const materials = db.learningMaterials.filter(
    (item) => item.classId === classId,
  );

  return { homework, quizzes, quests, materials };
};

export const submitHomework = (
  homeworkId: string,
  studentId: string,
  answer: string,
) => {
  const homework = db.homeworks.find((item) => item.id === homeworkId);

  if (!homework) {
    return null;
  }

  let submission = db.homeworkSubmissions.find(
    (item) => item.homeworkId === homeworkId && item.studentId === studentId,
  );

  if (!submission) {
    submission = {
      id: createId('sub'),
      homeworkId,
      studentId,
      status: 'checking',
      answer,
      submittedAt: new Date().toISOString(),
    };
    db.homeworkSubmissions.push(submission);
    const profile = addXp(
      studentId,
      homework.xpReward,
      `Завдання: ${homework.title}`,
    );

    db.notifications.unshift({
      id: createId('notif'),
      userId: homework.createdBy,
      title: 'Нова робота',
      body: 'Учень надіслав роботу на перевірку',
      read: false,
      createdAt: new Date().toISOString(),
      type: 'homework',
    });

    return {
      submission,
      xpEarned: homework.xpReward,
      profile,
      message: `Готово! +${homework.xpReward} XP`,
    };
  }

  submission.status = 'checking';
  submission.answer = answer;
  submission.submittedAt = new Date().toISOString();
  submission.teacherComment = undefined;

  db.notifications.unshift({
    id: createId('notif'),
    userId: homework.createdBy,
    title: 'Роботу оновлено',
    body: 'Учень надіслав роботу знову',
    read: false,
    createdAt: new Date().toISOString(),
    type: 'homework',
  });

  return {
    submission,
    xpEarned: 0,
    profile: null,
    message: 'Надіслано на перевірку!',
  };
};

export const getQuizById = (quizId: string): Quiz | null => {
  return db.quizzes.find((item) => item.id === quizId) ?? null;
};

export const submitQuizAttempt = (
  quizId: string,
  studentId: string,
  answers: number[],
) => {
  const quiz = db.quizzes.find((item) => item.id === quizId);

  if (!quiz) {
    return null;
  }

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
  const profile = addXp(studentId, xpEarned, `Тест: ${quiz.title}`);

  const attempt = {
    id: createId('attempt'),
    quizId,
    studentId,
    answers,
    score,
    total: quiz.questions.length,
    xpEarned,
    completedAt: new Date().toISOString(),
  };

  db.quizAttempts.push(attempt);

  return {
    attempt,
    review,
    profile,
    message: 'Ти завершив тест!',
  };
};

export const advanceQuest = (questId: string, studentId: string) => {
  const quest = db.quests.find((item) => item.id === questId);

  if (!quest) {
    return null;
  }

  let progress = db.questProgress.find(
    (item) => item.questId === questId && item.studentId === studentId,
  );

  if (!progress) {
    progress = {
      questId,
      studentId,
      currentStep: 0,
      completed: false,
    };
    db.questProgress.push(progress);
  }

  if (progress.completed) {
    return { quest, progress, xpEarned: 0, profile: null };
  }

  progress.currentStep += 1;

  if (progress.currentStep >= quest.totalSteps) {
    progress.completed = true;
    progress.currentStep = quest.totalSteps;
    const profile = addXp(studentId, quest.xpReward, `Квест: ${quest.title}`);
    return {
      quest,
      progress,
      xpEarned: quest.xpReward,
      profile,
      message: `Квест завершено! +${quest.xpReward} XP`,
    };
  }

  return {
    quest,
    progress,
    xpEarned: 0,
    profile: null,
    message: 'Ще один маленький крок!',
  };
};

export const getAchievementsForStudent = (studentId: string) => {
  const unlocked = new Set(
    db.studentAchievements
      .filter((item) => item.studentId === studentId)
      .map((item) => item.achievementId),
  );

  return db.achievements.map((achievement) => {
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
      unlockedAt: db.studentAchievements.find(
        (item) =>
          item.studentId === studentId &&
          item.achievementId === achievement.id,
      )?.unlockedAt,
    };
  });
};

export const joinEvent = (eventId: string, studentId: string) => {
  const event = db.events.find((item) => item.id === eventId);

  if (!event) {
    return null;
  }

  const lifecycle = getEventLifecycle(event);
  if (lifecycle === 'ended' || lifecycle === 'published') {
    throw new Error('EVENT_ENDED');
  }

  if (!event.participantIds.includes(studentId)) {
    event.participantIds.push(studentId);
    event.progress = Math.min(100, event.progress + 10);
    addXp(studentId, 10, `Подія: ${event.title}`);
  }

  return enrichEvent(event);
};

export const getEvents = (classId: string) => {
  return db.events
    .filter((event) => event.classId === classId)
    .sort(
      (a, b) =>
        new Date(a.startsAt ?? a.date ?? 0).getTime() -
        new Date(b.startsAt ?? b.date ?? 0).getTime(),
    )
    .map(enrichEvent);
};

export const createHomework = (
  teacher: AuthUser,
  payload: Omit<Homework, 'id' | 'classId' | 'createdBy'>,
) => {
  if (!teacher.classId) {
    throw new Error('NO_CLASS');
  }

  const homework: Homework = {
    id: createId('hw'),
    classId: teacher.classId,
    createdBy: teacher.id,
    ...payload,
  };

  db.homeworks.unshift(homework);

  const classRoom = db.classes.find((item) => item.id === teacher.classId);
  classRoom?.studentIds.forEach((studentId) => {
    db.notifications.unshift({
      id: createId('notif'),
      userId: studentId,
      title: 'Нове завдання',
      body: `Учитель додав: ${homework.title}`,
      read: false,
      createdAt: new Date().toISOString(),
      type: 'homework',
    });
  });

  return homework;
};

export const deleteHomework = (homeworkId: string, teacher: AuthUser) => {
  const index = db.homeworks.findIndex(
    (item) => item.id === homeworkId && item.classId === teacher.classId,
  );

  if (index === -1) {
    return null;
  }

  const [removed] = db.homeworks.splice(index, 1);
  for (let i = db.homeworkSubmissions.length - 1; i >= 0; i -= 1) {
    if (db.homeworkSubmissions[i].homeworkId === homeworkId) {
      db.homeworkSubmissions.splice(i, 1);
    }
  }

  return removed;
};

export const getQuizTemplates = (subject?: string) => {
  if (!subject) {
    return db.quizTemplates;
  }

  return db.quizTemplates.filter((item) => item.subject === subject);
};

export const assignQuizFromTemplate = (
  teacher: AuthUser,
  templateId: string,
) => {
  if (!teacher.classId) {
    throw new Error('NO_CLASS');
  }

  const template = db.quizTemplates.find((item) => item.id === templateId);

  if (!template) {
    return null;
  }

  const quiz = {
    id: createId('quiz'),
    classId: teacher.classId,
    subject: template.subject,
    title: template.title,
    xpReward: template.xpReward,
    templateId: template.id,
    questions: template.questions.map((question) => ({
      ...question,
      id: createId('q'),
    })),
  };

  db.quizzes.unshift(quiz);

  const classRoom = db.classes.find((item) => item.id === teacher.classId);
  classRoom?.studentIds.forEach((studentId) => {
    db.notifications.unshift({
      id: createId('notif'),
      userId: studentId,
      title: 'Новий тест',
      body: `Учитель додав тест: ${quiz.title}`,
      read: false,
      createdAt: new Date().toISOString(),
      type: 'quiz',
    });
  });

  return quiz;
};

export const createClassQuiz = (
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

  const quiz = {
    id: createId('quiz'),
    classId: teacher.classId,
    subject: payload.subject,
    title: payload.title,
    xpReward: payload.xpReward,
    questions: payload.questions.map((question) => ({
      id: createId('q'),
      ...question,
    })),
  };

  db.quizzes.unshift(quiz);

  const classRoom = db.classes.find((item) => item.id === teacher.classId);
  classRoom?.studentIds.forEach((studentId) => {
    db.notifications.unshift({
      id: createId('notif'),
      userId: studentId,
      title: 'Новий тест',
      body: `Учитель додав тест: ${quiz.title}`,
      read: false,
      createdAt: new Date().toISOString(),
      type: 'quiz',
    });
  });

  return quiz;
};

export const deleteQuiz = (quizId: string, teacher: AuthUser) => {
  const index = db.quizzes.findIndex(
    (item) => item.id === quizId && item.classId === teacher.classId,
  );

  if (index === -1) {
    return null;
  }

  const [removed] = db.quizzes.splice(index, 1);
  for (let i = db.quizAttempts.length - 1; i >= 0; i -= 1) {
    if (db.quizAttempts[i].quizId === quizId) {
      db.quizAttempts.splice(i, 1);
    }
  }

  return removed;
};

export const getClassQuizzes = (classId: string) => {
  return db.quizzes.filter((quiz) => quiz.classId === classId);
};

export const reviewSubmission = (
  submissionId: string,
  teacher: AuthUser,
  payload: {
    decision: 'accept' | 'revise' | 'redo_test';
    comment: string;
  },
) => {
  const submission = db.homeworkSubmissions.find(
    (item) => item.id === submissionId,
  );

  if (!submission) {
    return null;
  }

  const homework = db.homeworks.find((item) => item.id === submission.homeworkId);

  if (!homework || homework.classId !== teacher.classId) {
    return null;
  }

  submission.teacherComment = payload.comment.trim();
  submission.reviewedAt = new Date().toISOString();

  if (payload.decision === 'accept') {
    submission.status = 'reviewed';
    db.notifications.unshift({
      id: createId('notif'),
      userId: submission.studentId,
      title: 'Роботу прийнято',
      body: payload.comment.trim() || `Учитель прийняв «${homework.title}»`,
      read: false,
      createdAt: new Date().toISOString(),
      type: 'homework',
    });
  } else if (payload.decision === 'revise') {
    submission.status = 'revise';
    db.notifications.unshift({
      id: createId('notif'),
      userId: submission.studentId,
      title: 'Потрібно доробити',
      body:
        payload.comment.trim() ||
        `Подивись коментар і дороби «${homework.title}»`,
      read: false,
      createdAt: new Date().toISOString(),
      type: 'homework',
    });
  } else {
    submission.status = 'revise';
    const quizId = homework.linkedQuizId;
    if (quizId) {
      for (let i = db.quizAttempts.length - 1; i >= 0; i -= 1) {
        const attempt = db.quizAttempts[i];
        if (
          attempt.quizId === quizId &&
          attempt.studentId === submission.studentId
        ) {
          db.quizAttempts.splice(i, 1);
        }
      }
    }

    db.notifications.unshift({
      id: createId('notif'),
      userId: submission.studentId,
      title: 'Пройди тест ще раз',
      body:
        payload.comment.trim() ||
        `Учитель просить переробити тест до «${homework.title}»`,
      read: false,
      createdAt: new Date().toISOString(),
      type: 'quiz',
    });
  }

  return submission;
};

export const deleteEvent = (eventId: string, teacher: AuthUser) => {
  const index = db.events.findIndex(
    (item) => item.id === eventId && item.classId === teacher.classId,
  );

  if (index === -1) {
    return null;
  }

  const [removed] = db.events.splice(index, 1);
  return removed;
};

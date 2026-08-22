import { db } from '../data/seed';
import { createId } from '../helpers/response';
import { createInviteCode, normalizeInviteCode } from './auth.service';
import { enrichEvent, eventEndsAt, eventStartsAt } from '../helpers/events';
import type { AuthUser, ClassEvent, Quest } from '../types';
import * as postsService from './posts.service';

export const getTeacherDashboard = (teacher: AuthUser) => {
  if (!teacher.classId) {
    return {
      greetingName: teacher.displayName,
      className: '',
      hasClass: false,
      today: {
        newWorks: 0,
        doneTasks: 0,
        activeQuest: 0,
        nextEventTitle: null,
        nextEventDate: null,
        nextEventEndsAt: null,
        pendingPosts: 0,
      },
      homeworks: [],
      checkingWorks: [],
      goal: null,
      recentPosts: [],
    };
  }

  const classRoom = db.classes.find((item) => item.id === teacher.classId);
  const pendingPosts = db.posts.filter(
    (post) => post.classId === teacher.classId && post.status === 'pending',
  ).length;

  const checkingWorks = db.homeworkSubmissions.filter((sub) => {
    const homework = db.homeworks.find((hw) => hw.id === sub.homeworkId);
    return homework?.classId === teacher.classId && sub.status === 'checking';
  });

  const doneToday = db.homeworkSubmissions.filter((sub) => {
    const homework = db.homeworks.find((hw) => hw.id === sub.homeworkId);
    if (!homework || homework.classId !== teacher.classId || !sub.submittedAt) {
      return false;
    }
    const submitted = new Date(sub.submittedAt);
    const now = new Date();
    return submitted.toDateString() === now.toDateString();
  }).length;

  const activeQuest = db.quests.find((quest) => quest.classId === teacher.classId);
  const nextEvent = db.events
    .filter(
      (event) =>
        event.classId === teacher.classId &&
        new Date(eventEndsAt(event)).getTime() >= Date.now() &&
        !event.publishedPostId,
    )
    .sort(
      (a, b) =>
        new Date(eventStartsAt(a)).getTime() -
        new Date(eventStartsAt(b)).getTime(),
    )[0];

  const recentPosts = db.posts
    .filter(
      (post) =>
        post.classId === teacher.classId && post.status === 'published',
    )
    .slice(0, 4)
    .map((post) => {
      const author = db.users.find((user) => user.id === post.authorId);
      return {
        ...post,
        authorName: author?.displayName ?? 'Учень',
      };
    });

  return {
    greetingName: teacher.displayName,
    className: classRoom?.name ?? '',
    hasClass: true,
    today: {
      newWorks: checkingWorks.length,
      doneTasks: doneToday,
      activeQuest: activeQuest ? 1 : 0,
      nextEventTitle: nextEvent?.title ?? null,
      nextEventDate: nextEvent ? eventStartsAt(nextEvent) : null,
      nextEventEndsAt: nextEvent ? eventEndsAt(nextEvent) : null,
      pendingPosts,
    },
    homeworks: db.homeworks.filter((hw) => hw.classId === teacher.classId),
    checkingWorks: checkingWorks.map((sub) => {
      const student = db.users.find((user) => user.id === sub.studentId);
      const homework = db.homeworks.find((hw) => hw.id === sub.homeworkId);
      return {
        ...sub,
        studentName: student?.displayName,
        homeworkTitle: homework?.title,
        linkedQuizId: homework?.linkedQuizId,
        subject: homework?.subject,
      };
    }),
    goal: classRoom
      ? {
          title: classRoom.goalTitle,
          current: classRoom.goalCurrentXp,
          target: classRoom.goalTargetXp,
        }
      : null,
    recentPosts,
  };
};

export const createQuest = (
  teacher: AuthUser,
  payload: Omit<Quest, 'id' | 'classId'>,
) => {
  if (!teacher.classId) {
    throw new Error('NO_CLASS');
  }

  const quest: Quest = {
    id: createId('quest'),
    classId: teacher.classId,
    ...payload,
  };

  db.quests.unshift(quest);
  return quest;
};

export const createEvent = (
  teacher: AuthUser,
  payload: {
    title: string;
    description: string;
    startsAt: string;
    endsAt: string;
    materials?: string[];
  },
) => {
  if (!teacher.classId) {
    throw new Error('NO_CLASS');
  }

  if (new Date(payload.endsAt).getTime() <= new Date(payload.startsAt).getTime()) {
    throw new Error('INVALID_RANGE');
  }

  const event: ClassEvent = {
    id: createId('event'),
    classId: teacher.classId,
    title: payload.title,
    description: payload.description,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    date: payload.startsAt,
    participantIds: [],
    progress: 0,
    materials: payload.materials ?? [],
  };

  db.events.unshift(event);

  const classRoom = db.classes.find((item) => item.id === teacher.classId);
  classRoom?.studentIds.forEach((studentId) => {
    db.notifications.unshift({
      id: createId('notif'),
      userId: studentId,
      title: 'Подія класу',
      body: `У класі нова подія — ${event.title}`,
      read: false,
      createdAt: new Date().toISOString(),
      type: 'event',
    });
  });

  return enrichEvent(event);
};

export const getTeacherEvents = (teacher: AuthUser) => {
  if (!teacher.classId) {
    return [];
  }

  return db.events
    .filter((event) => event.classId === teacher.classId)
    .sort(
      (a, b) =>
        new Date(eventStartsAt(b)).getTime() -
        new Date(eventStartsAt(a)).getTime(),
    )
    .map(enrichEvent);
};

export const publishEventReview = (
  teacher: AuthUser,
  eventId: string,
  payload: { comment: string; materials: string[] },
) => {
  if (!teacher.classId) {
    throw new Error('NO_CLASS');
  }

  const event = db.events.find(
    (item) => item.id === eventId && item.classId === teacher.classId,
  );

  if (!event) {
    return null;
  }

  if (new Date(eventEndsAt(event)).getTime() > Date.now()) {
    throw new Error('EVENT_NOT_ENDED');
  }

  if (event.publishedPostId) {
    throw new Error('ALREADY_PUBLISHED');
  }

  const comment = payload.comment.trim();
  if (!comment) {
    throw new Error('NO_COMMENT');
  }

  const materials = payload.materials
    .map((item) => item.trim())
    .filter(Boolean);

  event.materials = materials;
  event.reviewComment = comment;
  event.reviewedAt = new Date().toISOString();
  event.progress = 100;

  const participants = event.participantIds
    .map((id) => db.users.find((user) => user.id === id)?.displayName)
    .filter(Boolean);

  const start = new Date(eventStartsAt(event));
  const end = new Date(eventEndsAt(event));
  const rangeLabel = `${start.toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })} — ${end.toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const materialsBlock =
    materials.length > 0
      ? `\n\nМатеріали:\n${materials.map((item) => `• ${item}`).join('\n')}`
      : '';

  const participantsBlock =
    participants.length > 0
      ? `\n\nБрали участь (${participants.length}): ${participants.join(', ')}`
      : '\n\nУчасників поки не було.';

  const post = postsService.createPost(teacher, {
    text: `${comment}\n\n📅 ${event.title}\n${rangeLabel}${participantsBlock}${materialsBlock}`,
    imageEmoji: '🎉',
    category: 'подія',
  });

  event.publishedPostId = post.id;

  const classRoom = db.classes.find((item) => item.id === teacher.classId);
  classRoom?.studentIds.forEach((studentId) => {
    db.notifications.unshift({
      id: createId('notif'),
      userId: studentId,
      title: 'Підсумок події',
      body: `Учитель опублікував підсумок «${event.title}» на дошці`,
      read: false,
      createdAt: new Date().toISOString(),
      type: 'event',
    });
  });

  return {
    event: enrichEvent(event),
    post,
  };
};

export const createClassForTeacher = (
  teacher: AuthUser,
  payload: { name: string },
) => {
  if (teacher.classId) {
    const existing = db.classes.find((item) => item.id === teacher.classId);
    if (existing) {
      throw new Error('CLASS_EXISTS');
    }
  }

  const inviteCode = createInviteCode(payload.name);
  const classRoom = {
    id: createId('class'),
    schoolId: teacher.schoolId,
    name: payload.name.trim(),
    teacherId: teacher.id,
    inviteCode,
    studentIds: [] as string[],
    goalTargetXp: 1000,
    goalCurrentXp: 0,
    goalTitle: 'Разом збираємо 1000 XP',
  };

  db.classes.push(classRoom);

  const teacherUser = db.users.find((item) => item.id === teacher.id);
  if (teacherUser) {
    teacherUser.classId = classRoom.id;
  }

  return classRoom;
};

export const getTeacherInvite = (teacher: AuthUser) => {
  if (!teacher.classId) {
    return null;
  }

  const classRoom = db.classes.find((item) => item.id === teacher.classId);

  if (!classRoom) {
    return null;
  }

  // Старі коди з кирилицею ламали посилання — одразу замінюємо на латиницю
  if (classRoom.inviteCode !== normalizeInviteCode(classRoom.inviteCode)) {
    classRoom.inviteCode = createInviteCode(classRoom.name);
  }

  return {
    classId: classRoom.id,
    className: classRoom.name,
    inviteCode: classRoom.inviteCode,
    invitePath: `/join/${encodeURIComponent(classRoom.inviteCode)}`,
    studentsCount: classRoom.studentIds.length,
  };
};

export const regenerateInvite = (teacher: AuthUser) => {
  if (!teacher.classId) {
    throw new Error('NO_CLASS');
  }

  const classRoom = db.classes.find((item) => item.id === teacher.classId);

  if (!classRoom) {
    throw new Error('NO_CLASS');
  }

  classRoom.inviteCode = createInviteCode(classRoom.name);
  return getTeacherInvite(teacher);
};

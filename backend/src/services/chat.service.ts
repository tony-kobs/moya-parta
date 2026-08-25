import { prisma } from '../lib/prisma';
import {
  getClassStudentIds,
  mapChatMessage,
  mapUser,
} from '../lib/mappers';
import { createId, toPublicUser } from '../helpers/response';
import type { AuthUser, ChatMessage } from '../types';

const enrichMessage = async (message: ChatMessage) => {
  const senderRow = await prisma.user.findUnique({
    where: { id: message.senderId },
  });
  const sender = senderRow ? mapUser(senderRow) : null;

  return {
    ...message,
    sender: sender
      ? {
          id: sender.id,
          displayName: sender.displayName,
          avatarColor: sender.avatarColor,
          avatarEmoji: sender.avatarEmoji,
          role: sender.role,
        }
      : null,
  };
};

const assertSameClass = async (
  user: AuthUser,
  otherId: string,
): Promise<boolean> => {
  if (!user.classId) {
    return false;
  }

  const other = await prisma.user.findUnique({ where: { id: otherId } });

  if (!other || other.classId !== user.classId || other.schoolId !== user.schoolId) {
    return false;
  }

  return true;
};

export const getChatContacts = async (user: AuthUser) => {
  if (!user.classId) {
    return [];
  }

  const classRoom = await prisma.classRoom.findUnique({
    where: { id: user.classId },
  });

  if (!classRoom) {
    return [];
  }

  const studentIds = await getClassStudentIds(user.classId);
  const ids = new Set<string>([...studentIds, classRoom.teacherId]);
  ids.delete(user.id);

  const idList = [...ids];
  if (idList.length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({ where: { id: { in: idList } } });
  const messages = await prisma.chatMessage.findMany({
    where: {
      kind: 'direct',
      classId: user.classId,
      OR: [
        { senderId: user.id, recipientId: { in: idList } },
        { recipientId: user.id, senderId: { in: idList } },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  const contacts = await Promise.all(
    users.map(async (item) => {
      const contact = toPublicUser(mapUser(item));
      const lastRow = messages.find(
        (msg) =>
          (msg.senderId === user.id && msg.recipientId === contact.id) ||
          (msg.senderId === contact.id && msg.recipientId === user.id),
      );
      const lastMessage = lastRow
        ? await enrichMessage(mapChatMessage(lastRow))
        : null;

      return { ...contact, lastMessage };
    }),
  );

  return contacts.sort((a, b) => {
    const aTime = a.lastMessage
      ? new Date(a.lastMessage.createdAt).getTime()
      : 0;
    const bTime = b.lastMessage
      ? new Date(b.lastMessage.createdAt).getTime()
      : 0;
    return bTime - aTime;
  });
};

export const getClassChat = async (user: AuthUser) => {
  if (!user.classId) {
    return [];
  }

  const rows = await prisma.chatMessage.findMany({
    where: {
      kind: 'class',
      classId: user.classId,
      schoolId: user.schoolId,
    },
    orderBy: { createdAt: 'asc' },
  });

  return Promise.all(rows.map((row) => enrichMessage(mapChatMessage(row))));
};

export const sendClassMessage = async (user: AuthUser, text: string) => {
  if (!user.classId) {
    throw new Error('NO_CLASS');
  }

  const row = await prisma.chatMessage.create({
    data: {
      id: createId('msg'),
      classId: user.classId,
      schoolId: user.schoolId,
      kind: 'class',
      senderId: user.id,
      recipientId: null,
      text: text.trim(),
      createdAt: new Date(),
    },
  });

  return enrichMessage(mapChatMessage(row));
};

export const getDirectThread = async (user: AuthUser, otherId: string) => {
  if (!(await assertSameClass(user, otherId))) {
    return null;
  }

  const rows = await prisma.chatMessage.findMany({
    where: {
      kind: 'direct',
      classId: user.classId!,
      OR: [
        { senderId: user.id, recipientId: otherId },
        { senderId: otherId, recipientId: user.id },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  return Promise.all(rows.map((row) => enrichMessage(mapChatMessage(row))));
};

export const sendDirectMessage = async (
  user: AuthUser,
  recipientId: string,
  text: string,
) => {
  if (!user.classId) {
    throw new Error('NO_CLASS');
  }

  if (!(await assertSameClass(user, recipientId))) {
    throw new Error('NOT_CLASSMATE');
  }

  const row = await prisma.chatMessage.create({
    data: {
      id: createId('msg'),
      classId: user.classId,
      schoolId: user.schoolId,
      kind: 'direct',
      senderId: user.id,
      recipientId,
      text: text.trim(),
      createdAt: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      id: createId('notif'),
      userId: recipientId,
      title: 'Нове повідомлення',
      body: `${user.displayName} надіслав повідомлення`,
      read: false,
      createdAt: new Date(),
      type: 'chat',
    },
  });

  return enrichMessage(mapChatMessage(row));
};

import { db } from '../data/seed';
import { createId, toPublicUser } from '../helpers/response';
import type { AuthUser, ChatMessage } from '../types';

const enrichMessage = (message: ChatMessage) => {
  const sender = db.users.find((user) => user.id === message.senderId);

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

const assertSameClass = (user: AuthUser, otherId: string): boolean => {
  if (!user.classId) {
    return false;
  }

  const other = db.users.find((item) => item.id === otherId);

  if (!other || other.classId !== user.classId || other.schoolId !== user.schoolId) {
    return false;
  }

  return true;
};

export const getChatContacts = (user: AuthUser) => {
  if (!user.classId) {
    return [];
  }

  const classRoom = db.classes.find((item) => item.id === user.classId);

  if (!classRoom) {
    return [];
  }

  const ids = new Set<string>([...classRoom.studentIds, classRoom.teacherId]);
  ids.delete(user.id);

  return [...ids]
    .map((id) => db.users.find((item) => item.id === id))
    .filter(Boolean)
    .map((item) => {
      const contact = toPublicUser(item!);
      const lastMessage = db.chatMessages
        .filter(
          (msg) =>
            msg.kind === 'direct' &&
            msg.classId === user.classId &&
            ((msg.senderId === user.id && msg.recipientId === contact.id) ||
              (msg.senderId === contact.id && msg.recipientId === user.id)),
        )
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0];

      return {
        ...contact,
        lastMessage: lastMessage ? enrichMessage(lastMessage) : null,
      };
    })
    .sort((a, b) => {
      const aTime = a.lastMessage
        ? new Date(a.lastMessage.createdAt).getTime()
        : 0;
      const bTime = b.lastMessage
        ? new Date(b.lastMessage.createdAt).getTime()
        : 0;
      return bTime - aTime;
    });
};

export const getClassChat = (user: AuthUser) => {
  if (!user.classId) {
    return [];
  }

  return db.chatMessages
    .filter(
      (msg) =>
        msg.kind === 'class' &&
        msg.classId === user.classId &&
        msg.schoolId === user.schoolId,
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .map(enrichMessage);
};

export const sendClassMessage = (user: AuthUser, text: string) => {
  if (!user.classId) {
    throw new Error('NO_CLASS');
  }

  const message: ChatMessage = {
    id: createId('msg'),
    classId: user.classId,
    schoolId: user.schoolId,
    kind: 'class',
    senderId: user.id,
    recipientId: null,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };

  db.chatMessages.push(message);
  return enrichMessage(message);
};

export const getDirectThread = (user: AuthUser, otherId: string) => {
  if (!assertSameClass(user, otherId)) {
    return null;
  }

  return db.chatMessages
    .filter(
      (msg) =>
        msg.kind === 'direct' &&
        msg.classId === user.classId &&
        ((msg.senderId === user.id && msg.recipientId === otherId) ||
          (msg.senderId === otherId && msg.recipientId === user.id)),
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .map(enrichMessage);
};

export const sendDirectMessage = (
  user: AuthUser,
  recipientId: string,
  text: string,
) => {
  if (!user.classId) {
    throw new Error('NO_CLASS');
  }

  if (!assertSameClass(user, recipientId)) {
    throw new Error('NOT_CLASSMATE');
  }

  const message: ChatMessage = {
    id: createId('msg'),
    classId: user.classId,
    schoolId: user.schoolId,
    kind: 'direct',
    senderId: user.id,
    recipientId,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };

  db.chatMessages.push(message);

  db.notifications.unshift({
    id: createId('notif'),
    userId: recipientId,
    title: 'Нове повідомлення',
    body: `${user.displayName} надіслав повідомлення`,
    read: false,
    createdAt: new Date().toISOString(),
    type: 'chat',
  });

  return enrichMessage(message);
};

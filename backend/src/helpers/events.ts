import { prisma } from '../lib/prisma';
import { mapUser } from '../lib/mappers';
import { toPublicUser } from '../helpers/response';
import type { ClassEvent } from '../types';

export type EventLifecycle = 'upcoming' | 'live' | 'ended' | 'published';

export const eventStartsAt = (event: ClassEvent): string =>
  event.startsAt ?? event.date ?? new Date().toISOString();

export const eventEndsAt = (event: ClassEvent): string =>
  event.endsAt ?? event.startsAt ?? event.date ?? new Date().toISOString();

export const getEventLifecycle = (event: ClassEvent): EventLifecycle => {
  if (event.publishedPostId) {
    return 'published';
  }

  const now = Date.now();
  const start = new Date(eventStartsAt(event)).getTime();
  const end = new Date(eventEndsAt(event)).getTime();

  if (now < start) {
    return 'upcoming';
  }

  if (now <= end) {
    return 'live';
  }

  return 'ended';
};

export const enrichEvent = async (event: ClassEvent) => {
  const users = event.participantIds.length
    ? await prisma.user.findMany({
        where: { id: { in: event.participantIds } },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, mapUser(u)]));

  const participants = event.participantIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((user) => {
      const publicUser = toPublicUser(user!);
      return {
        id: publicUser.id,
        displayName: publicUser.displayName,
        avatarColor: publicUser.avatarColor,
        avatarEmoji: publicUser.avatarEmoji,
      };
    });

  return {
    ...event,
    startsAt: eventStartsAt(event),
    endsAt: eventEndsAt(event),
    date: eventStartsAt(event),
    materials: event.materials ?? [],
    status: getEventLifecycle(event),
    participants,
  };
};

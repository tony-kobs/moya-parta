import { db } from '../data/seed';
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

export const enrichEvent = (event: ClassEvent) => {
  const participants = event.participantIds
    .map((id) => db.users.find((user) => user.id === id))
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

import { Response } from 'express';
import { z } from 'zod';
import { HTTP_STATUS } from '../constants';
import { sendError, sendSuccess } from '../helpers/response';
import { AuthRequest } from '../middlewares/auth';
import * as navService from '../services/nav.service';

export const getBadges = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  sendSuccess(res, navService.getNavBadges(req.user));
};

const seenSchema = z.object({
  section: z.enum([
    'chat',
    'board',
    'learning',
    'tasks',
    'events',
    'notifications',
    'wins',
  ]),
});

export const markSeen = (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const parsed = seenSchema.safeParse(req.body);

  if (!parsed.success) {
    sendError(res, 'Невідома вкладка');
    return;
  }

  sendSuccess(res, navService.markNavSectionSeen(req.user, parsed.data.section));
};

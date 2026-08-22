import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { HTTP_STATUS } from '../constants';
import { db } from '../data/seed';
import { sendError, toPublicUser } from '../helpers/response';
import type { AuthUser, UserRole } from '../types';

export interface AuthRequest extends Request {
  user?: AuthUser;
}

interface JwtPayload {
  id: string;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    sendError(res, 'Потрібно увійти', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const token = header.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    sendError(res, 'Щось пішло не так', HTTP_STATUS.INTERNAL);
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    const user = db.users.find((item) => item.id === payload.id);

    if (!user) {
      sendError(res, 'Сесія закінчилась. Увійди знову', HTTP_STATUS.UNAUTHORIZED);
      return;
    }

    req.user = toPublicUser(user) as AuthUser;
    next();
  } catch {
    sendError(res, 'Сесія закінчилась. Увійди знову', HTTP_STATUS.UNAUTHORIZED);
  }
};

export const requireRoles = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      sendError(res, 'Ця сторінка для іншої ролі', HTTP_STATUS.FORBIDDEN);
      return;
    }
    next();
  };
};

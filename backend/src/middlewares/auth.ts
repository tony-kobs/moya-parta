import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { HTTP_STATUS } from '../constants';
import { prisma } from '../lib/prisma';
import { mapUser } from '../lib/mappers';
import { sendError, toPublicUser } from '../helpers/response';
import type { AuthUser, UserRole } from '../types';

export interface AuthRequest extends Request {
  user?: AuthUser;
}

interface JwtPayload {
  id: string;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
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
    const row = await prisma.user.findUnique({ where: { id: payload.id } });

    if (!row) {
      sendError(res, 'Сесія закінчилась. Увійди знову', HTTP_STATUS.UNAUTHORIZED);
      return;
    }

    req.user = toPublicUser(mapUser(row)) as AuthUser;
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

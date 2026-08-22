import { NextFunction, Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';
import { sendError } from '../helpers/response';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  console.error(err);
  sendError(res, 'Щось пішло не так. Спробуй ще раз', HTTP_STATUS.INTERNAL);
};

export const notFoundHandler = (_req: Request, res: Response): void => {
  sendError(res, 'Такої сторінки немає', HTTP_STATUS.NOT_FOUND);
};

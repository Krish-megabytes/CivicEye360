import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { unprocessable } from '../lib/errors.js';

export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      next(
        unprocessable(
          'Please correct the highlighted fields.',
          result.error.issues.map((issue) => ({
            field: issue.path.join('.') || 'body',
            message: issue.message,
          })),
        ),
      );
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query ?? {});
    if (!result.success) {
      next(
        unprocessable(
          'Invalid query parameters.',
          result.error.issues.map((issue) => ({
            field: issue.path.join('.') || 'query',
            message: issue.message,
          })),
        ),
      );
      return;
    }
    res.locals.validatedQuery = result.data;
    next();
  };
}

export function query<T>(res: Response): T {
  return res.locals.validatedQuery as T;
}

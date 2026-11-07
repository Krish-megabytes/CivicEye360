import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import multer from 'multer';
import mongoose from 'mongoose';
import { ApiError } from '../lib/errors.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new ApiError(404, 'NOT_FOUND', `No API endpoint matches ${req.method} ${req.path}.`));
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  const requestId = req.requestId ?? null;

  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
        requestId,
      },
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? `Images must be ${env.uploads.maxMb} MB or smaller.`
        : 'The upload could not be processed.';
    res.status(422).json({ error: { code: 'UPLOAD_ERROR', message, requestId } });
    return;
  }

  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please correct the highlighted fields.',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
        requestId,
      },
    });
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body contains invalid JSON.', requestId },
    });
    return;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Some values are invalid.',
        details: Object.entries(error.errors).map(([field, issue]) => ({
          field,
          message: issue.message,
        })),
        requestId,
      },
    });
    return;
  }

  if (error instanceof mongoose.Error.CastError) {
    res.status(400).json({
      error: { code: 'INVALID_ID', message: 'One of the identifiers is invalid.', requestId },
    });
    return;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  ) {
    res.status(409).json({
      error: {
        code: 'DUPLICATE',
        message: 'That record already exists. Check the values and try again.',
        requestId,
      },
    });
    return;
  }

  logger.error({ err: error, requestId, path: req.path, method: req.method }, 'Unhandled request error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side. Please try again.',
      ...(env.isProd ? {} : { detail: error instanceof Error ? error.message : String(error) }),
      requestId,
    },
  });
}

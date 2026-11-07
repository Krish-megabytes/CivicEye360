import { rateLimit } from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env.js';

function limiter(options: {
  windowMs: number;
  limit: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => env.rateLimitDisabled,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    validate: { xForwardedForHeader: false },
    handler: (req: Request, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: options.message,
          requestId: req.requestId ?? null,
        },
      });
    },
  });
}

export const apiLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 900,
  message: 'Too many requests from this connection. Please try again later.',
});

export const authLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: 'Too many authentication attempts. Wait a few minutes and try again.',
});

export const trackLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  message: 'Too many tracking attempts. Wait a few minutes and try again.',
});

export const aiLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: 'AI assistance is temporarily rate limited. You can continue manually.',
});

export const uploadLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 40,
  message: 'Upload limit reached for this hour. Try again later.',
});

export const exportLimiter = limiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: 'Export limit reached for this hour.',
});

export const writeLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  message: 'Too many changes in a short period. Please slow down.',
});

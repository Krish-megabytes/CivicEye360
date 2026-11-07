import type { NextFunction, Request, Response } from 'express';
import { CSRF_HEADER, CSRF_HEADER_VALUE, env } from '../config/env.js';
import { forbidden } from '../lib/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Cookie-based sessions are paired with a required custom header and an origin
 * allowlist for all state-changing requests. Combined with SameSite=Lax this
 * blocks classic CSRF without exposing tokens to JavaScript.
 */
export function sameOriginGuard(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const origin = req.get('origin');
  if (origin && !env.allowedOrigins.includes(origin)) {
    next(forbidden('Request origin is not allowed.'));
    return;
  }

  if (req.get(CSRF_HEADER) !== CSRF_HEADER_VALUE) {
    next(forbidden('Missing request verification header.'));
    return;
  }

  next();
}

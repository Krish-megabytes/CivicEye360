import type { NextFunction, Request, Response } from 'express';
import { SESSION_COOKIE } from '../config/env.js';
import { User } from '../models/User.js';
import { verifySessionToken } from '../auth/tokens.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { can, type Permission } from '../auth/permissions.js';

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const cookieToken = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const bearer = req.get('authorization')?.startsWith('Bearer ')
    ? req.get('authorization')!.slice(7).trim()
    : undefined;
  const token = cookieToken || bearer;
  if (!token) {
    next(unauthorized());
    return;
  }

  const claims = verifySessionToken(token);
  if (!claims) {
    next(unauthorized('Your session has expired. Please sign in again.'));
    return;
  }

  const user = await User.findById(claims.sub).select('+tokenVersion').lean();
  if (!user || !user.active) {
    next(unauthorized('This account is not available. Contact your administrator.'));
    return;
  }
  if (user.tokenVersion !== claims.tv) {
    next(unauthorized('Your session has expired. Please sign in again.'));
    return;
  }

  req.user = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    departmentIds: (user.departmentIds ?? []).map(String),
  };
  next();
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(unauthorized());
      return;
    }
    if (!can(req.user.role, permission)) {
      next(forbidden());
      return;
    }
    next();
  };
}

export function requireStaff(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(unauthorized());
    return;
  }
  if (req.user.role === 'citizen') {
    next(forbidden('This area is available to municipal staff.'));
    return;
  }
  next();
}

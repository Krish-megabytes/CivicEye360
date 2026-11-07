import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { SESSION_COOKIE, env } from '../config/env.js';
import type { Role } from '../domain/constants.js';
import type { CookieOptions } from 'express';

export interface SessionClaims extends JwtPayload {
  sub: string;
  role: Role;
  tv: number;
}

export function signSessionToken(user: { id: string; role: Role; tokenVersion: number }): string {
  return jwt.sign({ role: user.role, tv: user.tokenVersion }, env.jwtSecret, {
    subject: user.id,
    expiresIn: `${env.sessionTtlHours}h`,
    issuer: 'civiceye360',
    audience: 'civiceye360-web',
  });
}

export function verifySessionToken(token: string): SessionClaims | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret, {
      issuer: 'civiceye360',
      audience: 'civiceye360-web',
    });
    if (typeof payload === 'string' || !payload.sub) return null;
    return payload as SessionClaims;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    path: '/',
    maxAge: env.sessionTtlHours * 60 * 60 * 1000,
  };
}

export function clearSessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    path: '/',
  };
}

export const sessionCookieName = SESSION_COOKIE;

/**
 * Guest tracking codes are derived from the report reference and a server-only
 * key. They cannot be guessed from the sequential reference ID, can be shown
 * to the owner again, and are not stored in the database.
 */
function trackingKey(): Buffer {
  return createHmac('sha256', 'civiceye-tracking-v1').update(env.jwtSecret).digest();
}

const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function deriveTrackingCode(reportId: string): string {
  const digest = createHmac('sha256', trackingKey()).update(reportId).digest();
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of digest) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5 && output.length < 16) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return output.match(/.{1,4}/g)?.join('-') ?? output;
}

export function verifyTrackingCode(reportId: string, code: string): boolean {
  const expected = deriveTrackingCode(reportId);
  const normalize = (input: string) => input.replace(/[^0-9A-Z]/gi, '').toUpperCase();
  const a = Buffer.from(normalize(expected));
  const b = Buffer.from(normalize(code));
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export function createPasswordResetToken(): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(token).digest('hex');
  return { token, hash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) };
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

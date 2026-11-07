import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

const rounds = env.isTest ? 4 : env.isProd ? 12 : 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, rounds);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface PasswordCheck {
  valid: boolean;
  problems: string[];
}

/** Minimum 10 characters, at least one letter and one number. */
export function checkPasswordPolicy(password: string): PasswordCheck {
  const problems: string[] = [];
  if (password.length < 10) problems.push('Use at least 10 characters.');
  if (!/[A-Za-z]/.test(password)) problems.push('Include at least one letter.');
  if (!/[0-9]/.test(password)) problems.push('Include at least one number.');
  if (password.length > 128) problems.push('Use 128 characters or fewer.');
  return { valid: problems.length === 0, problems };
}

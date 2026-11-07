import type { Request, Response } from 'express';
import { env, SESSION_COOKIE } from '../config/env.js';
import { User } from '../models/User.js';
import { checkPasswordPolicy, hashPassword, verifyPassword } from '../auth/passwords.js';
import {
  clearSessionCookieOptions,
  createPasswordResetToken,
  hashResetToken,
  sessionCookieOptions,
  signSessionToken,
} from '../auth/tokens.js';
import { audit } from '../services/auditService.js';
import { emailConfigured, sendEmail } from '../services/emailService.js';
import { loadUserView } from '../services/userService.js';
import { conflict, unauthorized, unprocessable } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

function setSessionCookie(res: Response, user: { id: string; role: string; tokenVersion: number }) {
  const token = signSessionToken({
    id: user.id,
    role: user.role as never,
    tokenVersion: user.tokenVersion,
  });
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body as { name: string; email: string; password: string };
  const existing = await User.findOne({ email }).lean();
  if (existing) {
    throw conflict('An account with this email already exists. Try signing in instead.');
  }

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    name,
    email,
    passwordHash,
    role: 'citizen',
    departmentIds: [],
    notificationPreferences: { inApp: true, email: false },
    active: true,
    tokenVersion: 0,
  });

  await audit({
    actorId: String(user._id),
    actorRole: 'citizen',
    action: 'auth.registered',
    entityType: 'User',
    entityId: String(user._id),
    req,
  });

  setSessionCookie(res, {
    id: String(user._id),
    role: user.role,
    tokenVersion: user.tokenVersion,
  });
  res.status(201).json({ data: await loadUserView(String(user._id)) });
}

export async function registerNgo(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body as { name: string; email: string; password: string };
  if (await User.findOne({ email }).lean()) throw conflict('An account with this email already exists. Try signing in instead.');
  const user = await User.create({ name, email, passwordHash: await hashPassword(password), role: 'ngo', departmentIds: [], notificationPreferences: { inApp: true, email: false }, active: true, tokenVersion: 0 });
  await audit({ actorId: String(user._id), actorRole: 'ngo', action: 'auth.ngo_registered', entityType: 'User', entityId: String(user._id), req });
  setSessionCookie(res, { id: String(user._id), role: user.role, tokenVersion: user.tokenVersion });
  res.status(201).json({ data: await loadUserView(String(user._id)) });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion');
  if (!user || !user.active) {
    throw unauthorized('Email or password is incorrect.');
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw unauthorized('Email or password is incorrect.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  setSessionCookie(res, {
    id: String(user._id),
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  await audit({
    actorId: String(user._id),
    actorRole: user.role,
    action: 'auth.login',
    entityType: 'User',
    entityId: String(user._id),
    req,
  });

  res.json({ data: await loadUserView(String(user._id)) });
}

export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie(SESSION_COOKIE, clearSessionCookieOptions());
  if (req.user) {
    await audit({
      action: 'auth.logout',
      entityType: 'User',
      entityId: req.user.id,
      req,
    });
  }
  res.status(204).end();
}

export async function me(req: Request, res: Response): Promise<void> {
  res.json({ data: await loadUserView(req.user!.id) });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email: string };
  const user = await User.findOne({ email, active: true });
  const configured = emailConfigured();
  let devResetUrl: string | undefined;

  if (user) {
    const reset = createPasswordResetToken();
    user.passwordResetTokenHash = reset.hash;
    user.passwordResetExpiresAt = reset.expiresAt;
    await user.save();

    const origin = env.allowedOrigins[0] ?? 'http://localhost:5199';
    const resetUrl = `${origin}/reset-password?token=${reset.token}`;

    if (configured) {
      await sendEmail({
        to: user.email,
        subject: 'Reset your CivicEye 360 password',
        text: `Use this single-use link within one hour to reset your password:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      });
    } else if (!env.isProd) {
      devResetUrl = resetUrl;
      logger.info({ userId: String(user._id) }, 'Password reset link generated in development (email not configured)');
    }
  }

  res.json({
    data: {
      message:
        'If an active account matches that email, a password reset link has been prepared. Reset links expire after one hour.',
      emailConfigured: configured,
      ...(devResetUrl ? { devResetUrl } : {}),
    },
  });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = req.body as { token: string; password: string };
  const hash = hashResetToken(token);
  const user = await User.findOne({
    passwordResetTokenHash: hash,
    passwordResetExpiresAt: { $gt: new Date() },
    active: true,
  }).select('+passwordHash +passwordResetTokenHash +passwordResetExpiresAt +tokenVersion');

  if (!user) {
    throw unprocessable('This reset link is invalid or has expired.');
  }

  const policy = checkPasswordPolicy(password);
  if (!policy.valid) throw unprocessable(policy.problems.join(' '));

  user.passwordHash = await hashPassword(password);
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  user.tokenVersion += 1;
  await user.save();

  setSessionCookie(res, {
    id: String(user._id),
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  await audit({
    actorId: String(user._id),
    actorRole: user.role,
    action: 'auth.password_reset',
    entityType: 'User',
    entityId: String(user._id),
    req,
  });

  res.json({ data: { message: 'Your password has been reset. You are now signed in.' } });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body as {
    currentPassword: string;
    newPassword: string;
  };
  const user = await User.findById(req.user!.id).select('+passwordHash +tokenVersion');
  if (!user) throw unauthorized();
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw unprocessable('Your current password is incorrect.');

  const policy = checkPasswordPolicy(newPassword);
  if (!policy.valid) throw unprocessable(policy.problems.join(' '));
  if (currentPassword === newPassword) {
    throw unprocessable('Choose a password different from your current one.');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.tokenVersion += 1;
  await user.save();

  setSessionCookie(res, {
    id: String(user._id),
    role: user.role,
    tokenVersion: user.tokenVersion,
  });

  await audit({
    action: 'auth.password_changed',
    entityType: 'User',
    entityId: String(user._id),
    req,
  });

  res.json({ data: { message: 'Password changed. Other sessions have been signed out.' } });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const input = req.body as {
    name?: string;
    notificationPreferences?: { inApp?: boolean; email?: boolean };
  };
  const user = await User.findById(req.user!.id);
  if (!user) throw unauthorized();

  if (input.name) user.name = input.name;
  if (input.notificationPreferences) {
    user.notificationPreferences = {
      inApp: input.notificationPreferences.inApp ?? user.notificationPreferences.inApp,
      email: input.notificationPreferences.email ?? user.notificationPreferences.email,
    };
  }
  await user.save();

  await audit({
    action: 'user.profile_updated',
    entityType: 'User',
    entityId: String(user._id),
    metadata: { nameChanged: Boolean(input.name) },
    req,
  });

  res.json({ data: await loadUserView(String(user._id)) });
}

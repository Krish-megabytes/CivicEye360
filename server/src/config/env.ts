import { randomBytes } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { z } from 'zod';

const candidates = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '../.env')];
for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate, override: false, quiet: true });
    break;
  }
}

const booleanFromEnv = (fallback: boolean) =>
  z.preprocess((value) => {
    if (value === undefined || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
  }, z.boolean());

const numberFromEnv = (fallback: number) =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.coerce.number().default(fallback),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: numberFromEnv(4000).pipe(z.number().int().min(0)),
  CLIENT_ORIGIN: z.string().default('http://localhost:5199'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/civiceye360'),
  JWT_SECRET: z.string().optional(),
  SESSION_TTL_HOURS: numberFromEnv(12).pipe(z.number().positive()),
  COOKIE_SECURE: booleanFromEnv(false),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  AI_TIMEOUT_MS: numberFromEnv(8000).pipe(z.number().int().positive()),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: numberFromEnv(587).pipe(z.number().int().positive()),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('CivicEye 360 <no-reply@civiceye.local>'),
  SMTP_SECURE: booleanFromEnv(false),
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: numberFromEnv(5).pipe(z.number().positive()),
  LOG_LEVEL: z.string().default('info'),
  RATE_LIMIT_DISABLED: booleanFromEnv(false),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const raw = parsed.data;
const isProd = raw.NODE_ENV === 'production';
const isTest = raw.NODE_ENV === 'test';

let jwtSecret = raw.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  if (isProd) {
    throw new Error('JWT_SECRET must be set to at least 32 characters in production.');
  }
  jwtSecret = randomBytes(48).toString('hex');
  if (!isTest) {
    // eslint-disable-next-line no-console
    console.warn('[config] JWT_SECRET missing or too short — using an ephemeral development secret.');
  }
}

const uploadDir = path.resolve(process.cwd(), raw.UPLOAD_DIR);
if (!isTest) fs.mkdirSync(uploadDir, { recursive: true });

const allowedOrigins = raw.CLIENT_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (!isProd) {
  allowedOrigins.push(
    'http://localhost:4000',
    'http://127.0.0.1:4000',
    'http://localhost:5199',
    'http://127.0.0.1:5199',
  );
}

export const env = Object.freeze({
  nodeEnv: raw.NODE_ENV,
  isProd,
  isTest,
  isDev: raw.NODE_ENV === 'development',
  host: raw.HOST,
  port: raw.PORT > 0 ? raw.PORT : 4000,
  allowedOrigins,
  mongoUri: raw.MONGODB_URI,
  jwtSecret,
  sessionTtlHours: raw.SESSION_TTL_HOURS,
  cookieSecure: raw.COOKIE_SECURE || isProd,
  openai: {
    apiKey: raw.OPENAI_API_KEY || '',
    model: raw.OPENAI_MODEL,
    timeoutMs: raw.AI_TIMEOUT_MS,
    configured: Boolean(raw.OPENAI_API_KEY),
  },
  smtp: {
    host: raw.SMTP_HOST || '',
    port: raw.SMTP_PORT,
    user: raw.SMTP_USER || '',
    pass: raw.SMTP_PASS || '',
    from: raw.SMTP_FROM,
    secure: raw.SMTP_SECURE,
    configured: Boolean(raw.SMTP_HOST),
  },
  uploads: {
    dir: uploadDir,
    maxBytes: Math.round(raw.MAX_UPLOAD_MB * 1024 * 1024),
    maxMb: raw.MAX_UPLOAD_MB,
  },
  logLevel: isTest ? 'silent' : raw.LOG_LEVEL,
  rateLimitDisabled: raw.RATE_LIMIT_DISABLED || isTest,
  version: process.env.npm_package_version || '2.0.0',
});

export const SESSION_COOKIE = 'civiceye_session';
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'CivicEye360';

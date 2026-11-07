import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { sameOriginGuard } from './middleware/security.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './routes/authRoutes.js';
import { reportsRouter } from './routes/reportsRoutes.js';
import { attachmentsRouter } from './routes/attachmentsRoutes.js';
import { notificationsRouter } from './routes/notificationsRoutes.js';
import { aiRouter } from './routes/aiRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { publicRouter } from './routes/publicRoutes.js';
import { ngoRouter } from './routes/ngoRoutes.js';
import { notFound } from './lib/errors.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.isProd ? 1 : false);

  const httpLogger = pinoHttp({
    logger,
    genReqId: (req, res) => {
      const supplied = req.headers['x-request-id'];
      const id =
        typeof supplied === 'string' && supplied.length > 0 && supplied.length <= 80
          ? supplied
          : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    autoLogging: { ignore: (req) => req.url === '/api/health' },
    customLogLevel: (_req, res, err) =>
      err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
  });
  app.use(httpLogger);
  app.use((req, _res, next) => {
    req.requestId = String(req.id ?? '');
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://*.tile.openstreetmap.org',
            'https://tile.openstreetmap.org',
          ],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: env.isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin not allowed'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'Content-Disposition'],
      maxAge: 600,
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  app.use('/api', sameOriginGuard);
  app.use('/api', apiLimiter);

  app.use('/api', publicRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/attachments', attachmentsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/ngo', ngoRouter);

  app.get('/', (_req, res) => {
    res.json({
      name: 'CivicEye 360 API',
      version: env.version,
      health: '/api/health',
      docs: '/docs/API.md',
    });
  });

  app.use('/api', notFoundHandler);

  const clientDistCandidates = [
    path.resolve(process.cwd(), '../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(import.meta.dirname, '../../client/dist'),
  ];
  const clientDist = clientDistCandidates.find((candidate) =>
    fs.existsSync(path.join(candidate, 'index.html')),
  );
  if (clientDist) {
    app.use(
      express.static(clientDist, {
        index: false,
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) {
        next();
        return;
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    app.use((req, _res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        next(notFound('The web client build was not found. Run the Vite dev server or build the client.'));
        return;
      }
      next();
    });
  }

  app.use((_req, _res, next) => next(notFound()));
  app.use(errorHandler);

  return app;
}

import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { classify, duplicateHints, summarize } from '../controllers/aiController.js';
import {
  classifySchema,
  duplicateHintSchema,
  summarizeSchema,
} from '../validation/schemas.js';

export const aiRouter = Router();
aiRouter.use(authenticate, aiLimiter);

aiRouter.post('/classify-report', validateBody(classifySchema), classify);
aiRouter.post(
  '/duplicate-hints',
  requirePermission('reports.triage'),
  validateBody(duplicateHintSchema),
  duplicateHints,
);
aiRouter.post('/summarize-report', validateBody(summarizeSchema), summarize);

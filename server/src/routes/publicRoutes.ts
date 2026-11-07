import { Router } from 'express';
import { categories, health, publicConfig, track } from '../controllers/publicController.js';
import { validateBody } from '../middleware/validate.js';
import { trackLimiter } from '../middleware/rateLimit.js';
import { trackSchema } from '../validation/schemas.js';

export const publicRouter = Router();

publicRouter.get('/health', health);
publicRouter.get('/categories', categories);
publicRouter.get('/public-config', publicConfig);
publicRouter.post('/track', trackLimiter, validateBody(trackSchema), track);

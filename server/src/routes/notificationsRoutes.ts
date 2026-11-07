import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  getPreferences,
  list,
  markAllRead,
  markRead,
  updatePreferences,
} from '../controllers/notificationsController.js';
import {
  notificationPreferencesSchema,
  notificationQuerySchema,
} from '../validation/schemas.js';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get('/', validateQuery(notificationQuerySchema), list);
notificationsRouter.patch('/read-all', markAllRead);
notificationsRouter.patch('/:notificationId/read', markRead);
notificationsRouter.get('/preferences', getPreferences);
notificationsRouter.patch(
  '/preferences',
  validateBody(notificationPreferencesSchema),
  updatePreferences,
);

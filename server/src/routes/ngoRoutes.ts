import { Router } from 'express';
import { authenticate, requireStaff } from '../middleware/auth.js';
import { imageUpload } from '../middleware/upload.js';
import { uploadLimiter, writeLimiter } from '../middleware/rateLimit.js';
import { validateBody } from '../middleware/validate.js';
import { ngoClaimSchema, ngoReviewSchema, ngoSubmitSchema } from '../validation/schemas.js';
import { leaderboard, ngoClaim, ngoRelease, ngoSubmit, ngoTasks, ngoUpload, reviewTask, reviewTasks } from '../controllers/ngoController.js';

export const ngoRouter = Router();
ngoRouter.use(authenticate);
ngoRouter.get('/leaderboard', leaderboard);
ngoRouter.get('/tasks', ngoTasks);
ngoRouter.post('/tasks/claim', writeLimiter, validateBody(ngoClaimSchema), ngoClaim);
ngoRouter.post('/tasks/:taskId/evidence', uploadLimiter, imageUpload, ngoUpload);
ngoRouter.post('/tasks/:taskId/release', writeLimiter, ngoRelease);
ngoRouter.post('/tasks/:taskId/submit', writeLimiter, validateBody(ngoSubmitSchema), ngoSubmit);
ngoRouter.get('/admin/review', requireStaff, reviewTasks);
ngoRouter.post('/admin/review/:taskId', requireStaff, writeLimiter, validateBody(ngoReviewSchema), reviewTask);

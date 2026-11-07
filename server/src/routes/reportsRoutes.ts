import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { imageUpload } from '../middleware/upload.js';
import { uploadLimiter, writeLimiter } from '../middleware/rateLimit.js';
import {
  assign,
  comment,
  create,
  detail,
  feedback,
  list,
  moderate,
  myReports,
  reopenRequest,
  resolve,
  summary,
  updateCategory,
  updatePriority,
  updateStatus,
  uploadAttachment,
} from '../controllers/reportsController.js';
import {
  assignmentSchema,
  categoryUpdateSchema,
  commentSchema,
  createReportSchema,
  feedbackSchema,
  listQuerySchema,
  moderationSchema,
  priorityUpdateSchema,
  reopenSchema,
  resolutionSchema,
  statusUpdateSchema,
} from '../validation/schemas.js';

export const reportsRouter = Router();
reportsRouter.use(authenticate);

reportsRouter.post(
  '/',
  requirePermission('reports.create'),
  writeLimiter,
  validateBody(createReportSchema),
  create,
);
reportsRouter.get('/my', validateQuery(listQuerySchema), myReports);
reportsRouter.get('/summary', summary);
reportsRouter.get('/', validateQuery(listQuerySchema), list);
reportsRouter.get('/:reportId', detail);

reportsRouter.patch(
  '/:reportId/status',
  validateBody(statusUpdateSchema),
  updateStatus,
);
reportsRouter.post(
  '/:reportId/resolution',
  validateBody(resolutionSchema),
  resolve,
);
reportsRouter.patch(
  '/:reportId/assignment',
  validateBody(assignmentSchema),
  assign,
);
reportsRouter.patch(
  '/:reportId/category',
  validateBody(categoryUpdateSchema),
  updateCategory,
);
reportsRouter.patch(
  '/:reportId/priority',
  validateBody(priorityUpdateSchema),
  updatePriority,
);
reportsRouter.patch(
  '/:reportId/moderation',
  validateBody(moderationSchema),
  moderate,
);
reportsRouter.post(
  '/:reportId/comments',
  writeLimiter,
  validateBody(commentSchema),
  comment,
);
reportsRouter.post(
  '/:reportId/feedback',
  validateBody(feedbackSchema),
  feedback,
);
reportsRouter.post(
  '/:reportId/reopen-request',
  writeLimiter,
  validateBody(reopenSchema),
  reopenRequest,
);
reportsRouter.post(
  '/:reportId/attachments',
  uploadLimiter,
  imageUpload,
  uploadAttachment,
);

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { download } from '../controllers/attachmentsController.js';

export const attachmentsRouter = Router();
attachmentsRouter.get('/:attachmentId', authenticate, download);

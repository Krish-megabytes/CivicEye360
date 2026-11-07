import type { Request, Response } from 'express';
import { resolveAttachmentForViewer } from '../services/storageService.js';

export async function download(req: Request, res: Response): Promise<void> {
  const { attachment, absolutePath } = await resolveAttachmentForViewer(
    req.params.attachmentId as string,
    req.user!,
  );
  const safeFilename = attachment.originalName.replace(/[^\w.\- ]/g, '_');
  res.setHeader('Content-Type', attachment.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
  );
  res.sendFile(absolutePath);
}

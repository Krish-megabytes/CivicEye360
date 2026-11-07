import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { Request } from 'express';
import type { AuthUser } from '../types/auth.js';
import { env } from '../config/env.js';
import { ALLOWED_IMAGE_TYPES, OPEN_STATUSES, type AttachmentVisibility } from '../domain/constants.js';
import { Attachment } from '../models/Attachment.js';
import { Report } from '../models/Report.js';
import { conflict, notFound, unprocessable } from '../lib/errors.js';
import type { LeanAttachment, LeanReport } from './reportSerializer.js';
import { canAccessReport } from './reportService.js';
import { audit } from './auditService.js';

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const EXTENSION_BY_TYPE: Record<(typeof ALLOWED_IMAGE_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function detectImageType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export function sanitizeOriginalName(name: string): string {
  const base = path.basename(name).replace(/[\u0000-\u001f<>:"/\\|?*]/g, '').trim();
  return (base || 'attachment').slice(0, 120);
}

export function validateUploadedImage(file: UploadedFile): {
  mimeType: string;
  extension: string;
  originalName: string;
} {
  if (!file.buffer?.length) throw unprocessable('The uploaded file is empty.');
  if (file.size > env.uploads.maxBytes) {
    throw unprocessable(`Images must be ${env.uploads.maxMb} MB or smaller.`);
  }
  const detected = detectImageType(file.buffer);
  if (!detected || !ALLOWED_IMAGE_TYPES.includes(detected as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw unprocessable('Only JPEG, PNG or WebP images are accepted.');
  }
  if (file.mimetype !== detected) {
    throw unprocessable('The file contents do not match the declared image type.');
  }
  return {
    mimeType: detected,
    extension: EXTENSION_BY_TYPE[detected as (typeof ALLOWED_IMAGE_TYPES)[number]],
    originalName: sanitizeOriginalName(file.originalname),
  };
}

export async function saveReportAttachment(params: {
  actor: AuthUser;
  report: LeanReport;
  file: UploadedFile;
  visibility: AttachmentVisibility;
  req?: Request;
}): Promise<LeanAttachment> {
  const { actor, report, file, req } = params;

  const isOwner = String(report.reporterId) === actor.id;
  if (actor.role === 'ngo') {
    const { NGOTask } = await import('../models/NGOTask.js');
    const task = await NGOTask.findOne({ reportId: report._id, ngoId: actor.id, status: { $in: ['claimed', 'rejected'] } });
    if (!task) throw notFound('Task not found.');
    const validated = validateUploadedImage(file);
    const storageKey = `${report.reportId}-${randomUUID()}.${validated.extension}`;
    const absolutePath = path.join(env.uploads.dir, storageKey);
    await fs.mkdir(env.uploads.dir, { recursive: true });
    await fs.writeFile(absolutePath, file.buffer, { mode: 0o600 });
    const attachment = await Attachment.create({ reportId: report._id, storageKey, originalName: validated.originalName, mimeType: validated.mimeType, size: file.size, uploadedBy: actor.id, visibility: 'internal' });
    await Report.updateOne({ _id: report._id }, { $push: { attachmentIds: attachment._id } });
    return attachment.toObject() as LeanAttachment;
  }
  const isStaff = actor.role !== 'citizen';
  const assignee =
    actor.role === 'field_staff' && String(report.assignedTo ?? '') === actor.id;

  if (!isOwner && !isStaff) throw notFound('Report not found.');
  if (actor.role === 'field_staff' && !assignee) throw notFound('Report not found.');
  if (
    actor.role === 'department_manager' &&
    (!report.departmentId || !actor.departmentIds.includes(String(report.departmentId)))
  ) {
    throw notFound('Report not found.');
  }

  if (isStaff && !OPEN_STATUSES.includes(report.status)) {
    throw conflict('Evidence can only be added while the report is open.');
  }
  if (isOwner && ['Closed', 'Rejected'].includes(report.status)) {
    throw conflict('This report no longer accepts new information.');
  }
  if ((report.attachmentIds?.length ?? 0) >= 8) {
    throw conflict('A report can have at most 8 attachments.');
  }

  const validated = validateUploadedImage(file);
  const storageKey = `${report.reportId}-${randomUUID()}.${validated.extension}`;
  const absolutePath = path.join(env.uploads.dir, storageKey);
  if (!absolutePath.startsWith(path.resolve(env.uploads.dir))) {
    throw unprocessable('Invalid storage path.');
  }

  await fs.mkdir(env.uploads.dir, { recursive: true });
  await fs.writeFile(absolutePath, file.buffer, { mode: 0o600 });

  const visibility = isOwner ? 'citizen' : params.visibility;

  const attachment = await Attachment.create({
    reportId: report._id,
    storageKey,
    originalName: validated.originalName,
    mimeType: validated.mimeType,
    size: file.size,
    uploadedBy: actor.id,
    visibility,
  });

  await Report.updateOne({ _id: report._id }, { $push: { attachmentIds: attachment._id } });

  await audit({
    action: 'report.attachment_uploaded',
    entityType: 'Report',
    entityId: report.reportId,
    metadata: { attachmentId: String(attachment._id), visibility },
    req,
  });

  return attachment.toObject() as LeanAttachment;
}

export async function resolveAttachmentForViewer(
  attachmentId: string,
  actor: AuthUser,
): Promise<{ attachment: LeanAttachment; absolutePath: string }> {
  const attachment = await Attachment.findById(attachmentId).lean<LeanAttachment>();
  if (!attachment) throw notFound('Attachment not found.');
  const report = await Report.findById(attachment.reportId).lean<LeanReport>();
  if (!report || (actor.role !== 'ngo' && !canAccessReport(report, actor))) throw notFound('Attachment not found.');
  if (actor.role === 'ngo') {
    const { NGOTask } = await import('../models/NGOTask.js');
    const task = await NGOTask.findOne({ reportId: report._id, ngoId: actor.id, evidenceIds: attachment._id }).lean();
    if (!task) throw notFound('Attachment not found.');
  }
  if (actor.role === 'citizen' && attachment.visibility === 'internal') {
    throw notFound('Attachment not found.');
  }

  const absolutePath = path.resolve(env.uploads.dir, attachment.storageKey);
  if (!absolutePath.startsWith(path.resolve(env.uploads.dir))) {
    throw notFound('Attachment not found.');
  }
  try {
    await fs.access(absolutePath);
  } catch {
    throw notFound('Attachment file is unavailable.');
  }
  return { attachment, absolutePath };
}

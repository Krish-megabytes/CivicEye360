import type { Request } from 'express';
import { AuditLog } from '../models/AuditLog.js';
import { logger } from '../lib/logger.js';

export interface AuditInput {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  req?: Request;
}

/** Audit writes are best-effort: a logging failure must not undo the action. */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await AuditLog.create({
      actorId: input.actorId ?? input.req?.user?.id ?? null,
      actorRole: input.actorRole ?? input.req?.user?.role ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
      requestId: input.req?.requestId ?? null,
      ip: input.req?.ip ?? null,
    });
  } catch (error) {
    logger.error({ err: error, action: input.action }, 'Audit log write failed');
  }
}

import { Schema, model, type Types } from 'mongoose';

export interface AuditLogAttrs {
  actorId: Types.ObjectId | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  requestId?: string | null;
  ip?: string | null;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogAttrs>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: null },
    action: { type: String, required: true, maxlength: 80 },
    entityType: { type: String, required: true, maxlength: 60 },
    entityId: { type: String, default: null, maxlength: 120 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    requestId: { type: String, default: null, maxlength: 80 },
    ip: { type: String, default: null, maxlength: 60 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = model<AuditLogAttrs>('AuditLog', auditLogSchema);

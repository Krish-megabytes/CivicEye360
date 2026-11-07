import { Schema, model, type Types } from 'mongoose';
import { REPORT_STATUSES, VISIBILITIES, type ReportStatus, type Visibility } from '../domain/constants.js';

export interface StatusHistoryAttrs {
  reportId: Types.ObjectId;
  fromStatus: ReportStatus | null;
  toStatus: ReportStatus;
  actorId: Types.ObjectId;
  visibility: Visibility;
  note?: string | null;
  reason?: string | null;
  createdAt: Date;
}

const statusHistorySchema = new Schema<StatusHistoryAttrs>(
  {
    reportId: { type: Schema.Types.ObjectId, ref: 'Report', required: true },
    fromStatus: { type: String, enum: [...REPORT_STATUSES, null], default: null },
    toStatus: { type: String, enum: REPORT_STATUSES, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    visibility: { type: String, enum: VISIBILITIES, default: 'citizen' },
    note: { type: String, default: null, maxlength: 2000 },
    reason: { type: String, default: null, maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

statusHistorySchema.index({ reportId: 1, createdAt: 1 });

export const StatusHistory = model<StatusHistoryAttrs>('StatusHistory', statusHistorySchema);

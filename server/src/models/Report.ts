import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  AI_SOURCES,
  PRIORITIES,
  REPORT_STATUSES,
  type AiSource,
  type Priority,
  type ReportStatus,
} from '../domain/constants.js';

export interface ReportLocation {
  address: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ReportAttrs {
  reportId: string;
  reporterId: Types.ObjectId;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: ReportStatus;
  location: ReportLocation;
  geo?: { type: 'Point'; coordinates: [number, number] } | null;
  attachmentIds: Types.ObjectId[];
  departmentId?: Types.ObjectId | null;
  assignedTo?: Types.ObjectId | null;
  assignedAt?: Date | null;
  firstAssignedAt?: Date | null;
  dueAt?: Date | null;
  resolutionSummary?: string | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  reopenRequested: boolean;
  reopenRequestedAt?: Date | null;
  reopenRequestNote?: string | null;
  aiSuggestedCategory?: string | null;
  aiSuggestedPriority?: Priority | null;
  aiRationale?: string | null;
  aiSource?: AiSource | null;
  aiConfidence?: number | null;
  moderation: {
    visible: boolean;
    reason?: string | null;
    moderatedBy?: Types.ObjectId | null;
    moderatedAt?: Date | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<ReportAttrs>(
  {
    reportId: { type: String, required: true, unique: true, trim: true },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 140 },
    description: { type: String, required: true, trim: true, minlength: 20, maxlength: 5000 },
    category: { type: String, required: true, lowercase: true, trim: true, maxlength: 48 },
    priority: { type: String, enum: PRIORITIES, default: 'Medium', required: true },
    status: { type: String, enum: REPORT_STATUSES, default: 'Submitted', required: true },
    location: {
      address: { type: String, required: true, trim: true, minlength: 5, maxlength: 240 },
      latitude: { type: Number, default: null, min: -90, max: 90 },
      longitude: { type: Number, default: null, min: -180, max: 180 },
    },
    geo: {
      type: { type: String, enum: ['Point'], default: undefined },
      coordinates: { type: [Number], default: undefined },
    },
    attachmentIds: [{ type: Schema.Types.ObjectId, ref: 'Attachment' }],
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt: { type: Date, default: null },
    firstAssignedAt: { type: Date, default: null },
    dueAt: { type: Date, default: null },
    resolutionSummary: { type: String, default: null, trim: true, maxlength: 3000 },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    reopenRequested: { type: Boolean, default: false },
    reopenRequestedAt: { type: Date, default: null },
    reopenRequestNote: { type: String, default: null, maxlength: 1000 },
    aiSuggestedCategory: { type: String, default: null },
    aiSuggestedPriority: { type: String, enum: [...PRIORITIES, null], default: null },
    aiRationale: { type: String, default: null, maxlength: 500 },
    aiSource: { type: String, enum: [...AI_SOURCES, null], default: null },
    aiConfidence: { type: Number, default: null, min: 0, max: 1 },
    moderation: {
      visible: { type: Boolean, default: true },
      reason: { type: String, default: null, maxlength: 500 },
      moderatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      moderatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true, versionKey: false },
);

reportSchema.index({ reporterId: 1, createdAt: -1 });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ category: 1, createdAt: -1 });
reportSchema.index({ priority: 1, status: 1 });
reportSchema.index({ departmentId: 1, status: 1 });
reportSchema.index({ assignedTo: 1, status: 1 });
reportSchema.index({ createdAt: -1 });
reportSchema.index({ geo: '2dsphere' }, { sparse: true });
reportSchema.index({ 'location.address': 1 });

export type ReportDocument = HydratedDocument<ReportAttrs>;
export const Report = model<ReportAttrs>('Report', reportSchema);

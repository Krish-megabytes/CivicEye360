import { Schema, model, type Types } from 'mongoose';
import { ATTACHMENT_VISIBILITIES, type AttachmentVisibility } from '../domain/constants.js';

export interface AttachmentAttrs {
  reportId: Types.ObjectId;
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: Types.ObjectId;
  visibility: AttachmentVisibility;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<AttachmentAttrs>(
  {
    reportId: { type: Schema.Types.ObjectId, ref: 'Report', required: true, index: true },
    storageKey: { type: String, required: true, unique: true },
    originalName: { type: String, required: true, maxlength: 180 },
    mimeType: { type: String, required: true, maxlength: 100 },
    size: { type: Number, required: true, min: 1 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    visibility: { type: String, enum: ATTACHMENT_VISIBILITIES, default: 'citizen' },
  },
  { timestamps: true, versionKey: false },
);

attachmentSchema.index({ reportId: 1, visibility: 1, createdAt: 1 });

export const Attachment = model<AttachmentAttrs>('Attachment', attachmentSchema);

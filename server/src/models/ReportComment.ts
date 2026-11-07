import { Schema, model, type Types } from 'mongoose';
import { VISIBILITIES, type Visibility } from '../domain/constants.js';

export interface ReportCommentAttrs {
  reportId: Types.ObjectId;
  authorId: Types.ObjectId;
  body: string;
  visibility: Visibility;
  createdAt: Date;
  updatedAt: Date;
}

const reportCommentSchema = new Schema<ReportCommentAttrs>(
  {
    reportId: { type: Schema.Types.ObjectId, ref: 'Report', required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    visibility: { type: String, enum: VISIBILITIES, default: 'citizen' },
  },
  { timestamps: true, versionKey: false },
);

reportCommentSchema.index({ reportId: 1, createdAt: 1 });

export const ReportComment = model<ReportCommentAttrs>('ReportComment', reportCommentSchema);

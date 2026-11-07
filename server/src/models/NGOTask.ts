import { Schema, model, type Types } from 'mongoose';

export interface NGOTaskAttrs {
  reportId: Types.ObjectId;
  ngoId: Types.ObjectId;
  status: 'claimed' | 'submitted' | 'approved' | 'rejected';
  summary: string | null;
  evidenceIds: Types.ObjectId[];
  points: number;
  suggestedPoints: number;
  reviewedBy: Types.ObjectId | null;
  reviewedAt: Date | null;
  feedback: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ngoTaskSchema = new Schema<NGOTaskAttrs>({
  reportId: { type: Schema.Types.ObjectId, ref: 'Report', required: true, index: true, unique: true },
  ngoId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['claimed', 'submitted', 'approved', 'rejected'], default: 'claimed', index: true },
  summary: { type: String, default: null, maxlength: 2000 },
  evidenceIds: [{ type: Schema.Types.ObjectId, ref: 'Attachment' }],
  points: { type: Number, default: 0, min: 0, max: 1000 },
  suggestedPoints: { type: Number, default: 50, min: 0, max: 1000 },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  feedback: { type: String, default: null, maxlength: 1000 },
}, { timestamps: true, versionKey: false });
ngoTaskSchema.index({ status: 1, updatedAt: -1 });
export const NGOTask = model<NGOTaskAttrs>('NGOTask', ngoTaskSchema);

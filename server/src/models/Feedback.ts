import { Schema, model, type Types } from 'mongoose';

export interface FeedbackAttrs {
  reportId: Types.ObjectId;
  citizenId: Types.ObjectId;
  rating: number;
  comment?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const feedbackSchema = new Schema<FeedbackAttrs>(
  {
    reportId: { type: Schema.Types.ObjectId, ref: 'Report', required: true, unique: true },
    citizenId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: null, trim: true, maxlength: 1000 },
  },
  { timestamps: true, versionKey: false },
);

export const Feedback = model<FeedbackAttrs>('Feedback', feedbackSchema);

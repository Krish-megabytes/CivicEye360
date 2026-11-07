import { Schema, model, type Types } from 'mongoose';

export interface CategoryAttrs {
  slug: string;
  label: string;
  description: string;
  active: boolean;
  sortOrder: number;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<CategoryAttrs>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 48 },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', trim: true, maxlength: 240 },
    active: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 100 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

categorySchema.index({ active: 1, sortOrder: 1 });

export const Category = model<CategoryAttrs>('Category', categorySchema);

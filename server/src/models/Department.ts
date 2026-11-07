import { Schema, model, type Types } from 'mongoose';

export interface DepartmentAttrs {
  name: string;
  description: string;
  supportedCategories: string[];
  memberIds: Types.ObjectId[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new Schema<DepartmentAttrs>(
  {
    name: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 80 },
    description: { type: String, default: '', trim: true, maxlength: 400 },
    supportedCategories: { type: [String], default: [] },
    memberIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

export const Department = model<DepartmentAttrs>('Department', departmentSchema);

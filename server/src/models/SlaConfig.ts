import { Schema, model, type Types } from 'mongoose';
import { PRIORITIES, type Priority } from '../domain/constants.js';

export interface BusinessCalendar {
  timezone: string;
  weekdays: number[]; // 0 = Sunday ... 6 = Saturday
  startHour: number;
  endHour: number;
}

export interface SlaConfigAttrs {
  category: string; // category slug or "*"
  priority: Priority | '*';
  targetHours: number;
  businessCalendar: BusinessCalendar;
  active: boolean;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const slaConfigSchema = new Schema<SlaConfigAttrs>(
  {
    category: { type: String, required: true, lowercase: true, trim: true },
    priority: { type: String, enum: [...PRIORITIES, '*'], required: true },
    targetHours: { type: Number, required: true, min: 1, max: 2160 },
    businessCalendar: {
      timezone: { type: String, default: 'UTC' },
      weekdays: { type: [Number], default: [1, 2, 3, 4, 5] },
      startHour: { type: Number, default: 9, min: 0, max: 23 },
      endHour: { type: Number, default: 17, min: 1, max: 24 },
    },
    active: { type: Boolean, default: true, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

slaConfigSchema.index({ category: 1, priority: 1 }, { unique: true });

export const SlaConfig = model<SlaConfigAttrs>('SlaConfig', slaConfigSchema);

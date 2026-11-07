import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { ROLES, type Role } from '../domain/constants.js';

export interface NotificationPreferences {
  inApp: boolean;
  email: boolean;
}

export interface UserAttrs {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  departmentIds: Types.ObjectId[];
  notificationPreferences: NotificationPreferences;
  active: boolean;
  tokenVersion: number;
  emailVerifiedAt?: Date | null;
  passwordResetTokenHash?: string | null;
  passwordResetExpiresAt?: Date | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserAttrs>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'citizen', index: true },
    departmentIds: [{ type: Schema.Types.ObjectId, ref: 'Department', index: true }],
    notificationPreferences: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
    },
    active: { type: Boolean, default: true, index: true },
    tokenVersion: { type: Number, default: 0 },
    emailVerifiedAt: { type: Date, default: null },
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetExpiresAt;
        delete ret.tokenVersion;
        return ret;
      },
    },
  },
);

userSchema.index({ createdAt: -1 });

export type UserDocument = HydratedDocument<UserAttrs>;
export const User = model<UserAttrs>('User', userSchema);

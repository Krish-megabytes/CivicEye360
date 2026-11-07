import { Schema, model, type Types } from 'mongoose';
import { NOTIFICATION_TYPES, type NotificationType } from '../domain/constants.js';

export type DeliveryStatus = 'in_app' | 'email_sent' | 'email_skipped' | 'email_failed';

export interface NotificationAttrs {
  userId: Types.ObjectId;
  reportId?: Types.ObjectId | null;
  type: NotificationType;
  message: string;
  readAt?: Date | null;
  deliveryStatus: DeliveryStatus;
  dedupeKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationAttrs>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportId: { type: Schema.Types.ObjectId, ref: 'Report', default: null },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    message: { type: String, required: true, maxlength: 500 },
    readAt: { type: Date, default: null },
    deliveryStatus: {
      type: String,
      enum: ['in_app', 'email_sent', 'email_skipped', 'email_failed'],
      default: 'in_app',
    },
    dedupeKey: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

export const Notification = model<NotificationAttrs>('Notification', notificationSchema);

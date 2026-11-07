import type { Request, Response } from 'express';
import { z } from 'zod';
import { Notification } from '../models/Notification.js';
import { Report } from '../models/Report.js';
import { User } from '../models/User.js';
import { notificationQuerySchema, notificationPreferencesSchema } from '../validation/schemas.js';
import { query } from '../middleware/validate.js';
import { notFound, unauthorized } from '../lib/errors.js';
import { reportLink } from '../services/notificationService.js';
import { audit } from '../services/auditService.js';
import { emailConfigured } from '../services/emailService.js';

export async function list(req: Request, res: Response): Promise<void> {
  const params = query<z.infer<typeof notificationQuerySchema>>(res);
  const filter: Record<string, unknown> = { userId: req.user!.id };
  if (params.unreadOnly === 'true') filter.readAt = null;

  const [total, unread, notifications] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.countDocuments({ userId: req.user!.id, readAt: null }),
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .lean(),
  ]);

  const reportIds = notifications
    .map((notification) => notification.reportId)
    .filter(Boolean);
  const reports = reportIds.length
    ? await Report.find({ _id: { $in: reportIds } }).select('reportId').lean()
    : [];
  const reportMap = new Map(reports.map((report) => [String(report._id), report.reportId]));

  res.json({
    data: notifications.map((notification) => {
      const reference = notification.reportId
        ? reportMap.get(String(notification.reportId)) ?? null
        : null;
      return {
        id: String(notification._id),
        type: notification.type,
        message: notification.message,
        readAt: notification.readAt ?? null,
        deliveryStatus: notification.deliveryStatus,
        createdAt: notification.createdAt,
        report: reference
          ? { reportId: reference, link: reportLink(reference, req.user!.role) }
          : null,
      };
    }),
    meta: { unread, total },
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
    },
  });
}

export async function markRead(req: Request, res: Response): Promise<void> {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.notificationId, userId: req.user!.id },
    { $set: { readAt: new Date() } },
    { returnDocument: 'after' },
  ).lean();
  if (!notification) throw notFound('Notification not found.');
  res.json({ data: { id: String(notification._id), readAt: notification.readAt } });
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  const result = await Notification.updateMany(
    { userId: req.user!.id, readAt: null },
    { $set: { readAt: new Date() } },
  );
  res.json({ data: { updated: result.modifiedCount } });
}

export async function getPreferences(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.user!.id).select('notificationPreferences').lean();
  if (!user) throw unauthorized();
  res.json({
    data: {
      preferences: user.notificationPreferences,
      emailConfigured: emailConfigured(),
      note: emailConfigured()
        ? 'Email delivery uses the configured SMTP provider.'
        : 'Email delivery is not configured. Preferences are saved and will apply once a provider is configured.',
    },
  });
}

export async function updatePreferences(req: Request, res: Response): Promise<void> {
  const input = req.body as z.infer<typeof notificationPreferencesSchema>;
  const user = await User.findById(req.user!.id);
  if (!user) throw unauthorized();
  user.notificationPreferences = { inApp: input.inApp, email: input.email };
  await user.save();
  await audit({
    action: 'notification.preferences_updated',
    entityType: 'User',
    entityId: String(user._id),
    metadata: { inApp: input.inApp, email: input.email },
    req,
  });
  res.json({ data: { preferences: user.notificationPreferences, emailConfigured: emailConfigured() } });
}

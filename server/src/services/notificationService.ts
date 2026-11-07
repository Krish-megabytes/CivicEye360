import type { Types } from 'mongoose';
import { Notification, type DeliveryStatus } from '../models/Notification.js';
import { User } from '../models/User.js';
import type { NotificationType, Role, ReportStatus } from '../domain/constants.js';
import { logger } from '../lib/logger.js';
import { sendEmail, emailConfigured } from './emailService.js';

interface NotifyInput {
  userId: Types.ObjectId | string;
  reportId?: Types.ObjectId | string | null;
  type: NotificationType;
  message: string;
  dedupeKey?: string | null;
  emailSubject?: string;
}

/**
 * Persists an in-app notification and optionally sends email. Failures are
 * logged and swallowed: notifications must never roll back a report action.
 */
export async function notifyUser(input: NotifyInput): Promise<boolean> {
  try {
    const user = await User.findById(input.userId).lean();
    if (!user || !user.active) return false;
    if (user.notificationPreferences?.inApp === false && user.notificationPreferences?.email !== true) {
      return false;
    }

    let deliveryStatus: DeliveryStatus = 'in_app';

    if (user.notificationPreferences?.email && emailConfigured()) {
      const result = await sendEmail({
        to: user.email,
        subject: input.emailSubject ?? 'CivicEye 360 update',
        text: `${input.message}\n\nSign in to CivicEye 360 to view details.`,
      });
      deliveryStatus =
        result.status === 'sent' ? 'email_sent' : result.status === 'failed' ? 'email_failed' : 'email_skipped';
    }

    const payload = {
      userId: user._id,
      reportId: input.reportId ?? null,
      type: input.type,
      message: input.message.slice(0, 500),
      deliveryStatus,
      dedupeKey: input.dedupeKey ?? null,
      readAt: null,
    };

    if (input.dedupeKey) {
      await Notification.updateOne(
        { dedupeKey: input.dedupeKey },
        { $setOnInsert: payload },
        { upsert: true },
      );
    } else {
      await Notification.create(payload);
    }
    return true;
  } catch (error) {
    logger.error({ err: error, type: input.type }, 'Notification write failed');
    return false;
  }
}

interface StakeholderInput {
  reportId: Types.ObjectId;
  departmentId?: Types.ObjectId | null;
  type: NotificationType;
  message: string;
  includeCitizenId?: string | null;
  includeAdmins?: boolean;
  includeDepartmentManagers?: boolean;
  excludeUserIds?: string[];
  dedupeKey?: string | null;
}

/** Notifies the department managers and/or city administrators for a report. */
export async function notifyStakeholders(input: StakeholderInput): Promise<void> {
  try {
    const userIds = new Set<string>();
    const exclude = new Set((input.excludeUserIds ?? []).map(String));
    if (input.includeCitizenId && !exclude.has(String(input.includeCitizenId))) {
      userIds.add(String(input.includeCitizenId));
    }

    const roleFilters: Record<string, unknown>[] = [];
    if (input.includeDepartmentManagers && input.departmentId) {
      roleFilters.push({ role: 'department_manager', departmentIds: input.departmentId });
    }
    if (input.includeAdmins) {
      roleFilters.push({ role: { $in: ['municipal_admin', 'platform_admin'] } });
    }

    if (roleFilters.length > 0) {
      const staff = await User.find({
        active: true,
        $or: roleFilters,
      })
        .select('_id')
        .lean();
      for (const person of staff) {
        if (!exclude.has(String(person._id))) userIds.add(String(person._id));
      }
    }

    const dedupeBase = input.dedupeKey ?? null;
    await Promise.all(
      [...userIds].map((userId) =>
        notifyUser({
          userId,
          reportId: input.reportId,
          type: input.type,
          message: input.message,
          dedupeKey: dedupeBase ? `${dedupeBase}:${userId}` : null,
          emailSubject: `CivicEye 360: ${input.type.replaceAll('_', ' ')}`,
        }).catch(() => false),
      ),
    );
  } catch (error) {
    logger.error({ err: error, type: input.type }, 'Stakeholder notification failed');
  }
}

export async function notifyStatusChange(params: {
  reportId: Types.ObjectId;
  reporterId: string;
  departmentId?: Types.ObjectId | null;
  status: ReportStatus;
  actorId: string;
  reportReference: string;
  resolutionSummary?: string | null;
}): Promise<void> {
  const { reportId, reporterId, departmentId, status, actorId, reportReference } = params;
  if (status === 'Resolved') {
    await notifyStakeholders({
      reportId,
      type: 'report_resolved',
      message: `Report ${reportReference} was marked resolved. Please review the resolution and share feedback.`,
      includeCitizenId: reporterId,
      dedupeKey: `resolved:${reportId}:${Date.now()}`,
    });
    return;
  }
  if (status === 'Reopened') {
    await notifyStakeholders({
      reportId,
      departmentId,
      type: 'report_reopened',
      message: `Report ${reportReference} was reopened and needs review.`,
      includeCitizenId: reporterId,
      includeDepartmentManagers: true,
      includeAdmins: true,
      excludeUserIds: [actorId],
      dedupeKey: `reopened:${reportId}:${Date.now()}`,
    });
    return;
  }
  await notifyStakeholders({
    reportId,
    type: 'status_changed',
    message: `Report ${reportReference} moved to ${status}.`,
    includeCitizenId: reporterId,
    excludeUserIds: [actorId],
    dedupeKey: `status:${reportId}:${status}:${Date.now()}`,
  });
}

export function reportLink(reportId: string, role: Role): string {
  if (role === 'citizen') return `/reports/${reportId}`;
  if (role === 'field_staff') return `/staff/reports/${reportId}`;
  return `/admin/reports/${reportId}`;
}

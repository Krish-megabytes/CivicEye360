import type { Types } from 'mongoose';
import type { ReportAttrs } from '../models/Report.js';
import type { AttachmentAttrs } from '../models/Attachment.js';
import type { StatusHistoryAttrs } from '../models/StatusHistory.js';
import type { ReportCommentAttrs } from '../models/ReportComment.js';
import type { FeedbackAttrs } from '../models/Feedback.js';
import type { UserAttrs } from '../models/User.js';
import type { DepartmentAttrs } from '../models/Department.js';
import { ROLE_LABELS, type Role } from '../domain/constants.js';
import { deriveTrackingCode } from '../auth/tokens.js';
import type { AuthUser } from '../types/auth.js';

export type LeanReport = ReportAttrs & { _id: Types.ObjectId };
export type LeanAttachment = AttachmentAttrs & { _id: Types.ObjectId };
export type LeanHistory = StatusHistoryAttrs & { _id: Types.ObjectId };
export type LeanComment = ReportCommentAttrs & { _id: Types.ObjectId };
export type LeanFeedback = FeedbackAttrs & { _id: Types.ObjectId };
export type LeanUser = UserAttrs & { _id: Types.ObjectId };
export type LeanDepartment = DepartmentAttrs & { _id: Types.ObjectId };

export interface ReportViewContext {
  departments?: Map<string, { id: string; name: string }>;
  users?: Map<string, { id: string; name: string; email?: string; role?: Role }>;
  attachments?: LeanAttachment[];
  reporter?: LeanUser | null;
  includeDescription?: boolean;
  includeInternal?: boolean;
}

export interface StatusAction {
  status: string;
  label: string;
  requiresReason: boolean;
  requiresResolution: boolean;
  tone: 'default' | 'positive' | 'negative';
}

function roleLabel(role: Role | string | undefined): string {
  if (role && role in ROLE_LABELS) return ROLE_LABELS[role as Role];
  return 'Staff';
}

export function serializeAttachment(attachment: LeanAttachment) {
  return {
    id: String(attachment._id),
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    visibility: attachment.visibility,
    url: `/api/attachments/${String(attachment._id)}`,
    createdAt: attachment.createdAt,
  };
}

function reporterView(report: LeanReport, viewer: AuthUser, reporter: LeanUser | null) {
  if (!reporter) {
    if (viewer.role === 'citizen') return null;
    return { name: 'Citizen', email: null };
  }
  if (viewer.role === 'citizen') {
    return viewer.id === String(reporter._id)
      ? { name: reporter.name, email: reporter.email }
      : null;
  }
  if (viewer.role === 'field_staff') {
    return { name: reporter.name, email: null };
  }
  return { name: reporter.name, email: reporter.email };
}

export function serializeReport(
  report: LeanReport,
  viewer: AuthUser,
  context: ReportViewContext = {},
) {
  const isCitizen = viewer.role === 'citizen';
  const department = report.departmentId
    ? context.departments?.get(String(report.departmentId)) ?? null
    : null;
  const assignee = report.assignedTo
    ? context.users?.get(String(report.assignedTo)) ?? null
    : null;
  const attachments = context.attachments
    ? context.attachments.filter((attachment) => !isCitizen || attachment.visibility === 'citizen')
    : undefined;
  const showAi = !isCitizen;
  const showModeration = viewer.role === 'municipal_admin' || viewer.role === 'platform_admin';
  const isOwner = viewer.id === String(report.reporterId);

  return {
    id: String(report._id),
    reportId: report.reportId,
    title: report.title,
    ...(context.includeDescription !== false ? { description: report.description } : {}),
    category: report.category,
    priority: report.priority,
    status: report.status,
    location: {
      address: report.location.address,
      latitude: report.location.latitude ?? null,
      longitude: report.location.longitude ?? null,
    },
    department: department ? { id: department.id, name: department.name } : null,
    assignee: assignee
      ? { id: assignee.id, name: assignee.name, role: assignee.role ?? null }
      : null,
    assignedAt: report.assignedAt ?? null,
    firstAssignedAt: report.firstAssignedAt ?? null,
    dueAt: report.dueAt ?? null,
    resolutionSummary: report.resolutionSummary ?? null,
    resolvedAt: report.resolvedAt ?? null,
    closedAt: report.closedAt ?? null,
    reopenRequested: report.reopenRequested,
    reopenRequestedAt: report.reopenRequestedAt ?? null,
    reopenRequestNote: context.includeInternal ? report.reopenRequestNote ?? null : null,
    attachmentCount: report.attachmentIds?.length ?? 0,
    ...(attachments ? { attachments: attachments.map(serializeAttachment) } : {}),
    reporter: reporterView(report, viewer, context.reporter ?? null),
    ...(showAi
      ? {
          ai: report.aiSuggestedCategory
            ? {
                suggestedCategory: report.aiSuggestedCategory,
                suggestedPriority: report.aiSuggestedPriority ?? null,
                rationale: report.aiRationale ?? null,
                source: report.aiSource ?? null,
                confidence: report.aiConfidence ?? null,
              }
            : null,
        }
      : {}),
    ...(showModeration
      ? {
          moderation: {
            visible: report.moderation?.visible ?? true,
            reason: report.moderation?.reason ?? null,
            moderatedAt: report.moderation?.moderatedAt ?? null,
          },
        }
      : {}),
    trackingCode: isOwner ? deriveTrackingCode(report.reportId) : null,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}

export function serializeHistory(
  entry: LeanHistory,
  viewer: AuthUser,
  users: Map<string, { id: string; name: string; email?: string; role?: Role }>,
) {
  const actor = users.get(String(entry.actorId));
  return {
    id: String(entry._id),
    fromStatus: entry.fromStatus,
    toStatus: entry.toStatus,
    note: entry.note ?? null,
    reason: entry.reason ?? null,
    visibility: entry.visibility,
    actor: actor
      ? { id: actor.id, name: actor.name, roleLabel: roleLabel(actor.role) }
      : { id: String(entry.actorId), name: 'CivicEye 360', roleLabel: 'System' },
    createdAt: entry.createdAt,
  };
}

export function serializeComment(
  comment: LeanComment,
  users: Map<string, { id: string; name: string; email?: string; role?: Role }>,
) {
  const author = users.get(String(comment.authorId));
  return {
    id: String(comment._id),
    body: comment.body,
    visibility: comment.visibility,
    author: author
      ? { id: author.id, name: author.name, roleLabel: roleLabel(author.role) }
      : { id: String(comment.authorId), name: 'User', roleLabel: 'Citizen' },
    createdAt: comment.createdAt,
  };
}

export function serializeFeedback(feedback: LeanFeedback | null) {
  if (!feedback) return null;
  return {
    id: String(feedback._id),
    rating: feedback.rating,
    comment: feedback.comment ?? null,
    createdAt: feedback.createdAt,
  };
}

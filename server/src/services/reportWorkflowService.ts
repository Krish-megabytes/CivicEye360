import type { Request } from 'express';
import type { AuthUser } from '../types/auth.js';
import { Report, type ReportAttrs } from '../models/Report.js';
import { Department } from '../models/Department.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { StatusHistory } from '../models/StatusHistory.js';
import { ReportComment } from '../models/ReportComment.js';
import { Feedback } from '../models/Feedback.js';
import {
  OPEN_STATUSES,
  RESOLVED_STATUSES,
  TRANSITIONS_REQUIRING_REASON,
  type Priority,
  type ReportStatus,
  type Visibility,
} from '../domain/constants.js';
import { can } from '../auth/permissions.js';
import { conflict, forbidden, notFound, unprocessable } from '../lib/errors.js';
import { audit } from './auditService.js';
import { computeDueAt } from './slaService.js';
import {
  notifyStakeholders,
  notifyStatusChange,
  notifyUser,
} from './notificationService.js';
import {
  allowedStatusActions,
  canAccessReport,
  getAuthorizedReport,
  getReportDetail,
  managerCoversReport,
} from './reportService.js';
import { serializeComment, type LeanComment, type LeanReport } from './reportSerializer.js';

async function refresh(actor: AuthUser, report: LeanReport) {
  const updated = await Report.findById(report._id).lean<LeanReport>();
  if (!updated) throw notFound('Report not found.');
  return getReportDetail(updated, actor);
}

function assertManagerScope(report: LeanReport, actor: AuthUser): void {
  if (!canAccessReport(report, actor) || !managerCoversReport(report, actor)) {
    throw forbidden();
  }
}

export async function assignReport(
  actor: AuthUser,
  reportId: string,
  input: { assigneeId: string; departmentId?: string | null; reason?: string | null },
  req?: Request,
) {
  const report = await getAuthorizedReport(reportId, actor);
  if (!can(actor.role, 'reports.assign')) throw forbidden('You cannot assign reports.');
  assertManagerScope(report, actor);

  const assignee = await User.findOne({ _id: input.assigneeId, active: true })
    .select('name email role departmentIds')
    .lean();
  if (!assignee) throw unprocessable('Select an active staff member.');
  if (!['field_staff', 'department_manager'].includes(assignee.role)) {
    throw unprocessable('Reports can only be assigned to field staff or department managers.');
  }

  const departmentId =
    input.departmentId || (report.departmentId ? String(report.departmentId) : null) ||
    (assignee.departmentIds?.[0] ? String(assignee.departmentIds[0]) : null);
  if (!departmentId) throw unprocessable('Select a department for this assignment.');

  const department = await Department.findOne({ _id: departmentId, active: true }).lean();
  if (!department) throw unprocessable('Select an active department.');
  if (actor.role === 'department_manager' && !actor.departmentIds.includes(departmentId)) {
    throw forbidden('You can only assign reports within your department.');
  }
  if (report.departmentId && String(report.departmentId) !== departmentId) {
    if (actor.role !== 'municipal_admin' && actor.role !== 'platform_admin') {
      throw forbidden('You cannot move this report to another department.');
    }
  }
  if (!assignee.departmentIds?.some((id) => String(id) === departmentId)) {
    throw unprocessable('That staff member is not a member of the selected department.');
  }

  if (!['Under Review', 'Assigned', 'Reopened', 'In Progress'].includes(report.status)) {
    throw conflict('Move the report to Under Review before assigning it.');
  }

  const previousAssignee = report.assignedTo ? String(report.assignedTo) : null;
  const reason = input.reason?.trim() ?? '';
  if (previousAssignee && previousAssignee !== input.assigneeId && reason.length < 5) {
    throw unprocessable('Provide a short reason for reassigning this report.');
  }
  if (previousAssignee === input.assigneeId && String(report.departmentId ?? '') === departmentId) {
    throw conflict('This report is already assigned to that person.');
  }

  const now = new Date();
  const statusChanges = report.status === 'Under Review' || report.status === 'Reopened';
  const nextStatus = statusChanges ? 'Assigned' : report.status;

  const result = await Report.updateOne(
    { _id: report._id, status: report.status, assignedTo: report.assignedTo ?? null },
    {
      $set: {
        assignedTo: assignee._id,
        departmentId: department._id,
        assignedAt: now,
        firstAssignedAt: report.firstAssignedAt ?? now,
        status: nextStatus,
      },
    },
  );
  if (result.modifiedCount === 0) {
    throw conflict('The report changed while you were working. Reload and try again.');
  }

  if (statusChanges) {
    await StatusHistory.create({
      reportId: report._id,
      fromStatus: report.status,
      toStatus: 'Assigned',
      actorId: actor.id,
      visibility: 'citizen',
      note: null,
      reason: reason || null,
    });
    await notifyStatusChange({
      reportId: report._id,
      reporterId: String(report.reporterId),
      departmentId: department._id,
      status: 'Assigned',
      actorId: actor.id,
      reportReference: report.reportId,
    });
  }

  await notifyUser({
    userId: assignee._id,
    reportId: report._id,
    type: previousAssignee ? 'report_reassigned' : 'report_assigned',
    message: `${previousAssignee ? 'Reassigned' : 'Assigned'}: report ${report.reportId} — ${report.title}`,
    dedupeKey: `assignment:${report._id}:${String(assignee._id)}:${now.getTime()}`,
  });

  await audit({
    action: previousAssignee ? 'report.reassigned' : 'report.assigned',
    entityType: 'Report',
    entityId: report.reportId,
    metadata: {
      fromAssignee: previousAssignee,
      toAssignee: String(assignee._id),
      departmentId,
      reason: reason || null,
    },
    req,
  });

  return refresh(actor, report);
}

export async function updateReportStatus(
  actor: AuthUser,
  reportId: string,
  input: {
    status: ReportStatus;
    reason?: string | null;
    note?: string | null;
    resolutionSummary?: string | null;
  },
  req?: Request,
) {
  const report = await getAuthorizedReport(reportId, actor);
  const allowed = allowedStatusActions(report, actor);
  const action = allowed.find((candidate) => candidate.status === input.status);
  if (!action) {
    throw conflict(`This report cannot move from ${report.status} to ${input.status}.`);
  }

  const reason = input.reason?.trim() ?? '';
  const note = input.note?.trim() ?? '';
  const resolutionSummary = input.resolutionSummary?.trim() ?? '';

  if (action.requiresReason && reason.length < 5) {
    throw unprocessable(
      input.status === 'Rejected'
        ? 'Provide a brief rejection reason for the citizen.'
        : 'Provide a reason for this status change.',
    );
  }
  if (action.requiresResolution) {
    if (resolutionSummary.length < 10) {
      throw unprocessable('Add a resolution summary of at least 10 characters.');
    }
  }
  if (input.status === 'Reopened' && RESOLVED_STATUSES.includes(report.status) === false) {
    throw conflict('Only resolved or closed reports can be reopened.');
  }

  const now = new Date();
  const set: Partial<ReportAttrs> = {
    status: input.status,
    reopenRequested: false,
    reopenRequestedAt: null,
    reopenRequestNote: null,
  };
  if (input.status === 'Resolved') {
    set.resolvedAt = now;
    set.resolutionSummary = resolutionSummary;
  }
  if (input.status === 'Closed') {
    set.closedAt = now;
  }
  if (input.status === 'Reopened') {
    set.resolvedAt = null;
    set.closedAt = null;
  }

  const result = await Report.updateOne(
    { _id: report._id, status: report.status },
    { $set: set },
  );
  if (result.modifiedCount === 0) {
    throw conflict('The report changed while you were working. Reload and try again.');
  }

  const publicNote =
    input.status === 'Resolved' ? resolutionSummary : reason ? reason : null;
  await StatusHistory.create({
    reportId: report._id,
    fromStatus: report.status,
    toStatus: input.status,
    actorId: actor.id,
    visibility: 'citizen',
    note: publicNote,
    reason: reason || null,
  });
  if (note) {
    await StatusHistory.create({
      reportId: report._id,
      fromStatus: report.status,
      toStatus: input.status,
      actorId: actor.id,
      visibility: 'internal',
      note,
      reason: null,
    });
  }

  await notifyStatusChange({
    reportId: report._id,
    reporterId: String(report.reporterId),
    departmentId: report.departmentId,
    status: input.status,
    actorId: actor.id,
    reportReference: report.reportId,
    resolutionSummary: resolutionSummary || null,
  });

  await audit({
    action: 'report.status_changed',
    entityType: 'Report',
    entityId: report.reportId,
    metadata: {
      from: report.status,
      to: input.status,
      reason: reason || null,
      internalNote: note || null,
    },
    req,
  });

  return refresh(actor, report);
}

export async function changeReportCategory(
  actor: AuthUser,
  reportId: string,
  category: string,
  req?: Request,
) {
  const report = await getAuthorizedReport(reportId, actor);
  if (!can(actor.role, 'reports.triage')) throw forbidden();
  assertManagerScope(report, actor);
  const target = await Category.findOne({ slug: category, active: true }).lean();
  if (!target) throw unprocessable('Select an active category.');
  if (report.category === category) return refresh(actor, report);

  const dueAt = await computeDueAt(category, report.priority, report.createdAt);
  await Report.updateOne(
    { _id: report._id, category: report.category },
    { $set: { category, dueAt } },
  );

  await audit({
    action: 'report.category_changed',
    entityType: 'Report',
    entityId: report.reportId,
    metadata: { from: report.category, to: category },
    req,
  });
  return refresh(actor, report);
}

export async function changeReportPriority(
  actor: AuthUser,
  reportId: string,
  priority: Priority,
  req?: Request,
) {
  const report = await getAuthorizedReport(reportId, actor);
  if (!can(actor.role, 'reports.triage')) throw forbidden();
  assertManagerScope(report, actor);
  if (report.priority === priority) return refresh(actor, report);

  const dueAt = await computeDueAt(report.category, priority, report.createdAt);
  await Report.updateOne(
    { _id: report._id, priority: report.priority },
    { $set: { priority, dueAt } },
  );
  await audit({
    action: 'report.priority_changed',
    entityType: 'Report',
    entityId: report.reportId,
    metadata: { from: report.priority, to: priority },
    req,
  });
  return refresh(actor, report);
}

export async function moderateReport(
  actor: AuthUser,
  reportId: string,
  input: { visible: boolean; reason?: string | null },
  req?: Request,
) {
  const report = await getAuthorizedReport(reportId, actor);
  if (!can(actor.role, 'reports.moderate')) throw forbidden();
  const reason = input.reason?.trim() ?? '';
  if (!input.visible && reason.length < 5) {
    throw unprocessable('Provide a moderation reason.');
  }
  await Report.updateOne(
    { _id: report._id },
    {
      $set: {
        moderation: {
          visible: input.visible,
          reason: reason || null,
          moderatedBy: actor.id,
          moderatedAt: new Date(),
        },
      },
    },
  );
  await audit({
    action: input.visible ? 'report.moderation_restored' : 'report.moderation_hidden',
    entityType: 'Report',
    entityId: report.reportId,
    metadata: { reason: reason || null },
    req,
  });
  return refresh(actor, report);
}

export async function addComment(
  actor: AuthUser,
  reportId: string,
  input: { body: string; visibility: Visibility; requestInformation?: boolean },
  req?: Request,
) {
  const report = await getAuthorizedReport(reportId, actor);
  const isOwner = String(report.reporterId) === actor.id;

  if (actor.role === 'citizen') {
    if (!isOwner) throw notFound('Report not found.');
    if (['Closed', 'Rejected'].includes(report.status)) {
      throw conflict('This report no longer accepts follow-up comments.');
    }
    const count = await ReportComment.countDocuments({
      reportId: report._id,
      authorId: actor.id,
    });
    if (count >= 20) {
      throw conflict('You have reached the follow-up limit for this report.');
    }
  } else if (!can(actor.role, 'reports.update.status') && !can(actor.role, 'reports.comment.internal')) {
    throw forbidden();
  }

  if (input.visibility === 'internal' && actor.role === 'citizen') {
    throw forbidden('Citizens cannot add internal notes.');
  }
  if (input.requestInformation && input.visibility !== 'citizen') {
    throw unprocessable('Information requests are visible to the citizen.');
  }

  const body = input.body.trim();
  const comment = await ReportComment.create({
    reportId: report._id,
    authorId: actor.id,
    body,
    visibility: actor.role === 'citizen' ? 'citizen' : input.visibility,
  });

  if (actor.role !== 'citizen') {
    if (comment.visibility === 'citizen') {
      await notifyUser({
        userId: report.reporterId,
        reportId: report._id,
        type: input.requestInformation ? 'information_requested' : 'comment_added',
        message: input.requestInformation
          ? `The team needs more information about report ${report.reportId}.`
          : `A new public update was added to report ${report.reportId}.`,
        dedupeKey: `comment:${String(comment._id)}:${String(report.reporterId)}`,
      });
    }
  } else {
    await notifyStakeholders({
      reportId: report._id,
      departmentId: report.departmentId,
      type: 'comment_added',
      message: `A citizen added information to report ${report.reportId}.`,
      includeAdmins: true,
      includeDepartmentManagers: true,
    });
    if (report.assignedTo) {
      await notifyUser({
        userId: report.assignedTo,
        reportId: report._id,
        type: 'comment_added',
        message: `New citizen follow-up on report ${report.reportId}.`,
        dedupeKey: `comment:${String(comment._id)}:${String(report.assignedTo)}`,
      });
    }
  }

  await audit({
    action: 'report.comment_added',
    entityType: 'Report',
    entityId: report.reportId,
    metadata: { visibility: comment.visibility, requestInformation: Boolean(input.requestInformation) },
    req,
  });

  return serializeComment(
    comment.toObject() as LeanComment,
    new Map([[actor.id, { id: actor.id, name: actor.name, role: actor.role }]]),
  );
}

export async function submitFeedback(
  actor: AuthUser,
  reportId: string,
  input: { rating: number; comment?: string | null },
  req?: Request,
) {
  const report = await getAuthorizedReport(reportId, actor);
  if (String(report.reporterId) !== actor.id) throw notFound('Report not found.');
  if (actor.role !== 'citizen') throw forbidden();
  if (!RESOLVED_STATUSES.includes(report.status)) {
    throw conflict('Feedback is available after the report is resolved.');
  }
  const existing = await Feedback.findOne({ reportId: report._id }).lean();
  if (existing) throw conflict('Feedback has already been submitted for this report.');

  const feedback = await Feedback.create({
    reportId: report._id,
    citizenId: actor.id,
    rating: input.rating,
    comment: input.comment?.trim() || null,
  });

  await notifyStakeholders({
    reportId: report._id,
    departmentId: report.departmentId,
    type: 'system',
    message: `New citizen feedback (${input.rating}/5) for report ${report.reportId}.`,
    includeAdmins: true,
    includeDepartmentManagers: true,
    dedupeKey: `feedback:${String(feedback._id)}`,
  });

  await audit({
    action: 'report.feedback_submitted',
    entityType: 'Report',
    entityId: report.reportId,
    metadata: { rating: input.rating, hasComment: Boolean(input.comment) },
    req,
  });

  return {
    id: String(feedback._id),
    rating: feedback.rating,
    comment: feedback.comment ?? null,
    createdAt: feedback.createdAt,
  };
}

export async function requestReopen(
  actor: AuthUser,
  reportId: string,
  note: string,
  req?: Request,
) {
  const report = await getAuthorizedReport(reportId, actor);
  if (String(report.reporterId) !== actor.id) throw notFound('Report not found.');
  if (!RESOLVED_STATUSES.includes(report.status)) {
    throw conflict('Only resolved or closed reports can be reviewed for reopening.');
  }
  if (report.reopenRequested) {
    throw conflict('A reopening review has already been requested.');
  }

  const result = await Report.updateOne(
    { _id: report._id, reopenRequested: false },
    { $set: { reopenRequested: true, reopenRequestedAt: new Date(), reopenRequestNote: note.trim() } },
  );
  if (result.modifiedCount === 0) {
    throw conflict('A reopening review has already been requested.');
  }

  await notifyStakeholders({
    reportId: report._id,
    departmentId: report.departmentId,
    type: 'reopen_requested',
    message: `A citizen requested a reopening review for report ${report.reportId}.`,
    includeAdmins: true,
    includeDepartmentManagers: true,
    excludeUserIds: [actor.id],
  });

  await audit({
    action: 'report.reopen_requested',
    entityType: 'Report',
    entityId: report.reportId,
    metadata: { noteLength: note.length },
    req,
  });

  return refresh(actor, report);
}

export function assertOpenForFollowUp(status: ReportStatus): boolean {
  return !['Closed', 'Rejected'].includes(status) && OPEN_STATUSES.includes(status);
}

export async function canStaffAccess(actor: AuthUser, report: LeanReport): Promise<boolean> {
  return canAccessReport(report, actor);
}

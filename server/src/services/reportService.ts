import type { QueryFilter, Types } from 'mongoose';
import type { Request } from 'express';
import type { AuthUser } from '../types/auth.js';
import { Report, type ReportAttrs, type ReportLocation } from '../models/Report.js';
import { Department } from '../models/Department.js';
import { Category } from '../models/Category.js';
import { RoutingRule } from '../models/RoutingRule.js';
import { User } from '../models/User.js';
import { StatusHistory } from '../models/StatusHistory.js';
import { ReportComment } from '../models/ReportComment.js';
import { Attachment } from '../models/Attachment.js';
import { Feedback } from '../models/Feedback.js';
import {
  OPEN_STATUSES,
  RESOLVED_STATUSES,
  TRANSITIONS_REQUIRING_REASON,
  STATUS_TRANSITIONS,
  type Priority,
  type ReportStatus,
} from '../domain/constants.js';
import { can } from '../auth/permissions.js';
import { conflict, forbidden, notFound, unprocessable } from '../lib/errors.js';
import { nextReportId } from '../lib/ids.js';
import { computeDueAt } from './slaService.js';
import { audit } from './auditService.js';
import { notifyStakeholders } from './notificationService.js';
import {
  serializeComment,
  serializeFeedback,
  serializeHistory,
  serializeReport,
  type LeanComment,
  type LeanDepartment,
  type LeanFeedback,
  type LeanHistory,
  type LeanReport,
  type StatusAction,
} from './reportSerializer.js';

export interface ReportListFilters {
  q?: string;
  statuses?: ReportStatus[];
  category?: string;
  priority?: Priority;
  departmentId?: string;
  assigneeId?: string;
  unassigned?: boolean;
  overdue?: boolean;
  from?: Date;
  to?: Date;
  sort?: 'createdAt' | 'updatedAt' | 'dueAt' | 'reportId';
  order?: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface CreateReportInput {
  title: string;
  description: string;
  category: string;
  location: ReportLocation;
  aiSuggestion?: {
    suggestedCategory?: string | null;
    suggestedPriority?: Priority | null;
    rationale?: string | null;
    source?: 'openai' | 'rules' | null;
    confidence?: number | null;
  } | null;
}

const STATUS_ACTION_LABELS: Record<string, string> = {
  'Under Review': 'Move to review',
  Rejected: 'Reject report',
  'In Progress': 'Start work',
  Resolved: 'Mark resolved',
  Closed: 'Close report',
  Reopened: 'Reopen report',
  Assigned: 'Assign',
  Submitted: 'Return to submitted',
};

export function isOverdue(report: Pick<ReportAttrs, 'dueAt' | 'status'>): boolean {
  return Boolean(
    report.dueAt &&
      OPEN_STATUSES.includes(report.status) &&
      new Date(report.dueAt).getTime() < Date.now(),
  );
}

export function scopeQueryFor(actor: AuthUser): QueryFilter<ReportAttrs> {
  switch (actor.role) {
    case 'citizen':
      return { reporterId: actor.id };
    case 'field_staff':
      return { assignedTo: actor.id };
    case 'department_manager':
      return actor.departmentIds.length > 0
        ? { departmentId: { $in: actor.departmentIds } }
        : { _id: { $exists: false } };
    default:
      return {};
  }
}

export function managerCoversReport(report: LeanReport, actor: AuthUser): boolean {
  if (actor.role !== 'department_manager') return true;
  if (!report.departmentId) return false;
  return actor.departmentIds.includes(String(report.departmentId));
}

export function canAccessReport(report: LeanReport, actor: AuthUser): boolean {
  switch (actor.role) {
    case 'citizen':
      return String(report.reporterId) === actor.id;
    case 'field_staff':
      return String(report.assignedTo ?? '') === actor.id;
    case 'department_manager':
      return managerCoversReport(report, actor);
    case 'municipal_admin':
    case 'platform_admin':
      return true;
    default:
      return false;
  }
}

export function allowedStatusActions(report: LeanReport, actor: AuthUser): StatusAction[] {
  if (!can(actor.role, 'reports.update.status')) return [];
  if (actor.role === 'field_staff' && String(report.assignedTo ?? '') !== actor.id) return [];
  if (!managerCoversReport(report, actor)) return [];
  const transitions = STATUS_TRANSITIONS[report.status] ?? [];
  return transitions
    .filter((target) => target !== 'Assigned')
    .filter((target) => {
      if (actor.role === 'field_staff') {
        return (
          (report.status === 'Assigned' && target === 'In Progress') ||
          (report.status === 'In Progress' && target === 'Resolved')
        );
      }
      return true;
    })
    .map((target) => ({
      status: target,
      label: STATUS_ACTION_LABELS[target] ?? target,
      requiresReason: TRANSITIONS_REQUIRING_REASON.includes(target),
      requiresResolution: target === 'Resolved',
      tone:
        target === 'Resolved' || target === 'Closed'
          ? 'positive'
          : target === 'Rejected'
            ? 'negative'
            : 'default',
    }));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildReportFilter(actor: AuthUser, filters: ReportListFilters): QueryFilter<ReportAttrs> {
  const clauses: QueryFilter<ReportAttrs>[] = [scopeQueryFor(actor)];

  if (filters.statuses?.length) clauses.push({ status: { $in: filters.statuses } });
  if (filters.category) clauses.push({ category: filters.category });
  if (filters.priority) clauses.push({ priority: filters.priority });
  if (filters.assigneeId) clauses.push({ assignedTo: filters.assigneeId });
  if (filters.unassigned) clauses.push({ assignedTo: null });
  if (filters.departmentId) {
    if (
      actor.role === 'department_manager' &&
      !actor.departmentIds.includes(filters.departmentId)
    ) {
      clauses.push({ _id: { $exists: false } });
    } else {
      clauses.push({ departmentId: filters.departmentId });
    }
  }
  if (filters.overdue) {
    clauses.push({ dueAt: { $ne: null, $lt: new Date() }, status: { $in: OPEN_STATUSES } });
  }
  if (filters.from || filters.to) {
    clauses.push({
      createdAt: {
        ...(filters.from ? { $gte: filters.from } : {}),
        ...(filters.to ? { $lte: filters.to } : {}),
      },
    });
  }
  if (filters.q) {
    const term = escapeRegex(filters.q.slice(0, 80));
    const regex = new RegExp(term, 'i');
    clauses.push({
      $or: [{ reportId: regex }, { title: regex }, { 'location.address': regex }],
    });
  }

  return { $and: clauses };
}

export async function contextFor(reports: LeanReport[]) {
  const departmentIds = [
    ...new Set(reports.map((report) => String(report.departmentId ?? '')).filter(Boolean)),
  ];
  const userIds = [
    ...new Set(reports.map((report) => String(report.assignedTo ?? '')).filter(Boolean)),
  ];

  const [departments, users] = await Promise.all([
    departmentIds.length
      ? Department.find({ _id: { $in: departmentIds } })
          .select('name')
          .lean<LeanDepartment[]>()
      : Promise.resolve([] as LeanDepartment[]),
    userIds.length
      ? User.find({ _id: { $in: userIds } })
          .select('name email role')
          .lean()
      : Promise.resolve([]),
  ]);

  return {
    departments: new Map(
      departments.map((department) => [
        String(department._id),
        { id: String(department._id), name: department.name },
      ]),
    ),
    users: new Map(
      users.map((user) => [
        String(user._id),
        {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      ]),
    ),
  };
}

export async function listReports(actor: AuthUser, filters: ReportListFilters) {
  const filter = buildReportFilter(actor, filters);
  const sort = filters.sort ?? 'createdAt';
  const direction = filters.order === 'asc' ? 1 : -1;
  const page = Math.max(1, filters.page);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize));

  const [total, reports] = await Promise.all([
    Report.countDocuments(filter),
    Report.find(filter)
      .sort({ [sort]: direction } as Record<string, 1 | -1>)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<LeanReport[]>(),
  ]);

  const { departments, users } = await contextFor(reports);
  return {
    data: reports.map((report) =>
      serializeReport(report, actor, {
        departments,
        users,
        includeDescription: false,
      }),
    ),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function exportReportRows(
  actor: AuthUser,
  filters: ReportListFilters,
  limit = 5000,
): Promise<Array<{ report: LeanReport; departmentName: string; assigneeName: string }>> {
  const filter = buildReportFilter(actor, { ...filters, page: 1, pageSize: limit });
  const reports = await Report.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(5000, Math.max(1, limit)))
    .lean<LeanReport[]>();
  const { departments, users } = await contextFor(reports);
  return reports.map((report) => ({
    report,
    departmentName: report.departmentId
      ? departments.get(String(report.departmentId))?.name ?? 'Unknown'
      : 'Unassigned',
    assigneeName: report.assignedTo
      ? users.get(String(report.assignedTo))?.name ?? 'Unknown'
      : 'Unassigned',
  }));
}

export async function reportSummary(actor: AuthUser) {
  const scope = scopeQueryFor(actor);
  const [total, submitted, underReview, reopened, assigned, inProgress, resolved, closed, rejected] =
    await Promise.all([
      Report.countDocuments(scope),
      Report.countDocuments({ ...scope, status: 'Submitted' }),
      Report.countDocuments({ ...scope, status: 'Under Review' }),
      Report.countDocuments({ ...scope, status: 'Reopened' }),
      Report.countDocuments({ ...scope, status: 'Assigned' }),
      Report.countDocuments({ ...scope, status: 'In Progress' }),
      Report.countDocuments({ ...scope, status: 'Resolved' }),
      Report.countDocuments({ ...scope, status: 'Closed' }),
      Report.countDocuments({ ...scope, status: 'Rejected' }),
    ]);
  return {
    total,
    submitted,
    underReview: underReview + reopened,
    inProgress: assigned + inProgress,
    resolved,
    closed,
    resolvedTotal: resolved + closed,
    rejected,
    open: submitted + underReview + reopened + assigned + inProgress,
    definitions: {
      submitted: 'Reports currently in Submitted.',
      underReview: 'Reports currently in Under Review or Reopened.',
      inProgress: 'Reports currently Assigned or In Progress.',
      resolvedTotal: 'Reports currently Resolved or Closed.',
    },
  };
}

export async function findReport(reportId: string): Promise<LeanReport> {
  const report = await Report.findOne({ reportId }).lean<LeanReport>();
  if (!report) throw notFound('Report not found.');
  return report;
}

export async function getAuthorizedReport(reportId: string, actor: AuthUser): Promise<LeanReport> {
  const report = await findReport(reportId);
  if (!canAccessReport(report, actor)) {
    throw notFound('Report not found.');
  }
  return report;
}

export async function getReportDetail(report: LeanReport, actor: AuthUser) {
  const isCitizen = actor.role === 'citizen';
  const [history, comments, attachments, feedback, reporter] = await Promise.all([
    StatusHistory.find({ reportId: report._id })
      .sort({ createdAt: 1 })
      .lean<LeanHistory[]>(),
    ReportComment.find({ reportId: report._id }).sort({ createdAt: 1 }).lean<LeanComment[]>(),
    Attachment.find({ reportId: report._id }).sort({ createdAt: 1 }).lean(),
    Feedback.findOne({ reportId: report._id }).lean<LeanFeedback>(),
    User.findById(report.reporterId).select('name email role').lean(),
  ]);

  const userMap = await contextFor([report]);
  const extraUserIds = new Set<string>();
  for (const entry of history) extraUserIds.add(String(entry.actorId));
  for (const comment of comments) extraUserIds.add(String(comment.authorId));
  extraUserIds.add(String(report.reporterId));

  const extraUsers = await User.find({ _id: { $in: [...extraUserIds] } })
    .select('name email role')
    .lean();
  for (const user of extraUsers) {
    userMap.users.set(String(user._id), {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    });
  }

  const visibleHistory = isCitizen
    ? history.filter((entry) => entry.visibility === 'citizen')
    : history;
  const visibleComments = isCitizen
    ? comments.filter((entry) => entry.visibility === 'citizen')
    : comments;

  const resolved = RESOLVED_STATUSES.includes(report.status);
  const isOwner = String(report.reporterId) === actor.id;
  const staffCanComment = can(actor.role, 'reports.update.status');
  const canCitizenFollowUp = !['Closed', 'Rejected'].includes(report.status);
  const canStaffUpload =
    actor.role === 'field_staff'
      ? String(report.assignedTo ?? '') === actor.id && OPEN_STATUSES.includes(report.status)
      : ['department_manager', 'municipal_admin', 'platform_admin'].includes(actor.role) &&
        OPEN_STATUSES.includes(report.status);

  const canManageReport =
    actor.role === 'municipal_admin' ||
    actor.role === 'platform_admin' ||
    (actor.role === 'department_manager' && managerCoversReport(report, actor));

  return {
    report: serializeReport(report, actor, {
      ...userMap,
      attachments,
      reporter: (reporter as never) ?? null,
      includeDescription: true,
      includeInternal: !isCitizen,
    }),
    history: visibleHistory.map((entry) => serializeHistory(entry, actor, userMap.users)),
    comments: visibleComments.map((comment) => serializeComment(comment, userMap.users)),
    feedback:
      isCitizen || actor.role === 'department_manager' || canManageReport
        ? serializeFeedback(feedback)
        : null,
    actions: {
      statuses: allowedStatusActions(report, actor),
      canAssign: can(actor.role, 'reports.assign') && canManageReport,
      canChangePriority: can(actor.role, 'reports.triage') && canManageReport,
      canChangeCategory: can(actor.role, 'reports.triage') && canManageReport,
      canModerate: can(actor.role, 'reports.moderate'),
      canComment:
        (isCitizen && isOwner && canCitizenFollowUp) || (staffCanComment && canManageReport) || (staffCanComment && actor.role === 'field_staff'),
      canUpload:
        (isCitizen && isOwner && canCitizenFollowUp) || canStaffUpload,
      canSubmitFeedback: isCitizen && isOwner && resolved && !feedback,
      canRequestReopen: isCitizen && isOwner && resolved && !report.reopenRequested,
      commentVisibility:
        staffCanComment && actor.role !== 'citizen'
          ? ['citizen', 'internal']
          : ['citizen'],
      defaultCommentVisibility:
        actor.role === 'field_staff' ? 'internal' : 'citizen',
    },
  };
}

export async function createReport(
  actor: AuthUser,
  input: CreateReportInput,
  req?: Request,
): Promise<LeanReport> {
  const category = await Category.findOne({ slug: input.category, active: true }).lean();
  if (!category) throw unprocessable('Select an active category.');

  const suggestionCategory = input.aiSuggestion?.suggestedCategory
    ? await Category.findOne({ slug: input.aiSuggestion.suggestedCategory, active: true }).lean()
    : null;

  const routing = await RoutingRule.findOne({ category: input.category, active: true }).lean();
  let departmentId: Types.ObjectId | null = null;
  if (routing) {
    const department = await Department.findOne({ _id: routing.departmentId, active: true }).lean();
    if (department) departmentId = department._id as Types.ObjectId;
  }

  const dueAt = await computeDueAt(input.category, 'Medium');
  const hasCoordinates =
    typeof input.location.latitude === 'number' && typeof input.location.longitude === 'number';

  const report = await Report.create({
    reportId: await nextReportId(),
    reporterId: actor.id,
    title: input.title,
    description: input.description,
    category: input.category,
    priority: 'Medium',
    status: 'Submitted',
    location: {
      address: input.location.address,
      latitude: input.location.latitude ?? null,
      longitude: input.location.longitude ?? null,
    },
    geo: hasCoordinates
      ? {
          type: 'Point',
          coordinates: [input.location.longitude as number, input.location.latitude as number],
        }
      : null,
    departmentId,
    dueAt,
    attachmentIds: [],
    reopenRequested: false,
    moderation: { visible: true },
    aiSuggestedCategory: suggestionCategory?.slug ?? null,
    aiSuggestedPriority: input.aiSuggestion?.suggestedPriority ?? null,
    aiRationale: input.aiSuggestion?.rationale?.slice(0, 500) ?? null,
    aiSource: input.aiSuggestion?.source ?? null,
    aiConfidence:
      typeof input.aiSuggestion?.confidence === 'number'
        ? Math.min(1, Math.max(0, input.aiSuggestion.confidence))
        : null,
  });

  const lean = report.toObject() as LeanReport;

  await StatusHistory.create({
    reportId: report._id,
    fromStatus: null,
    toStatus: 'Submitted',
    actorId: actor.id,
    visibility: 'citizen',
    note: 'Report submitted.',
  });

  await audit({
    action: 'report.created',
    entityType: 'Report',
    entityId: lean.reportId,
    metadata: {
      category: lean.category,
      departmentId: departmentId ? String(departmentId) : null,
    },
    req,
  });

  await notifyStakeholders({
    reportId: report._id as Types.ObjectId,
    departmentId,
    type: 'report_submitted',
    message: `New report ${lean.reportId} needs triage.`,
    includeAdmins: true,
    includeDepartmentManagers: true,
    excludeUserIds: [actor.id],
  });

  return lean;
}

export function normalizedCreateInput(input: CreateReportInput): CreateReportInput {
  return {
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    location: {
      address: input.location.address.trim(),
      latitude: input.location.latitude ?? null,
      longitude: input.location.longitude ?? null,
    },
  };
}


import { Types } from 'mongoose';
import type { AuthUser } from '../types/auth.js';
import { Report } from '../models/Report.js';
import { Department } from '../models/Department.js';
import { StatusHistory } from '../models/StatusHistory.js';
import { Feedback } from '../models/Feedback.js';
import { SlaConfig } from '../models/SlaConfig.js';
import { OPEN_STATUSES, RESOLVED_STATUSES } from '../domain/constants.js';
import { listReports } from './reportService.js';
import { median, percentile } from '../lib/stats.js';

export interface Range {
  from: Date;
  to: Date;
}

function objectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

function aggregateScope(actor: AuthUser): Record<string, unknown> {
  switch (actor.role) {
    case 'citizen':
      return { reporterId: objectId(actor.id) };
    case 'field_staff':
      return { assignedTo: objectId(actor.id) };
    case 'department_manager':
      return actor.departmentIds.length
        ? { departmentId: { $in: actor.departmentIds.map(objectId) } }
        : { _id: { $in: [] } };
    default:
      return {};
  }
}

function scopeSummary(actor: AuthUser) {
  if (actor.role === 'department_manager') return 'Your department(s)';
  if (actor.role === 'field_staff') return 'Reports assigned to you';
  if (actor.role === 'citizen') return 'Your reports';
  return 'All departments';
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daySeries(range: Range): string[] {
  const days: string[] = [];
  const start = Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), range.from.getUTCDate());
  const end = Date.UTC(range.to.getUTCFullYear(), range.to.getUTCMonth(), range.to.getUTCDate());
  for (let current = start; current <= end && days.length < 400; current += 86_400_000) {
    days.push(new Date(current).toISOString().slice(0, 10));
  }
  return days;
}

const definitions = {
  totalReports: 'Reports created within the selected date range and visible in your scope.',
  unassigned: 'Open reports (Submitted, Under Review, Assigned, In Progress, Reopened) with no assignee.',
  highPriority: 'Open reports with High or Urgent priority.',
  overdue:
    'Open reports with an SLA due date in the past. Only reports covered by an active SLA configuration have a due date.',
  resolved: 'Reports created in range that are currently Resolved or Closed.',
  medianResolution:
    'Median of resolvedAt − createdAt for reports created in range that are currently Resolved or Closed.',
  reopenedRate:
    'Distinct reports with a Reopened status event in range ÷ distinct reports with a Resolved or Closed status event in range.',
  assignmentDelay: 'Median of firstAssignedAt − createdAt for reports created in range that were assigned.',
  slaAttainment:
    'Share of resolved reports in range with a due date that were resolved on or before that date. Requires an active SLA configuration.',
  timezone: 'All series are grouped in UTC.',
};

async function scopeReportIds(actor: AuthUser, range: Range): Promise<Types.ObjectId[]> {
  const reports = await Report.find({
    ...(actor.role === 'citizen'
      ? { reporterId: actor.id }
      : actor.role === 'field_staff'
        ? { assignedTo: actor.id }
        : actor.role === 'department_manager'
          ? { departmentId: { $in: actor.departmentIds } }
          : {}),
    createdAt: { $gte: range.from, $lte: range.to },
  })
    .select('_id')
    .lean();
  return reports.map((report) => report._id as Types.ObjectId);
}

export async function getDashboard(actor: AuthUser, range: Range) {
  const match = {
    ...aggregateScope(actor),
    createdAt: { $gte: range.from, $lte: range.to },
  };
  const now = new Date();
  const openFilter = { status: { $in: OPEN_STATUSES } };

  const [
    total,
    unassigned,
    highPriority,
    overdue,
    resolved,
    open,
    newCount,
    reopened,
    resolvedDocs,
    statusRows,
    categoryRows,
    departmentRows,
    createdTrend,
    resolvedTrend,
    slaConfigured,
  ] = await Promise.all([
    Report.countDocuments(match),
    Report.countDocuments({ ...match, ...openFilter, assignedTo: null }),
    Report.countDocuments({ ...match, ...openFilter, priority: { $in: ['High', 'Urgent'] } }),
    Report.countDocuments({
      ...match,
      ...openFilter,
      dueAt: { $ne: null, $lt: now },
    }),
    Report.countDocuments({ ...match, status: { $in: RESOLVED_STATUSES } }),
    Report.countDocuments({ ...match, ...openFilter }),
    Report.countDocuments({ ...match, status: 'Submitted' }),
    Report.countDocuments({ ...match, status: 'Reopened' }),
    Report.find({ ...match, status: { $in: RESOLVED_STATUSES }, resolvedAt: { $ne: null } })
      .select('createdAt resolvedAt')
      .lean(),
    Report.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Report.aggregate([
      { $match: match },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Report.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$departmentId',
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $in: ['$status', OPEN_STATUSES] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $in: ['$status', RESOLVED_STATUSES] }, 1, 0] } },
        },
      },
      { $sort: { total: -1 } },
    ]),
    Report.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Report.aggregate([
      {
        $match: {
          ...aggregateScope(actor),
          resolvedAt: { $gte: range.from, $lte: range.to },
          status: { $in: RESOLVED_STATUSES },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$resolvedAt', timezone: 'UTC' } },
          count: { $sum: 1 },
        },
      },
    ]),
    SlaConfig.countDocuments({ active: true }),
  ]);

  const resolutionDurations = resolvedDocs
    .filter((doc) => doc.resolvedAt)
    .map((doc) => new Date(doc.resolvedAt!).getTime() - new Date(doc.createdAt).getTime());

  const departmentIds = departmentRows
    .map((row) => row._id)
    .filter(Boolean)
    .map(String);
  const departments = departmentIds.length
    ? await Department.find({ _id: { $in: departmentIds } }).select('name').lean()
    : [];
  const departmentNames = new Map(departments.map((dept) => [String(dept._id), dept.name]));

  const days = daySeries(range);
  const createdMap = new Map(createdTrend.map((row) => [row._id as string, row.count as number]));
  const resolvedMap = new Map(resolvedTrend.map((row) => [row._id as string, row.count as number]));

  const recent = await listReports(actor, {
    from: range.from,
    to: range.to,
    page: 1,
    pageSize: 6,
    sort: 'updatedAt',
    order: 'desc',
  });

  return {
    range: { from: range.from, to: range.to, timezone: 'UTC' },
    scope: scopeSummary(actor),
    kpis: {
      totalReports: total,
      unassigned,
      highPriority,
      overdue,
      hasSlaConfiguration: slaConfigured > 0,
      resolved,
      open,
      medianResolutionHours: median(resolutionDurations) === null
        ? null
        : Math.round((median(resolutionDurations)! / 3_600_000) * 10) / 10,
    },
    queues: {
      new: newCount,
      unassigned,
      urgent: highPriority,
      reopened,
    },
    statusDistribution: statusRows.map((row) => ({ status: row._id, count: row.count })),
    categoryDistribution: categoryRows.map((row) => ({ category: row._id, count: row.count })),
    departmentWorkload: departmentRows.map((row) => ({
      departmentId: row._id ? String(row._id) : null,
      department: row._id ? departmentNames.get(String(row._id)) ?? 'Unknown' : 'Unassigned',
      total: row.total,
      open: row.open,
      resolved: row.resolved,
    })),
    trend: days.map((day) => ({
      date: day,
      created: createdMap.get(day) ?? 0,
      resolved: resolvedMap.get(day) ?? 0,
    })),
    recentReports: recent.data,
    definitions,
  };
}

export async function getAnalytics(actor: AuthUser, range: Range) {
  const baseMatch = {
    ...aggregateScope(actor),
    createdAt: { $gte: range.from, $lte: range.to },
  };
  const openFilter = { status: { $in: OPEN_STATUSES } };

  const [
    total,
    resolvedNow,
    resolvedInPeriod,
    statusRows,
    categoryRows,
    priorityRows,
    departmentRows,
    createdTrend,
    resolvedTrend,
    resolvedDocs,
    assignedDocs,
    reopenedStats,
    feedbackStats,
    slaConfigCount,
  ] = await Promise.all([
    Report.countDocuments(baseMatch),
    Report.countDocuments({ ...baseMatch, status: { $in: RESOLVED_STATUSES } }),
    Report.countDocuments({
      ...aggregateScope(actor),
      resolvedAt: { $gte: range.from, $lte: range.to },
    }),
    Report.aggregate([
      { $match: baseMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Report.aggregate([
      { $match: baseMatch },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Report.aggregate([
      { $match: baseMatch },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
    Report.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: '$departmentId',
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $in: ['$status', OPEN_STATUSES] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $in: ['$status', RESOLVED_STATUSES] }, 1, 0] } },
        },
      },
      { $sort: { total: -1 } },
    ]),
    Report.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Report.aggregate([
      {
        $match: {
          ...aggregateScope(actor),
          resolvedAt: { $gte: range.from, $lte: range.to },
          status: { $in: RESOLVED_STATUSES },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$resolvedAt', timezone: 'UTC' } },
          count: { $sum: 1 },
        },
      },
    ]),
    Report.find({ ...baseMatch, status: { $in: RESOLVED_STATUSES }, resolvedAt: { $ne: null } })
      .select('createdAt resolvedAt dueAt')
      .lean(),
    Report.find({ ...baseMatch, firstAssignedAt: { $ne: null } })
      .select('createdAt firstAssignedAt')
      .lean(),
    reopenedRate(actor, range),
    feedbackAverage(actor, range),
    SlaConfig.countDocuments({ active: true }),
  ]);

  const resolutionDurations = resolvedDocs
    .map((doc) =>
      doc.resolvedAt ? new Date(doc.resolvedAt).getTime() - new Date(doc.createdAt).getTime() : null,
    )
    .filter((value): value is number => value !== null);
  const assignmentDurations = assignedDocs
    .map((doc) =>
      doc.firstAssignedAt
        ? new Date(doc.firstAssignedAt).getTime() - new Date(doc.createdAt).getTime()
        : null,
    )
    .filter((value): value is number => value !== null);

  const dueDocs = resolvedDocs.filter((doc) => doc.dueAt && doc.resolvedAt);
  const slaAttainment =
    dueDocs.length > 0
      ? Math.round(
          (dueDocs.filter(
            (doc) => new Date(doc.resolvedAt!).getTime() <= new Date(doc.dueAt!).getTime(),
          ).length /
            dueDocs.length) *
            1000,
        ) / 10
      : null;

  const departmentIds = departmentRows
    .map((row) => row._id)
    .filter(Boolean)
    .map(String);
  const departments = departmentIds.length
    ? await Department.find({ _id: { $in: departmentIds } }).select('name').lean()
    : [];
  const departmentNames = new Map(departments.map((dept) => [String(dept._id), dept.name]));

  const days = daySeries(range);
  const createdMap = new Map(createdTrend.map((row) => [row._id as string, row.count as number]));
  const resolvedMap = new Map(resolvedTrend.map((row) => [row._id as string, row.count as number]));

  const medianResolutionMs = median(resolutionDurations);
  const p90ResolutionMs = percentile(resolutionDurations, 90);
  const medianAssignmentMs = median(assignmentDurations);

  return {
    range: { from: range.from, to: range.to, timezone: 'UTC' },
    scope: scopeSummary(actor),
    generatedAt: new Date(),
    kpis: {
      totalReports: total,
      resolvedNow,
      resolvedInPeriod,
      open: await Report.countDocuments({ ...baseMatch, ...openFilter }),
      medianResolutionHours: medianResolutionMs === null ? null : Math.round((medianResolutionMs / 3_600_000) * 10) / 10,
      p90ResolutionHours: p90ResolutionMs === null ? null : Math.round((p90ResolutionMs / 3_600_000) * 10) / 10,
      mathNote: 'Resolution times cover reports created in the selected range that are currently Resolved or Closed.',
    },
    statusDistribution: statusRows.map((row) => ({ status: row._id, count: row.count })),
    categoryDistribution: categoryRows.map((row) => ({ category: row._id, count: row.count })),
    priorityDistribution: priorityRows.map((row) => ({ priority: row._id, count: row.count })),
    departmentWorkload: departmentRows.map((row) => ({
      departmentId: row._id ? String(row._id) : null,
      department: row._id ? departmentNames.get(String(row._id)) ?? 'Unknown' : 'Unassigned',
      total: row.total,
      open: row.open,
      resolved: row.resolved,
    })),
    trend: days.map((day) => ({
      date: day,
      created: createdMap.get(day) ?? 0,
      resolved: resolvedMap.get(day) ?? 0,
    })),
    resolution: {
      sample: resolutionDurations.length,
      medianHours: medianResolutionMs === null ? null : Math.round((medianResolutionMs / 3_600_000) * 10) / 10,
      p90Hours: p90ResolutionMs === null ? null : Math.round((p90ResolutionMs / 3_600_000) * 10) / 10,
    },
    assignment: {
      sample: assignmentDurations.length,
      medianHours: medianAssignmentMs === null ? null : Math.round((medianAssignmentMs / 3_600_000) * 10) / 10,
    },
    reopened: reopenedStats,
    sla: {
      configured: slaConfigCount > 0,
      attainmentPercent: slaAttainment,
      sample: dueDocs.length,
    },
    feedback: feedbackStats,
    definitions,
  };
}

async function reopenedRate(actor: AuthUser, range: Range) {
  const reportIds = await scopeReportIds(actor, range);
  if (reportIds.length === 0) {
    return { ratePercent: null, reopened: 0, resolved: 0, note: 'No reports in range.' };
  }
  const rows = await StatusHistory.aggregate([
    {
      $match: {
        reportId: { $in: reportIds },
        toStatus: { $in: ['Resolved', 'Closed', 'Reopened'] },
        createdAt: { $gte: range.from, $lte: range.to },
      },
    },
    {
      $group: {
        _id: '$reportId',
        reopened: { $max: { $cond: [{ $eq: ['$toStatus', 'Reopened'] }, 1, 0] } },
        resolved: {
          $max: { $cond: [{ $in: ['$toStatus', ['Resolved', 'Closed']] }, 1, 0] },
        },
      },
    },
  ]);
  const numerator = rows.filter((row) => row.reopened === 1).length;
  const denominator = rows.filter((row) => row.resolved === 1).length;
  return {
    ratePercent: denominator === 0 ? null : Math.round((numerator / denominator) * 1000) / 10,
    reopened: numerator,
    resolved: denominator,
    note: 'Numerator and denominator are distinct reports with the matching status events in range.',
  };
}

async function feedbackAverage(actor: AuthUser, range: Range) {
  const ids = await scopeReportIds(actor, range);
  if (ids.length === 0) return { average: null, sample: 0 };
  const rows = await Feedback.aggregate([
    { $match: { reportId: { $in: ids } } },
    { $group: { _id: null, average: { $avg: '$rating' }, sample: { $sum: 1 } } },
  ]);
  if (!rows[0]) return { average: null, sample: 0 };
  return {
    average: Math.round(rows[0].average * 100) / 100,
    sample: rows[0].sample,
  };
}

export async function getMapPoints(
  actor: AuthUser,
  options: { range?: Range; statuses?: string[]; category?: string; priority?: string } = {},
) {
  const filter: Record<string, unknown> = {
    ...aggregateScope(actor),
    'location.latitude': { $ne: null },
    'location.longitude': { $ne: null },
    'moderation.visible': true,
  };
  if (options.range) filter.createdAt = { $gte: options.range.from, $lte: options.range.to };
  if (options.statuses?.length) filter.status = { $in: options.statuses };
  if (options.category) filter.category = options.category;
  if (options.priority) filter.priority = options.priority;
  const reports = await Report.find(filter)
    .select('reportId title category status priority location departmentId createdAt')
    .sort({ createdAt: -1 })
    .limit(2000)
    .lean();

  const departmentIds = [...new Set(reports.map((report) => String(report.departmentId ?? '')).filter(Boolean))];
  const departments = departmentIds.length
    ? await Department.find({ _id: { $in: departmentIds } }).select('name').lean()
    : [];
  const names = new Map(departments.map((dept) => [String(dept._id), dept.name]));

  return {
    total: reports.length,
    truncated: reports.length === 2000,
    points: reports.map((report) => ({
      id: String(report._id),
      reportId: report.reportId,
      title: report.title,
      category: report.category,
      status: report.status,
      priority: report.priority,
      latitude: report.location.latitude,
      longitude: report.location.longitude,
      address: report.location.address,
      department: report.departmentId ? names.get(String(report.departmentId)) ?? 'Unknown' : null,
      createdAt: report.createdAt,
    })),
  };
}

export const analyticsDefinitions = definitions;

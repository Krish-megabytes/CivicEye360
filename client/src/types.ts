export type Role =
  | 'citizen'
  | 'ngo'
  | 'field_staff'
  | 'department_manager'
  | 'municipal_admin'
  | 'platform_admin';

export type ReportStatus =
  | 'Submitted'
  | 'Under Review'
  | 'Assigned'
  | 'In Progress'
  | 'Resolved'
  | 'Closed'
  | 'Rejected'
  | 'Reopened';

export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type Visibility = 'citizen' | 'internal';

export interface Category {
  slug: string;
  label: string;
  description: string;
}

export interface DepartmentOption {
  id: string;
  name: string;
  description?: string;
  supportedCategories?: string[];
  active?: boolean;
  memberCount?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  active: boolean;
  departmentIds: string[];
  departments: Array<{ id: string; name: string }>;
  notificationPreferences: { inApp: boolean; email: boolean };
  emailVerifiedAt: string | null;
  createdAt: string;
  permissions: string[];
  unreadNotifications: number;
}

export interface ReportLocation {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

export interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  visibility: Visibility;
  url: string;
  createdAt: string;
}

export interface ReportReporter {
  name: string;
  email: string | null;
}

export interface AiInfo {
  suggestedCategory: string;
  suggestedPriority: Priority | null;
  rationale: string | null;
  source: 'openai' | 'rules' | null;
  confidence: number | null;
}

export interface Report {
  id: string;
  reportId: string;
  title: string;
  description?: string;
  category: string;
  priority: Priority;
  status: ReportStatus;
  location: ReportLocation;
  department: { id: string; name: string } | null;
  assignee: { id: string; name: string; role: Role | null } | null;
  assignedAt: string | null;
  firstAssignedAt: string | null;
  dueAt: string | null;
  resolutionSummary: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  reopenRequested: boolean;
  reopenRequestedAt: string | null;
  reopenRequestNote?: string | null;
  attachmentCount: number;
  attachments?: Attachment[];
  reporter?: ReportReporter | null;
  ai?: AiInfo | null;
  moderation?: { visible: boolean; reason: string | null; moderatedAt: string | null } | null;
  trackingCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: ReportStatus | null;
  toStatus: ReportStatus;
  note: string | null;
  reason: string | null;
  visibility: Visibility;
  actor: { id: string; name: string; roleLabel: string };
  createdAt: string;
}

export interface ReportComment {
  id: string;
  body: string;
  visibility: Visibility;
  author: { id: string; name: string; roleLabel: string };
  createdAt: string;
}

export interface Feedback {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface StatusAction {
  status: ReportStatus;
  label: string;
  requiresReason: boolean;
  requiresResolution: boolean;
  tone: 'default' | 'positive' | 'negative';
}

export interface ReportActions {
  statuses: StatusAction[];
  canAssign: boolean;
  canChangePriority: boolean;
  canChangeCategory: boolean;
  canModerate: boolean;
  canComment: boolean;
  canUpload: boolean;
  canSubmitFeedback: boolean;
  canRequestReopen: boolean;
  commentVisibility: Visibility[];
  defaultCommentVisibility: Visibility;
}

export interface ReportDetail {
  report: Report;
  history: StatusHistoryEntry[];
  comments: ReportComment[];
  feedback: Feedback | null;
  actions: ReportActions;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface NotificationItem {
  id: string;
  type: string;
  message: string;
  readAt: string | null;
  deliveryStatus: string;
  createdAt: string;
  report: { reportId: string; link: string } | null;
}

export interface NotificationResponse {
  data: NotificationItem[];
  meta: { unread: number; total: number };
  pagination: Pagination;
}

export interface PublicConfig {
  aiConfigured: boolean;
  emailConfigured: boolean;
  slaConfigured: boolean;
  uploads: { maxMb: number };
  maps: { provider: string; requiresKey: boolean; note: string };
  environment: string;
  demoMode: boolean;
}

export interface DashboardData {
  range: { from: string; to: string; timezone: string };
  scope: string;
  kpis: {
    totalReports: number;
    unassigned: number;
    highPriority: number;
    overdue: number;
    hasSlaConfiguration: boolean;
    resolved: number;
    open: number;
    medianResolutionHours: number | null;
  };
  queues: { new: number; unassigned: number; urgent: number; reopened: number };
  statusDistribution: Array<{ status: ReportStatus; count: number }>;
  categoryDistribution: Array<{ category: string; count: number }>;
  departmentWorkload: Array<{
    departmentId: string | null;
    department: string;
    total: number;
    open: number;
    resolved: number;
  }>;
  trend: Array<{ date: string; created: number; resolved: number }>;
  recentReports: Report[];
  definitions: Record<string, string>;
}

export interface AnalyticsData extends Omit<DashboardData, 'queues' | 'recentReports' | 'kpis'> {
  generatedAt: string;
  kpis: {
    totalReports: number;
    resolvedNow: number;
    resolvedInPeriod: number;
    open: number;
    medianResolutionHours: number | null;
    p90ResolutionHours: number | null;
    mathNote: string;
  };
  priorityDistribution: Array<{ priority: Priority; count: number }>;
  resolution: { sample: number; medianHours: number | null; p90Hours: number | null };
  assignment: { sample: number; medianHours: number | null };
  reopened: {
    ratePercent: number | null;
    reopened: number;
    resolved: number;
    note: string;
  };
  sla: { configured: boolean; attainmentPercent: number | null; sample: number };
  feedback: { average: number | null; sample: number };
}

export interface MapPoint {
  id: string;
  reportId: string;
  title: string;
  category: string;
  status: ReportStatus;
  priority: Priority;
  latitude: number;
  longitude: number;
  address: string;
  department: string | null;
  createdAt: string;
}

export interface MapResponse {
  total: number;
  truncated: boolean;
  points: MapPoint[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  active: boolean;
  departmentIds: string[];
  departments: Array<{ id: string; name: string }>;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CategoryAdmin extends Category {
  id: string;
  active: boolean;
  sortOrder: number;
  updatedAt: string;
}

export interface RoutingRule {
  id: string;
  category: string;
  departmentId: string;
  departmentName: string;
  active: boolean;
  updatedAt: string;
}

export interface SlaConfig {
  id: string;
  category: string;
  priority: Priority | '*';
  targetHours: number;
  businessCalendar: {
    timezone: string;
    weekdays: number[];
    startHour: number;
    endHour: number;
  };
  active: boolean;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  actor: { id: string; name: string; role: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  requestId: string | null;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email?: string;
  role: Role;
  roleLabel: string;
  departmentIds: string[];
}

export interface TrackedReport {
  reportId: string;
  title: string;
  category: string;
  status: ReportStatus;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
  dueAt: string | null;
  resolvedAt: string | null;
  resolutionSummary: string | null;
  timeline: Array<{ toStatus: ReportStatus; note: string | null; reason: string | null; createdAt: string }>;
  privacyNote: string;
}

export interface ClassifyResult {
  category: string;
  confidence: number;
  rationale: string;
  suggestedPriority: Priority;
  priorityRationale: string;
  source: 'openai' | 'rules';
  aiConfigured: boolean;
  degraded: boolean;
  model?: string;
  disclaimer: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }> | unknown;
    requestId?: string | null;
  };
}

import type {
  AdminUser,
  AnalyticsData,
  ApiErrorBody,
  Attachment,
  AuditEntry,
  Category,
  CategoryAdmin,
  ClassifyResult,
  DashboardData,
  DepartmentOption,
  Feedback,
  MapResponse,
  NotificationItem,
  NotificationResponse,
  Pagination,
  PublicConfig,
  Report,
  ReportComment,
  ReportDetail,
  RoutingRule,
  SlaConfig,
  StaffMember,
  TrackedReport,
  User,
  Visibility,
} from './types';

export const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const CSRF_HEADER = 'X-Requested-With';
const CSRF_VALUE = 'CivicEye360';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string | null;

  constructor(
    message: string,
    status = 0,
    code = 'NETWORK_ERROR',
    details?: unknown,
    requestId?: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { [CSRF_HEADER]: CSRF_VALUE };
  const hasBody = options.body !== undefined;
  if (hasBody) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      'Cannot reach the CivicEye 360 API. Check your connection and try again.',
    );
  }

  const payload = await parseBody(response);
  if (!response.ok) {
    const errorBody = payload as ApiErrorBody | null;
    throw new ApiError(
      errorBody?.error?.message ?? 'The request could not be completed.',
      response.status,
      errorBody?.error?.code ?? 'REQUEST_FAILED',
      errorBody?.error?.details,
      errorBody?.error?.requestId,
    );
  }
  // APIs return both direct data envelopes ({ data: value }) and paginated
  // envelopes ({ data: [], pagination: ... }). Preserve the whole page object
  // when pagination metadata is present so list consumers receive their contract.
  if (
    payload &&
    typeof payload === 'object' &&
    'pagination' in payload &&
    'data' in payload
  ) {
    return payload as T;
  }
  return (payload as { data?: T } | null)?.data as T;
}

export function queryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      search.set(key, value.join(','));
      continue;
    }
    if (typeof value === 'boolean') {
      search.set(key, String(value));
      continue;
    }
    if (value instanceof Date) {
      search.set(key, value.toISOString());
      continue;
    }
    search.set(key, String(value));
  }
  const string = search.toString();
  return string ? `?${string}` : '';
}

export interface NgoTask {
  id: string; reportId: string; title: string; category: string; description: string; address: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'claimed' | 'submitted' | 'approved' | 'rejected'; summary: string | null; points: number;
  suggestedPoints: number;
  evidenceIds: string[]; evidence: Array<{ id: string; name: string; url: string }>; ngo?: { id: string; name: string }; feedback?: string | null;
  createdAt: string; updatedAt?: string;
}

export interface NgoTaskBoard {
  available: Array<{
    id: string; reportId: string; title: string; category: string; description: string; address: string;
    priority: 'Low' | 'Medium' | 'High' | 'Urgent'; suggestedPoints: number; createdAt: string;
  }>;
  mine: NgoTask[];
  stats: {
    ngoId: string;
    points: number; completedTasks: number; activeTasks: number; pendingReview: number;
    needsCorrections: number; rank: number | null; rankedNgos: number;
  };
}

function uploadNgoEvidence(taskId: string, file: File): Promise<{ id: string; url: string }> {
  return new Promise((resolve, reject) => {
    const form = new FormData(); form.append('file', file);
    const xhr = new XMLHttpRequest(); xhr.open('POST', `${API_BASE}/ngo/tasks/${taskId}/evidence`); xhr.withCredentials = true; xhr.setRequestHeader(CSRF_HEADER, CSRF_VALUE);
    xhr.onload = () => { try { const payload = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300) resolve(payload.data); else reject(new ApiError(payload?.error?.message ?? 'Evidence upload failed.', xhr.status)); } catch { reject(new ApiError('Evidence upload failed.')); } };
    xhr.onerror = () => reject(new ApiError('Evidence upload failed.')); xhr.send(form);
  });
}

export interface ReportListFilters {
  q?: string;
  status?: string[];
  category?: string;
  priority?: string;
  departmentId?: string;
  assigneeId?: string;
  unassigned?: boolean;
  overdue?: boolean;
  from?: Date;
  to?: Date;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ReportListResponse {
  data: Report[];
  pagination: Pagination;
}

interface CreateReportPayload {
  title: string;
  description: string;
  category: string;
  location: {
    address: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  aiSuggestion?: {
    suggestedCategory?: string | null;
    suggestedPriority?: string | null;
    rationale?: string | null;
    source?: 'openai' | 'rules' | null;
    confidence?: number | null;
  } | null;
}

interface DuplicateHint {
  reportId: string;
  title: string;
  category: string;
  status: Report['status'];
  priority: Report['priority'];
  address: string;
  createdAt: string;
  distanceMeters: number | null;
  matchScore: number;
}

export interface DuplicateHintsResult {
  method: 'rules-based';
  aiConfigured: boolean;
  note: string;
  hints: DuplicateHint[];
}

export interface UserListResponse {
  data: AdminUser[];
  pagination: Pagination;
}

export interface AuditListResponse {
  data: AuditEntry[];
  pagination: Pagination;
}

function uploadAttachment(
  reportId: string,
  file: File,
  visibility: Visibility,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('visibility', visibility);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/reports/${reportId}/attachments`);
    xhr.withCredentials = true;
    xhr.setRequestHeader(CSRF_HEADER, CSRF_VALUE);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(xhr.responseText);
      } catch {
        payload = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve((payload as { data: Attachment }).data);
        return;
      }
      const body = payload as ApiErrorBody | null;
      reject(
        new ApiError(
          body?.error?.message ?? 'The image could not be uploaded.',
          xhr.status,
          body?.error?.code ?? 'UPLOAD_FAILED',
          body?.error?.details,
          body?.error?.requestId,
        ),
      );
    };
    xhr.onerror = () => reject(new ApiError('The image upload failed. Check your connection.'));
    xhr.onabort = () =>
      reject(new ApiError('Upload cancelled.', 0, 'UPLOAD_ABORTED'));
    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send(formData);
  });
}

async function exportReports(params: ReportListFilters): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(
    `${API_BASE}/admin/analytics/export${queryString({ ...params })}`,
    { credentials: 'include', headers: { [CSRF_HEADER]: CSRF_VALUE } },
  );
  if (!response.ok) {
    const payload = (await parseBody(response)) as ApiErrorBody | null;
    throw new ApiError(
      payload?.error?.message ?? 'Export failed.',
      response.status,
      payload?.error?.code ?? 'EXPORT_FAILED',
    );
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  return {
    blob: await response.blob(),
    filename: match?.[1] ?? 'civiceye-reports.csv',
  };
}

export const api = {
  auth: {
    me: () => request<User>('/auth/me'),
    login: (body: { email: string; password: string }) =>
      request<User>('/auth/login', { method: 'POST', body }),
    register: (body: { name: string; email: string; password: string }) =>
      request<User>('/auth/register', { method: 'POST', body }),
    registerNgo: (body: { name: string; email: string; password: string }) =>
      request<User>('/auth/register-ngo', { method: 'POST', body }),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
    forgotPassword: (email: string) =>
      request<{ message: string; emailConfigured: boolean; devResetUrl?: string }>(
        '/auth/forgot-password',
        { method: 'POST', body: { email } },
      ),
    resetPassword: (body: { token: string; password: string }) =>
      request<{ message: string }>('/auth/reset-password', { method: 'POST', body }),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      request<{ message: string }>('/auth/change-password', { method: 'POST', body }),
    updateProfile: (body: {
      name?: string;
      notificationPreferences?: { inApp?: boolean; email?: boolean };
    }) => request<User>('/auth/profile', { method: 'PATCH', body }),
  },
  ngo: {
    tasks: () => request<NgoTaskBoard>('/ngo/tasks'),
    claim: (reportId: string) => request<{ id: string }>('/ngo/tasks/claim', { method: 'POST', body: { reportId } }),
    release: (taskId: string) => request<{ status: string }>(`/ngo/tasks/${taskId}/release`, { method: 'POST' }),
    upload: (taskId: string, file: File) => uploadNgoEvidence(taskId, file),
    submit: (taskId: string, summary: string) => request<{ status: string }>(`/ngo/tasks/${taskId}/submit`, { method: 'POST', body: { summary } }),
    leaderboard: () => request<Array<{ ngoId: string; name: string; completedTasks: number; points: number }>>('/ngo/leaderboard'),
    review: () => request<NgoTask[]>('/ngo/admin/review'),
    decide: (taskId: string, body: { approved: boolean; points?: number; feedback?: string }) => request(`/ngo/admin/review/${taskId}`, { method: 'POST', body }),
  },
  categories: () => request<Category[]>('/categories'),
  publicConfig: () => request<PublicConfig>('/public-config'),
  track: (body: { reportId: string; trackingCode: string }) =>
    request<TrackedReport>('/track', { method: 'POST', body }),
  reports: {
    create: (body: CreateReportPayload) =>
      request<ReportDetail>('/reports', { method: 'POST', body }),
    my: (params: ReportListFilters = {}) =>
      request<ReportListResponse>(`/reports/my${queryString({ ...params })}`),
    list: (params: ReportListFilters = {}) =>
      request<ReportListResponse>(`/reports${queryString({ ...params })}`),
    summary: () =>
      request<{
        total: number;
        submitted: number;
        underReview: number;
        inProgress: number;
        resolved: number;
        closed: number;
        resolvedTotal: number;
        rejected: number;
        open: number;
        definitions: Record<string, string>;
      }>('/reports/summary'),
    get: (reportId: string) => request<ReportDetail>(`/reports/${reportId}`),
    updateStatus: (
      reportId: string,
      body: {
        status: string;
        reason?: string;
        note?: string;
        resolutionSummary?: string;
      },
    ) => request<ReportDetail>(`/reports/${reportId}/status`, { method: 'PATCH', body }),
    resolve: (reportId: string, body: { resolutionSummary: string; note?: string }) =>
      request<ReportDetail>(`/reports/${reportId}/resolution`, { method: 'POST', body }),
    assign: (
      reportId: string,
      body: { assigneeId: string; departmentId?: string | null; reason?: string },
    ) => request<ReportDetail>(`/reports/${reportId}/assignment`, { method: 'PATCH', body }),
    updateCategory: (reportId: string, category: string) =>
      request<ReportDetail>(`/reports/${reportId}/category`, {
        method: 'PATCH',
        body: { category },
      }),
    updatePriority: (reportId: string, priority: string) =>
      request<ReportDetail>(`/reports/${reportId}/priority`, {
        method: 'PATCH',
        body: { priority },
      }),
    moderate: (reportId: string, body: { visible: boolean; reason?: string }) =>
      request<ReportDetail>(`/reports/${reportId}/moderation`, { method: 'PATCH', body }),
    comment: (
      reportId: string,
      body: { body: string; visibility: Visibility; requestInformation?: boolean },
    ) => request<ReportComment>(`/reports/${reportId}/comments`, { method: 'POST', body }),
    feedback: (reportId: string, body: { rating: number; comment?: string }) =>
      request<Feedback>(`/reports/${reportId}/feedback`, { method: 'POST', body }),
    requestReopen: (reportId: string, note: string) =>
      request<ReportDetail>(`/reports/${reportId}/reopen-request`, {
        method: 'POST',
        body: { note },
      }),
    upload: uploadAttachment,
  },
  admin: {
    dashboard: (params: { from?: Date; to?: Date } = {}) =>
      request<DashboardData>(`/admin/dashboard${queryString({ ...params })}`),
    analytics: (params: { from?: Date; to?: Date } = {}) =>
      request<AnalyticsData>(`/admin/analytics${queryString({ ...params })}`),
    mapPoints: (params: {
      from?: Date;
      to?: Date;
      status?: string[];
      category?: string;
      priority?: string;
    } = {}) => request<MapResponse>(`/admin/map-points${queryString({ ...params })}`),
    staff: (departmentId?: string) =>
      request<StaffMember[]>(`/admin/staff${queryString({ departmentId })}`),
    departments: () => request<DepartmentOption[]>('/admin/departments'),
    createDepartment: (body: {
      name: string;
      description?: string;
      supportedCategories?: string[];
      active?: boolean;
    }) => request<{ id: string }>('/admin/departments', { method: 'POST', body }),
    updateDepartment: (id: string, body: Record<string, unknown>) =>
      request<{ message: string }>(`/admin/departments/${id}`, { method: 'PATCH', body }),
    deactivateDepartment: (id: string) =>
      request<{ message: string }>(`/admin/departments/${id}`, { method: 'DELETE' }),
    categories: () => request<CategoryAdmin[]>('/admin/categories'),
    createCategory: (body: Record<string, unknown>) =>
      request<{ id: string }>('/admin/categories', { method: 'POST', body }),
    updateCategory: (id: string, body: Record<string, unknown>) =>
      request<{ message: string }>(`/admin/categories/${id}`, { method: 'PATCH', body }),
    deactivateCategory: (id: string) =>
      request<{ message: string }>(`/admin/categories/${id}`, { method: 'DELETE' }),
    routingRules: () => request<RoutingRule[]>('/admin/routing-rules'),
    createRoutingRule: (body: { category: string; departmentId: string }) =>
      request<{ id: string }>('/admin/routing-rules', { method: 'POST', body }),
    updateRoutingRule: (id: string, body: { departmentId?: string; active?: boolean }) =>
      request<{ message: string }>(`/admin/routing-rules/${id}`, { method: 'PATCH', body }),
    deleteRoutingRule: (id: string) =>
      request<{ message: string }>(`/admin/routing-rules/${id}`, { method: 'DELETE' }),
    sla: () => request<SlaConfig[]>('/admin/sla-config'),
    createSla: (body: Record<string, unknown>) =>
      request<{ id: string }>('/admin/sla-config', { method: 'POST', body }),
    updateSla: (id: string, body: Record<string, unknown>) =>
      request<{ message: string }>(`/admin/sla-config/${id}`, { method: 'PATCH', body }),
    deleteSla: (id: string) =>
      request<{ message: string }>(`/admin/sla-config/${id}`, { method: 'DELETE' }),
    users: (params: {
      q?: string;
      role?: string;
      departmentId?: string;
      active?: string;
      page?: number;
      pageSize?: number;
    } = {}) => request<UserListResponse>(`/admin/users${queryString({ ...params })}`),
    createUser: (body: {
      name: string;
      email: string;
      password: string;
      role: string;
      departmentIds: string[];
    }) => request<User>(`/admin/users`, { method: 'POST', body }),
    updateUser: (id: string, body: Record<string, unknown>) =>
      request<User>(`/admin/users/${id}`, { method: 'PATCH', body }),
    auditLogs: (params: {
      action?: string;
      entityType?: string;
      entityId?: string;
      page?: number;
      pageSize?: number;
    } = {}) => request<AuditListResponse>(`/admin/audit-logs${queryString({ ...params })}`),
    exportReports,
    overview: () =>
      request<{ reports: number; users: number; departments: number; categories: number }>(
        '/admin/overview',
      ),
  },
  notifications: {
    list: (params: { unreadOnly?: boolean; page?: number; pageSize?: number } = {}) =>
      request<NotificationResponse>(`/notifications${queryString({ ...params })}`),
    markRead: (id: string) =>
      request<{ id: string; readAt: string }>(`/notifications/${id}/read`, {
        method: 'PATCH',
        body: {},
      }),
    markAllRead: () =>
      request<{ updated: number }>('/notifications/read-all', { method: 'PATCH', body: {} }),
    preferences: () =>
      request<{
        preferences: { inApp: boolean; email: boolean };
        emailConfigured: boolean;
        note?: string;
      }>('/notifications/preferences'),
    updatePreferences: (body: { inApp: boolean; email: boolean }) =>
      request<{
        preferences: { inApp: boolean; email: boolean };
        emailConfigured: boolean;
      }>('/notifications/preferences', { method: 'PATCH', body }),
  },
  ai: {
    classify: (body: { title: string; description: string }) =>
      request<ClassifyResult>('/ai/classify-report', { method: 'POST', body }),
    duplicateHints: (body: {
      reportId?: string;
      title?: string;
      description?: string;
      category?: string;
      latitude?: number | null;
      longitude?: number | null;
    }) => request<DuplicateHintsResult>('/ai/duplicate-hints', { method: 'POST', body }),
    summarize: (reportId: string) =>
      request<{
        summary: string;
        source: 'openai' | 'rules';
        aiConfigured: boolean;
        degraded: boolean;
        disclaimer: string;
      }>('/ai/summarize-report', { method: 'POST', body: { reportId } }),
  },
};

export { toCsvDownload } from './utils/download';

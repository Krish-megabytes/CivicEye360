import type { Category, Priority, Report, ReportStatus, Role } from '../types';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const relativeFormatter = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateTimeFormatter.format(date);
}

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return 'just now';
  if (abs < 3600) return relativeFormatter.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86_400) return relativeFormatter.format(Math.round(diffSeconds / 3600), 'hour');
  if (abs < 2_592_000) return relativeFormatter.format(Math.round(diffSeconds / 86_400), 'day');
  if (abs < 31_536_000) return relativeFormatter.format(Math.round(diffSeconds / 2_592_000), 'month');
  return relativeFormatter.format(Math.round(diffSeconds / 31_536_000), 'year');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`;
  const days = Math.floor(hours / 24);
  const remainder = Math.round(hours % 24);
  return remainder > 0 ? `${days}d ${remainder}h` : `${days}d`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function categoryLabel(categories: Category[] | undefined, slug: string): string {
  return categories?.find((category) => category.slug === slug)?.label ?? titleCase(slug);
}

export function titleCase(value: string): string {
  return value
    .replaceAll('-', ' ')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const STATUS_TONE: Record<ReportStatus, string> = {
  Submitted: 'border-info/25 bg-info-soft text-info',
  'Under Review': 'border-warn/25 bg-warn-soft text-warn',
  Assigned: 'border-civic/25 bg-civic-tint text-civic',
  'In Progress': 'border-civic/40 bg-civic text-white',
  Resolved: 'border-good/25 bg-good-soft text-good',
  Closed: 'border-line-strong bg-paper-deep text-ink-soft',
  Rejected: 'border-danger/25 bg-danger-soft text-danger',
  Reopened: 'border-accent/30 bg-accent-soft text-accent',
};

export const PRIORITY_TONE: Record<Priority, string> = {
  Low: 'border-line-strong bg-surface text-ink-muted',
  Medium: 'border-info/25 bg-info-soft text-info',
  High: 'border-accent/30 bg-accent-soft text-accent',
  Urgent: 'border-danger/30 bg-danger-soft text-danger',
};

export const STATUS_DOT: Record<ReportStatus, string> = {
  Submitted: 'bg-info',
  'Under Review': 'bg-warn',
  Assigned: 'bg-civic',
  'In Progress': 'bg-civic',
  Resolved: 'bg-good',
  Closed: 'bg-ink-faint',
  Rejected: 'bg-danger',
  Reopened: 'bg-accent',
};

export const OPEN_STATUSES: ReportStatus[] = [
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Reopened',
];

export const RESOLVED_STATUSES: ReportStatus[] = ['Resolved', 'Closed'];

export function isOpen(status: ReportStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export function isOverdue(report: Pick<Report, 'dueAt' | 'status'>): boolean {
  return Boolean(report.dueAt) && isOpen(report.status) && new Date(report.dueAt!).getTime() < Date.now();
}

export function roleHome(role: Role): string {
  if (role === 'citizen') return '/dashboard';
  if (role === 'ngo') return '/ngo';
  if (role === 'field_staff') return '/staff';
  return '/admin';
}

export function roleLabel(role: Role): string {
  switch (role) {
    case 'citizen':
      return 'Citizen';
    case 'ngo':
      return 'NGO partner';
    case 'field_staff':
      return 'Field staff';
    case 'department_manager':
      return 'Department manager';
    case 'municipal_admin':
      return 'Municipal administrator';
    case 'platform_admin':
      return 'Platform administrator';
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export function getFieldErrors(error: unknown): Record<string, string> {
  if (
    typeof error === 'object' &&
    error !== null &&
    'details' in error &&
    Array.isArray((error as { details: unknown }).details)
  ) {
    const fields: Record<string, string> = {};
    for (const detail of (error as { details: Array<{ field?: string; message?: string }> }).details) {
      if (detail.field && detail.message) fields[detail.field] = detail.message;
    }
    return fields;
  }
  return {};
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

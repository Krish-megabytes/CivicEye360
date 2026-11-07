export const ROLES = [
  'citizen',
  'ngo',
  'field_staff',
  'department_manager',
  'municipal_admin',
  'platform_admin',
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  citizen: 'Citizen',
  ngo: 'NGO partner',
  field_staff: 'Field staff',
  department_manager: 'Department manager',
  municipal_admin: 'Municipal administrator',
  platform_admin: 'Platform administrator',
};

export const REPORT_STATUSES = [
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
  'Closed',
  'Rejected',
  'Reopened',
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const VISIBILITIES = ['citizen', 'internal'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const OPEN_STATUSES: ReportStatus[] = [
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Reopened',
];

export const RESOLVED_STATUSES: ReportStatus[] = ['Resolved', 'Closed'];

/**
 * Valid status transitions. Enforced on the API for every actor; role checks
 * are layered on top in the reports service.
 */
export const STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  Submitted: ['Under Review', 'Rejected'],
  'Under Review': ['Assigned', 'Rejected'],
  Assigned: ['In Progress', 'Under Review', 'Rejected'],
  'In Progress': ['Resolved', 'Under Review'],
  Resolved: ['Closed', 'Reopened'],
  Closed: ['Reopened'],
  Rejected: ['Reopened'],
  Reopened: ['Under Review', 'Assigned', 'Rejected'],
};

export const TRANSITIONS_REQUIRING_REASON: ReportStatus[] = ['Rejected', 'Reopened', 'Closed'];

export const AI_SOURCES = ['openai', 'rules'] as const;
export type AiSource = (typeof AI_SOURCES)[number];

export const NOTIFICATION_TYPES = [
  'report_submitted',
  'report_assigned',
  'report_reassigned',
  'status_changed',
  'information_requested',
  'report_resolved',
  'report_reopened',
  'feedback_requested',
  'comment_added',
  'reopen_requested',
  'system',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const ATTACHMENT_VISIBILITIES = ['citizen', 'internal'] as const;
export type AttachmentVisibility = (typeof ATTACHMENT_VISIBILITIES)[number];

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const DEFAULT_CATEGORIES = [
  { slug: 'roads', label: 'Roads & Potholes', description: 'Road surface damage, potholes and unsafe paving.' },
  { slug: 'streetlights', label: 'Streetlights', description: 'Outages, damaged poles and dark public spaces.' },
  { slug: 'waste', label: 'Waste & Garbage', description: 'Missed collection, illegal dumping and overflowing bins.' },
  { slug: 'drainage', label: 'Drainage', description: 'Blocked drains, flooding and standing water.' },
  { slug: 'water-supply', label: 'Water Supply', description: 'Leaks, outages and water quality concerns.' },
  { slug: 'sanitation', label: 'Sanitation', description: 'Public toilets, cleaning and hygiene issues.' },
  { slug: 'public-property', label: 'Public Property', description: 'Damage to civic buildings, furniture and equipment.' },
  { slug: 'parks', label: 'Parks & Public Spaces', description: 'Playgrounds, trees, benches and shared spaces.' },
  { slug: 'traffic-signs', label: 'Traffic Signs', description: 'Missing, damaged or obscured signs and markings.' },
  { slug: 'other', label: 'Other', description: 'Issues that do not fit another category.' },
] as const;

export const DEFAULT_PRIORITY = 'Medium' satisfies Priority;

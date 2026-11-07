import type { Role } from '../domain/constants.js';

export const PERMISSIONS = [
  'reports.create',
  'reports.read.own',
  'reports.read.assigned',
  'reports.read.department',
  'reports.read.all',
  'reports.triage',
  'reports.assign',
  'reports.update.status',
  'reports.comment.internal',
  'reports.moderate',
  'reports.feedback',
  'reports.reopen.request',
  'dashboard.view',
  'analytics.view',
  'map.view',
  'exports.create',
  'departments.manage',
  'categories.manage',
  'routing.manage',
  'sla.manage',
  'users.manage',
  'audit.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, Permission[]> = {
  citizen: ['reports.create', 'reports.read.own', 'reports.feedback', 'reports.reopen.request'],
  ngo: [],
  field_staff: [
    'reports.read.assigned',
    'reports.update.status',
    'reports.comment.internal',
  ],
  department_manager: [
    'reports.read.department',
    'reports.triage',
    'reports.assign',
    'reports.update.status',
    'reports.comment.internal',
    'dashboard.view',
    'analytics.view',
    'map.view',
    'exports.create',
  ],
  municipal_admin: [
    'reports.read.all',
    'reports.triage',
    'reports.assign',
    'reports.update.status',
    'reports.comment.internal',
    'reports.moderate',
    'dashboard.view',
    'analytics.view',
    'map.view',
    'exports.create',
  ],
  platform_admin: [
    'reports.read.all',
    'reports.triage',
    'reports.assign',
    'reports.update.status',
    'reports.comment.internal',
    'reports.moderate',
    'dashboard.view',
    'analytics.view',
    'map.view',
    'exports.create',
    'departments.manage',
    'categories.manage',
    'routing.manage',
    'sla.manage',
    'users.manage',
    'audit.view',
  ],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: Role): Permission[] {
  return [...(MATRIX[role] ?? [])];
}

export function isCitizen(role: Role): boolean {
  return role === 'citizen' || role === 'ngo';
}

export function isFieldStaff(role: Role): boolean {
  return role === 'field_staff';
}

export function isDepartmentManager(role: Role): boolean {
  return role === 'department_manager';
}

export function isAdminRole(role: Role): boolean {
  return role === 'municipal_admin' || role === 'platform_admin';
}

export function isStaffRole(role: Role): boolean {
  return !['citizen', 'ngo'].includes(role);
}

export function canReadAllReports(role: Role): boolean {
  return can(role, 'reports.read.all');
}

export function canReadDepartmentReports(role: Role): boolean {
  return can(role, 'reports.read.department');
}

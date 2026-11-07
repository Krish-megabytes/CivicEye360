import type { AuthUser } from '../types/auth.js';
import { Department } from '../models/Department.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { ROLE_LABELS, type Role } from '../domain/constants.js';
import { permissionsFor } from '../auth/permissions.js';
import { notFound } from '../lib/errors.js';

export async function loadUserView(userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) throw notFound('User not found.');

  const departments = user.departmentIds?.length
    ? await Department.find({ _id: { $in: user.departmentIds } }).select('name').lean()
    : [];
  const unreadNotifications = await Notification.countDocuments({
    userId: user._id,
    readAt: null,
  });

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: ROLE_LABELS[user.role as Role],
    active: user.active,
    departmentIds: (user.departmentIds ?? []).map(String),
    departments: departments.map((department) => ({
      id: String(department._id),
      name: department.name,
    })),
    notificationPreferences: {
      inApp: user.notificationPreferences?.inApp ?? true,
      email: user.notificationPreferences?.email ?? false,
    },
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    createdAt: user.createdAt,
    permissions: permissionsFor(user.role as Role),
    unreadNotifications,
  };
}

export function actorFromUser(user: {
  _id: unknown;
  name: string;
  email: string;
  role: Role;
  departmentIds?: unknown[];
}): AuthUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    departmentIds: (user.departmentIds ?? []).map(String),
  };
}

export async function activeStaffList(departmentId?: string | null) {
  const filter: Record<string, unknown> = {
    active: true,
    role: { $in: ['field_staff', 'department_manager'] },
  };
  if (departmentId) filter.departmentIds = departmentId;
  const staff = await User.find(filter)
    .select('name email role departmentIds')
    .sort({ name: 1 })
    .lean();
  return staff.map((person) => ({
    id: String(person._id),
    name: person.name,
    role: person.role,
    roleLabel: ROLE_LABELS[person.role as Role],
    departmentIds: (person.departmentIds ?? []).map(String),
  }));
}

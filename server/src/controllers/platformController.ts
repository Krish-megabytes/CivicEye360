import type { Request, Response } from 'express';
import type { AuthUser } from '../types/auth.js';
import { z } from 'zod';
import { Department } from '../models/Department.js';
import { Category } from '../models/Category.js';
import { RoutingRule } from '../models/RoutingRule.js';
import { SlaConfig } from '../models/SlaConfig.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { Report } from '../models/Report.js';
import { hashPassword } from '../auth/passwords.js';
import { ROLE_LABELS, type Role } from '../domain/constants.js';
import { audit } from '../services/auditService.js';
import { loadUserView } from '../services/userService.js';
import { conflict, notFound, unprocessable } from '../lib/errors.js';
import { query } from '../middleware/validate.js';
import {
  adminUserCreateSchema,
  auditQuerySchema,
  categoryAdminSchema,
  categoryUpdateSchemaAdmin,
  departmentSchema,
  departmentUpdateSchema,
  routingRuleSchema,
  routingRuleUpdateSchema,
  slaSchema,
  userAdminSchema,
  userListQuerySchema,
} from '../validation/schemas.js';

function hasStaffRole(role: Role): boolean {
  return ['field_staff', 'department_manager', 'municipal_admin', 'platform_admin'].includes(role);
}

async function departmentsWithCounts() {
  const departments = await Department.find().sort({ name: 1 }).lean();
  const counts = await User.aggregate([
    { $match: { active: true } },
    { $unwind: '$departmentIds' },
    { $group: { _id: '$departmentIds', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((row) => [String(row._id), row.count as number]));
  return departments.map((department) => ({
    id: String(department._id),
    name: department.name,
    description: department.description,
    supportedCategories: department.supportedCategories,
    active: department.active,
    memberCount: countMap.get(String(department._id)) ?? 0,
    updatedAt: department.updatedAt,
  }));
}

export async function listDepartments(_req: Request, res: Response): Promise<void> {
  res.json({ data: await departmentsWithCounts() });
}

export async function createDepartment(req: Request, res: Response): Promise<void> {
  const input = req.body as z.infer<typeof departmentSchema>;
  const existing = await Department.findOne({ name: input.name }).lean();
  if (existing) throw conflict('A department with this name already exists.');
  const department = await Department.create({ ...input, memberIds: [] });
  await audit({
    action: 'department.created',
    entityType: 'Department',
    entityId: String(department._id),
    metadata: { name: department.name },
    req,
  });
  res.status(201).json({ data: { id: String(department._id), ...input } });
}

export async function updateDepartment(req: Request, res: Response): Promise<void> {
  const input = req.body as z.infer<typeof departmentUpdateSchema>;
  const department = await Department.findById(req.params.departmentId);
  if (!department) throw notFound('Department not found.');
  const before = { name: department.name, active: department.active };
  if (input.name && input.name !== department.name) {
    const duplicate = await Department.findOne({ name: input.name, _id: { $ne: department._id } }).lean();
    if (duplicate) throw conflict('A department with this name already exists.');
    department.name = input.name;
  }
  if (input.description !== undefined) department.description = input.description;
  if (input.supportedCategories !== undefined) department.supportedCategories = input.supportedCategories;
  if (input.active !== undefined) department.active = input.active;
  await department.save();

  if (input.active === false) {
    await RoutingRule.updateMany({ departmentId: department._id }, { $set: { active: false } });
  }

  await audit({
    action: 'department.updated',
    entityType: 'Department',
    entityId: String(department._id),
    metadata: { before, after: { name: department.name, active: department.active } },
    req,
  });
  res.json({ data: { message: 'Department updated.' } });
}

export async function deactivateDepartment(req: Request, res: Response): Promise<void> {
  const department = await Department.findById(req.params.departmentId);
  if (!department) throw notFound('Department not found.');
  department.active = false;
  await department.save();
  await RoutingRule.updateMany({ departmentId: department._id }, { $set: { active: false } });
  await audit({
    action: 'department.deactivated',
    entityType: 'Department',
    entityId: String(department._id),
    metadata: { name: department.name },
    req,
  });
  res.json({
    data: {
      message:
        'Department deactivated. Existing reports are retained; routing rules for it were disabled.',
    },
  });
}

export async function listCategories(_req: Request, res: Response): Promise<void> {
  const categories = await Category.find().sort({ sortOrder: 1, label: 1 }).lean();
  res.json({
    data: categories.map((category) => ({
      id: String(category._id),
      slug: category.slug,
      label: category.label,
      description: category.description,
      active: category.active,
      sortOrder: category.sortOrder,
      updatedAt: category.updatedAt,
    })),
  });
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  const input = req.body as z.infer<typeof categoryAdminSchema>;
  const existing = await Category.findOne({ slug: input.slug }).lean();
  if (existing) throw conflict('A category with this slug already exists.');
  const category = await Category.create({ ...input, updatedBy: req.user!.id });
  await audit({
    action: 'category.created',
    entityType: 'Category',
    entityId: String(category._id),
    metadata: { slug: category.slug },
    req,
  });
  res.status(201).json({ data: { id: String(category._id), ...input } });
}

export async function updateCategory(req: Request, res: Response): Promise<void> {
  const input = req.body as z.infer<typeof categoryUpdateSchemaAdmin>;
  const category = await Category.findById(req.params.categoryId);
  if (!category) throw notFound('Category not found.');
  if (input.slug && input.slug !== category.slug) {
    const duplicate = await Category.findOne({ slug: input.slug, _id: { $ne: category._id } }).lean();
    if (duplicate) throw conflict('A category with this slug already exists.');
    const [reportCount, ruleCount] = await Promise.all([
      Report.countDocuments({ category: category.slug }),
      RoutingRule.countDocuments({ category: category.slug }),
    ]);
    if (reportCount > 0 || ruleCount > 0) {
      throw conflict(
        'This category slug is already used by reports or routing rules. Rename the label instead, or deactivate and create a new category.',
      );
    }
    category.slug = input.slug;
  }
  if (input.label !== undefined) category.label = input.label;
  if (input.description !== undefined) category.description = input.description;
  if (input.active !== undefined) category.active = input.active;
  if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder;
  category.updatedBy = req.user!.id as never;
  await category.save();
  if (input.active === false) {
    await RoutingRule.updateMany({ category: category.slug }, { $set: { active: false } });
  }
  await audit({
    action: 'category.updated',
    entityType: 'Category',
    entityId: String(category._id),
    metadata: { slug: category.slug, active: category.active },
    req,
  });
  res.json({ data: { message: 'Category updated.' } });
}

export async function deactivateCategory(req: Request, res: Response): Promise<void> {
  const category = await Category.findById(req.params.categoryId);
  if (!category) throw notFound('Category not found.');
  category.active = false;
  category.updatedBy = req.user!.id as never;
  await category.save();
  await RoutingRule.updateMany({ category: category.slug }, { $set: { active: false } });
  await audit({
    action: 'category.deactivated',
    entityType: 'Category',
    entityId: String(category._id),
    metadata: { slug: category.slug },
    req,
  });
  res.json({
    data: {
      message: 'Category deactivated. Existing reports keep their category history.',
    },
  });
}

export async function listRoutingRules(_req: Request, res: Response): Promise<void> {
  const [rules, departments] = await Promise.all([
    RoutingRule.find().sort({ category: 1 }).lean(),
    Department.find().select('name active').lean(),
  ]);
  const names = new Map(departments.map((department) => [String(department._id), department.name]));
  res.json({
    data: rules.map((rule) => ({
      id: String(rule._id),
      category: rule.category,
      departmentId: String(rule.departmentId),
      departmentName: names.get(String(rule.departmentId)) ?? 'Unknown',
      active: rule.active,
      updatedAt: rule.updatedAt,
    })),
  });
}

async function validateRoutingTarget(category: string, departmentId: string) {
  const [categoryDoc, department] = await Promise.all([
    Category.findOne({ slug: category, active: true }).lean(),
    Department.findOne({ _id: departmentId, active: true }).lean(),
  ]);
  if (!categoryDoc) throw unprocessable('Select an active category.');
  if (!department) throw unprocessable('Select an active department.');
}

export async function createRoutingRule(req: Request, res: Response): Promise<void> {
  const input = req.body as z.infer<typeof routingRuleSchema>;
  await validateRoutingTarget(input.category, input.departmentId);
  const existing = await RoutingRule.findOne({ category: input.category }).lean();
  if (existing) throw conflict('This category already has a routing rule. Edit the existing rule.');
  const rule = await RoutingRule.create({ ...input, updatedBy: req.user!.id });
  await audit({
    action: 'routing_rule.created',
    entityType: 'RoutingRule',
    entityId: String(rule._id),
    metadata: { category: rule.category, departmentId: input.departmentId },
    req,
  });
  res.status(201).json({ data: { id: String(rule._id) } });
}

export async function updateRoutingRule(req: Request, res: Response): Promise<void> {
  const input = req.body as z.infer<typeof routingRuleUpdateSchema>;
  const rule = await RoutingRule.findById(req.params.ruleId);
  if (!rule) throw notFound('Routing rule not found.');
  if (input.departmentId) {
    await validateRoutingTarget(rule.category, input.departmentId);
    rule.departmentId = input.departmentId as never;
  }
  if (input.active !== undefined) rule.active = input.active;
  rule.updatedBy = req.user!.id as never;
  await rule.save();
  await audit({
    action: 'routing_rule.updated',
    entityType: 'RoutingRule',
    entityId: String(rule._id),
    metadata: { active: rule.active, departmentId: String(rule.departmentId) },
    req,
  });
  res.json({ data: { message: 'Routing rule updated.' } });
}

export async function deleteRoutingRule(req: Request, res: Response): Promise<void> {
  const rule = await RoutingRule.findByIdAndDelete(req.params.ruleId);
  if (!rule) throw notFound('Routing rule not found.');
  await audit({
    action: 'routing_rule.deleted',
    entityType: 'RoutingRule',
    entityId: String(rule._id),
    metadata: { category: rule.category },
    req,
  });
  res.json({ data: { message: 'Routing rule removed. New reports will enter the unassigned queue.' } });
}

export async function listSla(_req: Request, res: Response): Promise<void> {
  const configs = await SlaConfig.find().sort({ category: 1, priority: 1 }).lean();
  res.json({
    data: configs.map((config) => ({
      id: String(config._id),
      category: config.category,
      priority: config.priority,
      targetHours: config.targetHours,
      businessCalendar: config.businessCalendar,
      active: config.active,
      updatedAt: config.updatedAt,
    })),
  });
}

export async function createSla(req: Request, res: Response): Promise<void> {
  const input = req.body as z.infer<typeof slaSchema>;
  if (input.category !== '*') {
    const category = await Category.findOne({ slug: input.category, active: true }).lean();
    if (!category) throw unprocessable('Select an active category or "all categories".');
  }
  const existing = await SlaConfig.findOne({ category: input.category, priority: input.priority }).lean();
  if (existing) throw conflict('An SLA configuration already exists for this category and priority.');
  const config = await SlaConfig.create({
    ...input,
    businessCalendar: input.businessCalendar ?? {
      timezone: 'UTC',
      weekdays: [1, 2, 3, 4, 5],
      startHour: 9,
      endHour: 17,
    },
    updatedBy: req.user!.id,
  });
  await audit({
    action: 'sla.created',
    entityType: 'SlaConfig',
    entityId: String(config._id),
    metadata: { category: config.category, priority: config.priority, targetHours: config.targetHours },
    req,
  });
  res.status(201).json({ data: { id: String(config._id) } });
}

export async function updateSla(req: Request, res: Response): Promise<void> {
  const input = req.body as z.infer<typeof slaSchema>;
  const config = await SlaConfig.findById(req.params.slaId);
  if (!config) throw notFound('SLA configuration not found.');
  if (input.category !== '*') {
    const category = await Category.findOne({ slug: input.category, active: true }).lean();
    if (!category) throw unprocessable('Select an active category or "all categories".');
  }
  if (input.category !== config.category || input.priority !== config.priority) {
    const duplicate = await SlaConfig.findOne({
      _id: { $ne: config._id },
      category: input.category,
      priority: input.priority,
    }).lean();
    if (duplicate) throw conflict('An SLA configuration already exists for that pair.');
  }
  config.category = input.category;
  config.priority = input.priority;
  config.targetHours = input.targetHours;
  config.active = input.active ?? true;
  if (input.businessCalendar) config.businessCalendar = input.businessCalendar;
  config.updatedBy = req.user!.id as never;
  await config.save();
  await audit({
    action: 'sla.updated',
    entityType: 'SlaConfig',
    entityId: String(config._id),
    metadata: { category: config.category, priority: config.priority, active: config.active },
    req,
  });
  res.json({ data: { message: 'SLA configuration updated. Existing due dates are not recalculated.' } });
}

export async function deleteSla(req: Request, res: Response): Promise<void> {
  const config = await SlaConfig.findByIdAndDelete(req.params.slaId);
  if (!config) throw notFound('SLA configuration not found.');
  await audit({
    action: 'sla.deleted',
    entityType: 'SlaConfig',
    entityId: String(config._id),
    metadata: { category: config.category, priority: config.priority },
    req,
  });
  res.json({ data: { message: 'SLA configuration removed. New reports will not receive a due date.' } });
}

async function userDepartmentNames(ids: string[]) {
  if (ids.length === 0) return [];
  const departments = await Department.find({ _id: { $in: ids } }).select('name').lean();
  return departments.map((department) => ({ id: String(department._id), name: department.name }));
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  const params = query<z.infer<typeof userListQuerySchema>>(res);
  const filter: Record<string, unknown> = {};
  if (params.role) filter.role = params.role;
  if (params.departmentId) filter.departmentIds = params.departmentId;
  if (params.active) filter.active = params.active === 'true';
  if (params.q) {
    const regex = new RegExp(params.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: regex }, { email: regex }];
  }
  const page = params.page;
  const pageSize = params.pageSize;
  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);
  const departmentIds = [...new Set(users.flatMap((user) => (user.departmentIds ?? []).map(String)))];
  const departments = await userDepartmentNames(departmentIds);
  const departmentMap = new Map(departments.map((department) => [department.id, department.name]));

  res.json({
    data: users.map((user) => ({
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role as Role],
      active: user.active,
      departmentIds: (user.departmentIds ?? []).map(String),
      departments: (user.departmentIds ?? []).map((id) => ({
        id: String(id),
        name: departmentMap.get(String(id)) ?? 'Unknown',
      })),
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

async function validateDepartmentList(departmentIds: string[]) {
  if (departmentIds.length === 0) return;
  const count = await Department.countDocuments({ _id: { $in: departmentIds }, active: true });
  if (count !== departmentIds.length) {
    throw unprocessable('One or more selected departments are unavailable.');
  }
}

export async function createUser(req: Request, res: Response): Promise<void> {
  const input = req.body as z.infer<typeof adminUserCreateSchema>;
  const existing = await User.findOne({ email: input.email }).lean();
  if (existing) throw conflict('An account with this email already exists.');
  if (input.role !== 'citizen') {
    if (input.departmentIds.length === 0) {
      throw unprocessable('Staff accounts need at least one department.');
    }
    await validateDepartmentList(input.departmentIds);
  }
  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    role: input.role,
    departmentIds: input.role === 'citizen' ? [] : input.departmentIds,
    notificationPreferences: { inApp: true, email: false },
    active: true,
    tokenVersion: 0,
  });
  await audit({
    action: 'user.created',
    entityType: 'User',
    entityId: String(user._id),
    metadata: { role: input.role, departmentIds: input.departmentIds },
    req,
  });
  res.status(201).json({ data: await loadUserView(String(user._id)) });
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  const input = req.body as z.infer<typeof userAdminSchema>;
  const target = await User.findById(req.params.userId);
  if (!target) throw notFound('User not found.');

  const actor = req.user!;
  if (String(target._id) === actor.id && (input.role || input.active === false)) {
    throw conflict('You cannot change your own role or deactivate your own account.');
  }

  const wasPlatformAdmin = target.role === 'platform_admin' && target.active;
  const willRemainPlatformAdmin =
    (input.role ?? target.role) === 'platform_admin' && (input.active ?? target.active);
  if (wasPlatformAdmin && !willRemainPlatformAdmin) {
    const others = await User.countDocuments({
      role: 'platform_admin',
      active: true,
      _id: { $ne: target._id },
    });
    if (others === 0) throw conflict('At least one active platform administrator must remain.');
  }

  if (input.departmentIds) await validateDepartmentList(input.departmentIds);
  const nextRole = input.role ?? target.role;
  if (hasStaffRole(nextRole) && nextRole !== 'municipal_admin' && nextRole !== 'platform_admin') {
    const departments = input.departmentIds ?? (target.departmentIds ?? []).map(String);
    if (departments.length === 0) throw unprocessable('Staff accounts need at least one department.');
  }

  const before = {
    role: target.role,
    active: target.active,
    departmentIds: (target.departmentIds ?? []).map(String),
  };

  if (input.name) target.name = input.name;
  if (input.role) target.role = input.role;
  if (input.active !== undefined) target.active = input.active;
  if (input.departmentIds) {
    target.departmentIds = (nextRole === 'citizen' ? [] : input.departmentIds) as never;
  } else if (nextRole === 'citizen') {
    target.departmentIds = [] as never;
  }
  if (input.role || input.active === false) target.tokenVersion += 1;
  await target.save();

  await audit({
    action: 'user.updated',
    entityType: 'User',
    entityId: String(target._id),
    metadata: {
      before,
      after: {
        role: target.role,
        active: target.active,
        departmentIds: (target.departmentIds ?? []).map(String),
      },
    },
    req,
  });

  res.json({ data: await loadUserView(String(target._id)) });
}

export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const params = query<z.infer<typeof auditQuerySchema>>(res);
  const filter: Record<string, unknown> = {};
  if (params.action) filter.action = params.action;
  if (params.entityType) filter.entityType = params.entityType;
  if (params.entityId) filter.entityId = params.entityId;
  if (params.from || params.to) {
    filter.createdAt = {
      ...(params.from ? { $gte: params.from } : {}),
      ...(params.to ? { $lte: params.to } : {}),
    };
  }
  const page = params.page;
  const pageSize = params.pageSize;
  const [total, rows] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);
  const actorIds = [...new Set(rows.map((row) => String(row.actorId ?? '')).filter(Boolean))];
  const actors = actorIds.length
    ? await User.find({ _id: { $in: actorIds } }).select('name email role').lean()
    : [];
  const actorMap = new Map(actors.map((actor) => [String(actor._id), actor]));

  res.json({
    data: rows.map((row) => ({
      id: String(row._id),
      actor: row.actorId
        ? {
            id: String(row.actorId),
            name: actorMap.get(String(row.actorId))?.name ?? 'Deleted user',
            role: row.actorRole,
          }
        : null,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: row.metadata,
      requestId: row.requestId,
      createdAt: row.createdAt,
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

export async function adminOverviewCounts(_req: Request, res: Response): Promise<void> {
  const [reports, users, departments, categories] = await Promise.all([
    Report.countDocuments({}),
    User.countDocuments({ active: true }),
    Department.countDocuments({ active: true }),
    Category.countDocuments({ active: true }),
  ]);
  res.json({ data: { reports, users, departments, categories } });
}

export function userDisplayName(user: AuthUser): string {
  return `${user.name} (${ROLE_LABELS[user.role]})`;
}

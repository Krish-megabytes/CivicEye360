import { Router } from 'express';
import { authenticate, requirePermission, requireStaff } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { exportLimiter } from '../middleware/rateLimit.js';
import {
  analytics,
  dashboard,
  exportCsv,
  mapPoints,
  staff,
} from '../controllers/adminReportsController.js';
import {
  adminOverviewCounts,
  createCategory,
  createDepartment,
  createRoutingRule,
  createSla,
  createUser,
  deactivateCategory,
  deactivateDepartment,
  deleteRoutingRule,
  deleteSla,
  listAuditLogs,
  listCategories,
  listDepartments,
  listRoutingRules,
  listSla,
  listUsers,
  updateCategory,
  updateDepartment,
  updateRoutingRule,
  updateSla,
  updateUser,
} from '../controllers/platformController.js';
import {
  adminUserCreateSchema,
  analyticsQuerySchema,
  auditQuerySchema,
  categoryAdminSchema,
  categoryUpdateSchemaAdmin,
  departmentSchema,
  departmentUpdateSchema,
  listQuerySchema,
  mapQuerySchema,
  routingRuleSchema,
  routingRuleUpdateSchema,
  slaSchema,
  staffQuerySchema,
  userAdminSchema,
  userListQuerySchema,
} from '../validation/schemas.js';

export const adminRouter = Router();
adminRouter.use(authenticate, requireStaff);

adminRouter.get('/dashboard', requirePermission('dashboard.view'), validateQuery(analyticsQuerySchema), dashboard);
adminRouter.get('/analytics', requirePermission('analytics.view'), validateQuery(analyticsQuerySchema), analytics);
adminRouter.get(
  '/analytics/export',
  requirePermission('exports.create'),
  exportLimiter,
  validateQuery(listQuerySchema),
  exportCsv,
);
adminRouter.get('/map-points', requirePermission('map.view'), validateQuery(mapQuerySchema), mapPoints);
adminRouter.get('/staff', requirePermission('reports.assign'), validateQuery(staffQuerySchema), staff);
adminRouter.get('/overview', requirePermission('dashboard.view'), adminOverviewCounts);

// Departments: read is needed for assignment and management; writes are platform-admin only.
adminRouter.get('/departments', requirePermission('reports.assign'), listDepartments);
adminRouter.post('/departments', requirePermission('departments.manage'), validateBody(departmentSchema), createDepartment);
adminRouter.patch(
  '/departments/:departmentId',
  requirePermission('departments.manage'),
  validateBody(departmentUpdateSchema),
  updateDepartment,
);
adminRouter.delete(
  '/departments/:departmentId',
  requirePermission('departments.manage'),
  deactivateDepartment,
);

adminRouter.get('/categories', requirePermission('categories.manage'), listCategories);
adminRouter.post('/categories', requirePermission('categories.manage'), validateBody(categoryAdminSchema), createCategory);
adminRouter.patch(
  '/categories/:categoryId',
  requirePermission('categories.manage'),
  validateBody(categoryUpdateSchemaAdmin),
  updateCategory,
);
adminRouter.delete(
  '/categories/:categoryId',
  requirePermission('categories.manage'),
  deactivateCategory,
);

adminRouter.get('/routing-rules', requirePermission('routing.manage'), listRoutingRules);
adminRouter.post('/routing-rules', requirePermission('routing.manage'), validateBody(routingRuleSchema), createRoutingRule);
adminRouter.patch(
  '/routing-rules/:ruleId',
  requirePermission('routing.manage'),
  validateBody(routingRuleUpdateSchema),
  updateRoutingRule,
);
adminRouter.delete('/routing-rules/:ruleId', requirePermission('routing.manage'), deleteRoutingRule);

adminRouter.get('/sla-config', requirePermission('sla.manage'), listSla);
adminRouter.post('/sla-config', requirePermission('sla.manage'), validateBody(slaSchema), createSla);
adminRouter.patch('/sla-config/:slaId', requirePermission('sla.manage'), validateBody(slaSchema), updateSla);
adminRouter.delete('/sla-config/:slaId', requirePermission('sla.manage'), deleteSla);

adminRouter.get('/users', requirePermission('users.manage'), validateQuery(userListQuerySchema), listUsers);
adminRouter.post('/users', requirePermission('users.manage'), validateBody(adminUserCreateSchema), createUser);
adminRouter.patch('/users/:userId', requirePermission('users.manage'), validateBody(userAdminSchema), updateUser);

adminRouter.get('/audit-logs', requirePermission('audit.view'), validateQuery(auditQuerySchema), listAuditLogs);

import type { Request, Response } from 'express';
import { z } from 'zod';
import { getAnalytics, getDashboard, getMapPoints } from '../services/analyticsService.js';
import { exportReportRows } from '../services/reportService.js';
import { activeStaffList } from '../services/userService.js';
import { audit } from '../services/auditService.js';
import { resolveRange } from '../lib/dates.js';
import { toCsv } from '../lib/csv.js';
import { toReportFilters } from '../lib/reportFilters.js';
import { query } from '../middleware/validate.js';
import {
  analyticsQuerySchema,
  listQuerySchema,
  mapQuerySchema,
  staffQuerySchema,
} from '../validation/schemas.js';

export async function dashboard(req: Request, res: Response): Promise<void> {
  const params = query<z.infer<typeof analyticsQuerySchema>>(res);
  const range = resolveRange(params.from, params.to, 30);
  res.json({ data: await getDashboard(req.user!, range) });
}

export async function analytics(req: Request, res: Response): Promise<void> {
  const params = query<z.infer<typeof analyticsQuerySchema>>(res);
  const range = resolveRange(params.from, params.to, 90);
  res.json({ data: await getAnalytics(req.user!, range) });
}

export async function mapPoints(req: Request, res: Response): Promise<void> {
  const params = query<z.infer<typeof mapQuerySchema>>(res);
  const range =
    params.from || params.to ? resolveRange(params.from, params.to, 90) : undefined;
  res.json({
    data: await getMapPoints(req.user!, {
      range,
      statuses: params.status,
      category: params.category,
      priority: params.priority,
    }),
  });
}

export async function staff(_req: Request, res: Response): Promise<void> {
  const params = query<z.infer<typeof staffQuerySchema>>(res);
  res.json({ data: await activeStaffList(params.departmentId) });
}

export async function exportCsv(req: Request, res: Response): Promise<void> {
  const filters = toReportFilters(query<z.infer<typeof listQuerySchema>>(res));
  const rows = await exportReportRows(req.user!, filters, 5000);

  const csv = toCsv(rows, [
    { header: 'Reference', value: (row) => row.report.reportId },
    { header: 'Title', value: (row) => row.report.title },
    { header: 'Category', value: (row) => row.report.category },
    { header: 'Status', value: (row) => row.report.status },
    { header: 'Priority', value: (row) => row.report.priority },
    { header: 'Department', value: (row) => row.departmentName },
    { header: 'Assignee', value: (row) => row.assigneeName },
    { header: 'Address', value: (row) => row.report.location.address },
    { header: 'Created (UTC)', value: (row) => new Date(row.report.createdAt).toISOString() },
    {
      header: 'Due (UTC)',
      value: (row) => (row.report.dueAt ? new Date(row.report.dueAt).toISOString() : ''),
    },
    {
      header: 'Resolved (UTC)',
      value: (row) => (row.report.resolvedAt ? new Date(row.report.resolvedAt).toISOString() : ''),
    },
  ]);

  await audit({
    action: 'reports.exported',
    entityType: 'Report',
    metadata: {
      count: rows.length,
      filters: {
        statuses: filters.statuses ?? null,
        category: filters.category ?? null,
        priority: filters.priority ?? null,
        departmentId: filters.departmentId ?? null,
        from: filters.from ?? null,
        to: filters.to ?? null,
      },
    },
    req,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="civiceye-reports-${stamp}.csv"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(csv);
}

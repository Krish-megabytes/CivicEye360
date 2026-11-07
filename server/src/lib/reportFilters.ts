import type { ReportListFilters } from '../services/reportService.js';
import type { Priority, ReportStatus } from '../domain/constants.js';

export interface RawListQuery {
  q?: string;
  status?: ReportStatus[];
  category?: string;
  priority?: Priority;
  departmentId?: string;
  assigneeId?: string;
  unassigned?: 'true' | 'false';
  overdue?: 'true' | 'false';
  from?: Date;
  to?: Date;
  sort?: 'createdAt' | 'updatedAt' | 'dueAt' | 'reportId';
  order?: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export function toReportFilters(input: RawListQuery): ReportListFilters {
  return {
    q: input.q,
    statuses: input.status,
    category: input.category,
    priority: input.priority,
    departmentId: input.departmentId,
    assigneeId: input.assigneeId,
    unassigned: input.unassigned === 'true',
    overdue: input.overdue === 'true',
    from: input.from,
    to: input.to,
    sort: input.sort,
    order: input.order,
    page: input.page,
    pageSize: input.pageSize,
  };
}

import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { Category, Report } from '../../types';
import {
  categoryLabel,
  formatDate,
  formatRelative,
  isOverdue,
} from '../../utils/format';
import { Badge, PriorityBadge, StatusBadge } from '../ui/base';

export function ReportTable({
  reports,
  categories,
  basePath,
  showDepartment = false,
  showReporter = false,
}: {
  reports: Report[];
  categories: Category[];
  basePath: string;
  showDepartment?: boolean;
  showReporter?: boolean;
}) {
  return (
    <div>
      <table className="table-shell hidden md:table">
        <caption className="sr-only">Reports</caption>
        <thead>
          <tr>
            <th scope="col">Reference / issue</th>
            <th scope="col">Category</th>
            <th scope="col">Status</th>
            <th scope="col">Priority</th>
            <th scope="col">{showDepartment ? 'Department' : 'Created'}</th>
            <th scope="col">Updated</th>
            <th scope="col"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {reports.map((report) => (
            <tr key={report.id}>
              <td>
                <div className="flex items-start gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] text-ink-faint">{report.reportId}</p>
                    <Link
                      to={`${basePath}/${report.reportId}`}
                      className="mt-0.5 block max-w-[310px] truncate text-[13px] font-semibold text-ink hover:text-civic hover:underline"
                    >
                      {report.title}
                    </Link>
                    {showReporter && report.reporter ? (
                      <p className="mt-0.5 text-[10px] text-ink-muted">Reported by {report.reporter.name}</p>
                    ) : null}
                  </div>
                  {isOverdue(report) ? <Badge tone="danger">Overdue</Badge> : null}
                </div>
              </td>
              <td className="whitespace-nowrap text-[11px] text-ink-muted">
                {categoryLabel(categories, report.category)}
              </td>
              <td><StatusBadge status={report.status} /></td>
              <td><PriorityBadge priority={report.priority} /></td>
              <td className="text-[11px] text-ink-muted">
                {showDepartment ? report.department?.name ?? 'Unassigned' : formatDate(report.createdAt)}
              </td>
              <td className="whitespace-nowrap text-[11px] text-ink-muted" title={formatDate(report.updatedAt)}>
                {formatRelative(report.updatedAt)}
              </td>
              <td>
                <Link
                  to={`${basePath}/${report.reportId}`}
                  className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-civic hover:underline"
                >
                  Open <ArrowUpRight aria-hidden="true" className="size-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-line md:hidden">
        {reports.map((report) => (
          <li key={report.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[9px] text-ink-faint">{report.reportId}</span>
              <span className="text-[10px] text-ink-muted">{formatRelative(report.updatedAt)}</span>
            </div>
            <Link
              to={`${basePath}/${report.reportId}`}
              className="mt-1 block text-[13px] font-semibold leading-snug text-ink hover:text-civic"
            >
              {report.title}
            </Link>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={report.status} />
              <PriorityBadge priority={report.priority} />
              <span className="text-[10px] text-ink-muted">{categoryLabel(categories, report.category)}</span>
              {showDepartment ? (
                <span className="text-[10px] text-ink-muted">· {report.department?.name ?? 'Unassigned'}</span>
              ) : null}
              {isOverdue(report) ? <Badge tone="danger">Overdue</Badge> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

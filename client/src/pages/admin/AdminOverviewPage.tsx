import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, ErrorState, LoadingPanel, PageHeader, Panel, StatusBadge } from '../../components/ui/base';
import { api } from '../../api';
import { getErrorMessage } from '../../utils/format';
import { useDashboard } from '../../hooks/queries';

function queueHref(label: string): string {
  if (label === 'New') return '/admin/reports?status=Submitted';
  if (label === 'Unassigned') return '/admin/reports?unassigned=true';
  if (label === 'Urgent') return '/admin/reports?priority=Urgent';
  if (label === 'Reopened') return '/admin/reports?status=Reopened';
  return '/admin/reports';
}

export function AdminOverviewPage() {
  const dashboard = useDashboard({});
  const config = useQuery({ queryKey: ['public-config'], queryFn: api.publicConfig });
  if (dashboard.isLoading) return <LoadingPanel rows={7} />;
  if (dashboard.isError || !dashboard.data) {
    return (
      <ErrorState
        message={dashboard.error ? getErrorMessage(dashboard.error) : 'Dashboard could not load'}
        onRetry={() => void dashboard.refetch()}
      />
    );
  }
  const d = dashboard.data;
  return (
    <div>
      <PageHeader
        eyebrow="Municipal operations"
        title="Overview"
        description={`Data from persisted reports · ${d.range.timezone} · ${d.scope}`}
      />
      {!config.data?.slaConfigured ? (
        <Alert className="mb-4" tone="info" title="Service targets not configured">
          Overdue counts are therefore omitted; no service deadline is promised.
        </Alert>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ['Reports in period', d.kpis.totalReports, d.definitions.totalReports],
            ['Unassigned', d.kpis.unassigned, d.definitions.unassigned],
            ['High / urgent', d.kpis.highPriority, 'Open reports marked High or Urgent'],
            [
              'Resolved',
              d.kpis.resolved,
              `Median resolution: ${d.kpis.medianResolutionHours === null ? 'not available' : `${d.kpis.medianResolutionHours} hours`}`,
            ],
          ] as const
        ).map(([label, value, detail]) => (
          <Panel key={String(label)} className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">{label}</p>
            <p className="mt-2 text-[1.9rem] font-bold leading-none tabular-nums tracking-[-0.03em] text-ink">
              {value}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">{detail}</p>
          </Panel>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="border-b border-line p-4">
            <h2 className="text-sm font-semibold text-ink">Operational queues</h2>
            <p className="mt-1 text-[11px] text-ink-muted">
              Counts are live and filtered to your authorization scope.
            </p>
          </div>
          <div className="divide-y divide-line">
            {(
              [
                ['New', d.queues.new],
                ['Unassigned', d.queues.unassigned],
                ['Urgent', d.queues.urgent],
                ['Reopened', d.queues.reopened],
              ] as const
            ).map(([label, count]) => (
              <Link
                key={label}
                to={queueHref(label)}
                className="flex items-center justify-between px-4 py-3 text-xs hover:bg-paper"
              >
                <span>{label}</span>
                <strong className="font-mono text-ink">{count}</strong>
              </Link>
            ))}
          </div>
          <Link
            to="/admin/reports"
            className="block border-t border-line px-4 py-3 text-xs font-semibold text-civic"
          >
            Open report queue →
          </Link>
        </Panel>
        <Panel>
          <div className="border-b border-line p-4">
            <h2 className="text-sm font-semibold text-ink">Department workload</h2>
            <p className="mt-1 text-[11px] text-ink-muted">Open and resolved counts from stored reports.</p>
          </div>
          <div className="divide-y divide-line">
            {d.departmentWorkload.length ? (
              d.departmentWorkload.map((dept) => (
                <div key={dept.departmentId ?? dept.department} className="px-4 py-3">
                  <div className="flex justify-between text-xs">
                    <strong>{dept.department}</strong>
                    <span>{dept.total} total</span>
                  </div>
                  <div className="mt-1 flex gap-3 text-[10px] text-ink-muted">
                    <span>{dept.open} open</span>
                    <span>{dept.resolved} resolved</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-paper-deep">
                    <div
                      className="h-full bg-civic"
                      style={{ width: `${dept.total ? Math.min(100, (dept.open / dept.total) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="p-4 text-xs text-ink-muted">No department report data in this period.</p>
            )}
          </div>
        </Panel>
      </div>
      <Panel className="mt-4">
        <div className="border-b border-line p-4">
          <h2 className="text-sm font-semibold text-ink">Recent reports</h2>
        </div>
        {d.recentReports.length ? (
          <div className="divide-y divide-line">
            {d.recentReports.map((report) => (
              <Link
                key={report.id}
                to={`/admin/reports/${encodeURIComponent(report.reportId)}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-paper"
              >
                <div>
                  <p className="text-xs font-semibold text-ink">{report.title}</p>
                  <p className="mt-1 font-mono text-[10px] text-ink-muted">
                    {report.reportId} · {report.location.address}
                  </p>
                </div>
                <StatusBadge status={report.status} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="p-4 text-xs text-ink-muted">No reports recorded in the selected period.</p>
        )}
      </Panel>
    </div>
  );
}

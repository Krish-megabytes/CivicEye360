import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Bell, MapPin, Plus } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api';
import { useNotifications, useReportList } from '../../hooks/queries';
import {
  Alert,
  EmptyState,
  LinkButton,
  PageHeader,
  Panel,
  StatusBadge,
} from '../../components/ui/base';
import { HelpTip } from '../../components/ui/overlays';
import { formatRelative, getErrorMessage } from '../../utils/format';

export function CitizenDashboardPage() {
  const { user } = useAuth();
  const summaryQuery = useQuery({
    queryKey: ['reports', 'summary'],
    queryFn: api.reports.summary,
  });
  const reportsQuery = useReportList('my', {
    page: 1,
    pageSize: 5,
    sort: 'updatedAt',
    order: 'desc',
  });
  const notificationsQuery = useNotifications({ page: 1, pageSize: 4 });
  const mapQuery = useQuery({
    queryKey: ['citizen', 'offline-map'],
    queryFn: async () => {
      const response = await api.reports.my({ page: 1, pageSize: 100, sort: 'createdAt', order: 'desc' });
      return response.data.filter(
        (report) => report.location.latitude !== null && report.location.longitude !== null,
      ).length;
    },
  });

  const summary = summaryQuery.data;
  const firstName = user?.name.split(' ')[0] ?? 'there';

  return (
    <div>
      <PageHeader
        eyebrow="Citizen dashboard"
        title={`Your civic reports, ${firstName}.`}
        description="A compact view of what you reported and what changed. Open a page for the full list or the map."
        actions={
          <>
            <LinkButton to="/dashboard/reports" variant="secondary">
              My reports
            </LinkButton>
            <LinkButton to="/reports/new">
              <Plus aria-hidden="true" className="size-4" />
              Report an issue
            </LinkButton>
          </>
        }
      />

      <section aria-label="Report summary" className="panel mb-5">
        <div className="grid grid-cols-2 divide-x divide-y divide-line md:grid-cols-4 md:divide-y-0">
          {[
            {
              key: 'submitted',
              label: 'Submitted',
              value: summary?.submitted ?? 0,
              statusFilter: 'Submitted',
              definition: summary?.definitions.submitted,
            },
            {
              key: 'review',
              label: 'In review',
              value: summary?.underReview ?? 0,
              statusFilter: 'Under Review',
              definition: summary?.definitions.underReview,
            },
            {
              key: 'progress',
              label: 'In progress',
              value: summary?.inProgress ?? 0,
              statusFilter: 'In Progress',
              definition: summary?.definitions.inProgress,
            },
            {
              key: 'resolved',
              label: 'Resolved / closed',
              value: summary?.resolvedTotal ?? 0,
              statusFilter: 'Resolved',
              definition: summary?.definitions.resolvedTotal,
            },
          ].map((metric) => (
            <div key={metric.key} className="px-4 py-3.5">
              <div className="flex items-center gap-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted">
                  {metric.label}
                </p>
                {metric.definition ? (
                  <HelpTip label={`Definition of ${metric.label}`}>{metric.definition}</HelpTip>
                ) : null}
              </div>
              <p className="mt-1.5 text-[1.8rem] font-semibold leading-none tabular-nums text-ink">
                {summaryQuery.isLoading ? '—' : metric.value}
              </p>
              <Link
                to={`/dashboard/reports?status=${encodeURIComponent(metric.statusFilter)}`}
                className="mt-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-civic hover:underline"
              >
                View reports <ArrowRight aria-hidden="true" className="size-3" />
              </Link>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-[#fbfaf6] px-4 py-2">
          <p className="text-[10px] text-ink-muted">
            {summary ? `${summary.total} report${summary.total === 1 ? '' : 's'} in total` : 'Loading counts'} ·
            Counts come from your stored records.
          </p>
          <Link to="/help#statuses" className="text-[10px] font-semibold text-civic hover:underline">
            What the statuses mean
          </Link>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_308px]">
        <Panel className="min-w-0 self-start">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Recent reports</h2>
            <Link to="/dashboard/reports" className="text-[10px] font-semibold text-civic hover:underline">
              View all {reportsQuery.data?.pagination.total ?? 0}
            </Link>
          </div>
          {reportsQuery.isError ? (
            <div className="px-4 py-5">
              <Alert tone="error" title="Reports unavailable">
                {getErrorMessage(reportsQuery.error)}
              </Alert>
            </div>
          ) : reportsQuery.isLoading ? (
            <div className="space-y-2 p-4" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse border border-line bg-paper" />
              ))}
            </div>
          ) : reportsQuery.data && reportsQuery.data.data.length > 0 ? (
            <ul className="divide-y divide-line">
              {reportsQuery.data.data.map((report) => (
                <li key={report.id}>
                  <Link
                    to={`/reports/${encodeURIComponent(report.reportId)}`}
                    className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-paper"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={report.status} subtle />
                        <span className="font-mono text-[10px] text-ink-faint">{report.reportId}</span>
                      </div>
                      <p className="mt-1.5 truncate text-sm font-medium text-ink">{report.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-ink-muted">
                        <MapPin aria-hidden="true" className="size-3" />
                        {report.location.address}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] text-ink-faint">
                      {formatRelative(report.updatedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="You have not submitted a report yet"
              description="Report a pothole, streetlight, waste, drainage or other non-emergency civic issue. You will receive a reference and a secure tracking code."
              action={
                <LinkButton to="/reports/new" size="sm">
                  Report an issue
                </LinkButton>
              }
            />
          )}
          <div className="border-t border-line px-4 py-2.5">
            <Link to="/dashboard/reports" className="inline-flex items-center gap-1 text-[11px] font-semibold text-civic hover:underline">
              Open all reports with filters
              <ArrowRight aria-hidden="true" className="size-3" />
            </Link>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Bell aria-hidden="true" className="size-3.5 text-ink-muted" />
                Recent notifications
              </h2>
              <Link to="/notifications" className="text-[10px] font-semibold text-civic hover:underline">
                View all
              </Link>
            </div>
            {notificationsQuery.isLoading ? (
              <div className="space-y-2 p-4">
                <div className="h-3 w-3/4 animate-pulse rounded bg-line" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-line" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-line" />
              </div>
            ) : notificationsQuery.data && notificationsQuery.data.data.length > 0 ? (
              <ul className="divide-y divide-line">
                {notificationsQuery.data.data.map((notification) => (
                  <li key={notification.id} className="px-4 py-2.5">
                    <div className="flex items-start gap-2">
                      {!notification.readAt ? (
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-civic" aria-label="Unread" />
                      ) : null}
                      <div className="min-w-0">
                        {notification.report ? (
                          <Link
                            to={notification.report.link}
                            className="text-[11px] font-medium leading-snug text-ink hover:text-civic"
                          >
                            {notification.message}
                          </Link>
                        ) : (
                          <p className="text-[11px] leading-snug text-ink">{notification.message}</p>
                        )}
                        <p className="mt-0.5 text-[10px] text-ink-faint">
                          {formatRelative(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-5">
                <p className="text-[11px] leading-relaxed text-ink-muted">
                  No notifications yet. Updates about your reports will appear here.
                </p>
              </div>
            )}
          </Panel>

          <Panel>
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                <MapPin aria-hidden="true" className="size-3.5 text-ink-muted" />
                Report map
              </h2>
              <span className="text-[10px] text-ink-muted">{mapQuery.data ?? 0} mapped</span>
            </div>
            <div className="px-4 py-3">
              <p className="text-[11px] leading-relaxed text-ink-muted">
                See your reports on an offline map. Locations are private to your account.
              </p>
              <LinkButton to="/dashboard/map" variant="secondary" size="sm" className="mt-2.5 w-full">
                Open map
              </LinkButton>
            </div>
          </Panel>

          <Panel className="bg-[#fbfaf6]">
            <div className="px-4 py-3.5">
              <p className="eyebrow">After you submit</p>
              <ol className="mt-2 space-y-2">
                {[
                  ['01', 'A person reviews the report', 'Category and priority are confirmed.'],
                  ['02', 'The responsible team is assigned', 'You can see the department on your report.'],
                  ['03', 'Work is documented', 'Progress updates and a resolution summary are recorded.'],
                ].map(([number, label, detail]) => (
                  <li key={number} className="flex gap-2.5">
                    <span className="font-mono text-[9px] font-semibold text-ink-faint">{number}</span>
                    <div>
                      <p className="text-[11px] font-semibold text-ink">{label}</p>
                      <p className="text-[10px] leading-relaxed text-ink-muted">{detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link to="/help" className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-semibold text-civic">
                Read the help centre <ArrowRight className="size-3" />
              </Link>
            </div>
          </Panel>

          {summary && summary.open > 0 ? (
            <Alert tone="info" title="Something changed?">
              You can add follow-up information or request a reopening review from the report page.
              Staff may need to review the request before the status changes.
            </Alert>
          ) : null}
        </div>
      </div>
    </div>
  );
}

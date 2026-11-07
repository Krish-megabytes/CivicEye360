import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api, ApiError } from '../../api';
import { ReportTable } from '../../components/reports/ReportTable';
import {
  Button,
  ErrorState,
  Field,
  Input,
  LoadingPanel,
  PageHeader,
  Pagination,
  Panel,
  Select,
  StatusBadge,
} from '../../components/ui/base';
import { useToast } from '../../components/ui/Toast';
import { useCategories } from '../../hooks/queries';
import { getErrorMessage } from '../../utils/format';
import type { ReportStatus } from '../../types';

const STATUSES: ReportStatus[] = [
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
  'Closed',
  'Rejected',
  'Reopened',
];
const PRIORITIES = ['Urgent', 'High', 'Medium', 'Low'] as const;

export function AdminReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(() => searchParams.get('q') ?? '');
  const [status, setStatus] = useState(() => searchParams.get('status') ?? '');
  const [category, setCategory] = useState(() => searchParams.get('category') ?? '');
  const [priority, setPriority] = useState(() => searchParams.get('priority') ?? '');
  const unassigned = searchParams.get('unassigned') === 'true';
  const [page, setPage] = useState(() => {
    const p = Number(searchParams.get('page'));
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [busy, setBusy] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const qc = useQueryClient();
  const toast = useToast();
  const categoryQuery = useCategories();

  const query = useQuery({
    queryKey: ['admin-reports', { q, status, category, priority, unassigned, page }],
    queryFn: () =>
      api.reports.list({
        q: q || undefined,
        status: status ? [status] : undefined,
        category: category || undefined,
        priority: priority || undefined,
        unassigned: unassigned || undefined,
        page,
        pageSize: 20,
        sort: 'createdAt',
        order: 'desc',
      }),
  });

  function updateParams(next: Record<string, string | undefined>) {
    const merged = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (!value) merged.delete(key);
      else merged.set(key, value);
    }
    setSearchParams(merged, { replace: true });
  }

  async function change(reportId: string, next: ReportStatus) {
    setBusy(reportId);
    setErrors((c) => ({ ...c, [reportId]: '' }));
    try {
      await api.reports.updateStatus(reportId, {
        status: next,
        reason: ['Rejected', 'Reopened'].includes(next) ? 'Reviewed by authorized staff' : '',
        note: 'Status updated from operations queue.',
      });
      toast.success('Report updated', `${reportId} moved to ${next}.`);
      await qc.invalidateQueries({ queryKey: ['admin-reports'] });
      await qc.invalidateQueries({ queryKey: ['reports'] });
    } catch (e) {
      setErrors((c) => ({
        ...c,
        [reportId]: e instanceof ApiError ? e.message : getErrorMessage(e),
      }));
    } finally {
      setBusy('');
    }
  }

  const activeFilters = useMemo(
    () =>
      [
        status && `Status: ${status}`,
        priority && `Priority: ${priority}`,
        unassigned && 'Unassigned only',
        category && `Category: ${category}`,
        q && `Search: ${q}`,
      ].filter(Boolean) as string[],
    [status, priority, unassigned, category, q],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Report queue"
        description="Search and filter persisted reports. Status changes are validated by the server and recorded in the audit trail."
      />
      <Panel className="mb-4 p-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Search" htmlFor="admin-search">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-ink-faint" />
              <Input
                id="admin-search"
                className="pl-9"
                value={q}
                onChange={(e) => {
                  const value = e.target.value;
                  setQ(value);
                  setPage(1);
                  updateParams({ q: value || undefined, page: undefined });
                }}
                placeholder="Reference, title, location"
              />
            </div>
          </Field>
          <Field label="Status" htmlFor="admin-status">
            <Select
              id="admin-status"
              value={status}
              onChange={(e) => {
                const value = e.target.value;
                setStatus(value);
                setPage(1);
                updateParams({ status: value || undefined, page: undefined });
              }}
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" htmlFor="admin-priority">
            <Select
              id="admin-priority"
              value={priority}
              onChange={(e) => {
                const value = e.target.value;
                setPriority(value);
                setPage(1);
                updateParams({ priority: value || undefined, page: undefined });
              }}
            >
              <option value="">All priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </Field>
          <Field label="Category slug" htmlFor="admin-category">
            <Input
              id="admin-category"
              value={category}
              onChange={(e) => {
                const value = e.target.value;
                setCategory(value);
                setPage(1);
                updateParams({ category: value || undefined, page: undefined });
              }}
              placeholder="e.g. potholes"
            />
          </Field>
        </div>
        {activeFilters.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">
              Active filters
            </span>
            {activeFilters.map((label) => (
              <span
                key={label}
                className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] text-ink-soft"
              >
                {label}
              </span>
            ))}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setQ('');
                setStatus('');
                setPriority('');
                setCategory('');
                setPage(1);
                setSearchParams({}, { replace: true });
              }}
            >
              Clear all
            </Button>
          </div>
        ) : null}
      </Panel>

      {query.isLoading ? (
        <LoadingPanel rows={7} />
      ) : query.isError ? (
        <ErrorState message={getErrorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : (
        <>
          <Panel>
            <div className="border-b border-line px-4 py-3">
              <p className="text-xs text-ink-muted">
                {query.data?.pagination.total ?? 0} matching reports · server paginated
              </p>
            </div>
            <div className="overflow-x-auto">
              <ReportTable
                reports={query.data?.data ?? []}
                categories={categoryQuery.data ?? []}
                basePath="/admin/reports"
                showDepartment
                showReporter
              />
            </div>
          </Panel>
          <Pagination
            page={query.data?.pagination.page ?? page}
            totalPages={query.data?.pagination.totalPages ?? 1}
            total={query.data?.pagination.total ?? 0}
            onPageChange={(next) => {
              setPage(next);
              updateParams({ page: next > 1 ? String(next) : undefined });
            }}
          />
          <Panel className="mt-4 p-4">
            <h2 className="text-sm font-semibold text-ink">Quick status update</h2>
            <p className="mt-1 text-xs text-ink-muted">
              For detailed assignment, category, priority and reason controls open an individual report.
            </p>
            <div className="mt-3 space-y-2">
              {query.data?.data.slice(0, 8).map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/admin/reports/${encodeURIComponent(r.reportId)}`}
                      className="text-xs font-semibold text-civic hover:underline"
                    >
                      {r.reportId} · {r.title}
                    </Link>
                    <div className="mt-1">
                      <StatusBadge status={r.status} />
                    </div>
                    {errors[r.reportId] ? (
                      <p className="mt-1 text-[10px] text-danger" role="alert">
                        {errors[r.reportId]}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(['Under Review', 'Assigned', 'In Progress', 'Resolved'] as ReportStatus[])
                      .filter((s) => s !== r.status)
                      .map((s) => (
                        <Button
                          key={s}
                          size="sm"
                          variant="secondary"
                          loading={busy === r.reportId}
                          onClick={() => void change(r.reportId, s)}
                        >
                          {s}
                        </Button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

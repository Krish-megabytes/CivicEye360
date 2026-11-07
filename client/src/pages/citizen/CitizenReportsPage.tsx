import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useCategories, useReportList } from '../../hooks/queries';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  LinkButton,
  LoadingPanel,
  PageHeader,
  Pagination,
  Panel,
  Select,
} from '../../components/ui/base';
import { ReportTable } from '../../components/reports/ReportTable';
import { getErrorMessage } from '../../utils/format';
import type { ReportStatus } from '../../types';

const STATUS_OPTIONS: ReportStatus[] = [
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
  'Closed',
  'Rejected',
  'Reopened',
];

export function CitizenReportsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const [search, setSearch] = useState(q);

  useEffect(() => {
    setSearch(q);
  }, [q]);

  const categoriesQuery = useCategories();
  const reportsQuery = useReportList('my', {
    q: q || undefined,
    status: status ? [status] : undefined,
    page,
    pageSize: 10,
    sort: 'updatedAt',
    order: 'desc',
  });

  function updateParams(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    setParams(next, { replace: true });
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    updateParams({ q: search.trim() || undefined, page: undefined });
  }

  function clearFilters() {
    setSearch('');
    updateParams({ q: undefined, status: undefined, page: undefined });
  }

  const filtered = Boolean(q || status);

  return (
    <>
      <PageHeader
        eyebrow="Citizen dashboard"
        title="My reports"
        description="Every report you submit, with its reference, current status and recorded updates."
        actions={
          <LinkButton to="/reports/new">
            <Plus aria-hidden="true" className="size-4" />
            Report an issue
          </LinkButton>
        }
      />
      <Panel>
        <div className="border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">Reports</h2>
            <span className="text-[10px] text-ink-muted">
              {reportsQuery.data?.pagination.total ?? 0} matching
            </span>
          </div>
          <form onSubmit={submitSearch} className="mt-2.5 flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, reference or address"
                aria-label="Search your reports"
                className="pl-8"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={status}
                onChange={(event) => updateParams({ status: event.target.value || undefined, page: undefined })}
                aria-label="Filter by status"
                className="min-w-[130px]"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="secondary" size="md">
                Search
              </Button>
              {filtered ? (
                <Button type="button" variant="quiet" size="md" onClick={clearFilters}>
                  Clear
                </Button>
              ) : null}
            </div>
          </form>
        </div>

        {reportsQuery.isError ? (
          <div className="p-4">
            <ErrorState message={getErrorMessage(reportsQuery.error)} onRetry={() => void reportsQuery.refetch()} />
          </div>
        ) : reportsQuery.isLoading ? (
          <div className="p-4">
            <LoadingPanel rows={5} label="Loading your reports" />
          </div>
        ) : reportsQuery.data && reportsQuery.data.data.length > 0 ? (
          <>
            <ReportTable
              reports={reportsQuery.data.data}
              categories={categoriesQuery.data ?? []}
              basePath="/reports"
            />
            <div className="border-t border-line px-3">
              <Pagination
                page={reportsQuery.data.pagination.page}
                totalPages={reportsQuery.data.pagination.totalPages}
                total={reportsQuery.data.pagination.total}
                onPageChange={(nextPage) => updateParams({ page: String(nextPage) })}
              />
            </div>
          </>
        ) : (
          <EmptyState
            title={filtered ? 'No reports match those filters' : 'You have not submitted a report yet'}
            description={
              filtered
                ? 'Try a different status or search term. Your reports are never deleted by clearing a filter.'
                : 'Report a pothole, streetlight, waste, drainage or other non-emergency civic issue. You will receive a reference and a secure tracking code.'
            }
            action={
              filtered ? (
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <LinkButton to="/reports/new" size="sm">
                  Report an issue
                </LinkButton>
              )
            }
          />
        )}
      </Panel>
    </>
  );
}

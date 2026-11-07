import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { CalendarDays, MapPin, Search } from 'lucide-react';
import { api } from '../../api';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Panel,
  PriorityBadge,
  Select,
} from '../../components/ui/base';
import { useNgoBoard } from '../../hooks/ngo';
import { useCategories } from '../../hooks/queries';
import { categoryLabel, formatRelative, pluralize } from '../../utils/format';

export function NgoTasksPage() {
  const queryClient = useQueryClient();
  const board = useNgoBoard();
  const categories = useCategories();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [sort, setSort] = useState<'points' | 'newest'>('points');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const available = board.data?.available ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = available.filter((task) => {
      if (category && task.category !== category) return false;
      if (priority && task.priority !== priority) return false;
      if (!term) return true;
      return [task.title, task.description, task.address, task.reportId, task.category]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
    return rows.sort((a, b) =>
      sort === 'points'
        ? b.suggestedPoints - a.suggestedPoints
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [available, category, priority, search, sort]);

  async function claim(reportId: string) {
    setBusy(reportId);
    setError('');
    setNotice('');
    try {
      await api.ngo.claim(reportId);
      setNotice(`${reportId} is now yours. Open "My work" to upload evidence.`);
      await queryClient.invalidateQueries({ queryKey: ['ngo'] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Task could not be claimed.');
    } finally {
      setBusy('');
    }
  }

  const filtersActive = Boolean(search || category || priority);

  return (
    <>
      <PageHeader
        eyebrow="NGO workspace"
        title="Available tasks"
        description="Open civic reports you can take on. Claiming is exclusive — the first NGO to claim a task owns it."
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="info" title="Task claimed">{notice}</Alert> : null}
      {board.isError ? (
        <ErrorState message="Tasks could not be loaded." onRetry={() => void board.refetch()} />
      ) : null}

      <Panel className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_170px_150px_160px]">
          <Field label="Search tasks" htmlFor="ngo-task-search">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-faint" />
              <Input
                id="ngo-task-search"
                className="pl-8"
                placeholder="Title, address or reference"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </Field>
          <Field label="Category" htmlFor="ngo-task-category">
            <Select id="ngo-task-category" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {(categories.data ?? []).map((item) => (
                <option key={item.slug} value={item.slug}>{item.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" htmlFor="ngo-task-priority">
            <Select id="ngo-task-priority" value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="">Any priority</option>
              {['Urgent', 'High', 'Medium', 'Low'].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
          </Field>
          <Field label="Sort by" htmlFor="ngo-task-sort">
            <Select id="ngo-task-sort" value={sort} onChange={(event) => setSort(event.target.value as 'points' | 'newest')}>
              <option value="points">Highest points</option>
              <option value="newest">Newest first</option>
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <p className="text-[11px] text-ink-muted">
            Showing {filtered.length} of {pluralize(available.length, 'open task')}
          </p>
          {filtersActive ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setSearch(''); setCategory(''); setPriority(''); }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      </Panel>

      {board.isLoading ? (
        <div className="grid gap-3 md:grid-cols-2" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="panel h-44 animate-pulse" />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((task) => (
            <article key={task.id} className="panel flex flex-col p-4 transition-all hover:-translate-y-0.5 hover:border-civic/40">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={task.priority} />
                  <span className="font-mono text-[10px] text-ink-faint">{task.reportId}</span>
                </div>
                <Badge tone="accent">{task.suggestedPoints} points</Badge>
              </div>
              <h2 className="mt-2 text-[15px] font-semibold leading-snug text-ink">{task.title}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-muted">
                <span>{categoryLabel(categories.data, task.category)}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden="true" className="size-3" />
                  {task.address}
                </span>
              </p>
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-ink-soft">{task.description}</p>
              <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
                <span className="inline-flex items-center gap-1 text-[10px] text-ink-faint">
                  <CalendarDays aria-hidden="true" className="size-3" />
                  Posted {formatRelative(task.createdAt)}
                </span>
                <Button
                  size="sm"
                  loading={busy === task.id}
                  disabled={Boolean(busy)}
                  onClick={() => void claim(task.reportId)}
                >
                  Claim task
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Panel>
          <EmptyState
            title={available.length ? 'No tasks match these filters' : 'No tasks available'}
            description={
              available.length
                ? 'Clear the search or filters to see every open task.'
                : 'New community work appears here as reports are reviewed. Check again later.'
            }
            action={
              available.length ? (
                <Button variant="secondary" size="sm" onClick={() => { setSearch(''); setCategory(''); setPriority(''); }}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Panel>
      )}
    </>
  );
}

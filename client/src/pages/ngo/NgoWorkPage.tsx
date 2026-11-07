import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Camera, ImagePlus, MapPin, RotateCcw } from 'lucide-react';
import { api, type NgoTask } from '../../api';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LinkButton,
  PageHeader,
  Panel,
  PriorityBadge,
} from '../../components/ui/base';
import { useNgoBoard } from '../../hooks/ngo';
import { formatRelative, pluralize } from '../../utils/format';

const TASK_FILTERS = [
  { id: 'claimed', label: 'In progress' },
  { id: 'submitted', label: 'Awaiting review' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Needs attention' },
] as const;
type TaskFilter = (typeof TASK_FILTERS)[number]['id'];

const STATUS_LABEL: Record<NgoTask['status'], string> = {
  claimed: 'Claimed',
  submitted: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Changes requested',
};

const STATUS_TONE: Record<NgoTask['status'], 'civic' | 'warn' | 'good' | 'danger'> = {
  claimed: 'civic',
  submitted: 'warn',
  approved: 'good',
  rejected: 'danger',
};

export function NgoWorkPage() {
  const queryClient = useQueryClient();
  const board = useNgoBoard();
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('claimed');

  const mine = board.data?.mine ?? [];
  const myTasks = mine.filter((task) => task.status === taskFilter);

  async function run(id: string, action: () => Promise<unknown>) {
    setBusy(id);
    setError('');
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ['ngo'] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action failed');
    } finally {
      setBusy('');
    }
  }

  async function upload(id: string, file?: File) {
    if (file) await run(id, () => api.ngo.upload(id, file));
  }

  return (
    <>
      <PageHeader
        eyebrow="NGO workspace"
        title="My work"
        description="Upload photos of the finished work and a short summary. An administrator checks every photo before the task counts as complete."
        actions={<LinkButton to="/ngo/tasks" variant="secondary">Find another task</LinkButton>}
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {board.isError ? (
        <ErrorState message="Your tasks could not be loaded." onRetry={() => void board.refetch()} />
      ) : null}

      <div className="panel mb-4 flex flex-wrap gap-1 p-1.5" role="tablist" aria-label="Filter my tasks">
        {TASK_FILTERS.map((filter) => {
          const count = mine.filter((task) => task.status === filter.id).length;
          const active = taskFilter === filter.id;
          return (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTaskFilter(filter.id)}
              className={`flex-1 rounded-[10px] px-2.5 py-2 text-xs font-semibold transition-colors ${
                active ? 'bg-civic text-white' : 'text-ink-muted hover:bg-paper hover:text-ink'
              }`}
            >
              {filter.label}
              <span className={`ml-1.5 tabular-nums ${active ? 'text-white/70' : 'text-ink-faint'}`}>({count})</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {myTasks.map((task) => {
          const canEdit = task.status === 'claimed' || task.status === 'rejected';
          return (
            <Panel key={task.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-semibold text-ink">{task.title}</h2>
                    {task.priority ? <PriorityBadge priority={task.priority} /> : null}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-muted">
                    <span className="font-mono text-[10px]">{task.reportId}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin aria-hidden="true" className="size-3" />
                      {task.address}
                    </span>
                    <span>·</span>
                    <span>Claimed {formatRelative(task.createdAt)}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</Badge>
                  <span className="text-[11px] font-semibold tabular-nums text-ink-muted">
                    {task.status === 'approved'
                      ? `${task.points} points earned`
                      : `${task.suggestedPoints} points on approval`}
                  </span>
                </div>
              </div>

              {task.feedback ? (
                <p className="mt-3 rounded-[10px] border-l-2 border-warn bg-warn-soft px-2.5 py-2 text-xs leading-relaxed text-ink-soft">
                  <b className="text-ink">Reviewer feedback:</b> {task.feedback}
                </p>
              ) : null}

              {canEdit ? (
                <div className="mt-3 grid gap-3 rounded-[12px] border border-line bg-paper p-3 lg:grid-cols-[1fr_1.1fr]">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-ink">Evidence photos</p>
                      <span className="text-[10px] tabular-nums text-ink-faint">{task.evidence.length}/8</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      Show the completed work from more than one angle.
                    </p>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {task.evidence.map((photo, index) => (
                        <a
                          key={photo.id}
                          href={photo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                          title={`Open photo ${index + 1}`}
                        >
                          <img
                            src={photo.url}
                            alt={`Evidence ${index + 1} for ${task.title}`}
                            className="aspect-square w-full rounded-[8px] border border-line object-cover"
                          />
                        </a>
                      ))}
                      {task.evidence.length < 8 ? (
                        <div className="grid aspect-square place-items-center rounded-[8px] border border-dashed border-line-strong text-[10px] text-ink-faint">
                          + photo
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:border-civic hover:text-civic">
                        <Camera aria-hidden="true" className="size-3.5" />
                        Take photo
                        <input
                          className="sr-only"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          capture="environment"
                          aria-label={`Take a photo for ${task.reportId}`}
                          disabled={busy === task.id}
                          onChange={(event) => {
                            void upload(task.id, event.target.files?.[0]);
                            event.target.value = '';
                          }}
                        />
                      </label>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:border-civic hover:text-civic">
                        <ImagePlus aria-hidden="true" className="size-3.5" />
                        Choose photo
                        <input
                          className="sr-only"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          aria-label={`Choose a photo for ${task.reportId}`}
                          disabled={busy === task.id}
                          onChange={(event) => {
                            void upload(task.id, event.target.files?.[0]);
                            event.target.value = '';
                          }}
                        />
                      </label>
                      {busy === task.id ? <span className="self-center text-[11px] text-ink-muted">Uploading…</span> : null}
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-[11px] font-semibold text-ink" htmlFor={`summary-${task.id}`}>
                      What did your team do?
                    </label>
                    <textarea
                      id={`summary-${task.id}`}
                      className="control mt-1 min-h-[96px] flex-1"
                      maxLength={2000}
                      placeholder="Describe the work, materials used and the final condition of the site."
                      value={summary[task.id] ?? ''}
                      onChange={(event) => setSummary((current) => ({ ...current, [task.id]: event.target.value }))}
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        loading={busy === task.id}
                        disabled={!task.evidence.length || (summary[task.id]?.trim().length ?? 0) < 10}
                        onClick={() => void run(task.id, () => api.ngo.submit(task.id, summary[task.id].trim()))}
                      >
                        Submit for approval
                      </Button>
                      {task.status === 'claimed' && !task.evidence.length ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={busy === task.id}
                          onClick={() => void run(task.id, () => api.ngo.release(task.id))}
                        >
                          <RotateCcw aria-hidden="true" className="size-3.5" />
                          Release
                        </Button>
                      ) : null}
                      <span className="text-[10px] text-ink-faint">
                        {task.evidence.length ? `${pluralize(task.evidence.length, 'photo')} attached` : 'At least one photo is required.'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {!canEdit && task.evidence.length ? (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-ink">Submitted evidence ({task.evidence.length})</p>
                  <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {task.evidence.map((photo, index) => (
                      <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="block" title={`Open photo ${index + 1}`}>
                        <img
                          src={photo.url}
                          alt={`Evidence ${index + 1} for ${task.title}`}
                          className="aspect-square w-full rounded-[8px] border border-line object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}

              {task.summary ? (
                <p className="mt-3 border-l-2 border-line-strong pl-3 text-sm leading-relaxed text-ink-soft">{task.summary}</p>
              ) : null}
            </Panel>
          );
        })}
        {!board.isLoading && myTasks.length === 0 ? (
          <Panel>
            <EmptyState
              title={`No ${TASK_FILTERS.find((filter) => filter.id === taskFilter)?.label.toLowerCase()} tasks`}
              description={
                taskFilter === 'claimed'
                  ? 'Claim a task from the available list to get started.'
                  : 'Tasks move here as their review status changes.'
              }
              action={<LinkButton to="/ngo/tasks" size="sm">Browse available tasks</LinkButton>}
            />
          </Panel>
        ) : null}
      </div>
    </>
  );
}

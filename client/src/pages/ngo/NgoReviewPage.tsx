import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, RotateCcw } from 'lucide-react';
import { api, type NgoTask } from '../../api';
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
} from '../../components/ui/base';
import { pluralize } from '../../utils/format';

export function NgoReviewPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['ngo', 'review'], queryFn: api.ngo.review });
  const [points, setPoints] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  async function decide(task: NgoTask, approved: boolean) {
    setBusy(task.id);
    setError('');
    try {
      await api.ngo.decide(task.id, {
        approved,
        points: approved ? Number(points[task.id] || task.suggestedPoints) : undefined,
        feedback: feedback[task.id]?.trim() || undefined,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ngo', 'review'] }),
        queryClient.invalidateQueries({ queryKey: ['ngo', 'leaderboard'] }),
      ]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Review failed');
    } finally {
      setBusy('');
    }
  }

  const queue = query.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="NGO task review"
        description="Check every submitted evidence photo before confirming completion. Points are awarded only when you approve."
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {query.isError ? (
        <ErrorState message="Review queue could not be loaded." onRetry={() => void query.refetch()} />
      ) : null}
      <div className="space-y-4">
        {queue.map((task) => {
          const correction = feedback[task.id]?.trim() ?? '';
          return (
            <Panel key={task.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-ink">{task.title}</h2>
                    {task.priority ? <PriorityBadge priority={task.priority} /> : null}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    <span className="font-mono text-[10px]">{task.reportId}</span> · {task.ngo?.name ?? 'NGO'} · {task.address}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-faint">
                    {pluralize(task.evidence.length, 'photo')} submitted · suggested {task.suggestedPoints} points
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="warn">Pending review</Badge>
                  <Link
                    to={`/admin/reports/${encodeURIComponent(task.reportId)}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-civic hover:underline"
                  >
                    Report
                    <ExternalLink aria-hidden="true" className="size-3" />
                  </Link>
                </div>
              </div>

              {task.summary ? (
                <p className="mt-3 border-l-2 border-line-strong pl-3 text-sm text-ink-soft">{task.summary}</p>
              ) : null}

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {task.evidence.map((photo, index) => (
                  <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="block">
                    <img
                      src={photo.url}
                      alt={`Evidence ${index + 1} uploaded by ${task.ngo?.name ?? 'NGO'}`}
                      className="aspect-square w-full rounded-[10px] border border-line object-cover"
                    />
                    <span className="text-xs text-civic underline">Open photo</span>
                  </a>
                ))}
                {task.evidence.length === 0 ? (
                  <p className="text-xs text-danger">No evidence photos were attached to this submission.</p>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Points on approval" htmlFor={`points-${task.id}`} hint={`Default: ${task.suggestedPoints} based on report priority.`}>
                  <Input
                    id={`points-${task.id}`}
                    type="number"
                    min="0"
                    max="1000"
                    value={points[task.id] ?? String(task.suggestedPoints)}
                    onChange={(event) => setPoints((current) => ({ ...current, [task.id]: event.target.value }))}
                  />
                </Field>
                <Field
                  label="Review feedback"
                  htmlFor={`feedback-${task.id}`}
                  hint={correction ? undefined : 'Required when requesting corrections.'}
                >
                  <Input
                    id={`feedback-${task.id}`}
                    placeholder="What needs to change?"
                    value={feedback[task.id] ?? ''}
                    onChange={(event) => setFeedback((current) => ({ ...current, [task.id]: event.target.value }))}
                  />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  loading={busy === task.id}
                  disabled={Boolean(busy) || task.evidence.length === 0}
                  onClick={() => void decide(task, true)}
                >
                  <Check aria-hidden="true" className="size-4" />
                  Approve &amp; award points
                </Button>
                <Button
                  variant="secondary"
                  loading={busy === task.id}
                  disabled={Boolean(busy) || !correction}
                  onClick={() => void decide(task, false)}
                >
                  <RotateCcw aria-hidden="true" className="size-4" />
                  Request corrections
                </Button>
              </div>
            </Panel>
          );
        })}
        {!query.isLoading && queue.length === 0 ? (
          <Panel>
            <EmptyState title="Nothing waiting for review" description="NGO submissions appear here as soon as a team submits its evidence." />
          </Panel>
        ) : null}
      </div>
    </>
  );
}

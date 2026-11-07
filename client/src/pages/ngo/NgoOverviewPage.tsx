import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ClipboardList, Coins, MapPin, Trophy } from 'lucide-react';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  LinkButton,
  PageHeader,
  Panel,
  PriorityBadge,
} from '../../components/ui/base';
import { StatTile } from '../../components/dashboard/DashboardBits';
import { useNgoBoard, useNgoLeaderboard } from '../../hooks/ngo';
import { useCategories } from '../../hooks/queries';
import { categoryLabel, pluralize } from '../../utils/format';

export function NgoOverviewPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const board = useNgoBoard();
  const ranks = useNgoLeaderboard();
  const categories = useCategories();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const stats = board.data?.stats;
  const mine = board.data?.mine ?? [];
  const active = mine.filter((task) => task.status === 'claimed' || task.status === 'rejected');
  const opportunities = [...(board.data?.available ?? [])]
    .sort((a, b) => b.suggestedPoints - a.suggestedPoints)
    .slice(0, 3);

  async function claim(reportId: string) {
    setBusy(reportId);
    setError('');
    try {
      await api.ngo.claim(reportId);
      await queryClient.invalidateQueries({ queryKey: ['ngo'] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Task could not be claimed.');
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="NGO workspace"
        title={`Welcome back, ${user?.name ?? 'partner'}.`}
        description="Your verified impact, current work and the best open tasks in one place."
        actions={
          <LinkButton to="/ngo/tasks">
            Find a task
            <ArrowRight aria-hidden="true" className="size-4" />
          </LinkButton>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {stats?.pendingReview ? (
        <Alert tone="info" title={`${pluralize(stats.pendingReview, 'submission')} waiting for review`}>
          An administrator is checking your evidence. Points appear once the work is approved.{' '}
          <Link to="/ngo/work" className="font-semibold text-civic underline">Open my work</Link>
        </Alert>
      ) : null}
      {stats?.needsCorrections ? (
        <Alert tone="warning" title={`${pluralize(stats.needsCorrections, 'task')} need corrections`}>
          Read the reviewer feedback, add new photos and resubmit.{' '}
          <Link to="/ngo/work" className="font-semibold text-civic underline">Review feedback</Link>
        </Alert>
      ) : null}

      <section aria-label="Your NGO summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Verified points"
          value={stats?.points ?? 0}
          hint="Awarded only after admin approval"
          icon={<Coins aria-hidden="true" className="size-3.5" />}
          tone="accent"
          to="/ngo/leaderboard"
        />
        <StatTile
          label="Leaderboard rank"
          value={stats?.rank ? `#${stats.rank}` : '—'}
          hint={stats?.rankedNgos ? `of ${stats.rankedNgos} ranked NGOs` : 'Complete a task to rank'}
          icon={<Trophy aria-hidden="true" className="size-3.5" />}
          tone="good"
          to="/ngo/leaderboard"
        />
        <StatTile
          label="Approved tasks"
          value={stats?.completedTasks ?? 0}
          hint={pluralize(stats?.pendingReview ?? 0, 'submission') + ' awaiting review'}
          icon={<CheckCircle2 aria-hidden="true" className="size-3.5" />}
          tone="civic"
          to="/ngo/work"
        />
        <StatTile
          label="Active claims"
          value={stats?.activeTasks ?? 0}
          hint={stats?.needsCorrections ? `${stats.needsCorrections} need corrections` : 'No corrections pending'}
          icon={<ClipboardList aria-hidden="true" className="size-3.5" />}
          tone="warn"
          to="/ngo/work"
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_330px]">
        <div className="space-y-5">
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold text-ink">Continue your work</h2>
                <p className="mt-1 text-xs text-ink-muted">Tasks you have claimed and still need to submit.</p>
              </div>
              <Link to="/ngo/work" className="text-xs font-semibold text-civic hover:underline">
                All my work
              </Link>
            </div>
            <div className="mt-3 divide-y divide-line">
              {active.slice(0, 3).map((task) => (
                <article key={task.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{task.title}</p>
                      {task.priority ? <PriorityBadge priority={task.priority} /> : null}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                      <span className="font-mono text-[10px]">{task.reportId}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin aria-hidden="true" className="size-3" />
                        {task.address}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={task.status === 'rejected' ? 'danger' : 'civic'}>
                      {task.status === 'rejected' ? 'Changes requested' : 'Claimed'}
                    </Badge>
                    <LinkButton to="/ngo/work" size="sm" variant="secondary">Continue</LinkButton>
                  </div>
                </article>
              ))}
              {active.length === 0 ? (
                <EmptyState
                  title="No active claims"
                  description="Pick an open task to start working on a civic issue near your team."
                  action={<LinkButton to="/ngo/tasks" size="sm">Browse tasks</LinkButton>}
                />
              ) : null}
            </div>
          </Panel>

          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold text-ink">Best open tasks</h2>
                <p className="mt-1 text-xs text-ink-muted">High-value work you can claim right now.</p>
              </div>
              <Link to="/ngo/tasks" className="text-xs font-semibold text-civic hover:underline">
                See all {board.data?.available.length ?? 0}
              </Link>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {opportunities.map((task) => (
                <article key={task.id} className="panel flex flex-col p-3 transition-all hover:-translate-y-0.5 hover:border-civic/40">
                  <div className="flex items-center justify-between gap-2">
                    <PriorityBadge priority={task.priority} />
                    <Badge tone="accent">{task.suggestedPoints} pts</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold text-ink">{task.title}</p>
                  <p className="mt-1 text-[11px] text-ink-muted">{categoryLabel(categories.data, task.category)}</p>
                  <p className="mt-1 line-clamp-1 text-[11px] text-ink-faint">{task.address}</p>
                  <Button
                    className="mt-3 w-full"
                    size="sm"
                    loading={busy === task.id}
                    disabled={Boolean(busy)}
                    onClick={() => void claim(task.reportId)}
                  >
                    Claim task
                  </Button>
                </article>
              ))}
              {opportunities.length === 0 ? (
                <p className="text-xs text-ink-muted">No open tasks right now. New reports appear here after review.</p>
              ) : null}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <section className="rounded-[16px] border border-civic/15 bg-gradient-to-br from-[#e8f0ff] via-white to-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-ink-muted">Your NGO ranking</p>
              <Link to="/ngo/leaderboard" className="text-[11px] font-semibold text-civic hover:underline">
                View leaderboard →
              </Link>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid size-14 shrink-0 place-items-center rounded-[16px] border border-white bg-white text-xl font-bold text-civic shadow-sm">
                {stats?.rank ? `#${stats.rank}` : '—'}
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-none tabular-nums text-ink">
                  {stats?.points ?? 0}
                  <span className="ml-1 text-xs font-semibold text-ink-muted">points</span>
                </p>
                <p className="mt-1 text-[11px] text-ink-muted">
                  {stats?.rank
                    ? `Ranked ${stats.rank} of ${stats.rankedNgos} NGOs`
                    : 'Complete a task to enter the ranking'}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-[10px] bg-white/70 px-3 py-2 text-[11px] text-ink-muted">
              <Trophy aria-hidden="true" className="size-3.5 text-accent" />
              {pluralize(stats?.completedTasks ?? 0, 'approved task')} counted
            </div>
          </section>

          <Panel className="self-start">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-ink">Top NGOs</h2>
              <span className="text-[10px] text-ink-faint">Points</span>
            </div>
            <ol className="mt-2 divide-y divide-line">
              {(ranks.data ?? []).slice(0, 5).map((entry, index) => {
                const isCurrent = entry.ngoId === stats?.ngoId;
                return (
                  <li
                    key={entry.ngoId}
                    className={`flex items-center justify-between gap-2 py-2.5 ${isCurrent ? '-mx-2 rounded-[10px] bg-civic-tint px-2' : ''}`}
                  >
                    <span className="min-w-0 text-sm">
                      <b className={`mr-2 ${index < 3 ? 'text-accent' : 'text-ink-faint'}`}>#{index + 1}</b>
                      <span className="truncate">{entry.name}</span>
                      {isCurrent ? <Badge tone="civic" className="ml-2">You</Badge> : null}
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-soft">
                      {entry.points.toLocaleString()}
                    </span>
                  </li>
                );
              })}
            </ol>
            {ranks.data?.length === 0 ? (
              <p className="mt-2 text-xs text-ink-muted">No approved work yet. The first verified completion takes the top spot.</p>
            ) : null}
            <LinkButton to="/ngo/leaderboard" variant="secondary" size="sm" className="mt-3 w-full">
              Full ranking
            </LinkButton>
          </Panel>

          <Panel className="bg-civic-tint/60">
            <p className="eyebrow">How points work</p>
            <ol className="mt-2 space-y-2.5">
              {[
                ['Claim', 'Take an open report that fits your team.'],
                ['Show the work', 'Upload photos of the finished site and a summary.'],
                ['Get verified', 'An admin checks every photo, then points are awarded.'],
              ].map(([title, detail], index) => (
                <li key={title} className="flex gap-2.5">
                  <span className="font-mono text-[10px] font-semibold text-ink-faint">0{index + 1}</span>
                  <div>
                    <p className="text-[11px] font-semibold text-ink">{title}</p>
                    <p className="text-[10px] leading-relaxed text-ink-muted">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-3 border-t border-line pt-2 text-[10px] text-ink-faint">
              Points scale with report priority: Low 25 · Medium 50 · High 75 · Urgent 100.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}

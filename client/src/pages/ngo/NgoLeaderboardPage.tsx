import { Trophy } from 'lucide-react';
import { Badge, EmptyState, ErrorState, PageHeader, Panel } from '../../components/ui/base';
import { StatTile } from '../../components/dashboard/DashboardBits';
import { useNgoBoard, useNgoLeaderboard } from '../../hooks/ngo';
import { pluralize } from '../../utils/format';

const MEDALS = ['bg-[#f7e4b6] text-[#7a5a10]', 'bg-[#e7e7e2] text-[#5a5a52]', 'bg-[#f0ddcb] text-[#7a5230]'];

export function NgoLeaderboardPage() {
  const ranks = useNgoLeaderboard();
  const board = useNgoBoard();
  const stats = board.data?.stats;
  const entries = ranks.data ?? [];
  const current = entries.find((entry) => entry.ngoId === stats?.ngoId);
  const myRank = current ? entries.indexOf(current) + 1 : null;

  return (
    <>
      <PageHeader
        eyebrow="NGO workspace"
        title="Leaderboard"
        description="Rankings are visible to every NGO. Only work approved by an administrator earns points."
      />
      {ranks.isError ? (
        <ErrorState message="The leaderboard could not be loaded." onRetry={() => void ranks.refetch()} />
      ) : null}

      <section className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Your position">
        <StatTile
          label="Your points"
          value={stats?.points ?? 0}
          hint="Lifetime approved points"
          icon={<Trophy aria-hidden="true" className="size-3.5" />}
          tone="accent"
        />
        <StatTile
          label="Your rank"
          value={myRank ? `#${myRank}` : '—'}
          hint={entries.length ? `of ${entries.length} ranked NGOs` : 'No ranked NGOs yet'}
          tone="good"
        />
        <StatTile
          label="Approved tasks"
          value={stats?.completedTasks ?? 0}
          hint={pluralize(stats?.pendingReview ?? 0, 'submission') + ' awaiting review'}
          tone="civic"
        />
      </section>

      {entries.length >= 3 ? (
        <section className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Top three NGOs">
          {entries.slice(0, 3).map((entry, index) => (
            <div
              key={entry.ngoId}
              className={`panel relative px-4 py-4 ${index === 1 ? 'sm:-mt-2 sm:border-accent/50' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className={`grid size-8 place-items-center rounded-full text-xs font-bold ${MEDALS[index]}`}>
                  {index + 1}
                </span>
                {entry.ngoId === stats?.ngoId ? <Badge tone="civic">You</Badge> : null}
              </div>
              <p className="mt-2 truncate text-sm font-semibold text-ink">{entry.name}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                {pluralize(entry.completedTasks, 'task')} approved
              </p>
              <p className="mt-2 text-xl font-semibold tabular-nums text-ink">{entry.points} <span className="text-xs font-medium text-ink-muted">points</span></p>
            </div>
          ))}
        </section>
      ) : null}

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-ink">Full ranking</h2>
          <span className="text-[11px] text-ink-muted">{pluralize(entries.length, 'NGO')} ranked</span>
        </div>
        {entries.length ? (
          <ol className="mt-2 divide-y divide-line">
            {entries.map((entry, index) => {
              const isCurrent = entry.ngoId === stats?.ngoId;
              return (
                <li
                  key={entry.ngoId}
                  className={`grid grid-cols-[42px_1fr_auto_auto] items-center gap-3 py-3 text-sm ${
                    isCurrent ? '-mx-2 rounded-[10px] bg-civic-tint px-2' : ''
                  }`}
                >
                  <span className={`text-xs font-bold tabular-nums ${index < 3 ? 'text-accent' : 'text-ink-faint'}`}>
                    #{index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="truncate font-medium text-ink">{entry.name}</span>
                    {isCurrent ? <Badge tone="civic" className="ml-2">You</Badge> : null}
                  </span>
                  <span className="text-xs tabular-nums text-ink-muted">
                    {entry.completedTasks} {entry.completedTasks === 1 ? 'task' : 'tasks'}
                  </span>
                  <span className="w-20 text-right text-sm font-semibold tabular-nums text-ink">{entry.points} pts</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="mt-2">
            <EmptyState
              title="No approved work yet"
              description="The first verified completion takes the top spot. Claim a task, upload evidence and wait for admin approval."
            />
          </div>
        )}
      </Panel>
      <p className="mt-3 text-[11px] text-ink-faint">
        Points scale with report priority: Low 25 · Medium 50 · High 75 · Urgent 100. An administrator can adjust the award at review.
      </p>
    </>
  );
}

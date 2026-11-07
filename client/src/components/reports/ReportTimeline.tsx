import type { ReportStatus, Visibility } from '../../types';
import { formatDateTime } from '../../utils/format';
import { STATUS_DOT } from '../../utils/format';
import { Badge } from '../ui/base';

export interface TimelineItem {
  id?: string;
  toStatus: ReportStatus;
  note?: string | null;
  reason?: string | null;
  createdAt: string;
  actor?: { name: string; roleLabel: string };
  visibility?: Visibility;
}

export function ReportTimeline({ entries }: { entries: TimelineItem[] }) {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  if (sorted.length === 0) {
    return <p className="text-xs text-ink-muted">No status updates have been recorded yet.</p>;
  }
  return (
    <ol className="relative" aria-label="Report status timeline">
      {sorted.map((entry, index) => (
        <li key={entry.id ?? `${entry.toStatus}-${entry.createdAt}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
          {index < sorted.length - 1 ? (
            <span className="absolute bottom-0 left-[5px] top-3 w-px bg-line" aria-hidden="true" />
          ) : null}
          <span
            className={`relative z-[1] mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-surface ring-1 ring-line-strong ${STATUS_DOT[entry.toStatus]}`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-xs font-semibold text-ink">{entry.toStatus}</p>
              <time className="text-[10px] text-ink-faint" dateTime={entry.createdAt}>
                {formatDateTime(entry.createdAt)}
              </time>
            </div>
            {entry.note ? (
              <p className="mt-0.5 whitespace-pre-line text-[11px] leading-relaxed text-ink-muted">
                {entry.note}
              </p>
            ) : null}
            {entry.reason ? (
              <p className="mt-1 border-l border-line pl-2 text-[11px] leading-relaxed text-ink-muted">
                <span className="font-semibold text-ink-soft">Reason:</span> {entry.reason}
              </p>
            ) : null}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {entry.actor ? (
                <p className="text-[10px] text-ink-faint">
                  {entry.actor.name} · {entry.actor.roleLabel}
                </p>
              ) : null}
              {entry.visibility === 'internal' ? <Badge tone="warn">Internal</Badge> : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

const RAIL: ReportStatus[] = ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Closed'];

export function StatusRail({ status }: { status: ReportStatus }) {
  if (status === 'Rejected' || status === 'Reopened') {
    return (
      <div className="flex items-center gap-2 rounded-[3px] border border-line bg-paper px-3 py-2">
        <span className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
        <p className="text-[11px] text-ink-muted">
          Current state: <span className="font-semibold text-ink">{status}</span>. The standard
          lifecycle rail does not apply while this state is active.
        </p>
      </div>
    );
  }
  const currentIndex = RAIL.indexOf(status);
  return (
    <ol className="flex overflow-x-auto border border-line bg-surface" aria-label="Lifecycle progress">
      {RAIL.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li
            key={step}
            aria-current={active ? 'step' : undefined}
            className={`flex min-w-[92px] flex-1 flex-col gap-1 border-r border-line px-2.5 py-2 last:border-r-0 ${
              active ? 'bg-civic-tint' : ''
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span
                className={`size-1.5 rounded-full ${
                  done ? 'bg-good' : active ? 'bg-civic' : 'bg-line-strong'
                }`}
                aria-hidden="true"
              />
              <span
                className={`text-[10px] font-semibold leading-tight ${
                  active ? 'text-civic' : done ? 'text-ink-soft' : 'text-ink-faint'
                }`}
              >
                {step}
              </span>
            </span>
            <span className="text-[9px] text-ink-faint">
              {done ? 'Complete' : active ? 'Current' : 'Pending'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

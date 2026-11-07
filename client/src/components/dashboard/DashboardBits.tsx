import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

type NavItem = { to: string; label: string; end?: boolean; count?: number };

export function SectionNav({ items, label }: { items: NavItem[]; label: string }) {
  return (
    <nav
      aria-label={label}
      className="panel mb-5 flex gap-1.5 overflow-x-auto p-1.5 scrollbar-thin"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `inline-flex shrink-0 items-center gap-2 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold transition-colors ${
              isActive
                ? 'bg-civic text-white shadow-[0_8px_18px_-12px_rgba(37,99,235,0.9)]'
                : 'text-ink-muted hover:bg-civic-tint hover:text-civic'
            }`
          }
        >
          {item.label}
          {typeof item.count === 'number' && item.count > 0 ? (
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">
              {item.count}
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'civic',
  to,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'civic' | 'accent' | 'good' | 'warn';
  to?: string;
}) {
  const tones = {
    civic: 'bg-civic-tint text-civic',
    accent: 'bg-[#fff4e0] text-[#b45309]',
    good: 'bg-good-soft text-good',
    warn: 'bg-[#fef0ec] text-[#c2410c]',
  };

  const body = (
    <>
      <div className="flex items-center gap-3">
        {icon ? (
          <span className={`grid size-10 shrink-0 place-items-center rounded-[12px] ${tones[tone]}`}>
            {icon}
          </span>
        ) : null}
        <p className="min-w-0 text-[11px] font-semibold leading-tight text-ink-muted">{label}</p>
      </div>
      <p className="mt-3 text-[1.9rem] font-bold leading-none tabular-nums tracking-[-0.03em] text-ink">
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">{hint}</p> : null}
    </>
  );

  const className = 'panel block px-4 py-4';
  return to ? (
    <NavLink
      to={to}
      className={`${className} transition-all hover:-translate-y-0.5 hover:border-civic/40`}
    >
      {body}
    </NavLink>
  ) : (
    <div className={className}>{body}</div>
  );
}

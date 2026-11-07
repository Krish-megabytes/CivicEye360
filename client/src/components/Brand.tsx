import { Link } from 'react-router-dom';

export function Brand({ variant = 'dark', compact = false }: { variant?: 'dark' | 'light'; compact?: boolean }) {
  const isLight = variant === 'light';
  return (
    <Link
      to="/"
      className="inline-flex min-w-0 items-center gap-2.5 outline-offset-4"
      aria-label="CivicEye 360 home"
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-[11px] border ${
          isLight ? 'border-white/25 bg-white/10' : 'border-civic bg-civic shadow-[0_8px_18px_-10px_rgba(37,99,235,0.9)]'
        }`}
      >
        <svg viewBox="0 0 24 24" className="size-[19px]" role="img" aria-hidden="true">
          <path
            d="M2.5 12c2.3-4 5.4-6 9.5-6s7.2 2 9.5 6c-2.3 4-5.4 6-9.5 6s-7.2-2-9.5-6Z"
            fill="none"
            stroke={isLight ? '#f6f5f0' : '#ffffff'}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3.1" fill={isLight ? '#f6f5f0' : '#f0b357'} />
          <path
            d="M12 2.3v2M12 19.7v2"
            stroke={isLight ? '#f6f5f0' : '#ffffff'}
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity=".65"
          />
        </svg>
      </span>
      {!compact ? (
        <span className={`flex min-w-0 items-baseline gap-1 ${isLight ? 'text-white' : 'text-ink'}`}>
          <span className="truncate text-[17px] font-bold tracking-[-0.025em]">CivicEye</span>
          <span
            className={`text-[13px] font-semibold tracking-[0.04em] ${
              isLight ? 'text-white/60' : 'text-ink-muted'
            }`}
          >
            360
          </span>
        </span>
      ) : null}
    </Link>
  );
}

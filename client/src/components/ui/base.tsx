import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Inbox,
  Loader2,
  TriangleAlert,
} from 'lucide-react';
import type { Priority, ReportStatus } from '../../types';
import { PRIORITY_TONE, STATUS_DOT, STATUS_TONE, titleCase } from '../../utils/format';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border border-civic bg-civic text-white shadow-[0_6px_16px_-8px_rgba(37,99,235,0.7)] hover:bg-civic-deep hover:border-civic-deep disabled:bg-civic/50 disabled:border-civic/30 disabled:shadow-none',
  secondary:
    'border border-line-strong bg-surface text-ink-soft hover:border-civic/40 hover:bg-civic-tint hover:text-ink disabled:text-ink-faint disabled:hover:bg-surface',
  ghost:
    'border border-transparent bg-transparent text-civic hover:border-line hover:bg-civic-tint/60',
  danger:
    'border border-danger bg-danger text-white hover:bg-[#88271d] disabled:bg-danger/50',
  quiet:
    'border border-transparent bg-transparent text-ink-muted hover:bg-paper-deep hover:text-ink',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-3 py-1.5 text-xs',
  md: 'min-h-10 px-4 py-2 text-sm',
  lg: 'min-h-11 px-5 py-2.5 text-sm',
};

export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra = '',
): string {
  return `inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, icon, className = '', children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  children,
  className = '',
}: {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link to={to} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  optional,
  children,
  className = '',
}: {
  label: ReactNode;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">
        {label}
        {optional ? <span className="ml-1 font-normal text-ink-muted">(optional)</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="hint mt-1">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1 text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', invalid = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={`control ${className}`}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className = '', invalid = false, rows = 5, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={`control ${className}`}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(function Select({ className = '', invalid = false, children, ...props }, ref) {
  return (
    <select ref={ref} className={`control ${className}`} aria-invalid={invalid || undefined} {...props}>
      {children}
    </select>
  );
});

export function Checkbox({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[#0f4c81]"
      />
      <label htmlFor={id} className="text-sm leading-snug">
        <span className="font-medium text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-ink-muted">{description}</span> : null}
      </label>
    </div>
  );
}

export function Fieldset({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      {hint ? <p className="hint mb-2">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

type AlertTone = 'info' | 'success' | 'warning' | 'error';

const ALERT_STYLES: Record<AlertTone, { wrapper: string; icon: ReactNode }> = {
  info: {
    wrapper: 'border-civic/20 bg-civic-tint text-ink-soft',
    icon: <CircleAlert aria-hidden="true" className="size-4 text-civic" />,
  },
  success: {
    wrapper: 'border-good/25 bg-good-soft text-ink-soft',
    icon: <CircleAlert aria-hidden="true" className="size-4 text-good" />,
  },
  warning: {
    wrapper: 'border-warn/30 bg-warn-soft text-ink-soft',
    icon: <TriangleAlert aria-hidden="true" className="size-4 text-warn" />,
  },
  error: {
    wrapper: 'border-danger/30 bg-danger-soft text-ink-soft',
    icon: <TriangleAlert aria-hidden="true" className="size-4 text-danger" />,
  },
};

export function Alert({
  tone = 'info',
  title,
  children,
  className = '',
}: {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const style = ALERT_STYLES[tone];
  return (
    <div
      className={`flex items-start gap-2.5 rounded-[14px] border px-3.5 py-3 text-sm ${style.wrapper} ${className}`}
      role={tone === 'error' ? 'alert' : undefined}
    >
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <div className="min-w-0">
        {title ? <p className="font-semibold text-ink">{title}</p> : null}
        <div className={title ? 'mt-0.5 text-xs leading-relaxed' : 'leading-relaxed'}>{children}</div>
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'civic' | 'good' | 'warn' | 'danger' | 'accent';
  className?: string;
}) {
  const tones = {
    neutral: 'border-line bg-paper text-ink-muted',
    civic: 'border-civic/20 bg-civic-tint text-civic',
    good: 'border-good/20 bg-good-soft text-good',
    warn: 'border-warn/25 bg-warn-soft text-warn',
    danger: 'border-danger/25 bg-danger-soft text-danger',
    accent: 'border-accent/25 bg-accent-soft text-accent',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4 ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, subtle = false }: { status: ReportStatus; subtle?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold leading-4 ${
        subtle ? 'border-line bg-surface text-ink-soft' : STATUS_TONE[status]
      }`}
    >
      <span className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4 ${PRIORITY_TONE[priority]}`}
    >
      {priority}
    </span>
  );
}

export function VisibilityBadge({ visibility }: { visibility: 'citizen' | 'internal' }) {
  return (
    <Badge tone={visibility === 'internal' ? 'warn' : 'civic'}>
      {visibility === 'internal' ? 'Internal only' : 'Citizen visible'}
    </Badge>
  );
}

export function Panel({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return <Tag className={`panel ${className}`}>{children}</Tag>;
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  breadcrumbs,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
  breadcrumbs?: Array<{ label: string; to?: string }>;
}) {
  return (
    <header className="mb-5">
      {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} /> : null}
      {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <h1 className="text-[1.7rem] font-bold leading-tight tracking-[-0.03em] text-ink md:text-[2rem]">
            {title}
          </h1>
          {description ? (
            <div className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</div>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-ink-muted">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.to ? (
              <Link to={item.to} className="hover:text-civic">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  total,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total?: number;
}) {
  if (totalPages <= 1) {
    return total !== undefined ? (
      <p className="px-1 py-2 text-xs text-ink-muted">{total} record{total === 1 ? '' : 's'}</p>
    ) : null;
  }
  return (
    <nav className="flex items-center justify-between gap-3 px-1 py-2" aria-label="Pagination">
      <p className="text-xs text-ink-muted">
        Page <span className="font-semibold text-ink">{page}</span> of {totalPages}
        {total !== undefined ? ` · ${total} records` : ''}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden="true" className="size-3.5" />
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          Next
          <ChevronRight aria-hidden="true" className="size-3.5" />
        </Button>
      </div>
    </nav>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 px-5 py-10 sm:px-8">
      <span className="grid size-10 place-items-center rounded-[12px] border border-line bg-civic-tint text-civic">
        {icon ?? <Inbox aria-hidden="true" className="size-4" />}
      </span>
      <div className="max-w-lg">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <div className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</div>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = 'This section could not be loaded',
  message,
  onRetry,
}: {
  title?: string;
  message: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[16px] border border-danger/25 bg-danger-soft px-5 py-6">
      <TriangleAlert aria-hidden="true" className="size-5 text-danger" />
      <div>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <div className="mt-1 text-sm leading-relaxed text-ink-soft">{message}</div>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingPanel({ rows = 4, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div className="panel" aria-busy="true" aria-label={label}>
      <div className="space-y-3 p-5">
        <div className="h-3 w-1/4 animate-pulse rounded bg-line" />
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="h-9 animate-pulse rounded-[3px] bg-paper-deep"
            style={{ animationDelay: `${index * 80}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-civic-tint font-semibold text-civic ${
        size === 'sm' ? 'size-7 text-[11px]' : 'size-9 text-sm'
      }`}
    >
      {initial}
    </span>
  );
}

export function ReadOnlyValue({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted">{label}</dt>
      <dd className={`mt-0.5 text-sm text-ink ${mono ? 'font-mono text-[12px]' : ''}`}>{children}</dd>
    </div>
  );
}

export function HumanStatus({ value }: { value: string }) {
  return <>{titleCase(value)}</>;
}

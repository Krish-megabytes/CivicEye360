import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DraftingCompass } from 'lucide-react';
import { Alert } from '../../components/ui/base';

export function PolicyLayout({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="container-page py-8 sm:py-10">
      <div className="max-w-3xl">
        <p className="eyebrow">Policy · draft for review</p>
        <h1 className="display mt-2 text-[2.5rem] text-ink sm:text-[3rem]">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-soft">{intro}</p>
        <p className="mt-2 text-[11px] text-ink-faint">Draft version · Last prepared {updated}</p>
      </div>

      <div className="mt-6 max-w-3xl">
        <Alert tone="warning" title="Draft policy copy — not yet legal advice">
          This page is a working draft prepared for the operating organization to review, adapt and
          approve before public launch. It contains placeholders for organization-specific details
          and should not be treated as a final legal guarantee.
        </Alert>
      </div>

      <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_220px]">
        <article className="prose-civic min-w-0 text-sm">{children}</article>
        <aside className="hidden lg:block">
          <div className="sticky top-24 border border-line bg-surface p-3.5">
            <DraftingCompass aria-hidden="true" className="size-4 text-accent" />
            <p className="mt-2 text-[11px] font-semibold text-ink">Before production</p>
            <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">
              Replace every bracketed placeholder, confirm retention and deletion procedures,
              review provider terms, and obtain approval from the responsible legal and privacy
              leads.
            </p>
            <div className="mt-3 space-y-1 border-t border-line pt-2 text-[10px]">
              <Link to="/privacy" className="block text-civic hover:underline">Privacy notice</Link>
              <Link to="/terms" className="block text-civic hover:underline">Terms of use</Link>
              <Link to="/help" className="block text-civic hover:underline">Help centre</Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

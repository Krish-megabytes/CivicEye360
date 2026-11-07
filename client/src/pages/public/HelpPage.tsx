import { Link } from 'react-router-dom';
import { Accessibility, ArrowUpRight, Clock3, FileText, LifeBuoy } from 'lucide-react';
import { FAQS, STATUS_DEFINITIONS } from '../../content';
import { useCategories } from '../../hooks/queries';
import { Alert, LinkButton, StatusBadge } from '../../components/ui/base';

const SECTIONS = [
  { id: 'reporting', label: 'How to report' },
  { id: 'categories', label: 'Categories' },
  { id: 'statuses', label: 'Status meanings' },
  { id: 'tracking', label: 'Tracking & privacy' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'contact', label: 'Get help' },
  { id: 'faq', label: 'FAQ' },
];

export function HelpPage() {
  const categoriesQuery = useCategories();
  const categories = categoriesQuery.data ?? [];

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="max-w-3xl">
        <p className="eyebrow">Help centre</p>
        <h1 className="display mt-2 text-[2.4rem] text-ink sm:text-[3rem]">A clear route through the process.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-soft">
          This page explains how to file a usable report, what happens to it, what other people can
          see, and where to get help when something is unclear.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <LinkButton to="/register">Create an account</LinkButton>
          <LinkButton to="/track" variant="secondary">
            Track a report
          </LinkButton>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[210px_1fr]">
        <aside aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-24 border-t border-line pt-3">
            <p className="eyebrow mb-2">On this page</p>
            <nav className="space-y-1">
              {SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block py-1 text-xs text-ink-muted hover:text-civic"
                >
                  {section.label}
                </a>
              ))}
            </nav>
            <div className="mt-5 border border-line bg-surface p-3">
              <LifeBuoy aria-hidden="true" className="size-4 text-civic" />
              <p className="mt-2 text-[11px] font-semibold text-ink">Emergency?</p>
              <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">
                Call your local emergency service. Do not use CivicEye 360 for immediate danger.
              </p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <Alert tone="warning" title="Not an emergency channel">
            If there is a fire, gas leak, live electrical hazard, medical emergency or immediate risk
            to life, contact your local emergency service. Reports filed here are for non-emergency
            civic issues and are reviewed during service operations.
          </Alert>

          <section id="reporting" className="mt-8 scroll-mt-24">
            <h2 className="text-xl font-semibold text-ink">How to report an issue</h2>
            <ol className="mt-3 space-y-3 border-l border-line pl-5">
              {[
                ['Create an account or sign in.', 'Reports are linked to an account so you can follow updates and staff can ask follow-up questions.'],
                ['Describe one issue per report.', 'Use a specific title and explain what is wrong, where it is, how long it has been there and whether it is creating a safety risk.'],
                ['Choose the closest category.', 'Staff can correct the category during review. The category does not have to be perfect at submission.'],
                ['Add a location.', 'Type an address or landmark. You can optionally place a pin on the map or use your browser location after granting permission. Manual entry always works.'],
                ['Attach a photo if it is safe and relevant.', 'JPEG, PNG and WebP up to the displayed size limit. Do not upload identity documents, faces of bystanders or unrelated personal information.'],
                ['Submit and save the reference.', 'You will receive a report reference and a secure tracking code. Keep both if you want to use guest tracking.'],
              ].map(([title, text], index) => (
                <li key={title} className="relative">
                  <span className="absolute -left-[29px] grid size-4 place-items-center rounded-full border border-line-strong bg-paper text-[8px] font-bold text-ink-muted">
                    {index + 1}
                  </span>
                  <p className="text-sm font-semibold text-ink">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section id="categories" className="mt-9 scroll-mt-24 border-t border-line pt-7">
            <h2 className="text-xl font-semibold text-ink">Issue categories</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Categories are configurable by the operating organization. Staff may change the
              category during review.
            </p>
            <dl className="mt-3 border-t border-line">
              {(categories.length ? categories : []).map((category) => (
                <div key={category.slug} className="grid gap-1 border-b border-line py-2.5 sm:grid-cols-[180px_1fr]">
                  <dt className="text-xs font-semibold text-ink">{category.label}</dt>
                  <dd className="text-[11px] leading-relaxed text-ink-muted">{category.description}</dd>
                </div>
              ))}
              {categoriesQuery.isError ? (
                <p className="py-3 text-xs text-warn">
                  The live category list could not be loaded. Sign in or try again in a moment.
                </p>
              ) : null}
            </dl>
          </section>

          <section id="statuses" className="mt-9 scroll-mt-24 border-t border-line pt-7">
            <h2 className="text-xl font-semibold text-ink">What each status means</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Status changes are enforced by the server. A rejected, closed or reopened report
              retains the reason recorded by staff.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-y border-line">
                    <th className="py-2 pr-4 text-[10px] uppercase tracking-wider text-ink-muted">Status</th>
                    <th className="py-2 pr-4 text-[10px] uppercase tracking-wider text-ink-muted">Meaning</th>
                    <th className="py-2 text-[10px] uppercase tracking-wider text-ink-muted">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {STATUS_DEFINITIONS.map((entry) => (
                    <tr key={entry.status} className="border-b border-line align-top">
                      <td className="py-2.5 pr-4">
                        <StatusBadge status={entry.status} subtle />
                      </td>
                      <td className="py-2.5 pr-4 leading-relaxed text-ink-soft">{entry.meaning}</td>
                      <td className="py-2.5 text-[11px] text-ink-muted">{entry.whoActs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="tracking" className="mt-9 scroll-mt-24 border-t border-line pt-7">
            <h2 className="text-xl font-semibold text-ink">Tracking and privacy</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="border-l-2 border-civic pl-3">
                <h3 className="text-sm font-semibold text-ink">Guest tracking needs both values</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Enter the public reference and the secure tracking code. The code is derived from a
                  server-only secret and is not guessable from the reference. Guest tracking shows
                  status updates only, not your address or attachments.
                </p>
              </div>
              <div className="border-l-2 border-civic pl-3">
                <h3 className="text-sm font-semibold text-ink">Signed in gives you the full record</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Sign in to see your report details, location, attachments, comments and feedback.
                  Other citizens cannot access your record.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-[3px] border border-line bg-surface p-3">
              <p className="text-[11px] font-semibold text-ink">What staff can see</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                Assigned field staff see the report details needed to do the work. Department
                managers see reports within their department. Administrators see city-level records.
                Internal notes, moderation details and staff-only evidence are hidden from citizens.
              </p>
            </div>
          </section>

          <section id="accessibility" className="mt-9 scroll-mt-24 border-t border-line pt-7">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-ink">
              <Accessibility aria-hidden="true" className="size-5 text-civic" />
              Accessibility
            </h2>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-ink-muted">
              <li>Every primary action can be reached and operated with a keyboard.</li>
              <li>Focus is visible, and form errors are associated with their fields and announced.</li>
              <li>Status is not communicated by colour alone — labels accompany every status badge.</li>
              <li>The map has a keyboard-accessible list alternative with the same filtered records.</li>
              <li>Motion is reduced automatically when your device requests it.</li>
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
              If a part of this service blocks you, contact the operating organization and describe
              the page, task and assistive technology you are using.
            </p>
          </section>

          <section id="contact" className="mt-9 scroll-mt-24 border-t border-line pt-7">
            <h2 className="text-xl font-semibold text-ink">Get help</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted">
              This demonstration installation does not include a live support inbox. In a real
              deployment, the operating organization should replace this section with its service
              desk phone number, email address and opening hours.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="border border-line bg-surface p-3">
                <Clock3 aria-hidden="true" className="size-4 text-ink-muted" />
                <p className="mt-2 text-xs font-semibold text-ink">Report status</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  Sign in and open the report from your dashboard for the latest recorded update.
                </p>
                <Link to="/dashboard" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-civic">
                  Open dashboard <ArrowUpRight className="size-3" />
                </Link>
              </div>
              <div className="border border-line bg-surface p-3">
                <FileText aria-hidden="true" className="size-4 text-ink-muted" />
                <p className="mt-2 text-xs font-semibold text-ink">Policies</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                  The privacy notice and terms are clearly marked drafts until the operating
                  organization reviews them.
                </p>
                <div className="mt-2 flex gap-3 text-[11px] font-semibold text-civic">
                  <Link to="/privacy" className="hover:underline">Privacy</Link>
                  <Link to="/terms" className="hover:underline">Terms</Link>
                </div>
              </div>
            </div>
          </section>

          <section id="faq" className="mt-9 scroll-mt-24 border-t border-line pt-7">
            <h2 className="text-xl font-semibold text-ink">Frequently asked questions</h2>
            <div className="mt-3 border-t border-line">
              {FAQS.map((faq) => (
                <details key={faq.question} className="group border-b border-line">
                  <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 py-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <span className="font-mono text-base font-normal text-ink-faint group-open:hidden" aria-hidden="true">+</span>
                    <span className="hidden font-mono text-base font-normal text-ink-faint group-open:inline" aria-hidden="true">−</span>
                  </summary>
                  <p className="pb-3 pr-6 text-xs leading-relaxed text-ink-muted">{faq.answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

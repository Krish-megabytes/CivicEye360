import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ClipboardPen,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useCategories } from '../../hooks/queries';
import { CATEGORY_FALLBACKS, FAQS, STATUS_DEFINITIONS } from '../../content';
import { Badge, Button, LinkButton, StatusBadge } from '../../components/ui/base';
import { roleHome } from '../../utils/format';

const HERO_TIMELINE = [
  { status: 'Submitted' as const, label: 'Report received', detail: 'Reference and secure tracking code created.' },
  { status: 'Under Review' as const, label: 'Reviewed by staff', detail: 'Category and priority confirmed by a person.' },
  { status: 'Assigned' as const, label: 'Assigned to Public Works', detail: 'Field crew and service target recorded.' },
  { status: 'In Progress' as const, label: 'Work started', detail: 'Crew note and timetable visible to the reporter.' },
];

export function LandingPage() {
  const { user } = useAuth();
  const categoriesQuery = useCategories();
  const categories = categoriesQuery.data ?? CATEGORY_FALLBACKS;
  const reportTarget = user ? (user.role === 'citizen' ? '/reports/new' : roleHome(user.role)) : '/register';

  return (
    <div>
      <section className="border-b border-line">
        <div className="container-page grid gap-10 py-10 sm:py-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14 lg:py-16">
          <div className="flex flex-col justify-center">
            <p className="eyebrow">Civic issue reporting · end to end</p>
            <h1 className="display mt-3 text-[2.7rem] leading-[1.02] text-ink sm:text-[3.6rem] lg:text-[4.05rem]">
              Report civic issues.
              <br />
              <span className="text-civic">Track real progress.</span>
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-ink-soft">
              A civic issue should not disappear into a mailbox. CivicEye 360 gives every report a
              traceable record — from first submission through human review, field work and
              verified resolution.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <LinkButton to={reportTarget} size="lg">
                Report an issue
                <ArrowRight aria-hidden="true" className="size-4" />
              </LinkButton>
              <LinkButton to="/track" variant="secondary" size="lg">
                Track a report
              </LinkButton>
              <LinkButton to="/login?portal=ngo" variant="secondary" size="lg">
                NGO partner sign in
              </LinkButton>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
              <span className="inline-flex items-center gap-1">
                <Check aria-hidden="true" className="size-3 text-good" /> No app download
              </span>
              <span className="inline-flex items-center gap-1">
                <Check aria-hidden="true" className="size-3 text-good" /> Human review
              </span>
              <span className="inline-flex items-center gap-1">
                <Check aria-hidden="true" className="size-3 text-good" /> Recorded decisions
              </span>
            </div>
            <p className="mt-5 max-w-lg border-l-2 border-accent pl-3 text-[11px] leading-relaxed text-ink-muted">
              CivicEye 360 is not an emergency-response service. For immediate danger, contact your
              local emergency service.
            </p>
          </div>

          <aside className="self-start border border-line bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="eyebrow">Example record</span>
                <Badge tone="neutral">Illustration</Badge>
              </div>
              <span className="font-mono text-[10px] text-ink-faint">CE-2026-014287</span>
            </div>
            <div className="px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status="Assigned" />
                <Badge tone="accent">High priority</Badge>
                <span className="text-[11px] text-ink-muted">Streetlights</span>
              </div>
              <h2 className="mt-2.5 text-[1.05rem] font-semibold leading-snug text-ink">
                Streetlight out on Harbour Walk for three nights
              </h2>
              <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ink-muted">
                <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                Harbour Walk, north of Ferry Steps
              </p>
              <ol className="mt-4 border-t border-line">
                {HERO_TIMELINE.map((step, index) => (
                  <li key={step.status} className="flex gap-3 border-b border-line py-2.5">
                    <span
                      className={`mt-1 grid size-4 shrink-0 place-items-center rounded-full border text-[8px] font-bold ${
                        index === HERO_TIMELINE.length - 1
                          ? 'border-civic bg-civic text-white'
                          : 'border-good bg-good-soft text-good'
                      }`}
                      aria-hidden="true"
                    >
                      {index < HERO_TIMELINE.length - 1 ? '✓' : '•'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-ink">{step.label}</p>
                        <span className="text-[9px] uppercase tracking-wide text-ink-faint">{step.status}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex items-start gap-2 rounded-[3px] bg-paper px-2.5 py-2">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-civic" />
                <p className="text-[10px] leading-relaxed text-ink-muted">
                  Every status change stores the actor, time and reason. This panel is an
                  illustration, not live report data.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section id="how-it-works" className="border-b border-line bg-[#efede5]">
        <div className="container-page py-10 sm:py-12">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">A visible workflow</p>
              <h2 className="display mt-1.5 text-[2rem] text-ink sm:text-[2.45rem]">Report. Review. Resolve.</h2>
            </div>
            <p className="max-w-md text-xs leading-relaxed text-ink-muted">
              No black box. Each step has a named owner, a recorded decision and a clear meaning for
              the resident waiting on the other side.
            </p>
          </div>
          <ol className="mt-7 grid gap-px border-y border-line-strong bg-line-strong md:grid-cols-3">
            {[
              {
                number: '01',
                title: 'Report the issue',
                text: 'Add a title, description, category and location. A photo is optional. You receive a public reference and a secure tracking code.',
                note: 'Citizen',
              },
              {
                number: '02',
                title: 'A person reviews it',
                text: 'Staff check the details, confirm category and priority, look for duplicates and route the report to the responsible department.',
                note: 'Triage team',
              },
              {
                number: '03',
                title: 'Work is recorded',
                text: 'Field staff update progress, add evidence and record a resolution summary. The resident can follow the public timeline and respond.',
                note: 'Field team',
              },
            ].map((step) => (
              <li key={step.number} className="bg-paper px-4 py-5 sm:px-5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-ink-faint">{step.number}</span>
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-ink-muted">{step.note}</span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="categories" className="border-b border-line">
        <div className="container-page py-10 sm:py-12">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="eyebrow">What you can report</p>
              <h2 className="display mt-1.5 text-[2rem] text-ink sm:text-[2.4rem]">
                Everyday issues that make a neighbourhood work.
              </h2>
              <p className="mt-3 max-w-sm text-xs leading-relaxed text-ink-muted">
                Categories are configured by the operating organization. If an issue does not fit,
                choose “Other” and explain what you found.
              </p>
              <p className="mt-4 text-[11px] text-ink-muted">
                <Link to="/help#categories" className="font-semibold text-civic underline">
                  Read what each category covers
                </Link>
              </p>
            </div>
            <div className="border-t border-line">
              {categories.slice(0, 10).map((category, index) => (
                <div
                  key={category.slug}
                  className="grid grid-cols-[28px_1fr] gap-3 border-b border-line py-2.5 sm:grid-cols-[34px_190px_1fr] sm:items-baseline"
                >
                  <span className="font-mono text-[10px] text-ink-faint">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <p className="text-[13px] font-semibold text-ink">{category.label}</p>
                  <p className="col-span-2 text-[11px] leading-relaxed text-ink-muted sm:col-span-1">
                    {category.description}
                  </p>
                </div>
              ))}
              {categoriesQuery.isError ? (
                <p className="pt-2 text-[10px] text-warn">
                  The live category list could not be loaded. Showing the standard list.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section id="transparency" className="border-b border-line bg-civic-dark text-white">
        <div className="container-page grid gap-8 py-10 sm:py-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#f0b357]">Transparency by design</p>
            <h2 className="display mt-2 max-w-md text-[2rem] text-white sm:text-[2.4rem]">
              Evidence over reassurance.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-7 text-white/70">
              CivicEye 360 shows what happened, who changed it and what is still unknown. If a
              capability is not configured, the product says so instead of pretending.
            </p>
            <div className="mt-5">
              <LinkButton to="/help" variant="secondary" size="sm" className="border-white/30 bg-transparent text-white hover:bg-white/10">
                How the process works
              </LinkButton>
            </div>
          </div>
          <div className="grid gap-px border border-white/15 bg-white/15 sm:grid-cols-2">
            {[
              {
                title: 'Human review of AI',
                text: 'Suggestions are labelled and editable. A person confirms the category, makes the priority decision and controls every transition.',
              },
              {
                title: 'Private by default',
                text: 'Citizens see their own reports. Department managers see their department. Internal notes and staff evidence are never mixed into public updates.',
              },
              {
                title: 'Tracking that cannot be guessed',
                text: 'Guest tracking needs a secure code derived from a server-only secret. A predictable reference number alone does not expose a report.',
              },
              {
                title: 'Metrics from real records',
                text: 'Dashboard counts, trends and resolution times come from stored reports. Overdue labels only appear when an SLA has been configured.',
              },
            ].map((item) => (
              <div key={item.title} className="bg-civic-dark p-4">
                <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                <p className="mt-1.5 text-[11px] leading-relaxed text-white/65">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-line">
        <div className="container-page py-10 sm:py-12">
          <p className="eyebrow">One system, three points of view</p>
          <div className="mt-2 grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
            <h2 className="display text-[2rem] text-ink sm:text-[2.4rem]">
              Built for the whole response chain.
            </h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                {
                  icon: ClipboardPen,
                  title: 'Residents',
                  points: [
                    'A clear reference and tracking code',
                    'Public status timeline and updates',
                    'Feedback and reopening review',
                  ],
                },
                {
                  icon: Users,
                  title: 'Field teams',
                  points: [
                    'Assigned work in priority order',
                    'Mobile lookups and map links',
                    'Progress notes and evidence capture',
                  ],
                },
                {
                  icon: ShieldCheck,
                  title: 'Administrators',
                  points: [
                    'Triage, assignment and audit context',
                    'Department workload and trends',
                    'CSV exports with access control',
                  ],
                },
              ].map((group) => {
                const Icon = group.icon;
                return (
                  <div key={group.title} className="border-t border-line-strong pt-3">
                    <Icon aria-hidden="true" className="size-4 text-civic" />
                    <h3 className="mt-2 text-sm font-semibold text-ink">{group.title}</h3>
                    <ul className="mt-2 space-y-1.5">
                      {group.points.map((point) => (
                        <li key={point} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-muted">
                          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-faint" aria-hidden="true" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-line bg-[#efede5]">
        <div className="container-page grid gap-8 py-10 sm:py-12 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="eyebrow">No invented promises</p>
            <h2 className="display mt-1.5 text-[2rem] text-ink sm:text-[2.4rem]">
              What each status means.
            </h2>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-ink-muted">
              Statuses are enforced server-side and recorded with the person and time of the change.
              A rejected or reopened report always retains a reason.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-y border-line-strong">
                  <th className="py-2 pr-4 text-[10px] uppercase tracking-[0.1em] text-ink-muted">Status</th>
                  <th className="py-2 pr-4 text-[10px] uppercase tracking-[0.1em] text-ink-muted">What it means</th>
                  <th className="py-2 text-[10px] uppercase tracking-[0.1em] text-ink-muted">Typical owner</th>
                </tr>
              </thead>
              <tbody>
                {STATUS_DEFINITIONS.filter((entry) =>
                  ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Closed', 'Rejected', 'Reopened'].includes(entry.status),
                ).map((entry) => (
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
        </div>
      </section>

      <section className="border-b border-line">
        <div className="container-page grid gap-8 py-10 sm:py-12 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="eyebrow">Questions before you report</p>
            <h2 className="display mt-1.5 text-[2rem] text-ink sm:text-[2.4rem]">The useful details.</h2>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-ink-muted">
              Need something else? Read the{' '}
              <Link to="/help" className="font-semibold text-civic underline">
                help centre
              </Link>
              .
            </p>
          </div>
          <div className="border-t border-line-strong">
            {FAQS.slice(0, 5).map((faq) => (
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
        </div>
      </section>

      <section id="ngo-partners" className="border-b border-line scroll-mt-20">
        <div className="container-page grid gap-8 py-10 sm:py-12 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <div>
            <p className="eyebrow">Community partners</p>
            <h2 className="display mt-1.5 text-[2rem] text-ink sm:text-[2.4rem]">
              NGOs can turn reports into verified work.
            </h2>
            <p className="mt-3 max-w-xl text-xs leading-relaxed text-ink-muted">
              Registered organizations claim open civic tasks, upload before-and-after photos, and
              earn points once an administrator has checked the evidence. Approved work counts
              toward a public NGO leaderboard.
            </p>
            <ol className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ['01', 'Claim a task', 'Pick an open report that matches your team\u2019s capacity.'],
                ['02', 'Show the work', 'Upload photos of the finished site and a short summary.'],
                ['03', 'Get verified', 'An administrator reviews every photo, then points are awarded.'],
              ].map(([number, title, detail]) => (
                <li key={number} className="border-t border-line-strong pt-2.5">
                  <span className="font-mono text-[10px] text-ink-faint">{number}</span>
                  <p className="mt-1 text-sm font-semibold text-ink">{title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">{detail}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-2 border border-line bg-surface p-5">
            <p className="text-sm font-semibold text-ink">Already a partner?</p>
            <p className="text-[11px] leading-relaxed text-ink-muted">
              Sign in with your organization email to open the NGO task hub, see your points and
              check the leaderboard.
            </p>
            <LinkButton to="/login?portal=ngo" className="mt-2">
              NGO partner sign in
              <ArrowRight aria-hidden="true" className="size-4" />
            </LinkButton>
            <LinkButton to="/register/ngo" variant="secondary">
              Register your NGO
            </LinkButton>
          </div>
        </div>
      </section>

      <section className="bg-civic">
        <div className="container-page grid gap-6 py-10 sm:py-12 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">Start a traceable record</p>
            <h2 className="display mt-2 max-w-2xl text-[2.1rem] text-white sm:text-[2.7rem]">
              If something needs fixing, give it a reference.
            </h2>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-white/75">
              Submit the issue once. Follow the review, assignment and resolution from the same
              record. Staff can act on it; you can see what changed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <LinkButton
              to={reportTarget}
              variant="secondary"
              size="lg"
              className="border-white bg-white text-civic hover:bg-paper"
            >
              Report an issue
            </LinkButton>
            <LinkButton
              to="/track"
              variant="secondary"
              size="lg"
              className="border-white/40 bg-transparent text-white hover:bg-white/10"
            >
              Track a report
            </LinkButton>
          </div>
        </div>
      </section>

      <div className="container-page py-5">
        <p className="flex flex-wrap items-center gap-2 text-[10px] text-ink-faint">
          <MapPin aria-hidden="true" className="size-3" />
          Locations are collected to route field work and show issue patterns. Address handling is
          described in the draft privacy notice.
          <Link to="/privacy" className="font-semibold text-ink-muted underline">
            Read privacy notice
          </Link>
        </p>
      </div>
    </div>
  );
}

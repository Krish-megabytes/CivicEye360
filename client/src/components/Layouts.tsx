import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Building2,
  Camera,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  Plus,
  ScrollText,
  Settings2,
  ShieldCheck,
  Trophy,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import { Brand } from './Brand';
import { useAuth } from '../auth/AuthContext';
import { Avatar, LinkButton } from './ui/base';
import { roleHome } from '../utils/format';

export function PublicLayout({ children }: { children?: ReactNode }) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navigation = [
    { label: 'How it works', to: '/#how-it-works' },
    { label: 'Issue categories', to: '/#categories' },
    { label: 'Transparency', to: '/#transparency' },
    { label: 'Help', to: '/help' },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-sm">
        <div className="container-page flex h-16 items-center justify-between gap-5">
          <Brand />
          <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
            {navigation.map((item) =>
              item.to.startsWith('/#') ? (
                <a
                  key={item.label}
                  href={item.to}
                  className="text-[13px] font-medium text-ink-soft transition-colors hover:text-civic"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.label}
                  to={item.to}
                  className="text-[13px] font-medium text-ink-soft transition-colors hover:text-civic"
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>
          <div className="hidden items-center gap-2 sm:flex">
            <LinkButton to="/track" variant="secondary" size="sm">
              Track a report
            </LinkButton>
            {user ? (
              <LinkButton to={roleHome(user.role)} size="sm">
                Open dashboard
              </LinkButton>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-2 py-1 text-[13px] font-semibold text-ink-soft hover:text-civic"
                >
                  Sign in
                </Link>
                <Link
                  to="/login?portal=ngo"
                  className="px-2 py-1 text-[13px] font-semibold text-ink-soft hover:text-civic"
                >
                  NGO sign in
                </Link>
                <LinkButton to="/register" size="sm">
                  Report an issue
                </LinkButton>
              </>
            )}
          </div>
          <button
            type="button"
            className="rounded border border-line bg-surface p-2 text-ink sm:hidden"
            aria-expanded={mobileOpen}
            aria-controls="public-mobile-nav"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
        {mobileOpen ? (
          <div id="public-mobile-nav" className="border-t border-line bg-paper px-5 py-3 sm:hidden">
            <nav aria-label="Mobile" className="flex flex-col">
              {navigation.map((item) =>
                item.to.startsWith('/#') ? (
                  <a
                    key={item.label}
                    href={item.to}
                    className="border-b border-line/70 py-2.5 text-sm font-medium text-ink-soft"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="border-b border-line/70 py-2.5 text-sm font-medium text-ink-soft"
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </nav>
            <div className="mt-3 flex flex-col gap-2">
              <LinkButton to="/track" variant="secondary" size="sm">
                Track a report
              </LinkButton>
              {user ? (
                <LinkButton to={roleHome(user.role)} size="sm">
                  Open dashboard
                </LinkButton>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <LinkButton to="/login" variant="secondary" size="sm">
                      Sign in
                    </LinkButton>
                    <LinkButton to="/register" size="sm">
                      Report an issue
                    </LinkButton>
                  </div>
                  <LinkButton to="/login?portal=ngo" variant="secondary" size="sm">
                    NGO partner sign in
                  </LinkButton>
                </>
              )}
            </div>
          </div>
        ) : null}
      </header>
      <main id="main-content" className="flex-1">
        {children ?? <Outlet />}
      </main>
      <PublicFooter />
    </div>
  );
}

function PublicFooter() {
  return (
    <footer className="border-t border-line bg-[#efede5]">
      <div className="container-page py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div>
            <Brand />
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-ink-muted">
              A transparent civic issue workflow for residents, field teams and municipal
              administrators. Report, review, resolve and learn from what happened.
            </p>
            <p className="mt-3 max-w-xs text-[11px] leading-relaxed text-ink-faint">
              AI suggestions are advisory and reviewed by people. CivicEye 360 is not an emergency
              service.
            </p>
          </div>
          <FooterColumn
            title="Residents"
            links={[
              { label: 'Report an issue', to: '/register' },
              { label: 'Track a report', to: '/track' },
              { label: 'Citizen dashboard', to: '/dashboard' },
              { label: 'Help', to: '/help' },
            ]}
          />
          <FooterColumn
            title="NGO partners"
            links={[
              { label: 'NGO sign in', to: '/login?portal=ngo' },
              { label: 'Register your NGO', to: '/register/ngo' },
              { label: 'How points work', to: '/#ngo-partners' },
            ]}
          />
          <FooterColumn
            title="Municipal teams"
            links={[
              { label: 'Staff sign in', to: '/login' },
              { label: 'Field workspace', to: '/staff' },
              { label: 'Administration', to: '/admin' },
            ]}
          />
          <FooterColumn
            title="Policies"
            links={[
              { label: 'Privacy', to: '/privacy' },
              { label: 'Terms', to: '/terms' },
              { label: 'Accessibility', to: '/help#accessibility' },
            ]}
          />
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-line-strong/50 pt-4 text-[11px] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} CivicEye 360. Demonstration installation.</p>
          <p>Status definitions and service targets are set by the operating organization.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<{ label: string; to: string }> }) {
  return (
    <div>
      <h2 className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">{title}</h2>
      <ul className="mt-2.5 space-y-1.5">
        {links.map((link) => (
          <li key={link.label}>
            <Link to={link.to} className="text-xs text-ink-soft hover:text-civic">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-paper">
      <a href="#auth-main" className="skip-link">
        Skip to main content
      </a>
      <header className="border-b border-line bg-paper">
        <div className="container-page flex h-16 items-center justify-between">
          <Brand />
          <Link to="/" className="text-xs font-semibold text-ink-muted hover:text-civic">
            Back to public site
          </Link>
        </div>
      </header>
      <main id="auth-main" className="container-page py-8 md:py-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_460px] lg:gap-16">
          <section className="hidden lg:block" aria-label="About CivicEye 360">
            <p className="eyebrow">Civic service, made traceable</p>
            <h1 className="display mt-3 max-w-xl text-[2.8rem] text-ink xl:text-[3.35rem]">
              Report civic issues.
              <br />
              Track real progress.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-ink-soft">
              One record from first report to verified resolution. Residents see what happened,
              field teams know what is assigned, and administrators can measure the work with real
              data.
            </p>
            <ol className="mt-8 max-w-md border-t border-line">
              {[
                ['01', 'Report', 'Submit details, location and optional photo.'],
                ['02', 'Review', 'A person confirms category, priority and responsibility.'],
                ['03', 'Resolve', 'Field staff record progress, evidence and a resolution summary.'],
              ].map(([number, title, description]) => (
                <li key={number} className="flex gap-4 border-b border-line py-3.5">
                  <span className="font-mono text-[11px] font-semibold text-ink-faint">{number}</span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-6 max-w-md border-l-2 border-accent pl-3 text-[11px] leading-relaxed text-ink-muted">
              AI can suggest a category or summary. It never decides, closes or rejects a report.
              For emergencies, call your local emergency service.
            </p>
          </section>
          <section className="w-full max-w-[460px] lg:justify-self-end">
            <Outlet />
          </section>
        </div>
      </main>
    </div>
  );
}

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, permission: undefined, roles: ['citizen'], end: true },
      { to: '/dashboard/reports', label: 'My reports', icon: FileText, permission: undefined, roles: ['citizen'] },
      { to: '/dashboard/map', label: 'My report map', icon: MapIcon, permission: undefined, roles: ['citizen'] },
      { to: '/reports/new', label: 'Report an issue', icon: Plus, permission: 'reports.create', roles: undefined },
      { to: '/staff', label: 'My tasks', icon: ClipboardList, roles: ['field_staff'] },
      { to: '/admin', label: 'Overview', icon: LayoutDashboard, permission: 'dashboard.view', roles: undefined, end: true },
      { to: '/admin/reports', label: 'Reports', icon: FileText, permission: 'dashboard.view', roles: undefined },
      { to: '/admin/ngo-review', label: 'NGO task review', icon: ShieldCheck, permission: undefined, roles: ['municipal_admin', 'platform_admin'] },
      { to: '/admin/map', label: 'Map explorer', icon: MapIcon, permission: 'map.view', roles: undefined },
      { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, permission: 'analytics.view', roles: undefined },
    ],
  },
  {
    label: 'NGO workspace',
    items: [
      { to: '/ngo', label: 'Overview', icon: LayoutDashboard, roles: ['ngo'], end: true },
      { to: '/ngo/tasks', label: 'Available tasks', icon: ClipboardList, roles: ['ngo'] },
      { to: '/ngo/work', label: 'My work', icon: Camera, roles: ['ngo'] },
      { to: '/ngo/leaderboard', label: 'Leaderboard', icon: Trophy, roles: ['ngo'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin/departments', label: 'Departments', icon: Building2, permission: 'departments.manage', roles: undefined },
      { to: '/admin/users', label: 'Users & roles', icon: Users, permission: 'users.manage', roles: undefined },
      { to: '/admin/settings', label: 'Configuration', icon: Settings2, permission: 'categories.manage', roles: undefined },
      { to: '/admin/audit', label: 'Audit log', icon: ScrollText, permission: 'audit.view', roles: undefined },
    ],
  },
] as const;

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  if (!user) return null;

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.roles && !(item.roles as readonly string[]).includes(user.role)) return false;
      if ('permission' in item && item.permission && !user.permissions.includes(item.permission)) return false;
      if (['citizen', 'ngo'].includes(user.role) && item.to.startsWith('/admin')) return false;
      if (user.role === 'ngo' && !item.to.startsWith('/ngo')) return false;
      if (item.to === '/admin/ngo-review' && !['municipal_admin', 'platform_admin'].includes(user.role)) return false;
      if (user.role !== 'citizen' && item.to === '/reports/new') return false;
      return true;
    }),
  })).filter((group) => group.items.length > 0);

  async function handleLogout() {
    setSigningOut(true);
    await logout();
    navigate('/');
  }

  const sidebarContent = (
    <>
      <div className="flex h-16 items-center border-b border-line px-4">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        {visibleGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.16em] text-ink-faint">
              {group.label}
            </p>
            <nav aria-label={group.label} className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={'end' in item ? Boolean(item.end) : false}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                        isActive
                          ? 'bg-civic text-white shadow-[0_8px_18px_-12px_rgba(37,99,235,0.9)]'
                          : 'text-ink-soft hover:bg-civic-tint hover:text-civic'
                      }`
                    }
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}
        <div className="mt-6 border-t border-line pt-4">
          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold ${
                isActive ? 'bg-civic text-white' : 'text-ink-soft hover:bg-civic-tint hover:text-civic'
              }`
            }
          >
            <Bell aria-hidden="true" className="size-4" />
            Notifications
            {user.unreadNotifications > 0 ? (
              <span className="ml-auto rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
                {user.unreadNotifications}
              </span>
            ) : null}
          </NavLink>
          <NavLink
            to="/settings/profile"
            className={({ isActive }) =>
              `mt-1 flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold ${
                isActive ? 'bg-civic text-white' : 'text-ink-soft hover:bg-civic-tint hover:text-civic'
              }`
            }
          >
            <UserIcon aria-hidden="true" className="size-4" />
            Profile & settings
          </NavLink>
        </div>
      </div>
      <div className="border-t border-line p-3">
        <div className="flex items-center gap-2.5 rounded-[10px] bg-paper px-2 py-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-civic-tint text-xs font-bold text-civic">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-ink">{user.name}</p>
            <p className="truncate text-[10px] text-ink-muted">{user.roleLabel}</p>
          </div>
          <Link
            to="/"
            className="rounded-[8px] p-1.5 text-ink-faint hover:bg-surface hover:text-civic"
            aria-label="Open public site"
            title="Public site"
          >
            <ShieldCheck aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={signingOut}
          className="mt-1 flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-xs font-semibold text-ink-muted hover:bg-paper hover:text-ink disabled:opacity-50"
        >
          <LogOut aria-hidden="true" className="size-3.5" />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-paper">
      <a href="#app-main" className="skip-link">
        Skip to main content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[246px] flex-col border-r border-line bg-surface md:flex">
        {sidebarContent}
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink/60"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative flex h-full w-[280px] max-w-[85vw] flex-col border-r border-line bg-surface shadow-2xl">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close navigation"
              className="absolute right-2 top-4 z-10 rounded-[8px] p-2 text-ink-muted hover:bg-paper"
            >
              <X className="size-4" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      <div className="md:pl-[246px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="rounded border border-line p-1.5 text-ink md:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="size-4" />
            </button>
            <p className="truncate text-[13px] font-medium text-ink-muted">
              CivicEye 360
              <span className="mx-1.5 text-line-strong">/</span>
              <span className="font-semibold text-ink">{sectionName(location.pathname)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user.role === 'citizen' ? (
              <LinkButton to="/reports/new" size="sm" variant="secondary" className="hidden sm:inline-flex">
                <Plus aria-hidden="true" className="size-3.5" />
                New report
              </LinkButton>
            ) : null}
            <Link
              to="/notifications"
              className="relative grid size-9 place-items-center rounded-full border border-line bg-surface text-ink-muted transition-colors hover:border-civic/40 hover:text-civic"
              aria-label={`Notifications${user.unreadNotifications ? `, ${user.unreadNotifications} unread` : ''}`}
            >
              <Bell className="size-4" />
              {user.unreadNotifications > 0 ? (
                <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold leading-4 text-white">
                  {user.unreadNotifications > 9 ? '9+' : user.unreadNotifications}
                </span>
              ) : null}
            </Link>
            <Link
              to="/settings/profile"
              className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 transition-colors hover:border-civic/40"
            >
              <Avatar name={user.name} size="sm" />
              <span className="hidden text-xs font-semibold text-ink sm:block">{user.name}</span>
            </Link>
          </div>
        </header>
        <main id="app-main" className="mx-auto w-full max-w-[1420px] px-4 py-6 md:px-6 md:py-7 lg:px-8">
          <Outlet />
        </main>
        <footer className="mx-auto flex w-full max-w-[1420px] flex-col gap-1 border-t border-line px-4 py-4 text-[10px] text-ink-faint md:flex-row md:items-center md:justify-between md:px-6 lg:px-8">
          <p>CivicEye 360 · All operational metrics are derived from stored report records.</p>
          <p>AI suggestions are advisory. Not an emergency service.</p>
        </footer>
      </div>
    </div>
  );
}

function sectionName(pathname: string): string {
  if (pathname.startsWith('/admin/reports/')) return 'Report operations';
  if (pathname.startsWith('/admin/analytics')) return 'Analytics';
  if (pathname.startsWith('/admin/map')) return 'Map explorer';
  if (pathname.startsWith('/admin/departments')) return 'Departments';
  if (pathname.startsWith('/admin/users')) return 'Users & roles';
  if (pathname.startsWith('/admin/settings')) return 'Configuration';
  if (pathname.startsWith('/admin/audit')) return 'Audit log';
  if (pathname.startsWith('/admin')) return 'Overview';
  if (pathname.startsWith('/staff')) return 'Field workspace';
  if (pathname.startsWith('/dashboard/reports')) return 'My reports';
  if (pathname.startsWith('/dashboard/map')) return 'My report map';
  if (pathname === '/ngo') return 'NGO overview';
  if (pathname.startsWith('/ngo/tasks')) return 'NGO available tasks';
  if (pathname.startsWith('/ngo/work')) return 'NGO my work';
  if (pathname.startsWith('/ngo/leaderboard')) return 'NGO leaderboard';
  if (pathname.startsWith('/admin/ngo-review')) return 'NGO task review';
  if (pathname.startsWith('/reports/new')) return 'New report';
  if (pathname.startsWith('/reports/')) return 'Report details';
  if (pathname.startsWith('/notifications')) return 'Notifications';
  if (pathname.startsWith('/settings')) return 'Profile & settings';
  return 'Dashboard';
}

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(15,30,53,0.04),0_24px_50px_-34px_rgba(15,30,53,0.4)] sm:p-7">
      <h1 className="text-xl font-bold tracking-tight text-ink">{title}</h1>
      {description ? <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{description}</p> : null}
      <div className="mt-5">{children}</div>
      {footer ? <div className="mt-5 border-t border-line pt-4 text-sm">{footer}</div> : null}
    </div>
  );
}

export function useSignOut() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return async () => {
    await logout();
    navigate('/');
  };
}


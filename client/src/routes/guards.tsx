import type { ReactNode } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { LockKeyhole, MapPinOff } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../types';
import { Brand } from '../components/Brand';
import { LinkButton } from '../components/ui/base';
import { roleHome } from '../utils/format';

export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AppLoading />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <Outlet />;
}

export function AppLoading() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="flex h-16 items-center border-b border-line px-5">
        <Brand />
      </div>
      <div className="container-page py-10" role="status" aria-live="polite">
        <span className="sr-only">Loading CivicEye 360</span>
        <div className="h-3 w-32 animate-pulse rounded bg-line" />
        <div className="mt-4 h-8 w-2/3 max-w-lg animate-pulse rounded bg-line" />
        <div className="mt-8 grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse border border-line bg-surface" />
          ))}
        </div>
        <div className="mt-4 h-72 animate-pulse border border-line bg-surface" />
      </div>
    </div>
  );
}

export function ForbiddenPage({
  title = 'You do not have access to this area',
  description = 'Your current role does not include this workspace. If you believe this is a mistake, ask a platform administrator to review your role and department.',
}: {
  title?: string;
  description?: string;
}) {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="border-l-2 border-danger pl-5">
        <LockKeyhole aria-hidden="true" className="size-5 text-danger" />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{description}</p>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <LinkButton to={user ? roleHome(user.role) : '/login'}>
          {user ? 'Return to your workspace' : 'Sign in'}
        </LinkButton>
        <LinkButton to="/help" variant="secondary">
          Get help
        </LinkButton>
      </div>
      <p className="mt-6 text-[11px] text-ink-faint">403 · Permission required</p>
    </div>
  );
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AppLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.permissions.includes(permission)) return <ForbiddenPage />;
  return <>{children}</>;
}

export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AppLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <ForbiddenPage />;
  return <>{children}</>;
}

export function CitizenOnly({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AppLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'citizen') return <Navigate to={roleHome(user.role)} replace />;
  return <>{children}</>;
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-line">
        <div className="container-page flex h-16 items-center">
          <Brand />
        </div>
      </header>
      <main className="container-page flex flex-1 items-start py-16">
        <div className="max-w-xl">
          <p className="eyebrow">404 · Page not found</p>
          <h1 className="display mt-3 text-4xl text-ink sm:text-5xl">
            This page is not on the map.
          </h1>
          <p className="mt-4 text-sm leading-7 text-ink-muted">
            The address may have changed, or the link may be incomplete. You can return to the
            public site, sign in, or track a report using its reference and tracking code.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <LinkButton to="/">Back to home</LinkButton>
            <LinkButton to="/track" variant="secondary">
              Track a report
            </LinkButton>
            <LinkButton to="/login" variant="secondary">
              Sign in
            </LinkButton>
          </div>
        </div>
      </main>
      <div className="container-page flex items-center gap-2 border-t border-line py-4 text-[11px] text-ink-faint">
        <MapPinOff aria-hidden="true" className="size-3.5" />
        If a link in a notification is broken, open the report from your{' '}
        <Link to="/dashboard" className="underline">
          dashboard
        </Link>
        .
      </div>
    </div>
  );
}

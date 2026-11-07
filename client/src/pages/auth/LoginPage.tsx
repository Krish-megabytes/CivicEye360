import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AuthCard } from '../../components/Layouts';
import { Alert, Button, Field, Input } from '../../components/ui/base';
import { PasswordField } from '../../components/forms/PasswordField';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api';
import { getErrorMessage, roleHome } from '../../utils/format';

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isNgoPortal = searchParams.get('portal') === 'ngo';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const nextErrors: Record<string, string> = {};
    if (!email.trim()) nextErrors.email = 'Enter your email address.';
    if (!password) nextErrors.password = 'Enter your password.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      const requested = (location.state as LocationState | null)?.from;
      const target =
        requested && requested.startsWith('/') && !requested.startsWith('//')
          ? requested
          : roleHome(user.role);
      navigate(target, { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        if (caught.details && Array.isArray(caught.details)) {
          const fields: Record<string, string> = {};
          for (const detail of caught.details as Array<{ field?: string; message?: string }>) {
            if (detail.field && detail.message) fields[detail.field] = detail.message;
          }
          setFieldErrors(fields);
        }
      } else {
        setError(getErrorMessage(caught));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title={isNgoPortal ? 'NGO partner sign in' : 'Sign in'}
      description={
        isNgoPortal
          ? 'Use your organization email to claim tasks, upload evidence and track your points.'
          : 'Access your reports, assigned tasks or municipal workspace.'
      }
      footer={
        <div className="flex flex-col gap-2 text-[13px] text-ink-muted">
          <p>
            New to CivicEye 360?{' '}
            <Link to="/register" className="font-semibold text-civic hover:underline">
              Create an account
            </Link>
          </p>
          <p>
            {isNgoPortal ? (
              <Link to="/register/ngo" className="font-semibold text-civic hover:underline">
                Register your NGO
              </Link>
            ) : (
              <Link to="/login?portal=ngo" className="text-ink-soft hover:text-civic">
                NGO partner? Sign in here
              </Link>
            )}
          </p>
          <p>
            <Link to="/track" className="text-ink-soft hover:text-civic">
              Track a report without signing in
            </Link>
          </p>
        </div>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {isNgoPortal ? (
          <Alert tone="info" title="NGO partner access">
            Sign in with the organization email you registered. Not registered yet?{' '}
            <Link to="/register/ngo" className="font-semibold text-civic underline">
              Create an NGO account
            </Link>
            .
          </Alert>
        ) : null}
        {error ? <Alert tone="error" title="Sign in failed">{error}</Alert> : null}
        <Field label="Email address" htmlFor="email" error={fieldErrors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            invalid={Boolean(fieldErrors.email)}
            required
          />
        </Field>
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          error={fieldErrors.password}
        />
        <div className="flex items-center justify-between pt-1">
          <Link to="/forgot-password" className="text-xs font-medium text-civic hover:underline">
            Forgot your password?
          </Link>
          <span className="text-[10px] text-ink-faint">Secure httpOnly session</span>
        </div>
        <Button type="submit" className="w-full" loading={submitting} size="lg">
          Sign in
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
      </form>
      <div className="mt-4 border-t border-line pt-4">
        <p className="text-[11px] leading-relaxed text-ink-muted">
          Staff access is provisioned by a platform administrator. Demo installations list
          development-only accounts in the project README.
        </p>
      </div>
    </AuthCard>
  );
}

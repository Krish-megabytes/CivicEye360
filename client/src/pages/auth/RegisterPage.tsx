import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { AuthCard } from '../../components/Layouts';
import { Alert, Button, Checkbox, Field, Input } from '../../components/ui/base';
import { PasswordField } from '../../components/forms/PasswordField';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../api';
import { getErrorMessage } from '../../utils/format';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const rules = useMemo(
    () => [
      { label: 'At least 10 characters', met: password.length >= 10 },
      { label: 'Contains a letter', met: /[A-Za-z]/.test(password) },
      { label: 'Contains a number', met: /[0-9]/.test(password) },
    ],
    [password],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const nextErrors: Record<string, string> = {};
    if (name.trim().length < 2) nextErrors.name = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!rules.every((rule) => rule.met)) nextErrors.password = 'Choose a stronger password.';
    if (password !== confirm) nextErrors.confirm = 'Passwords do not match.';
    if (!consent) nextErrors.consent = 'Confirm that you understand how this service works.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await register(name.trim(), email.trim().toLowerCase(), password);
      navigate('/dashboard', { replace: true });
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
      title="Create a resident account"
      description="Report issues, follow progress and receive updates on the reports you submit."
      footer={
        <p className="text-[13px] text-ink-muted">
          Are you an NGO?{' '}
          <Link to="/register/ngo" className="font-semibold text-civic hover:underline">Register your organization</Link>
          <span className="mx-2">·</span>Already have an account?{' '}
          <Link to="/login" className="font-semibold text-civic hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error ? <Alert tone="error" title="Account not created">{error}</Alert> : null}
        <Field label="Full name" htmlFor="name" error={fieldErrors.name}>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            invalid={Boolean(fieldErrors.name)}
            required
          />
        </Field>
        <Field label="Email address" htmlFor="email" error={fieldErrors.email} hint="Used for sign-in and configured email notifications.">
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
          autoComplete="new-password"
          error={fieldErrors.password}
        />
        <ul className="grid grid-cols-1 gap-1 text-[11px] text-ink-muted sm:grid-cols-3" aria-label="Password requirements">
          {rules.map((rule) => (
            <li key={rule.label} className="flex items-center gap-1.5">
              <span
                className={`grid size-3.5 place-items-center rounded-full border ${
                  rule.met ? 'border-good bg-good text-white' : 'border-line-strong bg-surface'
                }`}
                aria-hidden="true"
              >
                {rule.met ? <Check className="size-2.5" /> : null}
              </span>
              <span className={rule.met ? 'text-good' : undefined}>{rule.label}</span>
            </li>
          ))}
        </ul>
        <PasswordField
          id="confirm"
          label="Confirm password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={fieldErrors.confirm}
        />
        <div>
          <Checkbox
            id="consent"
            checked={consent}
            onChange={setConsent}
            label="I understand how this service works"
            description="CivicEye 360 is not an emergency service. Reports are reviewed by municipal staff, and AI suggestions are advisory only. Draft privacy and terms policies apply."
          />
          {fieldErrors.consent ? (
            <p className="mt-1 text-xs font-medium text-danger" role="alert">
              {fieldErrors.consent}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          Create account
        </Button>
        <p className="text-center text-[10px] leading-relaxed text-ink-faint">
          By continuing you accept the{' '}
          <Link to="/terms" className="underline">
            draft terms
          </Link>{' '}
          and acknowledge the{' '}
          <Link to="/privacy" className="underline">
            draft privacy notice
          </Link>
          .
        </p>
      </form>
    </AuthCard>
  );
}

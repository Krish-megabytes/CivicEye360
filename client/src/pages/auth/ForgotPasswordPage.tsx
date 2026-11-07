import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthCard } from '../../components/Layouts';
import { Alert, Button, Field, Input } from '../../components/ui/base';
import { api, ApiError } from '../../api';
import { getErrorMessage } from '../../utils/format';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    message: string;
    emailConfigured: boolean;
    devResetUrl?: string;
  } | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      setResult(await api.auth.forgotPassword(email.trim().toLowerCase()));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter the email on your account. If an active account matches, we will prepare a single-use reset link."
      footer={
        <p className="text-[13px] text-ink-muted">
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-civic hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      {result ? (
        <div className="space-y-4">
          <Alert tone="success" title="Reset request processed">
            {result.message}
          </Alert>
          {!result.emailConfigured ? (
            <Alert tone="warning" title="Email delivery is not configured">
              {result.devResetUrl ? (
                <>
                  This is a development environment. No email was sent. Use the single-use
                  development link below. It expires in one hour and is never shown in production.
                  <a
                    href={result.devResetUrl}
                    className="mt-2 block break-all font-semibold text-civic underline"
                  >
                    Open development reset link
                  </a>
                </>
              ) : (
                'No email provider is configured. Ask the platform administrator to configure SMTP or reset the account directly.'
              )}
            </Alert>
          ) : (
            <p className="text-xs text-ink-muted">
              Check your inbox and spam folder. The link expires after one hour and can only be
              used once.
            </p>
          )}
          <Button variant="secondary" onClick={() => setResult(null)}>
            Use a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {error ? <Alert tone="error" title="Request failed">{error}</Alert> : null}
          <Field label="Email address" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          <Button type="submit" className="w-full" loading={submitting} size="lg">
            Prepare reset link
          </Button>
          <p className="text-[11px] leading-relaxed text-ink-muted">
            For privacy, the response is the same whether or not an account exists.
          </p>
        </form>
      )}
    </AuthCard>
  );
}

import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthCard } from '../../components/Layouts';
import { Alert, Button } from '../../components/ui/base';
import { PasswordField } from '../../components/forms/PasswordField';
import { api, ApiError } from '../../api';
import { getErrorMessage } from '../../utils/format';
import { useAuth } from '../../auth/AuthContext';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const tokenLooksValid = useMemo(() => /^[a-f\d]{64}$/i.test(token), [token]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Use at least 10 characters with a letter and a number.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await api.auth.resetPassword({ token, password });
      setSuccess(true);
      await refresh().catch(() => {});
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  if (!tokenLooksValid) {
    return (
      <AuthCard title="Reset link not valid" description="This reset link is incomplete or malformed.">
        <Alert tone="error" title="Invalid link">
          Request a new password reset link. Reset links expire after one hour and can only be used
          once.
        </Alert>
        <div className="mt-4">
          <Link to="/forgot-password" className="text-sm font-semibold text-civic hover:underline">
            Request a new link
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (success) {
    return (
      <AuthCard
        title="Password updated"
        description="Your password has been changed and any older sessions have been invalidated."
      >
        <Alert tone="success" title="You can continue">
          You are now signed in with the new password. If you did not make this change, contact
          your platform administrator immediately.
        </Alert>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={() => {
              void refresh();
              navigate('/dashboard');
            }}
          >
            Continue to dashboard
          </Button>
          <Link to="/login" className="inline-flex items-center px-2 text-sm font-semibold text-civic">
            Go to sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Use at least 10 characters with a letter and a number. This link works once."
      footer={
        <Link to="/login" className="text-[13px] font-semibold text-civic hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {error ? <Alert tone="error" title="Password not changed">{error}</Alert> : null}
        <PasswordField
          id="password"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <PasswordField
          id="confirm"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />
        <Button type="submit" className="w-full" loading={submitting} size="lg">
          Update password
        </Button>
      </form>
    </AuthCard>
  );
}

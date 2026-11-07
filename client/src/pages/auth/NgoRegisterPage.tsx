import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthCard } from '../../components/Layouts';
import { Alert, Button, Field, Input } from '../../components/ui/base';
import { PasswordField } from '../../components/forms/PasswordField';
import { api, ApiError } from '../../api';
import { useQueryClient } from '@tanstack/react-query';

export function NgoRegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const user = await api.auth.registerNgo({ name: name.trim(), email: email.trim().toLowerCase(), password });
      queryClient.setQueryData(['me'], user); navigate('/ngo', { replace: true });
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Registration failed.'); }
    finally { setBusy(false); }
  }
  return <AuthCard title="Register your NGO" description="Partner with your community: claim civic tasks, submit photo evidence and earn verified impact points." footer={<p className="text-sm text-ink-muted">Already registered? <Link to="/login?portal=ngo" className="text-civic underline">Sign in</Link></p>}>
    <form className="space-y-4" onSubmit={submit}>{error && <Alert tone="error">{error}</Alert>}
      <Field label="Organization name" htmlFor="ngo-name"><Input id="ngo-name" autoComplete="organization" value={name} onChange={e => setName(e.target.value)} minLength={2} required /></Field>
      <Field label="Organization email" htmlFor="ngo-email"><Input id="ngo-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></Field>
      <PasswordField id="ngo-password" label="Password" value={password} onChange={setPassword} autoComplete="new-password" />
      <Button type="submit" className="w-full" loading={busy}>Create NGO account</Button>
    </form>
  </AuthCard>;
}

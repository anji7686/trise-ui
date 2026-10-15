import { useEffect, useState, type FormEvent } from 'react';
import { apiClient } from '@trise/api-client';
import { useAuth } from './index';

const configuredEmailsFromBuild = (import.meta.env.VITE_DEVELOPMENT_SIGN_IN_EMAILS ?? '')
  .split(',')
  .map((email: string) => email.trim().toLowerCase())
  .filter((email: string, index: number, emails: string[]) => email && emails.indexOf(email) === index);

export default function DevelopmentSignInForm() {
  const { signInForDevelopment } = useAuth();
  const [email, setEmail] = useState('');
  const [configuredEmails, setConfiguredEmails] = useState(configuredEmailsFromBuild);
  const [secret, setSecret] = useState('');
  const [pending, setPending] = useState(false);
  const [autoSignIn, setAutoSignIn] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void apiClient.request<{ data: string[] }>('/session/development/identities')
      .then(body => {
        if (!cancelled) setConfiguredEmails(body.data.map((value: string) => value.trim().toLowerCase()));
      })
      .catch(() => { /* The build-time list remains a safe local fallback. */ });
    return () => { cancelled = true; };
  }, []);
  async function signIn(selectedEmail: string, localSecret: string) {
    if (pending) return;
    setPending(true);
    try { await signInForDevelopment(selectedEmail.trim(), localSecret); }
    catch { /* AuthProvider displays the server failure. */ }
    finally { setSecret(''); setPending(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await signIn(email, secret);
  }
  return <form onSubmit={event => { void submit(event); }} style={{ display: 'grid', gap: '0.75rem', maxWidth: '26rem', marginTop: '1rem' }}>
    <strong>Local development sign-in</strong>
    <p>Use your approved test email and local secret.</p>
    <label style={{ display: 'grid', gap: '0.25rem' }}>Test email<input name="email" list="trise-development-sign-in-emails" type="email" autoComplete="username" required maxLength={320} value={email} onChange={event => { setEmail(event.target.value); setSecret(''); }} disabled={pending} /></label>
    <datalist id="trise-development-sign-in-emails">{configuredEmails.map((configuredEmail: string) => <option key={configuredEmail} value={configuredEmail} />)}</datalist>
    <label style={{ display: 'grid', gap: '0.25rem' }}>Local secret<input name="secret" type="password" autoComplete="off" required minLength={20} maxLength={256} value={secret} onChange={event => {
      const value = event.target.value;
      setSecret(value);
      if (autoSignIn && email && /^[a-f0-9]{40}$/.test(value)) void signIn(email, value);
    }} disabled={pending} /></label>
    <label><input type="checkbox" checked={autoSignIn} disabled={pending} onChange={event => {
      setAutoSignIn(event.target.checked);
      if (event.target.checked && email && /^[a-f0-9]{40}$/.test(secret)) void signIn(email, secret);
    }} /> Automatically sign in when my email and local secret are ready</label>
    <button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in locally'}</button>
  </form>;
}

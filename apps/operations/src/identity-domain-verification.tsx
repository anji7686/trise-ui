import { useEffect, useState } from 'react';
import { VerificationHeader } from './verification-header';

type Step = { key: string; label: string; status: 'COMPLETED' | 'CURRENT' | 'UPCOMING' };
type Presentation = { status: string; title: string; message: string; next_action?: string; steps?: Step[]; support_available?: boolean; already_completed?: boolean };
type VerificationState = { kind: 'loading' | 'ready' | 'error'; message: string; detail: string; presentation?: Presentation };

const apiBaseUrl = () => import.meta.env.VITE_API_BASE_URL;

async function requestVerification(token: string, method: 'GET' | 'POST') {
  const baseUrl = apiBaseUrl();
  if (!baseUrl) throw new Error('The verification service is not configured.');
  const response = await fetch(`${baseUrl}/identity-domain-verifications/${encodeURIComponent(token)}`, { method, headers: { Accept: 'application/json' }, credentials: 'include', cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'This verification link is invalid or has expired.');
  return body.data as Presentation;
}

export function IdentityDomainVerificationPage({ token }: { token: string }) {
  const [state, setState] = useState<VerificationState>({ kind: 'loading', message: 'Please wait while we securely check this link.', detail: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => { void requestVerification(token, 'GET').then((presentation) => setState({ kind: 'ready', message: presentation.message, detail: '', presentation })).catch((error: unknown) => setState({ kind: 'error', message: error instanceof Error ? error.message : 'This verification link is invalid or has expired.', detail: 'Please request a new verification email or contact your organization administrator.' })); }, [token]);

  const confirm = async () => {
    setBusy(true);
    try { const presentation = await requestVerification(token, 'POST'); setState({ kind: 'ready', message: presentation.message, detail: '', presentation }); }
    catch (error: unknown) { setState({ kind: 'error', message: error instanceof Error ? error.message : 'Verification could not be completed.', detail: 'Please request a new verification email or contact your organization administrator.' }); }
    finally { setBusy(false); }
  };
  const presentation = state.presentation;
  const canConfirm = state.kind === 'ready' && presentation?.status === 'pending_verification';
  const completed = presentation?.steps?.filter((step) => step.status === 'COMPLETED').length || 0;

  return <main className="public-verification-shell" aria-busy={state.kind === 'loading' || busy}><section className="public-verification-card" aria-live="polite">
    <VerificationHeader variant="dark" />
    {state.kind === 'loading' ? <div className="public-verification-spinner" aria-label="Loading" /> : <div className={`public-verification-icon ${state.kind === 'error' ? 'error' : presentation?.status === 'pending_verification' ? 'pending' : 'success'}`} aria-hidden="true">{state.kind === 'error' ? '!' : presentation?.status === 'pending_verification' ? '✉' : '✓'}</div>}
    <p className="public-verification-eyebrow">Business contact verification</p>
    <h1>{state.kind === 'loading' ? 'Checking your verification link' : state.kind === 'error' ? 'Verification link unavailable' : presentation?.title}</h1>
    <p className="public-verification-message">{state.kind === 'loading' ? state.message : state.kind === 'error' ? state.message : presentation?.message}</p>
    {state.kind === 'ready' && presentation?.steps && <div className="public-verification-steps" aria-label="Verification progress">{presentation.steps.map((step, index) => <div className={`public-verification-step ${step.status.toLowerCase()}`} key={step.key}><span>{step.status === 'COMPLETED' ? '✓' : index + 1}</span><strong>{step.label}</strong><small>{step.status === 'COMPLETED' ? 'Completed' : step.status === 'CURRENT' ? 'Current' : 'Upcoming'}</small></div>)}</div>}
    {canConfirm && <div className="public-verification-action"><p>Click below to confirm control of this business mailbox. This does not grant provider access; Global Administrator approval remains required.</p><button type="button" disabled={busy} onClick={() => void confirm()}>{busy ? 'Confirming…' : 'Confirm email verification'}</button></div>}
    {state.kind === 'ready' && !canConfirm && <section className="public-verification-next"><div><strong>{presentation?.next_action === 'WAIT_FOR_APPROVAL' ? 'Waiting for Global Administrator approval' : presentation?.status === 'active' ? 'What happens next?' : 'Verification complete'}</strong><p>{presentation?.status === 'active' ? 'You can now sign in using your authorized TRISE identity. Provider membership and roles remain separately enforced.' : presentation?.next_action === 'WAIT_FOR_APPROVAL' ? 'Your request is submitted for review. You will receive an approved notification when the domain becomes active.' : 'No further action is required from this link.'}</p></div></section>}
    <div className="public-verification-columns"><section><strong>What happens next?</strong><ol><li>TRISE records the verification result.</li><li>A Global Administrator reviews the request.</li><li>Domain activation follows only after approval.</li></ol></section><section><strong>Need an update?</strong><p>Contact your organization administrator or the configured TRISE support team.</p></section></div>
    <footer className="public-verification-footer"><span>🔒 Your information is protected by TRISE India security controls.</span><span>Secure verification · {completed}/3 steps complete</span></footer>
  </section></main>;
}

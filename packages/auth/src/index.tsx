import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiClient, type ApiClient } from '@trise/api-client';

export type Session = { userId: string; displayName: string; locale: string | null; revision: number; providerId?: string };
type AuthContextValue = { session: Session | null; loading: boolean; error: string | null; signInWithGoogleIdentityToken: (identityToken: string) => Promise<void>; signOut: () => Promise<void>; setProvider: (providerId?: string) => void; refreshCurrentUser: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);
type GoogleIdentityResponse = { credential?: string };
type GoogleAccounts = { id: { initialize: (options: { client_id: string; callback: (response: GoogleIdentityResponse) => void }) => void; renderButton: (element: HTMLElement, options: Record<string, string>) => void } };
type ApiUser = { id: string; attributes: { display_name?: string; locale?: string | null; revision: number } };
declare global { interface Window { google?: { accounts: GoogleAccounts } } }
const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';
let googleScriptPromise: Promise<void> | null = null;
let initializedGoogleClientId: string | null = null;

function authDiagnostic(stage: string, details: Record<string, unknown> = {}) {
  if (import.meta.env.DEV) console.info(`[trise-auth] ${stage}`, details);
}

export function sessionFromApiUser(user: ApiUser): Session {
  return { userId: user.id, displayName: user.attributes.display_name || 'TRISE User', locale: user.attributes.locale ?? null, revision: user.attributes.revision };
}

export function authFailureMessage(cause: unknown, action: 'load' | 'sign-in' = 'load') {
  const failure = cause as { status?: number; code?: string; message?: string };
  if (!failure.status) return 'The local API is unavailable. Start Rails and try again.';
  if (failure.status === 401) return action === 'sign-in' ? 'Google sign-in was rejected or the session expired.' : null;
  if (failure.code === 'context_changed') return 'The selected context changed. Please retry.';
  return action === 'sign-in' ? (failure.message || 'Google sign-in could not be completed.') : 'The current user could not be loaded. Please retry.';
}

function loadGoogleScript() {
  if (window.google) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise<void>((resolve, reject) => {
    authDiagnostic('gis-script-requested');
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => { authDiagnostic('gis-script-loaded'); resolve(); }, { once: true });
      existing.addEventListener('error', () => { authDiagnostic('gis-script-failed'); reject(new Error('Google Identity Services script failed to load')); }, { once: true });
      return;
    }
    const element = document.createElement('script');
    element.src = GOOGLE_SCRIPT;
    element.async = true;
    element.defer = true;
    element.addEventListener('load', () => { authDiagnostic('gis-script-loaded'); resolve(); }, { once: true });
    element.addEventListener('error', () => { authDiagnostic('gis-script-failed'); reject(new Error('Google Identity Services script failed to load')); }, { once: true });
    document.head.appendChild(element);
  });
  return googleScriptPromise;
}

export function AuthProvider({ children, client = apiClient }: { children: ReactNode; client?: ApiClient }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadCurrentUser = useCallback(async () => {
    try {
      const body = await client.request<ApiUser>('/me');
      setSession(sessionFromApiUser(body)); setError(null);
    } catch (cause) {
      const failure = cause as { status?: number; code?: string };
      if (failure.status === 401) { setSession(null); setError(null); }
      const message = authFailureMessage(cause);
      if (message) setError(message);
    }
    finally { setLoading(false); }
  }, [client]);
  useEffect(() => { void loadCurrentUser(); }, [loadCurrentUser]);
  const signInWithGoogleIdentityToken = useCallback(async (identityToken: string) => {
    setLoading(true); setError(null);
    authDiagnostic('session-exchange-started');
    try {
      const body = await client.request<{ access_token: string; user: { id: string; attributes: { display_name?: string; locale?: string | null; revision: number } } }>('/session/google', { method: 'POST', body: JSON.stringify({ google_identity_token: identityToken, client_type: 'web' }) });
      client.setAccessToken(body.access_token);
      setSession(sessionFromApiUser(body.user));
      authDiagnostic('session-exchange-succeeded');
    } catch (cause) { client.clearSession(); setSession(null); authDiagnostic('session-exchange-failed', { status: (cause as { status?: number }).status, code: (cause as { code?: string }).code }); setError(authFailureMessage(cause, 'sign-in') || 'Google sign-in was rejected or the session expired.'); throw cause; }
    finally { setLoading(false); }
  }, [client]);
  const signOut = useCallback(async () => {
    try { if (session) await client.request('/session', { method: 'DELETE' }); }
    catch { /* local cleanup still happens for expired/revoked sessions */ }
    finally { client.clearSession(); setSession(null); setError(null); sessionStorage.clear(); }
  }, [client, session]);
  const setProvider = useCallback((providerId?: string) => { client.changeContext(); setSession((current) => current ? { ...current, providerId } : current); }, [client]);
  const value = useMemo(() => ({ session, loading, error, signInWithGoogleIdentityToken, signOut, refreshCurrentUser: loadCurrentUser, setProvider }), [session, loading, error, signInWithGoogleIdentityToken, signOut, loadCurrentUser, setProvider]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider is required'); return value; }

export function GoogleSignInButton() {
  const { signInWithGoogleIdentityToken } = useAuth();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [gisError, setGisError] = useState<string | null>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  useEffect(() => {
    if (!clientId || !container) return;
    let cancelled = false;
    void loadGoogleScript().then(() => {
      if (cancelled || !window.google) return;
      if (initializedGoogleClientId !== clientId) {
        window.google.accounts.id.initialize({ client_id: clientId, callback: (response) => {
          authDiagnostic('credential-callback', { credential_present: Boolean(response.credential) });
          if (!response.credential) { setGisError('Google did not return a sign-in credential. Please try again.'); return; }
          void signInWithGoogleIdentityToken(response.credential).catch(() => undefined);
        } });
        initializedGoogleClientId = clientId;
        authDiagnostic('gis-initialized');
      }
      window.google.accounts.id.renderButton(container, { theme: 'outline', size: 'large', text: 'signin_with' });
    }).catch(() => { if (!cancelled) setGisError('Google Identity Services could not load. Check network access and try again.'); });
    return () => { cancelled = true; };
  }, [clientId, container, signInWithGoogleIdentityToken]);
  if (!clientId) return <p role="status">Google sign-in is not configured for this local origin.</p>;
  if (gisError) return <p role="status">{gisError}</p>;
  return <div ref={setContainer} aria-label="Sign in with Google" />;
}

export const googleAuthStatus = 'Google Identity Services credential exchange';

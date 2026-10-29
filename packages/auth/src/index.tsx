import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiClient, type ApiClient } from '@trise/api-client';

export type ProviderCapabilityContext = { providerId: string; displayName: string; roleContext?: string; operationsAccess?: boolean; capabilities: string[] };
export type Session = { userId: string; displayName: string; locale: string | null; revision: number; providerId?: string; platformAdmin?: boolean; platformCapabilities?: string[]; providerCapabilities: ProviderCapabilityContext[] };
type AuthContextValue = { session: Session | null; loading: boolean; error: string | null; signInWithGoogleIdentityToken: (identityToken: string) => Promise<void>; signInForDevelopment: (email: string, secret: string) => Promise<void>; signInForDevelopmentQuick: (email: string) => Promise<void>; signOut: () => Promise<void>; setProvider: (providerId?: string) => void; refreshCurrentUser: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);
type GoogleIdentityResponse = { credential?: string };
type GoogleAccounts = { id: { initialize: (options: { client_id: string; callback: (response: GoogleIdentityResponse) => void }) => void; renderButton: (element: HTMLElement, options: Record<string, string>) => void } };
type ApiUser = { id: string; attributes: { display_name?: string; locale?: string | null; revision: number; platform_admin?: boolean; platform_capabilities?: string[]; provider_capabilities?: Array<{ provider_id: string; display_name: string; role_context?: string; operations_access?: boolean; capabilities: string[] }> } };
declare global { interface Window { google?: { accounts: GoogleAccounts } } }
const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';
export const SESSION_STARTED_EVENT = 'trise:session-started';
let googleScriptPromise: Promise<void> | null = null;
let initializedGoogleClientId: string | null = null;
const DevelopmentSignInForm = import.meta.env.DEV && import.meta.env.VITE_DEVELOPMENT_SIGN_IN === 'true'
  ? lazy(() => import('./development-sign-in')) : null;

function authDiagnostic(stage: string, details: Record<string, unknown> = {}) {
  if (import.meta.env.DEV) console.info(`[trise-auth] ${stage}`, details);
}

function notifySessionStarted(user: ApiUser) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_STARTED_EVENT, { detail: { userId: user.id } }));
  }
}

export function sessionFromApiUser(user: ApiUser): Session {
  return { userId: user.id, displayName: user.attributes.display_name || 'TRISE User', locale: user.attributes.locale ?? null, revision: user.attributes.revision, providerCapabilities: (user.attributes.provider_capabilities || []).map((context) => ({ providerId: context.provider_id, displayName: context.display_name, roleContext: context.role_context, operationsAccess: context.operations_access, capabilities: context.capabilities })), ...(user.attributes.platform_admin ? { platformAdmin: true, platformCapabilities: user.attributes.platform_capabilities || [] } : {}) };
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
  const attempt = new Promise<void>((resolve, reject) => {
    authDiagnostic('gis-script-requested');
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => { authDiagnostic('gis-script-loaded'); resolve(); }, { once: true });
      existing.addEventListener('error', () => { existing.remove(); authDiagnostic('gis-script-failed'); reject(new Error('Google Identity Services script failed to load')); }, { once: true });
      return;
    }
    const element = document.createElement('script');
    element.src = GOOGLE_SCRIPT;
    element.async = true;
    element.defer = true;
    element.addEventListener('load', () => { authDiagnostic('gis-script-loaded'); resolve(); }, { once: true });
    element.addEventListener('error', () => { element.remove(); authDiagnostic('gis-script-failed'); reject(new Error('Google Identity Services script failed to load')); }, { once: true });
    document.head.appendChild(element);
  });
  googleScriptPromise = attempt;
  return attempt.catch((cause) => {
    if (googleScriptPromise === attempt) googleScriptPromise = null;
    throw cause;
  });
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
  const signInForDevelopment = useCallback(async (email: string, secret: string) => {
    if (!import.meta.env.DEV || import.meta.env.VITE_DEVELOPMENT_SIGN_IN !== 'true') throw new Error('Local sign-in is unavailable');
    setLoading(true); setError(null);
    client.clearSession();
    try {
      const body = await client.request<{ access_token: string; user: ApiUser }>('/session/development', { method: 'POST', body: JSON.stringify({ email, secret, client_type: 'web' }) });
      client.setAccessToken(body.access_token);
      setSession(sessionFromApiUser(body.user));
      notifySessionStarted(body.user);
    } catch (cause) {
      client.clearSession(); setSession(null);
      const status = (cause as { status?: number }).status;
      setError(status === 429 ? 'Too many sign-in attempts. Wait a minute and retry.' : status === 401 ? 'Local sign-in was rejected. Check your email and secret.' : 'Local sign-in is unavailable. Check the development API configuration.');
      throw cause;
    } finally { setLoading(false); }
  }, [client]);
  const signInForDevelopmentQuick = useCallback(async (email: string) => {
    if (!import.meta.env.DEV || import.meta.env.VITE_DEVELOPMENT_SIGN_IN !== 'true' || import.meta.env.VITE_DEVELOPMENT_QUICK_SIGN_IN !== 'true') throw new Error('Local quick sign-in is unavailable');
    setLoading(true); setError(null);
    client.clearSession();
    try {
      const body = await client.request<{ access_token: string; user: ApiUser }>('/session/development/quick', { method: 'POST', body: JSON.stringify({ email, client_type: 'web' }) });
      client.setAccessToken(body.access_token);
      setSession(sessionFromApiUser(body.user));
      notifySessionStarted(body.user);
    } catch (cause) {
      client.clearSession(); setSession(null);
      const status = (cause as { status?: number }).status;
      setError(status === 429 ? 'Too many sign-in attempts. Wait a minute and retry.' : status === 401 ? 'Local quick sign-in was rejected. Choose an approved account.' : 'Local quick sign-in is unavailable. Check the development API configuration.');
      throw cause;
    } finally { setLoading(false); }
  }, [client]);
  useEffect(() => { void loadCurrentUser(); }, [loadCurrentUser]);
  useEffect(() => {
    const handleSessionExpired = () => {
      client.clearSession();
      setSession(null);
      setError(null);
    };
    window.addEventListener('trise:session-expired', handleSessionExpired);
    return () => window.removeEventListener('trise:session-expired', handleSessionExpired);
  }, [client]);
  const signInWithGoogleIdentityToken = useCallback(async (identityToken: string) => {
    setLoading(true); setError(null);
    authDiagnostic('session-exchange-started');
    try {
      const body = await client.request<{ access_token: string; user: ApiUser }>('/session/google', { method: 'POST', body: JSON.stringify({ google_identity_token: identityToken, client_type: 'web' }) });
      client.setAccessToken(body.access_token);
      setSession(sessionFromApiUser(body.user));
      notifySessionStarted(body.user);
      authDiagnostic('session-exchange-succeeded');
    } catch (cause) { client.clearSession(); setSession(null); authDiagnostic('session-exchange-failed', { status: (cause as { status?: number }).status, code: (cause as { code?: string }).code }); setError(authFailureMessage(cause, 'sign-in') || 'Google sign-in was rejected or the session expired.'); throw cause; }
    finally { setLoading(false); }
  }, [client]);
  const signOut = useCallback(async () => {
    try { if (session) await client.request('/session', { method: 'DELETE' }); }
    catch { /* local cleanup still happens for expired/revoked sessions */ }
    finally { client.clearSession(); setSession(null); setError(null); sessionStorage.clear(); }
  }, [client, session]);
  const setProvider = useCallback((providerId?: string) => {
    setSession((current) => {
      if (!current || current.providerId === providerId) return current;
      client.changeContext();
      return { ...current, providerId };
    });
  }, [client]);
  const value = useMemo(() => ({ session, loading, error, signInWithGoogleIdentityToken, signInForDevelopment, signInForDevelopmentQuick, signOut, refreshCurrentUser: loadCurrentUser, setProvider }), [session, loading, error, signInWithGoogleIdentityToken, signInForDevelopment, signInForDevelopmentQuick, signOut, loadCurrentUser, setProvider]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider is required'); return value; }
export function useOptionalAuth() { return useContext(AuthContext); }

export function GoogleSignInButton() {
  return <><GoogleIdentityButton />{DevelopmentSignInForm && <Suspense fallback={<p role="status">Loading local sign-in…</p>}><DevelopmentSignInForm /></Suspense>}</>;
}

function GoogleIdentityButton() {
  const { signInWithGoogleIdentityToken } = useAuth();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [gisError, setGisError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
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
  }, [clientId, container, loadAttempt, signInWithGoogleIdentityToken]);
  if (!clientId) return <p role="status">Google sign-in is not configured for this local origin.</p>;
  if (gisError) return <div className="customer-login-gis-error"><p role="alert">{gisError}</p><button type="button" onClick={() => { setGisError(null); setLoadAttempt((attempt) => attempt + 1); }}>Retry Google sign-in</button></div>;
  return <div ref={setContainer} aria-label="Sign in with Google" />;
}

export const googleAuthStatus = 'Google Identity Services credential exchange';

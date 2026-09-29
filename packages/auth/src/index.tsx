import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiClient, type ApiClient } from '@trise/api-client';

export type Session = { userId: string; displayName: string; locale: string | null; revision: number; providerId?: string };
type AuthContextValue = { session: Session | null; loading: boolean; error: string | null; signInWithGoogleIdentityToken: (identityToken: string) => Promise<void>; signOut: () => Promise<void>; setProvider: (providerId?: string) => void; refreshCurrentUser: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);
type GoogleIdentityResponse = { credential?: string };
type GoogleAccounts = { id: { initialize: (options: { client_id: string; callback: (response: GoogleIdentityResponse) => void }) => void; renderButton: (element: HTMLElement, options: Record<string, string>) => void } };
declare global { interface Window { google?: { accounts: GoogleAccounts } } }
const GOOGLE_SCRIPT = 'https://accounts.google.com/gsi/client';

export function AuthProvider({ children, client = apiClient }: { children: ReactNode; client?: ApiClient }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadCurrentUser = useCallback(async () => {
    try {
      const body = await client.request<{ data: { id: string; attributes: { display_name?: string; locale?: string | null; revision: number } } }>('/me');
      const attributes = body.data.attributes;
      setSession({ userId: body.data.id, displayName: attributes.display_name || 'TRISE User', locale: attributes.locale ?? null, revision: attributes.revision }); setError(null);
    } catch (cause) { if ((cause as { status?: number }).status === 401) setSession(null); else setError('Unable to load the current user.'); }
    finally { setLoading(false); }
  }, [client]);
  useEffect(() => { void loadCurrentUser(); }, [loadCurrentUser]);
  const signInWithGoogleIdentityToken = useCallback(async (identityToken: string) => {
    setLoading(true); setError(null);
    try {
      const body = await client.request<{ access_token: string; user: { id: string; attributes: { display_name?: string; locale?: string | null; revision: number } } }>('/session/google', { method: 'POST', body: JSON.stringify({ google_identity_token: identityToken, client_type: 'web' }) });
      client.setAccessToken(body.access_token); const attributes = body.user.attributes;
      setSession({ userId: body.user.id, displayName: attributes.display_name || 'TRISE User', locale: attributes.locale ?? null, revision: attributes.revision });
    } catch (cause) { client.clearSession(); setSession(null); setError((cause as { message?: string }).message || 'Google sign-in was not accepted.'); throw cause; }
    finally { setLoading(false); }
  }, [client]);
  const signOut = useCallback(async () => {
    try { if (session) await client.request('/session', { method: 'DELETE' }); }
    catch { /* local cleanup still happens for expired/revoked sessions */ }
    finally { client.clearSession(); setSession(null); setError(null); sessionStorage.clear(); }
  }, [client, session]);
  const value = useMemo(() => ({ session, loading, error, signInWithGoogleIdentityToken, signOut, refreshCurrentUser: loadCurrentUser, setProvider: (providerId?: string) => { client.changeContext(); setSession((current) => current ? { ...current, providerId } : current); } }), [session, loading, error, signInWithGoogleIdentityToken, signOut, loadCurrentUser, client]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider is required'); return value; }

export function GoogleSignInButton() {
  const { signInWithGoogleIdentityToken } = useAuth();
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  useEffect(() => {
    if (!clientId || !container) return;
    const render = () => { window.google?.accounts.id.initialize({ client_id: clientId, callback: (response) => { if (response.credential) void signInWithGoogleIdentityToken(response.credential); } }); window.google?.accounts.id.renderButton(container, { theme: 'outline', size: 'large', text: 'signin_with' }); };
    const script = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT}"]`);
    if (window.google) render();
    else if (script) script.addEventListener('load', render, { once: true });
    else { const element = document.createElement('script'); element.src = GOOGLE_SCRIPT; element.async = true; element.defer = true; element.addEventListener('load', render, { once: true }); document.head.appendChild(element); }
    return () => { script?.removeEventListener('load', render); };
  }, [clientId, container, signInWithGoogleIdentityToken]);
  return clientId ? <div ref={setContainer} aria-label="Sign in with Google" /> : <p role="status">Google sign-in is not configured for this local origin.</p>;
}

export const googleAuthStatus = 'Google Identity Services credential exchange';

export type RequestContext = { providerId?: string; signal?: AbortSignal };
export type ApiError = { status: number; code: string; message: string; details?: unknown[] };

const SESSION_REFRESH_LOCK = 'trise-session-refresh';
const SESSION_REFRESH_STORAGE_LOCK = 'trise-session-refresh-lock';
const SESSION_REFRESH_LOCK_TTL_MS = 10_000;
const SESSION_REFRESH_LOCK_WAIT_MS = 50;

type LockManagerLike = {
  request<T>(name: string, options: { mode: 'exclusive' }, callback: () => Promise<T>): Promise<T>;
};

export class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;
  private contextEpoch = 0;

  constructor(private readonly baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000/api/v1') {}

  setAccessToken(token: string | null) { this.accessToken = token; }
  clearSession() { this.accessToken = null; this.contextEpoch += 1; }
  changeContext() { this.contextEpoch += 1; }

  async request<T>(path: string, init: RequestInit = {}, context: RequestContext = {}): Promise<T> {
    return this.perform<T>(path, init, context, true);
  }

  async requestBlob(path: string, init: RequestInit = {}, context: RequestContext = {}): Promise<Blob> {
    const requestEpoch = this.contextEpoch;
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/octet-stream, application/json');
    if (context.providerId) headers.set('X-TRISE-Provider-Id', context.providerId);
    if (this.accessToken) headers.set('Authorization', `Bearer ${this.accessToken}`);
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers, signal: context.signal, credentials: 'include' });
    if (requestEpoch !== this.contextEpoch) throw { status: 409, code: 'context_changed', message: 'Request context changed before the response completed' } satisfies ApiError;
    if (response.status === 401 && !path.startsWith('/session/')) {
      const token = await this.refresh();
      if (token) return this.requestBlob(path, init, context);
      throw sessionExpiredError();
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw { status: response.status, code: body.code ?? 'http_error', message: body.message ?? 'Request failed', details: body.details } satisfies ApiError;
    }
    return response.blob();
  }

  private async perform<T>(path: string, init: RequestInit, context: RequestContext, mayRefresh: boolean): Promise<T> {
    const requestEpoch = this.contextEpoch;
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body) headers.set('Content-Type', 'application/json');
    if (context.providerId) headers.set('X-TRISE-Provider-Id', context.providerId);
    if (this.accessToken) headers.set('Authorization', `Bearer ${this.accessToken}`);
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers, signal: context.signal, credentials: 'include' });
    if (requestEpoch !== this.contextEpoch) throw { status: 409, code: 'context_changed', message: 'Request context changed before the response completed' } satisfies ApiError;
    if (response.status === 401 && mayRefresh && !path.startsWith('/session/')) {
      const token = await this.refresh();
      if (token) return this.perform(path, init, context, false);
      throw sessionExpiredError();
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw { status: response.status, code: body.code ?? 'http_error', message: body.message ?? 'Request failed', details: body.details } satisfies ApiError;
    }
    return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
  }

  async refresh(): Promise<string | null> {
    if (!this.refreshPromise) {
      this.refreshPromise = withRefreshLock(() => fetch(`${this.baseUrl}/session/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Accept': 'application/json', 'X-CSRF-Token': readCookie('trise_csrf') || '' }
        }).then(async (response) => {
          if (!response.ok) return null;
          const body = await response.json();
          this.accessToken = body.access_token ?? null;
          return this.accessToken;
        }))
        .catch(() => null)
        .finally(() => { this.refreshPromise = null; });
    }
    const token = await this.refreshPromise;
    if (!token) notifySessionExpired();
    return token;
  }
}

function withRefreshLock<T>(callback: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks) {
    return (navigator.locks as LockManagerLike).request(SESSION_REFRESH_LOCK, { mode: 'exclusive' }, callback);
  }
  return withStorageRefreshLock(callback);
}

async function withStorageRefreshLock<T>(callback: () => Promise<T>): Promise<T> {
  if (typeof window === 'undefined') return callback();

  let storage: Storage;
  try {
    storage = window.localStorage;
  } catch {
    return callback();
  }

  const owner = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const value = JSON.stringify({ owner, expiresAt: Date.now() + SESSION_REFRESH_LOCK_TTL_MS });
  for (let attempt = 0; attempt < SESSION_REFRESH_LOCK_TTL_MS / SESSION_REFRESH_LOCK_WAIT_MS; attempt += 1) {
    try {
      const existing = storage.getItem(SESSION_REFRESH_STORAGE_LOCK);
      const expiresAt = existing ? Number(JSON.parse(existing).expiresAt) : 0;
      if (!existing || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        storage.setItem(SESSION_REFRESH_STORAGE_LOCK, value);
        if (storage.getItem(SESSION_REFRESH_STORAGE_LOCK) === value) {
          try { return await callback(); }
          finally {
            if (storage.getItem(SESSION_REFRESH_STORAGE_LOCK) === value) storage.removeItem(SESSION_REFRESH_STORAGE_LOCK);
          }
        }
      }
    } catch {
      return callback();
    }
    await new Promise((resolve) => window.setTimeout(resolve, SESSION_REFRESH_LOCK_WAIT_MS));
  }
  return callback();
}

function notifySessionExpired() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('trise:session-expired'));
}

function sessionExpiredError(): ApiError {
  return { status: 401, code: 'session_expired', message: 'Your session has expired. Sign in again to continue.' };
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const value = document.cookie.split('; ').find((item) => item.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}

export const apiClient = new ApiClient();

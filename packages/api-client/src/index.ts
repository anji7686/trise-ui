export type RequestContext = { providerId?: string; signal?: AbortSignal };
export type ApiError = { status: number; code: string; message: string; details?: unknown[] };

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
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/pdf');
    if (this.accessToken) headers.set('Authorization', `Bearer ${this.accessToken}`);
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers, signal: context.signal, credentials: 'include' });
    if (response.status === 401 && !path.startsWith('/session/')) {
      const token = await this.refresh();
      if (token) return this.requestBlob(path, init, context);
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
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw { status: response.status, code: body.code ?? 'http_error', message: body.message ?? 'Request failed', details: body.details } satisfies ApiError;
    }
    return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
  }

  async refresh(): Promise<string | null> {
    if (!this.refreshPromise) {
      this.refreshPromise = fetch(`${this.baseUrl}/session/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Accept': 'application/json', 'X-CSRF-Token': readCookie('trise_csrf') || '' }
      }).then(async (response) => {
        if (!response.ok) return null;
        const body = await response.json();
        this.accessToken = body.access_token ?? null;
        return this.accessToken;
      }).catch(() => null).finally(() => { this.refreshPromise = null; });
    }
    return this.refreshPromise;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const value = document.cookie.split('; ').find((item) => item.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : null;
}

export const apiClient = new ApiClient();

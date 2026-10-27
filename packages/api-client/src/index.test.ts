import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from './index';

describe('API authentication boundary', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
  });

  it('keeps blob requests provider-scoped and rejects a response after provider context changes', async () => {
    let resolveResponse!: (response: Response) => void;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise((resolve) => { resolveResponse = resolve; }));
    const client = new ApiClient('http://127.0.0.1:3000/api/v1');
    const pending = client.requestBlob('/providers/report-exports/export-1/download', {}, { providerId: 'provider-a' });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-a');
    client.changeContext();
    resolveResponse(new Response('file-bytes', { status: 200 }));
    await expect(pending).rejects.toMatchObject({ code: 'context_changed' });
  });

  it('coordinates one web refresh for concurrent unauthorized requests', async () => {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'trise_csrf=csrf-token' } });
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'unauthorized' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'unauthorized' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'refreshed' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'one' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'two' } }), { status: 200 }));
    const client = new ApiClient('http://127.0.0.1:3000/api/v1');
    await expect(Promise.all([client.request('/one'), client.request('/two')])).resolves.toEqual([{ data: { id: 'one' } }, { data: { id: 'two' } }]);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ credentials: 'include' });
  });

  it('serializes refresh-token rotation across API client instances', async () => {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'trise_csrf=csrf-token' } });
    let lockBusy = false;
    let releaseWaiter: (() => void) | undefined;
    const locks = {
      request: vi.fn(async (_name: string, _options: { mode: 'exclusive' }, callback: () => Promise<unknown>) => {
        while (lockBusy) await new Promise<void>((resolve) => { releaseWaiter = resolve; });
        lockBusy = true;
        try { return await callback(); }
        finally {
          lockBusy = false;
          releaseWaiter?.();
          releaseWaiter = undefined;
        }
      })
    };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks } });
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'unauthorized' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'unauthorized' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'refreshed-one' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'refreshed-two' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'one' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'two' } }), { status: 200 }));
    const first = new ApiClient('http://127.0.0.1:3000/api/v1');
    const second = new ApiClient('http://127.0.0.1:3000/api/v1');

    await expect(Promise.all([first.request('/one'), second.request('/two')])).resolves.toEqual([{ data: { id: 'one' } }, { data: { id: 'two' } }]);
    expect(locks.request).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(2);
  });

  it('returns a recoverable session-expired error when refresh cannot recover', async () => {
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { cookie: 'trise_csrf=csrf-token' } });
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'unauthenticated', message: 'Authentication is required' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 'unauthenticated', message: 'Authentication is required' }), { status: 401 }));
    const client = new ApiClient('http://127.0.0.1:3000/api/v1');

    await expect(client.request('/private')).rejects.toMatchObject({ status: 401, code: 'session_expired', message: 'Your session has expired. Sign in again to continue.' });
  });

  it('lets the browser set the multipart boundary for file uploads', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'import-1' }), { status: 201 }));
    const client = new ApiClient('http://127.0.0.1:3000/api/v1');
    const form = new FormData();
    form.append('scope_type', 'ALL_INDIA');
    form.append('file', new File(['pincode,officename\n560001,Office'], 'pins.csv', { type: 'text/csv' }));

    await expect(client.request('/reference-data/admin/imports', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'stage-1' }, body: form,
    })).resolves.toEqual({ id: 'import-1' });

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Idempotency-Key')).toBe('stage-1');
    expect(headers.has('Content-Type')).toBe(false);
    expect(fetchMock.mock.calls[0][1]?.body).toBe(form);
  });

  it('shares concurrent GETs and caches opted-in lookups within their provider scope', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'customer-a' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'customer-b' }] }), { status: 200 }));
    const client = new ApiClient('http://127.0.0.1:3000/api/v1');
    const context = { providerId: 'provider-a', cacheTtlMs: 60_000 };

    const [first, concurrent] = await Promise.all([
      client.request('/customer-relationships?page[limit]=100', {}, context),
      client.request('/customer-relationships?page[limit]=100', {}, context),
    ]);
    expect(first).toBe(concurrent);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await client.request('/customer-relationships?page[limit]=100', {}, context)).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const otherProvider = await client.request('/customer-relationships?page[limit]=100', {}, { ...context, providerId: 'provider-b' });
    expect(otherProvider).not.toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('invalidates cached GETs after a successful write and provider context change', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'old' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'saved' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'new' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: 'new-context' }), { status: 200 }));
    const client = new ApiClient('http://127.0.0.1:3000/api/v1');
    const context = { providerId: 'provider-a', cacheTtlMs: 60_000 };

    await client.request('/lookup', {}, context);
    await client.request('/records', { method: 'POST', body: JSON.stringify({ name: 'Record' }) }, { providerId: 'provider-a' });
    expect(await client.request('/lookup', {}, context)).toEqual({ data: 'new' });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    client.changeContext();
    expect(await client.request('/lookup', {}, context)).toEqual({ data: 'new-context' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('rejects a response that crosses a provider-context change', async () => {
    let resolveResponse!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise((resolve) => { resolveResponse = resolve; }));
    const client = new ApiClient('http://127.0.0.1:3000/api/v1');
    const pending = client.request('/private');
    client.changeContext();
    resolveResponse(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await expect(pending).rejects.toMatchObject({ code: 'context_changed' });
  });
});

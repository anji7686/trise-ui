import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from './index';

describe('API authentication boundary', () => {
  afterEach(() => vi.restoreAllMocks());

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

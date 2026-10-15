import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClient } from '@trise/api-client';
import { AuthProvider, useAuth } from './index';

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function localSignIn(client: ApiClient) {
  let signIn: ReturnType<typeof useAuth>['signInForDevelopment'] | undefined;
  function Probe() { signIn = useAuth().signInForDevelopment; return null; }
  renderToStaticMarkup(createElement(AuthProvider, { client, children: createElement(Probe) }));
  if (!signIn) throw new Error('Missing local sign-in callback');
  return signIn;
}

describe('development credential transport', () => {
  it('requires both development mode and explicit client opt-in before sending a credential', async () => {
    vi.stubEnv('VITE_DEVELOPMENT_SIGN_IN', 'false');
    const client = new ApiClient();
    const request = vi.spyOn(client, 'request');
    await expect(localSignIn(client)('test@example.test', 'private-local-secret')).rejects.toThrow('unavailable');
    vi.stubEnv('VITE_DEVELOPMENT_SIGN_IN', 'true');
    vi.stubEnv('DEV', false);
    await expect(localSignIn(client)('test@example.test', 'private-local-secret')).rejects.toThrow('unavailable');
    expect(request).not.toHaveBeenCalled();
  });

  it('uses the real session endpoint and installs only the returned access token', async () => {
    vi.stubEnv('DEV', true); vi.stubEnv('VITE_DEVELOPMENT_SIGN_IN', 'true');
    const client = new ApiClient();
    const request = vi.spyOn(client, 'request').mockResolvedValue({ access_token: 'server-token', user: { id: 'existing-user', attributes: { revision: 1 } } });
    const setToken = vi.spyOn(client, 'setAccessToken');
    const clear = vi.spyOn(client, 'clearSession');
    await localSignIn(client)('test@example.test', 'private-local-secret');
    expect(request).toHaveBeenCalledWith('/session/development', { method: 'POST', body: JSON.stringify({ email: 'test@example.test', secret: 'private-local-secret', client_type: 'web' }) });
    expect(clear).toHaveBeenCalledOnce();
    expect(setToken).toHaveBeenCalledWith('server-token');
  });

  it('clears stale authentication and never installs a token after server rejection', async () => {
    vi.stubEnv('DEV', true); vi.stubEnv('VITE_DEVELOPMENT_SIGN_IN', 'true');
    const client = new ApiClient();
    vi.spyOn(client, 'request').mockRejectedValue({ status: 401 });
    const clear = vi.spyOn(client, 'clearSession');
    const setToken = vi.spyOn(client, 'setAccessToken');
    await expect(localSignIn(client)('test@example.test', 'wrong-secret')).rejects.toEqual({ status: 401 });
    expect(clear).toHaveBeenCalledTimes(2);
    expect(setToken).not.toHaveBeenCalled();
  });
});

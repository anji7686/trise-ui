import { describe, expect, it } from 'vitest';
import { authFailureMessage, sessionFromApiUser } from './index';

describe('authentication diagnostics', () => {
  it('distinguishes API availability, expired credentials, and context changes', () => {
    expect(authFailureMessage(new TypeError('fetch failed'))).toContain('local API is unavailable');
    expect(authFailureMessage({ status: 401 }, 'sign-in')).toContain('rejected');
    expect(authFailureMessage({ status: 409, code: 'context_changed' })).toContain('context changed');
  });

  it('maps the canonical top-level User response returned by /me', () => {
    expect(sessionFromApiUser({ id: 'user-1', attributes: { display_name: 'Demo User', locale: 'hi-IN', revision: 7 } })).toEqual({
      userId: 'user-1', displayName: 'Demo User', locale: 'hi-IN', revision: 7, providerCapabilities: []
    });
  });

  it('maps server-derived provider capabilities without inferring roles', () => {
    expect(sessionFromApiUser({ id: 'user-2', attributes: { display_name: 'Operator', revision: 3, provider_capabilities: [{ provider_id: 'provider-1', display_name: 'Provider One', capabilities: ['requests', 'workforce'] }] } })).toMatchObject({
      providerCapabilities: [{ providerId: 'provider-1', displayName: 'Provider One', capabilities: ['requests', 'workforce'] }]
    });
  });
});

import { describe, expect, it } from 'vitest';
import { setupActionPath } from './provider-overrides-admin';

describe('provider setup blocker navigation', () => {
  const providerId = 'provider-123';

  it('opens Team & Access for the provider administrator blocker and preserves the setup return path', () => {
    const path = setupActionPath(
      { code: 'PROVIDER_ADMIN', label: 'Assign or invite an active Provider Admin' },
      providerId,
    );

    expect(path).toContain('platform/providers/provider-123?tab=access');
    expect(path).toContain('return_to=platform%2Fconfiguration%2Fprovider-overrides%3Fprovider_id%3Dprovider-123');
  });

  it('routes subscription, verification, and operation blockers to their matching provider sections', () => {
    expect(setupActionPath({ code: 'SUBSCRIPTION', label: 'Activate a TRISe subscription' }, providerId))
      .toContain('platform/providers/provider-123?tab=subscription');
    expect(setupActionPath({ code: 'PROVIDER_BUSINESS_VERIFICATION', label: 'Business verification' }, providerId))
      .toContain('platform/providers/provider-123?tab=business');
    expect(setupActionPath({ code: 'PRIMARY_BUSINESS_OPERATION', label: 'Select primary operation' }, providerId))
      .toContain('platform/providers/provider-123?tab=operations');
  });
});

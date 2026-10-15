import { describe, expect, it } from 'vitest';
import { normalizePlatformProviderUser } from './platform-provider-users';

describe('normalizePlatformProviderUser', () => {
  it('normalizes omitted optional collections from partial API responses', () => {
    const normalized = normalizePlatformProviderUser({
      id: 'membership-1',
      type: 'platform-provider-users',
      relationships: {},
      attributes: {
        roles: undefined,
        business_operations: undefined,
        provider_access: [{ membership_id: 'membership-1', roles: undefined }],
        activity: undefined
      } as never
    });

    expect(normalized.attributes.roles).toEqual([]);
    expect(normalized.attributes.business_operations).toEqual([]);
    expect(normalized.attributes.provider_access?.[0].roles).toEqual([]);
    expect(normalized.attributes.activity).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { navigationForSession, providerRouteAllowed } from './navigation';

const context = (capabilities: string[]) => ({ providerId: 'provider-1', displayName: 'Provider One', capabilities });

describe('Operations capability navigation', () => {
  it('keeps platform navigation separate from provider capabilities', () => {
    const navigation = navigationForSession({ platformAdmin: true, platformCapabilities: ['PLATFORM_PLAN_READ', 'PLATFORM_SUBSCRIPTION_READ', 'PLATFORM_SUBSCRIPTION_USAGE_READ'], providerCapabilities: [context(['requests'])] }, 'provider-1');
    expect(navigation.platform.map((item) => item.key)).toEqual(['platform-overview', 'platform-providers', 'platform-plans', 'platform-subscriptions', 'platform-subscription-requests', 'platform-subscription-usage', 'platform-subscription-billing']);
    expect(navigation.provider.map((item) => item.key)).toEqual(['overview', 'requests']);
  });

  it.each([
    ['provider admin', ['customers', 'onboarding', 'configuration', 'business_profile', 'requests', 'bookings', 'jobs', 'workforce', 'audit'], ['overview', 'requests', 'bookings', 'jobs', 'customers', 'onboarding', 'configuration', 'business-profile', 'workforce', 'audit']],
    ['operations', ['requests', 'workforce', 'audit'], ['overview', 'requests', 'workforce', 'audit']],
    ['dispatcher', ['bookings', 'jobs'], ['bookings', 'jobs']],
    ['agent', ['my_work'], ['my-work']]
  ])('%s receives only capabilities returned for the selected context', (_name, capabilities, expectedKeys) => {
    const navigation = navigationForSession({ platformAdmin: false, providerCapabilities: [context(capabilities)] }, 'provider-1');
    expect(navigation.provider.map((item) => item.key)).toEqual(expectedKeys);
    expect(navigation.provider.some((item) => item.key === 'quotations')).toBe(false);
  });

  it('does not show provider or platform navigation without server capabilities', () => {
    const navigation = navigationForSession({ platformAdmin: false, providerCapabilities: [] }, 'provider-1');
    expect(navigation.platform).toEqual([]);
    expect(navigation.provider).toEqual([]);
  });

  it('keeps business profile restricted to the returned provider capability', () => {
    expect(navigationForSession({ platformAdmin: false, providerCapabilities: [context(['requests'])] }, 'provider-1').provider.some((item) => item.key === 'business-profile')).toBe(false);
    expect(navigationForSession({ platformAdmin: false, providerCapabilities: [context(['business_profile'])] }, 'provider-1').provider.map((item) => item.key)).toEqual(['business-profile']);
  });

  it('guards deep links against the selected provider context', () => {
    const session = { platformAdmin: false, providerCapabilities: [context(['requests']), { providerId: 'provider-2', displayName: 'Provider Two', capabilities: ['jobs'] }] };
    expect(providerRouteAllowed(session, 'provider-1', 'requests')).toBe(true);
    expect(providerRouteAllowed(session, 'provider-1', 'jobs')).toBe(false);
    expect(providerRouteAllowed(session, 'provider-2', 'jobs')).toBe(true);
    expect(providerRouteAllowed(session, 'provider-2', 'requests')).toBe(false);
    expect(providerRouteAllowed(session, 'provider-1', 'workforce')).toBe(false);
  });
});

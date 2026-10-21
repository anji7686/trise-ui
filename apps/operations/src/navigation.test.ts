import { describe, expect, it } from 'vitest';
import { groupedProviderNavigation, navigationForSession, platformNavigation, providerRouteAllowed } from './navigation';

const context = (capabilities: string[]) => ({ providerId: 'provider-1', displayName: 'Provider One', capabilities });

describe('Operations capability navigation', () => {
  it('keeps platform navigation separate from provider capabilities', () => {
    const navigation = navigationForSession({ platformAdmin: true, platformCapabilities: ['PLATFORM_PLAN_READ', 'PLATFORM_SUBSCRIPTION_READ', 'PLATFORM_SUBSCRIPTION_USAGE_READ'], providerCapabilities: [context(['requests'])] }, 'provider-1');
    expect(navigation.platform.map((item) => item.key)).toEqual(['platform-plans', 'platform-subscriptions', 'platform-subscription-requests', 'platform-subscription-usage', 'platform-subscription-billing']);
    expect(navigation.provider.map((item) => item.key)).toEqual(['overview', 'requests']);
  });

  it.each([
    ['provider admin', ['customers', 'onboarding', 'configuration', 'business_profile', 'subscriptions', 'requests', 'bookings', 'jobs', 'workforce', 'audit', 'team_access', 'compliance', 'sales_marketing', 'quotations', 'projects', 'amc', 'reports'], ['overview', 'leads', 'requests', 'quotations', 'projects', 'bookings', 'jobs', 'customers', 'onboarding', 'amc', 'workforce', 'reports', 'configuration', 'business-profile', 'compliance', 'subscriptions', 'audit', 'team-access']],
    ['operations', ['requests', 'workforce', 'audit', 'reports'], ['overview', 'requests', 'workforce', 'reports', 'audit']],
    ['dispatcher', ['bookings', 'jobs'], ['overview', 'bookings', 'jobs']],
    ['agent', ['my_work'], ['overview', 'my-work']]
  ])('%s receives only capabilities returned for the selected context', (_name, capabilities, expectedKeys) => {
    const navigation = navigationForSession({ platformAdmin: false, providerCapabilities: [context(capabilities)] }, 'provider-1');
    expect(navigation.provider.map((item) => item.key)).toEqual(expectedKeys);
    expect(navigation.provider.some((item) => item.key === 'quotations')).toBe(_name === 'provider admin');
  });

  it('does not show provider or platform navigation without server capabilities', () => {
    const navigation = navigationForSession({ platformAdmin: false, providerCapabilities: [] }, 'provider-1');
    expect(navigation.platform).toEqual([]);
    expect(navigation.provider).toEqual([]);
  });

  it('shows operations support menus without Platform Team or protected governance', () => {
    const navigation = navigationForSession({ platformAdmin: true, platformCapabilities: ['PLATFORM_PROVIDER_READ', 'PLATFORM_SUBSCRIPTION_READ'], providerCapabilities: [] });
    expect(navigation.platform.map(item => item.key)).toContain('platform-provider-users');
    expect(navigation.platform.map(item => item.key)).not.toContain('platform-team');
    expect(navigation.platform.map(item => item.key)).not.toContain('platform-roles');
    expect(navigationForSession({ platformAdmin: true, platformCapabilities: [], providerCapabilities: [] }).platform).toEqual([]);
  });


  it('renders the complete platform menu when the server grants the full Global Administrator capability set', () => {
    const allPlatformCapabilities = platformNavigation.flatMap((item) => item.capability ? [item.capability] : []);
    const navigation = navigationForSession({ platformAdmin: true, platformCapabilities: allPlatformCapabilities, providerCapabilities: [] });
    expect(navigation.platform.map((item) => item.key)).toEqual(platformNavigation.map((item) => item.key));
  });

  it('keeps business profile restricted to the returned provider capability', () => {
    expect(navigationForSession({ platformAdmin: false, providerCapabilities: [context(['requests'])] }, 'provider-1').provider.some((item) => item.key === 'business-profile')).toBe(false);
    expect(navigationForSession({ platformAdmin: false, providerCapabilities: [context(['business_profile'])] }, 'provider-1').provider.map((item) => item.key)).toEqual(['overview', 'business-profile']);
  });

  it('allows the leads route from the sales marketing capability', () => {
    const session = { platformAdmin: false, providerCapabilities: [context(['sales_marketing'])] };
    expect(providerRouteAllowed(session, 'provider-1', 'leads')).toBe(true);
  });

  it('exposes unified Work Intake only when the selected provider returns its read capability', () => {
    const session = { platformAdmin: false, providerCapabilities: [context(['work_intake'])] };
    expect(navigationForSession(session, 'provider-1').provider.map((item) => item.key)).toContain('work-intake');
    expect(providerRouteAllowed(session, 'provider-1', 'work-intake')).toBe(true);
    expect(providerRouteAllowed({ ...session, providerCapabilities: [context([])] }, 'provider-1', 'work-intake')).toBe(false);
  });

  it.each([
    ['amc', 'amc'],
    ['reports', 'reports'],
    ['team-access', 'team_access'],
    ['business-profile', 'business_profile']
  ])('uses the navigation capability for the %s route', (section, capability) => {
    const session = { platformAdmin: false, providerCapabilities: [context([capability])] };
    expect(providerRouteAllowed(session, 'provider-1', section)).toBe(true);
  });

  it('keeps legacy route hashes while presenting Provider Workspace terminology', () => {
    const capabilities = ['sales_marketing', 'requests', 'quotations', 'projects', 'bookings', 'jobs', 'my_work', 'customers', 'onboarding', 'amc', 'workforce', 'reports'];
    const navigation = navigationForSession({ platformAdmin: false, providerCapabilities: [context(capabilities)] }, 'provider-1');
    expect(navigation.provider.find((item) => item.key === 'leads')?.hash).toBe('leads');
    expect(navigation.provider.find((item) => item.key === 'my-work')?.hash).toBe('jobs/my-work');
    expect(navigation.provider.find((item) => item.key === 'projects')?.label).toBe('Projects & Delivery');
    expect(navigation.provider.find((item) => item.key === 'amc')?.hash).toBe('amc');
  });

  it('orders only implemented destinations into the Provider Workspace groups', () => {
    const capabilities = ['sales_marketing', 'requests', 'quotations', 'projects', 'bookings', 'jobs', 'my_work', 'customers', 'onboarding', 'amc', 'workforce', 'reports'];
    const navigation = navigationForSession({ platformAdmin: false, providerCapabilities: [context(capabilities)] }, 'provider-1');
    const groups = groupedProviderNavigation(navigation.provider);
    expect(groups.map(({ group }) => group)).toEqual(['Overview', 'Work Intake', 'Sales & Quotations', 'Projects & Delivery', 'Field Operations', 'Assets & Sites', 'Service Programs', 'Workforce', 'Insights']);
    expect(groups.flatMap(({ items }) => items).some(({ key }) => ['materials', 'quality', 'finance'].includes(key))).toBe(false);
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

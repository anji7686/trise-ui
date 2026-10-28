import { describe, expect, it } from 'vitest';
import { groupedProviderNavigation, navigationForSession, platformNavigation, postLoginRoute, providerRouteAllowed } from './navigation';

const context = (capabilities: string[]) => ({ providerId: 'provider-1', displayName: 'Provider One', capabilities });

describe('Operations capability navigation', () => {
  it('lands each newly signed-in account in its own workspace', () => {
    expect(postLoginRoute({ platformAdmin: true, providerCapabilities: [] })).toBe('platform/overview');
    expect(postLoginRoute({ platformAdmin: false, providerCapabilities: [context(['quotations'])] }, 'provider-1')).toBe('overview');
    expect(postLoginRoute({ platformAdmin: false, providerCapabilities: [context(['my_work'])] }, 'provider-1')).toBe('overview');
    expect(postLoginRoute({ platformAdmin: false, providerCapabilities: [{ ...context(['my_work']), roleContext: 'AGENT' }] }, 'provider-1')).toBe('jobs/my-work');
  });

  it('keeps platform navigation separate from provider capabilities', () => {
    const navigation = navigationForSession({ platformAdmin: true, platformCapabilities: ['PLATFORM_PLAN_READ', 'PLATFORM_SUBSCRIPTION_READ', 'PLATFORM_SUBSCRIPTION_USAGE_READ'], providerCapabilities: [context(['requests'])] }, 'provider-1');
    expect(navigation.platform.map((item) => item.key)).toEqual(['platform-notifications', 'platform-plans', 'platform-subscriptions', 'platform-subscription-requests', 'platform-subscription-usage', 'platform-subscription-billing']);
    expect(navigation.provider.map((item) => item.key)).toEqual(['overview', 'requests']);
  });

  it.each([
    ['provider admin', ['customers', 'onboarding', 'configuration', 'business_profile', 'subscriptions', 'requests', 'bookings', 'jobs', 'my_work', 'workforce', 'attendance', 'my_leave', 'audit', 'team_access', 'compliance', 'sales_marketing', 'quotations', 'billing', 'projects', 'amc', 'reports', 'quotation_terms_admin', 'notifications'], ['overview', 'leads', 'requests', 'quotations', 'billing', 'projects', 'bookings', 'jobs', 'my-work', 'customers', 'sites', 'assets', 'onboarding', 'amc', 'workforce', 'attendance', 'my-leave', 'compliance', 'audit', 'reports', 'configuration', 'quotation-terms-templates', 'business-profile', 'team-access', 'notifications']],
    ['marketing executive', ['sales_marketing'], ['overview', 'leads']],
    ['operations', ['requests', 'workforce', 'audit', 'reports'], ['overview', 'requests', 'workforce', 'audit', 'reports']],
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
    expect(navigation.platform.map(item => item.key)).toEqual(['platform-overview', 'platform-businesses', 'platform-providers', 'platform-notifications', 'platform-provider-users', 'platform-subscriptions', 'platform-subscription-requests', 'platform-subscription-billing']);
    expect(navigation.platform.map(item => item.key)).not.toContain('platform-team');
    expect(navigation.platform.map(item => item.key)).not.toContain('platform-roles');
    expect(navigationForSession({ platformAdmin: true, platformCapabilities: [], providerCapabilities: [] }).platform.map(item => item.key)).toEqual(['platform-notifications']);
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

  it('labels quotation terms administration as Quotation Terms', () => {
    const item = navigationForSession({ platformAdmin: false, providerCapabilities: [context(['quotation_terms_admin'])] }, 'provider-1').provider.find((entry) => entry.key === 'quotation-terms-templates');
    expect(item?.label).toBe('Quotation Terms');
    expect(item?.hash).toBe('configuration/quotation-terms-templates');
  });

  it('allows the leads route from the sales marketing capability', () => {
    const session = { platformAdmin: false, providerCapabilities: [context(['sales_marketing'])] };
    expect(providerRouteAllowed(session, 'provider-1', 'leads')).toBe(true);
  });

  it('shows provider notifications only when the selected context grants notifications', () => {
    const allowed = { platformAdmin: false, providerCapabilities: [context(['notifications'])] };
    const denied = { platformAdmin: false, providerCapabilities: [context(['requests'])] };
    expect(navigationForSession(allowed, 'provider-1').provider.map((item) => item.key)).toContain('notifications');
    expect(providerRouteAllowed(allowed, 'provider-1', 'notifications')).toBe(true);
    expect(navigationForSession(denied, 'provider-1').provider.map((item) => item.key)).not.toContain('notifications');
    expect(providerRouteAllowed(denied, 'provider-1', 'notifications')).toBe(false);
  });

  it('exposes customer, site and asset workspaces from the same server capability', () => {
    const session = { platformAdmin: false, providerCapabilities: [context(['customers'])] };
    expect(navigationForSession(session, 'provider-1').provider.map((item) => item.key)).toEqual(['overview', 'customers', 'sites', 'assets']);
    expect(providerRouteAllowed(session, 'provider-1', 'customers')).toBe(true);
    expect(providerRouteAllowed(session, 'provider-1', 'sites')).toBe(true);
    expect(providerRouteAllowed(session, 'provider-1', 'assets')).toBe(true);
    expect(providerRouteAllowed({ ...session, providerCapabilities: [context([])] }, 'provider-1', 'assets')).toBe(false);
  });

  it('keeps quotation terms administration on its dedicated provider capability', () => {
    const session = { platformAdmin: false, providerCapabilities: [context(['quotation_terms_admin'])] };
    expect(navigationForSession(session, 'provider-1').provider.map((item) => item.key)).toContain('quotation-terms-templates');
    expect(providerRouteAllowed(session, 'provider-1', 'configuration', undefined, 'quotation-terms-templates')).toBe(true);
    expect(providerRouteAllowed({ ...session, providerCapabilities: [context([])] }, 'provider-1', 'configuration', undefined, 'quotation-terms-templates')).toBe(false);
  });

  it('allows typed provider configuration deep links through Provider Configuration', () => {
    const session = { platformAdmin: false, providerCapabilities: [context(['configuration'])] };
    expect(providerRouteAllowed(session, 'provider-1', 'configuration', undefined, 'maintenance-policies')).toBe(true);
    expect(providerRouteAllowed(session, 'provider-1', 'configuration', undefined, 'sla-policies')).toBe(true);
    expect(providerRouteAllowed(session, 'provider-1', 'configuration', undefined, 'unsupported-kind')).toBe(false);
    expect(providerRouteAllowed({ ...session, providerCapabilities: [context([])] }, 'provider-1', 'configuration', undefined, 'maintenance-policies')).toBe(false);
  });

  it('keeps AMC plan catalogue on its dedicated provider capability', () => {
    const session = { platformAdmin: false, providerCapabilities: [context(['amc_plans'])] };
    expect(navigationForSession(session, 'provider-1').provider.map((item) => item.key)).toEqual(['overview', 'amc-plans']);
    expect(providerRouteAllowed(session, 'provider-1', 'amc', 'plans')).toBe(true);
    expect(providerRouteAllowed({ ...session, providerCapabilities: [context(['amc'])] }, 'provider-1', 'amc', 'plans')).toBe(false);
  });

  it('shows the AMC catalogue to a reviewer with read/review/publish permissions', () => {
    const session = { platformAdmin: false, providerCapabilities: [context(['amc_plans', 'amc_plan_review', 'amc_plan_publish'])] };
    expect(navigationForSession(session, 'provider-1').provider.map((item) => item.key)).toEqual(['overview', 'amc-plans']);
    expect(providerRouteAllowed(session, 'provider-1', 'amc', 'plans')).toBe(true);
  });

  it('shows a read-only reviewer the complete provider journey without mutation-only menus', () => {
    const capabilities = ['work_intake', 'sales_marketing', 'requests', 'quotations', 'projects', 'bookings', 'jobs', 'amc', 'amc_plans', 'compliance', 'audit', 'reports'];
    const session = { platformAdmin: false, providerCapabilities: [context(capabilities)] };
    const keys = navigationForSession(session, 'provider-1').provider.map((item) => item.key);
    expect(keys).toEqual(['overview', 'work-intake', 'leads', 'requests', 'quotations', 'projects', 'bookings', 'jobs', 'amc', 'amc-plans', 'compliance', 'audit', 'reports']);
    expect(providerRouteAllowed(session, 'provider-1', 'work-intake')).toBe(true);
    expect(providerRouteAllowed(session, 'provider-1', 'leads')).toBe(true);
    expect(providerRouteAllowed(session, 'provider-1', 'jobs')).toBe(true);
    expect(providerRouteAllowed(session, 'provider-1', 'amc')).toBe(true);
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
    expect(navigation.provider.find((item) => item.key === 'projects')?.label).toBe('Projects & Installation');
    expect(navigation.provider.find((item) => item.key === 'amc')?.hash).toBe('amc');
  });

  it('orders only implemented destinations into the Provider Workspace groups', () => {
    const capabilities = ['sales_marketing', 'requests', 'quotations', 'projects', 'bookings', 'jobs', 'my_work', 'customers', 'onboarding', 'amc', 'workforce', 'reports'];
    const navigation = navigationForSession({ platformAdmin: false, providerCapabilities: [context(capabilities)] }, 'provider-1');
    const groups = groupedProviderNavigation(navigation.provider);
    expect(groups.map(({ group }) => group)).toEqual(['Overview', 'Intake', 'Commercial', 'Delivery', 'Customers & Assets', 'Service', 'Workforce', 'Insights']);
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

  it('allows every visible provider menu item to open its own deep link', () => {
    const capabilities = ['customers', 'onboarding', 'configuration', 'business_profile', 'subscriptions', 'requests', 'bookings', 'jobs', 'my_work', 'workforce', 'attendance', 'my_leave', 'audit', 'team_access', 'compliance', 'sales_marketing', 'quotations', 'billing', 'projects', 'amc', 'reports', 'quotation_terms_admin', 'notifications'];
    const session = { platformAdmin: false, providerCapabilities: [context(capabilities)] };
    const navigation = navigationForSession(session, 'provider-1');
    for (const item of navigation.provider) {
      const parts = item.hash.split('/');
      expect(providerRouteAllowed(session, 'provider-1', parts[0], parts[2], parts[1]), item.hash).toBe(true);
    }
  });

  it('does not let the parent Jobs capability authorize the My Work deep link', () => {
    const session = { platformAdmin: false, providerCapabilities: [context(['jobs'])] };
    expect(providerRouteAllowed(session, 'provider-1', 'jobs', 'my-work')).toBe(false);
    expect(providerRouteAllowed({ ...session, providerCapabilities: [context(['jobs', 'my_work'])] }, 'provider-1', 'jobs', 'my-work')).toBe(true);
  });

  it('allows CompOff self-service only to workforce users with attendance or work capabilities', () => {
    expect(providerRouteAllowed({ providerCapabilities: [context(['extra_day_credits'])] }, 'provider-1', 'configuration', undefined, 'extra-day-credits')).toBe(true);
    expect(providerRouteAllowed({ providerCapabilities: [context(['customers'])] }, 'provider-1', 'configuration', undefined, 'extra-day-credits')).toBe(false);
  });

  it('exposes the workforce setup routes only with their server-projected capabilities', () => {
    expect(providerRouteAllowed({ providerCapabilities: [context(['support_coverage'])] }, 'provider-1', 'configuration', undefined, 'support-coverage')).toBe(true);
    expect(providerRouteAllowed({ providerCapabilities: [context(['job_assign'])] }, 'provider-1', 'configuration', undefined, 'support-coverage')).toBe(false);
    expect(providerRouteAllowed({ providerCapabilities: [context(['extra_day_credits'])] }, 'provider-1', 'configuration', undefined, 'extra-day-credits')).toBe(true);
  });
});

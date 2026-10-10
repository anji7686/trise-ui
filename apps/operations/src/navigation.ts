import type { ProviderCapabilityContext, Session } from '@trise/auth';

export type OperationsNavigationItem = { key: string; label: string; hash: string; capability?: string };

export const platformNavigation: OperationsNavigationItem[] = [
  { key: 'platform-overview', label: 'Platform Overview', hash: 'platform/overview' },
  { key: 'platform-providers', label: 'Providers', hash: 'platform/providers' },
  { key: 'platform-plans', label: 'Plans', hash: 'platform/plans', capability: 'PLATFORM_PLAN_READ' },
  { key: 'platform-subscriptions', label: 'Providers', hash: 'platform/subscriptions', capability: 'PLATFORM_SUBSCRIPTION_READ' },
  { key: 'platform-subscription-requests', label: 'Requests', hash: 'platform/subscription-requests', capability: 'PLATFORM_SUBSCRIPTION_READ' },
  { key: 'platform-subscription-usage', label: 'Usage', hash: 'platform/subscription-usage', capability: 'PLATFORM_SUBSCRIPTION_USAGE_READ' },
  { key: 'platform-subscription-billing', label: 'Billing', hash: 'platform/subscription-billing', capability: 'PLATFORM_SUBSCRIPTION_READ' }
];

const providerItems: OperationsNavigationItem[] = [
  { key: 'overview', label: 'Overview', hash: 'overview', capability: 'requests' },
  { key: 'requests', label: 'Requests', hash: 'requests', capability: 'requests' },
  { key: 'bookings', label: 'Bookings', hash: 'bookings', capability: 'bookings' },
  { key: 'jobs', label: 'Jobs', hash: 'jobs', capability: 'jobs' },
  { key: 'customers', label: 'Customers', hash: 'customers', capability: 'customers' },
  { key: 'onboarding', label: 'Onboarding', hash: 'onboarding', capability: 'onboarding' },
  { key: 'configuration', label: 'Configuration', hash: 'configuration', capability: 'configuration' },
  { key: 'business-profile', label: 'Business profile', hash: 'business-profile', capability: 'business_profile' },
  { key: 'subscriptions', label: 'Subscription', hash: 'subscriptions', capability: 'subscriptions' },
  { key: 'my-work', label: 'My Work', hash: 'jobs/my-work', capability: 'my_work' },
  { key: 'workforce', label: 'Workforce', hash: 'workforce', capability: 'workforce' },
  { key: 'audit', label: 'Audit history', hash: 'audit', capability: 'audit' }
];

export function providerContextFor(session: Pick<Session, 'providerCapabilities'>, providerId?: string): ProviderCapabilityContext | undefined {
  if (!providerId) return undefined;
  return session.providerCapabilities.find((context) => context.providerId === providerId);
}

export function navigationForSession(session: Pick<Session, 'platformAdmin' | 'platformCapabilities' | 'providerCapabilities'>, providerId?: string) {
  const context = providerContextFor(session, providerId);
  const capabilities = new Set(context?.capabilities || []);
  return {
    platform: session.platformAdmin ? platformNavigation.filter((item) => !item.capability || session.platformCapabilities?.includes(item.capability)) : [],
    provider: providerItems.filter((item) => item.capability && capabilities.has(item.capability)),
    context
  };
}

export function requiredProviderCapability(section: string): string | undefined {
  return providerItems.find((item) => item.hash === section || (section === 'overview' && item.key === 'overview'))?.capability;
}

export function providerRouteAllowed(session: Pick<Session, 'providerCapabilities'>, providerId: string, section: string, routeId?: string): boolean {
  const navigation = navigationForSession(session, providerId);
  const capability = section === 'jobs' && routeId === 'my-work' ? 'my_work' : section === 'overview' ? 'requests' : section;
  return navigation.provider.some((item) => item.capability === capability && (item.hash === section || (section === 'jobs' && routeId === 'my-work' && item.hash === 'jobs/my-work')));
}

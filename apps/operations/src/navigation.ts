import type { ProviderCapabilityContext, Session } from '@trise/auth';

export type ProviderNavigationGroup = 'Overview' | 'Operations' | 'Customers & Assets' | 'Service Programs' | 'Workforce' | 'Commercial' | 'Insights' | 'Administration';
export type OperationsNavigationItem = { key: string; label: string; hash: string; capability?: string; group?: ProviderNavigationGroup };

export const platformNavigation: OperationsNavigationItem[] = [
  { key: 'platform-overview', label: 'Platform Overview', hash: 'platform/overview', capability: 'PLATFORM_PROVIDER_READ' },
  { key: 'platform-businesses', label: 'Businesses', hash: 'platform/businesses', capability: 'PLATFORM_PROVIDER_READ' },
  { key: 'platform-providers', label: 'Service Providers', hash: 'platform/providers', capability: 'PLATFORM_PROVIDER_READ' },
  { key: 'platform-compliance', label: 'Compliance Review', hash: 'platform/compliance', capability: 'PLATFORM_COMPLIANCE_READ' },
  { key: 'platform-provider-users', label: 'Provider Users', hash: 'platform/provider-users', capability: 'PLATFORM_PROVIDER_READ' },
  { key: 'platform-plans', label: 'Plans & Pricing', hash: 'platform/plans', capability: 'PLATFORM_PLAN_READ' },
  { key: 'platform-subscriptions', label: 'Provider Subscriptions', hash: 'platform/subscriptions', capability: 'PLATFORM_SUBSCRIPTION_READ' },
  { key: 'platform-subscription-requests', label: 'Requests & Approvals', hash: 'platform/subscription-requests', capability: 'PLATFORM_SUBSCRIPTION_READ' },
  { key: 'platform-subscription-usage', label: 'Usage & Limits', hash: 'platform/subscription-usage', capability: 'PLATFORM_SUBSCRIPTION_USAGE_READ' },
  { key: 'platform-subscription-billing', label: 'Billing & Payments', hash: 'platform/subscription-billing', capability: 'PLATFORM_SUBSCRIPTION_READ' },
  { key: 'platform-taxes', label: 'Tax Management', hash: 'platform/taxes', capability: 'PLATFORM_TAX_READ' },
  { key: 'platform-team', label: 'Platform Team', hash: 'platform/team', capability: 'PLATFORM_TEAM_READ' },
  { key: 'platform-roles', label: 'Roles & Permissions', hash: 'platform/roles', capability: 'PLATFORM_ACCESS_READ' }
];

const providerItems: OperationsNavigationItem[] = [
  { key: 'overview', label: 'Overview', hash: 'overview', capability: 'requests', group: 'Overview' },
  { key: 'leads', label: 'Leads & Surveys', hash: 'leads', capability: 'sales_marketing', group: 'Commercial' },
  { key: 'quotations', label: 'Quotations', hash: 'quotations', capability: 'quotations', group: 'Commercial' },
  { key: 'projects', label: 'Installation Projects', hash: 'projects', capability: 'projects', group: 'Operations' },
  { key: 'requests', label: 'Service Requests', hash: 'requests', capability: 'requests', group: 'Operations' },
  { key: 'bookings', label: 'Bookings & Appointments', hash: 'bookings', capability: 'bookings', group: 'Operations' },
  { key: 'jobs', label: 'Jobs', hash: 'jobs', capability: 'jobs', group: 'Operations' },
  { key: 'my-work', label: 'My Work', hash: 'jobs/my-work', capability: 'my_work', group: 'Operations' },
  { key: 'customers', label: 'Customers & Assets', hash: 'customers', capability: 'customers', group: 'Customers & Assets' },
  { key: 'onboarding', label: 'Onboarding', hash: 'onboarding', capability: 'onboarding', group: 'Customers & Assets' },
  { key: 'configuration', label: 'Configuration', hash: 'configuration', capability: 'configuration', group: 'Administration' },
  { key: 'business-profile', label: 'Business profile', hash: 'business-profile', capability: 'business_profile', group: 'Administration' },
  { key: 'compliance', label: 'Compliance', hash: 'compliance', capability: 'compliance', group: 'Administration' },
  { key: 'subscriptions', label: 'Subscription', hash: 'subscriptions', capability: 'subscriptions', group: 'Commercial' },
  { key: 'workforce', label: 'Workforce', hash: 'workforce', capability: 'workforce', group: 'Workforce' },
  { key: 'audit', label: 'Audit history', hash: 'audit', capability: 'audit', group: 'Administration' },
  { key: 'team-access', label: 'Team & Access', hash: 'team-access', capability: 'team_access', group: 'Administration' }
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

export const providerNavigationGroups: ProviderNavigationGroup[] = ['Overview', 'Operations', 'Customers & Assets', 'Service Programs', 'Workforce', 'Commercial', 'Insights', 'Administration'];

export function groupedProviderNavigation(items: OperationsNavigationItem[]) {
  return providerNavigationGroups.map((group) => ({ group, items: items.filter((item) => item.group === group) })).filter((entry) => entry.items.length > 0);
}

export function requiredProviderCapability(section: string): string | undefined {
  return providerItems.find((item) => item.hash === section || (section === 'overview' && item.key === 'overview'))?.capability;
}

export function providerRouteAllowed(session: Pick<Session, 'providerCapabilities'>, providerId: string, section: string, routeId?: string): boolean {
  const navigation = navigationForSession(session, providerId);
  const capability = section === 'jobs' && routeId === 'my-work' ? 'my_work' : section === 'overview' ? 'requests' : section === 'team-access' ? 'team_access' : section === 'leads' ? 'sales_marketing' : section;
  return navigation.provider.some((item) => item.capability === capability && (item.hash === section || (section === 'jobs' && routeId === 'my-work' && item.hash === 'jobs/my-work')));
}

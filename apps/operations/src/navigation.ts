import type { ProviderCapabilityContext, Session } from '@trise/auth';

export type ProviderNavigationGroup = 'Overview' | 'Work Intake' | 'Sales & Quotations' | 'Projects & Delivery' | 'Field Operations' | 'Assets & Sites' | 'Service Programs' | 'Workforce' | 'Insights' | 'Provider Settings';
export type OperationsNavigationItem = { key: string; label: string; hash: string; capability?: string; group?: ProviderNavigationGroup };

export const platformNavigation: OperationsNavigationItem[] = [
  { key: 'platform-overview', label: 'Platform Overview', hash: 'platform/overview', capability: 'PLATFORM_PROVIDER_READ' },
  { key: 'platform-businesses', label: 'Businesses', hash: 'platform/businesses', capability: 'PLATFORM_PROVIDER_READ' },
  { key: 'platform-providers', label: 'Service Providers', hash: 'platform/providers', capability: 'PLATFORM_PROVIDER_READ' },
  { key: 'platform-configuration-platform', label: 'Platform configuration', hash: 'platform/configuration', capability: 'PLATFORM_CONFIGURATION_READ' },
  { key: 'platform-configuration-elevator', label: 'Elevator & Lift', hash: 'platform/configuration/elevator', capability: 'PLATFORM_CONFIGURATION_READ' },
  { key: 'platform-configuration-provider-overrides', label: 'Provider overrides', hash: 'platform/configuration/provider-overrides', capability: 'PLATFORM_CONFIGURATION_READ' },
  { key: 'platform-business-operations', label: 'Business Operations Catalogue', hash: 'platform/business-operations', capability: 'PLATFORM_CONFIGURATION_READ' },
  { key: 'platform-configuration-reviews', label: 'Approvals', hash: 'platform/configuration/reviews', capability: 'PLATFORM_CONFIGURATION_READ' },
  { key: 'platform-configuration-audit', label: 'Audit log', hash: 'platform/configuration/audit', capability: 'PLATFORM_CONFIGURATION_READ' },
  { key: 'platform-reference-data', label: 'Reference data', hash: 'platform/configuration/reference-data', capability: 'PLATFORM_CONFIGURATION_READ' },
  { key: 'platform-compliance', label: 'Compliance Review', hash: 'platform/compliance', capability: 'PLATFORM_COMPLIANCE_READ' },
  { key: 'platform-provider-users', label: 'Provider Users', hash: 'platform/provider-users', capability: 'PLATFORM_PROVIDER_READ' },
  { key: 'platform-maintenance', label: 'Maintenance control', hash: 'platform/maintenance', capability: 'PLATFORM_MAINTENANCE_READ' },
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
  { key: 'overview', label: 'Overview', hash: 'overview', group: 'Overview' },
  { key: 'work-intake', label: 'Work Intake', hash: 'work-intake', capability: 'work_intake', group: 'Work Intake' },
  { key: 'leads', label: 'Marketing Leads & Surveys', hash: 'leads', capability: 'sales_marketing', group: 'Work Intake' },
  { key: 'requests', label: 'Service Requests', hash: 'requests', capability: 'requests', group: 'Work Intake' },
  { key: 'quotations', label: 'Sales & Quotations', hash: 'quotations', capability: 'quotations', group: 'Sales & Quotations' },
  { key: 'projects', label: 'Projects & Delivery', hash: 'projects', capability: 'projects', group: 'Projects & Delivery' },
  { key: 'bookings', label: 'Appointments & Dispatch', hash: 'bookings', capability: 'bookings', group: 'Field Operations' },
  { key: 'jobs', label: 'Jobs & Execution', hash: 'jobs', capability: 'jobs', group: 'Field Operations' },
  { key: 'my-work', label: 'My Work', hash: 'jobs/my-work', capability: 'my_work', group: 'Field Operations' },
  { key: 'customers', label: 'Customers, Sites & Assets', hash: 'customers', capability: 'customers', group: 'Assets & Sites' },
  { key: 'onboarding', label: 'Site Onboarding', hash: 'onboarding', capability: 'onboarding', group: 'Assets & Sites' },
  { key: 'amc', label: 'AMC & Service Programs', hash: 'amc', capability: 'amc', group: 'Service Programs' },
  { key: 'workforce', label: 'Workforce', hash: 'workforce', capability: 'workforce', group: 'Workforce' },
  { key: 'reports', label: 'Reports & Analytics', hash: 'reports', capability: 'reports', group: 'Insights' },
  { key: 'configuration', label: 'Configuration', hash: 'configuration', capability: 'configuration', group: 'Provider Settings' },
  { key: 'business-profile', label: 'Business profile', hash: 'business-profile', capability: 'business_profile', group: 'Provider Settings' },
  { key: 'compliance', label: 'Provider compliance', hash: 'compliance', capability: 'compliance', group: 'Provider Settings' },
  { key: 'subscriptions', label: 'Subscription', hash: 'subscriptions', capability: 'subscriptions', group: 'Provider Settings' },
  { key: 'audit', label: 'Provider audit logs', hash: 'audit', capability: 'audit', group: 'Provider Settings' },
  { key: 'team-access', label: 'Team & roles', hash: 'team-access', capability: 'team_access', group: 'Provider Settings' }
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
    provider: context ? providerItems.filter((item) => !item.capability || capabilities.has(item.capability)) : [],
    context
  };
}

export const providerNavigationGroups: ProviderNavigationGroup[] = ['Overview', 'Work Intake', 'Sales & Quotations', 'Projects & Delivery', 'Field Operations', 'Assets & Sites', 'Service Programs', 'Workforce', 'Insights', 'Provider Settings'];

export function groupedProviderNavigation(items: OperationsNavigationItem[]) {
  return providerNavigationGroups.map((group) => ({ group, items: items.filter((item) => item.group === group) })).filter((entry) => entry.items.length > 0);
}

export function requiredProviderCapability(section: string): string | undefined {
  return providerItems.find((item) => item.hash === section || (section === 'overview' && item.key === 'overview'))?.capability;
}

export function providerRouteAllowed(session: Pick<Session, 'providerCapabilities'>, providerId: string, section: string, routeId?: string): boolean {
  const navigation = navigationForSession(session, providerId);
  const capability = section === 'jobs' && routeId === 'my-work' ? 'my_work' : requiredProviderCapability(section) || section;
  return navigation.provider.some((item) => (!item.capability || item.capability === capability) && (item.hash === section || (section === 'jobs' && routeId === 'my-work' && item.hash === 'jobs/my-work')));
}

import type { ProviderCapabilityContext, Session } from '@trise/auth';

export type ProviderNavigationGroup = 'Overview' | 'Intake' | 'Commercial' | 'Delivery' | 'Customers & Assets' | 'Service' | 'Workforce' | 'Governance' | 'Administration' | 'Insights';
export type OperationsNavigationItem = { key: string; label: string; hash: string; capability?: string; group?: ProviderNavigationGroup };

export const platformNavigation: OperationsNavigationItem[] = [
  { key: 'platform-overview', label: 'Platform Overview', hash: 'platform/overview', capability: 'PLATFORM_PROVIDER_READ' },
  { key: 'platform-businesses', label: 'Businesses', hash: 'platform/businesses', capability: 'PLATFORM_PROVIDER_READ' },
  { key: 'platform-providers', label: 'Service Providers', hash: 'platform/providers', capability: 'PLATFORM_PROVIDER_READ' },
  { key: 'platform-configuration-platform', label: 'Platform configuration', hash: 'platform/configuration', capability: 'PLATFORM_CONFIGURATION_READ' },
  { key: 'platform-configuration-provider-overrides', label: 'Provider overrides', hash: 'platform/configuration/provider-overrides', capability: 'PLATFORM_CONFIGURATION_READ' },
  { key: 'platform-business-operations', label: 'Business Operations Catalogue', hash: 'platform/business-operations', capability: 'PLATFORM_CONFIGURATION_READ' },
  { key: 'platform-configuration-reviews', label: 'Approvals', hash: 'platform/configuration/reviews', capability: 'PLATFORM_CONFIGURATION_READ' },
  { key: 'platform-configuration-audit', label: 'Audit log', hash: 'platform/configuration/audit', capability: 'PLATFORM_CONFIGURATION_READ' },
  { key: 'platform-reference-data', label: 'Reference data', hash: 'platform/configuration/reference-data', capability: 'PLATFORM_CONFIGURATION_READ' },
  // Platform notification access is authorized by the platform-admin session
  // boundary in the API; there is no separate platform notification
  // capability in the current contract.
  { key: 'platform-notifications', label: 'Notifications', hash: 'platform/notifications' },
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
  { key: 'work-intake', label: 'Work Intake', hash: 'work-intake', capability: 'work_intake', group: 'Intake' },
  { key: 'leads', label: 'Leads & Surveys', hash: 'leads', capability: 'sales_marketing', group: 'Intake' },
  { key: 'requests', label: 'Service Requests', hash: 'requests', capability: 'requests', group: 'Intake' },
  { key: 'quotations', label: 'Quotations', hash: 'quotations', capability: 'quotations', group: 'Commercial' },
  { key: 'billing', label: 'Payment & Billing', hash: 'billing', capability: 'billing', group: 'Commercial' },
  { key: 'projects', label: 'Projects & Installation', hash: 'projects', capability: 'projects', group: 'Delivery' },
  { key: 'bookings', label: 'Appointments & Dispatch', hash: 'bookings', capability: 'bookings', group: 'Delivery' },
  { key: 'jobs', label: 'Jobs & Execution', hash: 'jobs', capability: 'jobs', group: 'Delivery' },
  { key: 'my-work', label: 'My Work', hash: 'jobs/my-work', capability: 'my_work', group: 'Delivery' },
  { key: 'customers', label: 'Customers', hash: 'customers', capability: 'customers', group: 'Customers & Assets' },
  { key: 'sites', label: 'Sites & Locations', hash: 'sites', capability: 'customers', group: 'Customers & Assets' },
  { key: 'assets', label: 'Assets', hash: 'assets', capability: 'customers', group: 'Customers & Assets' },
  { key: 'onboarding', label: 'Site Onboarding', hash: 'onboarding', capability: 'onboarding', group: 'Customers & Assets' },
  { key: 'amc', label: 'AMC & Service Programs', hash: 'amc', capability: 'amc', group: 'Service' },
  { key: 'amc-plans', label: 'AMC Plan Catalogue', hash: 'amc/plans', capability: 'amc_plans', group: 'Service' },
  { key: 'workforce', label: 'Directory', hash: 'workforce', capability: 'workforce', group: 'Workforce' },
  { key: 'attendance', label: 'My Attendance', hash: 'attendance', capability: 'attendance', group: 'Workforce' },
  { key: 'my-leave', label: 'My Leave', hash: 'my-leave', capability: 'my_leave', group: 'Workforce' },
  { key: 'support-coverage', label: 'Support Coverage', hash: 'configuration/support-coverage', capability: 'support_coverage', group: 'Workforce' },
  { key: 'extra-day-credits', label: 'CompOff Ledger', hash: 'configuration/extra-day-credits', capability: 'extra_day_credits', group: 'Workforce' },
  { key: 'compliance', label: 'Provider Compliance', hash: 'compliance', capability: 'compliance', group: 'Governance' },
  { key: 'audit', label: 'Audit History', hash: 'audit', capability: 'audit', group: 'Governance' },
  { key: 'reports', label: 'Reports & Analytics', hash: 'reports', capability: 'reports', group: 'Insights' },
  { key: 'configuration', label: 'Provider Configuration', hash: 'configuration', capability: 'configuration', group: 'Administration' },
  { key: 'quotation-terms-templates', label: 'Quotation Terms', hash: 'configuration/quotation-terms-templates', capability: 'quotation_terms_admin', group: 'Administration' },
  { key: 'business-profile', label: 'Business Profile', hash: 'business-profile', capability: 'business_profile', group: 'Administration' },
  { key: 'team-access', label: 'Team & Roles', hash: 'team-access', capability: 'team_access', group: 'Administration' },
  { key: 'notifications', label: 'Notification inbox', hash: 'notifications', capability: 'notifications', group: 'Administration' }
];

// Typed configuration records are opened as deep links under the single
// Provider Configuration menu item. Keep this allowlist explicit so an
// arbitrary configuration hash cannot bypass the navigation capability gate.
const providerConfigurationKinds = new Set([
  'asset-families', 'asset-types', 'asset-definitions', 'service-types',
  'checklist-templates', 'notification-triggers', 'notification-policies',
  'notification-templates', 'skills', 'certification-types',
  'working-calendars', 'holiday-calendars', 'service-territories',
  'assignment-policies', 'asset-criticalities', 'service-priorities',
  'emergency-rules', 'sla-policies', 'identifier-policies',
  'maintenance-policies', 'support-coverage', 'extra-day-credits'
]);

export function providerContextFor(session: Pick<Session, 'providerCapabilities'>, providerId?: string): ProviderCapabilityContext | undefined {
  if (!providerId) return undefined;
  return session.providerCapabilities.find((context) => context.providerId === providerId);
}

/**
 * Return the safe landing route after an explicit sign-in. A previous hash is
 * deliberately not reused here because it belongs to the account/workspace
 * that was signed out. Ordinary page refreshes still preserve deep links.
 */
export function postLoginRoute(session: Pick<Session, 'platformAdmin' | 'providerCapabilities'>, providerId?: string): string {
  if (session.platformAdmin) return 'platform/overview';
  const context = providerContextFor(session, providerId);
  if (context?.roleContext?.toUpperCase() === 'AGENT' && context.capabilities.includes('my_work')) return 'jobs/my-work';
  return 'overview';
}

export function navigationForSession(session: Pick<Session, 'providerCapabilities'> & Partial<Pick<Session, 'platformAdmin' | 'platformCapabilities'>>, providerId?: string) {
  const context = providerContextFor(session, providerId);
  const capabilities = new Set(context?.capabilities || []);
  return {
    platform: session.platformAdmin ? uniqueNavigationItems(platformNavigation.filter((item) => !item.capability || capabilitiesMatch(session.platformCapabilities, item.capability))) : [],
    provider: context ? uniqueNavigationItems(providerItems.filter((item) => !item.capability || capabilities.has(item.capability))) : [],
    context
  };
}

function capabilitiesMatch(capabilities: string[] | undefined, capability: string) {
  return new Set(capabilities || []).has(capability);
}

/**
 * Navigation is a projection of server capabilities, but a duplicated API
 * capability or legacy menu record must never render duplicate destinations.
 * Keep the first canonical item for each key/hash pair so existing ordering
 * remains stable while the UI stays deterministic.
 */
function uniqueNavigationItems(items: OperationsNavigationItem[]) {
  const seenKeys = new Set<string>();
  const seenHashes = new Set<string>();
  return items.filter((item) => {
    if (seenKeys.has(item.key) || seenHashes.has(item.hash)) return false;
    seenKeys.add(item.key);
    seenHashes.add(item.hash);
    return true;
  });
}

export const providerNavigationGroups: ProviderNavigationGroup[] = ['Overview', 'Intake', 'Commercial', 'Delivery', 'Customers & Assets', 'Service', 'Workforce', 'Governance', 'Administration', 'Insights'];

export function groupedProviderNavigation(items: OperationsNavigationItem[]) {
  return providerNavigationGroups.map((group) => ({ group, items: items.filter((item) => item.group === group) })).filter((entry) => entry.items.length > 0);
}

export function requiredProviderCapability(section: string): string | undefined {
  return providerItems.find((item) => item.hash === section || (section === 'overview' && item.key === 'overview'))?.capability;
}

export function providerRouteAllowed(session: Pick<Session, 'providerCapabilities'>, providerId: string, section: string, routeId?: string, routeKind?: string): boolean {
  const navigation = navigationForSession(session, providerId);
  const context = providerContextFor(session, providerId);
  if (section === 'configuration' && routeKind === 'support-coverage') return Boolean(context?.capabilities.includes('support_coverage'));
  if (section === 'configuration' && routeKind === 'extra-day-credits') return Boolean(context?.capabilities.includes('extra_day_credits'));
  if (section === 'configuration' && routeKind && providerConfigurationKinds.has(routeKind)) {
    return navigation.provider.some((item) => item.hash === 'configuration');
  }
  const nestedHash = section === 'amc' && routeId === 'plans' ? 'amc/plans' : routeKind ? `${section}/${routeKind}` : undefined;
  const matchingItem = section === 'jobs' && routeId === 'my-work'
    ? navigation.provider.find((item) => item.hash === 'jobs/my-work')
    : nestedHash
      ? navigation.provider.find((item) => item.hash === nestedHash)
      : navigation.provider.find((item) => item.hash === section);
  const capability = section === 'jobs' && routeId === 'my-work' ? 'my_work' : matchingItem?.capability || requiredProviderCapability(section) || section;
  return Boolean(matchingItem && (!matchingItem.capability || matchingItem.capability === capability));
}

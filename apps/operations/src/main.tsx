import { ProviderAccessPage } from './provider-access';
import { lazy, StrictMode, Suspense, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, GoogleSignInButton, SESSION_STARTED_EVENT, useAuth } from '@trise/auth';
import { apiClient } from '@trise/api-client';
import { translate, type Locale } from '@trise/i18n';
import { Button, TriseBrandHeader } from '@trise/ui';
import { OperationsPriority as Priority, OperationsStatus as Status } from './operations-status';
import '@trise/tokens/theme.css';
import './styles.css';
import './brand-background.css';
import './workflow.css';
import '../../../packages/ui-primitives/src/primitives.css';
import './account-menu.css';
import { operationsData, type AgentAttributes, type AssignmentAttributes, type BookingAttributes, type CapacityPoolAttributes, type Collection, type GenericAttributes, type JobAttributes, type PlatformAvailability, type ProviderAttributes, type ProviderOperationsDashboard, type PublicPlatformMaintenance, type RequestAttributes, type Resource } from './data';
import { ExecutionPanel } from './execution';
import type { OperationsRoute } from './operations-pages';
import { PropertyOnboarding } from './onboarding';
import { ProviderBusinessProfilePage } from './provider-business-profile';
import { ProviderAdministrationPage } from './provider-administration';
import { BUSINESS_TIME_ZONE, formatIndiaDate, formatIndiaDateTime, formatIndiaTime } from './subscription-support';
import { MyProviderAdminInvitations } from './provider-admin-invitations';
import { MyTeamInvitations } from './provider-members';
const JobsImpl = lazy(() => import('./jobs').then((module) => ({ default: module.Jobs })));
const OperationsPagesImpl = lazy(() => import('./operations-pages').then((module) => ({ default: module.OperationsPages })));
const CustomerOperationsImpl = lazy(() => import('./customer-operations').then((module) => ({ default: module.CustomerOperations })));
function Jobs(props: { providerId: string; t: T; route?: { id?: string }; myWorkAllowed?: boolean; executionAllowed?: boolean; assignmentAllowed?: boolean }) { const { session } = useAuth(); const context = session?.providerCapabilities.find((entry) => entry.providerId === props.providerId); return <Suspense fallback={<DataState message={props.t('loading')} t={props.t} />}><JobsImpl {...props} executionAllowed={context?.capabilities.includes('service_job_execute') === true} assignmentAllowed={context?.capabilities.includes('job_assign') === true} /></Suspense>; }
function OperationsPages(props: { section: OperationsRoute['section']; providerId: string; route: OperationsRoute; t: T }) { return <Suspense fallback={<DataState message={props.t('loading')} t={props.t} />}><OperationsPagesImpl {...props} /></Suspense>; }
function CustomerOperations(props: { providerId: string; canManage?: boolean }) { return <Suspense fallback={<section className="notice"><p>Loading customer operations…</p></section>}><CustomerOperationsImpl {...props} /></Suspense>; }
const PlatformRouteImpl = lazy(() => import('./platform-admin').then((module) => ({ default: module.PlatformRoute })));
function PlatformRoute(props: { session: { userId?: string; platformAdmin?: boolean; platformCapabilities?: string[] }; providerId?: string; providerName?: string }) {
  return <Suspense fallback={<section className="notice"><p>Loading Platform Administration…</p></section>}><PlatformRouteImpl {...props} /></Suspense>;
}
import { groupedProviderNavigation, navigationForSession, postLoginRoute, providerRouteAllowed, requiredProviderCapability } from './navigation';
import { SvgIcon } from './icons';
import { WorkflowModelIcon, type WorkflowModelIconName } from './workflow-model-icons';
import './operations-design.css';
import { IdentityDomainVerificationPage } from './identity-domain-verification';
import { dashboardRoleFor } from './dashboard-model';
import { NotificationBell, NotificationHistoryPage } from './notifications';
import { PlatformNotificationHistoryPage } from './platform-notifications';
import { WorkflowFollowUpDesk, WorkflowFollowUpsForResource } from './workflow-follow-ups';

type Theme = 'system' | 'light' | 'dark';
const storedThemePreference = localStorage.getItem('trise-theme');
const initialThemePreference: Theme = storedThemePreference === 'light' || storedThemePreference === 'dark' || storedThemePreference === 'system' ? storedThemePreference : 'system';
const initialResolvedTheme = initialThemePreference === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : initialThemePreference;
document.documentElement.dataset.theme = initialResolvedTheme;
type Section = 'administration' | 'team-access' | 'team-invitations' | 'overview' | 'work-intake' | 'leads' | 'requests' | 'bookings' | 'jobs' | 'customers' | 'sites' | 'assets' | 'quotations' | 'billing' | 'projects' | 'amc' | 'reports' | 'configuration' | 'workforce' | 'attendance' | 'my-leave' | 'audit' | 'notifications' | 'onboarding' | 'business-profile' | 'compliance' | 'subscriptions' | 'platform' | 'admin-invitations';
function go(section: Section | string) { window.location.hash = section; }
function providerPreferenceKey(userId: string) { return `trise-operations-provider:${userId}`; }
function readProviderPreference(userId: string) { return localStorage.getItem(providerPreferenceKey(userId)) || ''; }
function writeProviderPreference(userId: string, providerId: string) {
  if (providerId) localStorage.setItem(providerPreferenceKey(userId), providerId);
  else localStorage.removeItem(providerPreferenceKey(userId));
}
function parseRoute(): OperationsRoute { const hash = window.location.hash.slice(1); const [path] = hash.split('?'); const parts = path.split('/').filter(Boolean); const rawSection = (parts[0] || 'overview') as Section; const legacySubscriptionRoute = rawSection === 'subscriptions'; const section = (legacySubscriptionRoute ? 'business-profile' : rawSection) as Section; return { section: section as OperationsRoute['section'], id: legacySubscriptionRoute ? 'subscription' : section === 'configuration' ? parts[2] : section === 'platform' ? parts[2] : parts[1], kind: section === 'configuration' ? parts[1] : section === 'platform' ? parts[1] : undefined, templateId: section === 'quotations' && parts[1] === 'new' ? parts[2] : undefined }; }
function errorText(error: unknown) { return (error as { message?: string })?.message || 'The API request could not be completed.'; }
function hasProviderOperationsAccess(session: { platformAdmin?: boolean; providerCapabilities: Array<{ roleContext?: string; operationsAccess?: boolean }> } | null) {
  return Boolean(session?.platformAdmin || session?.providerCapabilities.some((context) => context.operationsAccess !== false && context.roleContext?.toUpperCase() !== 'CUSTOMER'));
}
async function loadAuthorizedProviders() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operationsData.providers();
    } catch (cause) {
      if ((cause as { code?: string }).code !== 'context_changed' || attempt === 2) throw cause;
      await new Promise((resolve) => window.setTimeout(resolve, 40));
    }
  }
  throw new Error('Provider list could not be loaded.');
}
function PlatformMaintenanceBanner({ maintenance, operations = [] }: { maintenance: PublicPlatformMaintenance | null; operations?: PlatformAvailability['operations'] }) {
  if (!maintenance) return null;
  const fallbackDefinitions: Array<[string, string, boolean]> = [
    ['AUTHENTICATION', 'Login and session access', true], ['READ_OPERATIONS', 'View existing operations and records', true],
    ['SERVICE_OPERATIONS', 'Existing service operations', maintenance.mode !== 'FULL_PLATFORM'], ['NEW_ACTIVITY_INTAKE', 'New requests, bookings and jobs', !['FULL_PLATFORM', 'NEW_ACTIVITY_INTAKE'].includes(maintenance.mode)],
    ['PLATFORM_ADMINISTRATION', 'Platform administration and configuration', !['FULL_PLATFORM', 'PLATFORM_ADMINISTRATION'].includes(maintenance.mode)], ['MAINTENANCE_RECOVERY', 'Global Administrator maintenance recovery', true]
  ];
  const fallbackOperations: PlatformAvailability['operations'] = fallbackDefinitions.map(([code, name, available]) => ({ code, name, scope: code, status: available ? 'AVAILABLE' : 'MAINTENANCE', available, message: available ? 'Available' : maintenance.message }));
  const displayedOperations = (operations.length ? operations : fallbackOperations).filter((operation) => !['PLATFORM_ADMINISTRATION', 'MAINTENANCE_RECOVERY'].includes(operation.code));
  return <aside className="platform-maintenance-banner" role="alert" aria-live="polite"><div className="platform-maintenance-banner-mark" aria-hidden="true">!</div><div className="platform-maintenance-banner-content"><div className="platform-maintenance-banner-heading"><div><span className="platform-maintenance-banner-eyebrow">SERVICE NOTICE</span><strong>Platform maintenance is currently active</strong></div><span className="platform-maintenance-banner-chip">Temporarily paused</span></div><p>{maintenance.message}</p><dl><div><dt>Maintenance type</dt><dd>{maintenance.label}</dd></div><div><dt>Started</dt><dd>{formatIndiaDateTime(maintenance.starts_at || '')}</dd></div><div><dt>Expected completion</dt><dd>{maintenance.scheduled_end_at ? formatIndiaDateTime(maintenance.scheduled_end_at) : 'Not scheduled'}</dd></div></dl><MaintenanceCountdown endsAt={maintenance.scheduled_end_at} /><div className="platform-maintenance-recommendation"><strong>Recommended: wait until maintenance ends</strong><span>Please avoid creating, updating, submitting or completing operational work during this window. Some technical access may remain available, but activity can be delayed or interrupted.</span></div><div className="platform-maintenance-operations"><strong>Technical availability only</strong><div>{displayedOperations.map((operation) => <span className={operation.available ? 'is-available' : 'is-blocked'} key={operation.code}><i aria-hidden="true" />{operation.name}</span>)}</div></div><small>{maintenance.retry_guidance}</small></div></aside>;
}
function MaintenanceCountdown({ endsAt }: { endsAt?: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!endsAt) return undefined; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [endsAt]);
  if (!endsAt) return <p className="platform-maintenance-countdown">Countdown unavailable: no expected completion time is configured. The Global Administrator must set it in Maintenance Control.</p>;
  const remaining = new Date(endsAt).getTime() - now;
  if (remaining <= 0) return <p className="platform-maintenance-countdown is-overdue">Expected completion time has passed. The platform remains paused until the Global Administrator confirms recovery.</p>;
  const totalSeconds = Math.floor(remaining / 1000); const days = Math.floor(totalSeconds / 86400); const hours = Math.floor((totalSeconds % 86400) / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60;
  return <p className="platform-maintenance-countdown"><span className="platform-maintenance-countdown-label">Time remaining</span><strong>{days > 0 ? `${days}d ` : ''}{String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</strong></p>;
}
function PlatformMaintenanceLockScreen({ maintenance, operations, canRecover, onOpenMaintenance, onSignOut }: { maintenance: PublicPlatformMaintenance; operations: PlatformAvailability['operations']; canRecover: boolean; onOpenMaintenance: () => void; onSignOut: () => void }) {
  return <main className="workspace platform-maintenance-lock"><header className="topbar"><Wordmark /><Button onClick={onSignOut}>Sign out</Button></header><PlatformMaintenanceBanner maintenance={maintenance} operations={operations} />{canRecover && <section className="platform-maintenance-recovery-card"><Status>Global Administrator access</Status><h1>Maintenance recovery</h1><p>The maintenance window is active. Review the configured window and restore normal activity when the work is complete.</p><Button onClick={onOpenMaintenance}>Open Maintenance Control</Button></section>}</main>;
}
function LoginScreen({ maintenance, operations, authError }: { maintenance: PublicPlatformMaintenance | null; operations: PlatformAvailability['operations']; authError: string | null }) {
  return <main className="login-screen">
    <div className="login-topbar">
      <div className="login-topbar-brand"><span className="login-topbar-logo-badge"><TriseBrandHeader variant="dark" /></span><span>Operations</span></div>
      <div className="login-topbar-context"><span className="login-live-dot" aria-hidden="true" />TRISE India Operations</div>
    </div>
    {maintenance && <div className="login-maintenance-wrap"><PlatformMaintenanceBanner maintenance={maintenance} operations={operations} /></div>}
    <div className="login-layout">
      <section className="login-brand-panel" aria-label="TRISE Operations overview">
        <TriseBrandHeader variant="dark" />
        <Status>Secure operations workspace</Status>
        <h1>Keep every operation, service team and provider moving.</h1>
        <p className="login-brand-lede">A single operations workspace for authorized teams managing service delivery and provider operations across India.</p>
        <div className="login-capability-list">
          <div><span aria-hidden="true">✓</span><div><strong>Provider operations</strong><small>Requests, jobs, customers and assets in one place.</small></div></div>
          <div><span aria-hidden="true">✓</span><div><strong>India-ready workflows</strong><small>Designed for local teams, records and service operations.</small></div></div>
        </div>
        <div className="login-brand-footer"><span className="login-secure-icon" aria-hidden="true">⌁</span><span>Authorized access only · Activity is audited</span></div>
      </section>
      <section className="login-auth-panel" aria-labelledby="login-title">
        <div className="login-auth-intro"><div className="login-auth-icon" aria-hidden="true">↗</div><div><p className="login-eyebrow">Welcome back</p><h2 id="login-title">Sign in to Operations</h2><p>Use your authorized account to continue to the workspace.</p></div></div>
        {authError && <div className="login-error" role="alert"><strong>Sign-in needs attention</strong><span>{authError}</span></div>}
        <div className="login-signin-options"><GoogleSignInButton /></div>
        <p className="login-auth-note">Google sign-in is the standard access method. Local development access is shown only when this environment enables it.</p>
        <div className="login-trust-row"><span>India operations</span><span>Secure session</span><span>Audited access</span></div>
      </section>
    </div>
    <footer className="login-footer-bar"><span>TRISE India</span><span>Business operations</span><span>Asia/Kolkata</span></footer>
  </main>;
}
function routeHeading(section: Section, route: OperationsRoute): [string, string] {
  if (section === 'jobs' && route.id === 'my-work') return ['My work', 'Work assigned to the current authorized actor.'];
  const headings: Record<string, [string, string]> = {
    overview: ['Overview', 'A focused view of authorized work in this provider workspace.'],
    'work-intake': ['Work Intake', 'Coordinate marketing, provider-direct, referral, asset, AMC, internal and partner work without duplicating canonical records.'],
    leads: ['Work Intake · Marketing Leads & Surveys', 'Review marketing-originated prospects, surveys and elevator requirements. Other intake sources are not yet unified here.'],
    quotations: ['Sales & Quotations', 'Prepare, review, issue and manage provider customer quotations.'],
    billing: ['Payment & Billing', 'Review provider payment stages and recorded payment evidence.'],
    projects: ['Projects & Delivery', 'Coordinate project stages, linked jobs, materials, payments, quality and handover.'],
    amc: ['AMC & Service Programs', 'Review provider-scoped maintenance contracts, asset coverage and due work.'],
    reports: ['Reports & Analytics', 'Review reports permitted by the selected provider access.'],
    jobs: ['Field Operations · Jobs & Assignments', 'Manage authorized service execution, assignments and field evidence.'],
    requests: ['Work Intake · Service Requests', 'Manage provider-scoped repair, inspection and service requests.'],
    bookings: ['Field Operations · Appointments & Dispatch', 'Coordinate authorized service appointments and dispatch.'],
    customers: ['Customers, Sites & Assets', 'Manage provider-scoped customer relationships, service locations and assets.'],
    onboarding: ['Assets & Sites · Site Onboarding', 'Create a community and its elevator assets through supported staged operations.'],
    administration: ['Administration', 'Manage provider configuration, profile, compliance and team access.'],
    'business-profile': ['Business profile', 'Maintain provider details and submit the current revision for platform review.'],
    workforce: ['Workforce management', 'Manage authorized provider workforce, teams and assignments.'],
    attendance: ['My attendance', 'Record today’s provider attendance in Asia/Kolkata time.'],
    'my-leave': ['My leave', 'Request and review leave for your provider workforce profile.'],
    audit: ['Audit history', 'Review provider-scoped operational history.'],
    notifications: ['Notifications', 'Review provider notifications returned for the current authorized context.'],
  };
  return headings[section] || ['Operations workspace', 'Manage authorized provider operations.'];
}
function ProviderCapabilityUnavailable({ feature }: { feature: string }) { return <section className="notice state-forbidden" role="alert"><strong>{feature} is not available in this session.</strong><p>The API does not provide a server capability for this feature to the Operations client, so it is hidden until an authorized capability is supplied.</p></section>; }
function OperationsAccessUnavailable({ onSignOut }: { onSignOut: () => void }) {
  return <main className="workspace operations-access-unavailable"><header className="topbar"><Wordmark /><Button onClick={onSignOut}>Sign out</Button></header><section className="operations-access-card" role="alert"><Status>Customer access</Status><h1>This workspace is for authorized provider teams.</h1><p>Your account can be associated with service providers as a customer, but it does not have a provider Operations membership. Customer activity must use the customer portal, so provider jobs, records and configuration are not exposed here.</p><Button variant="secondary" onClick={onSignOut}>Return to sign in</Button></section></main>;
}
const navIcons: Record<string, Parameters<typeof SvgIcon>[0]['name']> = {
  'platform-overview': 'grid', 'platform-businesses': 'building', 'platform-providers': 'building',
  'platform-configuration-platform': 'settings',
  'platform-configuration-provider-overrides': 'shield', 'platform-business-operations': 'clipboard',
  'platform-configuration-reviews': 'clipboard', 'platform-configuration-audit': 'activity',
  'platform-reference-data': 'map-pin', 'platform-notifications': 'bell', 'platform-provider-users': 'users', 'platform-plans': 'grid',
  'platform-subscriptions': 'clipboard', 'platform-subscription-requests': 'activity',
  'platform-subscription-usage': 'filter', 'platform-subscription-billing': 'calendar',
  'platform-compliance': 'shield', 'platform-taxes': 'calendar', 'platform-team': 'users',
  'platform-roles': 'settings', overview: 'activity', 'work-intake': 'clipboard', leads: 'users',
  requests: 'clipboard', quotations: 'clipboard', billing: 'calendar', bookings: 'calendar',
  jobs: 'clipboard', customers: 'users', sites: 'map-pin', assets: 'building', projects: 'building',
  amc: 'calendar', 'amc-plans': 'grid', reports: 'activity', onboarding: 'map-pin', configuration: 'settings',
  'business-profile': 'building', compliance: 'shield', 'my-work': 'activity', workforce: 'users',
  attendance: 'calendar', 'my-leave': 'calendar', audit: 'activity', subscriptions: 'clipboard',
  'quotation-terms-templates': 'clipboard', 'team-access': 'users', notifications: 'bell'
};
const workflowNavIcons: Record<string, WorkflowModelIconName> = {
  'work-intake': 'WORK_INTAKE',
  leads: 'LEAD_SURVEY',
  quotations: 'SALES_QUOTATION',
  projects: 'PROJECT_INSTALLATION',
  amc: 'AMC_SERVICE',
};
navIcons['platform-maintenance'] = 'activity';
function Navigation({ session, section, route, providerId, mobileOpen, onNavigate }: { session: NonNullable<ReturnType<typeof useAuth>['session']>; section: Section; route: OperationsRoute; providerId: string; mobileOpen: boolean; onNavigate: () => void }) {
  const navigation = navigationForSession(session, providerId);
  const [expandedProviderGroups, setExpandedProviderGroups] = useState<Record<string, boolean>>({});
  const active = (item: { key: string; hash: string }) => {
    if (item.key === 'my-work') return section === 'jobs' && route.id === 'my-work';
    if (item.key === 'amc-plans') return section === 'amc' && route.id === 'plans';
    if (item.key === 'jobs') return section === 'jobs' && route.id !== 'my-work';
    if (item.key === 'configuration') return section === 'configuration' && route.kind !== 'quotation-terms-templates';
    if (item.key === 'quotation-terms-templates') return section === 'configuration' && route.kind === 'quotation-terms-templates';
    return section === item.hash || (section === 'configuration' && item.hash === `configuration/${route.kind}`);
  };
  const platformActive = (item: { key: string; hash?: string }) => {
    if (section !== 'platform') return false;
    const path = window.location.hash.slice(1).split('?')[0];
    if (item.key === 'platform-configuration-platform') return path === 'platform/configuration';
    if (item.key === 'platform-configuration-provider-overrides' || item.key === 'platform-maintenance') return path === item.hash;
    if (item.key === 'platform-business-operations') return path === item.hash || path === 'platform/configuration/elevator';
    if (item.hash && ['platform/configuration/reviews', 'platform/configuration/audit', 'platform/configuration/reference-data'].includes(item.hash)) return path === item.hash;
    return route.kind === item.key.replace('platform-', '');
  };
  const itemButton = (item: { key: string; label: string; hash: string }, isActive: boolean) => {
    const workflowIcon = workflowNavIcons[item.key];
    return <button key={item.key} data-nav-key={item.key} title={item.label} className={isActive ? 'active' : ''} aria-current={isActive ? 'page' : undefined} onClick={() => { go(item.hash); onNavigate(); }}><span className={`nav-icon${workflowIcon ? ' nav-icon--workflow' : ''}`} aria-hidden="true">{workflowIcon ? <WorkflowModelIcon name={workflowIcon} size={20} /> : <SvgIcon name={navIcons[item.key] || 'grid'} size={20} />}</span><span>{item.label}</span></button>;
  };
  const commercialItems = navigation.platform.filter((item) => item.key === 'platform-plans' || item.key.startsWith('platform-subscription') || item.key === 'platform-taxes');
  const configurationItems = navigation.platform.filter((item) => ['platform-configuration-platform', 'platform-configuration-provider-overrides'].includes(item.key));
  const catalogueItems = navigation.platform.filter((item) => item.key === 'platform-business-operations' || item.key === 'platform-reference-data');
  const governanceItems = navigation.platform.filter((item) => ['platform-configuration-reviews', 'platform-configuration-audit', 'platform-compliance', 'platform-notifications'].includes(item.key));
  const accessItems = navigation.platform.filter((item) => item.key === 'platform-roles' || item.key === 'platform-team');
  const operationsItems = navigation.platform.filter((item) => item.key === 'platform-provider-users' || item.key === 'platform-maintenance');
  const generalPlatformItems = navigation.platform.filter((item) => !commercialItems.includes(item) && !configurationItems.includes(item) && !catalogueItems.includes(item) && !governanceItems.includes(item) && !accessItems.includes(item) && !operationsItems.includes(item));
  const commercialOpen = commercialItems.some(platformActive);
  const configurationOpen = configurationItems.some(platformActive);
  const catalogueOpen = catalogueItems.some(platformActive);
  const governanceOpen = governanceItems.some(platformActive);
  const operationsOpen = operationsItems.some(platformActive);
  const accessOpen = accessItems.some(platformActive);
  const providerGroupIcon: Record<string, Parameters<typeof SvgIcon>[0]['name']> = {
    Intake: 'clipboard', Commercial: 'clipboard', Delivery: 'building', 'Customers & Assets': 'users',
    Service: 'calendar', Workforce: 'users', Governance: 'shield', Administration: 'settings', Insights: 'activity'
  };
  const platformGroup = (key: string, label: string, icon: Parameters<typeof SvgIcon>[0]['name'], items: typeof navigation.platform, isOpen: boolean) => items.length > 0 && <details className={`nav-accordion platform-nav-accordion${isOpen ? ' is-current' : ''}`} key={key} open={isOpen}><summary><span className="nav-icon" aria-hidden="true"><SvgIcon name={icon} size={20} /></span><span>{label}</span><SvgIcon name="chevron-down" size={16} /></summary><div className="nav-accordion-children">{items.map((item) => itemButton(item, platformActive(item)))}</div></details>;
  const providerGroup = (group: string, items: ReturnType<typeof groupedProviderNavigation>[number]['items']) => {
    if (group === 'Overview') return <div className="provider-nav-group" key={group}><div className="nav-group-label">Overview</div>{items.map((item) => itemButton(item, active(item)))}</div>;
    const isConfigurationRoute = section === 'configuration' && route.kind !== 'quotation-terms-templates';
    const isCurrent = (section === 'administration' && group === 'Administration') || items.some((item) => active(item));
    const defaultHash = group === 'Administration' ? 'administration' : items[0]?.hash;
    const visibleLabel = group === 'Customers & Assets' ? 'Customers & assets' : group;
    const expanded = isCurrent || expandedProviderGroups[group] === true;
    const configurationParent = items.find((item) => item.key === 'configuration');
    const configurationDirectItems = items.filter((item) => item.key !== 'configuration');
    return <section className={`nav-group-accordion${isCurrent ? ' is-current' : ''}`} key={group}>
      <div className="nav-group-toggle-row">
        <button type="button" className="nav-group-link" aria-expanded={expanded} onClick={() => { if (defaultHash) go(defaultHash); onNavigate(); }}><span className="nav-icon" aria-hidden="true"><SvgIcon name={providerGroupIcon[group] || 'grid'} size={20} /></span><span>{visibleLabel}</span></button>
        <button type="button" className="nav-group-toggle" aria-label={`${expanded ? 'Collapse' : 'Expand'} ${visibleLabel}`} aria-expanded={expanded} onClick={() => setExpandedProviderGroups((current) => ({ ...current, [group]: !expanded }))}><SvgIcon name="chevron-down" size={16} /></button>
      </div>
      {expanded && <div className="nav-accordion-children">
        {group === 'Administration' && itemButton({ key: 'administration', label: 'Overview', hash: 'administration' }, section === 'administration')}
        {group === 'Administration' && configurationParent && <>
          {itemButton(configurationParent, isConfigurationRoute)}
        </>}
        {group === 'Administration' ? configurationDirectItems.map((item) => itemButton(item, active(item))) : items.map((item) => itemButton(item, active(item)))}
      </div>}
    </section>;
  };
  return <aside id={section === 'platform' ? 'platform-navigation' : 'provider-navigation'} className={`workspace-sidebar${section === 'platform' ? ' platform-sidebar' : ' provider-sidebar'}${mobileOpen ? ' mobile-nav-open' : ''}`} aria-label={section === 'platform' ? 'Platform administration navigation' : 'Operations navigation'}>
    <div className="sidebar-brand"><Wordmark variant="dark" /><span>Elevating operations together</span></div>
    {navigation.platform.length > 0 && <><div className="nav-group-label">Platform</div>{generalPlatformItems.map((item) => itemButton(item, platformActive(item)))}{configurationItems.length > 0 && platformGroup('configuration', 'Configuration', 'settings', configurationItems, configurationOpen)}{catalogueItems.length > 0 && platformGroup('catalogue', 'Catalogue', 'clipboard', catalogueItems, catalogueOpen)}{governanceItems.length > 0 && platformGroup('governance', 'Governance & reviews', 'shield', governanceItems, governanceOpen)}{operationsItems.length > 0 && platformGroup('operations', 'Operations', 'activity', operationsItems, operationsOpen)}{accessItems.length > 0 && platformGroup('access', 'Access & governance', 'users', accessItems, accessOpen)}{commercialItems.length > 0 && platformGroup('commercial', 'Commercial', 'clipboard', commercialItems, commercialOpen)}</>}
    {section !== 'platform' && groupedProviderNavigation(navigation.provider).map(({ group, items }) => providerGroup(group, items))}
    {section !== 'platform' && !providerId && <div className="nav-help">Select an authorized provider to view its available workspaces.</div>}
  </aside>;
}

function Shell() {
  const { session, loading: authLoading, error: authError, signOut, setProvider, refreshCurrentUser } = useAuth();
  const [theme, setTheme] = useState<Theme>(initialThemePreference); const [locale, setLocale] = useState<Locale>((localStorage.getItem('trise-locale') as Locale) || 'en');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [postLoginRedirectPending, setPostLoginRedirectPending] = useState(false);
  const mobileOpen = mobileNavOpen;
  const [maintenance, setMaintenance] = useState<PublicPlatformMaintenance | null>(null);
  const [availability, setAvailability] = useState<PlatformAvailability | null>(null);
  const [providers, setProviders] = useState<Collection<ProviderAttributes> | null>(null); const [providerId, setProviderId] = useState(''); const [contextReady, setContextReady] = useState(false); const [route, setRoute] = useState<OperationsRoute>(parseRoute()); const section = route.section as Section; const t = (key: string) => translate(locale, key);
  useEffect(() => {
    let disposed = false;
    let loading = false;
    const loadAvailability = () => {
      if (disposed || loading || document.visibilityState === 'hidden') return;
      loading = true;
      operationsData.platformAvailability()
        .then((response) => {
          if (!disposed) {
            setAvailability(response.data);
            setMaintenance(response.data.maintenance);
          }
        })
        .catch(() => {
          if (!disposed) {
            setAvailability(null);
            setMaintenance(null);
          }
        })
        .finally(() => { loading = false; });
    };
    const refreshOnVisibility = () => {
      if (document.visibilityState === 'visible') loadAvailability();
    };
    loadAvailability();
    window.addEventListener('focus', loadAvailability);
    document.addEventListener('visibilitychange', refreshOnVisibility);
    return () => {
      disposed = true;
      window.removeEventListener('focus', loadAvailability);
      document.removeEventListener('visibilitychange', refreshOnVisibility);
    };
  }, []);
  useEffect(() => { const media = matchMedia('(prefers-color-scheme: dark)'); const apply = () => { document.documentElement.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme; }; apply(); localStorage.setItem('trise-theme', theme); if (theme === 'system') media.addEventListener('change', apply); return () => media.removeEventListener('change', apply); }, [theme]);
  useEffect(() => { localStorage.setItem('trise-locale', locale); document.documentElement.lang = locale; document.documentElement.dir = 'ltr'; }, [locale]);
  useEffect(() => { const onHash = () => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); const next = parseRoute(); const nextSection = next.section as Section; const context = session?.providerCapabilities.find((entry) => entry.providerId === providerId); const agentContext = context?.roleContext?.toUpperCase() === 'AGENT'; if (agentContext && nextSection === 'jobs' && next.id !== 'my-work') { go('jobs/my-work'); return; } if (context && !agentContext && nextSection === 'jobs' && next.id === 'my-work' && !context.capabilities.includes('my_work')) { go('overview'); return; } if (['administration', 'team-access', 'team-invitations', 'overview', 'work-intake', 'leads', 'requests', 'bookings', 'jobs', 'customers', 'sites', 'assets', 'quotations', 'billing', 'projects', 'amc', 'reports', 'configuration', 'workforce', 'attendance', 'my-leave', 'audit', 'notifications', 'onboarding', 'business-profile', 'compliance', 'subscriptions', 'platform', 'admin-invitations'].includes(nextSection)) setRoute(next); }; window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, [providerId, session]);
  useEffect(() => {
    const onSessionStarted = () => setPostLoginRedirectPending(true);
    window.addEventListener(SESSION_STARTED_EVENT, onSessionStarted);
    return () => window.removeEventListener(SESSION_STARTED_EVENT, onSessionStarted);
  }, []);
  useEffect(() => {
    const onProviderChanged = (event: Event) => {
      const next = (event as CustomEvent<string>).detail || '';
      // AccountMenuV2 changes the provider outside the header select. Keep the
      // shell's context state in sync as well; otherwise this event can leave
      // the workspace permanently on the loading state after the provider has
      // already been selected.
      setContextReady(false);
      setProviderId(next);
      if (next) setProvider(next);
      setContextReady(Boolean(next));
      go('overview');
    };
    window.addEventListener('trise-provider-changed', onProviderChanged);
    return () => window.removeEventListener('trise-provider-changed', onProviderChanged);
  }, [setProvider]);
  useEffect(() => {
    let retryTimer: number | undefined;
    let observer: MutationObserver | undefined;
    let cleanup: (() => void) | undefined;
    let attempts = 0;
    const enhanceSearch = () => {
      const input = document.querySelector<HTMLInputElement>('.shell-search input');
      const navigationRoot = document.querySelector<HTMLElement>('#provider-navigation');
      if (!input || !navigationRoot) {
        if (attempts++ < 30) retryTimer = window.setTimeout(enhanceSearch, 50);
        return;
      }
      const buttons = Array.from(navigationRoot.querySelectorAll<HTMLButtonElement>('button'))
        .map((button) => ({ label: button.textContent?.trim() || '', button }))
        .filter((item) => item.label)
        .sort((left, right) => left.label.localeCompare(right.label));
      if (!buttons.length) return;
      const searchRoot = input.closest<HTMLElement>('.shell-search');
      if (!searchRoot) return;
      const list = document.createElement('div');
      list.className = 'shell-search-suggestions';
      list.id = 'provider-search-actions';
      list.setAttribute('role', 'listbox');
      list.hidden = true;
      searchRoot.appendChild(list);
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('type', 'search');
      input.setAttribute('aria-autocomplete', 'list');
      input.setAttribute('aria-controls', list.id);
      const hide = () => { list.hidden = true; list.replaceChildren(); input.removeAttribute('aria-activedescendant'); };
      const choose = (item: { label: string; button: HTMLButtonElement }) => { item.button.click(); input.value = ''; hide(); input.blur(); };
      const render = () => {
        const query = input.value.trim().toLowerCase();
        list.replaceChildren();
        if (!query) { hide(); return; }
        const matches = buttons.filter(({ label }) => label.toLowerCase().includes(query)).slice(0, 8);
        if (!matches.length) { hide(); return; }
        matches.forEach((item, index) => {
          const option = document.createElement('button');
          option.type = 'button'; option.role = 'option'; option.id = `provider-search-option-${index}`;
          option.textContent = item.label; option.setAttribute('aria-label', `Open ${item.label}`);
          option.addEventListener('mousedown', (event) => event.preventDefault());
          option.addEventListener('click', () => choose(item));
          list.appendChild(option);
        });
        list.hidden = false;
      };
      const onInput = () => render();
      const onFocus = () => render();
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') { input.value = ''; hide(); input.blur(); return; }
        if (event.key !== 'Enter' || !input.value.trim()) return;
        const query = input.value.trim().toLowerCase();
        const match = buttons.find(({ label }) => label.toLowerCase() === query) || buttons.find(({ label }) => label.toLowerCase().includes(query));
        if (match) { event.preventDefault(); choose(match); }
      };
      const onOutside = (event: PointerEvent) => { if (!searchRoot.contains(event.target as Node)) hide(); };
      input.addEventListener('input', onInput); input.addEventListener('focus', onFocus); input.addEventListener('keydown', onKeyDown); document.addEventListener('pointerdown', onOutside);
      cleanup = () => { input.removeEventListener('input', onInput); input.removeEventListener('focus', onFocus); input.removeEventListener('keydown', onKeyDown); document.removeEventListener('pointerdown', onOutside); list.remove(); observer?.disconnect(); };
      observer = new MutationObserver(() => { if (!document.body.contains(searchRoot) || !document.body.contains(navigationRoot)) { cleanup?.(); retryTimer = window.setTimeout(enhanceSearch, 50); } });
      observer.observe(document.querySelector('.operations-layout') || document.body, { childList: true, subtree: true });
    };
    enhanceSearch();
    return () => { if (retryTimer) window.clearTimeout(retryTimer); cleanup?.(); document.getElementById('provider-search-actions')?.remove(); };
  }, [providerId, section, contextReady]);
  useEffect(() => { const [heading, description] = routeHeading(section, route); const headingElement = document.querySelector<HTMLElement>('.operations-main > .heading h1'); const descriptionElement = document.querySelector<HTMLElement>('.operations-main > .heading p'); if (headingElement) headingElement.textContent = heading; if (descriptionElement) descriptionElement.textContent = description; }, [authLoading, contextReady, route, section]);
  useEffect(() => { if (!mobileNavOpen) return; const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileNavOpen(false); }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape); }, [mobileNavOpen]);
  useEffect(() => {
    setProviders(null);
    setContextReady(Boolean(session?.platformAdmin));
    if (!session || session.platformAdmin || !hasProviderOperationsAccess(session)) {
      setProviderId('');
      return;
    }
    setProviderId(readProviderPreference(session.userId));
    loadAuthorizedProviders().then(setProviders).catch(() => setProviders({ data: [] }));
  }, [session?.userId, session?.platformAdmin]);
  useEffect(() => {
    if (!session || session.platformAdmin || !hasProviderOperationsAccess(session) || !providers) return;
    const authorized = providers.data;
    const preferred = authorized.some((provider) => provider.id === providerId) ? providerId : authorized[0]?.id || '';
    if (preferred !== providerId) setProviderId(preferred);
    if (preferred) {
      writeProviderPreference(session.userId, preferred);
      setProvider(preferred);
    }
    setContextReady(true);
  }, [providers, providerId, session, setProvider]);
  useEffect(() => {
    if (!session) return;
    const path = window.location.hash.slice(1).split('?')[0];
    if (postLoginRedirectPending && (session.platformAdmin || providerId || !hasProviderOperationsAccess(session))) {
      const target = postLoginRoute(session, providerId);
      setPostLoginRedirectPending(false);
      if (path !== target) go(target);
      return;
    }
    if (session.platformAdmin && !path.startsWith('platform')) go('platform/overview');
    if (!session.platformAdmin && path.startsWith('platform')) go('overview');
    if (!session.platformAdmin && contextReady && providerId) {
      const context = session.providerCapabilities.find((entry) => entry.providerId === providerId);
      if (context?.roleContext?.toUpperCase() === 'AGENT' && path !== 'jobs/my-work') go('jobs/my-work');
      if (context && context.roleContext?.toUpperCase() !== 'AGENT' && path === 'jobs/my-work' && !context.capabilities.includes('my_work')) go('overview');
    }
  }, [contextReady, postLoginRedirectPending, providerId, session, session?.userId, session?.platformAdmin, session?.providerCapabilities.length]);
  if (authLoading) return <main className="workspace"><PlatformMaintenanceBanner maintenance={maintenance} operations={availability?.operations} /><section className="notice"><Status>{t('loading')}</Status><p>{t('loading')}</p></section></main>;
  if (!session) return <LoginScreen maintenance={maintenance} operations={availability?.operations || []} authError={authError} />;
  const onMaintenanceRoute = section === 'platform' && route.kind === 'maintenance';
  if (maintenance?.mode === 'FULL_PLATFORM' && !onMaintenanceRoute) return <PlatformMaintenanceLockScreen maintenance={maintenance} operations={availability?.operations || []} canRecover={session.platformCapabilities?.includes('PLATFORM_MAINTENANCE_WRITE') === true} onOpenMaintenance={() => go('platform/maintenance')} onSignOut={() => void signOut()} />;
  if (!hasProviderOperationsAccess(session)) return <OperationsAccessUnavailable onSignOut={() => void signOut()} />;
  if (section === 'admin-invitations') return <main className="workspace"><PlatformMaintenanceBanner maintenance={maintenance} /><header className="topbar"><Wordmark /><Button onClick={() => go('overview')}>Back to workspace</Button></header><section className="operations-main"><MyProviderAdminInvitations key={session.userId} onAccepted={async () => { await refreshCurrentUser(); setProviders(await operationsData.providers()); }} /></section></main>;
  if (section === 'team-invitations') return <main className="workspace"><PlatformMaintenanceBanner maintenance={maintenance} /><header className="topbar"><Wordmark /><Button onClick={() => go('overview')}>Back to workspace</Button></header><section className="operations-main"><MyTeamInvitations key={session.userId} onAccepted={async () => { await refreshCurrentUser(); setProviders(await operationsData.providers()); }} /></section></main>;
  const providerOptions = providers?.data || [];
  const currentProviderName = providerOptions.find((provider) => provider.id === providerId)?.attributes.display_name || t('selectProvider');
  const navigation = navigationForSession(session, providerId);
  const nestedProviderCapability = navigation.provider.find((item) => item.hash === `${section}/${route.id}`)?.capability;
  const routeCapability = section === 'jobs' && route.id === 'my-work' ? 'my_work' : section === 'configuration' && route.kind === 'quotation-terms-templates' ? 'quotation_terms_admin' : nestedProviderCapability || requiredProviderCapability(section) || section;
  const notificationsAllowed = section === 'notifications' && navigation.context?.operationsAccess === true && navigation.context.capabilities.includes('notifications');
  const routeAllowed = section === 'notifications' ? notificationsAllowed : section === 'platform' || (section === 'administration' ? navigation.provider.some((item) => item.group === 'Administration') : providerRouteAllowed(session, providerId, section, route.id, route.kind));
  const capabilityAllowed = section === 'notifications' ? notificationsAllowed : section === 'platform' || section === 'overview' || (section === 'administration' ? routeAllowed : navigation.context?.capabilities.includes(routeCapability) === true);
  if (section === 'administration' && providerId && contextReady && routeAllowed && capabilityAllowed) {
    return <main className="workspace"><header className="topbar"><div className="shell-search" role="search"><span aria-hidden="true">⌕</span><input aria-label="Search customers, jobs, assets and requests" placeholder="Search customers, jobs, assets, requests…" /></div><button type="button" className="provider-mobile-menu" aria-expanded={mobileNavOpen} aria-controls="provider-navigation" onClick={() => setMobileNavOpen((open) => !open)}>{mobileNavOpen ? 'Close menu' : 'Menu'}</button><div className="controls"><label>{t('providers')} <select aria-label={t('providers')} value={providerId} onChange={(event) => { setContextReady(false); setProviderId(event.target.value); go('overview'); }}><option value="">{t('selectProvider')}</option>{providerOptions.map((provider) => <option value={provider.id} key={provider.id}>{provider.attributes.display_name || 'Authorized provider'}</option>)}</select></label><Button onClick={() => void signOut()}>Sign out</Button></div></header><div className="operations-layout">{mobileNavOpen && <button type="button" className="mobile-sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}<Navigation session={session} section={section} route={route} providerId={providerId} mobileOpen={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} /><section className="operations-main"><ProviderAdministrationPage key={providerId} providerId={providerId} capabilities={navigation.context?.capabilities || []} /></section></div></main>;
  }
  return <main className={"workspace" + (section === 'platform' ? ' platform-workspace' : '')}><header className="topbar"><div className="shell-search" role="search"><span aria-hidden="true">⌕</span><input aria-label="Search customers, jobs, assets and requests" placeholder="Search customers, jobs, assets, requests…" /></div>{section !== 'platform' && <button type="button" className="provider-mobile-menu" aria-expanded={mobileNavOpen} aria-controls="provider-navigation" onClick={() => setMobileNavOpen((open) => !open)}>{mobileNavOpen ? 'Close menu' : 'Menu'}</button>}{section === 'platform' && <div className="platform-shell-context"><strong>Platform Administration</strong><small>{session.displayName} · Authorized platform context</small></div>}{section === 'platform' && <button type="button" className="platform-mobile-menu" aria-expanded={mobileNavOpen} aria-controls="platform-navigation" onClick={() => setMobileNavOpen((open) => !open)}>{mobileOpen ? 'Close menu' : 'Menu'}</button>}<div className="controls">{section !== 'platform' && <label>{t('providers')} <select aria-label={t('providers')} value={providerId} onChange={(event) => { setContextReady(false); setProviderId(event.target.value); go('overview'); }}><option value="">{t('selectProvider')}</option>{providerOptions.map((provider) => <option value={provider.id} key={provider.id}>{provider.attributes.display_name || 'Authorized provider'}</option>)}</select></label>}<label>Language <select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="en">English</option><option value="kn">ಕನ್ನಡ (draft)</option><option value="hi">हिन्दી (draft)</option></select></label><label>Theme <select value={theme} onChange={(event) => setTheme(event.target.value as Theme)}><option>system</option><option>light</option><option value="dark">Dark</option></select></label><Button onClick={() => void signOut()}>Sign out</Button></div></header><div className="operations-layout">{mobileNavOpen && <button type="button" className="mobile-sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}<Navigation session={session} section={section} route={route} providerId={providerId} mobileOpen={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} /><section className="operations-main">{section !== 'platform' && <div className="heading"><div><Status>{t('dispatch')}</Status><h1>Operations workspace</h1><p>Use this workspace to add properties and equipment for an authorized customer.</p></div><div className="context"><span>Selected provider</span><strong>{currentProviderName}</strong><small>All records shown below are limited to this provider.</small></div></div>}{section === 'platform' ? route.kind === 'notifications' ? <PlatformNotificationHistoryPage /> : <PlatformRoute session={session} providerId={providerId} providerName={currentProviderName} /> : !providerId ? <section className="notice"><p>{t('noProvider')}</p></section> : !contextReady ? <DataState message={t('loading')} t={t} /> : !routeAllowed || !capabilityAllowed ? <ProviderCapabilityUnavailable feature={section === 'notifications' ? 'Notifications' : section === 'business-profile' ? 'Business profile' : section === 'jobs' && route.id === 'my-work' ? 'My Work' : section === 'customers' ? 'Customers' : section === 'onboarding' ? 'Onboarding' : section === 'configuration' ? 'Configuration' : section === 'requests' ? 'Requests' : section === 'bookings' ? 'Bookings' : section === 'jobs' ? 'Jobs' : section === 'workforce' ? 'Workforce' : section === 'audit' ? 'Audit history' : 'This provider feature'} /> : section === 'team-access' ? <ProviderAccessPage key={providerId} providerId={providerId} /> : section === 'business-profile' ? <ProviderBusinessProfilePage providerId={providerId} canViewSubscription={navigation.context?.capabilities.includes('subscriptions') === true} initialTab={route.id === 'subscription' ? 'subscription' : 'overview'} /> : section === 'notifications' ? <NotificationHistoryPage key={providerId} providerId={providerId} /> : section === 'overview' ? <Overview providerId={providerId} t={t} capabilities={navigation.context?.capabilities || []} /> : section === 'jobs' ? <Jobs providerId={providerId} t={t} route={route} myWorkAllowed={navigation.context?.capabilities.includes('my_work') === true} /> : section === 'customers' ? <AdminList section={section} providerId={providerId} t={t} /> : section === 'onboarding' ? <PropertyOnboarding providerId={providerId} /> : <OperationsPages section={section as OperationsRoute['section']} providerId={providerId} route={route} t={t} />}</section></div></main>;
}
type T = (key: string) => string;
function Wordmark({ variant }: { variant?: 'dark' | 'light' }) {
  if (variant) return <div className="wordmark"><TriseBrandHeader variant={variant} /></div>;
  return <div className="wordmark wordmark-theme-aware"><span className="wordmark-theme-light"><TriseBrandHeader variant="light" /></span><span className="wordmark-theme-dark"><TriseBrandHeader variant="dark" /></span></div>;
}
function AccountMenu() {
  const { session, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState<Collection<ProviderAttributes> | null>(null);
  const [providerId, setProviderId] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (session) operationsData.providers().then(setProviders).catch(() => setProviders({ data: [] })); else setProviders(null); }, [session]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); } };
    const onPointer = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('keydown', onKey); document.addEventListener('pointerdown', onPointer);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); };
  }, [open]);
  if (!session) return null;
  const currentProvider = providers?.data.find((provider) => provider.id === providerId)?.attributes.display_name || providerId || 'No provider selected';
  function changeProvider(next: string) { if (session) writeProviderPreference(session.userId, next); setProviderId(next); setOpen(false); window.location.reload(); }
  function changePreference(key: 'trise-theme' | 'trise-locale', value: string) { localStorage.setItem(key, value); setOpen(false); window.location.reload(); }
  return <div className="account-menu-anchor"><button ref={triggerRef} className="account-trigger" aria-label="Open account menu" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span className="account-avatar" aria-hidden="true">{session.displayName.slice(0, 1).toUpperCase()}</span><span className="account-trigger-copy"><strong>{session.displayName}</strong><small>{currentProvider}</small></span><SvgIcon name="chevron-down" size={16} /></button>{open && <div ref={menuRef} className="account-menu" role="menu" aria-label="Account and workspace menu"><section className="account-menu-section"><strong>Account</strong><span>{session.displayName}</span><small>Role and permissions are server-authorized.</small><button className="menu-item" disabled title="Operations profile screen is not yet available">My profile <small>Unavailable</small></button></section><section className="account-menu-section"><strong>Workspace</strong><label htmlFor="account-provider">Provider</label><select id="account-provider" value={providerId} onChange={(event) => changeProvider(event.target.value)}>{!providerId && <option value="">Select provider</option>}{providers?.data.map((provider) => <option value={provider.id} key={provider.id}>{provider.attributes.display_name || 'Authorized provider'}</option>)}</select><small>Changing workspace reloads private data and clears stale context.</small></section><section className="account-menu-section"><strong>Preferences</strong><label htmlFor="account-locale">Language</label><select id="account-locale" value={localStorage.getItem('trise-locale') || 'en'} onChange={(event) => changePreference('trise-locale', event.target.value)}><option value="en">English</option><option value="kn">ಕನ್ನಡ (draft)</option><option value="hi">हिन्दी (draft)</option></select><label htmlFor="account-theme">Appearance</label><select id="account-theme" value={localStorage.getItem('trise-theme') || 'system'} onChange={(event) => changePreference('trise-theme', event.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></section><section className="account-menu-section account-menu-session"><Button variant="danger" onClick={() => void signOut()}>Sign out</Button></section></div>}</div>;
}
void AccountMenu;
function AccountMenuV2() {
  const { session, signOut, refreshCurrentUser } = useAuth();
  const [open, setOpen] = useState(false); const [profile, setProfile] = useState(false); const [name, setName] = useState(''); const [locale, setLocale] = useState('en'); const [message, setMessage] = useState(''); const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState<Collection<ProviderAttributes> | null>(null); const [providerId, setProviderId] = useState(''); const triggerRef = useRef<HTMLButtonElement>(null); const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    if (!session) { setProviders(null); setProviderId(''); return () => { cancelled = true; }; }
    setName(session.displayName); setLocale(session.locale || 'en');
    if (session.platformAdmin || !hasProviderOperationsAccess(session)) { setProviders(null); setProviderId(''); return () => { cancelled = true; }; }
    setProviderId(readProviderPreference(session.userId));
    loadAuthorizedProviders().then((result) => { if (!cancelled) setProviders(result); }).catch(() => { if (!cancelled) setProviders({ data: [] }); });
    return () => { cancelled = true; };
  }, [session?.userId, session?.platformAdmin, session?.providerCapabilities.length]);
  useEffect(() => {
    if (!session || session.platformAdmin || !providers) return;
    const nextProviderId = providers.data.some((provider) => provider.id === providerId) ? providerId : providers.data[0]?.id || '';
    if (nextProviderId === providerId) return;
    setProviderId(nextProviderId);
    writeProviderPreference(session.userId, nextProviderId);
    window.dispatchEvent(new CustomEvent('trise-provider-changed', { detail: nextProviderId }));
  }, [providers, providerId, session?.userId, session?.platformAdmin]);
  useEffect(() => { if (!open) return; const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); setProfile(false); triggerRef.current?.focus(); } }; const onPointer = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) { setOpen(false); setProfile(false); } }; document.addEventListener('keydown', onKey); document.addEventListener('pointerdown', onPointer); return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); }; }, [open]);
  if (!session || !hasProviderOperationsAccess(session)) return null;
  const currentSession = session;
  const providerContext = session.platformAdmin ? undefined : session.providerCapabilities.find((context) => context.providerId === providerId);
  const canViewNotifications = Boolean(session.platformAdmin || (providerId && providers?.data.some((provider) => provider.id === providerId) && providerContext?.operationsAccess === true && providerContext.capabilities.includes('notifications')));
  const currentProvider = session.platformAdmin ? 'Platform Administration' : providers?.data.find((provider) => provider.id === providerId)?.attributes.display_name || providerId || 'No provider selected';
  function changeProvider(next: string) {
    writeProviderPreference(currentSession.userId, next);
    setProviderId(next);
    window.dispatchEvent(new CustomEvent('trise-provider-changed', { detail: next }));
  }
  function changePreference(key: 'trise-theme' | 'trise-locale', value: string) { localStorage.setItem(key, value); setOpen(false); window.location.reload(); }
  async function saveProfile(event: FormEvent) { event.preventDefault(); setSaving(true); setMessage(''); try { await apiClient.request('/me', { method: 'PATCH', body: JSON.stringify({ display_name: name, locale, expected_revision: currentSession.revision }) }); await refreshCurrentUser(); setMessage('Profile saved.'); } catch (cause) { setMessage(errorText(cause)); } finally { setSaving(false); } }
  const contextLabel = session.platformAdmin ? 'Platform Administration' : 'Service Provider · Business Operations';
  return <div className="account-menu-anchor">{providerId && <button type="button" className="account-provider-chip" aria-label="Open provider workspace menu" onClick={() => setOpen((value) => !value)}><span className="account-provider-icon" aria-hidden="true"><SvgIcon name="building" size={18} /></span><span><strong>{currentProvider}</strong><small>Provider workspace</small></span><SvgIcon name="chevron-down" size={15} /></button>}{canViewNotifications && <NotificationBell providerId={providerId} allowed={canViewNotifications} onViewAll={() => { setOpen(false); go('notifications'); }} />}<button ref={triggerRef} className="account-trigger" aria-label="Open account menu" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span className="account-avatar" aria-hidden="true">{session.displayName.slice(0, 1).toUpperCase()}</span><span className="account-trigger-copy"><strong>{session.displayName}</strong><small>{contextLabel}</small></span><SvgIcon name="chevron-down" size={16} /></button>{open && <div ref={menuRef} className="account-menu" role="dialog" aria-label="Account and workspace menu">{profile ? <form className="profile-panel" onSubmit={saveProfile}><div className="account-menu-title"><strong>My profile</strong><button type="button" className="text-button" onClick={() => setProfile(false)}><SvgIcon name="arrow-left" size={15} /> Back</button></div><label>Display name<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={200} /></label><label>Language<select value={locale} onChange={(event) => setLocale(event.target.value)}><option value="en">English</option><option value="kn">ಕನ್ನಡ (draft)</option><option value="hi">हिन्दી (draft)</option></select></label>{message && <p className="success" role="status">{message}</p>}<div className="account-actions"><Button type="button" variant="secondary" onClick={() => setProfile(false)}>Cancel</Button><Button type="submit" busy={saving}>{saving ? 'Saving…' : 'Save profile'}</Button></div></form> : <><section className="account-menu-section"><strong>Account</strong><span>{session.displayName}</span><small>{contextLabel}</small><button className="menu-item" onClick={() => setProfile(true)}>My profile <SvgIcon name="chevron-right" size={15} /></button><button className="menu-item" onClick={() => { setOpen(false); go('admin-invitations'); }}>Administrator invitations <SvgIcon name="chevron-right" size={15} /></button><button className="menu-item" onClick={() => { setOpen(false); go('team-invitations'); }}>Team invitations <SvgIcon name="chevron-right" size={15} /></button></section><section className="account-menu-section"><strong>Workspace</strong>{session.platformAdmin ? <><span>Platform Administration</span><small>Provider workspaces are managed from the platform provider directory.</small></> : <><label htmlFor="account-provider">Provider</label><select id="account-provider" value={providerId} onChange={(event) => changeProvider(event.target.value)}>{!providerId && <option value="">Select provider</option>}{providers?.data.map((provider) => <option value={provider.id} key={provider.id}>{provider.attributes.display_name || 'Authorized provider'}</option>)}</select><small>Changing workspace reloads private data and clears stale context.</small></>}</section><section className="account-menu-section"><strong>Preferences</strong><label htmlFor="account-locale">Language</label><select id="account-locale" value={localStorage.getItem('trise-locale') || 'en'} onChange={(event) => changePreference('trise-locale', event.target.value)}><option value="en">English</option><option value="kn">ಕನ್ನಡ (draft)</option><option value="hi">हिन्दી (draft)</option></select></section><section className="account-menu-section"><strong>Appearance</strong><label htmlFor="account-theme">Theme<select id="account-theme" value={localStorage.getItem('trise-theme') || 'system'} onChange={(event) => changePreference('trise-theme', event.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></section><section className="account-menu-section account-menu-session"><Button variant="secondary" onClick={() => void signOut()}>Sign out</Button></section></>}</div>}</div>;
}
  function RouteTitleSync() { useEffect(() => { const update = () => { const section = (window.location.hash.slice(1).split('?')[0].split('/')[0] || 'overview'); const titles: Record<string, string> = { overview: 'Overview', requests: 'Service requests', bookings: 'Appointments', jobs: 'Jobs and assignments', customers: 'Customers', sites: 'Sites & locations', assets: 'Assets', quotations: 'Quotations', billing: 'Payment & Billing', configuration: 'Configuration', workforce: 'Workforce', attendance: 'My attendance', 'my-leave': 'My leave', onboarding: 'Property onboarding', 'business-profile': 'Business profile', audit: 'Audit history', notifications: 'Notifications' }; const heading = document.querySelector<HTMLElement>('.operations-main > .heading h1'); const description = document.querySelector<HTMLElement>('.operations-main > .heading p'); if (heading) heading.textContent = titles[section] || 'Operations'; if (description) description.textContent = section === 'overview' ? 'A focused view of authorized work in this provider workspace.' : section === 'onboarding' ? 'Create a community and its elevator assets through supported staged operations.' : section === 'business-profile' ? 'Maintain provider details and submit the current revision for platform review.' : section === 'customers' ? 'Manage authorized customer identities and billing relationships.' : section === 'sites' ? 'Manage physical customer service and shipping locations.' : section === 'assets' ? 'Manage elevators, lifts, escalators and other equipment at customer sites.' : 'Manage authorized records and server-enforced next actions.'; }; update(); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []); return null; }
type DashboardSubject = 'overview' | 'intake' | 'delivery' | 'service' | 'finance';

type DashboardSubjectTab = { id: DashboardSubject; label: string; description: string; capabilities?: string[] };

const dashboardSubjectTabs: DashboardSubjectTab[] = [
  { id: 'overview', label: 'Overview', description: 'Provider-wide operational health.' },
  { id: 'intake', label: 'Intake & commercial', description: 'Leads, requests and commercial movement.', capabilities: ['work_intake', 'sales_marketing', 'quotations', 'requests'] },
  { id: 'delivery', label: 'Delivery & field', description: 'Appointments, jobs, projects and workforce.', capabilities: ['projects', 'bookings', 'jobs', 'workforce', 'my_work'] },
  { id: 'service', label: 'Service & AMC', description: 'Customer issues, service execution and renewals.', capabilities: ['requests', 'jobs', 'amc'] },
  { id: 'finance', label: 'Finance & stages', description: 'Project milestones, payment stages and exposure.', capabilities: ['projects', 'quotations'] },
];

function DashboardSubjectBoard({ subject, data, onNavigate }: { subject: Exclude<DashboardSubject, 'overview'>; data: ProviderOperationsDashboard; onNavigate: (route: string) => void }) {
  const attributes = data.attributes;
  const currency = (amount: string, code = 'INR') => `${code} ${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const tab = dashboardSubjectTabs.find((item) => item.id === subject);
  const heading = tab?.label || 'Operations';
  const description = tab?.description || 'Authorized provider operations.';
  const emptyRow = (message: string, route: string) => <div className="dashboard-subject-empty"><strong>{message}</strong><p>There is no data in this subject yet.</p><Button type="button" variant="secondary" onClick={() => onNavigate(route)}>Open workspace</Button></div>;
  const statusRows = [
    ...Object.entries(attributes.counts.leads_by_status || {}).map(([status, count]) => ({ area: 'Leads', status, count, route: 'leads' })),
    ...Object.entries(attributes.counts.installation_projects_by_status || {}).map(([status, count]) => ({ area: 'Projects', status, count, route: 'projects' })),
    { area: 'Service requests', status: 'Open', count: attributes.counts.open_requests, route: 'requests' },
  ].filter((row) => row.count > 0);

  return <section className="dashboard-subject-board" aria-labelledby={`dashboard-subject-${subject}`}>
    <header className="dashboard-subject-heading"><div><span className="dashboard-eyebrow">Dashboard subject</span><h3 id={`dashboard-subject-${subject}`}>{heading}</h3><p>{description}</p></div><span className="dashboard-subject-scope">Server-authorized data</span></header>
    {subject === 'intake' && (statusRows.length ? <div className="dashboard-subject-table-wrap"><table className="dashboard-subject-table"><thead><tr><th>Work area</th><th>Status</th><th>Volume</th><th>Next workspace</th></tr></thead><tbody>{statusRows.map((row) => <tr key={`${row.area}-${row.status}`}><td><strong>{row.area}</strong></td><td><Status>{row.status}</Status></td><td><strong>{row.count}</strong><small>authorized records</small></td><td><Button type="button" variant="quiet" onClick={() => onNavigate(row.route)}>View</Button></td></tr>)}</tbody></table></div> : emptyRow('No intake or commercial work is visible', 'work-intake'))}
    {subject === 'delivery' && (attributes.appointment_rows.length ? <div className="dashboard-subject-table-wrap"><table className="dashboard-subject-table"><thead><tr><th>Time</th><th>Customer / site</th><th>Service</th><th>Technician</th><th>Status</th><th>Action</th></tr></thead><tbody>{attributes.appointment_rows.map((booking) => <tr key={booking.id}><td><strong>{booking.requested_start_at ? formatIndiaTime(booking.requested_start_at) : 'Not scheduled'}</strong><small>{booking.requested_end_at ? formatIndiaTime(booking.requested_end_at) : 'Time window unavailable'}</small></td><td><strong>{booking.customer_name || booking.summary}</strong><small>{booking.site_name || 'Site not supplied'}</small></td><td>{booking.service_type || 'Service not specified'}</td><td>{booking.technician_name || 'Unassigned'}</td><td><Status>{booking.status}</Status></td><td><Button type="button" variant="quiet" onClick={() => onNavigate(`bookings/${booking.id}`)}>View</Button></td></tr>)}</tbody></table></div> : emptyRow('No appointments are scheduled', 'bookings'))}
    {subject === 'service' && <div className="dashboard-subject-sections"><section><div className="dashboard-subject-section-heading"><div><h4>Urgent complaints</h4><p>High-priority customer issues requiring attention.</p></div><Button type="button" variant="quiet" onClick={() => onNavigate('requests')}>View requests</Button></div>{attributes.urgent_complaint_rows.length ? <div className="dashboard-subject-table-wrap"><table className="dashboard-subject-table"><thead><tr><th>Customer / site</th><th>Issue</th><th>Severity</th><th>Opened</th><th>Status</th></tr></thead><tbody>{attributes.urgent_complaint_rows.map((complaint) => <tr key={`${complaint.source}-${complaint.id}`}><td><strong>{complaint.customer_name}</strong><small>{complaint.site_name}</small></td><td>{complaint.summary}</td><td><Priority>{complaint.severity}</Priority></td><td>{complaint.triggered_at ? formatIndiaDateTime(complaint.triggered_at) : 'Time unavailable'}</td><td><Status>{complaint.status}</Status></td></tr>)}</tbody></table></div> : <p className="dashboard-subject-inline-empty">No urgent complaints or escalations are open.</p>}</section><section><div className="dashboard-subject-section-heading"><div><h4>AMC renewal pipeline</h4><p>Contracts expiring in the next 90 days.</p></div><Button type="button" variant="quiet" onClick={() => onNavigate('amc')}>View AMC</Button></div>{attributes.amc_renewal_rows.length ? <div className="dashboard-subject-table-wrap"><table className="dashboard-subject-table"><thead><tr><th>Customer</th><th>Property</th><th>Expiry</th><th>Days left</th><th>Status</th></tr></thead><tbody>{attributes.amc_renewal_rows.map((contract) => <tr key={contract.id}><td><strong>{contract.customer_name}</strong><small>{contract.contract_number}</small></td><td>{contract.property_name}</td><td>{contract.ends_at ? formatIndiaDate(contract.ends_at) : 'No expiry date'}</td><td><strong className={(contract.days_left ?? 999) <= 14 ? 'is-urgent' : (contract.days_left ?? 999) <= 30 ? 'is-soon' : ''}>{contract.days_left ?? '—'}</strong></td><td><Status>{contract.status}</Status></td></tr>)}</tbody></table></div> : <p className="dashboard-subject-inline-empty">No renewals are due in the next 90 days.</p>}</section></div>}
    {subject === 'finance' && (attributes.payment_stage_rows.length ? <div className="dashboard-subject-table-wrap"><table className="dashboard-subject-table"><thead><tr><th>Project</th><th>Milestone</th><th>Due</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{attributes.payment_stage_rows.map((stage) => <tr key={stage.id}><td><strong>{stage.project_title || 'Installation project'}</strong><small>{stage.service_case_id.slice(0, 8)}</small></td><td><strong>{stage.milestone_code.replaceAll('_', ' ')}</strong><small>{stage.description}</small></td><td>{stage.due_on ? formatIndiaDate(stage.due_on) : 'No due date'}</td><td>{currency(stage.amount, stage.currency_code)}</td><td><Status>{stage.status}</Status></td><td><Button type="button" variant="quiet" onClick={() => onNavigate('projects')}>View</Button></td></tr>)}</tbody></table></div> : emptyRow('No payment stages are visible', 'projects'))}
  </section>;
}

function DashboardRoleFocus({ roleKey, data, assignments, onNavigate }: { roleKey: string; data: ProviderOperationsDashboard; assignments: Collection<AssignmentAttributes> | null; onNavigate: (route: string) => void }) {
  const counts = data.attributes.counts;
  if (roleKey === 'field-technician') {
    return <section className="dashboard-role-focus dashboard-panel dashboard-panel-wide"><div className="section-heading"><div><span className="dashboard-panel-kicker">MY WORKSPACE</span><h2>My assigned work</h2><p>Only assignments returned for the current authorized actor.</p></div><Button type="button" variant="quiet" onClick={() => onNavigate('jobs/my-work')}>Open My Work</Button></div>{assignments?.data.length ? <div className="dashboard-role-focus-list">{assignments.data.slice(0, 6).map((assignment) => <button type="button" className="dashboard-role-focus-row" key={assignment.id} onClick={() => onNavigate('jobs/my-work')}><span className="dashboard-focus-marker" aria-hidden="true" /><span><strong>Assigned service work</strong><small>{assignment.attributes.scheduled_start_at ? formatIndiaDateTime(assignment.attributes.scheduled_start_at) : 'Schedule not supplied'}</small></span><Status>{assignment.attributes.status}</Status><span className="dashboard-focus-arrow" aria-hidden="true">→</span></button>)}</div> : <div className="dashboard-subject-empty"><strong>{assignments ? 'No assignments are visible' : 'Loading assigned work'}</strong><p>{assignments ? 'New assignments will appear here when the provider assigns work to you.' : 'Checking the server-authorized assignment context.'}</p>{assignments && <Button type="button" variant="secondary" onClick={() => onNavigate('jobs/my-work')}>Open My Work</Button>}</div>}</section>;
  }
  if (roleKey === 'sales-commercial') {
    const rows = Object.entries(counts.leads_by_status || {}).sort((left, right) => right[1] - left[1]);
    return <section className="dashboard-role-focus dashboard-panel dashboard-panel-wide"><div className="section-heading"><div><span className="dashboard-panel-kicker">COMMERCIAL FOCUS</span><h2>Lead funnel</h2><p>Move authorized prospects from qualification to customer conversation.</p></div><Button type="button" variant="quiet" onClick={() => onNavigate('leads')}>Open leads</Button></div>{rows.length ? <div className="dashboard-role-focus-funnel">{rows.map(([status, value]) => <button type="button" className="dashboard-role-focus-funnel-row" key={status} onClick={() => onNavigate('leads')}><span className="dashboard-focus-marker is-commercial" aria-hidden="true" /><span><strong>{status.replaceAll('_', ' ')}</strong><small>Lead records in this stage</small></span><b>{value}</b><span className="dashboard-focus-arrow" aria-hidden="true">→</span></button>)}</div> : <div className="dashboard-subject-empty"><strong>No lead stages are visible</strong><p>Authorized marketing lead data will appear here when available.</p><Button type="button" variant="secondary" onClick={() => onNavigate('leads')}>Open leads</Button></div>}</section>;
  }
  return null;
}

function Overview({ providerId, t, capabilities }: { providerId: string; t: T; capabilities: string[] }) {
  const role = dashboardRoleFor(capabilities);
  const indiaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [data, setData] = useState<Awaited<ReturnType<typeof operationsData.providerOperationsDashboard>> | null>(null);
  const [error, setError] = useState('');
  const [dashboardDate, setDashboardDate] = useState(indiaToday);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState<DashboardSubject>('overview');
  const [myAssignments, setMyAssignments] = useState<Collection<AssignmentAttributes> | null>(null);
  const roleSubjectAllow: Record<string, DashboardSubject[]> = {
    'provider-administrator': ['overview', 'intake', 'delivery', 'service', 'finance'],
    'sales-commercial': ['overview', 'intake', 'finance'],
    'project-delivery': ['overview', 'delivery', 'finance'],
    'dispatch-coordination': ['overview', 'delivery', 'service'],
    'field-technician': ['overview', 'delivery'],
    'service-programs': ['overview', 'service'],
    'service-operations': ['overview', 'intake', 'service'],
    'provider-operations': ['overview', 'intake', 'delivery', 'service', 'finance'],
  };
  const subjectTabs = dashboardSubjectTabs.filter((tab) => (roleSubjectAllow[role.key] || roleSubjectAllow['provider-operations']).includes(tab.id) && (!tab.capabilities || tab.capabilities.some((capability) => capabilities.includes(capability))));
  useEffect(() => { if (!subjectTabs.some((tab) => tab.id === activeSubject)) setActiveSubject('overview'); }, [activeSubject, capabilities.join('|')]);
  useEffect(() => { setData(null); setError(''); operationsData.providerOperationsDashboard(providerId, dashboardDate).then(setData).catch((cause) => setError(errorText(cause))); }, [providerId, dashboardDate]);
  useEffect(() => { if (role.key !== 'field-technician') { setMyAssignments(null); return; } setMyAssignments(null); operationsData.assignments(providerId).then(setMyAssignments).catch(() => setMyAssignments({ data: [] })); }, [providerId, role.key]);
  if (error) return <DataState message={error} t={t} />;
  if (!data) return <DataState message={t('loading')} t={t} />;
  const counts = data.attributes.counts;
  const dashboardDateLabel = formatIndiaDate(`${dashboardDate}T00:00:00+05:30`);
  const appointmentsLabel = dashboardDate === indiaToday() ? "Today's appointments" : `Appointments on ${dashboardDateLabel}`;
  const currency = (amount: string, code = 'INR') => `${code} ${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const dateOnly = (value?: string | null) => value ? formatIndiaDate(value) : 'No expiry date';
  const timeAgo = (value?: string | null) => { if (!value) return 'Time unavailable'; const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000); const absolute = Math.abs(seconds); const unit: Intl.RelativeTimeFormatUnit = absolute < 60 ? 'second' : absolute < 3600 ? 'minute' : absolute < 86400 ? 'hour' : 'day'; const divisor = unit === 'second' ? 1 : unit === 'minute' ? 60 : unit === 'hour' ? 3600 : 86400; return new Intl.RelativeTimeFormat(document.documentElement.lang || 'en', { numeric: 'auto' }).format(Math.round(seconds / divisor), unit); };
  const assignmentRows = myAssignments?.data || [];
  const assignmentCounts = { proposed: assignmentRows.filter((item) => item.attributes.status === 'PROPOSED').length, planned: assignmentRows.filter((item) => ['ACCEPTED', 'SCHEDULED', 'IN_PROGRESS'].includes(item.attributes.status)).length, total: assignmentRows.length };
  const leadStatus = (status: string) => counts.leads_by_status?.[status] || 0;
  const cards: Array<[string, number | string, string, 'clipboard' | 'calendar' | 'settings' | 'users' | 'building' | 'activity']> = role.key === 'field-technician'
    ? [['My assignments', assignmentCounts.total, 'Assigned work in this context', 'clipboard'], ['Awaiting response', assignmentCounts.proposed, 'Proposed assignments', 'activity'], ['Planned work', assignmentCounts.planned, 'Accepted or scheduled work', 'calendar'], ['Active jobs', counts.active_jobs, 'Provider execution context', 'settings']]
    : role.key === 'sales-commercial'
      ? [['Lead pipeline', counts.leads, 'Authorized marketing leads', 'users'], ['New leads', leadStatus('NEW'), 'Leads awaiting qualification', 'clipboard'], ['Contacted leads', leadStatus('CONTACTED'), 'Leads in active follow-up', 'activity'], ['Active lead work', Math.max(0, counts.leads - leadStatus('NEW')), 'Qualified and contacted leads', 'activity']]
      : role.key === 'project-delivery'
        ? [['Installation projects', counts.installation_projects, 'Projects in delivery', 'building'], ['Open stages', counts.open_payment_schedules, 'Payment stages needing follow-up', 'activity'], ['Outstanding', currency(counts.outstanding_amount), 'Current payment exposure', 'activity'], ['Shipments', counts.shipments, 'Material movement records', 'clipboard']]
        : role.key === 'dispatch-coordination'
          ? [[appointmentsLabel, counts.todays_appointments, `Visits scheduled for ${dashboardDateLabel}`, 'calendar'], ['Open requests', counts.open_requests, 'Work waiting for dispatch', 'clipboard'], ['Active jobs', counts.active_jobs, 'Jobs in field execution', 'settings'], ['Available technicians', data.attributes.technician_availability.available, 'Technicians ready for assignment', 'users']]
          : role.key === 'service-programs'
            ? [['AMC renewals due', counts.amc_renewals_due, 'Contracts expiring within 90 days', 'building'], ['Active jobs', counts.active_jobs, 'Service execution in progress', 'settings'], ['Open requests', counts.open_requests, 'Customer work needing action', 'clipboard'], ['Customers', counts.customers, 'Covered customer records', 'users']]
            : role.key === 'service-operations'
              ? [['Open requests', counts.open_requests, 'Provider requests needing action', 'clipboard'], ['Escalations', counts.escalations, 'Open service escalations', 'activity'], ['Active jobs', counts.active_jobs, 'Jobs awaiting completion', 'settings'], [appointmentsLabel, counts.todays_appointments, `Appointments scheduled for ${dashboardDateLabel}`, 'calendar']]
              : [['Open requests', counts.open_requests, 'Provider requests needing action', 'clipboard'], [appointmentsLabel, counts.todays_appointments, `Appointments scheduled for ${dashboardDateLabel}`, 'calendar'], ['Active jobs', counts.active_jobs, 'Jobs awaiting completion', 'settings'], ['AMC renewals due', counts.amc_renewals_due, 'Contracts expiring within 90 days', 'building'], ['Payment follow-ups', counts.open_payment_schedules, 'Open payment obligations', 'activity'], ['Escalations', counts.escalations, 'Open service escalations', 'activity']];
  const projectBillingGroups = Object.values(data.attributes.payment_stage_rows.reduce<Record<string, { id: string; title: string; stages: typeof data.attributes.payment_stage_rows }>>((groups, stage) => {
    const group = groups[stage.service_case_id] || (groups[stage.service_case_id] = { id: stage.service_case_id, title: stage.project_title || 'Installation project', stages: [] });
    group.stages.push(stage);
    return groups;
  }, {}));
  const roleWidgetSet: Record<string, string[]> = {
    'provider-administrator': ['pipeline', 'load', 'attention', 'appointments', 'complaints', 'billing', 'availability', 'amc'],
    'sales-commercial': ['pipeline', 'attention'],
    'project-delivery': ['pipeline', 'attention', 'appointments', 'billing'],
    'dispatch-coordination': ['load', 'attention', 'appointments', 'complaints', 'availability'],
    'field-technician': ['my-work', 'attention'],
    'service-programs': ['load', 'attention', 'complaints', 'amc'],
    'service-operations': ['pipeline', 'load', 'attention', 'appointments', 'complaints'],
    'provider-operations': ['pipeline', 'load', 'attention', 'appointments', 'complaints', 'billing', 'availability', 'amc'],
  };
  const showWidget = (widget: string) => (roleWidgetSet[role.key] || roleWidgetSet['provider-operations']).includes(widget);
  const pipelineStatusRows = [
    ...Object.entries(counts.leads_by_status || {}).map(([label, value]) => ({ label: `Leads · ${label.replaceAll('_', ' ')}`, value, route: 'leads', tone: 'blue' })),
    ...Object.entries(counts.installation_projects_by_status || {}).map(([label, value]) => ({ label: `Projects · ${label.replaceAll('_', ' ')}`, value, route: 'projects', tone: 'green' })),
  ].sort((left, right) => right.value - left.value).slice(0, 6);
  const pipelineRows = pipelineStatusRows.length ? pipelineStatusRows : [
    { label: 'Leads total', value: counts.leads, route: 'leads', tone: 'blue' },
    { label: 'Installation projects', value: counts.installation_projects, route: 'projects', tone: 'green' },
  ];
  const pipelineMax = Math.max(1, ...pipelineRows.map((row) => row.value));
  const loadRows = [
    { label: 'Open requests', value: counts.open_requests, route: 'requests', tone: 'blue' },
    { label: 'Active jobs', value: counts.active_jobs, route: 'jobs', tone: 'purple' },
    { label: 'Payment follow-ups', value: counts.open_payment_schedules, route: 'projects', tone: 'orange' },
    { label: 'AMC renewals due', value: counts.amc_renewals_due, route: 'amc', tone: 'red' },
  ];
  const loadMax = Math.max(1, ...loadRows.map((row) => row.value));
  const pipelineTotal = Math.max(1, pipelineRows.reduce((total, row) => total + row.value, 0));
  const loadTotal = loadRows.reduce((total, row) => total + row.value, 0);
  const attentionRows = role.key === 'field-technician'
    ? [
      { label: 'Proposed assignments', value: assignmentCounts.proposed, detail: 'Awaiting your response', route: 'jobs/my-work', tone: 'purple' },
      { label: 'Planned work', value: assignmentCounts.planned, detail: 'Accepted or scheduled', route: 'jobs/my-work', tone: 'blue' },
    ]
    : role.key === 'sales-commercial'
      ? [
        { label: 'New leads', value: leadStatus('NEW'), detail: 'Awaiting qualification', route: 'leads', tone: 'blue' },
        { label: 'Active lead work', value: Math.max(0, counts.leads - leadStatus('NEW')), detail: 'Qualified or contacted', route: 'leads', tone: 'purple' },
      ]
      : role.key === 'project-delivery'
        ? [
          { label: 'Open payment stages', value: counts.open_payment_schedules, detail: 'Need collection follow-up', route: 'projects', tone: 'orange' },
          { label: 'Active jobs', value: counts.active_jobs, detail: 'In delivery execution', route: 'jobs', tone: 'blue' },
          { label: 'Shipments', value: counts.shipments, detail: 'Material movement records', route: 'projects', tone: 'purple' },
        ]
        : role.key === 'dispatch-coordination'
          ? [
            { label: 'Open requests', value: counts.open_requests, detail: 'Waiting for dispatch', route: 'requests', tone: 'blue' },
            { label: 'Today\'s appointments', value: counts.todays_appointments, detail: `Scheduled for ${dashboardDateLabel}`, route: 'bookings', tone: 'purple' },
            { label: 'Available technicians', value: data.attributes.technician_availability.available, detail: 'Ready for assignment', route: 'workforce', tone: 'green' },
          ]
          : role.key === 'service-programs'
            ? [
              { label: 'AMC renewals due', value: counts.amc_renewals_due, detail: 'Expiring within 90 days', route: 'amc', tone: 'orange' },
              { label: 'Open requests', value: counts.open_requests, detail: 'Customer work needing action', route: 'requests', tone: 'blue' },
            ]
            : role.key === 'service-operations'
              ? [
                { label: 'Open requests', value: counts.open_requests, detail: 'Provider work needing action', route: 'requests', tone: 'blue' },
                { label: 'Escalations', value: counts.escalations, detail: 'Open service escalations', route: 'requests', tone: 'red' },
                { label: 'Active jobs', value: counts.active_jobs, detail: 'Awaiting completion', route: 'jobs', tone: 'purple' },
              ]
              : [
                { label: 'Open requests', value: counts.open_requests, detail: 'Provider work needing action', route: 'requests', tone: 'blue' },
                { label: 'Payment follow-ups', value: counts.open_payment_schedules, detail: 'Open payment obligations', route: 'projects', tone: 'orange' },
                { label: 'AMC renewals due', value: counts.amc_renewals_due, detail: 'Expiring within 90 days', route: 'amc', tone: 'red' },
              ];
  const attentionTotal = attentionRows.reduce((total, row) => total + row.value, 0);
  const projectBillingRows = projectBillingGroups.map((project) => {
    const settled = project.stages.filter((stage) => stage.status === 'SETTLED').length;
    const totalAmount = project.stages.reduce((total, stage) => total + Number(stage.amount || 0), 0);
    return { ...project, settled, totalAmount, currencyCode: project.stages[0]?.currency_code || 'INR' };
  });
  const go = (route: string) => {
    const capabilityByRoute: Record<string, string> = {
      'work-intake': 'work_intake', leads: 'sales_marketing', requests: 'requests', bookings: 'bookings',
      jobs: 'jobs', 'jobs/my-work': 'my_work', customers: 'customers', quotations: 'quotations',
      projects: 'projects', amc: 'amc', workforce: 'workforce', reports: 'reports', audit: 'audit',
    };
    const capability = capabilityByRoute[route.split('/')[0] === 'jobs' && route.includes('my-work') ? 'jobs/my-work' : route.split('/')[0]];
    if (capability && !capabilities.includes(capability)) return;
    window.location.hash = route;
  };
  const cardRoute = (label: string) => {
    const normalized = label.toLowerCase();
    if (normalized.includes('lead') || label === 'Customers') return label === 'Customers' ? 'customers' : 'leads';
    if (normalized.includes('appointment')) return 'bookings';
    if (normalized.includes('request') || label === 'Escalations') return 'requests';
    if (normalized.includes('amc')) return 'amc';
    if (normalized.includes('project') || normalized.includes('stage') || normalized.includes('outstanding') || normalized.includes('payment') || normalized.includes('follow-up') || label === 'Shipments') return 'projects';
    if (normalized.includes('technician')) return 'workforce';
    if (normalized.includes('assignment') || normalized.includes('work') || normalized.includes('job')) return role.key === 'field-technician' ? 'jobs/my-work' : 'jobs';
    return 'reports';
  };
  return <section className="overview-screen provider-dashboard">
    <div className="dashboard-toolbar"><div><span className="dashboard-eyebrow">Provider operations</span><h2>Operations dashboard</h2><p>Monitor the work areas authorized for this provider role.</p></div><div className="dashboard-header-tools"><div className="dashboard-date-picker"><button type="button" className="dashboard-date-filter" aria-label="Dashboard date" aria-expanded={datePickerOpen} onClick={() => setDatePickerOpen((open) => !open)}><SvgIcon name="calendar" size={16} />{formatIndiaDate(`${dashboardDate}T00:00:00+05:30`)}<SvgIcon name="chevron-down" size={14} /></button>{datePickerOpen && <div className="dashboard-date-popover" role="dialog" aria-label="Choose dashboard date"><label htmlFor="dashboard-date-input">View dashboard for<input id="dashboard-date-input" type="date" value={dashboardDate} onChange={(event) => { setDashboardDate(event.target.value); setDatePickerOpen(false); }} onInput={(event) => { const value = event.currentTarget.value; if (value) { setDashboardDate(value); setDatePickerOpen(false); } }} /></label><button type="button" className="text-button" onClick={() => { setDashboardDate(indiaToday()); setDatePickerOpen(false); }}>Today</button><small>All date-based dashboard sections use Asia/Kolkata.</small></div>}</div><div className="overview-actions">{capabilities.includes('sales_marketing') && <Button onClick={() => go('leads')}>Review leads</Button>}{capabilities.includes('projects') && <Button variant="secondary" onClick={() => go('projects')}>Review projects</Button>}</div></div></div>
    <p className="notice dashboard-scope-note">Aggregates are returned by the authorized Provider Operations dashboard; no Platform subscription or billing data is included.</p>
    <WorkflowFollowUpDesk providerId={providerId} onOpenTarget={go} />
    <nav className="dashboard-subject-tabs" role="tablist" aria-label="Dashboard subjects">{subjectTabs.map((tab) => <button type="button" role="tab" aria-selected={activeSubject === tab.id} className={activeSubject === tab.id ? 'is-active' : ''} key={tab.id} onClick={() => setActiveSubject(tab.id)}><strong>{tab.label}</strong><small>{tab.description}</small></button>)}</nav>
    <div className="dashboard-metrics">{cards.map(([label, value, hint, icon], index) => <button className={`dashboard-metric metric-${index + 1}`} key={label} onClick={() => go(cardRoute(label))}><span className="dashboard-metric-icon"><SvgIcon name={icon} size={18} /></span><span>{label}</span><strong>{value}</strong><small>{hint}</small></button>)}</div>
    <DashboardRoleFocus roleKey={role.key} data={data} assignments={myAssignments} onNavigate={go} />
    {activeSubject === 'overview' && <div className="dashboard-insights">
      {showWidget('pipeline') && <section className="dashboard-panel dashboard-chart-panel dashboard-pipeline-panel"><div className="section-heading"><div><span className="dashboard-panel-kicker">WORK PIPELINE</span><h2>Work pipeline</h2><p>Authorized lead and project movement by status.</p></div><div className="dashboard-panel-total"><strong>{pipelineTotal === 1 && !pipelineRows.some((row) => row.value) ? 0 : pipelineRows.reduce((total, row) => total + row.value, 0)}</strong><small>tracked items</small></div></div>{pipelineRows.length ? <div className="dashboard-pipeline-content" role="img" aria-label="Work pipeline by status"><div className="dashboard-pipeline-rail" aria-hidden="true">{pipelineRows.map((row) => <span className={`is-${row.tone}`} key={`rail-${row.route}-${row.label}`} style={{ flexGrow: Math.max(1, row.value) }} />)}</div><div className="dashboard-pipeline-list">{pipelineRows.map((row) => <button type="button" className="dashboard-pipeline-row" key={`${row.route}-${row.label}`} onClick={() => go(row.route)}><span className={`dashboard-pipeline-dot is-${row.tone}`} aria-hidden="true" /><span className="dashboard-pipeline-row-main"><strong>{row.label}</strong><small>{Math.round(row.value / pipelineTotal * 100)}% of tracked work</small></span><span className="dashboard-pipeline-row-value"><b>{row.value}</b><i><em className={`is-${row.tone}`} style={{ width: `${Math.max(6, row.value / pipelineMax * 100)}%` }} /></i></span><span className="dashboard-pipeline-arrow" aria-hidden="true">→</span></button>)}</div><button type="button" className="dashboard-panel-link" onClick={() => go('reports')}>Open pipeline report <span aria-hidden="true">→</span></button></div> : <p className="dashboard-empty-copy">No lead or project status data is available yet.</p>}</section>}
      {showWidget('load') && <section className="dashboard-panel dashboard-chart-panel dashboard-load-panel"><div className="section-heading"><div><span className="dashboard-panel-kicker">TEAM CAPACITY</span><h2>Operational load</h2><p>Prioritized work areas requiring attention.</p></div><div className="dashboard-panel-total"><strong>{loadTotal}</strong><small>open items</small></div></div><div className="dashboard-load-summary"><span className="dashboard-load-summary-icon" aria-hidden="true">!</span><span><strong>{loadTotal ? 'Attention required' : 'Workload is clear'}</strong><small>{loadTotal ? 'Open work is distributed across the following areas.' : 'No open operational work is currently reported.'}</small></span></div><div className="dashboard-load-chart" role="img" aria-label="Operational load by work area">{loadRows.map((row) => <button type="button" className="dashboard-load-row" key={row.label} onClick={() => go(row.route)}><span className={`dashboard-load-icon is-${row.tone}`} aria-hidden="true" /><span className="dashboard-load-row-main"><strong>{row.label}</strong><small>{row.value ? 'Requires follow-up' : 'No open items'}</small></span><span className="dashboard-load-row-value"><b>{row.value}</b><i><em className={`is-${row.tone}`} style={{ width: `${Math.max(6, row.value / loadMax * 100)}%` }} /></i></span><span className="dashboard-load-arrow" aria-hidden="true">→</span></button>)}</div></section>}
      {showWidget('attention') && <section className="dashboard-panel dashboard-attention-panel"><div className="section-heading"><div><span className="dashboard-panel-kicker">NEXT ACTIONS</span><h2>Needs attention</h2><p>Role-specific work that should be handled next.</p></div><div className="dashboard-panel-total"><strong>{attentionTotal}</strong><small>open items</small></div></div>{attentionTotal ? <div className="dashboard-load-chart" aria-label="Priority work requiring attention">{attentionRows.filter((row) => row.value > 0).map((row) => <button type="button" className="dashboard-load-row" key={row.label} onClick={() => go(row.route)}><span className={`dashboard-load-icon is-${row.tone}`} aria-hidden="true" /><span className="dashboard-load-row-main"><strong>{row.label}</strong><small>{row.detail}</small></span><span className="dashboard-load-row-value"><b>{row.value}</b><i><em className={`is-${row.tone}`} style={{ width: `${Math.max(6, row.value / attentionTotal * 100)}%` }} /></i></span><span className="dashboard-load-arrow" aria-hidden="true">→</span></button>)}</div> : <div className="dashboard-clear-state"><span className="dashboard-clear-icon" aria-hidden="true">✓</span><div><strong>Everything is up to date</strong><p>No requests, jobs, payments or renewals require action right now.</p></div><Button type="button" variant="secondary" onClick={() => go('requests')}>Review requests</Button></div>}</section>}
    </div>}
    {activeSubject === 'overview' ? <div className="dashboard-panels">
      {showWidget('appointments') && <section className="dashboard-panel dashboard-panel-wide"><div className="section-heading"><div><h2>Operations for {dashboardDateLabel}</h2><p>Appointments and provider work for the selected India date.</p></div><button className="text-button" onClick={() => go('bookings')}>View all</button></div>{data.attributes.appointment_rows.length ? <div className="dashboard-table"><div className="dashboard-table-row dashboard-table-head"><span>Time</span><span>Customer / site</span><span>Service type</span><span>Technician</span><span>Status</span></div>{data.attributes.appointment_rows.map((booking) => <button className="dashboard-table-row" key={booking.id} onClick={() => go(`bookings/${booking.id}`)}><span data-label="Time">{booking.requested_start_at ? formatIndiaTime(booking.requested_start_at) : 'Not scheduled'}</span><span className="dashboard-appointment-customer" data-label="Customer / site"><strong>{booking.customer_name || booking.summary}</strong><small>{booking.site_name || 'Site not supplied'}</small></span><span data-label="Service type">{booking.service_type || 'Service not specified'}</span><span data-label="Technician">{booking.technician_name || 'Unassigned'}</span><span className="dashboard-appointment-status" data-label="Status"><Status>{booking.status}</Status></span></button>)}</div> : <div className="dashboard-empty-state"><strong>No appointments are scheduled for {dashboardDateLabel}.</strong><p>Use dispatch to convert authorized service work into a planned field visit.</p><Button type="button" variant="secondary" onClick={() => go('bookings')}>Open dispatch</Button></div>}</section>}
      {showWidget('complaints') && <section className="dashboard-panel"><div className="section-heading"><div><h2>Urgent complaints</h2><p>High-priority provider issues requiring attention.</p></div><div className="section-heading-actions"><span>{data.attributes.urgent_complaint_rows.length} open</span><button className="text-button" onClick={() => go('requests')}>View requests</button></div></div>{data.attributes.urgent_complaint_rows.length ? data.attributes.urgent_complaint_rows.map((complaint) => <button className="dashboard-complaint-row" key={`${complaint.source}-${complaint.id}`} onClick={() => go('requests')}><span className="dashboard-complaint-icon"><SvgIcon name="building" size={16} /></span><span className="dashboard-complaint-copy"><strong>{complaint.customer_name}</strong><small>{complaint.summary} · {complaint.site_name}</small></span><span className="dashboard-complaint-meta"><time dateTime={complaint.triggered_at || undefined}>{timeAgo(complaint.triggered_at)}</time><Priority>{complaint.severity}</Priority></span></button>) : <p>No urgent complaints or escalations are open.</p>}</section>}
      {showWidget('billing') && <section className="dashboard-panel dashboard-billing-panel"><div className="section-heading"><div><span className="dashboard-panel-kicker">PROJECT FINANCE</span><h2>Project stage billing</h2><p>Track stage progress, payment exposure and collection readiness.</p></div><button className="text-button" onClick={() => go('projects')}>View all</button></div><div className="dashboard-billing-summary"><div><span>Open stages</span><strong>{counts.open_payment_schedules}</strong></div><div><span>Outstanding</span><strong>{currency(counts.outstanding_amount)}</strong></div><div><span>Projects tracked</span><strong>{projectBillingRows.length}</strong></div></div>{projectBillingRows.map((project) => <article className="dashboard-project-billing" key={project.id}><div className="dashboard-project-header"><button className="dashboard-project-title" onClick={() => go('projects')}>{project.title}</button><span>{project.stages.length} stages</span></div><div className="dashboard-project-progress"><div><small>{project.settled} of {project.stages.length} settled</small><small>{currency(String(project.totalAmount), project.currencyCode)} total stage value</small></div><i><em style={{ width: `${project.stages.length ? project.settled / project.stages.length * 100 : 0}%` }} /></i></div><div className="dashboard-stage-timeline">{project.stages.map((stage, index) => <div className={`dashboard-stage dashboard-stage-card ${stage.status === 'SETTLED' ? 'is-settled' : index === project.stages.findIndex((item) => item.status === 'OPEN') ? 'is-due' : 'is-pending'}`} key={stage.id}><span className="dashboard-stage-marker" aria-hidden="true">{stage.status === 'SETTLED' ? '✓' : index + 1}</span><span className="dashboard-stage-copy"><strong title={stage.milestone_code}>{stage.milestone_code.replaceAll('_', ' ')}</strong><small>{stage.description}</small></span><b>{currency(stage.amount, stage.currency_code)}</b><Status>{stage.status}</Status></div>)}</div></article>)}{!projectBillingRows.length && <p className="dashboard-empty-state"><strong>No payment stages are visible.</strong><span>Project billing will appear here when a delivery stage is created.</span><Button type="button" variant="secondary" onClick={() => go('projects')}>Open projects</Button></p>}</section>}
      {showWidget('availability') && <section className="dashboard-panel"><div className="section-heading"><div><h2>Technician availability</h2><p>Live status from the provider availability rules.</p></div><button className="text-button" onClick={() => go('workforce')}>Manage</button></div><div className="dashboard-availability-grid">{([['available', 'Available', '#0f9b68'], ['on_site', 'On site', '#1769e8'], ['on_leave', 'On leave', '#e27600']] as const).map(([key, label, color]) => { const total = data.attributes.technician_availability.total; const value = data.attributes.technician_availability[key]; const percent = total ? Math.round(value / total * 100) : 0; return <div className="dashboard-availability-item" key={key}><div className="dashboard-availability-ring" style={{ background: `conic-gradient(${color} ${percent}%, #d7e1ef ${percent}% 100%)` }}><span>{value}</span></div><strong>{label}</strong><small>{percent}%</small></div>; })}</div><div className="dashboard-availability-summary"><span>Total technicians <strong>{data.attributes.technician_availability.total}</strong></span><span>Other unavailable <strong>{data.attributes.technician_availability.unavailable}</strong></span></div></section>}
      {showWidget('amc') && <section className="dashboard-panel"><div className="section-heading"><div><h2>AMC renewal pipeline</h2><p>Contracts expiring in the next 90 days.</p></div><button className="text-button" onClick={() => go('amc')}>View all</button></div><div className="dashboard-renewal-table-wrap"><table className="dashboard-renewal-table"><thead><tr><th>Customer</th><th>Property</th><th>Expiry date</th><th>Days left</th></tr></thead><tbody>{data.attributes.amc_renewal_rows.map((contract) => <tr key={contract.id} role="link" aria-label={`Open AMC contract ${contract.contract_number}`} onClick={() => go('amc')} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') go('amc'); }}><td>{contract.customer_name}</td><td>{contract.property_name}</td><td>{dateOnly(contract.ends_at)}</td><td><span className={`dashboard-days-left ${(contract.days_left ?? 999) <= 14 ? 'is-urgent' : (contract.days_left ?? 999) <= 30 ? 'is-soon' : ''}`}>{contract.days_left ?? '—'}</span></td></tr>)}</tbody></table></div>{!data.attributes.amc_renewal_rows.length && <p>No renewals are due in the next 90 days.</p>}</section>}
    </div> : <DashboardSubjectBoard subject={activeSubject} data={data} onNavigate={go} />}
  </section>;
}
function Requests({ providerId, t }: { providerId: string; t: T }) { const [items, setItems] = useState<Collection<RequestAttributes> | null>(null); const [selected, setSelected] = useState<Resource<RequestAttributes> | null>(null); const [error, setError] = useState(''); useEffect(() => { setItems(null); operationsData.requests(providerId).then(setItems).catch((cause) => setError(errorText(cause))); }, [providerId]); if (error) return <DataState message={error} t={t} />; if (!items) return <DataState message={t('loading')} t={t} />; return <section className="content"><div className="section-heading"><h2>{t('serviceRequests')}</h2><span>{items.data.length} / 25</span></div><div className="record-grid">{items.data.length === 0 ? <DataState message={t('empty')} t={t} /> : items.data.map((item) => <button className="record-card" key={item.id} onClick={() => operationsData.request(providerId, item.id).then(setSelected).catch((cause) => setError(errorText(cause)))}><Status>{item.attributes.status}</Status><strong>{item.attributes.summary}</strong><span>{item.attributes.description || '—'}</span><small>{item.id}</small></button>)}</div>{selected && <article className="detail-card"><button className="text-button" onClick={() => setSelected(null)}><SvgIcon name="arrow-left" size={16} /> {t('back')}</button><h3>{selected.attributes.summary}</h3><dl><dt>Status</dt><dd>{selected.attributes.status}</dd><dt>Revision</dt><dd>{selected.attributes.revision}</dd><dt>Asset</dt><dd>{(selected.relationships.asset as { id?: string } | null)?.id || '—'}</dd></dl><WorkflowFollowUpsForResource providerId={providerId} targetResourceKind="ServiceRequest" targetResourceId={selected.id} stage="SERVICE" title="Service request follow-ups" /></article>}</section>; }
function Bookings({ providerId, t }: { providerId: string; t: T }) { const [items, setItems] = useState<Collection<BookingAttributes> | null>(null); const [pools, setPools] = useState<Collection<CapacityPoolAttributes> | null>(null); const [selectedPool, setSelectedPool] = useState<Record<string, string>>({}); const [message, setMessage] = useState(''); const [error, setError] = useState(''); useEffect(() => { Promise.all([operationsData.bookings(providerId), operationsData.capacityPools(providerId)]).then(([bookingResult, poolResult]) => { setItems(bookingResult); setPools(poolResult); }).catch((cause) => setError(errorText(cause))); }, [providerId]); if (error) return <DataState message={error} t={t} />; if (!items || !pools) return <DataState message={t('loading')} t={t} />;
  async function confirm(item: Resource<BookingAttributes>) { const poolId = selectedPool[item.id]; if (!poolId) return; try { await operationsData.createAppointment(providerId, { booking_id: item.id, starts_at: item.attributes.requested_window.starts_at, ends_at: item.attributes.requested_window.ends_at, fulfilment_mode: 'ON_SITE' }, crypto.randomUUID()); await operationsData.confirmAppointment(providerId, item.id, { capacity_pool_id: poolId, expected_revision: item.attributes.revision }, crypto.randomUUID()); setMessage(`${item.id}: ${t('appointmentConfirmed')}`); setItems(await operationsData.bookings(providerId)); } catch (cause) { setError(errorText(cause)); } }
  async function reschedule(item: Resource<BookingAttributes>) { const starts = new Date(item.attributes.requested_window.starts_at); const ends = new Date(item.attributes.requested_window.ends_at); starts.setHours(starts.getHours() + 1); ends.setHours(ends.getHours() + 1); try { await operationsData.rescheduleAppointment(providerId, item.id, { starts_at: starts.toISOString(), ends_at: ends.toISOString(), expected_revision: item.attributes.revision }, crypto.randomUUID()); setMessage(`${item.id}: ${t('appointmentRescheduled')}`); setItems(await operationsData.bookings(providerId)); } catch (cause) { setError(errorText(cause)); } }
  async function createJob(item: Resource<BookingAttributes>) { const relation = item.relationships.customer_relationship as { id?: string } | null | undefined; const asset = item.relationships.asset as { id?: string } | null | undefined; const location = (item.relationships.service_location || item.relationships.location) as { id?: string } | null | undefined; const serviceType = item.relationships.service_type as { id?: string } | null | undefined; if (!relation?.id || !location?.id || !serviceType?.id) { setError('The booking does not expose the relationships required to create a job.'); return; } try { const job = await operationsData.createJob(providerId, { customer_relationship_id: relation.id, booking_id: item.id, asset_id: asset?.id, location_id: location.id, service_type_id: serviceType.id, summary: item.attributes.summary }, crypto.randomUUID()); setMessage(`${job.id}: job created from booking`); } catch (cause) { setError(errorText(cause)); } }
  return <section className="content"><div className="section-heading"><h2>{t('serviceBookings')}</h2></div>{items.data.length === 0 ? <DataState message={t('empty')} t={t} /> : <div className="record-grid">{items.data.map((item) => <article className="record-card" key={item.id}><Status>{item.attributes.status}</Status><strong>{item.attributes.summary}</strong><span>{formatIndiaDateTime(item.attributes.requested_window.starts_at)}</span><small>{item.id}</small>{['REQUESTED', 'PROPOSED', 'RESCHEDULED'].includes(item.attributes.status) && <><select aria-label={t('selectCapacity')} value={selectedPool[item.id] || ''} onChange={(event) => setSelectedPool((current) => ({ ...current, [item.id]: event.target.value }))}><option value="">{t('selectCapacity')}</option>{pools.data.filter((pool) => pool.attributes.status === 'ACTIVE').map((pool) => <option value={pool.id} key={pool.id}>{pool.attributes.name}</option>)}</select><Button disabled={!selectedPool[item.id]} onClick={() => void confirm(item)}>{t('confirmAppointment')}</Button></>}{['CONFIRMED', 'RESCHEDULED'].includes(item.attributes.status) && <><Button onClick={() => void reschedule(item)}>{t('rescheduleAppointment')}</Button><Button onClick={() => void createJob(item)}>Create job</Button></>}</article>)}</div>}{error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}</section>; }
function LegacyJobs({ providerId, t }: { providerId: string; t: T }) { const [jobs, setJobs] = useState<Collection<JobAttributes> | null>(null); const [agents, setAgents] = useState<Collection<AgentAttributes> | null>(null); const [assignments, setAssignments] = useState<Collection<AssignmentAttributes> | null>(null); const [selected, setSelected] = useState<Record<string, string>>({}); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [agentError, setAgentError] = useState(''); useEffect(() => { Promise.all([operationsData.jobs(providerId), operationsData.assignments(providerId)]).then(([jobResult, assignmentResult]) => { setJobs(jobResult); setAssignments(assignmentResult); }).catch((cause) => setError(errorText(cause))); operationsData.agents(providerId).then(setAgents).catch((cause) => setAgentError(errorText(cause))); }, [providerId]); if (error) return <DataState message={error} t={t} />; if (!jobs || !assignments) return <DataState message={t('loading')} t={t} />; async function assign(job: Resource<JobAttributes>) { const agentId = selected[job.id]; if (!agentId) return; try { await operationsData.assign(providerId, job.id, { agent_id: agentId, effective_at: new Date().toISOString(), expected_revision: job.attributes.revision }, crypto.randomUUID()); setMessage(t('assignmentSaved')); setJobs(await operationsData.jobs(providerId)); } catch (cause) { setError(errorText(cause)); } } async function accept(assignment: Resource<AssignmentAttributes>) { try { await operationsData.acceptAssignment(providerId, assignment.id, { expected_revision: assignment.attributes.revision || 0 }, crypto.randomUUID()); setMessage(`Assignment accepted`); setAssignments(await operationsData.assignments(providerId)); } catch (cause) { setError(errorText(cause)); } } return <section className="content"><div className="section-heading"><h2>{t('jobs')}</h2><span>Showing {jobs.data.length} jobs</span></div>{agentError && <p className="notice">Agent directory unavailable for this account.</p>}{jobs.data.length === 0 ? <DataState message={t('empty')} t={t} /> : <div className="record-grid">{jobs.data.map((job) => <JobCard key={job.id} job={job} providerId={providerId} agents={agents} selectedAgent={selected[job.id] || ''} onAgentChange={(agentId) => setSelected((current) => ({ ...current, [job.id]: agentId }))} onAssign={() => void assign(job)} t={t} />)}</div>}{assignments.data.length > 0 && <section className="detail-card"><h3>My assignments</h3>{assignments.data.map((assignment) => <article className="record-card" key={assignment.id}><Status>{assignment.attributes.status}</Status><strong>Assigned work</strong>{assignment.attributes.status === 'PROPOSED' && <Button onClick={() => void accept(assignment)}>Accept assignment</Button>}</article>)}</section>}{message && <p className="success" role="status">{message}</p>}</section>; }
void LegacyJobs;

void Requests; void Bookings;
function JobCard({ job, providerId, agents, selectedAgent, onAgentChange, onAssign, t }: { job: Resource<JobAttributes>; providerId: string; agents: Collection<AgentAttributes> | null; selectedAgent: string; onAgentChange: (value: string) => void; onAssign: () => void; t: T }) { const [visits, setVisits] = useState<Collection<import('./data').VisitAttributes> | null>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState(''); useEffect(() => { operationsData.visits(providerId, job.id).then(setVisits).catch((cause) => setError(errorText(cause))); }, [providerId, job.id]); const visit = visits?.data[0]; async function openVisit() { setBusy(true); setError(''); try { setVisits(await operationsData.visits(providerId, job.id).then(async (current) => current.data.length ? current : { data: [await operationsData.createVisit(providerId, job.id, { notes: 'Created from agent execution view' }, crypto.randomUUID())] })); setMessage('Visit created or loaded from the server'); } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); } } async function execute(action: 'checkIn' | 'start' | 'complete') { if (!visit) return; setBusy(true); setError(''); try { const body = { visit_id: visit.id, effective_at: new Date().toISOString(), expected_revision: job.attributes.revision }; await operationsData[action](providerId, job.id, body, crypto.randomUUID()); setMessage(`${action} accepted by the server`); } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); } } return <article className="record-card"><Status>{job.attributes.status}</Status><strong>{job.attributes.summary || job.id}</strong><span>{t('assignmentNote')}</span>{agents && <><select aria-label={t('selectAgent')} value={selectedAgent} onChange={(event: ChangeEvent<HTMLSelectElement>) => onAgentChange(event.target.value)}><option value="">{t('selectAgent')}</option>{agents.data.map((agent) => <option value={agent.id} key={agent.id}>{agent.attributes.display_name || agent.id}</option>)}</select><Button disabled={!selectedAgent} onClick={onAssign}>{t('assign')}</Button></>}{visit && <small>Visit {visit.id} · {visit.attributes.status}</small>}{!visit && <Button disabled={busy} onClick={() => void openVisit()}>Open visit</Button>}<div className="inline-actions"><Button disabled={busy || !visit} onClick={() => void execute('checkIn')}>Check in</Button><Button disabled={busy || !visit} onClick={() => void execute('start')}>Start service</Button><Button disabled={busy || !visit} onClick={() => void execute('complete')}>Complete</Button></div><AgentArtifacts providerId={providerId} jobId={job.id} t={t} /><ExecutionPanel providerId={providerId} jobId={job.id} visitId={visit?.id} agentId={selectedAgent || undefined} />{error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}</article>; }

function AgentArtifacts({ providerId, jobId, t }: { providerId: string; jobId: string; t: T }) { void t; const [note, setNote] = useState(''); const [part, setPart] = useState({ description: '', quantity: '1', unit: 'each', usage_kind: 'INSTALLED' }); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [notes, setNotes] = useState<Collection<import('./data').WorkNoteAttributes> | null>(null); const [parts, setParts] = useState<Collection<import('./data').PartUsageAttributes> | null>(null); useEffect(() => { Promise.all([operationsData.notes(providerId, jobId), operationsData.parts(providerId, jobId)]).then(([noteResult, partResult]) => { setNotes(noteResult); setParts(partResult); }).catch((cause) => setError(errorText(cause))); }, [providerId, jobId]); async function saveNote(event: FormEvent) { event.preventDefault(); try { const created = await operationsData.createNote(providerId, jobId, { text: note, visibility: 'internal', recorded_at: new Date().toISOString() }, crypto.randomUUID()); setNotes((current) => current ? { ...current, data: [created, ...current.data] } : current); setNote(''); setMessage('Internal work note saved'); } catch (cause) { setError(errorText(cause)); } } async function savePart(event: FormEvent) { event.preventDefault(); try { const created = await operationsData.recordPart(providerId, jobId, { recorded_at: new Date().toISOString(), item: part }, crypto.randomUUID()); setParts((current) => current ? { ...current, data: [created, ...current.data] } : current); setPart({ description: '', quantity: '1', unit: 'each', usage_kind: 'INSTALLED' }); setMessage('Part usage recorded'); } catch (cause) { setError(errorText(cause)); } } return <details className="agent-artifacts"><summary>Execution evidence</summary><form onSubmit={saveNote}><label>Internal work note<textarea value={note} onChange={(event) => setNote(event.target.value)} required maxLength={4000} /></label><Button disabled={!note.trim()}>Save note</Button></form><form onSubmit={savePart}><label>Part description<input value={part.description} onChange={(event) => setPart((current) => ({ ...current, description: event.target.value }))} required maxLength={200} /></label><label>Quantity<input type="number" min="0.001" step="0.001" value={part.quantity} onChange={(event) => setPart((current) => ({ ...current, quantity: event.target.value }))} required /></label><label>Unit<input value={part.unit} onChange={(event) => setPart((current) => ({ ...current, unit: event.target.value }))} required maxLength={40} /></label><Button disabled={!part.description.trim()}>Record part</Button></form>{notes?.data.slice(0, 3).map((item) => <small key={item.id}>Note: {item.attributes.text}</small>)}{parts?.data.slice(0, 3).map((item) => <small key={item.id}>Part: {item.attributes.description} · {item.attributes.quantity} {item.attributes.unit}</small>)}{error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}</details>; }

function AdminList({ section, providerId, t }: { section: Section; providerId: string; t: T }) { const { session } = useAuth(); const canManage = session ? navigationForSession(session, providerId).context?.capabilities.includes('customer_admin') === true : false; if (section === 'customers') return <CustomerOperations providerId={providerId} canManage={canManage} />; return <LegacyAdminList section={section} providerId={providerId} t={t} />; }

function LegacyAdminList({ section, providerId, t }: { section: Section; providerId: string; t: T }) { const [items, setItems] = useState<Collection<GenericAttributes> | null>(null); const [error, setError] = useState(''); const title = section === 'customers' ? 'Customers & assets' : section === 'quotations' ? 'Quotations' : section === 'configuration' ? 'Typed configuration' : section === 'workforce' ? 'Workforce' : 'Audit history'; useEffect(() => { const request = section === 'customers' ? operationsData.customers(providerId) : section === 'quotations' ? operationsData.quotations(providerId) : section === 'configuration' ? operationsData.configuration(providerId, 'asset-families') : section === 'workforce' ? Promise.all([operationsData.agentsDirectory(providerId), operationsData.teams(providerId), operationsData.skills(providerId)]).then(([agents, teams, skills]) => ({ data: [...agents.data, ...teams.data, ...skills.data] })) : operationsData.timeline(providerId); request.then(setItems).catch((cause) => setError(errorText(cause))); }, [providerId, section]); if (error) return <DataState message={error} t={t} />; if (!items) return <DataState message={t('loading')} t={t} />; return <section className="content"><div className="section-heading"><h2>{title}</h2><span>{items.data.length} / 25 bounded preview</span></div>{items.data.length === 0 ? <DataState message={t('empty')} t={t} /> : <div className="record-grid">{items.data.map((item) => <article className="record-card" key={item.id}><Status>{String(item.attributes.status || item.attributes.event_type || 'VISIBLE')}</Status><strong>{String(item.attributes.name || item.attributes.display_name || item.attributes.title || item.attributes.code || item.id)}</strong><small>{String(item.attributes.description || item.attributes.category || item.attributes.created_at || 'Authorized record')}</small></article>)}</div>}<p className="notice">Actions remain server-authorized. This view does not infer permissions from navigation or role labels.</p></section>; }
function DataState({ message, t }: { message: string; t: T }) { const forbidden = /forbidden|not permitted|permission|unauthorized|access denied/i.test(message); return <section className={`notice state-${forbidden ? 'forbidden' : 'error'}`} role={forbidden ? 'alert' : 'status'}><strong>{forbidden ? "You don't have access to this area in the selected workspace." : message}</strong>{forbidden ? <p>Switch workspace or return to the overview. Your permissions are enforced by the API.</p> : <Button onClick={() => window.location.reload()}>{t('retry')}</Button>}</section>; }

function PublicRoute() {
  const match = window.location.pathname.match(/^\/identity-domain-verifications\/([^/]+)\/?$/);
  return match ? <IdentityDomainVerificationPage token={decodeURIComponent(match[1])} /> : null;
}

function Root() {
  const publicPath = typeof window !== 'undefined' && /^\/identity-domain-verifications\/[^/]+\/?$/.test(window.location.pathname);
  return publicPath ? <PublicRoute /> : <StrictMode><AuthProvider><Shell /><AccountMenuV2 /><RouteTitleSync /></AuthProvider></StrictMode>;
}

createRoot(document.getElementById('root')!).render(<Root />);

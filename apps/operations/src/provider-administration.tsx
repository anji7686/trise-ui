import { useEffect, useState } from 'react';
import { DetailSection, PageHeader, StatePanel } from '@trise/ui';
import { accessData } from './access-data';
import { operationsData } from './data';
import { SvgIcon } from './icons';
import { OperationsStatus } from './operations-status';

type Capability = 'business_profile' | 'workforce' | 'team_access' | 'compliance' | 'subscriptions' | 'configuration';
type Metrics = { technicians?: string; compliance?: string; members?: string; usage?: string; profile?: string; profileName?: string; profileAddress?: string; errors: string[] };
type Tab = { label: string; hash: string; capability: Capability; icon: Parameters<typeof SvgIcon>[0]['name'] };

const tabs: Tab[] = [
  { label: 'Business Profile', hash: 'business-profile', capability: 'business_profile', icon: 'building' },
  { label: 'Workforce', hash: 'workforce', capability: 'workforce', icon: 'users' },
  { label: 'Team & Access', hash: 'team-access', capability: 'team_access', icon: 'settings' },
  { label: 'Compliance', hash: 'compliance', capability: 'compliance', icon: 'clipboard' },
  { label: 'Subscription', hash: 'subscriptions', capability: 'subscriptions', icon: 'grid' },
  { label: 'Notifications', hash: 'configuration/notification-policies', capability: 'configuration', icon: 'activity' },
];

function navigate(hash: string) { window.location.hash = hash; }

export function ProviderAdministrationPage({ providerId, capabilities }: { providerId: string; capabilities: string[] }) {
  const allowed = new Set(capabilities);
  const visibleTabs = tabs.filter((tab) => allowed.has(tab.capability));
  const [metrics, setMetrics] = useState<Metrics>({ errors: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setMetrics({ errors: [] });
    const jobs: Array<Promise<void>> = [];
    const next: Metrics = { errors: [] };
    const guarded = async (label: string, request: Promise<unknown>, read: (value: unknown) => string) => {
      try { const value = await request; if (current) Object.assign(next, { [label]: read(value) }); }
      catch { if (current) next.errors.push(label); }
    };
    if (allowed.has('workforce')) jobs.push(guarded('technicians', operationsData.agentsDirectory(providerId), (value) => {
      const records = (value as { data?: Array<{ attributes: Record<string, unknown> }> }).data || [];
      const active = records.filter((record) => ['ACTIVE', 'AVAILABLE', 'ON_DUTY'].includes(String(record.attributes.status || '').toUpperCase())).length;
      return `${active} active · ${records.length} shown`;
    }));
    if (allowed.has('compliance')) jobs.push(guarded('compliance', operationsData.providerComplianceRequests(providerId), (value) => {
      const records = (value as { data?: Array<{ attributes: { status?: string } }> }).data || [];
      const pending = records.filter((record) => ['SUBMITTED', 'UNDER_REVIEW', 'CORRECTIONS_REQUESTED'].includes(String(record.attributes.status || '').toUpperCase())).length;
      return `${pending} pending · ${records.length} shown`;
    }));
    if (allowed.has('team_access')) jobs.push(guarded('members', accessData.members(providerId), (value) => {
      const records = (value as { data?: unknown[] }).data || [];
      return `${records.length} members · first page`;
    }));
    if (allowed.has('subscriptions')) jobs.push(guarded('usage', operationsData.providerSubscription(providerId), (value) => {
      const result = value as { data?: { subscription?: { status?: string } | null; usage?: { metrics?: Record<string, { value?: number; limit?: { value?: number | null; unlimited?: boolean } }> } } };
      const metrics = result.data?.usage?.metrics || {};
      const assetMetric = Object.entries(metrics).find(([key]) => key.toLowerCase().includes('asset'))?.[1];
      if (assetMetric?.limit && !assetMetric.limit.unlimited && assetMetric.limit.value) return `${assetMetric.value ?? 0} of ${assetMetric.limit.value} assets`;
      return result.data?.subscription?.status ? String(result.data.subscription.status).replaceAll('_', ' ') : 'No active subscription';
    }));
    if (allowed.has('business_profile')) jobs.push(guarded('profile', operationsData.providerBusinessProfile(providerId), (value) => {
      const result = value as { data?: { verification_status?: string; profile?: { legal_name?: string; address?: Record<string, string> } } };
      if (result.data?.profile) {
        next.profileName = result.data.profile.legal_name || 'Legal name not recorded';
        const address = result.data.profile.address || {};
        next.profileAddress = [address.city, address.state].filter(Boolean).join(', ') || 'Registered address not recorded';
      }
      return result.data?.verification_status ? String(result.data.verification_status).replaceAll('_', ' ') : 'Profile status unavailable';
    }));
    void Promise.all(jobs).then(() => { if (current) { setMetrics(next); setLoading(false); } });
    return () => { current = false; };
  }, [providerId, capabilities.join('|')]);

  const cards = [
    { label: 'Active technicians', value: metrics.technicians, color: 'blue', icon: 'users' as const, to: 'workforce', capability: 'workforce' },
    { label: 'Pending compliance', value: metrics.compliance, color: 'orange', icon: 'clipboard' as const, to: 'compliance', capability: 'compliance' },
    { label: 'Team members', value: metrics.members, color: 'purple', icon: 'users' as const, to: 'team-access', capability: 'team_access' },
    { label: 'Subscription usage', value: metrics.usage, color: 'green', icon: 'grid' as const, to: 'subscriptions', capability: 'subscriptions' },
  ].filter((card) => allowed.has(card.capability));

  if (!visibleTabs.length) return <StatePanel title="Administration unavailable">No administration capabilities are available in the selected provider context.</StatePanel>;

  return <section className="provider-administration-page">
    <PageHeader eyebrow="Provider administration" title="Administration" description="Manage business profile, workforce, compliance, team access and subscription visibility." />
    <div className="provider-admin-kpis" aria-label="Provider administration summary">
      {cards.map((card) => <button type="button" className={`provider-admin-kpi ${card.color}`} key={card.label} onClick={() => navigate(card.to)}>
        <span className="provider-admin-kpi-icon"><SvgIcon name={card.icon} size={22} /></span><span className="provider-admin-kpi-copy"><span>{card.label}</span><strong>{loading ? 'Loading…' : card.value || 'Unavailable'}</strong>{card.label === 'Pending compliance' && !loading && <small>Server-reported requests</small>}</span>
      </button>)}
    </div>
    <nav className="provider-admin-tabs" aria-label="Administration sections">
      {visibleTabs.map((tab) => <button key={tab.hash} type="button" onClick={() => navigate(tab.hash)}><SvgIcon name={tab.icon} size={18} /><span>{tab.label}</span></button>)}
    </nav>
    {metrics.errors.length > 0 && <p className="provider-admin-data-note" role="status">Some summary data is unavailable under the current API response. Each linked workspace continues to enforce its own permissions.</p>}
    <div className="provider-admin-overview-grid">
      {allowed.has('business_profile') && <DetailSection title="Company Details" description="Provider identity and verification status from the current profile revision."><dl className="provider-admin-facts"><dt>Legal name</dt><dd>{loading ? 'Loading…' : metrics.profileName || 'Unavailable'}</dd><dt>Registered address</dt><dd>{loading ? 'Loading…' : metrics.profileAddress || 'Unavailable'}</dd><dt>Verification</dt><dd><OperationsStatus>{loading ? 'Loading' : metrics.errors.includes('profile') ? 'Unavailable' : metrics.profile || 'Not submitted'}</OperationsStatus></dd></dl><button className="provider-admin-link" type="button" onClick={() => navigate('business-profile')}>Review business profile <span aria-hidden="true">→</span></button></DetailSection>}
      {allowed.has('team_access') && <DetailSection title="Team & Access" description="Manage provider membership and role assignments using the authorized access workspace."><p>{metrics.members || 'Membership summary is loading.'}. Role changes remain revision-checked and server-authorized.</p><button className="provider-admin-link" type="button" onClick={() => navigate('team-access')}>Open team access <span aria-hidden="true">→</span></button></DetailSection>}
      {allowed.has('compliance') && <DetailSection title="Compliance" description="Track provider evidence, requirements and platform decisions."><p>{metrics.compliance || 'Compliance summary is loading.'}. Operational eligibility and legal-profile review remain separate decisions.</p><button className="provider-admin-link" type="button" onClick={() => navigate('compliance')}>Open compliance center <span aria-hidden="true">→</span></button></DetailSection>}
      {allowed.has('configuration') && <DetailSection title="Notifications" description="Edit notification policies, templates and triggers returned by provider configuration APIs."><p>Mandatory transactional policy restrictions are enforced by the server.</p><button className="provider-admin-link" type="button" onClick={() => navigate('configuration/notification-policies')}>Manage notification policies <span aria-hidden="true">→</span></button></DetailSection>}
    </div>
  </section>;
}

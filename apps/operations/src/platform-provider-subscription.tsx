import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { Button, DetailSection, StatePanel, Status } from '@trise/ui';
import { operationsData, type PlatformPlan, type PlatformPlanVersion, type PlatformSubscription, type PlatformSubscriptionRequest, type PlatformUsage, type Resource } from './data';

const human = (value?: string) => value ? value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not available';
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString() : 'No fixed end date';
const metricLabel = (key: string) => key === 'MANAGED_ASSET_COUNT' ? 'Managed assets' : key === 'AGENT_COUNT' ? 'Active agents' : human(key);
const errorText = (error: unknown) => (error as { message?: string })?.message || 'Subscription information could not be loaded.';

type PlanChoice = { plan: Resource<PlatformPlan>; version: Resource<PlatformPlanVersion>; text: string };

function versions(plans: Resource<PlatformPlan>[]): PlanChoice[] {
  return plans.flatMap((plan) => (plan.attributes.versions || (plan.attributes.latest_version ? [plan.attributes.latest_version] : []))
    .filter((version) => version.attributes.status === 'PUBLISHED')
    .map((version) => ({ plan, version, text: `${plan.attributes.name} · v${version.attributes.version_number} · ${version.attributes.currency_code} ${Number(version.attributes.price_amount).toLocaleString('en-IN')} / ${human(version.attributes.billing_interval)}` })));
}

function Terms({ version, snapshot }: { version?: Resource<PlatformPlanVersion>; snapshot?: PlatformSubscription['commercial_snapshot'] }) {
  const terms = version?.attributes;
  const limits = terms?.limits || snapshot?.limits || [];
  const features = terms?.included_features || [];
  return <>
    <dl className="platform-definition-list">
      <dt>Price</dt><dd>{(terms?.currency_code || snapshot?.currency_code) ?? '—'} {Number(terms?.price_amount || snapshot?.price_amount || 0).toLocaleString('en-IN')} / {human(terms?.billing_interval || snapshot?.billing_interval)}</dd>
      <dt>Tax treatment</dt><dd>{human(terms?.tax_treatment)}</dd>
      <dt>Industry applicability</dt><dd>{terms?.industry_keys?.map(human).join(', ') || 'Accepted subscription terms'}</dd>
    </dl>
    <div className="subscription-limit-grid">{limits.map((limit) => <article key={limit.metric_key}><span>{metricLabel(limit.metric_key)}</span><strong>{limit.unlimited ? 'Unlimited' : limit.value ?? 0}</strong><small>Included limit</small></article>)}</div>
    {features.length > 0 && <p className="platform-muted">Included features: {features.map(human).join(', ')}</p>}
  </>;
}

function Usage({ usage }: { usage: PlatformUsage | null }) {
  if (!usage) return <p className="platform-muted">Usage is available after an active subscription is established.</p>;
  return <div className="subscription-limit-grid">{Object.entries(usage.metrics).map(([key, metric]) => <article key={key}><span>{metricLabel(key)}</span><strong>{metric.value}</strong><small>{metric.limit?.unlimited ? 'Unlimited allowance' : metric.limit ? `${metric.remaining ?? 0} remaining of ${metric.limit.value}` : 'No active limit'}{metric.exceeded ? ' · Limit exceeded' : ''}</small></article>)}</div>;
}

export function PlatformProviderSubscription({ providerId, capabilities, onboarding = false }: { providerId: string; capabilities: string[]; onboarding?: boolean }) {
  const listId = useId();
  const [plans, setPlans] = useState<Resource<PlatformPlan>[]>([]);
  const [subscription, setSubscription] = useState<Resource<PlatformSubscription> | null>(null);
  const [requests, setRequests] = useState<Resource<PlatformSubscriptionRequest>[]>([]);
  const [usage, setUsage] = useState<PlatformUsage | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [search, setSearch] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date(Date.now() + 60_000).toISOString().slice(0, 16));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const choices = useMemo(() => versions(plans), [plans]);
  const filteredChoices = choices.filter((choice) => choice.text.toLowerCase().includes(search.trim().toLowerCase()));
  const currentChoice = subscription ? choices.find((choice) => choice.version.id === subscription.attributes.plan_version_id) : undefined;
  const currentRequest = requests.find((request) => ['PENDING_REVIEW', 'APPROVED'].includes(request.attributes.status));

  async function load() {
    if (!capabilities.includes('PLATFORM_SUBSCRIPTION_READ') || !capabilities.includes('PLATFORM_PLAN_READ')) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const [planPage, subscriptionPage, requestPage] = await Promise.all([operationsData.platformPlans({ status: 'ACTIVE' }), operationsData.platformSubscriptions(), operationsData.platformSubscriptionRequests()]);
      const current = subscriptionPage.data.find((item) => item.attributes.provider_id === providerId) || null;
      setPlans(planPage.data); setSubscription(current); setRequests(requestPage.data.filter((item) => item.attributes.provider_id === providerId));
      if (current && capabilities.includes('PLATFORM_SUBSCRIPTION_USAGE_READ')) {
        try { setUsage((await operationsData.platformSubscriptionUsage(providerId)).data); } catch { setUsage(current.attributes.usage || null); }
      } else setUsage(current?.attributes.usage || null);
    } catch (cause) { setError(errorText(cause)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [providerId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedVersionId) { setError('Select a published plan returned by the API.'); return; }
    setBusy(true); setError('');
    try {
      await operationsData.createPlatformSubscriptionRequest(providerId, { plan_version_id: selectedVersionId, requested_effective_from: new Date(effectiveFrom).toISOString(), note: 'Selected during provider onboarding' }, crypto.randomUUID());
      setSelectedVersionId(''); setSearch(''); await load();
    } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }

  if (!capabilities.includes('PLATFORM_SUBSCRIPTION_READ') || !capabilities.includes('PLATFORM_PLAN_READ')) return <DetailSection title="Provider subscription"><p className="platform-muted">Subscription details require the platform plan and subscription read capabilities.</p></DetailSection>;
  if (loading) return <StatePanel title="Loading provider subscription">Retrieving plan terms, limits, usage, and approval state…</StatePanel>;
  return <div className="platform-detail-stack">
    {error && <StatePanel title="Subscription action needs attention"><span>{error}</span></StatePanel>}
    <DetailSection title="Subscribed plan" description="The accepted terms, lifecycle and validity window are authoritative subscription records, separate from provider operational activation.">
      {subscription ? <><dl className="platform-definition-list"><dt>Plan</dt><dd>{currentChoice ? `${currentChoice.plan.attributes.name} · v${currentChoice.version.attributes.version_number}` : subscription.attributes.plan_version_id}</dd><dt>Subscription status</dt><dd><Status>{human(subscription.attributes.status)}</Status></dd><dt>Approval</dt><dd><Status>{human(subscription.attributes.approval_state)}</Status></dd><dt>Payment evidence</dt><dd><Status>{human(subscription.attributes.payment_state)}</Status></dd><dt>Valid from</dt><dd>{dateTime(subscription.attributes.effective_from)}</dd><dt>Valid until / expiry</dt><dd>{dateTime(subscription.attributes.effective_to)}</dd></dl><Terms version={currentChoice?.version} snapshot={subscription.attributes.commercial_snapshot} /></> : <p className="platform-muted">No active provider subscription has been established.</p>}
    </DetailSection>
    {subscription?.attributes.validity && <DetailSection title="Validity and reminders" description="The API calculates the exclusive end date and reminder milestones from the accepted plan duration."><dl className="platform-definition-list"><dt>Validity</dt><dd><Status>{human(subscription.attributes.validity.state)}</Status></dd><dt>Time remaining</dt><dd>{subscription.attributes.validity.remaining_days} days · {subscription.attributes.validity.remaining_weeks} weeks</dd><dt>Next reminder</dt><dd>{subscription.attributes.validity.next_reminder ? `${human(subscription.attributes.validity.next_reminder.kind)} · ${dateTime(subscription.attributes.validity.next_reminder.due_at)}` : 'No reminder remaining'}</dd></dl><ul className="platform-audit-list">{subscription.attributes.validity.reminders.map((reminder) => <li key={`${reminder.kind}-${reminder.due_at}`}><div><strong>{human(reminder.kind)}</strong><small>{human(reminder.state)}</small></div><span>{dateTime(reminder.due_at)}</span></li>)}</ul></DetailSection>}
    <DetailSection title="Installed capacity and limitations" description="Managed assets are deduplicated across installation and active AMC scope. Active agents are counted separately."><Usage usage={usage} /></DetailSection>
    <DetailSection title="Subscription approval status" description="Plan selection creates a request only. Review, payment verification, subscription activation, and provider operational activation remain separate audited decisions.">
      {requests.length ? <div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Plan</th><th>Status</th><th>Requested validity</th></tr></thead><tbody>{requests.map((request) => { const choice = choices.find((item) => item.version.id === request.attributes.plan_version_id); return <tr key={request.id}><td>{choice ? `${choice.plan.attributes.name} · v${choice.version.attributes.version_number}` : request.attributes.plan_version_id}</td><td><Status>{human(request.attributes.status)}</Status></td><td>{dateTime(request.attributes.requested_effective_from)}</td></tr>; })}</tbody></table></div> : <p className="platform-muted">No subscription approval request has been submitted.</p>}
    </DetailSection>
    {onboarding && capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && !subscription && !currentRequest && <DetailSection title="Select plan and submit for approval" description="Choose one published plan from the API catalogue. This submission does not approve or activate the subscription.">
      <div className="subscription-plan-grid">{choices.map((choice) => <article className={selectedVersionId === choice.version.id ? 'selected' : ''} key={choice.version.id}><Status>{choice.plan.attributes.code}</Status><h3>{choice.plan.attributes.name}</h3><strong className="plan-price">{choice.version.attributes.currency_code} {Number(choice.version.attributes.price_amount).toLocaleString('en-IN')}</strong><p>per {human(choice.version.attributes.billing_interval)} · {human(choice.version.attributes.tax_treatment)}</p><Terms version={choice.version} /><Button variant={selectedVersionId === choice.version.id ? 'primary' : 'secondary'} onClick={() => { setSelectedVersionId(choice.version.id); setSearch(choice.text); }}>{selectedVersionId === choice.version.id ? 'Selected' : 'Select plan'}</Button></article>)}</div>
      <form className="platform-filter-toolbar subscription-request-form" onSubmit={submit}><label className="subscription-combobox">Published plan<input type="search" list={listId} required pattern={selectedVersionId ? search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '(?!)'} value={search} onChange={(event) => { const value = event.target.value; setSearch(value); setSelectedVersionId(choices.find((choice) => choice.text === value)?.version.id || ''); }} placeholder="Search and select a published plan" autoComplete="off" /><datalist id={listId}>{filteredChoices.map((choice) => <option key={choice.version.id} value={choice.text} />)}</datalist><small>One searchable input stores the selected plan version ID.</small></label><label>Requested effective from<input required type="datetime-local" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /></label><Button type="submit" busy={busy} disabled={busy || !selectedVersionId}>Submit plan for approval</Button></form>
    </DetailSection>}
  </div>;
}

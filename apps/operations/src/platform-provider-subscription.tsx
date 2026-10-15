import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Button, DetailSection, StatePanel } from '@trise/ui';
import { OperationsDialog } from './operations-dialog';
import { OperationsStatus as Status } from './operations-status';
import { applicablePlanChoices, collectPages, localDateTime, RequestGeneration } from './subscription-support';
import { useSubscriptionActions } from './use-subscription-actions';
import { subscriptionNextStep } from './subscription-workflow';
import { SubscriptionAlerts, SubscriptionTimeline } from './subscription-insights';
import { operationsData, type PlatformPlan, type PlatformPlanVersion, type PlatformSubscription, type PlatformSubscriptionRequest, type PlatformSubscriptionChange, type PlatformSubscriptionInvoice, type PlatformUsage, type ProviderOperation, type Resource } from './data';
import { SearchableSelect } from './searchable-select';

const human = (value?: string) => value === 'FOURTEEN_DAYS' ? '14 days' : value ? value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not available';
const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString() : 'No fixed end date';
const metricLabel = (key: string) => key === 'MANAGED_ASSET_COUNT' ? 'Managed assets' : key === 'AGENT_COUNT' ? 'Active agents' : human(key);
const errorText = (error: unknown) => (error as { message?: string })?.message || 'Subscription information could not be loaded.';

function Terms({ version, snapshot, showPrice = true }: { version?: Resource<PlatformPlanVersion>; snapshot?: PlatformSubscription['commercial_snapshot']; showPrice?: boolean }) {
  const terms = version?.attributes;
  const limits = snapshot?.limits || terms?.limits || [];
  const amount = snapshot?.price_amount ?? terms?.price_amount;
  const currency = snapshot?.currency_code ?? terms?.currency_code;
  const interval = snapshot?.billing_interval ?? terms?.billing_interval;
  const features = terms?.included_features || [];
  return <>
    <dl className="platform-definition-list">
      {showPrice && <><dt>Price</dt><dd>{amount !== undefined && currency ? Number(amount) === 0 ? `Free · ${human(interval)} demonstration` : `${currency} ${Number(amount).toLocaleString('en-IN')} / ${human(interval)}` : 'Not available'}</dd></>}
      <dt>Tax treatment</dt><dd>{Number(amount) === 0 ? 'No charge for this plan' : human(terms?.tax_treatment)}</dd>
      <dt>Industry</dt><dd>{terms?.industry_keys?.map(human).join(', ') || 'Not specified'}</dd>
      <dt>Business Operation applicability</dt><dd>{terms?.business_operation_type_ids?.length ? `${terms.business_operation_type_ids.length} configured operation${terms.business_operation_type_ids.length === 1 ? '' : 's'}` : 'Not specified in this accepted snapshot'}</dd>
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
  const [plans, setPlans] = useState<Resource<PlatformPlan>[]>([]);
  const [providerOperations, setProviderOperations] = useState<ProviderOperation[]>([]);
  const [acceptedRequestIds, setAcceptedRequestIds] = useState<string[]>([]);
  const [subscription, setSubscription] = useState<Resource<PlatformSubscription> | null>(null);
  const [requests, setRequests] = useState<Resource<PlatformSubscriptionRequest>[]>([]);
  const [changes, setChanges] = useState<Resource<PlatformSubscriptionChange>[]>([]);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState('');
  const [timelineSubscription, setTimelineSubscription] = useState<Resource<PlatformSubscription> | null>(null);
  const [timelineRequests, setTimelineRequests] = useState<Resource<PlatformSubscriptionRequest>[]>([]);
  const [timelineChanges, setTimelineChanges] = useState<Resource<PlatformSubscriptionChange>[]>([]);
  const [timelineInvoices, setTimelineInvoices] = useState<Resource<PlatformSubscriptionInvoice>[]>([]);
  const reads = useRef(new RequestGeneration());
  const timelineReads = useRef(new RequestGeneration());
  const { busy, error, setError, run } = useSubscriptionActions(providerId);
  const [usage, setUsage] = useState<PlatformUsage | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [search, setSearch] = useState('');
  const [changeVersionId, setChangeVersionId] = useState('');
  const [changeSearch, setChangeSearch] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(() => localDateTime(new Date(Date.now() + 60_000)));
  const [loading, setLoading] = useState(true);
  const choices = useMemo(() => applicablePlanChoices(plans, providerOperations), [plans, providerOperations]);
  const defaultChoice = choices.find((choice) => choice.plan.attributes.onboarding_default === true);
  const planVersionLabels = useMemo(() => new Map(plans.flatMap(plan => (plan.attributes.versions || (plan.attributes.latest_version ? [plan.attributes.latest_version] : [])).map(version => [version.id, `${plan.attributes.name} · v${version.attributes.version_number}`] as const))), [plans]);
  const planVersionLabel = (id: string) => planVersionLabels.get(id) || 'Plan details unavailable';
  const currentChoice = subscription ? choices.find((choice) => choice.version.id === subscription.attributes.plan_version_id) : undefined;
  const upgradeChoices = choices.filter((choice) => choice.version.id !== subscription?.attributes.plan_version_id);
  const upgradeOptions = upgradeChoices.map((choice) => ({ id: choice.version.id, label: `${choice.plan.attributes.name} · v${choice.version.attributes.version_number}`, detail: `${choice.version.attributes.currency_code} ${Number(choice.version.attributes.price_amount).toLocaleString('en-IN')} / ${human(choice.version.attributes.billing_interval)}` }));
  const selectedUpgrade = upgradeChoices.find((choice) => choice.version.id === changeVersionId);
  const planOptions = choices.map((choice) => ({ id: choice.version.id, label: `${choice.plan.attributes.name} · v${choice.version.attributes.version_number}`, detail: `${choice.version.attributes.currency_code} ${Number(choice.version.attributes.price_amount).toLocaleString('en-IN')} / ${human(choice.version.attributes.billing_interval)}` }));
  const selectedChoice = choices.find((choice) => choice.version.id === selectedVersionId);
  const currentRequest = requests.find((request) => request.attributes.status === 'PENDING_REVIEW' || (request.attributes.status === 'APPROVED' && !acceptedRequestIds.includes(request.id)));
  const openUpgrade = changes.find((change) => change.attributes.change_kind === 'UPGRADE' && ['PENDING_REVIEW', 'APPROVED', 'SCHEDULED'].includes(change.attributes.status));

  async function openTimeline() {
    setTimelineOpen(true); setTimelineLoading(true); setTimelineError('');
    const valid = timelineReads.current.next();
    try {
      const [subscriptionResult, requestRows, changeRows, invoiceRows] = await Promise.all([
        subscription ? operationsData.platformSubscription(subscription.id).then((result) => result.data) : Promise.resolve(null),
        collectPages((after) => operationsData.platformSubscriptionRequests({ providerId, after }), valid),
        collectPages((after) => operationsData.platformSubscriptionChanges({ providerId, after }), valid),
        collectPages((after) => operationsData.platformSubscriptionInvoices({ providerId, after }), valid)
      ]);
      if (!valid()) return;
      const detailedRequests = await Promise.all(requestRows.map((request) => operationsData.platformSubscriptionRequest(request.id).then((result) => result.data)));
      if (!valid()) return;
      setTimelineSubscription(subscriptionResult);
      setTimelineRequests(detailedRequests);
      setTimelineChanges(changeRows);
      setTimelineInvoices(invoiceRows);
      setChanges(changeRows);
    } catch (cause) {
      if (valid()) setTimelineError(errorText(cause));
    } finally {
      if (valid()) setTimelineLoading(false);
    }
  }

  function closeTimeline() {
    timelineReads.current.invalidate();
    setTimelineOpen(false);
  }

  async function load() {
    const valid = reads.current.next(); timelineReads.current.invalidate();
    if (!capabilities.includes('PLATFORM_SUBSCRIPTION_READ') || !capabilities.includes('PLATFORM_PLAN_READ')) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const operationResponse = await operationsData.platformProviderOperations(providerId);
      if (!valid()) return;
      const activeOperations = operationResponse.data.filter((row) => row.attributes.status === 'ACTIVE');
      const operationIds = [...new Set(activeOperations.map((row) => row.attributes.business_operation.id))];
      const [operationPlans, subscriptions, providerRequests, changePage] = await Promise.all([
        Promise.all(operationIds.map((businessOperationId) => collectPages((after) => operationsData.platformPlans({ status: 'ACTIVE', businessOperationId, after }), valid)))
          .then((pages) => [...new Map(pages.flat().map((plan) => [plan.id, plan])).values()]),
        collectPages((after) => operationsData.platformSubscriptions({ providerId, after }), valid),
        collectPages((after) => operationsData.platformSubscriptionRequests({ providerId, after }), valid),
        operationsData.platformSubscriptionChanges({ providerId })
      ]);
      if (!valid()) return;
      const current = subscriptions.find((item) => item.attributes.status === 'ACTIVE') || subscriptions[0] || null;
      let observedUsage = current?.attributes.usage || null;
      if (current && capabilities.includes('PLATFORM_SUBSCRIPTION_USAGE_READ')) observedUsage = (await operationsData.platformSubscriptionUsage(providerId)).data;
      const subscriptionRequestIds = subscriptions.flatMap((item) => item.attributes.request_id ? [item.attributes.request_id] : []);
      const acceptedIds = new Set(subscriptionRequestIds);
      const accepted = providerRequests.find(item => ['PENDING_REVIEW', 'APPROVED'].includes(item.attributes.status) && !acceptedIds.has(item.id)) || (current ? providerRequests.find(item => item.id === current.attributes.request_id) : undefined) || providerRequests[0];
      const detailed = accepted ? (await operationsData.platformSubscriptionRequest(accepted.id)).data : undefined;
      if (!valid()) return;
      setProviderOperations(activeOperations); setPlans(operationPlans); setSubscription(current); setAcceptedRequestIds(subscriptionRequestIds);
      setRequests(providerRequests.map((item) => item.id === detailed?.id ? detailed : item));
      setUsage(observedUsage); setChanges(changePage.data);
    } catch (cause) { if (valid()) setError(errorText(cause)); } finally { if (valid()) setLoading(false); }
  }

  useEffect(() => {
    if (onboarding && !subscription && !currentRequest && !selectedVersionId && defaultChoice) {
      setSelectedVersionId(defaultChoice.version.id);
    }
  }, [onboarding, subscription, currentRequest, selectedVersionId, defaultChoice]);
  const canReadPlans = capabilities.includes('PLATFORM_PLAN_READ');
  const canReadSubscription = capabilities.includes('PLATFORM_SUBSCRIPTION_READ');
  const canReadUsage = capabilities.includes('PLATFORM_SUBSCRIPTION_USAGE_READ');
  useEffect(() => {
    setPlans([]); setProviderOperations([]); setSubscription(null); setAcceptedRequestIds([]); setRequests([]); setUsage(null); setChanges([]);
    setSelectedVersionId(''); setSearch(''); setEffectiveFrom(localDateTime(new Date(Date.now() + 60_000)));
    setChangeVersionId(''); setChangeSearch('');
    void load();
    const generation = reads.current;
    return () => { generation.invalidate(); timelineReads.current.invalidate(); };
  }, [providerId, canReadPlans, canReadSubscription, canReadUsage]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (onboarding && selectedChoice?.plan.attributes.onboarding_default) return;
    if (!selectedVersionId) { setError('Select a published plan returned by the API.'); return; }
    const body = { plan_version_id: selectedVersionId, requested_effective_from: new Date(effectiveFrom).toISOString(), note: onboarding ? 'Selected during provider onboarding' : 'Selected during provider management' };
    await run(JSON.stringify([providerId, body]), (key) => operationsData.createPlatformSubscriptionRequest(providerId, body, key), async () => {
      setSelectedVersionId(''); setSearch(''); await load();
    });
  }

  async function requestUpgrade(event: FormEvent) {
    event.preventDefault();
    if (!subscription || !changeVersionId) { setError('Select a published target plan before requesting an upgrade.'); return; }
    if (subscription.attributes.status !== 'ACTIVE') { setError('An upgrade can only be requested for an active subscription.'); return; }
    const body = { change_kind: 'UPGRADE', plan_version_id: changeVersionId, expected_revision: subscription.attributes.revision };
    await run(JSON.stringify(['upgrade', subscription.id, body]), (key) => operationsData.createPlatformSubscriptionChange(subscription.id, body, key), async () => {
      setChangeVersionId(''); setChangeSearch(''); await load();
    });
  }

  if (!capabilities.includes('PLATFORM_SUBSCRIPTION_READ') || !capabilities.includes('PLATFORM_PLAN_READ')) return <DetailSection title="Provider subscription"><p className="platform-muted">Subscription details require the platform plan and subscription read capabilities.</p></DetailSection>;
  if (error && !subscription) return <StatePanel title="Subscription unavailable"><span>{error}</span><Button onClick={() => void load()}>Retry</Button></StatePanel>;
  if (loading) return <StatePanel title="Loading provider subscription">Retrieving plan terms, limits, usage, and approval state…</StatePanel>;
  return <div className="platform-detail-stack">
    <details className="provider-subscription-advanced" open={!subscription && !currentRequest}>
      <summary>Available plans and request options</summary>
    <DetailSection title="Available published plans" description="Plans are filtered by the provider’s active Business Operations. A provider keeps one subscription account; a plan must match at least one enabled operation. The server rechecks eligibility at submission.">
      {providerOperations.length > 0 && <p className="platform-form-note">Matching provider operations: {providerOperations.map((operation) => operation.attributes.business_operation.name).join(', ')}</p>}
      {choices.length ? <div className="provider-published-plan-grid">{choices.map((choice) => <article className={`provider-published-plan${selectedVersionId === choice.version.id ? ' is-selected' : ''}`} key={choice.version.id}>
        <div className="provider-published-plan-heading"><div><small>{choice.plan.attributes.code || 'PUBLISHED PLAN'}{choice.plan.attributes.onboarding_default ? ' · DEMONSTRATION DEFAULT' : ''}</small><h3>{choice.plan.attributes.name}</h3></div>{selectedVersionId === choice.version.id && <Status>Selected</Status>}</div>
        <p className="provider-published-plan-price">{choice.version.attributes.currency_code} {Number(choice.version.attributes.price_amount).toLocaleString('en-IN')} <small>/ {human(choice.version.attributes.billing_interval)}</small></p>
        <p className="provider-published-plan-version">Version {choice.version.attributes.version_number}</p>
        <p className="platform-form-note">Matches: {choice.matchingOperations.join(', ')}</p>
        <Terms version={choice.version} showPrice={false} />
        {capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && !subscription && !currentRequest && <Button type="button" variant={selectedVersionId === choice.version.id ? 'secondary' : 'quiet'} onClick={() => setSelectedVersionId(choice.version.id)}>{selectedVersionId === choice.version.id ? 'Selected plan' : 'Select plan'}</Button>}
      </article>)}</div> : <p className="platform-muted">{providerOperations.length ? 'No published plans match this provider’s active Business Operations.' : 'Configure at least one active Business Operation for this provider before choosing a matching subscription plan.'}</p>}
    </DetailSection>
    </details>
    {error && <StatePanel title="Subscription action needs attention"><span>{error}</span></StatePanel>}
    <DetailSection title="Next subscription action" description="Guidance from loaded records; the backend remains authoritative."><p>{subscriptionNextStep(subscription, currentRequest || requests.find(request => !acceptedRequestIds.includes(request.id)))}</p></DetailSection>
    <SubscriptionAlerts validity={subscription?.attributes.validity} usage={usage} />
    <DetailSection title="Subscribed plan" description="The accepted terms, lifecycle and validity window are authoritative subscription records, separate from provider operational activation.">
      {subscription ? <div className="platform-subscribed-plan">
        <div className="platform-subscribed-plan-heading"><div><span>{currentChoice?.plan.attributes.code || 'ACCEPTED PLAN'}</span><h3>{currentChoice ? currentChoice.plan.attributes.name : planVersionLabel(subscription.attributes.plan_version_id)}</h3><small>{currentChoice ? `Version ${currentChoice.version.attributes.version_number}` : 'Accepted commercial version'}</small></div><Status>{human(subscription.attributes.status)}</Status></div>
        <div className="platform-subscribed-plan-price"><small>Accepted price</small><strong>{subscription.attributes.commercial_snapshot.currency_code || '—'} {Number(subscription.attributes.commercial_snapshot.price_amount || 0).toLocaleString('en-IN')}</strong><span>per {human(subscription.attributes.commercial_snapshot.billing_interval)}</span></div>
        <div className="platform-subscribed-plan-facts"><div><span>Approval</span><Status>{human(subscription.attributes.approval_state)}</Status></div><div><span>Payment evidence</span><Status>{human(subscription.attributes.payment_state)}</Status></div><div><span>Valid from</span><strong>{dateTime(subscription.attributes.effective_from)}</strong></div><div><span>Valid until</span><strong>{dateTime(subscription.attributes.effective_to)}</strong></div></div>
        <div className="platform-subscribed-plan-terms"><h4>Included terms</h4><Terms version={currentChoice?.version} snapshot={subscription.attributes.commercial_snapshot} showPrice={false} /></div>
        <div className="platform-form-actions"><Button variant="secondary" onClick={() => void openTimeline()}>View subscription timeline</Button></div>
      </div> : <div className="platform-subscribed-plan-empty"><strong>No subscription plan is active for this provider.</strong><span>{currentRequest ? 'A subscription plan request is already awaiting completion.' : 'Choose a published plan below to request subscription approval.'}</span></div>}
    </DetailSection>
    {subscription?.attributes.validity && <DetailSection title="Validity" description="Validity is calculated from the accepted plan duration."><dl className="platform-definition-list"><dt>Status</dt><dd><Status>{human(subscription.attributes.validity.state)}</Status></dd><dt>Time remaining</dt><dd>{subscription.attributes.validity.remaining_days} days</dd></dl></DetailSection>}
    {subscription && capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && <DetailSection title={openUpgrade ? 'Upgrade request' : 'Upgrade subscription'} description={openUpgrade ? 'An upgrade request is already open for this subscription.' : 'Request an upgrade to a published plan. Review, verified payment evidence, and eligibility checks remain separate audited steps.'}>
      {openUpgrade ? <dl className="platform-definition-list"><dt>Request status</dt><dd><Status>{human(openUpgrade.attributes.status)}</Status></dd><dt>Current plan</dt><dd>{planVersionLabel(openUpgrade.attributes.from_plan_version_id)}</dd><dt>Requested plan</dt><dd>{openUpgrade.attributes.to_plan_version_id ? planVersionLabel(openUpgrade.attributes.to_plan_version_id) : 'Not available'}</dd><dt>Requested effective</dt><dd>{dateTime(openUpgrade.attributes.requested_effective_at)}</dd>{openUpgrade.attributes.effective_at && <><dt>Effective at</dt><dd>{dateTime(openUpgrade.attributes.effective_at)}</dd></>}</dl> : <>
      {subscription.attributes.status !== 'ACTIVE' ? <p className="platform-muted">Plan upgrades are available when the subscription is active.</p> : upgradeChoices.length === 0 ? <p className="platform-muted">No other published plans are available to select.</p> : <>
        <dl className="platform-definition-list"><dt>Current plan price</dt><dd>{subscription.attributes.commercial_snapshot.currency_code} {Number(subscription.attributes.commercial_snapshot.price_amount).toLocaleString('en-IN')} / {human(subscription.attributes.commercial_snapshot.billing_interval)}</dd><dt>Remaining validity</dt><dd>{subscription.attributes.validity?.remaining_days ?? 'Not available'} days</dd><dt>Selected target price</dt><dd>{selectedUpgrade ? `${selectedUpgrade.version.attributes.currency_code} ${Number(selectedUpgrade.version.attributes.price_amount).toLocaleString('en-IN')} / ${human(selectedUpgrade.version.attributes.billing_interval)}` : 'Select a target plan to view its published price'}</dd></dl>
        <form className="platform-filter-toolbar" onSubmit={requestUpgrade}><SearchableSelect disabled={busy} label="Published target plan" searchLabel="Search plans" search={changeSearch} onSearch={setChangeSearch} value={changeVersionId} onChange={setChangeVersionId} options={upgradeOptions} placeholder="Select a target plan" /><Button type="submit" busy={busy} disabled={busy || !changeVersionId}>Request upgrade</Button></form>
        <p className="platform-muted">The selected plan’s published price is shown for comparison. The server validates commercial terms and payment eligibility; this request does not enter a proration or remaining-time credit amount.</p>
      </>}
    </>}</DetailSection>}
    <DetailSection title="Installed capacity and limitations" description="Managed assets are deduplicated across installation and active AMC scope. Active agents are counted separately."><Usage usage={usage} /></DetailSection>
    <DetailSection title="Subscription approval status" description="Plan selection creates a request only. Review, payment verification, subscription activation, and provider operational activation remain separate audited decisions.">
      {requests.length ? <div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Plan</th><th>Status</th><th>Requested validity</th></tr></thead><tbody>{requests.map((request) => { const choice = choices.find((item) => item.version.id === request.attributes.plan_version_id); return <tr key={request.id}><td>{choice ? `${choice.plan.attributes.name} · v${choice.version.attributes.version_number}` : planVersionLabel(request.attributes.plan_version_id)}</td><td><Status>{human(request.attributes.status)}</Status></td><td>{dateTime(request.attributes.requested_effective_from)}</td></tr>; })}</tbody></table></div> : <p className="platform-muted">No subscription approval request has been submitted.</p>}
    </DetailSection>
    {capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && !subscription && <DetailSection title={currentRequest ? 'Subscription request' : onboarding && selectedChoice?.plan.attributes.onboarding_default ? 'Default demonstration plan' : 'Request a subscription plan'} description={currentRequest ? 'A request is already open. Review and payment verification remain separate audited decisions.' : onboarding && selectedChoice?.plan.attributes.onboarding_default ? 'The platform demonstration plan is selected by default and will be assigned by the API after provider activation. Its 14-day validity starts from business verification.' : 'Choose a published plan and submit it for approval. This request does not approve or activate the subscription.'}>
      {currentRequest ? <dl className="platform-definition-list"><dt>Requested plan</dt><dd>{planVersionLabel(currentRequest.attributes.plan_version_id)}</dd><dt>Request status</dt><dd><Status>{human(currentRequest.attributes.status)}</Status></dd><dt>Requested start</dt><dd>{dateTime(currentRequest.attributes.requested_effective_from)}</dd></dl> : choices.length ? <><form className="platform-filter-toolbar subscription-request-form" onSubmit={submit}><SearchableSelect disabled={busy} label="Published plan" searchLabel="Search plans" search={search} onSearch={setSearch} value={selectedVersionId} onChange={setSelectedVersionId} options={planOptions} placeholder="Select a published plan" />{!(onboarding && selectedChoice?.plan.attributes.onboarding_default) && <><label>Requested effective from<input disabled={busy} required type="datetime-local" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /></label><Button type="submit" busy={busy} disabled={busy || !selectedVersionId}>Submit specific plan for approval</Button></>}</form>{onboarding && selectedChoice?.plan.attributes.onboarding_default && <p className="platform-form-note" role="status">Selected by default. The API assigns this plan only after provider activation; a different plan can be selected and submitted for its normal review.</p>}{selectedChoice && <Terms version={selectedChoice.version} />}</> : <p className="platform-muted">No published plans are available to request.</p>}
    </DetailSection>}
    {timelineOpen && <OperationsDialog title="Subscription timeline" onClose={closeTimeline}>{timelineLoading ? <StatePanel title="Loading subscription timeline">Fetching provider subscription history…</StatePanel> : timelineError ? <StatePanel title="Timeline unavailable"><span>{timelineError}</span><Button onClick={() => void openTimeline()}>Retry</Button></StatePanel> : <SubscriptionTimeline subscription={timelineSubscription} requests={timelineRequests} changes={timelineChanges} invoices={timelineInvoices} />}</OperationsDialog>}
  </div>;
}

import { EvidenceReviewFeedback } from './subscription-review';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button, DetailSection, PageHeader, StatePanel } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { formatIndiaDate, formatIndiaDateTime, mergeProviderHistory, RequestGeneration } from './subscription-support';
import { useSubscriptionActions } from './use-subscription-actions';
import { SubscriptionAlerts, ProviderSubscriptionHistory } from './subscription-insights';
import { operationsData, type ProviderSubscriptionSelfService, type SubscriptionHistoryKind } from './data';

const human = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const errorText = (error: unknown) => (error as { message?: string })?.message || 'The subscription action could not be completed.';

export function ProviderSubscriptionPage({ providerId }: { providerId: string }) {
  const planListId = useId();
  const changeDialog = useRef<HTMLDialogElement>(null);
  const [plans, setPlans] = useState<Array<{ id: string; attributes: { code: string; name: string; version_number: number; price_amount: string; currency_code: string; billing_interval: string; tax_treatment: string } }>>([]);
  const [summary, setSummary] = useState<ProviderSubscriptionSelfService | null>(null);
  const [planVersionId, setPlanVersionId] = useState(''); const [planSearch, setPlanSearch] = useState(''); const [changeKind, setChangeKind] = useState('UPGRADE');
  const [changeReason, setChangeReason] = useState('');
  const { error, busy, setError, run } = useSubscriptionActions(providerId);
  const reads = useRef(new RequestGeneration());
  const [historyPaging, setHistoryPaging] = useState(false);
  const historyInFlight = useRef(false);
  const [effectiveFrom] = useState(() => new Date().toISOString());
  async function load() {
    const valid = reads.current.next(); setError('');
    try {
      const [catalogue, result] = await Promise.all([operationsData.providerSubscriptionPlans(providerId), operationsData.providerSubscription(providerId)]);
      if (valid()) { setPlans(catalogue.data); setSummary(result.data); }
    } catch (cause) { if (valid()) setError(errorText(cause)); }
  }
  useEffect(() => {
    setSummary(null); setPlans([]); setPlanVersionId(''); setPlanSearch(''); void load();
    const generation = reads.current;
    return () => generation.invalidate();
  }, [providerId]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const subscription = summary?.subscription;
    const body = subscription
      ? { change_kind: changeKind, ...(changeKind === 'CANCELLATION' ? {} : { plan_version_id: planVersionId }), expected_revision: subscription.revision, reason: changeReason.trim() || undefined }
      : { plan_version_id: planVersionId, requested_effective_from: effectiveFrom, note: changeReason.trim() || undefined };
    await run(JSON.stringify([providerId, subscription?.id, body]), (key) => subscription
      ? operationsData.createProviderSubscriptionChange(providerId, subscription.id, body, key)
      : operationsData.createProviderSubscriptionRequest(providerId, body, key), async () => { setPlanVersionId(''); setPlanSearch(''); setChangeReason(''); changeDialog.current?.close(); await load(); });
  }
  async function loadHistory(kind: SubscriptionHistoryKind) {
    const after = summary?.history_page?.[kind]?.next;
    if (!after || historyInFlight.current || busy) return;
    historyInFlight.current = true; setHistoryPaging(true); setError('');
    const valid = reads.current.next();
    try {
      const result = (await operationsData.providerSubscription(providerId, { [kind]: after })).data;
      if (valid()) setSummary((current) => current ? mergeProviderHistory(current, result, kind) : result);
    } catch (cause) { if (valid()) setError(errorText(cause)); }
    finally { historyInFlight.current = false; if (valid()) setHistoryPaging(false); }
  }
  if (error && !summary) return <StatePanel title="Subscription unavailable">{error}</StatePanel>;
  if (!summary) return <StatePanel title="Loading subscription">Retrieving provider-scoped commercial information…</StatePanel>;
  const filteredPlans = plans.filter((plan) => `${plan.attributes.name} ${plan.attributes.code}`.toLowerCase().includes(planSearch.trim().toLowerCase()));
  const planText = (plan: (typeof plans)[number]) => `${plan.attributes.name} · ${plan.attributes.code} · v${plan.attributes.version_number} · ${plan.attributes.currency_code} ${plan.attributes.price_amount}`;
  const selectedPlan = plans.find((plan) => plan.id === planVersionId);
  const planPattern = planVersionId ? (selectedPlan ? planText(selectedPlan) : planSearch).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '(?!)';
  const currentPlan = plans.find((plan) => plan.id === summary.subscription?.plan_version_id);
  return <section className="platform-page provider-subscription-page"><PageHeader eyebrow="Provider administration / Usage & change request" title="Review subscription / usage" description="Provider-scoped entitlements and usage counters are server-authoritative. Subscription changes require independent platform review." />
    {error && <StatePanel title="Subscription action needs attention">{error}</StatePanel>}
    <SubscriptionAlerts validity={summary.subscription?.validity} usage={summary.usage} />
    <div className="provider-subscription-overview">
      <DetailSection title="Current subscription" description="Read-only terms returned by the provider subscription API.">{summary.subscription ? <dl className="platform-definition-list"><dt>Current plan</dt><dd>{currentPlan ? `${currentPlan.attributes.name} · ${currentPlan.attributes.code}` : `Plan version ${summary.subscription.plan_version_id}`}</dd><dt>Subscription status</dt><dd><Status>{human(summary.subscription.status)}</Status></dd><dt>Approval</dt><dd>{human(summary.subscription.approval_state)}</dd><dt>Payment</dt><dd>{human(summary.subscription.payment_state)}</dd><dt>Billing owner</dt><dd>TRISE platform</dd><dt>Effective from</dt><dd>{formatIndiaDate(summary.subscription.effective_from)}</dd><dt>Valid until / expiry</dt><dd>{summary.subscription.effective_to ? formatIndiaDate(summary.subscription.effective_to) : 'Open-ended'}</dd>{currentPlan && <><dt>Plan price</dt><dd>{currentPlan.attributes.currency_code} {currentPlan.attributes.price_amount} / {human(currentPlan.attributes.billing_interval)}</dd><dt>Tax treatment</dt><dd>{human(currentPlan.attributes.tax_treatment)}</dd></>}{summary.subscription.validity && <><dt>Validity</dt><dd><Status>{human(summary.subscription.validity.state)}</Status></dd><dt>Remaining</dt><dd>{summary.subscription.validity.remaining_days} days · {summary.subscription.validity.remaining_weeks} weeks</dd><dt>Next reminder</dt><dd>{summary.subscription.validity.next_reminder ? `${human(summary.subscription.validity.next_reminder.kind)} · ${formatIndiaDateTime(summary.subscription.validity.next_reminder.due_at)}` : 'No reminder remaining'}</dd></>}</dl> : <p>No active subscription. Review published plans and submit a request for platform approval.</p>}</DetailSection>
      <DetailSection title="Capacity / action" description={`Usage calculated ${formatIndiaDateTime(summary.usage.observed_at)} · policy ${summary.usage.calculation_policy_version}`}><div className="provider-usage-grid">{Object.entries(summary.usage.metrics).map(([key, metric]) => { const limited = metric.limit && !metric.limit.unlimited && typeof metric.limit.value === 'number'; const percent = limited && metric.limit?.value ? Math.min(100, Math.round(metric.value / metric.limit.value * 100)) : 0; return <article className={metric.exceeded ? 'usage-exceeded' : ''} key={key}><div><strong>{human(key)}</strong><span>{metric.limit?.unlimited ? 'Unlimited' : limited ? `${metric.value} / ${metric.limit?.value}` : `${metric.value} used`}</span></div>{limited && <progress aria-label={`${human(key)} utilization`} value={percent} max={100} />}{limited && <small>{metric.remaining ?? Math.max(0, (metric.limit?.value || 0) - metric.value)} remaining</small>}{!metric.limit && <small>No active entitlement returned</small>}{metric.exceeded && <Status>Limit exceeded</Status>}</article>; })}</div><div className="provider-subscription-actions"><Button disabled={busy || historyPaging} onClick={() => { setPlanVersionId(''); setPlanSearch(''); changeDialog.current?.showModal(); }}> {summary.subscription ? 'Request subscription change' : 'Request a subscription'}</Button><a href="#provider-subscription-plans">Compare published plans</a></div></DetailSection>
    </div>
    <dialog ref={changeDialog} className="operations-dialog provider-subscription-change-dialog" aria-labelledby="provider-subscription-change-title" onCancel={() => { setPlanVersionId(''); setPlanSearch(''); }}>
      <div className="operations-dialog-heading"><div><h2 id="provider-subscription-change-title">{summary.subscription ? 'Request subscription change' : 'Request subscription'}</h2><p>Requests are submitted to the Platform for review; this does not change the active subscription.</p></div><Button variant="quiet" type="button" onClick={() => changeDialog.current?.close()}>Close</Button></div>
      <div className="provider-subscription-readonly"><strong>Current terms</strong><span>{currentPlan?.attributes.name || 'No active subscription'} · {summary.subscription ? human(summary.subscription.status) : 'No active plan'}</span><span>Capacity values are calculated from the provider-scoped usage response.</span></div>
      <form className="provider-subscription-change-form" onSubmit={submit}>{summary.subscription && <label>Requested change<select disabled={busy || historyPaging} value={changeKind} onChange={(event) => { setChangeKind(event.target.value); setPlanVersionId(''); setPlanSearch(''); }}><option>UPGRADE</option><option>DOWNGRADE</option><option>RENEWAL</option><option>CANCELLATION</option></select></label>}{(!summary.subscription || changeKind !== 'CANCELLATION') && <label className="subscription-combobox">Published plan<input disabled={busy || historyPaging} type="search" list={planListId} required pattern={planPattern} title="Select a published plan from the matching options" value={selectedPlan ? planText(selectedPlan) : planSearch} onChange={(event) => { const next = event.target.value; setPlanSearch(next); setPlanVersionId(plans.find((plan) => planText(plan) === next)?.id || ''); }} placeholder="Search by plan name or code" autoComplete="off" /><datalist id={planListId}>{filteredPlans.map((plan) => <option value={planText(plan)} key={plan.id} />)}</datalist></label>}
        {selectedPlan && <div className="provider-subscription-selected-plan"><strong>{selectedPlan.attributes.name} · v{selectedPlan.attributes.version_number}</strong><span>{selectedPlan.attributes.currency_code} {selectedPlan.attributes.price_amount} / {human(selectedPlan.attributes.billing_interval)}</span><span>Tax treatment: {human(selectedPlan.attributes.tax_treatment)} · Pricing and effective date are subject to Platform review.</span></div>}
        <label>Reason<textarea value={changeReason} onChange={(event) => setChangeReason(event.target.value)} rows={3} maxLength={1000} placeholder="Explain the requested change" /></label>
        <div className="provider-subscription-dialog-footer"><Button type="button" variant="secondary" onClick={() => changeDialog.current?.close()}>Close</Button><Button type="button" variant="secondary" onClick={() => { changeDialog.current?.close(); document.getElementById('provider-subscription-plans')?.scrollIntoView({ behavior: 'smooth' }); }}>Compare plans</Button><Button type="submit" busy={busy || historyPaging} disabled={busy || historyPaging || (changeKind !== 'CANCELLATION' && !planVersionId)}>Submit change request</Button></div>
      </form>
    </dialog>
    <div id="provider-subscription-plans"><DetailSection title="Published plans" description="Published provider-eligible plans returned by the subscription catalogue API."><div className="record-grid">{plans.map((plan) => <article className="record-card" key={plan.id}><Status>{plan.attributes.code}</Status><strong>{plan.attributes.name}</strong><span>{plan.attributes.currency_code} {plan.attributes.price_amount} / {human(plan.attributes.billing_interval)}</span><small>Version {plan.attributes.version_number} · {human(plan.attributes.tax_treatment)}</small><Button variant="quiet" disabled={busy || historyPaging} onClick={() => { setPlanVersionId(plan.id); setPlanSearch(planText(plan)); changeDialog.current?.showModal(); }}>Select plan</Button></article>)}</div>{plans.length === 0 && <p>No published provider-eligible plans are currently available.</p>}</DetailSection></div>
    <div className="plan-detail-grid"><DetailSection title="Invoices">{summary.invoices.length ? summary.invoices.map((invoice) => <div key={invoice.id}><strong>{invoice.invoice_number}</strong> · {invoice.currency_code} {invoice.total_amount} · <Status>{human(invoice.collection_state)}</Status><br /><small>Due {formatIndiaDate(invoice.due_at)} · evidence {invoice.evidence_statuses.map(human).join(', ') || 'not submitted'}</small>{invoice.evidence?.map(item => <EvidenceReviewFeedback key={item.id} reviews={item.reviews} />)}</div>) : <p>No invoices.</p>}</DetailSection></div>
    <DetailSection title="Load subscription history" description="Requests, plan changes and invoices can be loaded independently without losing the other history already shown."><div className="platform-form-actions">{(['requests', 'changes', 'invoices'] as const).map((kind) => <div key={kind}><span>{summary[kind].length} {kind} loaded</span>{summary.history_page?.[kind]?.next && <Button variant="secondary" disabled={busy} busy={historyPaging} onClick={() => void loadHistory(kind)}>Load more {kind}</Button>}</div>)}</div></DetailSection>
    <ProviderSubscriptionHistory summary={summary} />
    <DetailSection title="Requests and review status">{[...summary.requests.map((row) => ({ id: row.id, label: 'Subscription', status: row.status, evidence: row.evidence_statuses, feedback: row.evidence })), ...summary.changes.map((row) => ({ id: row.id, label: human(row.change_kind), status: row.status, evidence: row.evidence_statuses, feedback: row.evidence }))].map((row) => <div key={row.id}><strong>{row.label}</strong> · <Status>{human(row.status)}</Status> · evidence {row.evidence.map(human).join(', ') || 'not submitted'}{row.feedback?.map(item => <EvidenceReviewFeedback key={item.id} reviews={item.reviews} />)}</div>)}</DetailSection>
  </section>;
}

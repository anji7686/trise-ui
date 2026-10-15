import { EvidenceReviewFeedback } from './subscription-review';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button, DetailSection, PageHeader, StatePanel } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { mergeProviderHistory, RequestGeneration } from './subscription-support';
import { useSubscriptionActions } from './use-subscription-actions';
import { SubscriptionAlerts, ProviderSubscriptionHistory } from './subscription-insights';
import { operationsData, type ProviderSubscriptionSelfService, type SubscriptionHistoryKind } from './data';

const human = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const errorText = (error: unknown) => (error as { message?: string })?.message || 'The subscription action could not be completed.';

export function ProviderSubscriptionPage({ providerId }: { providerId: string }) {
  const planListId = useId();
  const [plans, setPlans] = useState<Array<{ id: string; attributes: { code: string; name: string; version_number: number; price_amount: string; currency_code: string; billing_interval: string; tax_treatment: string } }>>([]);
  const [summary, setSummary] = useState<ProviderSubscriptionSelfService | null>(null);
  const [planVersionId, setPlanVersionId] = useState(''); const [planSearch, setPlanSearch] = useState(''); const [changeKind, setChangeKind] = useState('UPGRADE');
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
      ? { change_kind: changeKind, ...(changeKind === 'CANCELLATION' ? {} : { plan_version_id: planVersionId }), expected_revision: subscription.revision }
      : { plan_version_id: planVersionId, requested_effective_from: effectiveFrom };
    await run(JSON.stringify([providerId, subscription?.id, body]), (key) => subscription
      ? operationsData.createProviderSubscriptionChange(providerId, subscription.id, body, key)
      : operationsData.createProviderSubscriptionRequest(providerId, body, key), async () => { setPlanVersionId(''); setPlanSearch(''); await load(); });
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
  return <section className="platform-page"><PageHeader eyebrow="Provider workspace" title="Subscription" description="Review plans, usage, invoices and evidence status. Requests require independent platform approval." />
    {error && <StatePanel title="Subscription action needs attention">{error}</StatePanel>}
    <SubscriptionAlerts validity={summary.subscription?.validity} usage={summary.usage} />
    <DetailSection title="Current subscription">{summary.subscription ? <dl className="platform-definition-list"><dt>Status</dt><dd><Status>{human(summary.subscription.status)}</Status></dd><dt>Approval</dt><dd>{human(summary.subscription.approval_state)}</dd><dt>Payment</dt><dd>{human(summary.subscription.payment_state)}</dd><dt>Plan version</dt><dd>{summary.subscription.plan_version_id}</dd><dt>Effective from</dt><dd>{new Date(summary.subscription.effective_from).toLocaleString()}</dd><dt>Valid until / expiry</dt><dd>{summary.subscription.effective_to ? new Date(summary.subscription.effective_to).toLocaleString() : 'Not available'}</dd>{summary.subscription.validity && <><dt>Validity</dt><dd><Status>{human(summary.subscription.validity.state)}</Status></dd><dt>Remaining</dt><dd>{summary.subscription.validity.remaining_days} days · {summary.subscription.validity.remaining_weeks} weeks</dd><dt>Next reminder</dt><dd>{summary.subscription.validity.next_reminder ? `${human(summary.subscription.validity.next_reminder.kind)} · ${new Date(summary.subscription.validity.next_reminder.due_at).toLocaleString()}` : 'No reminder remaining'}</dd></>}</dl> : <p>No active subscription. Select a published plan and submit it for review.</p>}</DetailSection>
    <DetailSection title="Published plans"><div className="record-grid">{plans.map((plan) => <article className="record-card" key={plan.id}><Status>{plan.attributes.code}</Status><strong>{plan.attributes.name}</strong><span>{plan.attributes.currency_code} {plan.attributes.price_amount} / {human(plan.attributes.billing_interval)}</span><small>Version {plan.attributes.version_number} · {human(plan.attributes.tax_treatment)}</small><Button variant="quiet" disabled={busy || historyPaging} onClick={() => { setPlanVersionId(plan.id); setPlanSearch(planText(plan)); }}>Select</Button></article>)}</div></DetailSection>
    <DetailSection title={summary.subscription ? 'Request subscription change' : 'Request subscription'}><form className="platform-filter-toolbar" onSubmit={submit}>{summary.subscription && <label>Change<select disabled={busy || historyPaging} value={changeKind} onChange={(event) => setChangeKind(event.target.value)}><option>UPGRADE</option><option>DOWNGRADE</option><option>RENEWAL</option><option>CANCELLATION</option></select></label>}{(!summary.subscription || changeKind !== 'CANCELLATION') && <label className="subscription-combobox">Published plan<input disabled={busy || historyPaging} type="search" list={planListId} required pattern={planPattern} title="Select a published plan from the matching options" value={selectedPlan ? planText(selectedPlan) : planSearch} onChange={(event) => { const next = event.target.value; setPlanSearch(next); setPlanVersionId(plans.find((plan) => planText(plan) === next)?.id || ''); }} placeholder="Search by plan name or code" autoComplete="off" /><datalist id={planListId}>{filteredPlans.map((plan) => <option value={planText(plan)} key={plan.id} />)}</datalist><small>Select one of the published plans returned by the API.</small></label>}<Button type="submit" busy={busy || historyPaging}>Submit for platform review</Button></form></DetailSection>
    <div className="plan-detail-grid"><DetailSection title="Usage">{Object.entries(summary.usage.metrics).map(([key, metric]) => <p key={key}><strong>{human(key)}</strong>: {metric.value} {metric.exceeded && <Status>Limit exceeded</Status>}</p>)}</DetailSection><DetailSection title="Invoices">{summary.invoices.length ? summary.invoices.map((invoice) => <div key={invoice.id}><strong>{invoice.invoice_number}</strong> · {invoice.currency_code} {invoice.total_amount} · <Status>{human(invoice.collection_state)}</Status><br /><small>Due {new Date(invoice.due_at).toLocaleDateString()} · evidence {invoice.evidence_statuses.map(human).join(', ') || 'not submitted'}</small>{invoice.evidence?.map(item => <EvidenceReviewFeedback key={item.id} reviews={item.reviews} />)}</div>) : <p>No invoices.</p>}</DetailSection></div>
    <DetailSection title="Load subscription history" description="Requests, plan changes and invoices can be loaded independently without losing the other history already shown."><div className="platform-form-actions">{(['requests', 'changes', 'invoices'] as const).map((kind) => <div key={kind}><span>{summary[kind].length} {kind} loaded</span>{summary.history_page?.[kind]?.next && <Button variant="secondary" disabled={busy} busy={historyPaging} onClick={() => void loadHistory(kind)}>Load more {kind}</Button>}</div>)}</div></DetailSection>
    <ProviderSubscriptionHistory summary={summary} />
    <DetailSection title="Requests and review status">{[...summary.requests.map((row) => ({ id: row.id, label: 'Subscription', status: row.status, evidence: row.evidence_statuses, feedback: row.evidence })), ...summary.changes.map((row) => ({ id: row.id, label: human(row.change_kind), status: row.status, evidence: row.evidence_statuses, feedback: row.evidence }))].map((row) => <div key={row.id}><strong>{row.label}</strong> · <Status>{human(row.status)}</Status> · evidence {row.evidence.map(human).join(', ') || 'not submitted'}{row.feedback?.map(item => <EvidenceReviewFeedback key={item.id} reviews={item.reviews} />)}</div>)}</DetailSection>
  </section>;
}

import { useEffect, useId, useState, type FormEvent } from 'react';
import { Button, DetailSection, PageHeader, StatePanel, Status } from '@trise/ui';
import { operationsData, type PlatformPlan, type PlatformProviderAttributes, type PlatformSubscription, type PlatformSubscriptionAddon, type PlatformSubscriptionChange, type PlatformSubscriptionInvoice, type PlatformSubscriptionRequest, type PlatformTaxRate, type PlatformUsage, type Resource } from './data';

const human = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const errorText = (error: unknown) => (error as { message?: string })?.message || 'The subscription request could not be completed.';
const go = (route: string) => { window.location.hash = route; };

type LookupOption = { id: string; label: string; detail?: string };

function SearchableSelect({ label, searchLabel, search, onSearch, value, onChange, options, placeholder = 'Select an option', required = true }: { label: string; searchLabel: string; search: string; onSearch: (value: string) => void; value: string; onChange: (value: string) => void; options: LookupOption[]; placeholder?: string; required?: boolean }) {
  const listId = useId();
  const optionText = (option: LookupOption) => `${option.label}${option.detail ? ` · ${option.detail}` : ''}`;
  const selected = options.find((option) => option.id === value);
  const displayValue = selected ? optionText(selected) : search;
  const pattern = value ? displayValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '(?!)';
  return <label className="subscription-combobox">{label}<input type="search" list={listId} required={required} pattern={pattern} title={placeholder} value={displayValue} onChange={(event) => { const next = event.target.value; onSearch(next); const match = options.find((option) => optionText(option) === next); onChange(match?.id || ''); }} placeholder={searchLabel} autoComplete="off" /><datalist id={listId}>{options.map((option) => <option value={optionText(option)} key={option.id} />)}</datalist><small>Select one of the matching authorized records.</small></label>;
}

export function PlatformSubscriptionsPage({ capabilities }: { capabilities: string[] }) {
  const route = window.location.hash.slice(1);
  if (route.startsWith('platform/subscription-billing')) return <PlatformSubscriptionBillingPage capabilities={capabilities} />;
  const usageMode = route.startsWith('platform/subscription-usage');
  const requestMode = route.startsWith('platform/subscription-requests');
  const [subscriptions, setSubscriptions] = useState<Resource<PlatformSubscription>[]>([]);
  const [requests, setRequests] = useState<Resource<PlatformSubscriptionRequest>[]>([]);
  const [providers, setProviders] = useState<Resource<PlatformProviderAttributes>[]>([]);
  const [providerSearch, setProviderSearch] = useState('');
  const [plans, setPlans] = useState<Resource<PlatformPlan>[]>([]);
  const [planSearch, setPlanSearch] = useState('');
  const [providerId, setProviderId] = useState('');
  const [planVersionId, setPlanVersionId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<Resource<PlatformSubscriptionRequest> | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<Resource<PlatformSubscription> | null>(null);
  const [changes, setChanges] = useState<Resource<PlatformSubscriptionChange>[]>([]);
  const [selectedChange, setSelectedChange] = useState<Resource<PlatformSubscriptionChange> | null>(null);
  const [changeKind, setChangeKind] = useState('UPGRADE');
  const [changePlanVersionId, setChangePlanVersionId] = useState('');
  const [changeEvidenceReference, setChangeEvidenceReference] = useState('');
  const [changeEvidenceAmount, setChangeEvidenceAmount] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [evidenceAmount, setEvidenceAmount] = useState('');
  const [usage, setUsage] = useState<PlatformUsage | null>(null);
  const [loading, setLoading] = useState(!usageMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (usageMode) return;
    setLoading(true); setError('');
    try {
      if (requestMode) setRequests((await operationsData.platformSubscriptionRequests()).data);
      else { const [subscriptionPage, changePage] = await Promise.all([operationsData.platformSubscriptions(), operationsData.platformSubscriptionChanges()]); setSubscriptions(subscriptionPage.data); setChanges(changePage.data); }
    } catch (cause) { setError(errorText(cause)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [route]);
  useEffect(() => { const timer = window.setTimeout(() => { operationsData.platformProviders({ q: providerSearch }).then((result) => setProviders(result.data)).catch((cause) => setError(errorText(cause))); }, 180); return () => window.clearTimeout(timer); }, [providerSearch]);
  useEffect(() => { operationsData.platformPlans({ status: 'ACTIVE' }).then((result) => setPlans(result.data)).catch((cause) => setError(errorText(cause))); }, []);

  const providerOptions = providers.map((provider) => ({ id: provider.id, label: provider.attributes.display_name, detail: provider.attributes.provider_code || human(provider.attributes.status) }));
  const planOptions = plans.flatMap((plan) => (plan.attributes.versions || (plan.attributes.latest_version ? [plan.attributes.latest_version] : [])).filter((version) => version.attributes.status === 'PUBLISHED').map((version) => ({ id: version.id, label: `${plan.attributes.name} · v${version.attributes.version_number}`, detail: `${version.attributes.currency_code} ${Number(version.attributes.price_amount).toLocaleString('en-IN')} / ${human(version.attributes.billing_interval)}` }))).filter((option) => option.label.toLowerCase().includes(planSearch.trim().toLowerCase()) || option.detail.toLowerCase().includes(planSearch.trim().toLowerCase()));

  if (usageMode && !capabilities.includes('PLATFORM_SUBSCRIPTION_USAGE_READ')) return <StatePanel title="Usage access is restricted">The server did not project subscription usage capability.</StatePanel>;
  if (!usageMode && !capabilities.includes('PLATFORM_SUBSCRIPTION_READ')) return <StatePanel title="Subscription access is restricted">The server did not project subscription read capability.</StatePanel>;
  if (loading) return <StatePanel title="Loading subscriptions">Retrieving current commercial state…</StatePanel>;

  async function loadUsage(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setUsage(null);
    try { setUsage((await operationsData.platformSubscriptionUsage(providerId.trim())).data); } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }

  async function createRequest(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await operationsData.createPlatformSubscriptionRequest(providerId.trim(), { plan_version_id: planVersionId.trim(), requested_effective_from: new Date(effectiveFrom).toISOString() }, crypto.randomUUID());
      setProviderId(''); setPlanVersionId(''); setEffectiveFrom(''); await load();
    } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }

  async function openRequest(requestId: string) {
    setBusy(true); setError('');
    try { setSelectedRequest((await operationsData.platformSubscriptionRequest(requestId)).data); }
    catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }

  async function openSubscription(subscriptionId: string) {
    setBusy(true); setError('');
    try { setSelectedSubscription((await operationsData.platformSubscription(subscriptionId)).data); }
    catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }

  async function submitEvidence(event: FormEvent) {
    event.preventDefault(); if (!selectedRequest) return; setBusy(true); setError('');
    try {
      await operationsData.submitPlatformSubscriptionEvidence(selectedRequest.id, { evidence_kind: 'TRANSACTION_REFERENCE', external_reference: evidenceReference.trim(), stated_amount: evidenceAmount || undefined, currency_code: evidenceAmount ? 'INR' : undefined }, crypto.randomUUID());
      setEvidenceReference(''); setEvidenceAmount(''); await openRequest(selectedRequest.id);
    } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }

  async function reviewEvidence(evidenceId: string, decision: 'VERIFIED' | 'REJECTED' | 'CORRECTIONS_REQUESTED') {
    if (!selectedRequest) return; setBusy(true); setError('');
    try { await operationsData.reviewPlatformSubscriptionEvidence(selectedRequest.id, evidenceId, { decision }, crypto.randomUUID()); await openRequest(selectedRequest.id); }
    catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }

  async function createChange(event: FormEvent) {
    event.preventDefault(); if (!selectedSubscription) return; setBusy(true); setError('');
    try { await operationsData.createPlatformSubscriptionChange(selectedSubscription.id, { change_kind: changeKind, ...(changeKind === 'CANCELLATION' ? {} : { plan_version_id: changePlanVersionId.trim() }), expected_revision: selectedSubscription.attributes.revision }, crypto.randomUUID()); setChangePlanVersionId(''); await load(); }
    catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }

  async function openChange(changeId: string) {
    setBusy(true); setError('');
    try { setSelectedChange((await operationsData.platformSubscriptionChange(changeId)).data); }
    catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }

  async function submitChangeEvidence(event: FormEvent) {
    event.preventDefault(); if (!selectedChange) return; setBusy(true); setError('');
    try { await operationsData.submitPlatformSubscriptionChangeEvidence(selectedChange.id, { evidence_kind: 'TRANSACTION_REFERENCE', external_reference: changeEvidenceReference.trim(), stated_amount: changeEvidenceAmount || undefined, currency_code: changeEvidenceAmount ? 'INR' : undefined }, crypto.randomUUID()); setChangeEvidenceReference(''); setChangeEvidenceAmount(''); await openChange(selectedChange.id); }
    catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }

  async function reviewChangeEvidence(evidenceId: string, decision: 'VERIFIED' | 'REJECTED' | 'CORRECTIONS_REQUESTED') {
    if (!selectedChange) return; setBusy(true); setError('');
    try { await operationsData.reviewPlatformSubscriptionChangeEvidence(selectedChange.id, evidenceId, { decision }, crypto.randomUUID()); await openChange(selectedChange.id); }
    catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }

  async function decide(record: Resource<PlatformSubscriptionRequest>, decision: 'APPROVED' | 'REJECTED') {
    setBusy(true); setError('');
    try { await operationsData.decidePlatformSubscriptionRequest(record.id, { decision, expected_revision: record.attributes.revision, reason: decision === 'REJECTED' ? 'Rejected by subscription review' : 'Commercial review complete' }, crypto.randomUUID()); await load(); }
    catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }

  async function activate(record: Resource<PlatformSubscriptionRequest>) {
    setBusy(true); setError('');
    try { await operationsData.activatePlatformSubscription(record.id, crypto.randomUUID()); await load(); }
    catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }

  if (usageMode) return <section className="platform-page"><PageHeader eyebrow="Platform administration / Subscriptions" title="Authoritative usage" description="Managed elevators are deduplicated across installation and AMC. Only active provider agents count." /><form className="platform-filter-toolbar" onSubmit={loadUsage}><SearchableSelect label="Provider" searchLabel="Search providers" search={providerSearch} onSearch={setProviderSearch} value={providerId} onChange={setProviderId} options={providerOptions} placeholder="Select a provider" /><Button type="submit" busy={busy}>Load usage</Button></form>{error && <StatePanel title="Usage unavailable">{error}</StatePanel>}{usage && <div className="plan-detail-grid">{Object.entries(usage.metrics).map(([key, metric]) => <DetailSection key={key} title={human(key)}><strong className="plan-price">{metric.value}</strong><p>{metric.limit ? `${metric.remaining} remaining of ${metric.limit.value}` : 'No active subscription limit'}</p><dl className="platform-definition-list">{Object.entries(metric.components).map(([name, value]) => <><dt key={`${name}-label`}>{human(name)}</dt><dd key={`${name}-value`}>{value}</dd></>)}</dl>{metric.exceeded && <Status>Limit exceeded</Status>}</DetailSection>)}</div>}</section>;

  const records = requestMode ? requests : subscriptions;
  return <section className="platform-page"><PageHeader eyebrow="Platform administration / Subscriptions" title={requestMode ? 'Approval requests' : 'Provider subscriptions'} description={requestMode ? 'Approval, payment evidence and activation remain separate audited decisions.' : 'Accepted commercial snapshots and current activation state.'} />
    {error && <StatePanel title="Subscription action needs attention">{error}</StatePanel>}
    {requestMode && capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && <DetailSection title="Create provider request"><form className="platform-filter-toolbar subscription-request-form" onSubmit={createRequest}><SearchableSelect label="Provider" searchLabel="Search providers" search={providerSearch} onSearch={setProviderSearch} value={providerId} onChange={setProviderId} options={providerOptions} placeholder="Select a provider" /><SearchableSelect label="Published plan" searchLabel="Search plans" search={planSearch} onSearch={setPlanSearch} value={planVersionId} onChange={setPlanVersionId} options={planOptions} placeholder="Select a published plan" /><label>Effective from<input required type="datetime-local" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /></label><Button type="submit" busy={busy}>Create request</Button></form></DetailSection>}
    {!records.length ? <StatePanel title={requestMode ? 'No subscription requests' : 'No active subscriptions'}>No matching records are available.</StatePanel> : <div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Service provider</th><th>Plan version</th><th>Status</th><th>Effective</th><th>Actions</th></tr></thead><tbody>{requestMode ? requests.map((record) => <tr key={record.id}><td><strong>{record.attributes.provider?.display_name || 'Provider'}</strong><small>{record.attributes.provider?.provider_code || record.attributes.provider_id}</small></td><td>{record.attributes.plan_version_id}</td><td><Status>{human(record.attributes.status)}</Status></td><td>{new Date(record.attributes.requested_effective_from).toLocaleDateString()}</td><td><div className="platform-form-actions"><Button variant="quiet" onClick={() => go(`platform/providers/${record.attributes.provider_id}`)}>View provider</Button>{capabilities.includes('PLATFORM_PROVIDER_REGISTER') && <Button variant="quiet" onClick={() => go(`platform/providers/${record.attributes.provider_id}/edit`)}>Edit provider</Button>}<Button variant="quiet" disabled={busy} onClick={() => void openRequest(record.id)}>View request</Button>{record.attributes.status === 'PENDING_REVIEW' && capabilities.includes('PLATFORM_SUBSCRIPTION_REVIEW') && <><Button disabled={busy} onClick={() => void decide(record, 'APPROVED')}>Approve</Button><Button variant="danger" disabled={busy} onClick={() => void decide(record, 'REJECTED')}>Reject</Button></>}{record.attributes.status === 'APPROVED' && capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && <Button disabled={busy} onClick={() => void activate(record)}>Activate</Button>}</div></td></tr>) : subscriptions.map((record) => <tr key={record.id}><td><strong>{record.attributes.provider?.display_name || 'Provider'}</strong><small>{record.attributes.provider?.provider_code || record.attributes.provider_id}</small></td><td>{record.attributes.plan_version_id}</td><td><Status>{human(record.attributes.status)}</Status></td><td>{new Date(record.attributes.effective_from).toLocaleDateString()}</td><td><div className="platform-form-actions"><Button variant="quiet" onClick={() => go(`platform/providers/${record.attributes.provider_id}`)}>View provider</Button>{capabilities.includes('PLATFORM_PROVIDER_REGISTER') && <Button variant="quiet" onClick={() => go(`platform/providers/${record.attributes.provider_id}/edit`)}>Edit provider</Button>}<Button variant="quiet" disabled={busy} onClick={() => void openSubscription(record.id)}>View subscription</Button></div></td></tr>)}</tbody></table></div>}
    {!requestMode && selectedSubscription && <DetailSection title={`${selectedSubscription.attributes.provider.display_name} subscription`}><dl className="platform-definition-list"><dt>Provider code</dt><dd>{selectedSubscription.attributes.provider.provider_code || 'Not supplied'}</dd><dt>Provider status</dt><dd><Status>{human(selectedSubscription.attributes.provider.status)}</Status></dd><dt>Subscription status</dt><dd><Status>{human(selectedSubscription.attributes.status)}</Status></dd><dt>Approval</dt><dd>{human(selectedSubscription.attributes.approval_state)}</dd><dt>Payment evidence</dt><dd>{human(selectedSubscription.attributes.payment_state)}</dd><dt>Effective from</dt><dd>{new Date(selectedSubscription.attributes.effective_from).toLocaleString()}</dd><dt>Plan version</dt><dd>{selectedSubscription.attributes.plan_version_id}</dd></dl><div className="platform-form-actions"><Button variant="secondary" onClick={() => go(`platform/providers/${selectedSubscription.attributes.provider_id}`)}>View provider details</Button>{capabilities.includes('PLATFORM_PROVIDER_REGISTER') && <Button variant="secondary" onClick={() => go(`platform/providers/${selectedSubscription.attributes.provider_id}/edit`)}>Edit provider details</Button>}</div>{capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && <form className="platform-filter-toolbar" onSubmit={createChange}><label>Change<select value={changeKind} onChange={(event) => setChangeKind(event.target.value)}><option>UPGRADE</option><option>DOWNGRADE</option><option>RENEWAL</option><option>CANCELLATION</option></select></label>{changeKind !== 'CANCELLATION' && <SearchableSelect label="Target plan" searchLabel="Search plans" search={planSearch} onSearch={setPlanSearch} value={changePlanVersionId} onChange={setChangePlanVersionId} options={planOptions} placeholder="Select a published plan" />}<Button type="submit" busy={busy}>Request change</Button></form>}</DetailSection>}
    {!requestMode && changes.length > 0 && <DetailSection title="Subscription changes"><div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Provider</th><th>Change</th><th>Status</th><th>Effective</th><th>Actions</th></tr></thead><tbody>{changes.map((change) => <tr key={change.id}><td>{change.attributes.provider.display_name}</td><td>{human(change.attributes.change_kind)}</td><td><Status>{human(change.attributes.status)}</Status></td><td>{new Date(change.attributes.requested_effective_at).toLocaleString()}</td><td><div className="platform-form-actions"><Button variant="quiet" onClick={() => void openChange(change.id)}>Manage</Button>{change.attributes.status === 'PENDING_REVIEW' && capabilities.includes('PLATFORM_SUBSCRIPTION_REVIEW') && <><Button onClick={() => void operationsData.decidePlatformSubscriptionChange(change.id, { decision: 'APPROVED', expected_revision: change.attributes.revision }, crypto.randomUUID()).then(load)}>Approve</Button><Button variant="danger" onClick={() => void operationsData.decidePlatformSubscriptionChange(change.id, { decision: 'REJECTED', expected_revision: change.attributes.revision }, crypto.randomUUID()).then(load)}>Reject</Button></>}{['APPROVED', 'SCHEDULED'].includes(change.attributes.status) && capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && <Button onClick={() => void operationsData.applyPlatformSubscriptionChange(change.id, crypto.randomUUID()).then(load)}>Apply when eligible</Button>}</div></td></tr>)}</tbody></table></div></DetailSection>}
    {!requestMode && selectedChange && <DetailSection title={`${human(selectedChange.attributes.change_kind)} evidence`}><p>{selectedChange.attributes.provider.display_name} · effective {new Date(selectedChange.attributes.requested_effective_at).toLocaleString()}</p>{capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && <form className="platform-filter-toolbar" onSubmit={submitChangeEvidence}><label>Transaction reference<input required value={changeEvidenceReference} onChange={(event) => setChangeEvidenceReference(event.target.value)} /></label><label>Stated INR amount<input type="number" min="0" step="0.0001" value={changeEvidenceAmount} onChange={(event) => setChangeEvidenceAmount(event.target.value)} /></label><Button type="submit" busy={busy}>Append evidence</Button></form>}{!selectedChange.attributes.evidence?.length ? <p>No evidence submitted.</p> : <div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Kind</th><th>Reference</th><th>Review</th><th>Actions</th></tr></thead><tbody>{selectedChange.attributes.evidence.map((evidence) => <tr key={evidence.id}><td>{human(evidence.attributes.evidence_kind)}</td><td>{evidence.attributes.external_reference || 'Document evidence'}</td><td><Status>{human(evidence.attributes.review_state)}</Status></td><td>{evidence.attributes.review_state === 'EVIDENCE_SUBMITTED' && capabilities.includes('PLATFORM_SUBSCRIPTION_REVIEW') && <div className="platform-form-actions"><Button onClick={() => void reviewChangeEvidence(evidence.id, 'VERIFIED')}>Verify</Button><Button variant="danger" onClick={() => void reviewChangeEvidence(evidence.id, 'REJECTED')}>Reject</Button><Button variant="quiet" onClick={() => void reviewChangeEvidence(evidence.id, 'CORRECTIONS_REQUESTED')}>Request correction</Button></div>}</td></tr>)}</tbody></table></div>}</DetailSection>}
    {requestMode && selectedRequest && <DetailSection title="Commercial evidence"><p>Request {selectedRequest.id}</p>{capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && <form className="platform-filter-toolbar" onSubmit={submitEvidence}><label>Transaction reference<input required value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} /></label><label>Stated INR amount<input type="number" min="0" step="0.0001" value={evidenceAmount} onChange={(event) => setEvidenceAmount(event.target.value)} /></label><Button type="submit" busy={busy}>Append evidence</Button></form>}{!selectedRequest.attributes.evidence?.length ? <p>No evidence submitted.</p> : <div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Kind</th><th>Reference</th><th>Review</th><th>Actions</th></tr></thead><tbody>{selectedRequest.attributes.evidence.map((evidence) => <tr key={evidence.id}><td>{human(evidence.attributes.evidence_kind)}</td><td>{evidence.attributes.external_reference || 'Document evidence'}</td><td><Status>{human(evidence.attributes.review_state)}</Status></td><td>{evidence.attributes.review_state === 'EVIDENCE_SUBMITTED' && capabilities.includes('PLATFORM_SUBSCRIPTION_REVIEW') && <div className="platform-form-actions"><Button disabled={busy} onClick={() => void reviewEvidence(evidence.id, 'VERIFIED')}>Verify</Button><Button variant="danger" disabled={busy} onClick={() => void reviewEvidence(evidence.id, 'REJECTED')}>Reject</Button><Button variant="quiet" disabled={busy} onClick={() => void reviewEvidence(evidence.id, 'CORRECTIONS_REQUESTED')}>Request correction</Button></div>}</td></tr>)}</tbody></table></div>}</DetailSection>}
  </section>;
}

function PlatformSubscriptionBillingPage({ capabilities }: { capabilities: string[] }) {
  const [addons, setAddons] = useState<Resource<PlatformSubscriptionAddon>[]>([]);
  const [taxes, setTaxes] = useState<Resource<PlatformTaxRate>[]>([]);
  const [invoices, setInvoices] = useState<Resource<PlatformSubscriptionInvoice>[]>([]);
  const [subscriptions, setSubscriptions] = useState<Resource<PlatformSubscription>[]>([]);
  const [subscriptionSearch, setSubscriptionSearch] = useState('');
  const [subscriptionId, setSubscriptionId] = useState(''); const [taxId, setTaxId] = useState(''); const [taxSearch, setTaxSearch] = useState(''); const [dueAt, setDueAt] = useState('');
  const [selected, setSelected] = useState<Resource<PlatformSubscriptionInvoice> | null>(null); const [reference, setReference] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function load() { setError(''); try { const [a, t, i, s] = await Promise.all([operationsData.platformSubscriptionAddons(), operationsData.platformSubscriptionTaxRates(), operationsData.platformSubscriptionInvoices(), operationsData.platformSubscriptions()]); setAddons(a.data); setTaxes(t.data); setInvoices(i.data); setSubscriptions(s.data); } catch (cause) { setError(errorText(cause)); } }
  useEffect(() => { void load(); }, []);
  async function issue(event: FormEvent) { event.preventDefault(); setBusy(true); try { await operationsData.createPlatformSubscriptionInvoice({ provider_subscription_id: subscriptionId.trim(), tax_rate_id: taxId.trim(), due_at: new Date(dueAt).toISOString(), addons: [] }, crypto.randomUUID()); setSubscriptionId(''); setTaxId(''); setDueAt(''); await load(); } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); } }
  async function openInvoice(id: string) { setBusy(true); try { setSelected((await operationsData.platformSubscriptionInvoice(id)).data); } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); } }
  async function evidence(event: FormEvent) { event.preventDefault(); if (!selected) return; setBusy(true); try { await operationsData.submitPlatformSubscriptionInvoiceEvidence(selected.id, { evidence_kind: 'TRANSACTION_REFERENCE', external_reference: reference.trim(), stated_amount: selected.attributes.total_amount, currency_code: selected.attributes.currency_code }, crypto.randomUUID()); setReference(''); await openInvoice(selected.id); } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); } }
  const subscriptionOptions = subscriptions.filter((subscription) => subscription.attributes.status === 'ACTIVE').map((subscription) => ({ id: subscription.id, label: subscription.attributes.provider.display_name, detail: `${subscription.attributes.provider.provider_code || 'No provider code'} · ${human(subscription.attributes.status)}` })).filter((option) => `${option.label} ${option.detail}`.toLowerCase().includes(subscriptionSearch.trim().toLowerCase()));
  const taxOptions = taxes.filter((tax) => tax.attributes.status === 'ACTIVE').map((tax) => ({ id: tax.id, label: `${tax.attributes.tax_code} · ${tax.attributes.jurisdiction_code}`, detail: `${tax.attributes.rate_percent}%` })).filter((option) => `${option.label} ${option.detail}`.toLowerCase().includes(taxSearch.trim().toLowerCase()));
  return <section className="platform-page"><PageHeader eyebrow="Platform administration / Subscriptions" title="Billing and payment evidence" description="Manual invoices use immutable plan/add-on snapshots and configured tax rates. Payment remains independently verified." />
    {error && <StatePanel title="Billing action needs attention">{error}</StatePanel>}
    {capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && <DetailSection title="Issue monthly invoice"><form className="platform-filter-toolbar subscription-request-form" onSubmit={issue}><SearchableSelect label="Active subscription" searchLabel="Search providers and subscriptions" search={subscriptionSearch} onSearch={setSubscriptionSearch} value={subscriptionId} onChange={setSubscriptionId} options={subscriptionOptions} placeholder="Select an active provider subscription" /><SearchableSelect label="Approved tax rate" searchLabel="Search tax rates" search={taxSearch} onSearch={setTaxSearch} value={taxId} onChange={setTaxId} options={taxOptions} placeholder="Select an approved tax rate" /><label>Due at<input required type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></label><Button type="submit" busy={busy}>Issue invoice</Button></form></DetailSection>}
    <DetailSection title="Invoices"><div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Invoice</th><th>Provider</th><th>Total</th><th>Due / grace</th><th>State</th><th>Actions</th></tr></thead><tbody>{invoices.map((row) => <tr key={row.id}><td>{row.attributes.invoice_number}</td><td><strong>{row.attributes.provider.display_name}</strong><small>{row.attributes.provider.provider_code || row.attributes.provider_id}</small></td><td>{row.attributes.currency_code} {row.attributes.total_amount}</td><td>{new Date(row.attributes.due_at).toLocaleDateString()}<small>Grace to {new Date(row.attributes.grace_ends_at).toLocaleDateString()}</small></td><td><Status>{human(row.attributes.collection_state)}</Status></td><td><div className="platform-form-actions"><Button variant="quiet" onClick={() => void openInvoice(row.id)}>View</Button><Button variant="quiet" onClick={() => go(`platform/providers/${row.attributes.provider_id}`)}>Provider details</Button>{row.attributes.status !== 'PAID' && capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && <Button onClick={() => void operationsData.markPlatformSubscriptionInvoicePaid(row.id, crypto.randomUUID()).then(load)}>Mark paid</Button>}</div></td></tr>)}</tbody></table></div></DetailSection>
    <div className="plan-detail-grid"><DetailSection title="Add-on catalogue">{addons.map((row) => <p key={row.id}><strong>{row.attributes.name}</strong> · {row.attributes.code} · {row.attributes.versions.map((v) => `${v.currency_code} ${v.price_amount} / ${v.quantity_per_unit}`).join(', ')}</p>)}</DetailSection><DetailSection title="Approved tax configuration">{taxes.map((row) => <p key={row.id}><strong>{row.attributes.tax_code}</strong> · {row.attributes.jurisdiction_code} · {row.attributes.rate_percent}%</p>)}</DetailSection></div>
    {selected && <DetailSection title={`Invoice ${selected.attributes.invoice_number}`}><dl className="platform-definition-list"><dt>Subtotal</dt><dd>{selected.attributes.currency_code} {selected.attributes.subtotal_amount}</dd><dt>Tax</dt><dd>{selected.attributes.currency_code} {selected.attributes.tax_amount}</dd><dt>Total</dt><dd>{selected.attributes.currency_code} {selected.attributes.total_amount}</dd><dt>Status</dt><dd><Status>{human(selected.attributes.status)}</Status></dd></dl>{capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && selected.attributes.status !== 'PAID' && <form className="platform-filter-toolbar" onSubmit={evidence}><label>Payment transaction reference<input required value={reference} onChange={(e) => setReference(e.target.value)} /></label><Button type="submit" busy={busy}>Append evidence</Button></form>}{selected.attributes.evidence?.map((item) => <div className="platform-form-actions" key={item.id}><span>{item.attributes.external_reference} · {human(item.attributes.review_state)}</span>{item.attributes.review_state === 'EVIDENCE_SUBMITTED' && capabilities.includes('PLATFORM_SUBSCRIPTION_REVIEW') && <><Button onClick={() => void operationsData.reviewPlatformSubscriptionInvoiceEvidence(selected.id, item.id, { decision: 'VERIFIED' }, crypto.randomUUID()).then(() => openInvoice(selected.id))}>Verify</Button><Button variant="danger" onClick={() => void operationsData.reviewPlatformSubscriptionInvoiceEvidence(selected.id, item.id, { decision: 'REJECTED' }, crypto.randomUUID()).then(() => openInvoice(selected.id))}>Reject</Button></>}</div>)}</DetailSection>}
  </section>;
}

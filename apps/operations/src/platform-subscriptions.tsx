import { SearchableSelect } from './searchable-select';
import { OperationsDialog } from './operations-dialog';
import { normalizePlatformHash } from './platform-provider-routing';
import { compatibleInvoiceAddons, dueSubscriptionChanges, invoiceAddonPayload, matchesSubscriptionHistory, transactionEvidencePayload } from './subscription-workflow';
import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, DetailSection, StatePanel } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { collectPages, formatIndiaDate, formatIndiaDateTime, indiaDateTimeToDate, indiaDateTimeToIso, localDateTime, RequestGeneration } from './subscription-support';
import { useSubscriptionActions } from './use-subscription-actions';
import { SubscriptionAlerts } from './subscription-insights';
import { EvidenceReviewFeedback, useReviewReason } from './subscription-review';
import { operationsData, type PlatformPlan, type PlatformProviderAttributes, type PlatformSubscription, type PlatformSubscriptionAddon, type PlatformSubscriptionChange, type PlatformSubscriptionInvoice, type PlatformSubscriptionRequest, type PlatformTaxRate, type PlatformUsage, type Resource, type SubscriptionRecipientTaxRegistration } from './data';
import { IndiaStateSelect } from './use-india-geography';
import { AdminActionMenu, AdminDataTable, AdminEmptyState, AdminFilterBar, AdminPageHeader, AdminPagination } from './platform-admin-ui';

const human = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const errorText = (error: unknown) => (error as { message?: string })?.message || 'The subscription request could not be completed.';
const go = (route: string) => { window.location.hash = route; };
const money = (value: unknown, currency = 'INR') => {
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) : '—';
};

function TaxBreakdown({ tax, currency = 'INR' }: { tax: Record<string, unknown> | null | undefined; currency?: string }) {
  if (!tax) return <p className="platform-form-note">No tax breakdown was returned by the billing service.</p>;
  const components = Array.isArray(tax.components) ? tax.components as Array<Record<string, unknown>> : [];
  return <div className="tax-preview-summary">
    <dl className="platform-definition-list invoice-money-rows"><dt>Taxable amount</dt><dd>{money(tax.taxable_amount, currency)}</dd><dt>Total GST</dt><dd>{money(tax.total_tax, currency)}</dd><dt>Final amount</dt><dd><strong>{money(tax.grand_total, currency)}</strong></dd></dl>
    {components.length > 0 ? <table className="platform-provider-table tax-breakdown-table"><thead><tr><th>Component</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{components.map((component, index) => <tr key={`${String(component.code || 'component')}-${index}`}><td>{human(String(component.code || 'Tax'))}</td><td className="invoice-money">{String(component.percentage || '0')}%</td><td className="invoice-money">{money(component.amount, currency)}</td></tr>)}</tbody></table> : <p className="platform-form-note">No component split was returned by this calculation source; the aggregate GST is shown above.</p>}
  </div>;
}

function InvoiceTaxPreview({ preview, mode, currency }: { preview: Record<string, unknown>; mode: 'LEGACY' | 'SHADOW' | 'CENTRAL'; currency: string }) {
  const context = preview.tax_context as Record<string, unknown> | undefined;
  const recipient = context?.recipient as Record<string, unknown> | undefined;
  const issuer = context?.issuer as Record<string, unknown> | undefined;
  const rule = preview.tax_rule as (Record<string, unknown> & { id?: string; version?: string; code?: string }) | undefined;
  const tax = preview.tax as (Record<string, unknown> & { calculation_revision?: string }) | undefined;
  const status = String(preview.calculation_status || 'UNKNOWN');
  return <DetailSection title="Tax calculation" description="Server-authoritative preview. Issue Invoice recalculates and persists an immutable tax snapshot.">
    <div className="invoice-preview-heading"><Status>{human(status)}</Status><span>{human(String(preview.calculation_mode || mode))} · {human(String(preview.tax_source || 'Not returned'))}</span></div>
    <dl className="platform-definition-list invoice-detail-list"><dt>Applied rule</dt><dd>{rule ? `${String(rule.code || 'TaxRule')} · v${String(rule.version || '—')}` : mode === 'LEGACY' ? 'Selected legacy tax rate' : 'No eligible central rule resolved'}</dd><dt>Preview status</dt><dd>{status === 'READY' ? 'Ready for invoice review' : 'Requires review before issue'}</dd>{mode === 'LEGACY' ? <><dt>Recipient context</dt><dd>Not part of the legacy calculation response.</dd></> : <><dt>Issuer context</dt><dd>{issuer?.state_or_union_territory ? `${String(issuer.state_or_union_territory)} · ${String(issuer.legal_name || 'Issuer')}` : 'Not returned'}</dd><dt>Recipient context</dt><dd>{recipient?.state_or_union_territory ? `${String(recipient.state_or_union_territory)} · ${String(recipient.legal_name || 'Recipient')}` : 'Missing recipient billing context'}</dd></>}</dl>
    <TaxBreakdown tax={tax} currency={currency} />
    <details className="invoice-calculation-details"><summary>Calculation details</summary><dl className="platform-definition-list"><dt>Calculation mode</dt><dd>{String(preview.calculation_mode || mode)}</dd><dt>Tax source</dt><dd>{String(preview.tax_source || 'Not returned')}</dd>{rule?.id && <><dt>TaxRule ID</dt><dd className="technical-value">{String(rule.id)}</dd></>}{rule?.version && <><dt>Rule version</dt><dd>{String(rule.version)}</dd></>}{tax?.calculation_revision && <><dt>Calculation revision</dt><dd>{String(tax.calculation_revision)}</dd></>}</dl></details>
    {Array.isArray(preview.warnings) && preview.warnings.length > 0 && <p className="platform-form-note invoice-warning">{preview.warnings.map(String).join(' ')}</p>}
  </DetailSection>;
}

function SubscriptionBillingContext({ subscriptionId, disabled, onSaved, onReady }: { subscriptionId: string; disabled?: boolean; onSaved: () => void; onReady?: (ready: boolean) => void }) {
  const [fields, setFields] = useState({ legal_name: '', address: '', country_code: 'IN', state_or_union_territory: '', registration_status: 'UNREGISTERED', gstin: '', gst_registration_id: '', recipient_email: '', recipient_phone: '' });
  const [registrations, setRegistrations] = useState<SubscriptionRecipientTaxRegistration[]>([]);
  const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (!subscriptionId) { onReady?.(false); return () => { active = false; }; }
    setLoading(true); setError('');
    void Promise.all([operationsData.platformSubscriptionBillingProfile(subscriptionId), operationsData.platformSubscriptionRecipientTaxRegistrations(subscriptionId)]).then(([profileResult, registrationResult]) => {
      if (!active) return;
      const profile = profileResult.data?.attributes;
      setRegistrations(registrationResult.data || []);
      onReady?.(Boolean(profile));
      setFields({ legal_name: profile?.legal_name || '', address: String(profile?.billing_address?.line1 || ''), country_code: profile?.country_code || 'IN', state_or_union_territory: profile?.state_or_union_territory || '', registration_status: profile?.registration_status || 'UNREGISTERED', gstin: profile?.gstin || '', gst_registration_id: profile?.gst_registration_id || '', recipient_email: profile?.recipient_email || '', recipient_phone: profile?.recipient_phone || '' });
    }).catch(cause => { if (active) setError(errorText(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [subscriptionId]);
  async function save() {
    setSaving(true); setError('');
    try { const saved = await operationsData.updatePlatformSubscriptionBillingProfile(subscriptionId, { legal_name: fields.legal_name, billing_address: { line1: fields.address }, country_code: fields.country_code, state_or_union_territory: fields.state_or_union_territory || null, registration_status: fields.registration_status, gst_registration_id: fields.gst_registration_id || null, recipient_email: fields.recipient_email || null, recipient_phone: fields.recipient_phone || null, place_of_supply_facts: {} }, crypto.randomUUID()); if (!saved.data) throw new Error('The server did not return the saved recipient billing context.'); onReady?.(true); onSaved(); }
    catch (cause) { setError(errorText(cause)); } finally { setSaving(false); }
  }
  if (!subscriptionId) return <p className="platform-form-note">Select a subscription first, then enter its recipient billing context.</p>;
  const registered = fields.registration_status === 'REGISTERED' || fields.registration_status === 'COMPOSITION';
  const selectedRegistration = registrations.find(item => item.id === fields.gst_registration_id);
  return <section className="subscription-billing-context"><h3>Recipient billing context</h3><p className="platform-form-note">GST registration belongs to the Provider’s Business, not TRISE. Only approved, currently effective Business registrations are available here. Choose “GST not registered” when applicable; no registration is selected automatically.</p>{loading && <p>Loading saved billing context…</p>}{error && <p className="platform-field-error" role="alert">{error}</p>}<div className="platform-form-grid"><label>Legal/billing name<input required disabled={disabled || saving} value={fields.legal_name} onChange={event => setFields({ ...fields, legal_name: event.target.value })} /></label><label>Billing address<input required disabled={disabled || saving} value={fields.address} onChange={event => setFields({ ...fields, address: event.target.value })} /></label><label>Authorized recipient email<input type="email" disabled={disabled || saving} value={fields.recipient_email} onChange={event => setFields({ ...fields, recipient_email: event.target.value })} placeholder="customer@example.com" /></label><label>Recipient phone<input type="tel" disabled={disabled || saving} value={fields.recipient_phone} onChange={event => setFields({ ...fields, recipient_phone: event.target.value })} placeholder="+91 98765 43210" /></label><label>Country<select required disabled={disabled || saving} value={fields.country_code} onChange={event => setFields({ ...fields, country_code: event.target.value })}><option value="IN">India (IN)</option></select></label><IndiaStateSelect value={selectedRegistration?.attributes.state_or_union_territory || fields.state_or_union_territory} onChange={value => setFields({ ...fields, state_or_union_territory: value })} required disabled={disabled || saving || Boolean(selectedRegistration)} /><label>GST status<select disabled={disabled || saving} value={fields.registration_status} onChange={event => setFields({ ...fields, registration_status: event.target.value, gst_registration_id: '' })}><option>UNREGISTERED</option><option>REGISTERED</option><option>COMPOSITION</option><option>OTHER</option></select></label>{registered ? <label>Approved Business GST registration<select required disabled={disabled || saving || !registrations.length} value={fields.gst_registration_id} onChange={event => { const selected = registrations.find(item => item.id === event.target.value); setFields({ ...fields, gst_registration_id: event.target.value, state_or_union_territory: selected?.attributes.state_or_union_territory || fields.state_or_union_territory, gstin: selected?.attributes.gstin || '' }); }}><option value="">{registrations.length ? 'Select an approved registration' : 'No approved registrations available'}</option>{registrations.map(item => <option key={item.id} value={item.id}>{item.attributes.gstin || 'GST registration'} · {item.attributes.state_or_union_territory} · {human(item.attributes.registration_category)}</option>)}</select>{selectedRegistration && <small>GSTIN {selectedRegistration.attributes.gstin || 'not returned'} · verified for Business billing use</small>}</label> : <label>GSTIN<input disabled value="Not applicable — GST not registered" /></label>}<div className="platform-form-actions"><Button type="button" disabled={disabled || saving || loading || (registered && (!registrations.length || !fields.gst_registration_id))} busy={saving} onClick={() => void save()}>Save billing context</Button></div></div></section>;
}

export function PlatformSubscriptionsPage({ capabilities }: { capabilities: string[] }) {
  const route = normalizePlatformHash(window.location.hash).slice(1);
  return route.startsWith('platform/subscription-billing') ? <PlatformSubscriptionBillingPage key={route} capabilities={capabilities} /> : <PlatformSubscriptionManager key={route} capabilities={capabilities} />;
}

function PlatformSubscriptionManager({ capabilities }: { capabilities: string[] }) {
  const route = normalizePlatformHash(window.location.hash).slice(1);
  const usageMode = route.startsWith('platform/subscription-usage');
  const requestMode = route.startsWith('platform/subscription-requests');
  const detailId = (requestMode || route.startsWith('platform/subscriptions/')) ? route.split('/')[2] : undefined;
  const review = useReviewReason(route);
  const [subscriptions, setSubscriptions] = useState<Resource<PlatformSubscription>[]>([]);
  const [requests, setRequests] = useState<Resource<PlatformSubscriptionRequest>[]>([]);
  const [providers, setProviders] = useState<Resource<PlatformProviderAttributes>[]>([]);
  const allProviders = useRef<Resource<PlatformProviderAttributes>[]>([]);
  const providersRead = useRef(0);
  const providersQuery = useRef('');
  const [providerSearch, setProviderSearch] = useState('');
  const [requestDialog, setRequestDialog] = useState(false);
  const [plans, setPlans] = useState<Resource<PlatformPlan>[]>([]);
  const [planSearch, setPlanSearch] = useState('');
  const [providerId, setProviderId] = useState('');
  const [planVersionId, setPlanVersionId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<Resource<PlatformSubscriptionRequest> | null>(null);
  const [activationRequest, setActivationRequest] = useState<Resource<PlatformSubscriptionRequest> | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<Resource<PlatformSubscription> | null>(null);
  const [relatedInvoices, setRelatedInvoices] = useState<Resource<PlatformSubscriptionInvoice>[]>([]);
  const [changes, setChanges] = useState<Resource<PlatformSubscriptionChange>[]>([]);
  const [selectedChange, setSelectedChange] = useState<Resource<PlatformSubscriptionChange> | null>(null);
  const [changeKind, setChangeKind] = useState('UPGRADE');
  const [changePlanVersionId, setChangePlanVersionId] = useState('');
  const [changeEvidenceReference, setChangeEvidenceReference] = useState('');
  const [changeEvidenceAmount, setChangeEvidenceAmount] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [evidenceAmount, setEvidenceAmount] = useState('');
  const [evidenceCurrency, setEvidenceCurrency] = useState('');
  const [changeEvidenceCurrency, setChangeEvidenceCurrency] = useState('');
  const [usage, setUsage] = useState<PlatformUsage | null>(null);
  const [usageSubscription, setUsageSubscription] = useState<Resource<PlatformSubscription> | null>(null);
  const [loading, setLoading] = useState(!usageMode);
  const { busy, error, setError, run } = useSubscriptionActions(route);
  const reads = useRef(new RequestGeneration());
  const detailReads = useRef(new RequestGeneration());
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [paging, setPaging] = useState(false);
  const [changeCursor, setChangeCursor] = useState<string | null>(null);
  const [changePaging, setChangePaging] = useState(false);
  const changeReads = useRef(new RequestGeneration());
  const [recordSearch, setRecordSearch] = useState('');
  const [recordStatus, setRecordStatus] = useState('');
  const [effectiveDateFrom, setEffectiveDateFrom] = useState('');
  const [effectiveDateThrough, setEffectiveDateThrough] = useState('');

  async function load(after?: string) {
    if (usageMode || !capabilities.includes('PLATFORM_SUBSCRIPTION_READ')) { setLoading(false); return; }
    if (detailId && !after) {
      setLoading(true); setError('');
      try {
        if (requestMode) {
          const result = await operationsData.platformSubscriptionRequest(detailId); setSelectedRequest(result.data);
          const current = await operationsData.platformSubscriptions({ providerId: result.data.attributes.provider_id }); setSubscriptions(current.data);
        } else {
          const result = await operationsData.platformSubscription(detailId); setSelectedSubscription(result.data);
          const [requestPage, changePage, invoicePage] = await Promise.all([operationsData.platformSubscriptionRequests({ providerId: result.data.attributes.provider_id }), operationsData.platformSubscriptionChanges({ providerId: result.data.attributes.provider_id }), operationsData.platformSubscriptionInvoices({ providerId: result.data.attributes.provider_id })]);
          setRequests(requestPage.data); setChanges(changePage.data); setRelatedInvoices(invoicePage.data);
        }
      }
      catch (cause) { setError(errorText(cause)); }
      finally { setLoading(false); }
      return;
    }
    const valid = reads.current.next();
    if (!after) { changeReads.current.invalidate(); setChangePaging(false); }
    if (after) setPaging(true); else setLoading(true);
    setError('');
    try {
      const page = requestMode ? await operationsData.platformSubscriptionRequests({ after }) : await operationsData.platformSubscriptions({ after });
      const changePage = !requestMode && !after ? await operationsData.platformSubscriptionChanges({}) : null;
      if (!valid()) return;
      if (requestMode) setRequests((rows) => after ? [...new Map([...rows, ...(page.data as Resource<PlatformSubscriptionRequest>[])].map((row) => [row.id, row])).values()] : page.data as Resource<PlatformSubscriptionRequest>[]);
      else { setSubscriptions((rows) => after ? [...new Map([...rows, ...(page.data as Resource<PlatformSubscription>[])].map((row) => [row.id, row])).values()] : page.data as Resource<PlatformSubscription>[]); if (changePage) { changeReads.current.invalidate(); setChanges(changePage.data); setChangeCursor(changePage.page?.next || null); } }
      setNextCursor(page.page?.next || null);
    } catch (cause) { if (valid()) setError(errorText(cause)); } finally { if (valid()) { setLoading(false); setPaging(false); } }
  }
  useEffect(() => {
    setSubscriptions([]); setRequests([]); setChanges([]); setNextCursor(null); setPaging(false); setChangeCursor(null); setChangePaging(false); setRecordSearch(''); setRecordStatus('');
    setSelectedRequest(null); setSelectedSubscription(null); setSelectedChange(null); setUsage(null); setRelatedInvoices([]);
    void load();
    const generation = reads.current; const details = detailReads.current;
    return () => { generation.invalidate(); details.invalidate(); changeReads.current.invalidate(); };
  }, [route]);
  useEffect(() => {
    let cancelled = false;
    providersQuery.current = '';
    allProviders.current = [];
    setProviders([]); setUsage(null); detailReads.current.invalidate();
    ++providersRead.current;
    collectPages((after) => operationsData.platformProviders({ after }), () => !cancelled)
      .then((result) => { if (!cancelled) { allProviders.current = result; if (providersQuery.current.length < 3) setProviders(result); } })
      .catch((cause) => { if (!cancelled) setError(errorText(cause)); });
    return () => { cancelled = true; };
  }, [route]);
  useEffect(() => {
    let cancelled = false;
    const query = providerSearch.trim();
    if (query.length < 3) {
      if (providersQuery.current.length >= 3) { providersQuery.current = ''; ++providersRead.current; setProviders(allProviders.current); }
      return;
    }
    providersQuery.current = query;
    const sequence = ++providersRead.current;
    const timer = window.setTimeout(() => {
      collectPages((after) => operationsData.platformProviders({ q: query, after }), () => !cancelled && sequence === providersRead.current)
        .then((result) => { if (!cancelled && sequence === providersRead.current) setProviders(result); })
        .catch((cause) => { if (!cancelled && sequence === providersRead.current) setError(errorText(cause)); });
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [providerSearch, route]);
  useEffect(() => {
    let cancelled = false;
    if (capabilities.includes('PLATFORM_PLAN_READ')) collectPages((after) => operationsData.platformPlans({ status: 'ACTIVE', after }), () => !cancelled).then((result) => { if (!cancelled) setPlans(result); }).catch((cause) => { if (!cancelled) setError(errorText(cause)); });
    return () => { cancelled = true; };
  }, [route, capabilities.includes('PLATFORM_PLAN_READ')]);

  const providerOptions = providers.map((provider) => ({ id: provider.id, label: provider.attributes.display_name, detail: provider.attributes.provider_code || human(provider.attributes.status) }));
  const planVersionLabels = new Map(plans.flatMap(plan => (plan.attributes.versions || (plan.attributes.latest_version ? [plan.attributes.latest_version] : [])).map(version => [version.id, `${plan.attributes.name} · v${version.attributes.version_number}`] as const)));
  const planVersionLabel = (id: string) => planVersionLabels.get(id) || id;
  const planOptions = plans.flatMap((plan) => (plan.attributes.versions || (plan.attributes.latest_version ? [plan.attributes.latest_version] : [])).filter((version) => version.attributes.status === 'PUBLISHED').map((version) => ({ id: version.id, label: `${plan.attributes.name} · v${version.attributes.version_number}`, detail: `${version.attributes.currency_code} ${Number(version.attributes.price_amount).toLocaleString('en-IN')} / ${human(version.attributes.billing_interval)}` })));

  if (usageMode && !capabilities.includes('PLATFORM_SUBSCRIPTION_USAGE_READ')) return <StatePanel title="Usage access is restricted">The server did not project subscription usage capability.</StatePanel>;
  if (!usageMode && !capabilities.includes('PLATFORM_SUBSCRIPTION_READ')) return <StatePanel title="Subscription access is restricted">The server did not project subscription read capability.</StatePanel>;
  if (loading) return <StatePanel title="Loading subscriptions">Retrieving current commercial state…</StatePanel>;

  async function loadMoreChanges() {
    if (!changeCursor || changePaging) return;
    const valid = changeReads.current.next(); setChangePaging(true); setError('');
    try { const page = await operationsData.platformSubscriptionChanges({ after: changeCursor });
      if (valid()) { setChanges(rows => [...new Map([...rows, ...page.data].map(row => [row.id, row])).values()]); setChangeCursor(page.page?.next || null); }
    } catch (cause) { if (valid()) setError(errorText(cause)); }
    finally { if (valid()) setChangePaging(false); }
  }

  async function loadUsage(event: FormEvent) {
    event.preventDefault(); const valid = detailReads.current.next(); setError(''); setUsage(null); setUsageSubscription(null);
    try { const result = await operationsData.platformSubscriptionUsage(providerId.trim()); if (valid()) { setUsage(result.data); if (result.data.subscription_id) { const subscription = await operationsData.platformSubscription(result.data.subscription_id); if (valid()) setUsageSubscription(subscription.data); } } }
    catch (cause) { if (valid()) setError(errorText(cause)); }
  }

  async function createRequest(event: FormEvent) {
    event.preventDefault();
    const body = { plan_version_id: planVersionId.trim(), requested_effective_from: indiaDateTimeToIso(effectiveFrom) };
    await run(JSON.stringify(['request', providerId, body]), (key) => operationsData.createPlatformSubscriptionRequest(providerId.trim(), body, key), async () => { setProviderId(''); setPlanVersionId(''); setEffectiveFrom(''); setRequestDialog(false); await load(); });
  }

  async function openRequest(id: string) {
    const valid = detailReads.current.next(); setSelectedRequest(null); setEvidenceReference(''); setEvidenceAmount(''); setEvidenceCurrency(''); setError('');
    try { const result = await operationsData.platformSubscriptionRequest(id); if (valid()) setSelectedRequest(result.data); }
    catch (cause) { if (valid()) setError(errorText(cause)); }
  }
  async function openSubscription(id: string) {
    const valid = detailReads.current.next(); setSelectedSubscription(null); setError('');
    try { const result = await operationsData.platformSubscription(id); if (valid()) setSelectedSubscription(result.data); }
    catch (cause) { if (valid()) setError(errorText(cause)); }
  }
  async function openChange(id: string) {
    const valid = detailReads.current.next(); setSelectedChange(null); setChangeEvidenceReference(''); setChangeEvidenceAmount(''); setChangeEvidenceCurrency(''); setError('');
    try { const result = await operationsData.platformSubscriptionChange(id); if (valid()) setSelectedChange(result.data); }
    catch (cause) { if (valid()) setError(errorText(cause)); }
  }
  async function submitEvidence(event: FormEvent) {
    event.preventDefault(); if (!selectedRequest) return;
    const id = selectedRequest.id;
    let body;
    try { body = transactionEvidencePayload(evidenceReference, evidenceAmount, evidenceCurrency); } catch (cause) { setError(errorText(cause)); return; }
    await run(JSON.stringify(['evidence', id, body]), (key) => operationsData.submitPlatformSubscriptionEvidence(id, body, key), async () => { setEvidenceReference(''); setEvidenceAmount(''); await openRequest(id); });
  }
  async function reviewEvidence(id: string, decision: 'VERIFIED' | 'REJECTED' | 'CORRECTIONS_REQUESTED') {
    if (!selectedRequest) return;
    const requestId = selectedRequest.id;
    const reason = await review.ask(`${human(decision)} payment evidence`); if (reason === null) return;
    await run(JSON.stringify(['review', id, decision, reason]), (key) => operationsData.reviewPlatformSubscriptionEvidence(requestId, id, { decision, reason }, key), () => openRequest(requestId));
  }
  async function createChange(event: FormEvent) {
    event.preventDefault(); if (!selectedSubscription) return;
    const id = selectedSubscription.id;
    const body = { change_kind: changeKind, ...(changeKind === 'CANCELLATION' ? {} : { plan_version_id: changePlanVersionId.trim() }), expected_revision: selectedSubscription.attributes.revision };
    await run(JSON.stringify(['change', id, body]), (key) => operationsData.createPlatformSubscriptionChange(id, body, key), async () => { setChangePlanVersionId(''); await load(); await openSubscription(id); });
  }
  async function submitChangeEvidence(event: FormEvent) {
    event.preventDefault(); if (!selectedChange) return;
    const id = selectedChange.id;
    let body;
    try { body = transactionEvidencePayload(changeEvidenceReference, changeEvidenceAmount, changeEvidenceCurrency); } catch (cause) { setError(errorText(cause)); return; }
    await run(JSON.stringify(['change-evidence', id, body]), (key) => operationsData.submitPlatformSubscriptionChangeEvidence(id, body, key), async () => { setChangeEvidenceReference(''); setChangeEvidenceAmount(''); await openChange(id); });
  }
  async function reviewChangeEvidence(id: string, decision: 'VERIFIED' | 'REJECTED' | 'CORRECTIONS_REQUESTED') {
    if (!selectedChange) return;
    const changeId = selectedChange.id;
    const reason = await review.ask(`${human(decision)} change evidence`); if (reason === null) return;
    await run(JSON.stringify(['change-review', id, decision, reason]), (key) => operationsData.reviewPlatformSubscriptionChangeEvidence(changeId, id, { decision, reason }, key), () => openChange(changeId));
  }
  async function decide(record: Resource<PlatformSubscriptionRequest>, decision: 'APPROVED' | 'REJECTED') {
    const reason = await review.ask(`${human(decision)} subscription request`); if (reason === null) return;
    const body = { decision, expected_revision: record.attributes.revision, reason };
    await run(JSON.stringify(['decision', record.id, body]), (key) => operationsData.decidePlatformSubscriptionRequest(record.id, body, key), async () => { setSelectedRequest(null); await load(); });
  }
  async function activate(record: Resource<PlatformSubscriptionRequest>) {
    setActivationRequest(record);
  }
  async function confirmActivation() {
    if (!activationRequest) return;
    const record = activationRequest;
    await run(`activate-${record.id}`, (key) => operationsData.activatePlatformSubscription(record.id, key), async () => {
      setActivationRequest(null);
      await load();
    });
  }
  async function decideChange(change: Resource<PlatformSubscriptionChange>, decision: 'APPROVED' | 'REJECTED') {
    const reason = await review.ask(`${human(decision)} subscription change`); if (reason === null) return;
    const body = { decision, expected_revision: change.attributes.revision, reason };
    await run(JSON.stringify(['change-decision', change.id, body]), (key) => operationsData.decidePlatformSubscriptionChange(change.id, body, key), async () => { await load(); await openChange(change.id); });
  }
  async function applyChange(change: Resource<PlatformSubscriptionChange>) {
    await run(`apply-${change.id}`, (key) => operationsData.applyPlatformSubscriptionChange(change.id, key), async () => { await load(); await openChange(change.id); setSelectedSubscription(null); });
  }

  if (usageMode) return <section className="platform-page"><AdminPageHeader breadcrumbs={[{ label: 'Platform Overview', href: 'platform/overview' }, { label: 'Subscriptions', href: 'platform/subscriptions' }, { label: 'Usage & Limits' }]} eyebrow="Platform administration / Subscriptions" title="Usage & Limits" description="Authoritative usage by provider subscription. Managed elevators are deduplicated across installation and AMC." /><AdminFilterBar onSubmit={loadUsage}><SearchableSelect disabled={busy} label="Provider" searchLabel="Search providers" search={providerSearch} onSearch={setProviderSearch} value={providerId} onChange={setProviderId} options={providerOptions} placeholder="Select a provider" /><Button type="submit" busy={busy}>Load usage</Button></AdminFilterBar>{error && <StatePanel title="Usage unavailable">{error}</StatePanel>}{usage && <><DetailSection title={providerOptions.find(option => option.id === usage.provider_id)?.label || 'Selected provider'}><dl className="platform-definition-list"><dt>Subscription status</dt><dd>{usageSubscription ? <Status>{human(usageSubscription.attributes.status)}</Status> : 'No active subscription returned'}</dd><dt>Plan</dt><dd>{usageSubscription ? planVersionLabel(usageSubscription.attributes.plan_version_id) : 'No active plan returned'}</dd><dt>Billing period</dt><dd>{usageSubscription ? `${formatIndiaDate(usageSubscription.attributes.effective_from)} – ${usageSubscription.attributes.effective_to ? formatIndiaDate(usageSubscription.attributes.effective_to) : 'Open-ended'}` : 'Not available'}</dd><dt>Calculated at</dt><dd>{formatIndiaDateTime(usage.observed_at)}</dd><dt>Calculation policy</dt><dd>{usage.calculation_policy_version}</dd></dl></DetailSection><div className="plan-detail-grid">{Object.entries(usage.metrics).map(([key, metric]) => { const hasLimit = Boolean(metric.limit); const finite = hasLimit && !metric.limit?.unlimited && typeof metric.limit?.value === 'number'; const percentage = finite && metric.limit?.value ? Math.min(100, Math.round(metric.value / metric.limit.value * 100)) : 0; return <DetailSection key={key} title={human(key)}><strong className="plan-price">{metric.value}</strong><p>{!hasLimit ? 'No active entitlement available' : metric.limit?.unlimited ? 'Unlimited allowance' : `${metric.value} / ${metric.limit?.value} included`}</p>{finite && <div className="usage-meter" role="progressbar" aria-label={`${human(key)} utilization`} aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percentage}%` }} /></div>}<dl className="platform-definition-list">{finite && <><dt>Remaining</dt><dd>{metric.remaining}</dd></>}{Object.entries(metric.components).map(([name, value]) => <Fragment key={name}><dt>{human(name)}</dt><dd>{value}</dd></Fragment>)}</dl>{metric.exceeded && <Status>Limit exceeded</Status>}</DetailSection>; })}</div></>}</section>;

  const matches = (record: Resource<PlatformSubscriptionRequest | PlatformSubscription | PlatformSubscriptionChange>) => matchesSubscriptionHistory({ provider: `${record.attributes.provider?.display_name || ''} ${record.attributes.provider?.provider_code || ''} ${record.attributes.provider_id}`, status: record.attributes.status, date: 'requested_effective_from' in record.attributes ? record.attributes.requested_effective_from : 'requested_effective_at' in record.attributes ? record.attributes.requested_effective_at : record.attributes.effective_from }, { query: recordSearch, status: recordStatus, from: effectiveDateFrom, through: effectiveDateThrough });
  const visibleRequests = requests.filter(matches); const visibleSubscriptions = subscriptions.filter(matches); const visibleChanges = changes.filter(matches);
  const selectedRequestHasActiveSubscription = selectedRequest ? subscriptions.some((item) => item.attributes.provider_id === selectedRequest.attributes.provider_id && item.attributes.status === 'ACTIVE') : false;
  const records = requestMode ? requests : subscriptions;
  const dueChanges = dueSubscriptionChanges(changes);
  return <section className="platform-page">{review.modal}{activationRequest && <OperationsDialog title="Confirm subscription activation" busy={Boolean(busy)} onClose={() => setActivationRequest(null)}><p>Activate the approved subscription for this provider? The server will recheck the effective date, payment state, plan compatibility, and provider eligibility before creating the active subscription record.</p><dl className="platform-definition-list"><dt>Provider</dt><dd>{activationRequest.attributes.provider?.display_name || 'Selected provider'}</dd><dt>Plan</dt><dd>{planVersionLabel(activationRequest.attributes.plan_version_id)}</dd><dt>Requested start</dt><dd>{formatIndiaDateTime(activationRequest.attributes.requested_effective_from)}</dd></dl><div className="platform-form-actions"><Button type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => setActivationRequest(null)}>Cancel</Button><Button type="button" busy={Boolean(busy)} onClick={() => void confirmActivation()}>Confirm activation</Button></div></OperationsDialog>}<AdminPageHeader breadcrumbs={[{ label: 'Platform Overview', href: 'platform/overview' }, { label: 'Subscriptions', href: requestMode ? 'platform/subscription-requests' : 'platform/subscriptions' }, { label: requestMode ? 'Requests & Approvals' : 'Provider Subscriptions' }]} eyebrow="Platform administration / Subscriptions" title={detailId ? (requestMode ? 'Review subscription request' : 'Subscription details') : (requestMode ? 'Requests & Approvals' : 'Provider Subscriptions')} description={requestMode ? 'Approval, payment evidence and activation remain separate audited decisions.' : 'Accepted commercial snapshots and current activation state.'} action={requestMode && !detailId && capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') ? <Button onClick={() => setRequestDialog(true)}>New request</Button> : undefined} />
    {detailId && <Button variant="secondary" onClick={() => go(requestMode ? 'platform/subscription-requests' : 'platform/subscriptions')}>Back to list</Button>}
    {detailId && !requestMode && <nav className="admin-detail-tabs" aria-label="Subscription details"><a href="#subscription-overview">Overview</a><a href="#subscription-plan">Plan &amp; Entitlements</a><a href="#subscription-usage">Usage</a><a href="#subscription-changes">Change Requests</a><a href="#subscription-billing">Billing</a><a href="#subscription-audit">Audit History</a></nav>}
    {error && <StatePanel title="Subscription action needs attention">{error}</StatePanel>}
    {requestDialog && <OperationsDialog title="New subscription request" busy={busy} onClose={() => setRequestDialog(false)}>{error && <StatePanel title="Request needs attention">{error}</StatePanel>}<form className="platform-filter-toolbar subscription-request-form" onSubmit={createRequest}><SearchableSelect disabled={busy} label="Provider" searchLabel="Search providers" search={providerSearch} onSearch={setProviderSearch} value={providerId} onChange={setProviderId} options={providerOptions} placeholder="Select a provider" /><SearchableSelect disabled={busy} label="Published plan" searchLabel="Search plans" search={planSearch} onSearch={setPlanSearch} value={planVersionId} onChange={setPlanVersionId} options={planOptions} placeholder="Select a published plan" /><label>Effective from<input disabled={busy} required type="datetime-local" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /></label><div className="platform-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setRequestDialog(false)}>Cancel</Button><Button type="submit" busy={busy}>Create request</Button></div></form></OperationsDialog>}
    {!detailId && <AdminFilterBar onSubmit={(event) => event.preventDefault()}><label>Filter loaded providers<input type="search" value={recordSearch} onChange={event => setRecordSearch(event.target.value)} /></label><label>Loaded record status<select value={recordStatus} onChange={event => setRecordStatus(event.target.value)}><option value="">All statuses</option>{[...new Set([...records, ...changes].map(row => row.attributes.status))].sort().map(status => <option key={status}>{status}</option>)}</select></label><label>Effective from<input type="date" value={effectiveDateFrom} onChange={event => setEffectiveDateFrom(event.target.value)} /></label><label>Effective through<input type="date" value={effectiveDateThrough} onChange={event => setEffectiveDateThrough(event.target.value)} /></label><span>Filters search loaded pages only. Load more to expand results.</span></AdminFilterBar>}
    {!detailId && (!records.length ? (!error && <AdminEmptyState title={requestMode ? 'No subscription requests' : 'No provider subscriptions'} description="No records are available on this page. Adjust filters or load another page." />) : <AdminDataTable><table className="platform-provider-table"><thead><tr><th>{requestMode ? 'Provider' : 'Provider name and code'}</th><th>{requestMode ? 'Requested plan' : 'Subscription plan and version'}</th><th>{requestMode ? 'Request status' : 'Subscription state'}</th><th>{requestMode ? 'Effective date' : 'Effective / expiry'}</th><th>Actions</th></tr></thead><tbody>{requestMode ? visibleRequests.map((record) => <tr key={record.id}><td><strong>{record.attributes.provider?.display_name || 'Provider'}</strong><small>{record.attributes.provider?.provider_code || record.attributes.provider_id}</small></td><td>{planVersionLabel(record.attributes.plan_version_id)}</td><td><Status>{human(record.attributes.status)}</Status></td><td>{formatIndiaDate(record.attributes.requested_effective_from)}</td><td><AdminActionMenu label={`Actions for ${record.attributes.provider?.display_name || 'subscription request'}`}><button type="button" onClick={() => go(`platform/subscription-requests/${record.id}`)}>Review</button></AdminActionMenu></td></tr>) : visibleSubscriptions.map((record) => <tr key={record.id}><td><strong>{record.attributes.provider?.display_name || 'Provider'}</strong><small>{record.attributes.provider?.provider_code || record.attributes.provider_id}</small></td><td>{planVersionLabel(record.attributes.plan_version_id)}</td><td><Status>{human(record.attributes.status)}</Status></td><td>{formatIndiaDate(record.attributes.effective_from)}<small>{record.attributes.effective_to ? `Expires ${formatIndiaDate(record.attributes.effective_to)}` : 'No expiry returned'}</small></td><td><AdminActionMenu label={`Actions for ${record.attributes.provider?.display_name || 'subscription'}`}><button type="button" onClick={() => go(`platform/subscriptions/${record.id}`)}>View details</button></AdminActionMenu></td></tr>)}</tbody></table>{(requestMode ? visibleRequests.length : visibleSubscriptions.length) === 0 && <AdminEmptyState title="No records match" description="The loaded records do not match these filters. Load more pages or reset the filters." />}</AdminDataTable>)}
    {!detailId && <AdminPagination shown={requestMode ? visibleRequests.length : visibleSubscriptions.length} scope={`matching / ${records.length} records loaded`} hasMore={Boolean(nextCursor)} busy={paging} onLoadMore={() => void load(nextCursor || undefined)} />}
    {!requestMode && selectedSubscription && <div id="subscription-usage"><SubscriptionAlerts validity={selectedSubscription.attributes.validity} usage={selectedSubscription.attributes.usage} /></div>}
    {!requestMode && selectedSubscription && <div id="subscription-overview"><DetailSection title={`${selectedSubscription.attributes.provider.display_name} subscription`}><dl className="platform-definition-list"><dt>Provider code</dt><dd>{selectedSubscription.attributes.provider.provider_code || 'Not supplied'}</dd><dt>Provider status</dt><dd><Status>{human(selectedSubscription.attributes.provider.status)}</Status></dd><dt>Subscription status</dt><dd><Status>{human(selectedSubscription.attributes.status)}</Status></dd><dt>Approval</dt><dd>{human(selectedSubscription.attributes.approval_state)}</dd><dt>Payment evidence</dt><dd>{human(selectedSubscription.attributes.payment_state)}</dd><dt>Effective from</dt><dd>{formatIndiaDateTime(selectedSubscription.attributes.effective_from)}</dd><dt>Expiry / renewal</dt><dd>{selectedSubscription.attributes.effective_to ? formatIndiaDateTime(selectedSubscription.attributes.effective_to) : 'No expiry returned'}</dd><dt>Plan version</dt><dd>{planVersionLabel(selectedSubscription.attributes.plan_version_id)}</dd><dt>Price snapshot</dt><dd>{selectedSubscription.attributes.commercial_snapshot.currency_code || ''} {selectedSubscription.attributes.commercial_snapshot.price_amount || 'Not returned'} / {human(selectedSubscription.attributes.commercial_snapshot.billing_interval || 'not returned')}</dd><dt>Included limits</dt><dd>{selectedSubscription.attributes.commercial_snapshot.limits?.map(limit => `${human(limit.metric_key)}: ${limit.unlimited ? 'Unlimited' : limit.value}`).join(' · ') || 'No entitlement snapshot returned'}</dd></dl>{capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && <form className="platform-filter-toolbar" onSubmit={createChange}><label>Change<select disabled={busy} value={changeKind} onChange={(event) => setChangeKind(event.target.value)}><option>UPGRADE</option><option>DOWNGRADE</option><option>RENEWAL</option><option>CANCELLATION</option></select></label>{changeKind !== 'CANCELLATION' && <SearchableSelect disabled={busy} label="Target plan" searchLabel="Search plans" search={planSearch} onSearch={setPlanSearch} value={changePlanVersionId} onChange={setChangePlanVersionId} options={planOptions} placeholder="Select a published plan" />}<Button type="submit" busy={busy}>Request change</Button></form>}</DetailSection></div>}
    {!requestMode && detailId && selectedSubscription && <><div id="subscription-plan"><DetailSection title="Plan & entitlements"><p>{planVersionLabel(selectedSubscription.attributes.plan_version_id)}</p><ul>{selectedSubscription.attributes.commercial_snapshot.limits?.map(limit => <li key={limit.metric_key}>{human(limit.metric_key)}: {limit.unlimited ? 'Unlimited' : limit.value}</li>) || <li>No entitlement snapshot returned</li>}</ul></DetailSection></div><div id="subscription-changes"><DetailSection title="Change requests">{changes.length ? <ul>{changes.map(item => <li key={item.id}>{human(item.attributes.change_kind)} · {human(item.attributes.status)} · {planVersionLabel(item.attributes.to_plan_version_id || '')} · effective {formatIndiaDateTime(item.attributes.requested_effective_at)}</li>)}</ul> : <AdminEmptyState title="No related change requests returned" description="The provider-scoped change endpoint returned no subscription changes." />}</DetailSection></div><div id="subscription-billing"><DetailSection title="Billing">{relatedInvoices.length ? <AdminDataTable><table className="platform-provider-table"><thead><tr><th>Invoice</th><th>Total</th><th>Collection state</th><th>Due date</th></tr></thead><tbody>{relatedInvoices.map(invoice => <tr key={invoice.id}><td><button className="admin-inline-link" onClick={() => go(`platform/subscription-billing/${invoice.id}`)}>{invoice.attributes.invoice_number}</button></td><td>{invoice.attributes.currency_code} {invoice.attributes.total_amount}</td><td><Status>{human(invoice.attributes.collection_state)}</Status></td><td>{formatIndiaDate(invoice.attributes.due_at)}</td></tr>)}</tbody></table></AdminDataTable> : <AdminEmptyState title="No billing records returned" description="The provider-scoped invoice endpoint returned no records." />}</DetailSection></div><div id="subscription-audit"><DetailSection title="Audit History"><AdminEmptyState title="Audit history is unavailable" description="The subscription detail contract does not return audit events, and no separate authorized audit endpoint is available here." /></DetailSection></div></>}
    {!detailId && !requestMode && <DetailSection title="Due-change review queue" description="Approved or scheduled changes in loaded pages whose requested effective time has arrived. Payment verification and backend eligibility may still block application.">{dueChanges.length ? <ul>{dueChanges.map(change => <li key={change.id}>{change.attributes.provider.display_name} · {human(change.attributes.change_kind)} <Button variant="quiet" disabled={busy} onClick={() => void openChange(change.id)}>Inspect eligibility and evidence</Button></li>)}</ul> : <p>No due changes in loaded pages.</p>}</DetailSection>}
    {!detailId && !requestMode && changes.length > 0 && <DetailSection title="Subscription changes" description="Loaded change history. The backend rechecks payment, revision and effective-time eligibility when applying a change."><div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Provider</th><th>Change</th><th>Status</th><th>Effective</th><th>Actions</th></tr></thead><tbody>{visibleChanges.map((change) => <tr key={change.id}><td>{change.attributes.provider.display_name}</td><td>{human(change.attributes.change_kind)}</td><td><Status>{human(change.attributes.status)}</Status></td><td>{formatIndiaDateTime(change.attributes.requested_effective_at)}</td><td><AdminActionMenu label={`Actions for ${change.attributes.provider.display_name}`}><button type="button" disabled={busy} onClick={() => void openChange(change.id)}>Manage</button>{change.attributes.status === 'PENDING_REVIEW' && capabilities.includes('PLATFORM_SUBSCRIPTION_REVIEW') && <><button type="button" disabled={busy} onClick={() => void decideChange(change, 'APPROVED')}>Approve</button><button type="button" disabled={busy} onClick={() => void decideChange(change, 'REJECTED')}>Reject</button></>}{['APPROVED', 'SCHEDULED'].includes(change.attributes.status) && capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && <button type="button" disabled={busy} onClick={() => void applyChange(change)}>Apply when eligible</button>}</AdminActionMenu></td></tr>)}</tbody></table></div></DetailSection>}
    {!detailId && !requestMode && <div className="platform-pagination"><span>{visibleChanges.length} matching / {changes.length} changes loaded</span>{changeCursor && <Button busy={changePaging} disabled={busy || changePaging} onClick={() => void loadMoreChanges()}>Load more changes</Button>}</div>}
    {!requestMode && selectedChange && <DetailSection title={`${human(selectedChange.attributes.change_kind)} evidence`}><p>{selectedChange.attributes.provider.display_name} · effective {formatIndiaDateTime(selectedChange.attributes.requested_effective_at)}</p>{capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && <form className="platform-filter-toolbar" onSubmit={submitChangeEvidence}><label>Transaction reference<input disabled={busy} required value={changeEvidenceReference} onChange={(event) => setChangeEvidenceReference(event.target.value)} /></label><label>Stated amount<input disabled={busy} type="number" min="0" step="0.0001" value={changeEvidenceAmount} onChange={(event) => setChangeEvidenceAmount(event.target.value)} /></label><label>Currency code<input disabled={busy} required={Boolean(changeEvidenceAmount)} pattern="[A-Za-z]{3}" maxLength={3} placeholder="Currency of payment" value={changeEvidenceCurrency} onChange={(event) => setChangeEvidenceCurrency(event.target.value)} /></label><Button type="submit" busy={busy}>Append evidence</Button></form>}{!selectedChange.attributes.evidence?.length ? <p>No evidence submitted.</p> : <div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Kind</th><th>Reference</th><th>Review</th><th>Actions</th></tr></thead><tbody>{selectedChange.attributes.evidence.map((evidence) => <tr key={evidence.id}><td>{human(evidence.attributes.evidence_kind)}</td><td>{evidence.attributes.external_reference || 'Document evidence'}</td><td><Status>{human(evidence.attributes.review_state)}</Status><EvidenceReviewFeedback reviews={evidence.attributes.reviews} /></td><td>{evidence.attributes.review_state === 'EVIDENCE_SUBMITTED' && capabilities.includes('PLATFORM_SUBSCRIPTION_REVIEW') && <AdminActionMenu label="Evidence actions"><button type="button" disabled={busy} onClick={() => void reviewChangeEvidence(evidence.id, 'VERIFIED')}>Verify</button><button type="button" disabled={busy} onClick={() => void reviewChangeEvidence(evidence.id, 'REJECTED')}>Reject</button><button type="button" disabled={busy} onClick={() => void reviewChangeEvidence(evidence.id, 'CORRECTIONS_REQUESTED')}>Request correction</button></AdminActionMenu>}</td></tr>)}</tbody></table></div>}</DetailSection>}
    {requestMode && selectedRequest && <><DetailSection title="Current subscription"><dl className="platform-definition-list">{subscriptions.find(item => item.attributes.provider_id === selectedRequest.attributes.provider_id) ? <><dt>Plan version</dt><dd>{planVersionLabel(subscriptions.find(item => item.attributes.provider_id === selectedRequest.attributes.provider_id)!.attributes.plan_version_id)}</dd><dt>State</dt><dd><Status>{human(subscriptions.find(item => item.attributes.provider_id === selectedRequest.attributes.provider_id)!.attributes.status)}</Status></dd><dt>Effective period</dt><dd>{formatIndiaDate(subscriptions.find(item => item.attributes.provider_id === selectedRequest.attributes.provider_id)!.attributes.effective_from)} – {subscriptions.find(item => item.attributes.provider_id === selectedRequest.attributes.provider_id)!.attributes.effective_to ? formatIndiaDate(subscriptions.find(item => item.attributes.provider_id === selectedRequest.attributes.provider_id)!.attributes.effective_to!) : 'Open-ended'}</dd></> : <dt>No current subscription returned</dt>}</dl></DetailSection><DetailSection title="Request review"><dl className="platform-definition-list"><dt>Provider</dt><dd>{selectedRequest.attributes.provider.display_name} · {selectedRequest.attributes.provider.provider_code || selectedRequest.attributes.provider_id}</dd><dt>Request type</dt><dd>Plan subscription request</dd><dt>Requested plan</dt><dd>{planVersionLabel(selectedRequest.attributes.plan_version_id)}</dd><dt>Status</dt><dd><Status>{human(selectedRequest.attributes.status)}</Status></dd><dt>Effective date</dt><dd>{formatIndiaDateTime(selectedRequest.attributes.requested_effective_from)}</dd><dt>Submitted by</dt><dd>{selectedRequest.attributes.requested_by_user_id}</dd><dt>Reason / remarks</dt><dd>{selectedRequest.attributes.note || 'No remarks supplied'}</dd><dt>Payment state</dt><dd>{selectedRequest.attributes.evidence?.map(item => human(item.attributes.review_state)).join(', ') || 'No payment evidence submitted'}</dd></dl><div className="platform-form-actions">{selectedRequest.attributes.status === 'PENDING_REVIEW' && capabilities.includes('PLATFORM_SUBSCRIPTION_REVIEW') && <><Button disabled={busy} onClick={() => void decide(selectedRequest, 'APPROVED')}>Approve</Button><Button variant="danger" disabled={busy} onClick={() => void decide(selectedRequest, 'REJECTED')}>Reject</Button></>}{selectedRequest.attributes.status === 'APPROVED' && !selectedRequestHasActiveSubscription && capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && <Button disabled={busy} onClick={() => void activate(selectedRequest)}>Activate subscription</Button>}{selectedRequestHasActiveSubscription && <Status>Subscription active</Status>}</div></DetailSection><DetailSection title="Approval history">{selectedRequest.attributes.decisions?.length ? <ul className="platform-audit-list">{selectedRequest.attributes.decisions.map((decision, index) => <li key={`${decision.decided_at}-${index}`}><strong>{human(decision.decision)}</strong><p>{decision.reason || 'No reason recorded'}</p><time dateTime={decision.decided_at}>{formatIndiaDateTime(decision.decided_at)}</time></li>)}</ul> : <AdminEmptyState title="No approval decision recorded" description="The request has not yet returned a recorded decision." />}</DetailSection><DetailSection title="Payment evidence and verification">{capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && <form className="platform-filter-toolbar" onSubmit={submitEvidence}><label>Transaction reference<input disabled={busy} required value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} /></label><label>Stated amount<input disabled={busy} type="number" min="0" step="0.0001" value={evidenceAmount} onChange={(event) => setEvidenceAmount(event.target.value)} /></label><label>Currency code<input disabled={busy} required={Boolean(evidenceAmount)} pattern="[A-Za-z]{3}" maxLength={3} placeholder="Currency code" value={evidenceCurrency} onChange={(event) => setEvidenceCurrency(event.target.value)} /></label><Button type="submit" busy={busy}>Append evidence</Button></form>}{!selectedRequest.attributes.evidence?.length ? <p>No evidence submitted.</p> : <div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Kind</th><th>Reference</th><th>Review</th><th>Actions</th></tr></thead><tbody>{selectedRequest.attributes.evidence.map((evidence) => <tr key={evidence.id}><td>{human(evidence.attributes.evidence_kind)}</td><td>{evidence.attributes.external_reference || 'Document evidence'}</td><td><Status>{human(evidence.attributes.review_state)}</Status><EvidenceReviewFeedback reviews={evidence.attributes.reviews} /></td><td>{evidence.attributes.review_state === 'EVIDENCE_SUBMITTED' && capabilities.includes('PLATFORM_SUBSCRIPTION_REVIEW') && <AdminActionMenu label="Evidence actions"><button type="button" disabled={busy} onClick={() => void reviewEvidence(evidence.id, 'VERIFIED')}>Verify</button><button type="button" disabled={busy} onClick={() => void reviewEvidence(evidence.id, 'REJECTED')}>Reject</button><button type="button" disabled={busy} onClick={() => void reviewEvidence(evidence.id, 'CORRECTIONS_REQUESTED')}>Request correction</button></AdminActionMenu>}</td></tr>)}</tbody></table></div>}</DetailSection></>}
  </section>;
}

function InvoiceSummaryRail({ subscription, taxPreview, dueAt }: { subscription?: Resource<PlatformSubscription>; taxPreview: Record<string, unknown> | null; dueAt: string }) {
  const tax = taxPreview?.tax as Record<string, unknown> | undefined;
  const currency = String(taxPreview?.currency_code || subscription?.attributes.commercial_snapshot.currency_code || 'INR');
  const base = subscription?.attributes.commercial_snapshot.price_amount;
  const total = tax?.grand_total || taxPreview?.grand_total;
  return <aside className="invoice-summary-rail" aria-label="Invoice summary"><h2>Invoice summary</h2><strong>{subscription?.attributes.provider.display_name || 'Select a subscription'}</strong><small>{subscription ? `${human(subscription.attributes.commercial_snapshot.billing_interval || 'MONTH')} subscription · ${currency}` : 'Select a subscription to continue'}</small><dl><dt>Subscription charge</dt><dd>{money(base, currency)}</dd><dt>Add-ons</dt><dd>{money(0, currency)}</dd><dt>Taxable amount</dt><dd>{money(tax?.taxable_amount || taxPreview?.subtotal_amount, currency)}</dd><dt>GST</dt><dd>{money(tax?.total_tax || taxPreview?.total_tax, currency)}</dd><dt>Payment due</dt><dd>{dueAt ? formatIndiaDate(indiaDateTimeToDate(dueAt)) : 'Not set'}</dd></dl><div className="invoice-summary-total"><span>Estimated total payable</span><strong>{money(total, currency)}</strong></div><p>Totals are calculated by the server tax-preview API.</p></aside>;
}

type InvoiceDetailTab = 'overview' | 'pdf' | 'payments' | 'activity';

function InvoiceDetailTabs({ selected, active, setActive, pdfUrl, pdfModal, openPdf, downloadPdf, emailInvoice, resendInvoice, onEditDraft, reference, setReference, submitEvidence, reviewEvidence, publishInvoice, markPaid, canWrite, canReview, busy }: {
  selected: Resource<PlatformSubscriptionInvoice>;
  active: InvoiceDetailTab;
  setActive: (tab: InvoiceDetailTab) => void;
  pdfUrl: string | null;
  pdfModal: boolean;
  openPdf: () => void;
  downloadPdf: () => void;
  emailInvoice: () => void;
  resendInvoice: () => void;
  onEditDraft: () => void;
  reference: string;
  setReference: (value: string) => void;
  submitEvidence: (event: FormEvent) => void;
  reviewEvidence: (id: string, decision: 'VERIFIED' | 'REJECTED' | 'CORRECTIONS_REQUESTED') => void;
  publishInvoice: () => void;
  markPaid: () => void;
  canWrite: boolean;
  canReview: boolean;
  busy: boolean;
}) {
  const tax = selected.attributes.tax;
  const verified = selected.attributes.evidence?.some(item => item.attributes.review_state === 'VERIFIED');
  return <section className="invoice-tabs-panel">
    <nav className="invoice-detail-tabs" aria-label="Invoice detail sections">{([['overview', 'Overview'], ['pdf', 'PDF Preview'], ['payments', 'Payments & Delivery'], ['activity', 'Activity History']] as Array<[InvoiceDetailTab, string]>).map(([key, label]) => <button type="button" key={key} className={active === key ? 'active' : ''} aria-current={active === key ? 'page' : undefined} onClick={() => setActive(key)}>{label}</button>)}</nav>
    {active === 'overview' && <div className="invoice-tab-content"><DetailSection title="Overview"><dl className="platform-definition-list"><dt>Provider</dt><dd>{selected.attributes.provider.display_name}</dd><dt>Invoice number</dt><dd>{selected.attributes.invoice_number}</dd><dt>Status</dt><dd><Status>{human(selected.attributes.status)}</Status></dd><dt>Due date</dt><dd>{formatIndiaDateTime(selected.attributes.due_at)}</dd><dt>Collection state</dt><dd><Status>{human(selected.attributes.collection_state)}</Status></dd></dl>{selected.attributes.status === 'DRAFT' && canWrite && !selected.attributes.evidence?.length && <div className="platform-form-actions"><Button variant="secondary" onClick={onEditDraft}>Edit draft invoice</Button><span className="platform-form-note">Drafts can be edited until payment evidence is submitted.</span></div>}</DetailSection><DetailSection title="Commercial snapshot"><div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{(selected.attributes.lines || []).map((line, index) => <tr key={String(line.id || index)}><td>{String(line.description || line.name || 'Commercial line')}</td><td>{String(line.quantity ?? '—')}</td><td>{selected.attributes.currency_code} {String(line.unit_price ?? line.price_amount ?? '—')}</td><td>{selected.attributes.currency_code} {String(line.line_total ?? line.total_amount ?? line.amount ?? '—')}</td></tr>)}</tbody></table></div></DetailSection><DetailSection title="Tax and total"><TaxBreakdown tax={tax} currency={selected.attributes.currency_code} /><p><strong>Invoice total: {money(selected.attributes.total_amount, selected.attributes.currency_code)}</strong></p></DetailSection></div>}
    {active === 'pdf' && <div className="invoice-tab-content"><DetailSection title="PDF Preview" description="Private authenticated preview. It does not open a new tab or download automatically.">{pdfUrl && !pdfModal ? <div className="invoice-inline-pdf"><iframe title={`PDF preview for ${selected.attributes.invoice_number}`} src={pdfUrl} /></div> : <Button variant="secondary" onClick={openPdf}>{pdfModal ? 'PDF viewer is open' : 'View PDF'}</Button>}<div className="platform-form-actions"><Button variant="secondary" onClick={downloadPdf}>Download PDF</Button></div></DetailSection></div>}
    {active === 'payments' && <div className="invoice-tab-content"><DetailSection title="Payment evidence and verification"><p className="platform-form-note">Payment evidence is reviewed separately from invoice publication and collection.</p>{canWrite && selected.attributes.status !== 'PAID' && <form className="platform-filter-toolbar" onSubmit={submitEvidence}><label>Payment transaction reference<input disabled={busy} required value={reference} onChange={event => setReference(event.target.value)} /></label><Button type="submit" busy={busy}>Submit payment evidence</Button></form>}{selected.attributes.evidence?.map(item => <div className="platform-form-actions" key={item.id}><span>{item.attributes.external_reference || 'Evidence'} · {human(item.attributes.review_state)}</span>{item.attributes.review_state === 'EVIDENCE_SUBMITTED' && canReview && <><Button disabled={busy} onClick={() => reviewEvidence(item.id, 'VERIFIED')}>Verify</Button><Button variant="danger" disabled={busy} onClick={() => reviewEvidence(item.id, 'REJECTED')}>Reject</Button><Button variant="quiet" disabled={busy} onClick={() => reviewEvidence(item.id, 'CORRECTIONS_REQUESTED')}>Request correction</Button></>}</div>)}{selected.attributes.status === 'DRAFT' && verified && canWrite && <Button disabled={busy} onClick={publishInvoice}>Publish invoice</Button>}{['ISSUED', 'OVERDUE'].includes(selected.attributes.status) && canWrite && (verified ? <Button disabled={busy} onClick={markPaid}>Mark paid</Button> : <p>Payment remains outstanding until evidence is verified.</p>)}</DetailSection><DetailSection title="Delivery"><p className="platform-form-note">Email delivery uses the authorized recipient billing contact and is recorded in the invoice audit trail.</p>{canWrite && selected.attributes.status !== 'DRAFT' && <div className="platform-form-actions"><Button onClick={emailInvoice}>Email invoice</Button><Button variant="quiet" onClick={resendInvoice}>Resend invoice</Button></div>}</DetailSection></div>}
    {active === 'activity' && <div className="invoice-tab-content"><DetailSection title="Activity History"><p className="platform-form-note">Invoice creation, draft edits, evidence submission, reviewer decisions, publication, PDF generation and delivery are retained in the server audit trail.</p><AdminEmptyState title="Audit history" description="Open the authorized audit record for the complete immutable event timeline." /></DetailSection></div>}
  </section>;
}

function PlatformSubscriptionBillingPage({ capabilities }: { capabilities: string[] }) {
  const route = normalizePlatformHash(window.location.hash).slice(1);
  const invoiceId = route.split('/')[2];
  const isNewInvoice = invoiceId === 'new';
  const review = useReviewReason('billing');
  const [addons, setAddons] = useState<Resource<PlatformSubscriptionAddon>[]>([]);
  const [invoiceStep, setInvoiceStep] = useState(0);
  const [taxes, setTaxes] = useState<Resource<PlatformTaxRate>[]>([]);
  const [invoices, setInvoices] = useState<Resource<PlatformSubscriptionInvoice>[]>([]);
  const [subscriptions, setSubscriptions] = useState<Resource<PlatformSubscription>[]>([]);
  const [subscriptionSearch, setSubscriptionSearch] = useState('');
  const [subscriptionId, setSubscriptionId] = useState(''); const [taxId, setTaxId] = useState(''); const [taxSearch, setTaxSearch] = useState(''); const [dueAt, setDueAt] = useState(''); const [taxPreview, setTaxPreview] = useState<Record<string, unknown> | null>(null); const [previewBusy, setPreviewBusy] = useState(false); const [taxEngineMode, setTaxEngineMode] = useState<'LEGACY' | 'SHADOW' | 'CENTRAL'>('LEGACY');
  const [selected, setSelected] = useState<Resource<PlatformSubscriptionInvoice> | null>(null); const [reference, setReference] = useState('');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfModal, setPdfModal] = useState(false);
  const [draftDueAt, setDraftDueAt] = useState('');
  const [invoiceDetailTab, setInvoiceDetailTab] = useState<InvoiceDetailTab>('overview');
  const { error, busy, setError, run } = useSubscriptionActions('billing');
  const reads = useRef(new RequestGeneration());
  const details = useRef(new RequestGeneration());
  const [loading, setLoading] = useState(true);
  const [subscriptionCursor, setSubscriptionCursor] = useState<string | null>(null);
  const [subscriptionPaging, setSubscriptionPaging] = useState(false);
  const subscriptionReads = useRef(new RequestGeneration());
  const [invoiceCursor, setInvoiceCursor] = useState<string | null>(null);
  const [invoicePaging, setInvoicePaging] = useState(false);
  const invoiceReads = useRef(new RequestGeneration());
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('');
  const [issuedFrom, setIssuedFrom] = useState('');
  const [issuedUntil, setIssuedUntil] = useState('');
  const [addonQuantities, setAddonQuantities] = useState<Record<string, string>>({});
  const activeSubscription = subscriptions.find(row => row.id === subscriptionId);
  const planVersionLabel = (id: string, plan?: PlatformSubscription['plan']) => plan?.name ? `${plan.name} · v${plan.version ?? '—'}` : `Accepted plan version · ${id}`;
  const dueAtTimestamp = dueAt ? indiaDateTimeToDate(dueAt).getTime() : Number.NaN;
  const dueAtInvalid = !Number.isFinite(dueAtTimestamp) || dueAtTimestamp <= Date.now();
  const compatibleAddons = compatibleInvoiceAddons(addons, activeSubscription?.attributes.commercial_snapshot.currency_code);
  async function loadMoreSubscriptions() {
    if (!subscriptionCursor || subscriptionPaging) return;
    const valid = subscriptionReads.current.next(); setSubscriptionPaging(true); setError('');
    try { const page = await operationsData.platformSubscriptions({ after: subscriptionCursor, q: subscriptionSearch.trim() || undefined, status: 'ACTIVE' });
      if (valid()) { setSubscriptions(rows => [...new Map([...rows, ...page.data].map(row => [row.id, row])).values()]); setSubscriptionCursor(page.page?.next || null); }
    } catch (cause) { if (valid()) setError(errorText(cause)); }
    finally { if (valid()) setSubscriptionPaging(false); }
  }
  useEffect(() => {
    if (!isNewInvoice) return;
    const timer = window.setTimeout(() => {
      const valid = subscriptionReads.current.next();
      setSubscriptionPaging(true);
      const query = subscriptionSearch.trim();
      void operationsData.platformSubscriptions({ q: query || undefined, status: 'ACTIVE' }).then(page => {
        if (valid()) { setSubscriptions(page.data); setSubscriptionCursor(page.page?.next || null); }
      }).catch(cause => { if (valid()) setError(errorText(cause)); }).finally(() => { if (valid()) setSubscriptionPaging(false); });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [subscriptionSearch, isNewInvoice]);
  async function loadMoreInvoices() {
    if (!invoiceCursor || invoicePaging) return;
    const valid = invoiceReads.current.next(); setInvoicePaging(true); setError('');
    try { const page = await operationsData.platformSubscriptionInvoices({ after: invoiceCursor });
      if (valid()) { setInvoices(rows => [...new Map([...rows, ...page.data].map(row => [row.id, row])).values()]); setInvoiceCursor(page.page?.next || null); }
    } catch (cause) { if (valid()) setError(errorText(cause)); }
    finally { if (valid()) setInvoicePaging(false); }
  }
  async function load() {
    const valid = reads.current.next(); invoiceReads.current.invalidate(); subscriptionReads.current.invalidate(); setInvoicePaging(false); setSubscriptionPaging(false); setError(''); setLoading(true);
    try {
      const [a, t, i, subscriptions, mode] = await Promise.all([operationsData.platformSubscriptionAddons(), operationsData.platformSubscriptionTaxRates(), operationsData.platformSubscriptionInvoices({}), operationsData.platformSubscriptions({ status: 'ACTIVE' }), operationsData.platformSubscriptionTaxMode()]);
      if (valid()) { setAddons(a.data); setTaxes(t.data); setInvoices(i.data); setInvoiceCursor(i.page?.next || null); setSubscriptions(subscriptions.data); setSubscriptionCursor(subscriptions.page?.next || null); setTaxEngineMode(mode.data.mode); }
    } catch (cause) { if (valid()) setError(errorText(cause)); } finally { if (valid()) setLoading(false); }
  }
  const canRead = capabilities.includes('PLATFORM_SUBSCRIPTION_READ');
  useEffect(() => {
    if (canRead) void load(); else setLoading(false);
    const generation = reads.current; const detailGeneration = details.current;
    return () => { generation.invalidate(); detailGeneration.invalidate(); invoiceReads.current.invalidate(); subscriptionReads.current.invalidate(); };
  }, [canRead]);
  async function issue(event: FormEvent) {
    event.preventDefault();
    if (dueAtInvalid) { setError('Due date must be in the future.'); return; }
    let selectedAddons;
    try { selectedAddons = invoiceAddonPayload(addonQuantities, compatibleAddons); }
    catch (cause) { setError(errorText(cause)); return; }
    const body = { provider_subscription_id: subscriptionId.trim(), lifecycle: 'DRAFT', ...(taxEngineMode !== 'CENTRAL' && taxId.trim() ? { tax_rate_id: taxId.trim() } : {}), due_at: indiaDateTimeToIso(dueAt), addons: selectedAddons };
    await run(JSON.stringify(['invoice', body]), (key) => operationsData.createPlatformSubscriptionInvoice(body, key), async () => { setSubscriptionId(''); setTaxId(''); setDueAt(''); setAddonQuantities({}); go('platform/subscription-billing'); await load(); });
  }
  async function previewTax() { setPreviewBusy(true); setError(''); try { const profile = await operationsData.platformSubscriptionBillingProfile(subscriptionId.trim()); if (!profile.data) { setError('Save the recipient billing context above before requesting a tax preview.'); setTaxPreview(null); return; } const selectedAddons = invoiceAddonPayload(addonQuantities, compatibleAddons); const result = await operationsData.platformSubscriptionTaxPreview({ provider_subscription_id: subscriptionId.trim(), ...(taxEngineMode !== 'CENTRAL' && taxId.trim() ? { tax_rate_id: taxId.trim() } : {}), addons: selectedAddons }); setTaxPreview(result.data); } catch (cause) { setError(errorText(cause)); setTaxPreview(null); } finally { setPreviewBusy(false); } }
  async function openInvoice(id: string) {
    const valid = details.current.next(); setSelected(null); setError('');
    try { const result = await operationsData.platformSubscriptionInvoice(id); if (valid()) { setSelected(result.data); setDraftDueAt(localDateTime(new Date(result.data.attributes.due_at))); } }
    catch (cause) { if (valid()) setError(errorText(cause)); }
  }
  async function openInvoicePdf(download = false) {
    if (!selected) return;
    try {
      setError('');
      const blob = await operationsData.platformSubscriptionInvoicePdf(selected.id, download);
      const url = URL.createObjectURL(blob);
      if (download) {
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${selected.attributes.invoice_number}.pdf`; anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        setPdfUrl(current => { if (current) URL.revokeObjectURL(current); return url; });
      }
    } catch (cause) { setError(errorText(cause)); }
  }
  async function sendInvoiceEmail(resend = false) {
    if (!selected) return;
    if (!selected.attributes.recipient_contact?.recipient_email) { setError('Recipient email is not configured. Open New invoice, select this subscription, enter the authorized recipient email and save billing details before sending.'); return; }
    if (!window.confirm(`${resend ? 'Resend' : 'Send'} invoice ${selected.attributes.invoice_number}? The server will use the authorized recipient email saved on the subscription billing profile.`)) return;
    try { const result = await operationsData.sendPlatformSubscriptionInvoiceEmail(selected.id, resend, `${resend ? 'resend' : 'send'}-${selected.id}-${Date.now()}`); setError(`Invoice email ${String((result as { data?: { attributes?: { status?: string } } }).data?.attributes?.status || 'queued').toLowerCase()}.`); }
    catch (cause) { setError(errorText(cause)); }
  }
  useEffect(() => { if (invoiceId && invoiceId !== 'new' && canRead) { setInvoiceDetailTab('overview'); void openInvoice(invoiceId); } }, [invoiceId, canRead]);
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);
  async function evidence(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    const id = selected.id;
    const body = { evidence_kind: 'TRANSACTION_REFERENCE', external_reference: reference.trim(), stated_amount: selected.attributes.total_amount, currency_code: selected.attributes.currency_code };
    await run(JSON.stringify(['invoice-evidence', id, body]), (key) => operationsData.submitPlatformSubscriptionInvoiceEvidence(id, body, key), async () => { setReference(''); await openInvoice(id); });
  }
  async function markPaid(id: string) {
    if (!window.confirm('Mark this invoice paid? The server requires verified payment evidence.')) return;
    await run(`paid-${id}`, (key) => operationsData.markPlatformSubscriptionInvoicePaid(id, key), async () => { await load(); if (selected?.id === id) await openInvoice(id); });
  }
  async function publishInvoice(id: string) {
    if (!window.confirm('Publish this invoice? It will become immutable and can no longer be edited.')) return;
    await run(`publish-${id}`, (key) => operationsData.publishPlatformSubscriptionInvoice(id, key), () => openInvoice(id));
  }
  async function saveDraft() {
    if (!selected || !draftDueAt) return;
    await run(`draft-update-${selected.id}-${draftDueAt}`, (key) => operationsData.updatePlatformSubscriptionInvoice(selected.id, { due_at: indiaDateTimeToIso(draftDueAt), addons: [] }, key), () => openInvoice(selected.id));
  }
  async function reviewInvoiceEvidence(id: string, decision: 'VERIFIED' | 'REJECTED' | 'CORRECTIONS_REQUESTED') {
    if (!selected) return;
    const invoiceId = selected.id;
    const reason = await review.ask(`${human(decision)} invoice evidence`); if (reason === null) return;
    await run(JSON.stringify(['invoice-review', id, decision, reason]), (key) => operationsData.reviewPlatformSubscriptionInvoiceEvidence(invoiceId, id, { decision, reason }, key), () => openInvoice(invoiceId));
  }
  if (!canRead) return <StatePanel title="Billing access is restricted">Subscription read capability is required.</StatePanel>;
  if (loading) return <StatePanel title="Loading billing">Retrieving invoices and commercial configuration…</StatePanel>;
  const taxOptions = taxes.filter((tax) => tax.attributes.status === 'ACTIVE').map((tax) => ({ id: tax.id, label: `${tax.attributes.tax_code} · ${tax.attributes.jurisdiction_code}`, detail: `${tax.attributes.rate_percent}%` })).filter((option) => `${option.label} ${option.detail}`.toLowerCase().includes(taxSearch.trim().toLowerCase()));
  const visibleInvoices = invoices.filter(row => matchesSubscriptionHistory({ provider: `${row.attributes.provider.display_name} ${row.attributes.provider.provider_code || ''} ${row.attributes.invoice_number}`, status: row.attributes.collection_state, date: row.attributes.issued_at }, { query: invoiceSearch, status: invoiceStatus, from: issuedFrom, through: issuedUntil }));
  const reviewTax = taxPreview?.tax as Record<string, unknown> | undefined;
  const wizardSteps = ['Select subscription', 'Billing recipient', 'Charges & tax', 'Review & issue'];
  const invoiceWizard = <section className="invoice-wizard" aria-label="New subscription invoice">
    <div className="invoice-wizard-steps">{wizardSteps.map((label, index) => <button type="button" key={label} className={invoiceStep === index ? 'active' : invoiceStep > index ? 'complete' : ''} onClick={() => { if (index <= invoiceStep) setInvoiceStep(index); }}><span>{index + 1}</span>{label}</button>)}</div>
    <div className="invoice-wizard-layout"><form className="invoice-wizard-form" onSubmit={issue}>
      {invoiceStep === 0 && <DetailSection title="Select an eligible subscription" description="Only active subscriptions belonging to active providers are available for invoicing."><label className="invoice-wizard-search">Search provider, Business or plan<input autoFocus type="search" value={subscriptionSearch} onChange={event => setSubscriptionSearch(event.target.value)} placeholder="Search by provider, Business or plan name" /></label><div className="invoice-subscription-list">{subscriptions.filter(item => item.attributes.status === 'ACTIVE' && item.attributes.provider.status === 'ACTIVE').map(item => <button type="button" className={`invoice-subscription-choice ${subscriptionId === item.id ? 'selected' : ''}`} key={item.id} onClick={() => { setSubscriptionId(item.id); setTaxPreview(null); setAddonQuantities({}); }}><strong>{item.attributes.provider.display_name}</strong><span>{item.attributes.provider.business_name || 'Business name not returned'} · {item.attributes.provider.provider_code || 'Provider reference not supplied'}</span><span>{planVersionLabel(item.attributes.plan_version_id, item.attributes.plan)} · {money(item.attributes.commercial_snapshot.price_amount, item.attributes.commercial_snapshot.currency_code)} · {human(item.attributes.commercial_snapshot.billing_interval || 'billing interval not supplied')}</span><Status>{human(item.attributes.status)}</Status></button>)}{!subscriptions.length && <AdminEmptyState title="No eligible subscriptions" description="No active subscription records were returned by the billing service." />}</div>{subscriptionCursor && <Button type="button" variant="secondary" busy={subscriptionPaging} disabled={subscriptionPaging} onClick={() => void loadMoreSubscriptions()}>Load more subscriptions</Button>}{activeSubscription && <div className="invoice-selected-summary"><strong>{activeSubscription.attributes.provider.display_name}</strong><span>{activeSubscription.attributes.provider.business_name || 'Business name not returned'}</span><span>{planVersionLabel(activeSubscription.attributes.plan_version_id, activeSubscription.attributes.plan)} · {money(activeSubscription.attributes.commercial_snapshot.price_amount, activeSubscription.attributes.commercial_snapshot.currency_code)} · {human(activeSubscription.attributes.commercial_snapshot.billing_interval || 'not returned')}</span></div>}<div className="platform-form-actions"><Button type="button" disabled={!subscriptionId} onClick={() => setInvoiceStep(1)}>Continue to recipient details</Button></div></DetailSection>}
      {invoiceStep === 1 && <><DetailSection title="Recipient and billing details" description="Billing data is saved against the selected subscription and comes from the authoritative Business tax records."><SubscriptionBillingContext subscriptionId={subscriptionId} disabled={busy} onSaved={() => { setTaxPreview(null); setError('Billing context saved. Refresh the authoritative tax preview.'); }} /></DetailSection><DetailSection title="Invoice due date"><label>Due at<input disabled={busy} required type="datetime-local" value={dueAt} onChange={event => { setDueAt(event.target.value); setTaxPreview(null); }} /></label><p className="platform-form-note">The due date must be in the future. The issued invoice keeps this value as an immutable snapshot.</p></DetailSection><div className="platform-form-actions"><Button type="button" variant="secondary" onClick={() => setInvoiceStep(0)}>Back</Button><Button type="button" disabled={!dueAt || dueAtInvalid} onClick={() => setInvoiceStep(2)}>Continue to charges</Button></div></>}
      {invoiceStep === 2 && <><DetailSection title="Charges, add-ons and tax" description="The server calculates invoice lines and tax. The UI never applies an authoritative tax rate."><div className="invoice-mode-row"><span>Tax engine</span><Status>{taxEngineMode}</Status><small>Server-authoritative</small></div>{taxEngineMode !== 'CENTRAL' && <SearchableSelect disabled={busy} label={`Legacy tax rate (${taxEngineMode} mode)`} searchLabel="Search tax rates" search={taxSearch} onSearch={setTaxSearch} value={taxId} onChange={value => { setTaxId(value); setTaxPreview(null); }} options={taxOptions} placeholder="Select an approved legacy rate" />}{taxEngineMode === 'CENTRAL' && <p className="platform-form-note"><strong>Central mode:</strong> a published, verified and effective TaxRule is resolved by the billing API.</p>}<div className="invoice-addons-list">{compatibleAddons.length ? compatibleAddons.map(version => <label key={version.id}>{version.name}<span className="invoice-addon-meta">{money(version.price_amount, version.currency_code)} per unit · {version.quantity_per_unit} {human(version.metric_key)}</span><input disabled={busy} type="number" min="0" step="1" value={addonQuantities[version.id] || ''} onChange={event => { setTaxPreview(null); setAddonQuantities(rows => ({ ...rows, [version.id]: event.target.value })); }} /></label>) : <p className="platform-form-note">No compatible add-ons returned.</p>}</div><Button type="button" variant="secondary" disabled={busy || previewBusy || !subscriptionId} busy={previewBusy} onClick={() => void previewTax()}>Calculate server tax preview</Button>{taxPreview && <InvoiceTaxPreview preview={taxPreview} mode={taxEngineMode} currency={String(taxPreview.currency_code || activeSubscription?.attributes.commercial_snapshot.currency_code || 'INR')} />}</DetailSection><div className="platform-form-actions"><Button type="button" variant="secondary" onClick={() => setInvoiceStep(1)}>Back</Button><Button type="button" disabled={!taxPreview || taxPreview.calculation_status !== 'READY'} onClick={() => setInvoiceStep(3)}>Review invoice</Button></div></>}
      {invoiceStep === 3 && <><DetailSection title="Review and issue" description="Confirm the server-calculated summary before issuing the immutable invoice."><div className="invoice-review-summary"><div><span>Provider</span><strong>{activeSubscription?.attributes.provider.display_name || 'Not selected'}</strong></div><div><span>Business</span><strong>{activeSubscription?.attributes.provider.business_name || 'Not returned'}</strong></div><div><span>Plan</span><strong>{activeSubscription ? planVersionLabel(activeSubscription.attributes.plan_version_id, activeSubscription.attributes.plan) : 'Not selected'}</strong></div><div><span>Base price</span><strong>{money(activeSubscription?.attributes.commercial_snapshot.price_amount, activeSubscription?.attributes.commercial_snapshot.currency_code || 'INR')}</strong></div><div><span>Taxable amount</span><strong>{money(reviewTax?.taxable_amount, String(taxPreview?.currency_code || 'INR'))}</strong></div><div><span>GST</span><strong>{money(reviewTax?.total_tax, String(taxPreview?.currency_code || 'INR'))}</strong></div><div><span>Total payable</span><strong>{money(reviewTax?.grand_total, String(taxPreview?.currency_code || 'INR'))}</strong></div><div><span>Due date</span><strong>{dueAt ? formatIndiaDateTime(indiaDateTimeToDate(dueAt)) : 'Not set'}</strong></div></div><p className="platform-form-note">Issuing persists accepted commercial, recipient and tax snapshots. It cannot be edited after issuance.</p></DetailSection><div className="platform-form-actions"><Button type="button" variant="secondary" onClick={() => setInvoiceStep(2)}>Back</Button><Button type="submit" disabled={busy || !taxPreview || taxPreview.calculation_status !== 'READY' || !dueAt} busy={busy}>Issue invoice</Button></div></>}
    </form><InvoiceSummaryRail subscription={activeSubscription} taxPreview={taxPreview} dueAt={dueAt} /></div>
  </section>;
  return <section className={`platform-page ${invoiceId && selected ? 'invoice-detail-page' : ''}`}>{review.modal}<AdminPageHeader breadcrumbs={[{ label: 'Platform Overview', href: 'platform/overview' }, { label: 'Subscriptions', href: 'platform/subscription-billing' }, { label: 'Billing & Payments' }, ...(invoiceId ? [{ label: invoiceId === 'new' ? 'New invoice' : 'Invoice detail' }] : [])]} eyebrow="Platform administration / Subscriptions" title={isNewInvoice ? 'New subscription invoice' : invoiceId ? `Invoice ${selected?.attributes.invoice_number || ''}` : 'Billing & Payments'} description={isNewInvoice ? 'Issue a server-calculated invoice through four guided steps.' : 'Invoices retain immutable commercial and tax snapshots. Payment evidence review and collection status are separate decisions.'} action={!invoiceId && capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') ? <Button onClick={() => go('platform/subscription-billing/new')}>New invoice</Button> : undefined} />
    {invoiceId && <Button variant="secondary" onClick={() => go('platform/subscription-billing')}>Back to invoices</Button>}
    {error && <StatePanel title="Billing action needs attention">{error}</StatePanel>}
    {pdfModal && pdfUrl && selected && <OperationsDialog title={`PDF preview · ${selected.attributes.invoice_number}`} onClose={() => { setPdfModal(false); setPdfUrl(current => { if (current) URL.revokeObjectURL(current); return null; }); }}><div className="invoice-inline-pdf"><iframe title={`PDF preview for ${selected.attributes.invoice_number}`} src={pdfUrl} /></div><div className="platform-form-actions invoice-pdf-modal-actions"><Button variant="secondary" onClick={() => void openInvoicePdf(true)}>Download PDF</Button><Button onClick={() => setPdfModal(false)}>Close</Button></div></OperationsDialog>}
    {invoiceId && selected?.attributes.status === 'DRAFT' && selected.attributes.evidence?.some(item => item.attributes.review_state === 'VERIFIED') && capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && <div className="platform-form-actions"><Button onClick={() => void publishInvoice(selected.id)}>Publish invoice</Button><span className="platform-form-note">Publishing locks the commercial and tax snapshot.</span></div>}
    {invoiceId && selected?.attributes.status === 'DRAFT' && capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && !selected.attributes.evidence?.length && <div className="invoice-draft-editor"><DetailSection title="Edit draft invoice" description="You can change the due date until payment evidence is submitted."><form className="platform-form-actions" onSubmit={(event) => { event.preventDefault(); void saveDraft(); }}><label>Due date<input required type="datetime-local" value={draftDueAt} onChange={(event) => setDraftDueAt(event.target.value)} /></label><Button type="submit" busy={busy}>Save changes</Button></form></DetailSection></div>}
    {invoiceId && selected && <InvoiceDetailTabs selected={selected} active={invoiceDetailTab} setActive={setInvoiceDetailTab} pdfUrl={pdfUrl} pdfModal={pdfModal} openPdf={() => void openInvoicePdf()} downloadPdf={() => void openInvoicePdf(true)} emailInvoice={() => void sendInvoiceEmail()} resendInvoice={() => void sendInvoiceEmail(true)} onEditDraft={() => document.querySelector('.invoice-draft-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} reference={reference} setReference={setReference} submitEvidence={evidence} reviewEvidence={(id, decision) => void reviewInvoiceEvidence(id, decision)} publishInvoice={() => void publishInvoice(selected.id)} markPaid={() => void markPaid(selected.id)} canWrite={capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE')} canReview={capabilities.includes('PLATFORM_SUBSCRIPTION_REVIEW')} busy={busy} />}
    {isNewInvoice && invoiceWizard}
    {!invoiceId && <><AdminFilterBar onSubmit={event => event.preventDefault()}><label>Provider or invoice<input type="search" value={invoiceSearch} onChange={event => setInvoiceSearch(event.target.value)} /></label><label>Collection state<select value={invoiceStatus} onChange={event => setInvoiceStatus(event.target.value)}><option value="">All states</option>{[...new Set(invoices.map(row => row.attributes.collection_state))].sort().map(status => <option key={status}>{status}</option>)}</select></label><label>Issued from<input type="date" value={issuedFrom} onChange={event => setIssuedFrom(event.target.value)} /></label><label>Issued through<input type="date" value={issuedUntil} onChange={event => setIssuedUntil(event.target.value)} /></label><span>Filters apply to invoices loaded so far.</span></AdminFilterBar><DetailSection title="Invoices"><AdminDataTable><table className="platform-provider-table"><thead><tr><th>Invoice number</th><th>Provider</th><th>Total</th><th>Due date</th><th>Collection state</th><th>Actions</th></tr></thead><tbody>{visibleInvoices.map((row) => <tr key={row.id}><td>{row.attributes.invoice_number}</td><td><strong>{row.attributes.provider.display_name}</strong><small>{row.attributes.provider.provider_code || row.attributes.provider_id}</small></td><td>{row.attributes.currency_code} {row.attributes.total_amount}</td><td>{formatIndiaDate(row.attributes.due_at)}</td><td><Status>{human(row.attributes.collection_state)}</Status></td><td><AdminActionMenu label={`Actions for ${row.attributes.invoice_number}`}><button type="button" onClick={() => go(`platform/subscription-billing/${row.id}`)}>View invoice</button></AdminActionMenu></td></tr>)}</tbody></table>{!visibleInvoices.length && <AdminEmptyState title="No invoices match" description="Change the loaded-page filters or load more invoice records." />}</AdminDataTable></DetailSection><AdminPagination shown={visibleInvoices.length} scope={`matching invoices / ${invoices.length} loaded`} hasMore={Boolean(invoiceCursor)} busy={invoicePaging} onLoadMore={() => void loadMoreInvoices()} /><p className="platform-filter-scope">Search, status and date filters apply to loaded invoice pages; no global invoice filters are available.</p></>}
    {invoiceId && selected && <><div className="invoice-document-toolbar" role="toolbar" aria-label="Invoice document actions"><Button variant="secondary" onClick={() => void openInvoicePdf()}>View PDF inline</Button><Button variant="secondary" onClick={() => void openInvoicePdf(true)}>Download PDF</Button>{capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && <><Button onClick={() => void sendInvoiceEmail()}>Email invoice</Button><Button variant="quiet" onClick={() => void sendInvoiceEmail(true)}>Resend invoice</Button></>}</div>{pdfUrl && <DetailSection title="PDF Preview" description="Private authenticated invoice document. Use the embedded viewer controls to zoom, navigate and print."><div className="invoice-inline-pdf"><iframe title={`PDF preview for ${selected.attributes.invoice_number}`} src={pdfUrl} /></div></DetailSection>}<DetailSection title="Overview"><dl className="platform-definition-list"><dt>Provider</dt><dd>{selected.attributes.provider.display_name} · {selected.attributes.provider.provider_code || selected.attributes.provider_id}</dd><dt>Invoice number</dt><dd>{selected.attributes.invoice_number}</dd><dt>Issued</dt><dd>{formatIndiaDateTime(selected.attributes.issued_at)}</dd><dt>Due / grace through</dt><dd>{formatIndiaDateTime(selected.attributes.due_at)} / {formatIndiaDateTime(selected.attributes.grace_ends_at)}</dd><dt>Collection state</dt><dd><Status>{human(selected.attributes.collection_state)}</Status></dd></dl></DetailSection><DetailSection title="Commercial snapshot and line items"><div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Line total</th></tr></thead><tbody>{(selected.attributes.lines || []).map((line, index) => <tr key={String(line.id || index)}><td>{String(line.description || line.name || 'Commercial line')}</td><td>{String(line.quantity ?? '—')}</td><td>{selected.attributes.currency_code} {String(line.unit_price ?? line.price_amount ?? '—')}</td><td>{selected.attributes.currency_code} {String(line.line_total ?? line.total_amount ?? line.amount ?? '—')}</td></tr>)}</tbody></table>{!selected.attributes.lines?.length && <AdminEmptyState title="No line items in response" description="The invoice detail endpoint returned no line snapshot rows." />}</div></DetailSection><DetailSection title="Tax and total"><dl className="platform-definition-list"><dt>Tax source</dt><dd>{human(String(selected.attributes.tax?.source || selected.attributes.tax?.tax_calculation_source || 'Not recorded'))}</dd><dt>Taxable amount</dt><dd>{money(selected.attributes.tax?.taxable_amount || selected.attributes.subtotal_amount, selected.attributes.currency_code)}</dd><dt>Tax components</dt><dd><TaxBreakdown tax={selected.attributes.tax} currency={selected.attributes.currency_code} /></dd><dt>Invoice total</dt><dd><strong>{money(selected.attributes.total_amount, selected.attributes.currency_code)}</strong></dd></dl></DetailSection><DetailSection title="Payments & Delivery"><p className="platform-form-note">Payment states are server-defined: submitted evidence, verified evidence, collected, or outstanding.</p>{capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && selected.attributes.status !== 'PAID' && <form className="platform-filter-toolbar" onSubmit={evidence}><label>Payment transaction reference<input disabled={busy} required value={reference} onChange={(e) => setReference(e.target.value)} /></label><Button type="submit" busy={busy}>Submit payment evidence</Button></form>}{selected.attributes.evidence?.map((item) => <div className="platform-form-actions" key={item.id}><span>{item.attributes.external_reference || 'Evidence'} · {human(item.attributes.review_state)}</span>{item.attributes.review_state === 'EVIDENCE_SUBMITTED' && capabilities.includes('PLATFORM_SUBSCRIPTION_REVIEW') && <><Button disabled={busy} onClick={() => void reviewInvoiceEvidence(item.id, 'VERIFIED')}>Verify</Button><Button variant="danger" disabled={busy} onClick={() => void reviewInvoiceEvidence(item.id, 'REJECTED')}>Reject</Button><Button variant="quiet" disabled={busy} onClick={() => void reviewInvoiceEvidence(item.id, 'CORRECTIONS_REQUESTED')}>Request correction</Button></>}</div>)}{selected.attributes.status !== 'PAID' && capabilities.includes('PLATFORM_SUBSCRIPTION_WRITE') && (selected.attributes.evidence?.some(item => item.attributes.review_state === 'VERIFIED') ? <Button disabled={busy} onClick={() => void markPaid(selected.id)}>Mark paid</Button> : <p>Payment remains outstanding until evidence is verified.</p>)}</DetailSection><DetailSection title="Activity History"><p className="platform-form-note">Invoice issuance, PDF generation, payment evidence, review and delivery actions are retained by the server audit trail.</p></DetailSection></>}
  </section>;
}

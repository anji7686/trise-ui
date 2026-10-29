import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button, Status } from '@trise/ui';
import { customerData, type Collection, type ProviderAttributes, type QuotationApprovalAttributes, type QuotationAttributes, type QuotationCommunicationAttributes, type Resource } from './data';
import { CustomerStatePanel } from './customer-state';
import './quotation-review.css';

type Props = { providers: Resource<ProviderAttributes>[] | null; onSelectProvider: (providerId: string) => void; t: (key: string) => string };
type ReviewProps = { providerId: string; id: string; t: (key: string) => string };
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : '';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
type QuoteIconName = 'scope' | 'building' | 'payment' | 'warranty' | 'amc' | 'delivery' | 'history' | 'message' | 'terms';

export function QuotationListLoadFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <CustomerStatePanel kind="error" message={message} actionLabel="Retry loading quotations" onAction={onRetry} />;
}
function QuoteIcon({ name }: { name: QuoteIconName }) {
  const paths: Record<QuoteIconName, ReactNode> = {
    scope: <><path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"/><path d="m4.5 7.8 7.5 4.4 7.5-4.4M12 12.2V21"/></>,
    building: <><path d="M5 21V5l7-2v18M12 9h7v12M8 7h1m-1 4h1m-1 4h1m7-2h1m-1 4h1M3 21h18"/></>,
    payment: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-14 5h4"/></>,
    warranty: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
    amc: <><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></>,
    delivery: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7.5" cy="18" r="1.5"/><circle cx="18" cy="18" r="1.5"/></>,
    history: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    message: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-2 2v-6a7.5 7.5 0 1 1 17-3.5Z"/><path d="M7.5 11.5h9m-9 3h6"/></>,
    terms: <><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7m-7 4h7"/></>
  };
  return <svg className={`quote-icon quote-icon-${name}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function date(value?: string | null) { if (!value) return 'Not specified'; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? 'Not specified' : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(parsed); }
function currency(value: string, code: string) { const amount = Number(value); return Number.isFinite(amount) ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: code || 'INR', maximumFractionDigits: 2 }).format(amount) : `${code} ${value}`; }
function safeAddress(address: unknown) { const value = object(address); return ['address_line', 'locality', 'city', 'district', 'state', 'pin_code'].map((key) => text(value[key])).filter(Boolean).join(', '); }
function customerVisibleMaterials(terms: Record<string, unknown>) { return list(terms.materials).map(object).filter((material) => text(material.customer_visibility).toUpperCase() !== 'EXCLUDED'); }

export function quotationUnitAssignment(value: unknown, allUnitCodes: string[] = []) {
  const allCodes = [...new Set(allUnitCodes.map(text).filter(Boolean))];
  const selectedCodes = [...new Set(list(value).map(text).filter(Boolean))];
  const codes = selectedCodes.length ? selectedCodes : allCodes;
  const assigned = new Set(codes);
  const ordered = allCodes.length
    ? [...allCodes.filter((code) => assigned.has(code)), ...codes.filter((code) => !allCodes.includes(code))]
    : codes;
  const label = !ordered.length
    ? 'all quoted lifts'
    : !selectedCodes.length || allCodes.length && ordered.length === allCodes.length
      ? allCodes.length ? `all ${allCodes.length} lifts` : 'all quoted lifts'
      : `${ordered.length}${allCodes.length ? ` of ${allCodes.length}` : ''} lifts`;
  return { codes: ordered, label };
}

export function quotationCommunicationFailure(error: unknown) {
  const value = object(error);
  const status = Number(value.status);
  if (status === 409) return { message: 'This quotation has changed or closed. Reload it to review the current revision before trying again.', canReload: true };
  if (status === 403 || status === 404) return { message: 'Your account no longer has access to send messages on this quotation. Contact your service provider if you need help.', canReload: false };
  if (status === 422) return { message: text(value.message) || 'Check the message type and length, then try again.', canReload: false };
  const message = text(value.message);
  if (/failed to fetch|network|offline/i.test(message)) return { message: 'The message could not reach your provider. Check your connection and try again.', canReload: false };
  return { message: 'The message could not be sent. Please try again.', canReload: false };
}

export function quotationConversationOpen(status: string, validUntil?: string | null, now = Date.now()) {
  if (!['issued', 'viewed', 'under_review', 'revision_requested'].includes(status.toLowerCase())) return false;
  if (!validUntil) return true;
  const expiry = new Date(validUntil).getTime();
  return !Number.isFinite(expiry) || expiry >= now;
}

function QuotationUnitScope({ unitCodes, allUnitCodes }: { unitCodes: unknown; allUnitCodes: string[] }) {
  const assignment = quotationUnitAssignment(unitCodes, allUnitCodes);
  if (!assignment.codes.length) return <small className="quote-unit-scope-missing">Applies to {assignment.label}</small>;
  return <details className="quote-unit-scope">
    <summary><span>Applies to <strong>{assignment.label}</strong></span><span>View lifts</span></summary>
    <ul>{assignment.codes.map((code) => <li key={code}>{code}</li>)}</ul>
  </details>;
}

export function QuotationsPage({ providers, onSelectProvider, t }: Props) {
  const [result, setResult] = useState<Array<{ providerId: string; quote: Resource<QuotationAttributes> }> | null>(null);
  const [cursors, setCursors] = useState<Record<string, string | null>>({});
  const [visibleCount, setVisibleCount] = useState(15);
  const [view, setView] = useState<'needs-action' | 'all'>('needs-action');
  const [searchText, setSearchText] = useState('');
  const [quotationId, setQuotationId] = useState('');
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const providerKey = providers?.map((provider) => provider.id).join('|') ?? 'loading';
  const statuses = view === 'needs-action' ? ['ISSUED', 'VIEWED', 'UNDER_REVIEW'] : undefined;
  const requestKey = `${providerKey}|${view}|${quotationId}`;
  const providerRef = useRef(providers); providerRef.current = providers;
  const activeKey = useRef(requestKey); activeKey.current = requestKey;
  useEffect(() => {
    const value = searchText.trim();
    if (!value || value.length >= 3) {
      const timer = window.setTimeout(() => setQuotationId(value), value ? 250 : 0);
      return () => window.clearTimeout(timer);
    }
    setQuotationId('');
  }, [searchText]);
  useEffect(() => {
    let active = true;
    setResult(null); setCursors({}); setVisibleCount(15); setError(''); setLoadingMore(false);
    if (!providers) return () => { active = false; };
    const filters = { quotationId: quotationId || undefined, status: statuses };
    Promise.all(providers.map(async ({ id }) => ({ providerId: id, page: await customerData.quotations(id, { limit: 15 }, filters) })))
      .then((pages) => {
        if (!active) return;
        setResult(pages.flatMap(({ providerId, page }) => page.data.map((quote) => ({ providerId, quote }))));
        setCursors(Object.fromEntries(pages.map(({ providerId, page }) => [providerId, page.page?.next ?? null])));
      })
      .catch((cause) => { if (active) setError((cause as Error)?.message || 'Unable to load quotations across your customer relationships.'); });
    return () => { active = false; };
  }, [providerKey, view, quotationId, loadAttempt]);
  async function loadMore() {
    const currentProviders = providerRef.current;
    if (!currentProviders || !result || loadingMore) return;
    if (result.length > visibleCount) { setVisibleCount((count) => count + 15); return; }
    const pagingKey = requestKey; setLoadingMore(true); setError('');
    try {
      const filters = { quotationId: quotationId || undefined, status: statuses };
      const pages = await Promise.all(currentProviders.filter(({ id }) => cursors[id]).map(async ({ id }) => ({ providerId: id, page: await customerData.quotations(id, { limit: 15, after: cursors[id]! }, filters) })));
      if (activeKey.current !== pagingKey) return;
      const next = { ...cursors };
      pages.forEach(({ providerId, page }) => { next[providerId] = page.page?.next ?? null; });
      setCursors(next);
      setResult((current) => {
        if (!current) return current;
        const seen = new Set(current.map(({ providerId, quote }) => `${providerId}:${quote.id}`));
        return [...current, ...pages.flatMap(({ providerId, page }) => page.data.map((quote) => ({ providerId, quote }))).filter(({ providerId, quote }) => !seen.has(`${providerId}:${quote.id}`))];
      });
      setVisibleCount((count) => count + 15);
    } catch (cause) { if (activeKey.current === pagingKey) setError((cause as Error)?.message || 'Unable to load more quotations.'); }
    finally { if (activeKey.current === pagingKey) setLoadingMore(false); }
  }
  if (error && !result) return <section className="customer-quotes"><QuotationListLoadFailure message={error} onRetry={() => { setResult(null); setError(''); setLoadAttempt((attempt) => attempt + 1); }} /></section>;
  if (!result) return <section className="customer-quotes"><CustomerStatePanel kind="loading" message={t('loading')} onAction={() => window.location.reload()} /></section>;
  const providerNames = new Map((providers || []).map((provider) => [provider.id, provider.attributes.display_name || 'Service provider']));
  const actionQuotes = result.filter(({ quote }) => quotationNeedsCustomerDecision(quote.attributes));
  const rows = view === 'needs-action' ? actionQuotes : result;
  const searchable = searchText.trim().length > 0 && searchText.trim().length < 3;
  return <section className="customer-quotes"><section className="quotation-login-intro"><h1>Your approvals</h1><p>Clear decisions, with the full picture.</p></section>
    <div className="quote-list-tools"><div className="quote-list-tabs" role="group" aria-label="Quotation list view"><button type="button" aria-pressed={view === 'needs-action'} onClick={() => setView('needs-action')}>Needs your decision</button><button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')}>All quotations</button></div><label><span>Search quotation number or ID</span><input type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Enter at least 3 characters" aria-label="Search quotation number or ID" /></label></div>
    {searchable && <p className="quote-search-hint">Enter at least 3 characters to search by quotation number or ID.</p>}{error && <p className="error" role="alert">{error}</p>}
    {!rows.length ? <div className="quote-empty"><h2>{view === 'needs-action' ? 'No quotations need your decision' : 'No quotations found'}</h2><p>{view === 'needs-action' ? 'Quotes appear here after the provider approves the current revision and it is ready for your response.' : 'Quotations shared by your linked service providers will appear here.'}</p>{view === 'needs-action' && <Button onClick={() => setView('all')}>View all quotations</Button>}</div> : <div className="quote-list">{rows.slice(0, visibleCount).map(({ providerId, quote }) => { const needsAction = quotationNeedsCustomerDecision(quote.attributes); const attributes = quote.attributes; const summary = quotationScopeSummary(attributes); return <article className="quote-list-card" key={`${providerId}:${quote.id}`}><div className="quote-list-main"><div className="quote-heading"><Status>{needsAction ? 'Needs your decision' : attributes.status.replaceAll('_', ' ')}</Status></div><h2>{summary.title}</h2><p>{attributes.quotation_number || `Quotation ${quote.id.slice(0, 8)}`} · Revision {attributes.revision} · {currency(attributes.total, attributes.currency)}</p><span>{summary.itemCount} scope item{summary.itemCount === 1 ? '' : 's'} · {attributes.provider_name || providerNames.get(providerId) || 'Service provider'}{attributes.customer_relationship_name ? ` · ${attributes.customer_relationship_name}` : ''}{attributes.valid_until ? ` · Valid until ${date(attributes.valid_until)}` : ''}</span></div><div className="quote-list-total"><Button onClick={() => { onSelectProvider(providerId); window.location.hash = `/quotation/${encodeURIComponent(quote.id)}`; }}>Review details</Button></div></article>; })}</div>}{(rows.length > visibleCount || Object.values(cursors).some(Boolean)) && <Button disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? t('loading') : 'Load more quotations'}</Button>}</section>;
}

export function quotationScopeSummary(attributes: QuotationAttributes) {
  const first = attributes.lines[0]?.description?.trim();
  return {
    title: first || attributes.quotation_number || 'Quotation review',
    itemCount: attributes.lines.length,
    additionalCount: Math.max(0, attributes.lines.length - 1),
  };
}

export function quotationNeedsCustomerDecision(attributes: QuotationAttributes): boolean {
  const status = attributes.status.toLowerCase();
  const eligibleStatus = ['issued', 'viewed', 'under_review'].includes(status);
  const accepted = ['approved', 'accepted'].includes(status);
  const approval = object(attributes.customer_approval);
  const terms = object(attributes.terms);
  const awaitingProvider = text(approval.status) === 'AWAITING_PROVIDER_REVIEW' || attributes.provider_review?.decision !== 'approved';
  const onlineApproval = approval.mode !== 'OFFLINE_SIGNATURE' && terms.online_customer_approval !== false;
  const expired = Boolean(attributes.valid_until && new Date(attributes.valid_until).getTime() < Date.now());
  return !accepted && eligibleStatus && !expired && !awaitingProvider && onlineApproval;
}

export function quotationTaxComponents(attributes: QuotationAttributes) {
  const summary = attributes.tax_summary;
  if (summary?.status !== 'CALCULATED' || !Array.isArray(summary.components)) return [];
  return summary.components.filter((component) => text(component.code) && Number.isFinite(Number(component.amount)));
}

export function QuotationProgress({ activeStep }: { activeStep: number }) {
  const steps = [['Email', 'Quotation sent'], ['Sign in', 'Verify your account'], ['Review', 'Read this revision'], ['Respond', 'Accept or request changes']];
  return <ol className="quotation-process" aria-label="Quotation review process">{steps.map(([title, detail], index) => <li className={index + 1 < activeStep ? 'done' : index + 1 === activeStep ? 'active' : ''} key={title}><span>{index + 1}</span><div><strong>{title}</strong><small>{detail}</small></div></li>)}</ol>;
}

export function QuotationReviewPage({ providerId, id, t }: ReviewProps) {
  const [quotation, setQuotation] = useState<Resource<QuotationAttributes> | null>(null);
  const [approvals, setApprovals] = useState<Collection<QuotationApprovalAttributes> | null>(null);
  const [communications, setCommunications] = useState<Collection<QuotationCommunicationAttributes> | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [checked, setChecked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [declineConfirming, setDeclineConfirming] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [approverName, setApproverName] = useState('');
  const [approverRole, setApproverRole] = useState('');
  const [authorityAttested, setAuthorityAttested] = useState(false);
  useEffect(() => {
    let active = true;
    setQuotation(null); setApprovals(null); setCommunications(null); setLogoUrl(''); setError(''); setActionError(''); setMessage(''); setChecked([]); setConfirming(false); setApproverName(''); setApproverRole(''); setAuthorityAttested(false);
    customerData.quotation(providerId, id).then((value) => { if (active) setQuotation(value); }).catch((cause) => { if (active) setError((cause as Error)?.message || 'This quotation is unavailable to this account.'); });
    customerData.quotationApprovals(providerId, id).then((value) => { if (active) setApprovals(value); }).catch(() => { if (active) setApprovals({ data: [] }); });
    customerData.quotationCommunications(providerId, id).then((value) => { if (active) setCommunications(value); }).catch(() => { if (active) setCommunications({ data: [] }); });
    customerData.quotationProviderLogo(providerId, id).then((value) => { if (active) setLogoUrl(value.transfer.url); }).catch(() => { if (active) setLogoUrl(''); });
    return () => { active = false; };
  }, [providerId, id]);
  const attrs = quotation?.attributes;
  const terms = useMemo(() => object(attrs?.terms), [attrs?.terms]);
  if (error) return <section className="content quote-review"><button className="text-button" onClick={() => { window.location.hash = '/quotations'; }}>← Quotations</button><div className="quote-empty" role="alert"><h1>Quotation unavailable</h1><p>Sign in with the account linked to this quotation and select the matching service provider.</p><small>{error}</small></div></section>;
  if (!quotation || !attrs) return <section className="content"><p role="status">{t('loading')}</p></section>;
  const letterhead = object(terms.letterhead);
  const address = safeAddress(letterhead.address);
  const contacts = object(letterhead.footer_contacts);
  const contactItems = ['phone', 'email', 'website'].map((kind) => ({ kind, contact: object(contacts[kind]) })).filter(({ contact }) => contact.enabled === true && text(contact.value));
  const approval = object(attrs.customer_approval);
  const accepted = ['approved', 'accepted'].includes(attrs.status.toLowerCase());
  const awaitingProvider = text(approval.status) === 'AWAITING_PROVIDER_REVIEW' || attrs.provider_review?.decision !== 'approved';
  const onlineApproval = approval.mode !== 'OFFLINE_SIGNATURE' && terms.online_customer_approval !== false;
  const eligibleStatus = ['issued', 'viewed', 'under_review'].includes(attrs.status.toLowerCase());
  const expired = Boolean(attrs.valid_until && new Date(attrs.valid_until).getTime() < Date.now());
  const canMessage = quotationConversationOpen(attrs.status, attrs.valid_until);
  const canAccept = !accepted && eligibleStatus && !expired && !awaitingProvider && onlineApproval;
  const canDecline = !accepted && eligibleStatus && !expired && !awaitingProvider;
  const materials = customerVisibleMaterials(terms);
  const allUnitCodes = [...new Set([
    ...attrs.lines.flatMap((line) => Array.isArray(line.unit_codes) ? line.unit_codes.map(text).filter(Boolean) : []),
    ...materials.flatMap((material) => list(material.unit_codes).map(text).filter(Boolean)),
  ])];
  const paymentConfig = object(terms.payment_stages);
  const paymentStages = list(paymentConfig.stages).map(object).sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
  const milestoneTerms = list(terms.payment_milestones).map(object);
  const checks = [
    ['scope', 'I have reviewed the quoted equipment, materials and quantities.'],
    ['price', 'I have reviewed the price, taxes and payment schedule.'],
    ['terms', 'I have reviewed the warranty, AMC and terms and conditions.']
  ];
  async function approve() {
    if (!quotation || !attrs || !canAccept) return;
    setBusy(true); setActionError(''); setMessage('');
    try {
      const next = await customerData.approveQuotation(providerId, quotation.id, attrs.revision, crypto.randomUUID(), { approver_name: approverName.trim(), approver_role: approverRole.trim(), authority_attested: true });
      setQuotation(next); setConfirming(false); setMessage('Your acceptance has been recorded. The provider will follow up with the next steps.');
      customerData.quotationApprovals(providerId, id).then(setApprovals).catch(() => undefined);
    } catch (cause) { setActionError((cause as Error)?.message || 'Acceptance could not be recorded. Refresh the quotation and try again.'); }
    finally { setBusy(false); }
  }
  async function decline() {
    if (!quotation || !attrs || !canDecline) return;
    setBusy(true); setActionError(''); setMessage('');
    try {
      const next = await customerData.rejectQuotation(providerId, quotation.id, attrs.revision, declineReason.trim(), crypto.randomUUID());
      setQuotation(next); setDeclineConfirming(false); setDeclineReason(''); setMessage('Your decision to decline this quotation has been recorded. The provider will follow up if needed.');
      customerData.quotationApprovals(providerId, id).then(setApprovals).catch(() => undefined);
    } catch (cause) { setActionError((cause as Error)?.message || 'Your decision could not be recorded. Reload the quotation and try again.'); }
    finally { setBusy(false); }
  }
  return <section className="content quote-review">
    <section className="quotation-review-intro"><Status>Your quotation</Status><h1>{accepted ? 'Quotation details' : 'A clear plan. Your call.'}</h1><p>{accepted ? 'Review the accepted scope, schedule and provider updates.' : 'Review the scope, payment schedule and conditions before deciding. Ask your provider if anything needs clarification.'}</p></section>
    <button className="text-button quote-all-link" onClick={() => { window.location.hash = '/quotations'; }}>← All quotations</button>
    <header className="quote-review-title"><div><Status>{accepted ? 'Accepted' : attrs.status.replaceAll('_', ' ')}</Status><h2>{attrs.quotation_number || `Quotation ${quotation.id.slice(0, 8)}`} · Revision {attrs.revision}</h2><p>Issued {date(attrs.issued_at)} · {attrs.valid_until ? `Valid through ${date(attrs.valid_until)}` : 'Validity not specified'}</p></div><div className="quote-total"><small>Quotation total</small><strong>{currency(attrs.total, attrs.currency)}</strong><span>{attrs.valid_until ? `Valid through ${date(attrs.valid_until)}` : 'Validity not specified'}</span></div></header>
    {(attrs.customer_relationship_name || attrs.lines[0]?.description) && <article className="quote-customer-context" aria-label="Quotation customer and scope"><div>{attrs.customer_relationship_name && <><small>Customer</small><strong>{attrs.customer_relationship_name}</strong></>}</div><div>{attrs.lines[0]?.description && <><small>Quoted scope</small><strong>{attrs.lines[0].description}</strong></>}</div></article>}
    <article className="quote-provider-card"><div className="quote-provider-identity">{logoUrl ? <img className="quote-provider-logo" src={logoUrl} alt={`${text(letterhead.business_name) || attrs.provider_name || 'Provider'} logo`} /> : <div className="quote-provider-mark" aria-hidden="true">{(text(letterhead.business_name) || attrs.provider_name || 'T').slice(0, 1).toUpperCase()}</div>}<div><small>Issued by</small><h2>{text(letterhead.business_name) || attrs.provider_name || 'Your service provider'}</h2>{address && <p>{address}</p>}{text(letterhead.gstin) && <p>GSTIN · {text(letterhead.gstin)}</p>}{text(letterhead.footer_text) && <p>{text(letterhead.footer_text)}</p>}</div></div>{contactItems.length > 0 && <div className="quote-provider-contacts" aria-label="Provider contact details">{contactItems.map(({ kind, contact }) => <p key={kind}><span>{kind === 'phone' ? 'Phone' : kind === 'email' ? 'Email' : 'Website'}</span><strong>{text(contact.value)}</strong></p>)}</div>}<span className="quote-secure">Secure customer review</span></article>
    {actionError && <p className="quote-error" role="alert">{actionError}</p>}{message && <p className="quote-success" role="status">{message}</p>}
    <nav className="quote-section-nav" aria-label="Quotation sections"><button type="button" onClick={() => document.getElementById('quote-scope')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><QuoteIcon name="scope"/>Scope &amp; pricing</button><button type="button" onClick={() => document.getElementById('quote-payment')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><QuoteIcon name="payment"/>Payment &amp; terms</button><button type="button" onClick={() => document.getElementById('quote-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><QuoteIcon name="history"/>Revisions &amp; activity</button><button type="button" onClick={() => document.getElementById('quotation-conversation')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><QuoteIcon name="message"/>Messages{(communications?.data.length || 0) > 0 && <span>{communications?.data.length}</span>}</button></nav>
    <div className="quote-review-grid"><div className="quote-main-column">
      <section className="quote-panel" id="quote-scope"><div className="quote-panel-heading"><div><QuoteIcon name="scope"/><span>01</span><h2>Scope and specifications</h2></div></div>{attrs.lines.length ? <div className="quote-line-list">{attrs.lines.map((line, index) => <article className="quote-line" key={`${line.description}-${index}`}><div><h3><QuoteIcon name="building"/>{line.description}</h3><p>Quantity {line.quantity}</p><QuotationUnitScope unitCodes={line.unit_codes} allUnitCodes={allUnitCodes} />{line.amc && <p>AMC scope: {Object.entries(line.amc).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${String(value)}`).join(' · ')}</p>}</div><div className="quote-line-price"><strong>{currency(line.amount, attrs.currency)}</strong><small>{currency(line.unit_price, attrs.currency)} per unit</small></div></article>)}</div> : <p>No itemized scope was included.</p>}{materials.length > 0 && <div className="quote-materials"><h3>Materials included</h3>{materials.map((item, index) => <article key={`${text(item.description)}-${index}`}><strong>{text(item.description) || 'Material item'}</strong><span>Qty {String(item.quantity ?? '—')}{text(item.unit_code) && ` ${text(item.unit_code)}`}</span><QuotationUnitScope unitCodes={item.unit_codes} allUnitCodes={allUnitCodes} />{list(item.specifications).map((spec, si) => { const row = object(spec); return <small key={si}>{text(row.name)}: {text(row.value)}</small>; })}{Number(item.warranty_months) > 0 && <em>{String(item.warranty_months)} month material warranty</em>}</article>)}</div>}</section>
      <section className="quote-panel" id="quote-payment"><div className="quote-panel-heading"><div><QuoteIcon name="payment"/><span>02</span><h2>Price and payment schedule</h2></div></div><dl className="quote-price-breakdown">{attrs.subtotal && <div><dt>Subtotal</dt><dd>{currency(attrs.subtotal, attrs.currency)}</dd></div>}{attrs.discount_total && Number(attrs.discount_total) !== 0 && <div><dt>Discount</dt><dd>−{currency(attrs.discount_total, attrs.currency)}</dd></div>}{quotationTaxComponents(attrs).length ? quotationTaxComponents(attrs).map((tax) => <div key={tax.code}><dt>{tax.code.replaceAll('_', ' ')}</dt><dd>{currency(tax.amount, attrs.currency)}</dd></div>) : attrs.tax_total && <div><dt>Tax</dt><dd>{currency(attrs.tax_total, attrs.currency)}</dd></div>}<div className="grand-total"><dt>Total</dt><dd>{currency(attrs.total, attrs.currency)}</dd></div></dl>{paymentStages.length > 0 ? <div className="quote-payment-list">{paymentStages.map((stage, index) => <div key={`${text(stage.code)}-${index}`}><span>{text(stage.description) || text(stage.code) || `Payment ${index + 1}`}<small>{text(stage.trigger_kind).replaceAll('_', ' ').toLowerCase()}</small></span><strong>{Number(stage.percentage)}%</strong><b>{currency(percentAmount(attrs.total, Number(stage.percentage)), attrs.currency)}</b></div>)}</div> : milestoneTerms.length > 0 ? <div className="quote-payment-list">{milestoneTerms.map((stage, index) => <div key={`${text(stage.code)}-${index}`}><span>{text(stage.code).replaceAll('_', ' ') || `Payment ${index + 1}`}</span><strong>{Number(stage.percentage)}%</strong><b>{currency(percentAmount(attrs.total, Number(stage.percentage)), attrs.currency)}</b></div>)}</div> : <p>Payment schedule not specified.</p>}</section>
      <section className="quote-panel"><div className="quote-panel-heading"><div><QuoteIcon name="terms"/><span>03</span><h2>Warranty, AMC and conditions</h2></div></div><div className="quote-highlight-grid">{Boolean(terms.included_free_amc) && <div className="quote-highlight amc"><small><QuoteIcon name="amc"/>Included benefit</small><strong>{String(object(terms.included_free_amc).months)} months free AMC</strong><span>{text(object(terms.included_free_amc).frequency).toLowerCase()} visits</span></div>}{text(terms.warranty_terms) && <div className="quote-highlight warranty"><small><QuoteIcon name="warranty"/>Warranty</small><p>{text(terms.warranty_terms)}</p></div>}{text(terms.delivery_terms) && <div className="quote-highlight delivery"><small><QuoteIcon name="delivery"/>Delivery and handover</small><p>{text(terms.delivery_terms)}</p></div>}</div>{list(terms.exclusions).length > 0 && <div className="quote-exclusions"><h3><QuoteIcon name="terms"/>Exclusions</h3><ul>{list(terms.exclusions).map((item, index) => <li key={index}>{String(item)}</li>)}</ul></div>}{text(terms.terms_and_conditions) ? <details className="quote-conditions"><summary><QuoteIcon name="terms"/>Read terms and conditions</summary><p>{text(terms.terms_and_conditions)}</p></details> : <p>Additional terms and conditions were not provided.</p>}</section>
      <section className="quote-panel" id="quote-history"><div className="quote-panel-heading"><div><QuoteIcon name="history"/><span>04</span><h2>Review record</h2></div></div><p>This review is tied to revision {attrs.revision}. A later provider revision will appear as a separate version.</p>{attrs.provider_review && <div className="quote-history-row"><Status>Provider {attrs.provider_review.decision}</Status><span>{date(attrs.provider_review.decided_at)}</span><small>Revision {attrs.provider_review.quotation_revision}</small></div>}{approvals?.data.map((entry) => <div className="quote-history-row" key={entry.id}><Status>{entry.attributes.decision}</Status><span>{date(entry.attributes.decided_at)}</span><small>Revision {entry.attributes.quotation_revision}{entry.attributes.approver_name ? ` · Approved by ${entry.attributes.approver_name}${entry.attributes.approver_role ? `, ${entry.attributes.approver_role}` : ''}` : ''}</small></div>)}</section>
      <QuotationConversation id="quotation-conversation" key={`${providerId}:${id}:${attrs.revision}`} providerId={providerId} quotationId={id} revision={attrs.revision} quotationStatus={attrs.status} quotationValidUntil={attrs.valid_until} messages={communications} onMessages={setCommunications} />
    </div><aside className="quote-side-column"><section className="quote-panel quote-respond"><span className="quote-kicker">Your decision</span><h2>{accepted ? 'Acceptance recorded' : awaitingProvider ? 'Provider review' : expired || !eligibleStatus ? 'Response closed' : 'Ready to respond?'}</h2>{accepted ? <p>Your acceptance was recorded on {date(text(approval.accepted_at))}. The provider owns the next step.</p> : awaitingProvider ? <p>The provider is still reviewing this revision. You can review the details now; response actions open after provider approval.</p> : expired ? <p>This quotation has expired. Contact your provider if you need an updated offer.</p> : !onlineApproval ? <p>This quotation requires an offline signed agreement. Online acceptance is disabled for this revision.</p> : !eligibleStatus ? <p>This quotation is {attrs.status.replaceAll('_', ' ').toLowerCase()} and can no longer be accepted online.</p> : <><p>Confirm that you have reviewed the quoted scope, amount and conditions. Your signed-in account will be recorded as the approver.</p><div className="quote-checklist">{checks.map(([key, label]) => <label key={key}><input type="checkbox" checked={checked.includes(key)} onChange={(event) => setChecked((current) => event.target.checked ? [...current, key] : current.filter((item) => item !== key))} /><span>{label}</span></label>)}</div><Button disabled={checked.length !== checks.length || busy || !canAccept} onClick={() => setConfirming(true)}>Accept quotation</Button></>}{canDecline && <Button variant="secondary" disabled={busy} onClick={() => setDeclineConfirming(true)}>Decline quotation</Button>}{!accepted && canMessage && <div className="quote-help"><strong>Need a change?</strong><p><button type="button" onClick={() => document.getElementById('quotation-conversation')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Send a secure question or change request to your provider.</button></p></div>}<small className="quote-identity-note">Access and approval authority are checked by TRISE after sign-in.</small></section></aside></div>
    {confirming && canAccept && <div className="quote-dialog-backdrop" role="presentation"><section className="quote-dialog" role="dialog" aria-modal="true" aria-labelledby="quote-confirm-title"><Status>Final confirmation</Status><h2 id="quote-confirm-title">Accept revision {attrs.revision}?</h2><p>You are accepting {attrs.quotation_number || 'this quotation'} for {currency(attrs.total, attrs.currency)}. TRISE will record your name, role, authority confirmation, exact revision and time of acceptance.</p><label>Your full name<input value={approverName} onChange={(event) => setApproverName(event.target.value)} maxLength={200} autoComplete="name" required /></label><label>Your role or title<input value={approverRole} onChange={(event) => setApproverRole(event.target.value)} maxLength={120} required /></label><label className="quote-authority-check"><input type="checkbox" checked={authorityAttested} onChange={(event) => setAuthorityAttested(event.target.checked)} />I confirm I am authorised to accept this quotation on behalf of the customer.</label><div><Button disabled={busy || !approverName.trim() || !approverRole.trim() || !authorityAttested} onClick={() => void approve()}>{busy ? 'Recording acceptance…' : 'Confirm acceptance'}</Button><button className="text-button" disabled={busy} onClick={() => setConfirming(false)}>Go back</button></div></section></div>}
    {declineConfirming && canDecline && <div className="quote-dialog-backdrop" role="presentation"><section className="quote-dialog" role="dialog" aria-modal="true" aria-labelledby="quote-decline-title"><Status>Final confirmation</Status><h2 id="quote-decline-title">Decline revision {attrs.revision}?</h2><p>This closes this quotation revision. It cannot be accepted after you decline it. If you only need clarification or a change, send your provider a secure message instead.</p><label>Reason (optional)<textarea value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} maxLength={4000} rows={4} placeholder="Tell your provider why this quote does not work for you" /></label><div><Button variant="danger" disabled={busy} onClick={() => void decline()}>{busy ? 'Recording decision…' : 'Confirm decline'}</Button><button className="text-button" disabled={busy} onClick={() => setDeclineConfirming(false)}>Keep reviewing</button></div></section></div>}
  </section>;
}

function QuotationConversation({ id, providerId, quotationId, revision, quotationStatus, quotationValidUntil, messages, onMessages }: { id: string; providerId: string; quotationId: string; revision: number; quotationStatus: string; quotationValidUntil?: string | null; messages: Collection<QuotationCommunicationAttributes> | null; onMessages: (value: Collection<QuotationCommunicationAttributes>) => void }) {
  const [kind, setKind] = useState<'QUESTION' | 'CHANGE_REQUEST'>('QUESTION');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState<'success' | 'error'>('success');
  const [canReload, setCanReload] = useState(false);
  const open = quotationConversationOpen(quotationStatus, quotationValidUntil);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!body.trim()) return;
    setBusy(true); setNotice(''); setCanReload(false);
    try {
      const created = await customerData.createQuotationCommunication(providerId, quotationId, { expected_revision: revision, message_type: kind, body: body.trim() }, crypto.randomUUID());
      onMessages({ data: [...(messages?.data || []), created] }); setBody(''); setNoticeKind('success'); setNotice('Your message was sent securely to the provider.');
    } catch (cause) { const failure = quotationCommunicationFailure(cause); setNoticeKind('error'); setNotice(failure.message); setCanReload(failure.canReload); }
    finally { setBusy(false); }
  }
  return <section id={id} className="quote-panel quote-conversation"><div className="quote-panel-heading"><div><QuoteIcon name="message"/><span>05</span><h2>Conversation with your provider</h2></div></div><p>Questions and change requests stay attached to this quotation revision. Only signed-in customer and provider accounts can read the thread.</p><div className="quote-message-list" aria-live="polite">{messages === null ? <p role="status">Loading messages…</p> : messages.data.length ? messages.data.map((item) => <article className={`quote-message quote-message-${item.attributes.author_side}`} key={item.id}><header><strong>{item.attributes.author_name}</strong><span>{item.attributes.message_type.replaceAll('_', ' ')} · {date(item.attributes.created_at)} · R{item.attributes.quotation_revision}</span></header><p>{item.attributes.body}</p></article>) : <p>No messages yet. Start a secure conversation if you need clarification.</p>}</div>{open ? <form className="quote-message-form" onSubmit={(event) => void submit(event)}><label>Message type<select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="QUESTION">Ask a question</option><option value="CHANGE_REQUEST">Request a change</option></select></label><label>Your message<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} rows={4} required placeholder="Describe what you need clarified or changed" /></label><Button disabled={busy || !body.trim()}>{busy ? 'Sending…' : 'Send securely'}</Button>{notice && <p className={noticeKind === 'error' ? 'quote-message-error' : 'quote-message-success'} role={noticeKind === 'error' ? 'alert' : 'status'}>{notice}{canReload && <button type="button" className="text-button" onClick={() => window.location.reload()}>Reload quotation</button>}</p>}</form> : <p className="quote-conversation-closed">This quotation is expired or closed. The conversation history remains available.</p>}</section>;
}

function percentAmount(total: string, percent: number) {
  if (!Number.isFinite(percent) || percent < 0) return '0.00';
  const [whole, fraction = ''] = total.split('.');
  const cents = BigInt(whole || '0') * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
  const scaledPercent = BigInt(Math.round(percent * 100));
  const amountCents = (cents * scaledPercent + 5000n) / 10000n;
  return `${amountCents / 100n}.${String(amountCents % 100n).padStart(2, '0')}`;
}

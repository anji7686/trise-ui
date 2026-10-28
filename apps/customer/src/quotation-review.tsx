import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Button, Status } from '@trise/ui';
import { customerData, type Collection, type QuotationApprovalAttributes, type QuotationAttributes, type QuotationCommunicationAttributes, type Resource } from './data';
import './quotation-review.css';

type Props = { providerId: string; t: (key: string) => string };
type ReviewProps = Props & { id: string };
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : '';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
type QuoteIconName = 'scope' | 'building' | 'payment' | 'warranty' | 'amc' | 'delivery' | 'history' | 'message' | 'terms';
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

export function QuotationsPage({ providerId, t }: Props) {
  const [result, setResult] = useState<Collection<QuotationAttributes> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; customerData.quotations(providerId).then((value) => { if (active) setResult(value); }).catch((cause) => { if (active) setError((cause as Error)?.message || 'Unable to load quotations.'); }); return () => { active = false; }; }, [providerId]);
  if (error && !result) return <section className="content"><p className="error" role="alert">{error}</p></section>;
  if (!result) return <section className="content"><p role="status">{t('loading')}</p></section>;
  return <section className="customer-quotes"><section className="quotation-login-intro"><Status>Customer quotation experience</Status><h1>Your quotations</h1><p>Review the scope, provider terms and current status for quotations shared with your account.</p></section>{error && <p className="error" role="alert">{error}</p>}{result.data.length === 0 ? <div className="quote-empty"><h2>No quotations to review</h2><p>When your provider shares a quotation, it will appear here after you sign in.</p></div> : <div className="quote-list">{result.data.map((quote) => <article className="quote-list-card" key={quote.id}><div className="quote-list-main"><div className="quote-heading"><strong>{quote.attributes.quotation_number || `Quotation ${quote.id.slice(0, 8)}`}</strong><Status>{quote.attributes.status.replaceAll('_', ' ')}</Status></div><p>{quote.attributes.provider_name || 'Service provider'}{quote.attributes.customer_relationship_name ? ` · ${quote.attributes.customer_relationship_name}` : ''}</p><span>{quote.attributes.lines.length} scope items · Revision {quote.attributes.revision}{quote.attributes.valid_until ? ` · Valid until ${date(quote.attributes.valid_until)}` : ''}</span></div><div className="quote-list-total"><strong>{currency(quote.attributes.total, quote.attributes.currency)}</strong><Button onClick={() => { window.location.hash = `/quotation/${encodeURIComponent(quote.id)}`; }}>Review quotation</Button></div></article>)}</div>}</section>;
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [checked, setChecked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [approverName, setApproverName] = useState('');
  const [approverRole, setApproverRole] = useState('');
  const [authorityAttested, setAuthorityAttested] = useState(false);
  useEffect(() => {
    let active = true;
    setQuotation(null); setApprovals(null); setCommunications(null); setLogoUrl(''); setError(''); setMessage(''); setChecked([]);
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
  const materials = customerVisibleMaterials(terms);
  const paymentConfig = object(terms.payment_stages);
  const paymentStages = list(paymentConfig.stages).map(object).sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0));
  const milestoneTerms = list(terms.payment_milestones).map(object);
  const checks = [
    ['scope', 'I have reviewed the quoted equipment, materials and quantities.'],
    ['price', 'I have reviewed the price, taxes and payment schedule.'],
    ['terms', 'I have reviewed the warranty, AMC and terms and conditions.']
  ];
  async function approve() {
    if (!quotation || !attrs) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const next = await customerData.approveQuotation(providerId, quotation.id, attrs.revision, crypto.randomUUID(), { approver_name: approverName.trim(), approver_role: approverRole.trim(), authority_attested: true });
      setQuotation(next); setConfirming(false); setMessage('Your acceptance has been recorded. The provider will follow up with the next steps.');
      customerData.quotationApprovals(providerId, id).then(setApprovals).catch(() => undefined);
    } catch (cause) { setError((cause as Error)?.message || 'Acceptance could not be recorded. Refresh the quotation and try again.'); }
    finally { setBusy(false); }
  }
  return <section className="content quote-review">
    <section className="quotation-review-intro"><Status>Customer quotation experience · proposal</Status><h1>Review and respond to a quotation</h1><p>Review the provider’s offer, ask a question if anything needs clarification, and accept only when you’re ready.</p></section>
    <QuotationProgress activeStep={accepted ? 4 : 3} />
    <button className="text-button quote-all-link" onClick={() => { window.location.hash = '/quotations'; }}>← All quotations</button>
    <header className="quote-review-title"><div><Status>{accepted ? 'Accepted' : attrs.status.replaceAll('_', ' ')}</Status><h2>{attrs.quotation_number || `Quotation ${quotation.id.slice(0, 8)}`} · Revision {attrs.revision}</h2><p>Issued {date(attrs.issued_at)} · {attrs.valid_until ? `Valid through ${date(attrs.valid_until)}` : 'Validity not specified'}</p></div><div className="quote-total"><small>Quotation total</small><strong>{currency(attrs.total, attrs.currency)}</strong><span>{attrs.valid_until ? `Valid through ${date(attrs.valid_until)}` : 'Validity not specified'}</span></div></header>
    <article className="quote-provider-card"><div className="quote-provider-identity">{logoUrl ? <img className="quote-provider-logo" src={logoUrl} alt={`${text(letterhead.business_name) || attrs.provider_name || 'Provider'} logo`} /> : <div className="quote-provider-mark" aria-hidden="true">{(text(letterhead.business_name) || attrs.provider_name || 'T').slice(0, 1).toUpperCase()}</div>}<div><small>Issued by</small><h2>{text(letterhead.business_name) || attrs.provider_name || 'Your service provider'}</h2>{address && <p>{address}</p>}{text(letterhead.gstin) && <p>GSTIN · {text(letterhead.gstin)}</p>}{text(letterhead.footer_text) && <p>{text(letterhead.footer_text)}</p>}</div></div>{contactItems.length > 0 && <div className="quote-provider-contacts" aria-label="Provider contact details">{contactItems.map(({ kind, contact }) => <p key={kind}><span>{kind === 'phone' ? 'Phone' : kind === 'email' ? 'Email' : 'Website'}</span><strong>{text(contact.value)}</strong></p>)}</div>}<span className="quote-secure">Secure customer review</span></article>
    {error && <p className="quote-error" role="alert">{error}</p>}{message && <p className="quote-success" role="status">{message}</p>}
    <nav className="quote-section-nav" aria-label="Quotation sections"><button type="button" onClick={() => document.getElementById('quote-scope')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><QuoteIcon name="scope"/>Scope &amp; pricing</button><button type="button" onClick={() => document.getElementById('quote-payment')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><QuoteIcon name="payment"/>Payment &amp; terms</button><button type="button" onClick={() => document.getElementById('quote-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><QuoteIcon name="history"/>Revisions &amp; activity</button><button type="button" onClick={() => document.getElementById('quotation-conversation')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}><QuoteIcon name="message"/>Messages{(communications?.data.length || 0) > 0 && <span>{communications?.data.length}</span>}</button></nav>
    <div className="quote-review-grid"><div className="quote-main-column">
      <section className="quote-panel" id="quote-scope"><div className="quote-panel-heading"><div><QuoteIcon name="scope"/><span>01</span><h2>Scope and specifications</h2></div></div>{attrs.lines.length ? <div className="quote-line-list">{attrs.lines.map((line, index) => <article className="quote-line" key={`${line.description}-${index}`}><div><h3><QuoteIcon name="building"/>{line.description}</h3><p>Quantity {line.quantity}</p>{Array.isArray(line.unit_codes) && line.unit_codes.length > 0 && <p>Applies to units: {line.unit_codes.join(', ')}</p>}{line.amc && <p>AMC scope: {Object.entries(line.amc).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${String(value)}`).join(' · ')}</p>}</div><div className="quote-line-price"><strong>{currency(line.amount, attrs.currency)}</strong><small>{currency(line.unit_price, attrs.currency)} per unit</small></div></article>)}</div> : <p>No itemized scope was included.</p>}{materials.length > 0 && <div className="quote-materials"><h3>Materials included</h3>{materials.map((item, index) => <article key={`${text(item.description)}-${index}`}><strong>{text(item.description) || 'Material item'}</strong><span>Qty {String(item.quantity ?? '—')}{text(item.unit_code) && ` ${text(item.unit_code)}`}</span>{list(item.specifications).map((spec, si) => { const row = object(spec); return <small key={si}>{text(row.name)}: {text(row.value)}</small>; })}{Number(item.warranty_months) > 0 && <em>{String(item.warranty_months)} month material warranty</em>}</article>)}</div>}</section>
      <section className="quote-panel" id="quote-payment"><div className="quote-panel-heading"><div><QuoteIcon name="payment"/><span>02</span><h2>Price and payment schedule</h2></div></div><dl className="quote-price-breakdown">{attrs.subtotal && <div><dt>Subtotal</dt><dd>{currency(attrs.subtotal, attrs.currency)}</dd></div>}{attrs.discount_total && Number(attrs.discount_total) !== 0 && <div><dt>Discount</dt><dd>−{currency(attrs.discount_total, attrs.currency)}</dd></div>}{attrs.tax_total && <div><dt>Tax</dt><dd>{currency(attrs.tax_total, attrs.currency)}</dd></div>}<div className="grand-total"><dt>Total</dt><dd>{currency(attrs.total, attrs.currency)}</dd></div></dl>{paymentStages.length > 0 ? <div className="quote-payment-list">{paymentStages.map((stage, index) => <div key={`${text(stage.code)}-${index}`}><span>{text(stage.description) || text(stage.code) || `Payment ${index + 1}`}<small>{text(stage.trigger_kind).replaceAll('_', ' ').toLowerCase()}</small></span><strong>{Number(stage.percentage)}%</strong><b>{currency(percentAmount(attrs.total, Number(stage.percentage)), attrs.currency)}</b></div>)}</div> : milestoneTerms.length > 0 ? <div className="quote-payment-list">{milestoneTerms.map((stage, index) => <div key={`${text(stage.code)}-${index}`}><span>{text(stage.code).replaceAll('_', ' ') || `Payment ${index + 1}`}</span><strong>{Number(stage.percentage)}%</strong><b>{currency(percentAmount(attrs.total, Number(stage.percentage)), attrs.currency)}</b></div>)}</div> : <p>Payment schedule not specified.</p>}</section>
      <section className="quote-panel"><div className="quote-panel-heading"><div><QuoteIcon name="terms"/><span>03</span><h2>Warranty, AMC and conditions</h2></div></div><div className="quote-highlight-grid">{Boolean(terms.included_free_amc) && <div className="quote-highlight amc"><small><QuoteIcon name="amc"/>Included benefit</small><strong>{String(object(terms.included_free_amc).months)} months free AMC</strong><span>{text(object(terms.included_free_amc).frequency).toLowerCase()} visits</span></div>}{text(terms.warranty_terms) && <div className="quote-highlight warranty"><small><QuoteIcon name="warranty"/>Warranty</small><p>{text(terms.warranty_terms)}</p></div>}{text(terms.delivery_terms) && <div className="quote-highlight delivery"><small><QuoteIcon name="delivery"/>Delivery and handover</small><p>{text(terms.delivery_terms)}</p></div>}</div>{list(terms.exclusions).length > 0 && <div className="quote-exclusions"><h3><QuoteIcon name="terms"/>Exclusions</h3><ul>{list(terms.exclusions).map((item, index) => <li key={index}>{String(item)}</li>)}</ul></div>}{text(terms.terms_and_conditions) ? <details className="quote-conditions"><summary><QuoteIcon name="terms"/>Read terms and conditions</summary><p>{text(terms.terms_and_conditions)}</p></details> : <p>Additional terms and conditions were not provided.</p>}</section>
      <section className="quote-panel" id="quote-history"><div className="quote-panel-heading"><div><QuoteIcon name="history"/><span>04</span><h2>Review record</h2></div></div><p>This review is tied to revision {attrs.revision}. A later provider revision will appear as a separate version.</p>{attrs.provider_review && <div className="quote-history-row"><Status>Provider {attrs.provider_review.decision}</Status><span>{date(attrs.provider_review.decided_at)}</span><small>Revision {attrs.provider_review.quotation_revision}</small></div>}{approvals?.data.map((entry) => <div className="quote-history-row" key={entry.id}><Status>{entry.attributes.decision}</Status><span>{date(entry.attributes.decided_at)}</span><small>Revision {entry.attributes.quotation_revision}{entry.attributes.approver_name ? ` · Approved by ${entry.attributes.approver_name}${entry.attributes.approver_role ? `, ${entry.attributes.approver_role}` : ''}` : ''}</small></div>)}</section>
      <QuotationConversation id="quote-conversation" providerId={providerId} quotationId={id} revision={attrs.revision} quotationStatus={attrs.status} messages={communications} onMessages={setCommunications} />
    </div><aside className="quote-side-column"><section className="quote-panel quote-respond"><span className="quote-kicker">Your decision</span><h2>{accepted ? 'Acceptance recorded' : 'Ready to respond?'}</h2>{accepted ? <p>Your acceptance was recorded on {date(text(approval.accepted_at))}. The provider owns the next step.</p> : awaitingProvider ? <p>The provider is still reviewing this revision. You can review the details now; response actions open after provider approval.</p> : !onlineApproval ? <p>This quotation requires an offline signed agreement. Online acceptance is disabled for this revision.</p> : <><p>Confirm that you have reviewed the quoted scope, amount and conditions. Your signed-in account will be recorded as the approver.</p><div className="quote-checklist">{checks.map(([key, label]) => <label key={key}><input type="checkbox" checked={checked.includes(key)} onChange={(event) => setChecked((current) => event.target.checked ? [...current, key] : current.filter((item) => item !== key))} /><span>{label}</span></label>)}</div><Button disabled={checked.length !== checks.length || busy} onClick={() => setConfirming(true)}>Accept quotation</Button></>}{!accepted && <div className="quote-help"><strong>Need a change?</strong><p><button type="button" onClick={() => document.getElementById('quotation-conversation')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Send a secure question or change request to your provider.</button></p></div>}<small className="quote-identity-note">Access and approval authority are checked by TRISE after sign-in.</small></section></aside></div>
    {confirming && <div className="quote-dialog-backdrop" role="presentation"><section className="quote-dialog" role="dialog" aria-modal="true" aria-labelledby="quote-confirm-title"><Status>Final confirmation</Status><h2 id="quote-confirm-title">Accept revision {attrs.revision}?</h2><p>You are accepting {attrs.quotation_number || 'this quotation'} for {currency(attrs.total, attrs.currency)}. TRISE will record your name, role, authority confirmation, exact revision and time of acceptance.</p><label>Your full name<input value={approverName} onChange={(event) => setApproverName(event.target.value)} maxLength={200} autoComplete="name" required /></label><label>Your role or title<input value={approverRole} onChange={(event) => setApproverRole(event.target.value)} maxLength={200} required /></label><label className="quote-authority-check"><input type="checkbox" checked={authorityAttested} onChange={(event) => setAuthorityAttested(event.target.checked)} />I confirm I am authorised to accept this quotation on behalf of the customer.</label><div><Button disabled={busy || !approverName.trim() || !approverRole.trim() || !authorityAttested} onClick={() => void approve()}>{busy ? 'Recording acceptance…' : 'Confirm acceptance'}</Button><button className="text-button" disabled={busy} onClick={() => setConfirming(false)}>Go back</button></div></section></div>}
  </section>;
}

function QuotationConversation({ id, providerId, quotationId, revision, quotationStatus, messages, onMessages }: { id: string; providerId: string; quotationId: string; revision: number; quotationStatus: string; messages: Collection<QuotationCommunicationAttributes> | null; onMessages: (value: Collection<QuotationCommunicationAttributes>) => void }) {
  const [kind, setKind] = useState<'QUESTION' | 'CHANGE_REQUEST'>('QUESTION');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const open = ['issued', 'viewed', 'under_review', 'revision_requested'].includes(quotationStatus.toLowerCase());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!body.trim()) return;
    setBusy(true); setNotice('');
    try {
      await customerData.createQuotationCommunication(providerId, quotationId, { expected_revision: revision, message_type: kind, body: body.trim() }, crypto.randomUUID());
      onMessages(await customerData.quotationCommunications(providerId, quotationId)); setBody(''); setNotice('Your message was sent securely to the provider.');
    } catch (cause) { setNotice((cause as Error)?.message || 'Message could not be sent. Please try again.'); }
    finally { setBusy(false); }
  }
  return <section id={id} className="quote-panel quote-conversation"><div className="quote-panel-heading"><div><QuoteIcon name="message"/><span>05</span><h2>Conversation with your provider</h2></div></div><p>Questions and change requests stay attached to this quotation revision. Only signed-in customer and provider accounts can read the thread.</p><div className="quote-message-list" aria-live="polite">{messages === null ? <p role="status">Loading messages…</p> : messages.data.length ? messages.data.map((item) => <article className={`quote-message quote-message-${item.attributes.author_side}`} key={item.id}><header><strong>{item.attributes.author_name}</strong><span>{item.attributes.message_type.replaceAll('_', ' ')} · {date(item.attributes.created_at)} · R{item.attributes.quotation_revision}</span></header><p>{item.attributes.body}</p></article>) : <p>No messages yet. Start a secure conversation if you need clarification.</p>}</div>{open ? <form className="quote-message-form" onSubmit={(event) => void submit(event)}><label>Message type<select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="QUESTION">Ask a question</option><option value="CHANGE_REQUEST">Request a change</option></select></label><label>Your message<textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={4000} rows={4} required placeholder="Describe what you need clarified or changed" /></label><Button disabled={busy || !body.trim()}>{busy ? 'Sending…' : 'Send securely'}</Button>{notice && <p role="status">{notice}</p>}</form> : <p className="quote-conversation-closed">This quotation is closed for new messages. The conversation history remains available.</p>}</section>;
}

function percentAmount(total: string, percent: number) {
  if (!Number.isFinite(percent) || percent < 0) return '0.00';
  const [whole, fraction = ''] = total.split('.');
  const cents = BigInt(whole || '0') * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
  const scaledPercent = BigInt(Math.round(percent * 100));
  const amountCents = (cents * scaledPercent + 5000n) / 10000n;
  return `${amountCents / 100n}.${String(amountCents % 100n).padStart(2, '0')}`;
}

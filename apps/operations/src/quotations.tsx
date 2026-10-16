import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@trise/ui';
import { operationsData, type Collection, type GenericAttributes, type Resource } from './data';
import { OperationsStatus as Status } from './operations-status';

type Props = { providerId: string };

export function QuotationsWorkspace({ providerId }: Props) {
  const [quotations, setQuotations] = useState<Collection<GenericAttributes> | null>(null);
  const [leads, setLeads] = useState<Collection<GenericAttributes> | null>(null);
  const [relationships, setRelationships] = useState<Collection<GenericAttributes> | null>(null);
  const [contracts, setContracts] = useState<Collection<GenericAttributes> | null>(null);
  const [convertedContract, setConvertedContract] = useState<Resource<GenericAttributes> | null>(null);
  const [selected, setSelected] = useState<Resource<GenericAttributes> | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function reload() {
    setQuotations(null);
    void Promise.all([
      operationsData.quotations(providerId),
      operationsData.marketingLeads(providerId),
      operationsData.customerRelationships(providerId),
      operationsData.genericCollection(providerId, '/maintenance-contracts?page[limit]=100').catch(() => ({ data: [] }))
    ]).then(([quoteRows, leadRows, relationshipRows, contractRows]) => {
      setQuotations(quoteRows);
      setLeads(leadRows as Collection<GenericAttributes>);
      setRelationships(relationshipRows);
      setContracts(contractRows);
    }).catch((cause) => setError((cause as Error).message));
  }

  useEffect(reload, [providerId]);

  async function createQuotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); setMessage('');
    try {
      const amount = Number(form.get('amount'));
      const effectiveFrom = new Date();
      const effectiveTo = new Date(effectiveFrom);
      effectiveTo.setFullYear(effectiveTo.getFullYear() + 1);
      const created = await operationsData.createQuotation(providerId, {
        customer_relationship_id: form.get('customer_relationship_id'),
        lead_id: form.get('lead_id') || undefined,
        purpose: 'INSTALLATION',
        terms: { elevator_units: [{ unit_code: 'LIFT-A' }], materials: [], installation_charges: String(amount), tax_source: 'CANONICAL_PROVIDER_TAX', delivery_terms: 'Provider delivery terms', payment_milestones: [{ code: 'ADVANCE', percentage: 50 }], warranty_terms: 'As accepted in the quotation', included_free_amc: { months: 12, frequency: 'QUARTERLY' }, effective_from: effectiveFrom.toISOString(), effective_to: effectiveTo.toISOString(), timezone_name: 'Asia/Kolkata', exclusions: [], validity_days: 30 },
        currency: 'INR',
        lines: [{ description: form.get('description'), quantity: 1, unit_price: amount, amount }]
      }, crypto.randomUUID());
      setSelected(created); setMessage('Quotation draft created by the server.'); reload(); event.currentTarget.reset();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  async function issueQuotation() {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const updated = await operationsData.transitionQuotation(providerId, selected.id,
        { action: 'issue', expected_revision: Number(selected.attributes.revision) }, crypto.randomUUID());
      setSelected(updated); setMessage('Quotation issued; approval remains a separate protected workflow.'); reload();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  async function createQuotationRevision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true); setError(''); setMessage('');
    try {
      const amount = Number(form.get('amount'));
      const revised = await operationsData.createQuotationRevision(providerId, selected.id, {
        expected_revision: Number(selected.attributes.revision),
        lines: [{ description: form.get('description'), quantity: 1, unit_price: amount, amount }]
      }, crypto.randomUUID());
      setSelected(revised); setMessage('New quotation revision created; the prior issued revision remains immutable.'); reload(); formElement.reset();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  async function createRenewalQuotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const contract = contracts?.data.find((item) => item.id === form.get('predecessor_contract_id'));
    const relationship = contract?.relationships.customer_relationship;
    if (!contract || !relationship || Array.isArray(relationship)) { setError('Select an authorized maintenance contract with a customer relationship.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const created = await operationsData.createQuotation(providerId, {
        customer_relationship_id: relationship.id,
        purpose: 'CONTRACT_RENEWAL',
        terms: { effective_from: `${String(form.get('effective_from'))}T00:00:00Z`, effective_to: `${String(form.get('effective_to'))}T00:00:00Z`, timezone_name: 'Asia/Kolkata', predecessor_contract_id: contract.id, paid_renewal: true, included_free_amc: { months: 0 }, validity_days: 30 },
        currency: 'INR',
        lines: [{ description: form.get('description'), quantity: 1, unit_price: Number(form.get('amount')), amount: Number(form.get('amount')) }]
      }, crypto.randomUUID());
      setSelected(created); setMessage('Paid AMC renewal quotation draft created. Customer acceptance remains required before contract activation.'); reload(); event.currentTarget.reset();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  async function recordNegotiation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      await operationsData.createQuotationNegotiation(providerId, selected.id, {
        event_type: form.get('event_type'), notes: form.get('notes'), offered_total: form.get('offered_total') || undefined, currency_code: 'INR'
      }, crypto.randomUUID());
      setMessage('Negotiation event recorded in immutable history.'); event.currentTarget.reset();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  async function convertQuotation() {
    if (!selected) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const renewal = String(selected.attributes.purpose || '').toUpperCase() === 'CONTRACT_RENEWAL';
      const convertedPayload = await operationsData.convertQuotation(providerId, selected.id, { target: renewal ? 'DRAFT_MAINTENANCE_CONTRACT' : 'INSTALLATION_CASE', expected_revision: Number(selected.attributes.revision) }, crypto.randomUUID());
      const converted = ((convertedPayload as unknown as { data?: Resource<GenericAttributes> }).data || convertedPayload) as Resource<GenericAttributes>;
      if (renewal) {
        const terms = selected.attributes.terms as { effective_from?: string } | undefined;
        converted.attributes = { ...converted.attributes, effective_from: terms?.effective_from };
      }
      setMessage(renewal ? `Renewal draft contract ${converted.id} created; activation remains separately authorized.` : `Quotation converted to installation project ${converted.id}.`);
      if (renewal) setConvertedContract(converted);
      if (!renewal) window.location.hash = 'projects';
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  async function activateConvertedContract() {
    if (!convertedContract) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const activated = await operationsData.transitionMaintenanceContract(providerId, convertedContract.id, {
        action: 'activate', effective_at: String(convertedContract.attributes.effective_from || new Date().toISOString()),
        reason: 'Customer accepted paid AMC renewal', expected_revision: Number(convertedContract.attributes.revision || 1)
      }, crypto.randomUUID());
      setConvertedContract(activated);
      setMessage(`Paid AMC renewal contract ${activated.id} activated.`);
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  async function downloadQuotationPdf() {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const blob = await operationsData.quotationPdf(providerId, selected.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${String(selected.attributes.quotation_number || selected.id)}-revision-${String(selected.attributes.revision)}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage('Immutable quotation PDF downloaded.');
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  if (error && !quotations) return <section className="notice state-error" role="alert"><strong>{error}</strong></section>;
  if (!quotations) return <section className="notice" role="status"><strong>Loading quotations…</strong></section>;
  const relationshipOptions = relationships?.data || [];
  const leadRelationshipOptions = (leads?.data || []).flatMap((lead) => {
    const relationship = lead.relationships.customer_relationship;
    return relationship && !Array.isArray(relationship) ? [{ id: relationship.id, label: `${String(lead.attributes.title || lead.id)} · ${String(lead.attributes.reference_code || lead.id)} · prospect` }] : [];
  });
  const selectableRelationships = [...leadRelationshipOptions, ...relationshipOptions.map((item) => ({ id: item.id, label: String(item.attributes.display_name || item.attributes.name || item.id) }))]
    .filter((item, index, values) => values.findIndex((candidate) => candidate.id === item.id) === index);
  return <section className="content provider-leads">
    <div className="section-heading"><div><span className="eyebrow">Sales &amp; Marketing</span><h2>Quotations</h2></div></div>
    <p className="notice">Drafts and negotiation history are provider-scoped. Customer acceptance and quotation approval remain separate server-authorized actions.</p>
    <section className="detail-card" aria-label="New quotation"><h3>Prepare quotation</h3>
      {!relationshipOptions.length && <p className="notice">A provider customer/prospect relationship is required before a quotation can be created.</p>}
      <form onSubmit={createQuotation}><div className="form-grid">
        <label>Customer relationship<select name="customer_relationship_id" required disabled={!selectableRelationships.length}><option value="">Select relationship</option>{selectableRelationships.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>Lead<select name="lead_id"><option value="">No linked lead</option>{leads?.data.map((item) => <option key={item.id} value={item.id}>{String(item.attributes.title || item.id)} · {String(item.attributes.reference_code || item.id)}</option>)}</select></label>
        <label>Description<input name="description" required defaultValue="Elevator installation" /></label>
        <label>Total (INR)<input name="amount" type="number" min="0" step="0.01" required /></label>
      </div><Button disabled={busy || !selectableRelationships.length}>{busy ? 'Saving…' : 'Create draft'}</Button></form>
    </section>
    <section className="detail-card" aria-label="Paid AMC renewal quotation"><h3>Paid AMC renewal</h3><p className="notice">Create a renewal quotation against an authorized predecessor contract. The customer must accept the exact revision before activation.</p><form onSubmit={(event) => void createRenewalQuotation(event)}><div className="form-grid"><label>Predecessor contract<select name="predecessor_contract_id" required disabled={!contracts?.data.length}><option value="">Select active contract</option>{contracts?.data.filter((item) => ['active', 'approved'].includes(String(item.attributes.status || '').toLowerCase())).map((item) => <option key={item.id} value={item.id}>{String(item.attributes.name || item.attributes.contract_number || item.id)} · {String(item.attributes.status)}</option>)}</select></label><label>Description<input name="description" required defaultValue="Paid AMC renewal" /></label><label>Amount (INR)<input name="amount" type="number" min="0.01" step="0.01" required /></label><label>Effective from<input name="effective_from" type="date" required /></label><label>Effective to<input name="effective_to" type="date" required /></label></div><Button type="submit" disabled={busy || !contracts?.data.length}>{busy ? 'Saving…' : 'Create renewal quotation'}</Button></form></section>
    <div className="record-grid">{quotations.data.length === 0 ? <p className="notice">No quotations are visible in this provider.</p> : quotations.data.map((quotation) => <button className="record-card" key={quotation.id} onClick={() => setSelected(quotation)}><Status>{String(quotation.attributes.status || 'DRAFT')}</Status><strong>{String(quotation.attributes.quotation_number || quotation.id)}</strong><span>{String(quotation.attributes.total || quotation.attributes.grand_total || '')} {String(quotation.attributes.currency || 'INR')}</span><small>Revision {String(quotation.attributes.revision || '')}</small></button>)}</div>
    {selected && <aside className="detail-card" aria-label="Quotation detail"><div className="section-heading"><div><span className="eyebrow">Quotation detail</span><h3>{String(selected.attributes.quotation_number || selected.id)}</h3></div><button className="text-button" onClick={() => setSelected(null)}>Close</button></div>
      <dl><dt>Status</dt><dd>{String(selected.attributes.status)}</dd><dt>Revision</dt><dd>{String(selected.attributes.revision)}</dd><dt>Total</dt><dd>{String(selected.attributes.total || '')} {String(selected.attributes.currency || '')}</dd></dl>
      {String(selected.attributes.status) === 'draft' && <Button onClick={() => void issueQuotation()} disabled={busy}>Issue quotation</Button>}
      {String(selected.attributes.status) !== 'draft' && <Button onClick={() => void downloadQuotationPdf()} disabled={busy}>Download PDF</Button>}
      {['issued', 'viewed', 'under_review'].includes(String(selected.attributes.status).toLowerCase()) && <details><summary>Create revision</summary><form onSubmit={(event) => void createQuotationRevision(event)}><div className="form-grid"><label>Description<input name="description" required defaultValue="Revised elevator installation" /></label><label>Total (INR)<input name="amount" type="number" min="0" step="0.01" required /></label></div><Button disabled={busy}>Create quotation revision</Button></form></details>}
      {['approved', 'accepted'].includes(String(selected.attributes.status).toLowerCase()) && <Button onClick={() => void convertQuotation()} disabled={busy}>{String(selected.attributes.purpose || '').toUpperCase() === 'CONTRACT_RENEWAL' ? 'Create renewal contract draft' : 'Convert to installation project'}</Button>}
      {convertedContract && String(convertedContract.attributes.status || '').toLowerCase() === 'draft' && <div className="detail-card"><h4>Renewal contract draft</h4><p>Customer acceptance is recorded. Activate this successor only through the authorized provider workflow.</p><Button onClick={() => void activateConvertedContract()} disabled={busy}>Activate paid AMC renewal</Button></div>}
      <details open><summary>Negotiation history</summary><form onSubmit={recordNegotiation}><label>Event<select name="event_type"><option value="CUSTOMER_FEEDBACK">Customer feedback</option><option value="DISCOUNT_REQUESTED">Discount requested</option><option value="SCOPE_CHANGE">Scope change</option><option value="TERMS_CHANGE">Terms change</option><option value="COUNTER_OFFER">Counter offer</option></select></label><label>Notes<textarea name="notes" required maxLength={4000} /></label><label>Offered total<input name="offered_total" type="number" min="0" step="0.01" /></label><Button disabled={busy}>Record negotiation</Button></form></details>
    </aside>}
    {message && <p className="success" role="status">{message}</p>}{error && <p className="error" role="alert">{error}</p>}
  </section>;
}

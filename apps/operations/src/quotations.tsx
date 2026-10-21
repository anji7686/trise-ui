import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@trise/ui';
import { useAuth } from '@trise/auth';
import { operationsData, type Collection, type GenericAttributes, type Resource } from './data';
import { accessData } from './access-data';
import { OperationsStatus as Status } from './operations-status';
import { OperationsDialog } from './operations-dialog';
import { ProviderActionMenu } from './operations-shared';

type Props = { providerId: string };

export function QuotationsWorkspace({ providerId }: Props) {
  const { session } = useAuth();
  const [quotations, setQuotations] = useState<Collection<GenericAttributes> | null>(null);
  const [leads, setLeads] = useState<Collection<GenericAttributes> | null>(null);
  const [relationships, setRelationships] = useState<Collection<GenericAttributes> | null>(null);
  const [contracts, setContracts] = useState<Collection<GenericAttributes> | null>(null);
  const [convertedContract, setConvertedContract] = useState<Resource<GenericAttributes> | null>(null);
  const [selected, setSelected] = useState<Resource<GenericAttributes> | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pageCursor, setPageCursor] = useState<{ after?: string; before?: string }>({});
  const [pageLimit, setPageLimit] = useState(10);
  const [queryText, setQueryText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [renewalOpen, setRenewalOpen] = useState(false);
  const [detailDialog, setDetailDialog] = useState<'edit' | 'revision' | 'negotiation' | null>(null);
  const [reviewDialog, setReviewDialog] = useState<'approve' | 'reject' | null>(null);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryRecipients, setDeliveryRecipients] = useState<Array<{ id: string; display_name: string; email: string }>>([]);
  const [deliveryHistory, setDeliveryHistory] = useState<Collection<GenericAttributes> | null>(null);
  const [effectivePermissions, setEffectivePermissions] = useState<string[] | null>(null);
  const automaticQuotationSelection = useRef(true);

  useEffect(() => {
    let active = true;
    setEffectivePermissions(null);
    if (!session?.userId) return;
    void accessData.selfEffectivePermissions(providerId).then((preview) => {
      if (active) setEffectivePermissions(preview.data.attributes.membership_active ? preview.data.attributes.permissions.filter((permission) => permission.grant_effective).map((permission) => permission.code) : []);
    }).catch(() => { if (active) setEffectivePermissions([]); });
    return () => { active = false; };
  }, [providerId, session?.userId]);

  const hasPermission = (code: string) => effectivePermissions?.includes(code) === true;

  function reload() {
    setQuotations(null);
    void Promise.all([
      operationsData.quotations(providerId, { ...pageCursor, limit: pageLimit, query: queryText.trim() || undefined, status: statusFilter || undefined, customerRelationshipId: customerFilter || undefined }),
      // The register is cursor-paginated, but the create form needs a bounded
      // authorized lookup so a newly-created lead is selectable even when it
      // is not on the first ten quotation rows.
      operationsData.marketingLeads(providerId, { limit: 100 }).catch((cause: unknown) => {
        if (typeof cause === 'object' && cause !== null && 'status' in cause && cause.status === 403) return { data: [] };
        throw cause;
      }),
      operationsData.customerRelationships(providerId).catch((cause: unknown) => {
        // A quotation reader/manager may not have general customer-directory
        // visibility. Keep the authorized quotation register available; the
        // server still enforces relationship access for each mutation.
        if (typeof cause === 'object' && cause !== null && 'status' in cause && cause.status === 403) return { data: [] };
        throw cause;
      }),
      operationsData.genericCollection(providerId, '/maintenance-contracts?page[limit]=100').catch(() => ({ data: [] }))
    ]).then(([quoteRows, leadRows, relationshipRows, contractRows]) => {
      setQuotations(quoteRows);
      setLeads(leadRows as Collection<GenericAttributes>);
      setRelationships(relationshipRows);
      setContracts(contractRows);
    }).catch((cause) => setError((cause as Error).message));
  }

  useEffect(reload, [providerId, pageCursor, pageLimit, queryText, statusFilter, customerFilter]);

  useEffect(() => {
    setPageCursor({});
    setSelected(null);
    automaticQuotationSelection.current = true;
  }, [providerId, queryText, statusFilter, customerFilter]);

  async function createQuotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); setMessage('');
    try {
      const amount = Number(form.get('amount'));
      const unitCodes = String(form.get('lift_unit_codes') || '').split(',').map((code) => code.trim()).filter(Boolean);
      if (!unitCodes.length || unitCodes.length > 100 || unitCodes.some((code) => code.length > 80) || new Set(unitCodes.map((code) => code.toLowerCase())).size !== unitCodes.length) {
        throw new Error('Enter 1–100 unique lift unit codes, each no longer than 80 characters.');
      }
      const effectiveFrom = new Date();
      const effectiveTo = new Date(effectiveFrom);
      effectiveTo.setDate(effectiveTo.getDate() + 30);
      const created = await operationsData.createQuotation(providerId, {
        customer_relationship_id: form.get('customer_relationship_id'),
        lead_id: form.get('lead_id') || undefined,
        purpose: 'INSTALLATION',
        terms: { elevator_units: unitCodes.map((unit_code) => ({ unit_code })), materials: [], installation_charges: String(amount), tax_source: 'CANONICAL_PROVIDER_TAX', delivery_terms: 'Provider delivery terms', payment_milestones: [{ code: 'ADVANCE', percentage: 50 }], warranty_terms: 'As accepted in the quotation', included_free_amc: { months: 12, frequency: 'QUARTERLY' }, effective_from: effectiveFrom.toISOString(), effective_to: effectiveTo.toISOString(), exclusions: [], validity_days: 30 },
        currency: 'INR',
        lines: [{ description: form.get('description'), quantity: 1, unit_price: amount, amount }]
      }, crypto.randomUUID());
      automaticQuotationSelection.current = false; setSelected(created); setCreateOpen(false); setMessage('Quotation draft created by the server.'); reload(); event.currentTarget.reset();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  async function issueQuotation() {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const updated = await operationsData.transitionQuotation(providerId, selected.id,
        { action: 'issue', expected_revision: Number(selected.attributes.revision) }, crypto.randomUUID());
      setSelected(updated); setMessage('Quotation issued; awaiting Provider review before customer acceptance.'); reload();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  async function updateDraftQuotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get('amount'));
    setBusy(true); setError(''); setMessage('');
    try {
      const updated = await operationsData.updateQuotation(providerId, selected.id, {
        expected_revision: Number(selected.attributes.revision),
        lines: [{ description: form.get('description'), quantity: 1, unit_price: amount, amount }],
      }, crypto.randomUUID());
      setSelected(updated); setMessage('Draft quotation updated by the server.'); setDetailDialog(null); reload();
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
      setSelected(revised); setMessage('New quotation revision created; the prior issued revision remains immutable.'); setDetailDialog(null); reload(); formElement.reset();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  async function createRenewalQuotation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const contract = contracts?.data.find((item) => item.id === form.get('predecessor_contract_id'));
    const relationship = contract?.relationships.customer_relationship;
    if (!contract || !relationship || Array.isArray(relationship)) { setError('Select an authorized maintenance contract with a customer relationship.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const created = await operationsData.createQuotation(providerId, {
        customer_relationship_id: relationship.id,
        purpose: 'CONTRACT_RENEWAL',
        terms: { effective_from: `${String(form.get('effective_from'))}T00:00:00Z`, effective_to: `${String(form.get('effective_to'))}T00:00:00Z`, predecessor_contract_id: contract.id, paid_renewal: true, included_free_amc: { months: 0 }, validity_days: 30 },
        currency: 'INR',
        lines: [{ description: form.get('description'), quantity: 1, unit_price: Number(form.get('amount')), amount: Number(form.get('amount')) }]
      }, crypto.randomUUID());
      automaticQuotationSelection.current = false; setSelected(created); setRenewalOpen(false); setMessage('Paid AMC renewal quotation draft created. Customer acceptance remains required before contract activation.'); reload(); formElement.reset();
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
      setMessage('Negotiation event recorded in immutable history.'); setDetailDialog(null); event.currentTarget.reset();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  async function recordProviderReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !reviewDialog || !hasPermission('QUOTATION_APPROVE')) return;
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); setMessage('');
    try {
      const review = await operationsData.reviewProviderQuotation(providerId, selected.id, {
        decision: reviewDialog === 'approve' ? 'APPROVED' : 'REJECTED',
        expected_revision: Number(selected.attributes.revision),
        ...(reviewDialog === 'reject' ? { reason: String(form.get('reason') || '').trim() } : {})
      }, crypto.randomUUID());
      setSelected({ ...selected, attributes: { ...selected.attributes, provider_review: { decision: String(review.attributes.decision).toLowerCase(), quotation_revision: Number(review.attributes.quotation_revision), reason: review.attributes.reason || null, decided_at: review.attributes.decided_at } } });
      setMessage(reviewDialog === 'approve' ? 'Provider review approved for this exact quotation revision. Customer acceptance remains separate.' : 'Provider review rejected for this quotation revision.');
      setReviewDialog(null);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
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
      setContracts((current) => current ? { ...current, data: [activated, ...current.data.filter((item) => item.id !== activated.id)] } : current);
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

  async function openQuotationDelivery() {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const [recipients, history] = await Promise.all([
        operationsData.quotationDeliveryRecipients(providerId, selected.id),
        operationsData.quotationDeliveries(providerId, selected.id)
      ]);
      setDeliveryRecipients(recipients.data);
      setDeliveryHistory(history);
      setDeliveryOpen(true);
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  async function sendQuotationRevision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const contactPointId = String(new FormData(event.currentTarget).get('contact_point_id') || '');
    if (!contactPointId) { setError('Choose an authorized contact before sending.'); return; }
    setBusy(true); setError('');
    try {
      await operationsData.createQuotationDelivery(providerId, selected.id,
        { contact_point_id: contactPointId, expected_revision: Number(selected.attributes.revision) }, crypto.randomUUID());
      setDeliveryHistory(await operationsData.quotationDeliveries(providerId, selected.id));
      setMessage('Delivery request queued for the approved quotation revision. SMTP acceptance will appear in delivery history.');
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
  const selectedTerms = selected?.attributes.terms as { predecessor_contract_id?: string } | undefined;
  const renewalPredecessorId = selectedTerms?.predecessor_contract_id || String(convertedContract?.attributes.predecessor_contract_id || '');
  const renewalPredecessor = contracts?.data.find((item) => item.id === renewalPredecessorId);
  const quoteStatus = (quotation: Resource<GenericAttributes>) => String(quotation.attributes.status || '').toLowerCase();
  const draftCount = quotations.data.filter((quotation) => quoteStatus(quotation) === 'draft').length;
  const approvalCount = quotations.data.filter((quotation) => ['issued', 'viewed', 'under_review'].includes(quoteStatus(quotation))).length;
  const acceptedCount = quotations.data.filter((quotation) => ['accepted', 'approved'].includes(quoteStatus(quotation))).length;
  const visibleQuotations = quotations.data;
  const customerNameFor = (quotation: Resource<GenericAttributes>) => {
    const link = quotation.relationships.customer_relationship;
    const relationshipId = link && !Array.isArray(link) ? link.id : '';
    const linkedLead = (leads?.data || []).find((lead) => {
      const leadLink = lead.relationships.customer_relationship;
      return relationshipId && leadLink && !Array.isArray(leadLink) && leadLink.id === relationshipId;
    });
    if (linkedLead) return String(linkedLead.attributes.prospect_name || linkedLead.attributes.title || 'Prospect');
    const relationship = relationshipOptions.find((item) => item.id === relationshipId);
    if (relationship) return String(relationship.attributes.display_name || relationship.attributes.name || `Customer relationship ${relationship.id.slice(0, 8)}`);
    return 'Customer not linked';
  };
  const amountFor = (quotation: Resource<GenericAttributes>) => {
    const amount = Number(quotation.attributes.total || quotation.attributes.grand_total || 0);
    const currency = String(quotation.attributes.currency || 'INR');
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  };
  const dateFor = (value: unknown) => {
    if (typeof value !== 'string' || !value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  };
  return <section className="content provider-leads">
    <div className="feature-page-heading"><div><span className="eyebrow">Sales &amp; Marketing</span><h2>Quotations &amp; Orders</h2><p>Build, review and convert provider-scoped commercial revisions.</p></div><div className="quotation-workspace-actions">{hasPermission('QUOTATION_CREATE') && <Button type="button" variant="secondary" disabled={!contracts?.data.some((item) => ['active', 'approved'].includes(String(item.attributes.status || '').toLowerCase()))} onClick={() => setRenewalOpen(true)}>Create paid AMC renewal</Button>}{hasPermission('QUOTATION_CREATE') && <Button type="button" onClick={() => setCreateOpen(true)}>+ New quotation</Button>}</div></div>
    <div className="feature-summary-grid quotation-summary-grid"><div><span>Drafts on page</span><strong>{draftCount}</strong><small>Current server page</small></div><div><span>Awaiting approval</span><strong>{approvalCount}</strong><small>Current server page</small></div><div><span>Accepted on page</span><strong>{acceptedCount}</strong><small>Current server page</small></div><div><span>Stage billing due</span><strong>—</strong><small>View Projects &amp; Stages</small></div></div>
    {createOpen && <OperationsDialog title="Create quotation" busy={busy} onClose={() => setCreateOpen(false)} className="quotation-create-dialog"><section className="quotation-create-grid"><section className="detail-card" aria-label="New quotation"><span className="eyebrow">New commercial draft</span><h3>Prepare quotation</h3>
      {!relationshipOptions.length && <p className="notice">A provider customer/prospect relationship is required before a quotation can be created.</p>}
      <form onSubmit={createQuotation}><p className="notice">This draft does not pre-allocate payment percentages or free AMC. Configure the accepted payable basis and stage schedule in the authorized project workflow.</p><div className="form-grid">
        <label>Customer relationship<select name="customer_relationship_id" required disabled={!selectableRelationships.length}><option value="">Select relationship</option>{selectableRelationships.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>Lead<select name="lead_id"><option value="">No linked lead</option>{leads?.data.map((item) => <option key={item.id} value={item.id}>{String(item.attributes.title || item.id)} · {String(item.attributes.reference_code || item.id)}</option>)}</select></label>
        <label>Description<input name="description" required defaultValue="Elevator installation" /></label>
        <label>Lift unit codes (comma separated)<input aria-label="Lift unit codes (comma separated)" aria-describedby="lift-unit-code-help" name="lift_unit_codes" required maxLength={8100} defaultValue="Lift 1" /><small id="lift-unit-code-help">Use one unique unit code per quoted lift.</small></label>
        <label>Total (INR)<input name="amount" type="number" min="0" step="0.01" required /></label>
      </div><div className="provider-form-actions"><Button type="button" variant="quiet" onClick={() => setCreateOpen(false)}>Cancel</Button><Button disabled={busy || !selectableRelationships.length}>{busy ? 'Saving…' : 'Create draft'}</Button></div></form>
    </section></section></OperationsDialog>}
    {renewalOpen && <OperationsDialog title="Create paid AMC renewal quotation" busy={busy} onClose={() => setRenewalOpen(false)}><div className="quotation-renewal-dialog-content"><p className="notice">This creates a provider-scoped renewal quotation against an active predecessor. The customer must accept the exact quotation revision before a separate successor contract can be activated.</p><form className="quotation-modal-form" onSubmit={(event) => { void createRenewalQuotation(event); }}><label>Predecessor contract<select name="predecessor_contract_id" required><option value="">Select active contract</option>{contracts?.data.filter((item) => ['active', 'approved'].includes(String(item.attributes.status || '').toLowerCase())).map((item) => <option key={item.id} value={item.id}>{String(item.attributes.name || item.attributes.contract_number || item.id)} · {String(item.attributes.status)}</option>)}</select></label><label>Description<input name="description" required defaultValue="Paid AMC renewal" /></label><label>Amount (INR)<input name="amount" type="number" min="0.01" step="0.01" required /></label><div className="quotation-renewal-date-grid"><label>Effective from<input name="effective_from" type="date" required /></label><label>Effective to<input name="effective_to" type="date" required /></label></div><div className="provider-form-actions"><Button type="button" variant="quiet" disabled={busy} onClick={() => setRenewalOpen(false)}>Cancel</Button><Button type="submit" disabled={busy || !contracts?.data.some((item) => ['active', 'approved'].includes(String(item.attributes.status || '').toLowerCase()))}>{busy ? 'Saving…' : 'Create renewal quotation'}</Button></div></form></div></OperationsDialog>}
    <div className="leads-filters quotations-filters">
      <label>Search quotations<input aria-label="Search quotations" placeholder="Search quotation number or description…" value={queryText} onChange={(event) => setQueryText(event.target.value)} /></label>
      <label>Quote status<select aria-label="Filter quotations by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{[...new Set(quotations.data.map((quotation) => quoteStatus(quotation)))].map((status) => <option key={status} value={status}>{status.toUpperCase()}</option>)}</select></label>
      <label>Customer<select aria-label="Filter quotations by customer" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}><option value="">All customers</option>{relationshipOptions.map((item) => <option key={item.id} value={item.id}>{String(item.attributes.display_name || item.attributes.name || `Relationship ${item.id.slice(0, 8)}`)}</option>)}</select></label>
      <span className="quotations-filter-result">Showing {visibleQuotations.length} quotations on this server page</span>
    </div>
    <section className="quotations-workspace quotations-workspace--full"><div className="quotations-list-panel"><div className="section-heading"><div><h3>Quotations ({visibleQuotations.length})</h3><p>Provider-scoped quotations and accepted orders. Choose View to open the authorized quotation workspace.</p></div><span>{quotations.data.length} loaded</span></div>
      {visibleQuotations.length === 0 ? <p className="notice">{quotations.data.length ? 'No quotations match the current filters.' : 'No quotations are visible in this provider.'}</p> : <div className="quotation-register-scroll"><table className="quotation-register"><thead><tr><th scope="col">Quote no. / customer</th><th scope="col">Scope / revision</th><th scope="col">Status</th><th scope="col">Value (₹)</th><th scope="col">Last updated</th><th scope="col">Actions</th></tr></thead><tbody>{visibleQuotations.map((quotation) => {
        const selectedRow = selected?.id === quotation.id;
        const lines = quotation.attributes.lines as Array<{ description?: string }> | undefined;
        const quoteNumber = String(quotation.attributes.quotation_number || quotation.id);
        return <tr key={quotation.id} aria-selected={selectedRow} className={selectedRow ? 'is-selected' : undefined}>
          <td data-label="Quote no. / customer"><button type="button" className="quotation-row-select" aria-pressed={selectedRow} onClick={() => { automaticQuotationSelection.current = false; setSelected(quotation); }}>{quoteNumber}</button><small>{customerNameFor(quotation)}</small></td>
          <td data-label="Scope / revision">{String(lines?.[0]?.description || quotation.attributes.purpose || '—')}<small>Revision R{String(quotation.attributes.revision || '—')}</small></td>
          <td data-label="Status"><Status>{String(quotation.attributes.status || 'DRAFT')}</Status></td>
          <td data-label="Value">{amountFor(quotation)}</td>
          <td data-label="Last updated">{dateFor(quotation.attributes.updated_at || quotation.attributes.created_at)}</td>
          <td data-label="Actions"><ProviderActionMenu label={`Actions for quotation ${quoteNumber}`} actions={[{ id: 'view', label: 'View quotation', onSelect: () => { automaticQuotationSelection.current = false; setSelected(quotation); } }]} /></td>
        </tr>;
      })}</tbody></table></div>}
    <div className="server-pagination" aria-label="Quotation pages"><label className="page-size-control">Rows per page<select aria-label="Quotation rows per page" value={pageLimit} onChange={(event) => { setPageLimit(Number(event.target.value)); setPageCursor({}); setSelected(null); automaticQuotationSelection.current = true; }}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label><div><Button type="button" variant="secondary" disabled={!quotations.page?.previous} onClick={() => { automaticQuotationSelection.current = true; setSelected(null); setPageCursor({ before: quotations.page?.previous || undefined }); }}>Previous</Button><Button type="button" disabled={!quotations.page?.next} onClick={() => { automaticQuotationSelection.current = true; setSelected(null); setPageCursor({ after: quotations.page?.next || undefined }); }}>Next</Button></div></div></div>
    {selected ? <><OperationsDialog title={String(selected.attributes.quotation_number || selected.id)} onClose={() => { automaticQuotationSelection.current = false; setSelected(null); }} className="quotation-detail-dialog"><aside className="quotation-detail-panel detail-card" aria-label="Quotation detail"><div className="section-heading"><div><span className="eyebrow">Quotation detail</span></div></div>
      <dl><dt>Status</dt><dd>{String(selected.attributes.status)}</dd><dt>Revision</dt><dd>{String(selected.attributes.revision)}</dd><dt>Total</dt><dd>{String(selected.attributes.total || '')} {String(selected.attributes.currency || '')}</dd></dl>
      {['issued', 'viewed', 'under_review'].includes(String(selected.attributes.status).toLowerCase()) && <section className="detail-card quotation-provider-review" aria-label="Provider quotation review"><h4>Provider review</h4>{(selected.attributes.provider_review as { decision?: string; quotation_revision?: number; reason?: string | null } | null)?.decision ? <><Status>{String((selected.attributes.provider_review as { decision: string }).decision)}</Status><p>Decision recorded for revision R{String((selected.attributes.provider_review as { quotation_revision?: number }).quotation_revision || selected.attributes.revision)}. Customer acceptance remains a separate action.</p>{(selected.attributes.provider_review as { reason?: string | null }).reason && <p>{String((selected.attributes.provider_review as { reason: string }).reason)}</p>}</> : <><p>Internal approval is required before the customer can accept this issued revision.</p>{hasPermission('QUOTATION_APPROVE') && <div className="quotation-detail-actions"><Button disabled={busy} onClick={() => setReviewDialog('approve')}>Approve revision</Button><Button variant="secondary" disabled={busy} onClick={() => setReviewDialog('reject')}>Reject revision</Button></div>}</>}</section>}
      <div className="quotation-detail-actions">
        {String(selected.attributes.status).toLowerCase() === 'draft' && hasPermission('QUOTATION_EDIT') && <Button variant="secondary" onClick={() => setDetailDialog('edit')}>Edit draft</Button>}{String(selected.attributes.status).toLowerCase() === 'draft' && hasPermission('QUOTATION_ISSUE') && <Button onClick={() => void issueQuotation()} disabled={busy}>Issue quotation</Button>}
        {String(selected.attributes.status).toLowerCase() !== 'draft' && <Button variant="secondary" onClick={() => void downloadQuotationPdf()} disabled={busy}>Download PDF</Button>}
        {['issued', 'viewed', 'under_review'].includes(String(selected.attributes.status).toLowerCase()) && hasPermission('QUOTATION_ISSUE') && (selected.attributes.provider_review as { decision?: string } | undefined)?.decision === 'approved' && <Button variant="secondary" onClick={() => void openQuotationDelivery()} disabled={busy}>Send approved revision</Button>}
        {['issued', 'viewed', 'under_review'].includes(String(selected.attributes.status).toLowerCase()) && hasPermission('QUOTATION_EDIT') && <Button variant="secondary" onClick={() => setDetailDialog('revision')}>Create revision</Button>}
        {['approved', 'accepted'].includes(String(selected.attributes.status).toLowerCase()) && hasPermission('QUOTATION_CONVERT') && <Button onClick={() => void convertQuotation()} disabled={busy}>{String(selected.attributes.purpose || '').toUpperCase() === 'CONTRACT_RENEWAL' ? 'Create renewal contract draft' : 'Convert to installation project'}</Button>}
        {hasPermission('QUOTATION_NEGOTIATE') && <Button variant="quiet" onClick={() => setDetailDialog('negotiation')}>Record negotiation</Button>}
      </div>
      {convertedContract && String(convertedContract.attributes.status || '').toLowerCase() === 'draft' && <div className="detail-card"><h4>Renewal contract draft</h4><p>Customer acceptance is recorded. Activate this successor only through the authorized provider workflow.</p><Button onClick={() => void activateConvertedContract()} disabled={busy}>Activate paid AMC renewal</Button></div>}
      {String(selected.attributes.purpose || '').toUpperCase() === 'CONTRACT_RENEWAL' && <section className="detail-card" aria-label="AMC renewal history"><h4>AMC renewal history</h4><dl><dt>Predecessor</dt><dd>{renewalPredecessor ? `${String(renewalPredecessor.attributes.name || renewalPredecessor.attributes.contract_number || renewalPredecessor.id)} · ${String(renewalPredecessor.attributes.status)}` : renewalPredecessorId || 'Not recorded'}</dd><dt>Successor</dt><dd>{convertedContract ? `${convertedContract.id} · ${String(convertedContract.attributes.status)}` : 'Not activated'}</dd></dl><p className="notice">The predecessor coverage remains historical; the successor is a separate accepted provider contract.</p></section>}
      <p className="quotation-history-note">Negotiation notes are retained as immutable events. Use “Record negotiation” to add an event.</p>
    </aside></OperationsDialog>
    {detailDialog === 'edit' && <OperationsDialog title="Edit draft quotation" busy={busy} onClose={() => setDetailDialog(null)}><form className="quotation-modal-form" onSubmit={(event) => void updateDraftQuotation(event)}><label>Description<input name="description" required defaultValue={String((selected.attributes.lines as Array<{ description?: string }> | undefined)?.[0]?.description || 'Elevator installation')} /></label><label>Total (INR)<input name="amount" type="number" min="0" step="0.01" required defaultValue={String((selected.attributes.lines as Array<{ amount?: string }> | undefined)?.[0]?.amount || '')} /></label><div className="provider-form-actions"><Button type="button" variant="quiet" onClick={() => setDetailDialog(null)}>Cancel</Button><Button type="submit" busy={busy}>Save draft</Button></div></form></OperationsDialog>}
    {detailDialog === 'revision' && <OperationsDialog title="Create quotation revision" busy={busy} onClose={() => setDetailDialog(null)}><p className="notice">This creates a new revision; the issued revision remains immutable.</p><form className="quotation-modal-form" onSubmit={(event) => void createQuotationRevision(event)}><label>Description<input name="description" required defaultValue="Revised elevator installation" /></label><label>Total (INR)<input name="amount" type="number" min="0" step="0.01" required /></label><div className="provider-form-actions"><Button type="button" variant="quiet" onClick={() => setDetailDialog(null)}>Cancel</Button><Button type="submit" busy={busy}>Create revision</Button></div></form></OperationsDialog>}
    {detailDialog === 'negotiation' && <OperationsDialog title="Record negotiation" busy={busy} onClose={() => setDetailDialog(null)}><form className="quotation-modal-form" onSubmit={(event) => void recordNegotiation(event)}><label>Event<select name="event_type"><option value="CUSTOMER_FEEDBACK">Customer feedback</option><option value="DISCOUNT_REQUESTED">Discount requested</option><option value="SCOPE_CHANGE">Scope change</option><option value="TERMS_CHANGE">Terms change</option><option value="COUNTER_OFFER">Counter offer</option></select></label><label>Notes<textarea name="notes" required maxLength={4000} /></label><label>Offered total<input name="offered_total" type="number" min="0" step="0.01" /></label><div className="provider-form-actions"><Button type="button" variant="quiet" onClick={() => setDetailDialog(null)}>Cancel</Button><Button type="submit" busy={busy}>Record negotiation</Button></div></form></OperationsDialog>}
    {reviewDialog && <OperationsDialog title={reviewDialog === 'approve' ? 'Approve quotation revision' : 'Reject quotation revision'} busy={busy} onClose={() => setReviewDialog(null)}><form className="quotation-modal-form" onSubmit={(event) => void recordProviderReview(event)}><p className="notice">This internal decision applies only to quotation revision R{String(selected.attributes.revision)}. It does not record customer acceptance or activate a project.</p>{reviewDialog === 'reject' && <label>Reason for rejection<textarea name="reason" required minLength={1} maxLength={4000} /></label>}<div className="provider-form-actions"><Button type="button" variant="quiet" disabled={busy} onClick={() => setReviewDialog(null)}>Cancel</Button><Button type="submit" busy={busy}>{reviewDialog === 'approve' ? 'Approve revision' : 'Reject revision'}</Button></div></form></OperationsDialog>}
    {deliveryOpen && <OperationsDialog title="Send approved quotation revision" busy={busy} onClose={() => setDeliveryOpen(false)}><div className="quotation-modal-form"><p className="notice">This sends the immutable commercial version {String(selected.attributes.version_number || 1)} from current record revision R{String(selected.attributes.revision)}. Only active authorized customer contacts are listed. Queueing is not proof of email delivery.</p><form onSubmit={(event) => void sendQuotationRevision(event)}><label>Recipient<select name="contact_point_id" required defaultValue=""><option value="">Choose authorized contact</option>{deliveryRecipients.map((contact) => <option key={contact.id} value={contact.id}>{contact.display_name} · {contact.email}</option>)}</select></label><div className="provider-form-actions"><Button type="button" variant="quiet" disabled={busy} onClick={() => setDeliveryOpen(false)}>Close</Button><Button type="submit" busy={busy} disabled={!deliveryRecipients.length}>Queue email</Button></div></form>{!deliveryRecipients.length && <p className="notice">No active authorized contact has an email address. Add or update a provider-scoped contact first.</p>}<h4>Delivery history</h4>{deliveryHistory?.data.length ? <ul>{deliveryHistory.data.map((row) => <li key={row.id}>{String(row.attributes.status)} · {String(row.attributes.recipient_name)} · version {String(row.attributes.quotation_version_number)} · {String(row.attributes.requested_at)}</li>)}</ul> : <p>No delivery attempts recorded for this quotation.</p>}</div></OperationsDialog>}
    </> : null}</section>
    {message && <p className="success" role="status">{message}</p>}{error && <p className="error" role="alert">{error}</p>}
  </section>;
}

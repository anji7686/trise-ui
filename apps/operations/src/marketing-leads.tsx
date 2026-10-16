import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@trise/ui';
import { operationsData, type Collection, type GenericAttributes, type MarketingLeadAttributes, type ProviderDocumentAttributes, type Resource } from './data';
import { OperationsStatus as Status } from './operations-status';
import { sha256Hex } from './provider-document-upload';

type Props = { providerId: string };
const EVIDENCE_MEDIA_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const MAX_EVIDENCE_BYTES = 26_214_400;

export function MarketingLeads({ providerId }: Props) {
  const [leads, setLeads] = useState<Collection<MarketingLeadAttributes> | null>(null);
  const [relationships, setRelationships] = useState<Collection<GenericAttributes> | null>(null);
  const [selected, setSelected] = useState<Resource<MarketingLeadAttributes> | null>(null);
  const [surveyId, setSurveyId] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [evidenceMessage, setEvidenceMessage] = useState('');
  const [evidence, setEvidence] = useState<Collection<ProviderDocumentAttributes> | null>(null);
  const [downloadBusy, setDownloadBusy] = useState<string | null>(null);
  const evidenceInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLeads(null); setRelationships(null);
    void Promise.all([operationsData.marketingLeads(providerId), operationsData.customerRelationships(providerId).catch(() => ({ data: [] }))])
      .then(([leadRows, relationshipRows]) => { setLeads(leadRows); setRelationships(relationshipRows as Collection<GenericAttributes>); })
      .catch((cause) => setError((cause as Error).message));
  }, [providerId]);

  useEffect(() => {
    setEvidence(null);
    if (!selected) return;
    void operationsData.marketingLeadDocuments(providerId, selected.id).then(setEvidence).catch((cause) => setError((cause as Error).message));
  }, [providerId, selected]);

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const created = await operationsData.createMarketingLead(providerId, { reference_code: form.get('reference_code'), source: form.get('source'), title: form.get('title'), prospect_name: form.get('prospect_name'), primary_contact_reference: form.get('primary_contact_reference') || undefined, customer_relationship_id: form.get('customer_relationship_id') || undefined }, crypto.randomUUID());
      setLeads((current) => current ? { ...current, data: [created, ...current.data] } : current); setSelected(created); setFormOpen(false); formElement.reset(); setMessage('Lead created by the server.');
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }

  async function uploadEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = evidenceInput.current?.files?.[0];
    if (!file || !selected) return;
    if (!EVIDENCE_MEDIA_TYPES.includes(file.type) || file.size < 1 || file.size > MAX_EVIDENCE_BYTES) { setError('Survey evidence must be PDF, PNG, JPEG, XLS, or XLSX and no larger than 25 MiB.'); return; }
    setEvidenceBusy(true); setError(''); setEvidenceMessage('Preparing an authorization-scoped private upload…');
    try {
      const checksum = await sha256Hex(file); const requestKey = crypto.randomUUID();
      const created = await operationsData.createMarketingLeadDocument(providerId, { filename: file.name, media_type: file.type, size_bytes: file.size, checksum, classification: 'GENERAL_SUPPORTING_EVIDENCE', visibility: 'internal', owner: { type: 'MARKETING_LEAD', id: selected.id }, source: { type: 'MARKETING_LEAD', id: selected.id } }, requestKey);
      const response = await fetch(created.transfer.url, { method: created.transfer.method, headers: created.transfer.headers, body: file, mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error(`Private storage rejected the evidence upload (HTTP ${response.status}).`);
      await operationsData.finalizeProviderDocument(providerId, created.document.id, { version_id: created.version.id, checksum, size_bytes: file.size }, `${requestKey}-finalize`);
      if (evidenceInput.current) evidenceInput.current.value = '';
      setEvidence(await operationsData.marketingLeadDocuments(providerId, selected.id));
      setEvidenceMessage('Survey evidence finalized and associated with this lead.');
    } catch (cause) { setEvidenceMessage(''); setError((cause as Error).message || 'The private evidence upload could not be completed.'); } finally { setEvidenceBusy(false); }
  }

  async function downloadEvidence(document: Resource<ProviderDocumentAttributes>) {
    const versionId = document.attributes.current_version_id;
    if (!versionId) return;
    setDownloadBusy(document.id); setError('');
    try {
      const transfer = await operationsData.authorizeProviderDocumentDownload(providerId, document.id, versionId, crypto.randomUUID(), 'attachment');
      window.open(transfer.url, '_blank', 'noopener,noreferrer');
    } catch (cause) { setError((cause as Error).message || 'Evidence download could not be authorized.'); } finally { setDownloadBusy(null); }
  }

  if (error && !leads) return <section className="notice state-error" role="alert"><strong>{error}</strong></section>;
  if (!leads) return <section className="notice" role="status"><strong>Loading leads…</strong></section>;
  return <section className="content provider-leads"><div className="section-heading"><div><span className="eyebrow">Sales &amp; Marketing</span><h2>Leads &amp; site surveys</h2></div><Button onClick={() => setFormOpen(true)}>New lead</Button></div><p className="notice">Only Provider-scoped records returned by the API are shown. Customer conversion and quotation approval remain separate server workflows.</p>{formOpen && <section className="detail-card" aria-label="New marketing lead"><form onSubmit={createLead}><div className="form-grid"><label>Reference code<input name="reference_code" required maxLength={40} placeholder="LEAD-100" /></label><label>Source<input name="source" required maxLength={40} placeholder="FIELD" /></label><label>Prospect name<input name="prospect_name" required maxLength={200} /></label><label>Opportunity title<input name="title" required maxLength={200} /></label><label>Primary contact reference<input name="primary_contact_reference" maxLength={320} /></label><label>Existing customer/prospect (optional)<select name="customer_relationship_id"><option value="">Create a new prospect relationship</option>{relationships?.data.map((relationship) => <option key={relationship.id} value={relationship.id}>{String(relationship.attributes.display_name || relationship.attributes.name || relationship.id)} · {String(relationship.attributes.relationship_kind || 'relationship')}</option>)}</select></label></div><div className="inline-actions"><Button disabled={busy}>{busy ? 'Saving…' : 'Create lead'}</Button><Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button></div></form></section>}<div className="record-grid">{leads.data.length === 0 ? <p className="notice">No leads are visible in this Provider workspace.</p> : leads.data.map((lead) => <button className="record-card" key={lead.id} onClick={() => setSelected(lead)}><Status>{lead.attributes.status}</Status><strong>{lead.attributes.title}</strong><span>{lead.attributes.prospect_name}</span><small>{lead.attributes.reference_code} · {lead.attributes.source}</small></button>)}</div>{selected && <aside className="detail-card" aria-label="Lead details"><div className="section-heading"><div><span className="eyebrow">Lead detail</span><h3>{selected.attributes.title}</h3></div><button className="text-button" onClick={() => setSelected(null)}>Close</button></div><dl><dt>Prospect</dt><dd>{selected.attributes.prospect_name}</dd><dt>Status</dt><dd>{selected.attributes.status}</dd><dt>Priority</dt><dd>{selected.attributes.priority}</dd><dt>Revision</dt><dd>{selected.attributes.revision}</dd></dl><details><summary>Survey evidence</summary><form onSubmit={uploadEvidence}><label>PDF, PNG, JPEG, XLS or XLSX<input ref={evidenceInput} type="file" accept={EVIDENCE_MEDIA_TYPES.join(',')} required /></label><Button type="submit" busy={evidenceBusy}>{evidenceBusy ? 'Uploading…' : 'Upload evidence'}</Button>{evidenceMessage && <p className="success" role="status">{evidenceMessage}</p>}</form>{evidence && <div aria-label="Finalized survey evidence"><h4>Finalized evidence</h4>{evidence.data.length === 0 ? <p>No finalized evidence is associated with this lead.</p> : evidence.data.map((document) => <div className="inline-actions" key={document.id}><span>{document.attributes.filename} · {document.attributes.status} · {document.attributes.scan_state}</span><Button type="button" variant="secondary" disabled={downloadBusy === document.id} onClick={() => void downloadEvidence(document)}>{downloadBusy === document.id ? 'Authorizing…' : 'Download evidence'}</Button></div>)}</div>}</details><details><summary>Follow-up activity</summary><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void operationsData.createLeadActivity(providerId, selected.id, { activity_type: form.get('activity_type'), notes: form.get('notes') }, crypto.randomUUID()).then(() => setMessage('Follow-up recorded by the server.')).catch((cause) => setError((cause as Error).message)); }}><label>Activity type<input name="activity_type" required defaultValue="CALL" /></label><label>Notes<textarea name="notes" required maxLength={4000} /></label><Button>Log follow-up</Button></form></details><details><summary>Site survey</summary><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void operationsData.createSiteSurvey(providerId, selected.id, { survey_date: form.get('survey_date'), proposed_elevator_count: Number(form.get('elevator_count')), floor_count: Number(form.get('floor_count')), building_details: { building_type: form.get('building_type') }, technical_measurements: { shaft_width_mm: Number(form.get('shaft_width_mm')) } }, crypto.randomUUID()).then((result) => { setSurveyId(result.id); setMessage('Site survey submitted by the server.'); }).catch((cause) => setError((cause as Error).message)); }}><label>Survey date<input name="survey_date" type="date" required /></label><label>Elevators<input name="elevator_count" type="number" min="1" required /></label><label>Floors<input name="floor_count" type="number" min="1" required /></label><label>Building type<input name="building_type" required /></label><label>Shaft width (mm)<input name="shaft_width_mm" type="number" min="1" required /></label><Button>Submit survey</Button></form></details><details><summary>Requirements revision</summary><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); void operationsData.createRequirementRevision(providerId, selected.id, { site_survey_id: surveyId || undefined, requirements: { capacity_kg: Number(form.get('capacity_kg')), stops: Number(form.get('stops')), lift_type: form.get('lift_type') } }, crypto.randomUUID()).then(() => setMessage('Requirement revision captured by the server.')).catch((cause) => setError((cause as Error).message)); }}><label>Capacity (kg)<input name="capacity_kg" type="number" min="1" required /></label><label>Stops<input name="stops" type="number" min="1" required /></label><label>Lift type<input name="lift_type" required placeholder="Passenger" /></label><Button disabled={!surveyId}>Capture requirements</Button>{!surveyId && <small>Submit a site survey first.</small>}</form></details></aside>}{message && <p className="success" role="status">{message}</p>}{error && <p className="error" role="alert">{error}</p>}</section>;
}

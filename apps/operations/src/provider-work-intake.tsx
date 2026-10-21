import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, FilterToolbar, PageHeader } from '@trise/ui';
import { OperationsDialog } from './operations-dialog';
import { ActionFeedback, EmptyState } from './operations-shared';
import { OperationsStatus as Status } from './operations-status';
import { operationsData, type Collection, type WorkIntakeAttributes, type WorkIntakeMatch, type Resource } from './data';
import type { OperationsRoute } from './operations-pages';
import './provider-work-intake.css';

const SOURCES = ['MARKETING', 'PROVIDER_DIRECT', 'REFERRAL', 'EXISTING_ASSET', 'AMC_RENEWAL', 'INTERNAL_REQUEST', 'PARTNER'];
const WORK_TYPES = ['NEW_INSTALLATION', 'MODIFICATION', 'TAKEOVER', 'AMC', 'REPAIR', 'INSPECTION'];
const LIMITS = [10, 20, 50, 100];
const label = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const errorMessage = (error: unknown) => (error as { message?: string })?.message || 'The request could not be completed.';
const newKey = () => crypto.randomUUID();

export function ProviderWorkIntakeWorkspace({ providerId, route, canCreate, canEdit }: { providerId: string; route: OperationsRoute; canCreate: boolean; canEdit: boolean }) {
  const [items, setItems] = useState<Collection<WorkIntakeAttributes> | null>(null);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [workType, setWorkType] = useState('');
  const [status, setStatus] = useState('');
  const [relationshipStatus, setRelationshipStatus] = useState('');
  const [limit, setLimit] = useState(10);
  const [cursor, setCursor] = useState<{ after?: string; before?: string }>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setItems(await operationsData.providerWorkIntakes(providerId, {
        limit, ...cursor, q: query || undefined, source: source || undefined,
        work_type: workType || undefined, status: status || undefined,
        relationship_status: relationshipStatus || undefined
      }));
    } catch (cause) { setError(errorMessage(cause)); }
  }, [providerId, limit, cursor, query, source, workType, status, relationshipStatus]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [load]);
  const refresh = async () => { await load(); };
  const open = (id: string) => { window.location.hash = `work-intake/${encodeURIComponent(id)}`; };
  const back = () => { window.location.hash = 'work-intake'; };
  const saved = async (record: Resource<WorkIntakeAttributes>) => { setCreateOpen(false); setNotice(`${record.attributes.reference_code} was saved. Possible matches are advisory; no record was linked automatically.`); back(); await refresh(); };

  return <section className="content feature-page provider-work-intake">
    <PageHeader title={route.id ? 'Work Intake details' : 'Work Intake'} description="Coordinate work from every provider channel while keeping Asset, Project, Job and AMC records separate." action={!route.id && canCreate ? <Button onClick={() => setCreateOpen(true)}>Create intake</Button> : undefined} />
    {notice && <ActionFeedback><span>{notice}</span><button type="button" onClick={() => setNotice('')}>Dismiss</button></ActionFeedback>}
    {error && <div className="provider-work-intake-error" role="alert"><strong>{error}</strong><Button variant="secondary" onClick={() => void refresh()}>Retry</Button></div>}
    {route.id ? <IntakeDetail providerId={providerId} id={route.id} canEdit={canEdit} back={back} changed={async (message) => { setNotice(message); await refresh(); }} /> : <>
      <div className="provider-work-intake-summary" aria-label="Work intake summary">
        <article><span>Loaded intakes</span><strong>{items?.data.length ?? '—'}</strong><small>Current provider and server page</small></article>
        <article><span>Relationship unresolved</span><strong>{items?.data.filter((item) => item.attributes.relationship_status === 'UNRESOLVED').length ?? '—'}</strong><small>Assessment follow-up remains visible</small></article>
        <article><span>Needs assessment</span><strong>{items?.data.filter((item) => item.attributes.assessment_task.status !== 'COMPLETED').length ?? '—'}</strong><small>Provider-owned assessment queue</small></article>
      </div>
      <FilterToolbar resultLabel={items ? `${items.data.length} authorized intake records on this server page` : 'Loading provider-scoped intake…'}>
        <label>Search intakes<input aria-label="Search intakes" placeholder="Reference, title or site…" value={query} onChange={(event) => { setQuery(event.target.value); setCursor({}); }} /></label>
        <label>Source<select aria-label="Filter by source" value={source} onChange={(event) => { setSource(event.target.value); setCursor({}); }}><option value="">All sources</option>{SOURCES.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
        <label>Work type<select aria-label="Filter by work type" value={workType} onChange={(event) => { setWorkType(event.target.value); setCursor({}); }}><option value="">All work types</option>{WORK_TYPES.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
        <label>Status<select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); setCursor({}); }}><option value="">All statuses</option>{['OPEN', 'ASSESSMENT', 'EXECUTION', 'CLOSED'].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
        <label>Relationship<select aria-label="Filter by relationship status" value={relationshipStatus} onChange={(event) => { setRelationshipStatus(event.target.value); setCursor({}); }}><option value="">All relationships</option>{['UNRESOLVED', 'SUGGESTED', 'CONFIRMED', 'DISMISSED'].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
      </FilterToolbar>
      {!items && !error && <p className="notice">Loading authorized work intake…</p>}
      {items && (items.data.length ? <div className="provider-work-intake-table-wrap"><table className="provider-work-intake-table"><thead><tr><th>Reference</th><th>Work item</th><th>Source / type</th><th>Relationship</th><th>Assessment</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{items.data.map((item) => <tr key={item.id}>
        <td data-label="Reference"><span className="intake-reference">{item.attributes.reference_code}</span><small>{new Date(item.attributes.created_at || '').toLocaleDateString()}</small></td>
        <td data-label="Work item"><strong>{item.attributes.title}</strong><small>{item.attributes.site_summary || 'Site not specified'}</small></td>
        <td data-label="Source / type">{label(item.attributes.source)}<small>{label(item.attributes.work_type)}</small></td>
        <td data-label="Relationship"><Status>{label(item.attributes.relationship_status)}</Status>{item.attributes.relationship_status === 'UNRESOLVED' && <small>Assessment required</small>}{item.attributes.relationship_status === 'SUGGESTED' && <small>{item.attributes.match_suggestions.length} possible match(es)</small>}</td>
        <td data-label="Assessment"><Status>{label(item.attributes.assessment_task.status)}</Status></td>
        <td data-label="Status"><Status>{label(item.attributes.status)}</Status></td>
        <td data-label="Actions"><Button variant="secondary" onClick={() => open(item.id)}>Review</Button></td>
      </tr>)}</tbody></table></div> : <EmptyState title="No work intake records found" description="Create an intake or change the server-side filters. A possible duplicate never blocks intake creation." />)}
      {items && <div className="server-pagination" aria-label="Work intake pages"><label className="page-size-control">Rows per page<select aria-label="Work intake rows per page" value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setCursor({}); }}>{LIMITS.map((size) => <option value={size} key={size}>{size}</option>)}</select></label><div><Button type="button" variant="secondary" disabled={!items.page?.previous} onClick={() => setCursor({ before: items.page?.previous || undefined })}>Previous</Button><Button type="button" disabled={!items.page?.next} onClick={() => setCursor({ after: items.page?.next || undefined })}>Next</Button></div></div>}
      {createOpen && <IntakeCreateDialog providerId={providerId} close={() => setCreateOpen(false)} saved={(record) => void saved(record)} />}
    </>}
  </section>;
}

function IntakeCreateDialog({ providerId, close, saved }: { providerId: string; close: () => void; saved: (record: Resource<WorkIntakeAttributes>) => void }) {
  const [form, setForm] = useState({ source: '', work_type: '', title: '', requester_name: '', requester_contact_reference: '', site_summary: '', description: '' });
  const [assetQuery, setAssetQuery] = useState('');
  const [matches, setMatches] = useState<WorkIntakeMatch[]>([]);
  const [matchChecked, setMatchChecked] = useState(false);
  const [selection, setSelection] = useState<WorkIntakeMatch | null>(null);
  const [relationshipReason, setRelationshipReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function checkMatches() {
    setBusy(true); setError('');
    try { const result = await operationsData.providerWorkIntakeMatches(providerId, { title: form.title, site_summary: form.site_summary, asset_query: assetQuery || undefined }); setMatches(result.data); setMatchChecked(true); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const body: Record<string, unknown> = { ...form };
      if (selection?.kind === 'ASSET') body.asset_id = selection.id;
      if (selection?.kind === 'PROJECT') body.project_id = selection.id;
      if (selection) body.relationship_decision_reason = relationshipReason;
      saved(await operationsData.createProviderWorkIntake(providerId, body, newKey()));
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  const ready = form.source && form.work_type && form.title.trim().length > 0 && (!selection || relationshipReason.trim().length >= 3);
  return <OperationsDialog title="Create Work Intake" busy={busy} onClose={close}><form className="provider-form provider-work-intake-form" onSubmit={(event) => void submit(event)}>
    <p className="provider-work-intake-first-step">Start with the work origin and type. The selected Provider scopes all possible matches.</p>
    <div className="provider-work-intake-form-grid"><label>Work source *<select required value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}><option value="">Choose source</option>{SOURCES.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
      <label>Work type *<select required value={form.work_type} onChange={(event) => setForm({ ...form, work_type: event.target.value })}><option value="">Choose work type</option>{WORK_TYPES.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
      <label className="wide">Work title *<input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label className="wide">Find an existing Asset by name, identifier or ID<input maxLength={200} value={assetQuery} onChange={(event) => setAssetQuery(event.target.value)} placeholder="Optional provider-scoped Asset lookup" /></label>
      <label>Requester name<input maxLength={160} value={form.requester_name} onChange={(event) => setForm({ ...form, requester_name: event.target.value })} /></label>
      <label>Contact reference<input maxLength={200} value={form.requester_contact_reference} onChange={(event) => setForm({ ...form, requester_contact_reference: event.target.value })} /></label>
      <label className="wide">Site summary<input maxLength={240} value={form.site_summary} onChange={(event) => setForm({ ...form, site_summary: event.target.value })} /></label>
      <label className="wide">Description<textarea rows={3} maxLength={5000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
    </div>
    <div className="provider-work-intake-match-check"><Button type="button" variant="secondary" busy={busy} disabled={!form.title.trim() && !assetQuery.trim()} onClick={() => void checkMatches()}>Check possible matches</Button><span>Searches are provider-scoped warnings only. Nothing is linked automatically.</span></div>
    {matchChecked && <section className="provider-work-intake-candidates" aria-label="Possible related records"><h3>Provider-scoped suggestions</h3>{matches.length ? matches.map((match) => <article key={`${match.kind}-${match.id}`} className={selection?.id === match.id ? 'selected' : ''}><div><Status>{match.confidence}</Status><strong>{match.label}</strong><small>{match.reason}</small></div>{['ASSET', 'PROJECT'].includes(match.kind) && <Button type="button" variant={selection?.id === match.id ? 'primary' : 'secondary'} onClick={() => setSelection(selection?.id === match.id ? null : match)}>{selection?.id === match.id ? 'Selected' : 'Select relationship'}</Button>}</article>) : <p>No matching Asset or Project was found. You can continue; an assessment task will be created.</p>}</section>}
    {selection && <label>Reason for selecting this {selection.kind.toLowerCase()} *<textarea required minLength={3} maxLength={500} value={relationshipReason} onChange={(event) => setRelationshipReason(event.target.value)} /></label>}
    {error && <div role="alert" className="provider-work-intake-error">{error}</div>}
    <div className="provider-form-actions"><Button type="button" variant="secondary" onClick={close}>Cancel</Button><Button type="submit" busy={busy} disabled={!ready}>Create intake</Button></div>
  </form></OperationsDialog>;
}

function IntakeDetail({ providerId, id, canEdit, back, changed }: { providerId: string; id: string; canEdit: boolean; back: () => void; changed: (message: string) => Promise<void> }) {
  const [item, setItem] = useState<Resource<WorkIntakeAttributes> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [decision, setDecision] = useState('');
  const [assessment, setAssessment] = useState({ current_state_assessment: '', remaining_scope_assessment: '', responsibility_boundary: '' });
  const [nextStatus, setNextStatus] = useState('ASSESSMENT');
  const load = useCallback(() => operationsData.genericDetail(providerId, `/provider-work-intakes/${encodeURIComponent(id)}`) as Promise<Resource<WorkIntakeAttributes>>, [providerId, id]);
  useEffect(() => { let active = true; load().then((data) => { if (active) { setItem(data); setNextStatus(data.attributes.status === 'OPEN' ? 'ASSESSMENT' : 'EXECUTION'); setAssessment({ current_state_assessment: data.attributes.assessment_task.current_state || '', remaining_scope_assessment: data.attributes.assessment_task.remaining_scope || '', responsibility_boundary: data.attributes.assessment_task.responsibility_boundary || '' }); } }).catch((cause) => { if (active) setError(errorMessage(cause)); }); return () => { active = false; }; }, [load]);
  async function decide(action: 'REVIEW' | 'DISMISS' | 'CONFIRM', match: WorkIntakeMatch) {
    if (!item || reason.trim().length < 3) { setError('Enter a short reason before recording this match decision.'); return; }
    setBusy(true); setError('');
    try { const response = await operationsData.decideProviderWorkIntakeRelationship(providerId, id, { action, candidate_kind: match.kind, candidate_id: match.id, reason, expected_revision: item.attributes.revision }, newKey()); setItem(response); setReason(''); setDecision(`${action} decision recorded for ${match.kind.toLowerCase()} ${match.id}.`); await changed('Relationship decision and audit event were saved.'); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function advance() {
    if (!item || reason.trim().length < 3) { setError('Enter a reason for the status change.'); return; }
    setBusy(true); setError('');
    try { const response = await operationsData.advanceProviderWorkIntake(providerId, id, { status: nextStatus, reason, expected_revision: item.attributes.revision }, newKey()); setItem(response); setReason(''); await changed(`Work intake moved to ${label(nextStatus)}.`); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  async function saveAssessment(status: string) {
    if (!item) return;
    if (status === 'COMPLETED' && ['MODIFICATION', 'TAKEOVER'].includes(item.attributes.work_type) && Object.values(assessment).some((value) => !value.trim())) {
      setError('Complete current state, remaining scope, and responsibility boundary before completing this assessment.'); return;
    }
    setBusy(true); setError('');
    try { const response = await operationsData.updateProviderWorkIntakeAssessment(providerId, id, { ...assessment, status, expected_revision: item.attributes.revision, reason: reason || 'Assessment reviewed by provider user' }, newKey()); setItem(response); await changed(`Assessment task marked ${label(status)}.`); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  if (!item) return <div>{error ? <div className="provider-work-intake-error" role="alert">{error}</div> : <p className="notice">Loading provider-scoped intake…</p>}<Button variant="secondary" onClick={back}>Back to Work Intake</Button></div>;
  const attributes = item.attributes;
  return <div className="provider-work-intake-detail">
    <div className="provider-work-intake-detail-heading"><Button variant="secondary" onClick={back}>← Work Intake</Button><div><Status>{label(attributes.status)}</Status><h2>{attributes.title}</h2><p>{attributes.reference_code} · {label(attributes.source)} · {label(attributes.work_type)}</p></div></div>
    {attributes.relationship_status !== 'CONFIRMED' && <div className="provider-work-intake-warning" role="status"><strong>Relationship {label(attributes.relationship_status)}</strong><p>{attributes.relationship_status === 'UNRESOLVED' ? 'No match was found. Intake was accepted and an assessment task is open.' : 'Potential matches are non-blocking. Review, dismiss or explicitly confirm a related Asset or Project.'}</p></div>}
    {decision && <ActionFeedback><span>{decision}</span><button type="button" onClick={() => setDecision('')}>Dismiss</button></ActionFeedback>}
    {error && <div role="alert" className="provider-work-intake-error">{error}</div>}
    <div className="provider-work-intake-detail-grid"><section><h3>Request details</h3><dl><div><dt>Requester</dt><dd>{attributes.requester_name || 'Not supplied'}</dd></div><div><dt>Contact reference</dt><dd>{attributes.requester_contact_reference || 'Not supplied'}</dd></div><div><dt>Site</dt><dd>{attributes.site_summary || 'Not specified'}</dd></div><div><dt>Description</dt><dd>{attributes.description || 'No description supplied.'}</dd></div><div><dt>Revision</dt><dd>{attributes.revision}</dd></div></dl></section><section><h3>Assessment task</h3><Status>{label(attributes.assessment_task.status)}</Status><p>Opened {attributes.assessment_task.created_at ? new Date(attributes.assessment_task.created_at).toLocaleString() : 'with this intake'}.</p>{['MODIFICATION', 'TAKEOVER'].includes(attributes.work_type) && <div className="provider-work-intake-assessment-fields"><label>Current condition and inherited work *<textarea rows={3} maxLength={5000} readOnly={!canEdit} value={assessment.current_state_assessment} onChange={(event) => setAssessment({ ...assessment, current_state_assessment: event.target.value })} /></label><label>Remaining scope *<textarea rows={3} maxLength={5000} readOnly={!canEdit} value={assessment.remaining_scope_assessment} onChange={(event) => setAssessment({ ...assessment, remaining_scope_assessment: event.target.value })} /></label><label>Provider responsibility boundary *<textarea rows={3} maxLength={5000} readOnly={!canEdit} value={assessment.responsibility_boundary} onChange={(event) => setAssessment({ ...assessment, responsibility_boundary: event.target.value })} /></label>{attributes.assessment_task.completed_at && <small>Assessment completed · {new Date(attributes.assessment_task.completed_at).toLocaleString()}</small>}</div>}{canEdit && <div className="provider-work-intake-actions"><Button variant="secondary" busy={busy} onClick={() => void saveAssessment('IN_PROGRESS')}>Save / start assessment</Button><Button variant="secondary" busy={busy} onClick={() => void saveAssessment('COMPLETED')}>Complete assessment</Button></div>}</section></div>
    <section className="provider-work-intake-candidates provider-work-intake-detail-candidates"><h3>Suggested related records</h3>{attributes.match_suggestions.length ? attributes.match_suggestions.map((match) => <article key={`${match.kind}-${match.id}`}><div><Status>{match.confidence}</Status><strong>{match.label}</strong><small>{match.reason}</small></div>{canEdit && <div className="provider-work-intake-actions"><label className="match-reason">Decision reason<input aria-label={`Reason for ${match.label}`} value={reason} onChange={(event) => setReason(event.target.value)} /></label><Button variant="secondary" busy={busy} onClick={() => void decide('REVIEW', match)}>Review</Button><Button variant="secondary" busy={busy} onClick={() => void decide('DISMISS', match)}>Dismiss</Button>{['ASSET', 'PROJECT'].includes(match.kind) && <Button busy={busy} onClick={() => void decide('CONFIRM', match)}>Confirm link</Button>}</div>}</article>) : <p>No related record suggestions. You may create an assessment task and continue intake without a match.</p>}</section>
    {canEdit && <section className="provider-work-intake-advance"><h3>Workflow status</h3><div><label>Move to<select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>{['OPEN', 'ASSESSMENT', 'EXECUTION', 'CLOSED'].map((status) => <option value={status} key={status}>{label(status)}</option>)}</select></label><label>Reason<input value={reason} onChange={(event) => setReason(event.target.value)} /></label><Button busy={busy} onClick={() => void advance()}>Update status</Button></div>{['MODIFICATION', 'TAKEOVER', 'AMC'].includes(attributes.work_type) && attributes.relationship_status !== 'CONFIRMED' && <small>Execution is unavailable until a human confirms an authorized Asset or Project relationship.</small>}</section>}
  </div>;
}

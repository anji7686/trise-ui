import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Button, FilterToolbar, PageHeader } from '@trise/ui';
import { useAuth } from '@trise/auth';
import { OperationsStatus as Status } from './operations-status';
import { OperationsDialog } from './operations-dialog';
import { ActionFeedback, EmptyState, WorkspaceTabs } from './operations-shared';
import { DEFAULT_PAGE_SIZE, operationsData, type BookingAttributes, type Collection, type ContactRoutingAttributes, type GenericAttributes, type RequestAttributes, type Resource } from './data';
import { ProjectsWorkspace } from './projects';
import { ProviderAudit } from './provider-audit';
import { SvgIcon } from './icons';
import { ConfigurationAdmin } from './configuration';
import { ProviderCompliancePage } from './provider-compliance';
import { MarketingLeads } from './marketing-leads';
import { QuotationsWorkspace } from './quotations';
import { ProviderPrograms, ReportsWorkspace } from './provider-programs';
import { WorkforceOperations, WorkforceSelfService } from './workforce-operations';
import { ProviderWorkIntakeWorkspace } from './provider-work-intake';
import { ProviderQuotationTermsTemplatesAdmin } from './provider-quotation-terms-templates';
import { ProviderAmcPlanCatalogue } from './provider-amc-plan-catalogue';
import { ProviderConfigurationHub } from './provider-configuration-hub';
import { CustomerOperations } from './customer-operations';
import { ProviderWorkforceSetup } from './provider-workforce-setup';
import { navigationForSession } from './navigation';
import './operations-pages.css';

type T = (key: string) => string;
type Section = 'team-access' | 'work-intake' | 'leads' | 'requests' | 'bookings' | 'quotations' | 'billing' | 'projects' | 'amc' | 'reports' | 'configuration' | 'workforce' | 'attendance' | 'my-leave' | 'audit' | 'compliance' | 'sites' | 'assets' | 'platform' | 'admin-invitations';
export type OperationsRoute = { section: Section; id?: string; kind?: string; templateId?: string };
const fail = (error: unknown) => (error as { message?: string })?.message || 'The request could not be completed.';
const go = (path: string) => { window.location.hash = path; };
function Frame({ title, description, children, action }: { title: string; description: string; children: ReactNode; action?: ReactNode }) { return <section className="content feature-page"><PageHeader title={title} description={description} action={action} />{children}</section>; }
function Failure({ error }: { error: string }) { const forbidden = /forbidden|unauthorized|permission|access denied/i.test(error); return <div className="feature-error" role="alert"><strong>{forbidden ? "You don't have access to this area in the selected workspace." : error}</strong>{!forbidden && <Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button>}</div>; }
function readableWindow(window?: { starts_at?: string; ends_at?: string; time_zone?: string } | null) { if (!window?.starts_at || !window.ends_at) return 'Schedule not supplied'; const start = new Date(window.starts_at); const end = new Date(window.ends_at); if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Schedule unavailable'; const locale = document.documentElement.lang || 'en-IN'; return `${start.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: window.time_zone || undefined })} – ${end.toLocaleTimeString(locale, { timeStyle: 'short', timeZone: window.time_zone || undefined })} (${window.time_zone || 'provider timezone'})`; }

function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function billingDate(value: unknown) { if (!value) return '—'; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }); }
function billingAmount(value: unknown, currency = 'INR') { const amount = Number(value); return Number.isFinite(amount) ? new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount) : '—'; }

function recordLabel(item: Resource<GenericAttributes>) { const attributes = item.attributes; return String(attributes.display_name || attributes.name || attributes.title || attributes.code || attributes.summary || 'Authorized record'); }
function RequestForm({ providerId, requestTypeOptions, close, saved }: { providerId: string; requestTypeOptions: string[]; close: () => void; saved: (item: Resource<RequestAttributes>) => void }) { const [form, setForm] = useState({ summary: '', description: '', customer_relationship_id: '', service_type_id: '', request_type_id: '', asset_id: '', location_id: '' }); const [relationships, setRelationships] = useState<Collection<GenericAttributes> | null>(null); const [serviceTypes, setServiceTypes] = useState<Collection<GenericAttributes> | null>(null); const [assets, setAssets] = useState<Collection<GenericAttributes> | null>(null); const [locations, setLocations] = useState<Collection<GenericAttributes> | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); useEffect(() => { Promise.all([operationsData.customerRelationships(providerId), operationsData.configuration(providerId, 'service-types'), operationsData.assets(providerId), operationsData.locations(providerId)]).then(([relationshipResult, typeResult, assetResult, locationResult]) => { setRelationships(relationshipResult); setServiceTypes(typeResult); setAssets(assetResult); setLocations(locationResult); }).catch((cause) => setError(fail(cause))); }, [providerId]); async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { const body = Object.fromEntries(Object.entries(form).filter(([, value]) => value.trim())); saved(await operationsData.createRequest(providerId, body, crypto.randomUUID())); close(); } catch (cause) { setError(fail(cause)); } finally { setBusy(false); } } const ready = Boolean(form.customer_relationship_id && form.service_type_id && form.request_type_id); const options = (items: Collection<GenericAttributes> | null) => items?.data || []; return <OperationsDialog title="Create service request" busy={busy} onClose={close}><form className="provider-form service-request-create-form" onSubmit={(event) => void submit(event)}><label>Issue title *<input required value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label><label className="service-request-description-field">Description<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>Customer relationship *<select required value={form.customer_relationship_id} onChange={(event) => setForm({ ...form, customer_relationship_id: event.target.value })}><option value="">Select an authorized customer relationship</option>{options(relationships).map((item) => <option key={item.id} value={item.id}>{recordLabel(item)}</option>)}</select></label><label>Service type *<select required value={form.service_type_id} onChange={(event) => setForm({ ...form, service_type_id: event.target.value })}><option value="">Select an authorized service type</option>{options(serviceTypes).map((item) => <option key={item.id} value={item.id}>{recordLabel(item)}</option>)}</select></label><label>Request type *<select required value={form.request_type_id} onChange={(event) => setForm({ ...form, request_type_id: event.target.value })}><option value="">Select a server-returned request type</option>{requestTypeOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Asset (optional)<select value={form.asset_id} onChange={(event) => setForm({ ...form, asset_id: event.target.value })}><option value="">No asset selected</option>{options(assets).map((item) => <option key={item.id} value={item.id}>{recordLabel(item)}</option>)}</select></label><label>Service location (optional)<select value={form.location_id} onChange={(event) => setForm({ ...form, location_id: event.target.value })}><option value="">Use customer relationship location</option>{options(locations).map((item) => <option key={item.id} value={item.id}>{recordLabel(item)}</option>)}</select></label>{error && <Failure error={error} />}{!requestTypeOptions.length && <p className="notice">Request type options are not published by the current API, so creation remains unavailable until the server returns an authorized option.</p>}<div className="provider-form-actions"><Button type="button" variant="secondary" onClick={close}>Cancel</Button><Button type="submit" busy={busy} disabled={!ready}>Create request</Button></div></form></OperationsDialog>; }

function RequestDetail({
  providerId,
  id,
  back,
  canEdit = false,
}: {
  providerId: string;
  id: string;
  back: () => void;
  canEdit?: boolean;
}) {
  const [item, setItem] = useState<Resource<RequestAttributes> | null>(null);
  const [routing, setRouting] =
    useState<Collection<ContactRoutingAttributes> | null>(null);
  const [edit, setEdit] = useState(false);
  const [purpose, setPurpose] = useState("SITE_ACCESS");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [routingError, setRoutingError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    setError("");
    setRoutingError("");
    setItem(null);
    setRouting(null);
    operationsData
      .request(providerId, id)
      .then((request) => {
        setItem(request);
        setSummary(request.attributes.summary);
        setDescription(request.attributes.description || "");
        void operationsData
          .contactRouting(providerId, id)
          .then(setRouting)
          .catch(() => {
            setRouting(null);
            setRoutingError(
              "Contact routing is unavailable for this request in the selected provider context.",
            );
          });
      })
      .catch((cause) => setError(fail(cause)));
  }, [providerId, id]);
  async function save() {
    if (!item || !canEdit) return;
    setBusy(true);
    try {
      const next = await operationsData.updateRequest(
        providerId,
        id,
        { summary, description, expected_revision: item.attributes.revision },
        crypto.randomUUID(),
      );
      setItem(next);
      setEdit(false);
      setMessage("Request updated by the server.");
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  async function transition(key: string) {
    if (!item) return;
    setBusy(true);
    try {
      const next = await operationsData.transitionRequest(
        providerId,
        id,
        {
          transition: key,
          expected_revision: item.attributes.revision,
          effective_at: new Date().toISOString(),
        },
        crypto.randomUUID(),
      );
      setItem(next);
      setMessage(`Transition ${key} accepted by the server.`);
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  async function resolveContact() {
    if (!item) return;
    setBusy(true);
    try {
      const result = await operationsData.resolveContact(
        providerId,
        { request_id: id, purpose, effective_at: new Date().toISOString() },
        crypto.randomUUID(),
      );
      setRouting((current) =>
        current
          ? { ...current, data: [result, ...current.data] }
          : { data: [result] },
      );
      setMessage("Contact resolution recorded as evidence only.");
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  if (!item)
    return (
      <Frame title="Request detail" description="Authorized service request">
        {error ? (
          <Failure error={error} />
        ) : (
          <p className="notice">Loading request…</p>
        )}
      </Frame>
    );
  return (
    <Frame
      title={item.attributes.summary}
      description="Review the request and server-authorized next actions."
    >
      <button className="text-button" onClick={back}>
        <SvgIcon name="arrow-left" size={16} /> Requests
      </button>
      {error && <Failure error={error} />}
      {message && <ActionFeedback>{message}</ActionFeedback>}
      <section className="feature-detail">
        <WorkspaceTabs
          label="Request detail"
          activeId={edit ? "edit" : "overview"}
          onChange={(tab) => setEdit(canEdit && tab === "edit")}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "contact", label: "Contact" },
            { id: "activity", label: "Activity" },
            ...(canEdit ? [{ id: "edit", label: "Edit" }] : []),
          ]}
        />
        {edit ? (
          <form
            className="provider-form"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <label>
              Summary
              <input
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </label>
            <label>
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <div className="provider-form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEdit(false)}
              >
                Cancel
              </Button>
              <Button type="submit" busy={busy}>
                Save changes
              </Button>
            </div>
          </form>
        ) : (
          <>
            <Status>{item.attributes.status}</Status>
            <p>{item.attributes.description || "No description supplied."}</p>
            <dl>
              <dt>Created</dt>
              <dd>{new Date(item.attributes.created_at).toLocaleString()}</dd>
              <dt>Revision</dt>
              <dd>{item.attributes.revision}</dd>
              <dt>Allowed transitions</dt>
              <dd>
                {item.attributes.allowed_transitions?.length
                  ? item.attributes.allowed_transitions.map((allowed) => (
                      <Button
                        key={allowed.key || allowed.transition}
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void transition(
                            allowed.key || allowed.transition || "",
                          )
                        }
                      >
                        {allowed.label || allowed.key || allowed.transition}
                      </Button>
                    ))
                  : "No transition actions returned by the server."}
              </dd>
            </dl>
            <section className="detail-card">
              <h3>Contact resolution</h3>
              {routingError ? (
                <p className="notice" role="status">
                  {routingError}
                </p>
              ) : (
                <>
                  <p className="notice">
                    Resolution records do not confirm an appointment or dispatch
                    an agent.
                  </p>
                  <label>
                    Purpose
                    <select
                      value={purpose}
                      onChange={(event) => setPurpose(event.target.value)}
                    >
                      <option value="SITE_ACCESS">Site access</option>
                      <option value="APPOINTMENT_COORDINATION">
                        Appointment coordination
                      </option>
                      <option value="MAINTENANCE_COORDINATION">
                        Maintenance coordination
                      </option>
                    </select>
                  </label>
                  <Button busy={busy} onClick={() => void resolveContact()}>
                    Resolve authorized contact
                  </Button>
                  {routing?.data.map((contact) => (
                    <article className="record-card" key={contact.id}>
                      <Status>{contact.attributes.outcome}</Status>
                      <strong>{contact.attributes.purpose}</strong>
                      <span>
                        {contact.attributes.reason ||
                          "Authorized routing result."}
                      </span>
                    </article>
                  ))}
                </>
              )}
            </section>
          </>
        )}
      </section>
    </Frame>
  );
}

function RequestSummaryPanel({ providerId, item, openDetails, closeDetails }: { providerId: string; item: Resource<RequestAttributes> | null; openDetails: (id: string) => void; closeDetails: () => void }) {
  const [detail, setDetail] = useState<Resource<RequestAttributes> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [actionOpen, setActionOpen] = useState(false);
  useEffect(() => {
    setDetail(null); setError(''); setMessage('');
    if (item) operationsData.request(providerId, item.id).then(setDetail).catch((cause) => setError(fail(cause)));
  }, [providerId, item?.id]);
  async function transition(key: string) {
    if (!detail) return;
    setBusy(true); setError('');
    try {
      const next = await operationsData.transitionRequest(providerId, detail.id, { transition: key, expected_revision: detail.attributes.revision, effective_at: new Date().toISOString() }, crypto.randomUUID());
      setDetail(next); setMessage(`Request updated: ${key}`); setActionOpen(false);
    } catch (cause) { setError(fail(cause)); }
    finally { setBusy(false); }
  }
  if (!item) return null;
  return <><OperationsDialog title={detail?.attributes.summary || item.attributes.summary} onClose={closeDetails} className="request-detail-dialog">
    <div className="service-request-detail-heading"><div><span className="eyebrow">Selected request</span></div><Status>{detail?.attributes.status || item.attributes.status}</Status></div>
    {error && <Failure error={error} />}{message && <ActionFeedback>{message}</ActionFeedback>}
    {!detail && !error && <p className="notice">Loading request details…</p>}
    {detail && <>
      <p className="service-request-description">{detail.attributes.description || 'No description supplied.'}</p>
      <dl className="service-request-facts"><dt>Request ID</dt><dd>{detail.id}</dd><dt>Created</dt><dd>{new Date(detail.attributes.created_at).toLocaleString()}</dd><dt>Revision</dt><dd>{detail.attributes.revision}</dd><dt>Request type</dt><dd>{detail.attributes.request_type_id || 'Not specified'}</dd></dl>
      <div className="service-request-panel-actions">{detail.attributes.allowed_transitions?.some((action) => action.key || action.transition) && <Button variant="secondary" onClick={() => setActionOpen(true)}>Update status</Button>}<Button onClick={() => { closeDetails(); openDetails(detail.id); }}>Open full details</Button></div>
    </>}
  </OperationsDialog>{actionOpen && detail && <OperationsDialog title="Update request status" busy={busy} onClose={() => setActionOpen(false)}><p className="notice">Only lifecycle transitions returned by the server are available.</p><div className="request-transition-list">{detail.attributes.allowed_transitions?.filter((action) => action.key || action.transition).map((action) => <Button key={action.key || action.transition} variant="secondary" disabled={busy} onClick={() => void transition(action.key || action.transition || '')}>{action.label || action.key || action.transition}</Button>)}</div></OperationsDialog>}</>;
}

// Retained as a compatibility reference for the previous in-memory list implementation.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function RequestsWorkspace({ providerId, route }: { providerId: string; route: OperationsRoute }) { const [items, setItems] = useState<Collection<RequestAttributes> | null>(null); const [query, setQuery] = useState(''); const [status, setStatus] = useState(''); const [create, setCreate] = useState(false); const [error, setError] = useState(''); useEffect(() => { operationsData.requests(providerId).then(setItems).catch((cause) => setError(fail(cause))); }, [providerId]); if (route.id) return <RequestDetail providerId={providerId} id={route.id} back={() => go('requests')} />; const filtered = items?.data.filter((item) => (!status || item.attributes.status === status) && (!query || `${item.id} ${item.attributes.summary} ${item.attributes.description || ''}`.toLowerCase().includes(query.toLowerCase()))) || []; return <Frame title="Service Requests" description="Triage provider-authorized requests without conflating contact resolution, booking, or dispatch." action={<Button onClick={() => setCreate(true)}>Create request</Button>}>{error && <Failure error={error} />}{!items && !error && <p className="notice">Loading authorized requests…</p>}{items && <><FilterToolbar resultLabel={`Showing ${filtered.length} of ${items.data.length} loaded records`}><label>Search loaded page<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Request ID or issue" /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{[...new Set(items.data.map((item) => item.attributes.status))].map((value) => <option key={value} value={value}>{value}</option>)}</select></label></FilterToolbar>{filtered.length ? <div className="feature-list">{filtered.map((item) => <article className="feature-row" key={item.id}><div><Status>{item.attributes.status}</Status><h3>{item.attributes.summary}</h3><p>{item.attributes.description || 'No description supplied.'}</p><small>{item.id} · Revision {item.attributes.revision}</small></div><Button variant="secondary" onClick={() => go(`requests/${item.id}`)}>Open request</Button></article>)}</div> : <EmptyState title="No matching requests" description="Try clearing the loaded-page filters." />}{create && <RequestForm providerId={providerId} requestTypeOptions={[...new Set(items.data.map((item) => item.attributes.request_type_id).filter((value): value is string => Boolean(value)))]} close={() => setCreate(false)} saved={(item) => setItems((current) => current ? { ...current, data: [item, ...current.data] } : { data: [item] })} />}</>}</Frame>; }

function BookingForm({ providerId, close, saved }: { providerId: string; close: () => void; saved: (item: Resource<BookingAttributes>) => void }) {
  const [form, setForm] = useState({ summary: '', customer_relationship_id: '', service_type_id: '', starts_at: '', ends_at: '', time_zone: 'Asia/Kolkata' });
  const [relationships, setRelationships] = useState<Collection<GenericAttributes> | null>(null);
  const [serviceTypes, setServiceTypes] = useState<Collection<GenericAttributes> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { Promise.all([operationsData.customerRelationships(providerId), operationsData.configuration(providerId, 'service-types')]).then(([relationshipResult, typeResult]) => { setRelationships(relationshipResult); setServiceTypes(typeResult); }).catch((cause) => setError(fail(cause))); }, [providerId]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (new Date(form.ends_at) <= new Date(form.starts_at)) { setError('The end time must be later than the start time.'); return; }
    setBusy(true);
    try {
      const item = await operationsData.createAppointment(providerId, { summary: form.summary, customer_relationship_id: form.customer_relationship_id, service_type_id: form.service_type_id, requested_window: { starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString(), time_zone: form.time_zone } }, crypto.randomUUID());
      saved(item); close();
    } catch (cause) { setError(fail(cause)); } finally { setBusy(false); }
  }
  const ready = Boolean(form.summary.trim() && form.customer_relationship_id && form.service_type_id && form.starts_at && form.ends_at && new Date(form.ends_at) > new Date(form.starts_at));
  return <OperationsDialog title="Create appointment" busy={busy} onClose={close}>
    <form className="provider-form appointment-form" onSubmit={(event) => void submit(event)}>
      <div className="appointment-form-body">
      {error && <Failure error={error} />}
      <div className="appointment-form-section"><h3>Appointment details</h3>
        <label>Summary *<input required value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
        <label>Customer / site relationship *<select required value={form.customer_relationship_id} onChange={(event) => setForm({ ...form, customer_relationship_id: event.target.value })}><option value="">Select an authorized customer relationship</option>{relationships?.data.map((item) => <option key={item.id} value={item.id}>{recordLabel(item)}</option>)}</select></label>
        <label>Visit type *<select required value={form.service_type_id} onChange={(event) => setForm({ ...form, service_type_id: event.target.value })}><option value="">Select an authorized service type</option>{serviceTypes?.data.map((item) => <option key={item.id} value={item.id}>{recordLabel(item)}</option>)}</select></label>
      </div>
      <div className="appointment-form-section"><h3>Requested window</h3>
        <label>Start *<input required type="datetime-local" value={form.starts_at} onChange={(event) => setForm({ ...form, starts_at: event.target.value })} /></label>
        <label>End *<input required type="datetime-local" value={form.ends_at} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} /></label>
        <label>Timezone *<input required value={form.time_zone} onChange={(event) => setForm({ ...form, time_zone: event.target.value })} /></label>
      </div>
      <p className="notice appointment-form-note">Capacity and appointment lifecycle checks remain server-authorized. Creating a booking does not dispatch a technician.</p>
      </div>
      <div className="provider-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={close}>Cancel</Button><Button type="submit" busy={busy} disabled={!ready}>Create appointment</Button></div>
    </form>
  </OperationsDialog>;
}

function AppointmentDetail({ providerId, id, back }: { providerId: string; id: string; back: () => void }) { const [item, setItem] = useState<Resource<BookingAttributes> | null>(null); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [dialog, setDialog] = useState<'reschedule' | 'cancel' | null>(null); const [starts, setStarts] = useState(''); const [ends, setEnds] = useState(''); useEffect(() => { operationsData.booking(providerId, id).then((value) => { setItem(value); setStarts(value.attributes.requested_window.starts_at.slice(0, 16)); setEnds(value.attributes.requested_window.ends_at.slice(0, 16)); }).catch((cause) => setError(fail(cause))); }, [providerId, id]); async function command(action: 'confirm' | 'reschedule' | 'cancel') { if (!item) return; if (action === 'reschedule' && new Date(ends) <= new Date(starts)) { setError('The end time must be later than the start time.'); return; } setBusy(true); try { const body = action === 'confirm' ? { expected_revision: item.attributes.revision } : action === 'cancel' ? { expected_revision: item.attributes.revision, reason: 'Provider requested cancellation' } : { starts_at: new Date(starts).toISOString(), ends_at: new Date(ends).toISOString(), time_zone: item.attributes.requested_window.time_zone, expected_revision: item.attributes.revision }; const next = action === 'confirm' ? await operationsData.confirmAppointment(providerId, id, body, crypto.randomUUID()) : action === 'cancel' ? await operationsData.cancelAppointment(providerId, id, body, crypto.randomUUID()) : await operationsData.rescheduleAppointment(providerId, id, body, crypto.randomUUID()); setItem(next); setDialog(null); setMessage(`Booking ${action} accepted by the server.`); } catch (cause) { setError(/409|conflict|revision|changed/i.test(fail(cause)) ? 'This booking has changed. Refresh and review the latest details.' : fail(cause)); } finally { setBusy(false); } } if (!item) return <Frame title="Booking detail" description="Authorized appointment record">{error ? <Failure error={error} /> : <p className="notice">Loading booking…</p>}</Frame>; const allowed = new Set((item.attributes.allowed_transitions || []).map((transition) => transition.key || transition.transition)); return <Frame title={item.attributes.summary} description="Review schedule and server-authorized appointment actions."><button className="text-button" onClick={back}><SvgIcon name="arrow-left" size={16} /> Bookings</button>{error && <Failure error={error} />}{message && <ActionFeedback>{message}</ActionFeedback>}<section className="feature-detail"><Status>{item.attributes.status}</Status><dl><dt>Requested window</dt><dd>{readableWindow(item.attributes.requested_window)}</dd><dt>Revision</dt><dd>{item.attributes.revision}</dd></dl><div className="action-footer">{(!allowed.size || allowed.has('confirm')) && ['REQUESTED', 'PROPOSED', 'RESCHEDULED'].includes(item.attributes.status) && <Button disabled={busy} onClick={() => void command('confirm')}>Confirm booking</Button>}{(!allowed.size || allowed.has('reschedule')) && <Button variant="secondary" disabled={busy} onClick={() => setDialog('reschedule')}>Reschedule</Button>}{(!allowed.size || allowed.has('cancel')) && !['CANCELLED', 'COMPLETED'].includes(item.attributes.status) && <Button variant="danger" disabled={busy} onClick={() => setDialog('cancel')}>Cancel booking</Button>}</div></section>{dialog === 'reschedule' && <OperationsDialog title="Reschedule appointment" busy={busy} onClose={() => setDialog(null)}><form className="provider-form appointment-form appointment-reschedule-form" onSubmit={(event) => { event.preventDefault(); void command('reschedule'); }}><div className="appointment-form-section"><h3>Current appointment</h3><label>Appointment ID<input readOnly value={item.id} /></label><label>Current status<input readOnly value={item.attributes.status} /></label><label>Current window<input readOnly value={readableWindow(item.attributes.requested_window)} /></label><label>Revision<input readOnly value={item.attributes.revision} /></label></div><div className="appointment-form-section"><h3>Alternative timing</h3><label>New start *<input required type="datetime-local" value={starts} onChange={(event) => setStarts(event.target.value)} /></label><label>New end *<input required type="datetime-local" value={ends} onChange={(event) => setEnds(event.target.value)} /></label><label>Timezone<input readOnly value={item.attributes.requested_window.time_zone} /></label></div><p className="notice appointment-form-note">The server checks the expected revision and scheduling rules. Confirmation does not assign a technician or complete the visit.</p><div className="provider-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setDialog(null)}>Cancel</Button><Button type="submit" busy={busy} disabled={!starts || !ends || new Date(ends) <= new Date(starts)}>Confirm change</Button></div></form></OperationsDialog>}{dialog === 'cancel' && <OperationsDialog title="Cancel booking" busy={busy} onClose={() => setDialog(null)}><p>This changes only the appointment lifecycle.</p><Button variant="danger" busy={busy} onClick={() => void command('cancel')}>Cancel booking</Button></OperationsDialog>}</Frame>; }

// Retained as a compatibility reference for the previous list/calendar implementation.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function BookingsWorkspace({ providerId, route }: { providerId: string; route: OperationsRoute }) { const [items, setItems] = useState<Collection<BookingAttributes> | null>(null); const [view, setView] = useState<'list' | 'calendar'>('list'); const [status, setStatus] = useState(''); const [create, setCreate] = useState(false); const [error, setError] = useState(''); useEffect(() => { operationsData.bookings(providerId).then(setItems).catch((cause) => setError(fail(cause))); }, [providerId]); if (route.id) return <AppointmentDetail providerId={providerId} id={route.id} back={() => go('bookings')} />; const filtered = items?.data.filter((item) => !status || item.attributes.status === status) || []; return <Frame title="Bookings & Appointments" description="Review requested windows and perform authorized appointment actions." action={<Button onClick={() => setCreate(true)}>Create booking</Button>}>{error && <Failure error={error} />}{!items && !error && <p className="notice">Loading authorized bookings…</p>}{items && <><div className="feature-toolbar"><WorkspaceTabs label="Booking view" activeId={view} onChange={(id) => setView(id as 'list' | 'calendar')} tabs={[{ id: 'list', label: 'List' }, { id: 'calendar', label: 'Calendar' }]} /><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{[...new Set(items.data.map((item) => item.attributes.status))].map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>{filtered.length === 0 ? <EmptyState title="No authorized bookings" description="No booking records match this view." /> : view === 'list' ? <div className="feature-list">{filtered.map((item) => <article className="feature-row" key={item.id}><div><Status>{item.attributes.status}</Status><h3>{item.attributes.summary}</h3><p>{readableWindow(item.attributes.requested_window)}</p></div><Button variant="secondary" onClick={() => go(`bookings/${item.id}`)}>View booking</Button></article>)}</div> : <div className="booking-calendar">{filtered.map((item) => <button className="booking-calendar-item" key={item.id} onClick={() => go(`bookings/${item.id}`)}><Status>{item.attributes.status}</Status><strong>{item.attributes.summary}</strong><span>{readableWindow(item.attributes.requested_window)}</span></button>)}</div>}</>}{create && <BookingForm providerId={providerId} close={() => setCreate(false)} saved={(item) => setItems((current) => current ? { ...current, data: [item, ...current.data] } : { data: [item] })} />}</Frame>; }

function GenericList({ providerId, route, section, title, description, endpoint, filter }: { providerId: string; route: OperationsRoute; section: Section; title: string; description: string; endpoint: string; filter?: boolean }) { const [status, setStatus] = useState(''); const path = useMemo(() => `${endpoint}?page[limit]=${DEFAULT_PAGE_SIZE}&sort=-created_at,id${status ? `&filter[status]=${encodeURIComponent(status)}` : ''}`, [endpoint, status]); const [result, setResult] = useState<Collection<GenericAttributes> | null>(null); const [error, setError] = useState(''); useEffect(() => { operationsData.genericCollection(providerId, path).then(setResult).catch((cause) => setError(fail(cause))); }, [providerId, path]); if (route.id) return <Frame title={title} description={description}><Button variant="secondary" onClick={() => go(section)}>Back</Button><p className="notice">Open authorized detail is available through the canonical route.</p></Frame>; return <Frame title={title} description={description}>{error && <Failure error={error} />}{!result && !error && <p className="notice">Loading authorized records…</p>}{result && <><FilterToolbar resultLabel={`Showing ${result.data.length} loaded records`}>{filter && <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option></select></label>}</FilterToolbar>{result.data.length ? <div className="feature-list">{result.data.map((item) => <article className="feature-row" key={item.id}><div><Status>{String(item.attributes.status || 'VISIBLE')}</Status><h3>{String(item.attributes.name || item.attributes.display_name || item.attributes.summary || item.id)}</h3></div></article>)}</div> : <EmptyState title="No authorized records" description="No records are visible in this provider context." />}</>}</Frame>; }

function ServiceRequestsPaginated({ providerId, route, canCreate, canEdit }: { providerId: string; route: OperationsRoute; canCreate: boolean; canEdit: boolean }) {
  const [items, setItems] = useState<Collection<RequestAttributes> | null>(null);
  const [cursor, setCursor] = useState<{ after?: string; before?: string }>({});
  const limit = DEFAULT_PAGE_SIZE
  const [queryText, setQueryText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [create, setCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setItems(null); operationsData.requests(providerId, { ...cursor, limit, query: queryText.trim() || undefined, status: statusFilter || undefined }).then(setItems).catch((cause) => setError(fail(cause))); }, [providerId, cursor, limit, queryText, statusFilter]);
  useEffect(() => {
    if (!items || route.id || !selectedId) return;
    if (!items.data.some((item) => item.id === selectedId)) setSelectedId(null);
  }, [items, route.id, selectedId]);
  if (route.id) return <RequestDetail providerId={providerId} id={route.id} back={() => go('requests')} canEdit={canEdit} />;
  const visibleItems = items?.data || [];
  const requestTypeOptions = [...new Set(visibleItems.map((item) => item.attributes.request_type_id).filter((value): value is string => Boolean(value)))];
  const canStartRequest = canCreate && requestTypeOptions.length > 0;
  const requestDate = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date); };
  return <Frame title="Service Requests" description="Triage provider-authorized requests without conflating contact resolution, booking, or dispatch." action={canStartRequest ? <Button onClick={() => setCreate(true)}>Create request</Button> : undefined}>
    {canCreate && items && !requestTypeOptions.length && <p className="notice">Request creation is unavailable because this provider has no server-returned request type option.</p>}
    {error && <Failure error={error} />}{!items && !error && <p className="notice">Loading authorized requests…</p>}{items && <><div className="feature-summary-grid"><div><span>Visible requests</span><strong>{items.data.length}</strong><small>Current provider page</small></div><div><span>Open requests</span><strong>{items.data.filter((item) => !['COMPLETED', 'CANCELLED', 'CLOSED'].includes(item.attributes.status)).length}</strong><small>Not closed on this page</small></div><div><span>Status groups</span><strong>{new Set(items.data.map((item) => item.attributes.status)).size}</strong><small>Returned by the API</small></div><div><span>Records per page</span><strong>{limit}</strong><small>Backend cursor pagination</small></div></div><FilterToolbar resultLabel={`Showing ${visibleItems.length} of ${items.data.length} authorized requests`}><label>Search requests<input aria-label="Search requests" placeholder="Search request ID, customer or issue…" value={queryText} onChange={(event) => { setQueryText(event.target.value); setSelectedId(null); setCursor({}); }} /></label><label>Status<select aria-label="Filter requests by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setSelectedId(null); setCursor({}); }}><option value="">All statuses</option>{[...new Set(items.data.map((item) => item.attributes.status))].map((status) => <option key={status} value={status}>{status}</option>)}</select></label></FilterToolbar><section className="service-request-register service-request-register--full" aria-label="Service request register"><div className="service-request-register-heading"><strong>Service requests ({visibleItems.length})</strong><span>Choose View to open the authorized record details.</span></div>{visibleItems.length ? <div className="service-request-table-scroll"><table className="service-request-table"><thead><tr><th scope="col">Request ID</th><th scope="col">Request summary</th><th scope="col">Type</th><th scope="col">Created</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>{visibleItems.map((item) => <tr key={item.id} className={selectedId === item.id ? 'is-selected' : undefined}><td data-label="Request ID"><span title={item.id}>{item.id.slice(0, 8)}…</span></td><td data-label="Request summary">{item.attributes.summary}</td><td data-label="Type">{item.attributes.request_type_id || '—'}</td><td data-label="Created">{requestDate(item.attributes.created_at)}</td><td data-label="Status"><Status>{item.attributes.status}</Status></td><td data-label="Actions"><Button type="button" variant="quiet" onClick={() => setSelectedId(item.id)}>View</Button></td></tr>)}</tbody></table></div> : <EmptyState title="No matching requests" description="Clear the filters or move to another server page." />}<div className="server-pagination" aria-label="Service request pages"><div><Button type="button" variant="secondary" disabled={!items.page?.previous} onClick={() => setCursor({ before: items.page?.previous || undefined })}>Previous</Button><Button type="button" disabled={!items.page?.next} onClick={() => setCursor({ after: items.page?.next || undefined })}>Next</Button></div></div></section><RequestSummaryPanel providerId={providerId} item={visibleItems.find((item) => item.id === selectedId) || null} openDetails={(id) => go(`requests/${id}`)} closeDetails={() => setSelectedId(null)} /></>}
    {create && <RequestForm providerId={providerId} requestTypeOptions={requestTypeOptions} close={() => setCreate(false)} saved={(item) => { setItems((current) => current ? { ...current, data: [item, ...current.data] } : { data: [item] }); setCreate(false); }} />}</Frame>;
}

function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function weekStartKey(date: Date) { const monday = new Date(date); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7)); return localDateKey(monday); }
function weekDays(startKey: string) { const start = new Date(`${startKey}T00:00:00`); return Array.from({ length: 7 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; }); }

function BookingsPaginated({ providerId, route, canCreate }: { providerId: string; route: OperationsRoute; canCreate: boolean }) {
  const [items, setItems] = useState<Collection<BookingAttributes> | null>(null);
  const [cursor, setCursor] = useState<{ after?: string; before?: string }>({});
  const limit = DEFAULT_PAGE_SIZE
  const [statusFilter, setStatusFilter] = useState('');
  const [queryText, setQueryText] = useState('');
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [weekStart, setWeekStart] = useState(() => weekStartKey(new Date()));
  const [create, setCreate] = useState(false);
  const [error, setError] = useState('');
  const rangeStart = new Date(`${weekStart}T00:00:00`);
  const rangeEnd = new Date(rangeStart); rangeEnd.setDate(rangeStart.getDate() + 7);
  const days = weekDays(weekStart);
  const calendarStartHour = 8;
  const calendarEndHour = 18;
  const hourHeight = 56;
  useEffect(() => { setItems(null); setError(''); operationsData.bookings(providerId, { ...cursor, limit, query: queryText.trim() || undefined, status: statusFilter || undefined, startsAtGte: rangeStart.toISOString(), startsAtLt: rangeEnd.toISOString() }).then(setItems).catch((cause) => setError(fail(cause))); }, [providerId, cursor, limit, queryText, statusFilter, weekStart]);
  if (route.id) return <AppointmentDetail providerId={providerId} id={route.id} back={() => go('bookings')} />;
  const visibleItems = items?.data || [];
  const shiftWeek = (amount: number) => { const next = new Date(rangeStart); next.setDate(next.getDate() + amount * 7); setWeekStart(localDateKey(next)); setCursor({}); };
  const rangeLabel = `${days[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  return <Frame title="Appointments & dispatch" description="Schedule site visits, dispatch technicians, and manage field capacity." action={<div className="booking-week-actions"><Button variant="secondary" aria-label="Previous week" onClick={() => shiftWeek(-1)}>‹</Button><strong>{rangeLabel}</strong><Button variant="secondary" aria-label="Next week" onClick={() => shiftWeek(1)}>›</Button><Button variant="secondary" onClick={() => { setWeekStart(weekStartKey(new Date())); setCursor({}); }}>Today</Button>{canCreate && <Button onClick={() => setCreate(true)}>Create booking</Button>}</div>}>
    {error && <Failure error={error} />}{!items && !error && <p className="notice">Loading authorized appointments…</p>}{items && <><div className="feature-summary-grid"><div><span>Scheduled this week</span><strong>{items.data.length}</strong><small>Provider-scoped appointments</small></div><div><span>Confirmed</span><strong>{items.data.filter((item) => ['CONFIRMED', 'COMPLETED'].includes(item.attributes.status)).length}</strong><small>Appointment lifecycle</small></div><div><span>Pending action</span><strong>{items.data.filter((item) => ['REQUESTED', 'PROPOSED', 'RESCHEDULED'].includes(item.attributes.status)).length}</strong><small>Needs scheduling review</small></div><div><span>Records per page</span><strong>{limit}</strong><small>Backend cursor pagination</small></div></div><div className="booking-controls"><FilterToolbar resultLabel={`${items.data.length} appointments in ${rangeLabel}`}><label>Search appointments<input aria-label="Search appointments" placeholder="Search appointment summary…" value={queryText} onChange={(event) => { setQueryText(event.target.value); setCursor({}); }} /></label><label>Status<select aria-label="Filter bookings by status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setCursor({}); }}><option value="">All statuses</option>{['REQUESTED', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'MISSED', 'CANCELLED'].map((status) => <option key={status} value={status}>{status}</option>)}</select></label></FilterToolbar><div className="booking-view-toggle" role="group" aria-label="Appointment view"><Button variant={view === 'list' ? 'primary' : 'secondary'} onClick={() => setView('list')}>List</Button><Button variant={view === 'calendar' ? 'primary' : 'secondary'} onClick={() => setView('calendar')}>Calendar</Button></div></div>{view === 'calendar' ? <div className="booking-calendar-region">{visibleItems.length === 0 && <EmptyState title="No appointments this week" description="There are no authorized appointments in this week or the selected filters." />}<div className="booking-week-scroll"><div className="booking-week-grid" style={{ '--booking-hour-height': `${hourHeight}px`, '--booking-hours': calendarEndHour - calendarStartHour } as CSSProperties}><div className="booking-week-time-axis" aria-label="Appointment calendar time axis"><div className="booking-week-time-heading">Time</div>{Array.from({ length: calendarEndHour - calendarStartHour }, (_, index) => <div className="booking-week-time-label" key={calendarStartHour + index}>{new Date(2000, 0, 1, calendarStartHour + index).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>)}</div>{days.map((day) => { const key = localDateKey(day); const dayItems = visibleItems.filter((item) => localDateKey(new Date(item.attributes.requested_window.starts_at)) === key); return <section className={`booking-week-day${key === localDateKey(new Date()) ? ' is-today' : ''}`} key={key}><h3><span>{day.toLocaleDateString('en-IN', { weekday: 'short' })}</span><strong>{day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</strong></h3><div className="booking-week-track">{dayItems.map((item) => { const start = new Date(item.attributes.requested_window.starts_at); const end = new Date(item.attributes.requested_window.ends_at); const startMinutes = (start.getHours() - calendarStartHour) * 60 + start.getMinutes(); const endMinutes = (end.getHours() - calendarStartHour) * 60 + end.getMinutes(); const top = Math.max(0, Math.min((calendarEndHour - calendarStartHour) * 60 - 28, startMinutes)); const bottom = Math.max(top + 28, Math.min((calendarEndHour - calendarStartHour) * 60, endMinutes)); return <button className="booking-week-event" style={{ top: `${top / 60 * hourHeight}px`, height: `${(bottom - top) / 60 * hourHeight}px` }} type="button" key={item.id} title={`${item.attributes.summary} · ${readableWindow(item.attributes.requested_window)}`} onClick={() => go(`bookings/${item.id}`)}><Status>{item.attributes.status}</Status><strong>{item.attributes.summary}</strong><span>{start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}–{end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span></button>})}</div></section>; })}</div></div></div> : visibleItems.length === 0 ? <EmptyState title="No appointments this week" description="There are no authorized appointments in this week or the selected filters." /> : <div className="feature-list">{visibleItems.map((item) => <article className="feature-row" key={item.id}><div><Status>{item.attributes.status}</Status><h3>{item.attributes.summary}</h3><p>{readableWindow(item.attributes.requested_window)}</p></div><Button variant="secondary" onClick={() => go(`bookings/${item.id}`)}>View booking</Button></article>)}</div>}<div className="server-pagination" aria-label="Booking pages"><div><Button type="button" variant="secondary" disabled={!items.page?.previous} onClick={() => setCursor({ before: items.page?.previous || undefined })}>Previous</Button><Button type="button" disabled={!items.page?.next} onClick={() => setCursor({ after: items.page?.next || undefined })}>Next</Button></div></div></>}
    {create && canCreate && <BookingForm providerId={providerId} close={() => setCreate(false)} saved={(item) => { setItems((current) => current ? { ...current, data: [item, ...current.data] } : { data: [item] }); setCreate(false); }} />}</Frame>;
}

function BillingWorkspace({ providerId }: { providerId: string }) {
  const [item, setItem] = useState<Resource<GenericAttributes> | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setItem(null); setError(''); operationsData.providerBilling(providerId).then(setItem).catch((cause) => setError(fail(cause))); }, [providerId]);
  if (error) return <Frame title="Payment & Billing" description="Review provider payment stages and recorded payment evidence."><Failure error={error} /></Frame>;
  if (!item) return <Frame title="Payment & Billing" description="Review provider payment stages and recorded payment evidence."><p className="notice">Loading provider billing records…</p></Frame>;
  const attributes = item.attributes;
  const totals = objectValue(attributes.totals);
  const stages = Array.isArray(attributes.payment_stages) ? attributes.payment_stages.map(objectValue) : [];
  const payments = Array.isArray(attributes.payments) ? attributes.payments.map(objectValue) : [];
  const currency = String(attributes.currency_code || 'INR');
  return <Frame title="Payment & Billing" description="Review provider-scoped payment stages and recorded payment evidence. Recording and settlement actions remain in the linked project workflow.">
    <div className="feature-summary-grid"><div><span>Payment stages</span><strong>{stages.length}</strong><small>Returned by the billing API</small></div><div><span>Total due</span><strong>{billingAmount(totals.due_amount, currency)}</strong><small>Configured project stages</small></div><div><span>Collected</span><strong>{billingAmount(totals.collected_amount, currency)}</strong><small>Received, pending or settled</small></div><div><span>Settled</span><strong>{billingAmount(totals.settled_amount, currency)}</strong><small>Verified settlement evidence</small></div></div>
    <section className="detail-card billing-register-card"><div className="section-heading"><div><h2>Payment stages</h2><p>Stages are linked to projects and preserve the server-calculated amounts.</p></div><span>{stages.length} rows</span></div>{stages.length ? <div className="service-request-table-scroll"><table className="service-request-table billing-table"><thead><tr><th>Project</th><th>Milestone</th><th>Due on</th><th>Due amount</th><th>Collected</th><th>Status</th><th>Actions</th></tr></thead><tbody>{stages.map((stage, index) => { const projectId = String(stage.project_id || ''); const projectTitle = String(stage.project_title || 'Project'); return <tr key={String(stage.id || index)}><td><strong>{projectTitle}</strong></td><td><strong>{String(stage.milestone_code || 'Stage')}</strong><small>{String(stage.description || '')}</small></td><td>{billingDate(stage.due_on)}</td><td>{billingAmount(stage.due_amount, currency)}</td><td>{billingAmount(stage.collected_amount, currency)}</td><td><Status>{String(stage.status || 'OPEN')}</Status></td><td><Button type="button" variant="secondary" disabled={!projectId} aria-label={`Open project ${projectTitle}`} onClick={() => go(`projects/${projectId}`)}>Open project</Button></td></tr>; })}</tbody></table></div> : <EmptyState title="No payment stages" description="No provider payment stages were returned for this workspace." />}</section>
    <section className="detail-card billing-register-card"><div className="section-heading"><div><h2>Recorded payments</h2><p>Payment evidence is read from the provider-authorized service workflow.</p></div><span>{payments.length} rows</span></div>{payments.length ? <div className="service-request-table-scroll"><table className="service-request-table billing-table"><thead><tr><th>Project</th><th>Reference</th><th>Method</th><th>Received</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{payments.map((payment, index) => { const projectId = String(payment.project_id || ''); const projectTitle = String(payment.project_title || 'Project'); return <tr key={String(payment.id || index)}><td><strong>{projectTitle}</strong></td><td>{String(payment.payment_reference || '—')}</td><td>{String(payment.method || '—').replaceAll('_', ' ')}</td><td>{billingDate(payment.received_at)}</td><td>{billingAmount(payment.amount, String(payment.currency_code || currency))}</td><td><Status>{String(payment.status || 'RECEIVED')}</Status></td><td><Button type="button" variant="secondary" disabled={!projectId} aria-label={`Open project ${projectTitle}`} onClick={() => go(`projects/${projectId}`)}>Open project</Button></td></tr>; })}</tbody></table></div> : <EmptyState title="No recorded payments" description="Payment evidence will appear here when it is recorded through an authorized project workflow." />}</section>
  </Frame>;
}

export function OperationsPages({ section, providerId, route, t }: { section: Section; providerId: string; route: OperationsRoute; t: T }) {
  const { session } = useAuth();
  const providerContext = session ? navigationForSession(session, providerId).context : undefined;
  const capabilities = providerContext?.capabilities || [];
  if (section === 'sites') return <CustomerOperations providerId={providerId} view="sites" canManage={capabilities.includes('customer_admin')} />;
  if (section === 'assets') return <CustomerOperations providerId={providerId} view="assets" canManage={capabilities.includes('customer_admin')} />;
  if (section === 'configuration' && route.kind === 'quotation-terms-templates') return <ProviderQuotationTermsTemplatesAdmin providerId={providerId} canManage={capabilities.includes('quotation_terms_admin')} canCreateQuotation={capabilities.includes('quotations')} initialCreate={route.id === 'new'} templateId={route.id && route.id !== 'new' ? route.id : undefined} />;
  if (section === 'configuration' && ['support-coverage', 'extra-day-credits'].includes(route.kind || '')) return <ProviderWorkforceSetup providerId={providerId} mode={route.kind as 'support-coverage' | 'extra-day-credits'} canAssign={capabilities.includes('job_assign')} canReview={capabilities.includes('attendance_team') || capabilities.includes('attendance_correct')} canSubmit={capabilities.includes('attendance_self')} />;
  if (section === 'configuration' && !route.kind) return <ProviderConfigurationHub providerId={providerId} providerName={providerContext?.displayName || 'Selected provider'} />;
  if (section === 'leads') return <MarketingLeads providerId={providerId} route={route} />;
  if (section === 'work-intake') return <ProviderWorkIntakeWorkspace providerId={providerId} route={route} canCreate={capabilities.includes('work_intake_create')} canEdit={capabilities.includes('work_intake_edit')} canAssign={capabilities.includes('work_intake_assign')} />;
  if (section === 'projects') return <ProjectsWorkspace providerId={providerId} route={route} />;
  if (section === 'amc') {
    if (route.id === 'plans') return <ProviderAmcPlanCatalogue providerId={providerId} canManage={capabilities.includes('amc_plan_create')} canEdit={capabilities.includes('amc_plan_edit')} canSubmit={capabilities.includes('amc_plan_submit')} canReview={capabilities.includes('amc_plan_review')} canPublish={capabilities.includes('amc_plan_publish')} canActivate={capabilities.includes('amc_plan_activate')} canSuspend={capabilities.includes('amc_plan_suspend')} isProviderAdmin={['PROVIDER_ADMIN', 'ADMIN'].includes(String(providerContext?.roleContext || '').toUpperCase())} />;
    return <ProviderPrograms providerId={providerId} route={route} canManage={capabilities.includes('customer_admin')} canConfigure={capabilities.includes('configuration')} />;
  }
  if (section === 'reports') return <ReportsWorkspace providerId={providerId} />;
  if (section === 'compliance') return <ProviderCompliancePage providerId={providerId} />;
  if (section === 'requests') return <ServiceRequestsPaginated providerId={providerId} route={route} canCreate={capabilities.includes('service_request_create')} canEdit={capabilities.includes('service_request_edit')} />;
  if (section === 'bookings') return <BookingsPaginated providerId={providerId} route={route} canCreate={capabilities.includes('service_booking_create')} />;
  if (section === 'billing') return <BillingWorkspace providerId={providerId} />;
  if (section === 'quotations') return <QuotationsWorkspace providerId={providerId} initialQuotationId={route.id === 'new' ? undefined : route.id} initialCreate={route.id === 'new'} initialTemplateId={route.templateId} />;
  if (section === 'workforce') return <WorkforceOperations providerId={providerId} canManageWorkforce={capabilities.includes('customer_admin')} canManageAccess={capabilities.includes('team_access')} canReviewLeave={capabilities.includes('customer_admin')} />;
  if (section === 'attendance') return <WorkforceSelfService providerId={providerId} initialTab="attendance" />;
  if (section === 'my-leave') return <WorkforceSelfService providerId={providerId} initialTab="leave" />;
  if (section === 'audit') return <ProviderAudit providerId={providerId} />;
  if (route.id) return <GenericList providerId={providerId} route={route} section={section} title="Configuration" description="Authorized configuration detail." endpoint={`/configuration/${encodeURIComponent(route.kind || 'service-types')}`} />;
  return <ConfigurationAdmin providerId={providerId} t={t} initialKind={route.kind} />;
}

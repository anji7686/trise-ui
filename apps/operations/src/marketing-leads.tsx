import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@trise/ui";
import {
  operationsData,
  type Collection,
  type GenericAttributes,
  type MarketingLeadAttributes,
  type ProviderDocumentAttributes,
  type Resource,
} from "./data";
import { OperationsStatus as Status } from "./operations-status";
import { OperationsDialog } from "./operations-dialog";
import { sha256Hex } from "./provider-document-upload";
import { SiteSurveyWizard } from "./site-survey-wizard";

type Props = { providerId: string };
const EVIDENCE_MEDIA_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_EVIDENCE_BYTES = 26_214_400;

export function MarketingLeads({ providerId }: Props) {
  const [leads, setLeads] =
    useState<Collection<MarketingLeadAttributes> | null>(null);
  const [relationships, setRelationships] =
    useState<Collection<GenericAttributes> | null>(null);
  const [selected, setSelected] =
    useState<Resource<MarketingLeadAttributes> | null>(null);
  const [selectedLeadTab, setSelectedLeadTab] = useState("Overview");
  const automaticLeadSelection = useRef(true);
  const [editOpen, setEditOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [surveyId, setSurveyId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [evidenceMessage, setEvidenceMessage] = useState("");
  const [evidence, setEvidence] =
    useState<Collection<ProviderDocumentAttributes> | null>(null);
  const [downloadBusy, setDownloadBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [pageCursor, setPageCursor] = useState<{ after?: string; before?: string }>({});
  const [pageLimit, setPageLimit] = useState(10);
  const evidenceInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLeads(null);
    setRelationships(null);
    setSelected(null);
    automaticLeadSelection.current = true;
    void Promise.all([
      operationsData.marketingLeads(providerId, { ...pageCursor, limit: pageLimit, query: search.trim() || undefined, status: statusFilter === "ALL" ? undefined : statusFilter, source: sourceFilter === "ALL" ? undefined : sourceFilter, priority: priorityFilter === "ALL" ? undefined : priorityFilter }),
      operationsData
        .customerRelationships(providerId)
        .catch(() => ({ data: [] })),
    ])
      .then(([leadRows, relationshipRows]) => {
        if (!active) return;
        setLeads(leadRows);
        setRelationships(relationshipRows as Collection<GenericAttributes>);
        if (automaticLeadSelection.current && leadRows.data[0]) {
          setSelected((current) => current ?? leadRows.data[0]);
        }
      })
      .catch((cause) => { if (active) setError((cause as Error).message); });
    return () => { active = false; };
  }, [providerId, pageCursor, pageLimit, search, statusFilter, sourceFilter, priorityFilter]);

  useEffect(() => {
    setPageCursor({});
    setSelected(null);
    automaticLeadSelection.current = true;
  }, [search, statusFilter, sourceFilter, priorityFilter]);

  useEffect(() => {
    setEvidence(null);
    if (!selected) return;
    setSelectedLeadTab("Overview");
    void operationsData
      .marketingLeadDocuments(providerId, selected.id)
      .then(setEvidence)
      .catch((cause) => setError((cause as Error).message));
  }, [providerId, selected]);

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const created = await operationsData.createMarketingLead(
        providerId,
        {
          reference_code: form.get("reference_code"),
          source: form.get("source"),
          title: form.get("title"),
          prospect_name: form.get("prospect_name"),
          primary_contact_reference:
            form.get("primary_contact_reference") || undefined,
          customer_relationship_id:
            form.get("customer_relationship_id") || undefined,
        },
        crypto.randomUUID(),
      );
      setLeads((current) =>
        current ? { ...current, data: [created, ...current.data] } : current,
      );
      automaticLeadSelection.current = false;
      setSelected(created);
      setFormOpen(false);
      formElement.reset();
      setMessage("Lead created by the server.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function updateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const updated = await operationsData.updateMarketingLead(
        providerId,
        selected.id,
        {
          title: form.get("title"),
          prospect_name: form.get("prospect_name"),
          primary_contact_reference:
            form.get("primary_contact_reference") || undefined,
          status: form.get("status"),
          priority: form.get("priority"),
          next_follow_up_at: form.get("next_follow_up_at")
            ? new Date(String(form.get("next_follow_up_at"))).toISOString()
            : null,
          expected_revision: selected.attributes.revision,
        },
        crypto.randomUUID(),
      );
      automaticLeadSelection.current = false;
      setSelected(updated);
      setLeads((current) =>
        current
          ? {
              ...current,
              data: current.data.map((lead) =>
                lead.id === updated.id ? updated : lead,
              ),
            }
          : current,
      );
      setEditOpen(false);
      setMessage("Lead updated by the server.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function recordFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await operationsData.createLeadActivity(
        providerId,
        selected.id,
        {
          activity_type: form.get("activity_type"),
          occurred_at: form.get("occurred_at")
            ? new Date(String(form.get("occurred_at"))).toISOString()
            : undefined,
          outcome: form.get("outcome") || undefined,
          next_action: form.get("next_action") || undefined,
          notes: form.get("notes"),
        },
        crypto.randomUUID(),
      );
      setActivityOpen(false);
      setMessage("Follow-up recorded by the server.");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = evidenceInput.current?.files?.[0];
    if (!file || !selected) return;
    if (
      !EVIDENCE_MEDIA_TYPES.includes(file.type) ||
      file.size < 1 ||
      file.size > MAX_EVIDENCE_BYTES
    ) {
      setError(
        "Survey evidence must be PDF, PNG, JPEG, XLS, or XLSX and no larger than 25 MiB.",
      );
      return;
    }
    setEvidenceBusy(true);
    setError("");
    setEvidenceMessage("Preparing an authorization-scoped private upload…");
    try {
      const checksum = await sha256Hex(file);
      const requestKey = crypto.randomUUID();
      const created = await operationsData.createMarketingLeadDocument(
        providerId,
        {
          filename: file.name,
          media_type: file.type,
          size_bytes: file.size,
          checksum,
          classification: "GENERAL_SUPPORTING_EVIDENCE",
          visibility: "internal",
          owner: { type: "MARKETING_LEAD", id: selected.id },
          source: { type: "MARKETING_LEAD", id: selected.id },
        },
        requestKey,
      );
      const response = await fetch(created.transfer.url, {
        method: created.transfer.method,
        headers: created.transfer.headers,
        body: file,
        mode: "cors",
        credentials: "omit",
      });
      if (!response.ok)
        throw new Error(
          `Private storage rejected the evidence upload (HTTP ${response.status}).`,
        );
      await operationsData.finalizeProviderDocument(
        providerId,
        created.document.id,
        { version_id: created.version.id, checksum, size_bytes: file.size },
        `${requestKey}-finalize`,
      );
      if (evidenceInput.current) evidenceInput.current.value = "";
      setEvidence(
        await operationsData.marketingLeadDocuments(providerId, selected.id),
      );
      setEvidenceMessage(
        "Survey evidence finalized and associated with this lead.",
      );
    } catch (cause) {
      setEvidenceMessage("");
      setError(
        (cause as Error).message ||
          "The private evidence upload could not be completed.",
      );
    } finally {
      setEvidenceBusy(false);
    }
  }

  async function downloadEvidence(
    document: Resource<ProviderDocumentAttributes>,
  ) {
    const versionId = document.attributes.current_version_id;
    if (!versionId) return;
    setDownloadBusy(document.id);
    setError("");
    try {
      const transfer = await operationsData.authorizeProviderDocumentDownload(
        providerId,
        document.id,
        versionId,
        crypto.randomUUID(),
        "attachment",
      );
      window.open(transfer.url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(
        (cause as Error).message ||
          "Evidence download could not be authorized.",
      );
    } finally {
      setDownloadBusy(null);
    }
  }

  if (error && !leads)
    return (
      <section className="notice state-error" role="alert">
        <strong>{error}</strong>
      </section>
    );
  if (!leads)
    return (
      <section className="notice" role="status">
        <strong>Loading leads…</strong>
      </section>
    );
  const filteredLeads = leads.data;
  const newLeads = leads.data.filter((lead) => lead.attributes.status === "NEW").length;
  const followUps = leads.data.filter((lead) => lead.attributes.status === "CONTACTED").length;
  const surveysPending = leads.data.filter((lead) => lead.attributes.status === "QUALIFIED").length;
  const readyForQuote = leads.data.filter((lead) => ["QUALIFIED", "READY_FOR_QUOTE"].includes(lead.attributes.status)).length;
  return (
    <section className="content provider-leads">
      <div className="feature-page-heading">
        <div><span className="eyebrow">Sales &amp; Marketing</span><h2>Leads &amp; site surveys</h2><p>Capture prospects, plan site surveys, and move opportunities toward quotation.</p></div>
        <Button aria-label="New lead" onClick={() => setFormOpen(true)}>+ Add lead</Button>
      </div>
      <div className="feature-summary-grid"><div><span>New leads</span><strong>{newLeads}</strong><small>of {leads.data.length} on this page</small></div><div><span>Follow-ups</span><strong>{followUps}</strong><small>Contacted leads on this page</small></div><div><span>Surveys pending</span><strong>{surveysPending}</strong><small>Qualified leads on this page</small></div><div><span>Ready for quotation</span><strong>{readyForQuote}</strong><small>Eligible leads on this page</small></div></div>
      {formOpen && (
        <OperationsDialog title="Create lead" busy={busy} className="lead-workflow-dialog" onClose={() => setFormOpen(false)}>
          <p className="lead-dialog-intro">Create a provider-scoped sales lead. This does not create a Customer or Project.</p>
          <form className="lead-workflow-form" onSubmit={createLead}>
            <div className="form-grid">
              <label>
                Reference code
                <input
                  name="reference_code"
                  required
                  maxLength={40}
                  placeholder="LEAD-100"
                />
              </label>
              <label>
                Source
                <input
                  name="source"
                  required
                  maxLength={40}
                  placeholder="FIELD"
                />
              </label>
              <label>
                Prospect name
                <input name="prospect_name" required maxLength={200} />
              </label>
              <label>
                Opportunity title
                <input name="title" required maxLength={200} />
              </label>
              <label>
                Primary contact reference
                <input name="primary_contact_reference" maxLength={320} />
              </label>
              <label>
                Existing customer/prospect (optional)
                <select name="customer_relationship_id">
                  <option value="">Create a new prospect relationship</option>
                  {relationships?.data.map((relationship) => (
                    <option key={relationship.id} value={relationship.id}>
                      {String(
                        relationship.attributes.display_name ||
                          relationship.attributes.name ||
                          relationship.id,
                      )}{" "}
                      ·{" "}
                      {String(
                        relationship.attributes.relationship_kind ||
                          "relationship",
                      )}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="lead-workflow-actions">
              <Button type="button" variant="secondary" disabled={busy} onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create lead"}</Button>
            </div>
          </form>
        </OperationsDialog>
      )}
      <div className="leads-workspace">
      <section className="leads-list-panel">
        <div className="section-heading"><div><h3>Leads ({leads.data.length})</h3><p>All prospects and survey opportunities</p></div></div>
        <div className="leads-filters"><input aria-label="Search leads" placeholder="Search by name, company or location…" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Filter leads by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option>{Array.from(new Set(leads.data.map((lead) => lead.attributes.status))).map((status) => <option key={status} value={status}>{status}</option>)}</select><select aria-label="Filter leads by source" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="ALL">All sources</option>{Array.from(new Set(leads.data.map((lead) => lead.attributes.source))).map((source) => <option key={source} value={source}>{source}</option>)}</select><select aria-label="Filter leads by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="ALL">All priorities</option>{Array.from(new Set(leads.data.map((lead) => lead.attributes.priority))).map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select><label className="page-size-control">Rows per page<select aria-label="Rows per page" value={pageLimit} onChange={(event) => { setPageLimit(Number(event.target.value)); setPageCursor({}); setSelected(null); automaticLeadSelection.current = true; }}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label></div>
      {filteredLeads.length === 0 ? (
        <p className="notice">No leads match the current filters in this Provider workspace.</p>
      ) : (
        <div className="lead-register-scroll">
          <table className="lead-register">
            <thead><tr><th scope="col">Lead / prospect</th><th scope="col">Reference / source</th><th scope="col">Priority</th><th scope="col">Status</th></tr></thead>
            <tbody>{filteredLeads.map((lead) => (
              <tr key={lead.id} className={selected?.id === lead.id ? "is-selected" : undefined}>
                <td data-label="Lead / prospect"><button type="button" className="lead-register-select" aria-pressed={selected?.id === lead.id} onClick={() => { automaticLeadSelection.current = false; setSelected(lead); }}>{lead.attributes.title}</button><small>{lead.attributes.prospect_name}</small></td>
                <td data-label="Reference / source">{lead.attributes.reference_code}<small>{lead.attributes.source}</small></td>
                <td data-label="Priority"><Status>{lead.attributes.priority}</Status></td>
                <td data-label="Status"><Status>{lead.attributes.status}</Status></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div className="server-pagination" aria-label="Lead pages"><span>Showing {filteredLeads.length} of this provider page</span><div><Button type="button" variant="secondary" disabled={!leads.page?.previous} onClick={() => { automaticLeadSelection.current = true; setSelected(null); setPageCursor({ before: leads.page?.previous || undefined }); }}>Previous</Button><Button type="button" disabled={!leads.page?.next} onClick={() => { automaticLeadSelection.current = true; setSelected(null); setPageCursor({ after: leads.page?.next || undefined }); }}>Next</Button></div></div>
      </section>
      {selected && (
        <aside className="detail-card lead-detail-panel" aria-label="Lead details">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Lead detail</span>
              <h3>{selected.attributes.title}</h3>
            </div>
            <button className="text-button" onClick={() => { automaticLeadSelection.current = false; setSelected(null); }}>
              Close
            </button>
          </div>
          <nav className="lead-detail-tabs" aria-label="Lead detail sections" role="tablist">
            {(["Overview", "Activity", "Site Survey", "Requirements", "Attachments"] as const).map((tab) => {
              const tabId = tab.toLowerCase().replaceAll(" ", "-");
              return <button key={tab} id={`lead-tab-${tabId}`} type="button" role="tab" aria-controls={`lead-panel-${tabId}`} aria-selected={selectedLeadTab === tab}
                className={selectedLeadTab === tab ? "active" : ""} onClick={() => setSelectedLeadTab(tab)}>
                {tab}
              </button>;
            })}
          </nav>
          <section id="lead-panel-overview" role="tabpanel" aria-labelledby="lead-tab-overview" hidden={selectedLeadTab !== "Overview"}>
          <dl>
            <dt>Prospect</dt>
            <dd>{selected.attributes.prospect_name}</dd>
            <dt>Status</dt>
            <dd>{selected.attributes.status}</dd>
            <dt>Priority</dt>
            <dd>{selected.attributes.priority}</dd>
            <dt>Revision</dt>
            <dd>{selected.attributes.revision}</dd>
          </dl>
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            Edit lead
          </Button>
          </section>
          <section id="lead-panel-attachments" role="tabpanel" aria-labelledby="lead-tab-attachments" hidden={selectedLeadTab !== "Attachments"}>
            <h4>Survey evidence</h4>
            <form onSubmit={uploadEvidence}>
              <label>
                PDF, PNG, JPEG, XLS or XLSX
                <input
                  ref={evidenceInput}
                  type="file"
                  accept={EVIDENCE_MEDIA_TYPES.join(",")}
                  required
                />
              </label>
              <Button type="submit" busy={evidenceBusy}>
                {evidenceBusy ? "Uploading…" : "Upload evidence"}
              </Button>
              {evidenceMessage && (
                <p className="success" role="status">
                  {evidenceMessage}
                </p>
              )}
            </form>
            {evidence && (
              <div aria-label="Finalized survey evidence">
                <h4>Finalized evidence</h4>
                {evidence.data.length === 0 ? (
                  <p>No finalized evidence is associated with this lead.</p>
                ) : (
                  evidence.data.map((document) => (
                    <div className="inline-actions" key={document.id}>
                      <span>
                        {document.attributes.filename} ·{" "}
                        {document.attributes.status} ·{" "}
                        {document.attributes.scan_state}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={downloadBusy === document.id}
                        onClick={() => void downloadEvidence(document)}
                      >
                        {downloadBusy === document.id
                          ? "Authorizing…"
                          : "Download evidence"}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
          <section id="lead-panel-activity" role="tabpanel" aria-labelledby="lead-tab-activity" hidden={selectedLeadTab !== "Activity"}>
            <h4>Follow-up activity</h4>
            <p>Record a call, email, meeting or site visit. The entry is appended to the lead audit history.</p>
            <Button onClick={() => setActivityOpen(true)}>Record follow-up</Button>
          </section>
          <section id="lead-panel-site-survey" role="tabpanel" aria-labelledby="lead-tab-site-survey" hidden={selectedLeadTab !== "Site Survey"}>
            <SiteSurveyWizard providerId={providerId} leadId={selected.id} leadTitle={`${selected.attributes.reference_code} · ${selected.attributes.title}`} onSubmitted={setSurveyId} onMessage={setMessage} />
          </section>
          <section id="lead-panel-requirements" role="tabpanel" aria-labelledby="lead-tab-requirements" hidden={selectedLeadTab !== "Requirements"}>
            <h4>Requirements revision</h4>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void operationsData
                  .createRequirementRevision(
                    providerId,
                    selected.id,
                    {
                      site_survey_id: surveyId || undefined,
                      requirements: {
                        capacity_kg: Number(form.get("capacity_kg")),
                        stops: Number(form.get("stops")),
                        lift_type: form.get("lift_type"),
                      },
                    },
                    crypto.randomUUID(),
                  )
                  .then(() =>
                    setMessage("Requirement revision captured by the server."),
                  )
                  .catch((cause) => setError((cause as Error).message));
              }}
            >
              <label>
                Capacity (kg)
                <input name="capacity_kg" type="number" min="1" required />
              </label>
              <label>
                Stops
                <input name="stops" type="number" min="1" required />
              </label>
              <label>
                Lift type
                <input name="lift_type" required placeholder="Passenger" />
              </label>
              <Button disabled={!surveyId}>Capture requirements</Button>
              {!surveyId && <small>Submit a site survey first.</small>}
            </form>
          </section>
        </aside>
      )}
      {!selected && <aside className="lead-detail-placeholder"><strong>Select a lead</strong><p>Choose a prospect to review activity, site survey details, requirements and attachments.</p></aside>}
      </div>
      {editOpen && selected && <OperationsDialog title="Update lead" busy={busy} className="lead-workflow-dialog" onClose={() => setEditOpen(false)}>
        <p className="lead-dialog-intro">Changes are revision checked. Previously captured surveys and requirement revisions remain preserved.</p>
        <form className="lead-workflow-form" onSubmit={(event) => void updateLead(event)}>
          <fieldset><legend>Lead identity</legend><label>Reference code<input value={selected.attributes.reference_code} readOnly /></label><label>Prospect<input name="prospect_name" required maxLength={200} defaultValue={selected.attributes.prospect_name} /></label><label>Opportunity title<input name="title" required maxLength={200} defaultValue={selected.attributes.title} /></label><label>Primary contact reference<input name="primary_contact_reference" maxLength={320} defaultValue={selected.attributes.primary_contact_reference || ""} /></label></fieldset>
          <fieldset><legend>Sales management</legend><label>Priority<select name="priority" defaultValue={selected.attributes.priority}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option></select></label><label>Lead stage<select name="status" defaultValue={selected.attributes.status}><option value="NEW">New</option><option value="CONTACTED">Contacted</option><option value="QUALIFIED">Qualified</option><option value="QUOTATION_PENDING">Quotation pending</option><option value="WON">Won</option><option value="LOST">Lost</option></select></label><label>Next follow-up<input name="next_follow_up_at" type="datetime-local" defaultValue={selected.attributes.next_follow_up_at ? new Date(selected.attributes.next_follow_up_at).toISOString().slice(0, 16) : ""} /></label></fieldset>
          <div className="lead-workflow-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setEditOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button></div>
        </form>
      </OperationsDialog>}
      {activityOpen && selected && <OperationsDialog title="Record follow-up" busy={busy} className="lead-workflow-dialog" onClose={() => setActivityOpen(false)}>
        <p className="lead-dialog-intro">Activity records are internal audit history; logging a call does not send a message.</p>
        <form className="lead-workflow-form" onSubmit={(event) => void recordFollowUp(event)}>
          <fieldset><legend>Interaction</legend><label>Lead<input value={`${selected.attributes.reference_code} · ${selected.attributes.title}`} readOnly /></label><label>Activity type<select name="activity_type" defaultValue="CALL"><option value="CALL">Call</option><option value="EMAIL">Email</option><option value="MEETING">Meeting</option><option value="SITE_VISIT">Site visit</option><option value="OTHER">Other</option></select></label><label>Activity date<input name="occurred_at" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} /></label><label>Outcome<input name="outcome" maxLength={500} /></label></fieldset>
          <fieldset><legend>Next action and notes</legend><label>Next action<input name="next_action" maxLength={500} /></label><label className="lead-form-span">Summary / notes<textarea name="notes" required maxLength={4000} rows={4} /></label></fieldset>
          <div className="lead-workflow-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setActivityOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save activity"}</Button></div>
        </form>
      </OperationsDialog>}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

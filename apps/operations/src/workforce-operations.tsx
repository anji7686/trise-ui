import { useEffect, useState, type FormEvent } from "react";
import { Button, FilterToolbar, PageHeader } from "@trise/ui";
import {
  operationsData,
  type Collection,
  type GenericAttributes,
} from "./data";
import { OperationsStatus as Status } from "./operations-status";
import { OperationsDialog } from "./operations-dialog";
import { indiaDateTimeToIso } from "./subscription-support";

const fail = (cause: unknown) =>
  (cause as { message?: string })?.message ||
  "The request could not be completed.";
const attrs = (row: GenericAttributes) =>
  row.attributes as Record<string, unknown>;
const label = (row: GenericAttributes) =>
  String(
    attrs(row).display_name || attrs(row).name || attrs(row).title || row.id,
  );

export function WorkforceOperations({ providerId, canManageWorkforce = false, canManageAccess = false, canReviewLeave = false }: { providerId: string; canManageWorkforce?: boolean; canManageAccess?: boolean; canReviewLeave?: boolean }) {
  const [tab, setTab] = useState<"team" | "availability" | "skills" | "leave">("team");
  const [pageSize, setPageSize] = useState(10);
  const [agents, setAgents] = useState<Collection<GenericAttributes>>({
    data: [],
  });
  const [teams, setTeams] = useState<Collection<GenericAttributes>>({
    data: [],
  });
  const [leave, setLeave] = useState<Collection<GenericAttributes>>({
    data: [],
  });
  const [skills, setSkills] = useState<Collection<GenericAttributes>>({
    data: [],
  });
  const [certificationTypes, setCertificationTypes] = useState<
    Collection<GenericAttributes>
  >({ data: [] });
  const [agentSkills, setAgentSkills] = useState<Collection<GenericAttributes>>(
    { data: [] },
  );
  const [agentCertifications, setAgentCertifications] = useState<
    Collection<GenericAttributes>
  >({ data: [] });
  const [selectedAgent, setSelectedAgent] = useState("");
  const [qualification, setQualification] = useState<GenericAttributes | null>(
    null,
  );
  const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<GenericAttributes | null>(null);
  const [mode, setMode] = useState<
    | "agent"
    | "team"
    | "leave"
    | "availability"
    | "skill"
    | "certification"
    | "verifySkill"
    | "verifyCertification"
    | "reviewLeave"
    | null
  >(null);
  const [agentQuery, setAgentQuery] = useState("");
  const [agentStatus, setAgentStatus] = useState("");
  const [agentCursor, setAgentCursor] = useState<{
    after?: string;
    before?: string;
  }>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const [a, t, l, s, c] = await Promise.all([
      operationsData.agentsDirectory(providerId, {
        query: agentQuery.trim() || undefined,
        status: agentStatus || undefined,
        limit: pageSize,
        ...agentCursor,
      }),
      operationsData.teams(providerId),
      operationsData.leaveRequests(providerId),
      operationsData.skills(providerId),
      operationsData.certificationTypes(providerId),
    ]);
    setAgents(a);
    if (selectedAgent && !a.data.some((agent) => agent.id === selectedAgent)) setSelectedAgent("");
    setTeams(t);
    setLeave(l);
    setSkills(s);
    setCertificationTypes(c);
    if (selectedAgent) {
      const [as, ac] = await Promise.all([
        operationsData.agentSkills(providerId, selectedAgent),
        operationsData.agentCertifications(providerId, selectedAgent),
      ]);
      setAgentSkills(as);
      setAgentCertifications(ac);
    }
  }
  useEffect(() => {
    void load().catch((cause) => setError(fail(cause)));
  }, [providerId, agentQuery, agentStatus, agentCursor, pageSize]);
  useEffect(() => {
    if (!selectedAgent) return;
    void Promise.all([
      operationsData.agentSkills(providerId, selectedAgent),
      operationsData.agentCertifications(providerId, selectedAgent),
    ])
      .then(([as, ac]) => {
        setAgentSkills(as);
        setAgentCertifications(ac);
      })
      .catch((cause) => setError(fail(cause)));
  }, [providerId, selectedAgent]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const agentId = String(form.get("agent_id"));
      const startsAt = form.get("starts_at")
        ? indiaDateTimeToIso(String(form.get("starts_at")))
        : undefined;
      const endsAt = form.get("ends_at")
        ? indiaDateTimeToIso(String(form.get("ends_at")))
        : undefined;
      const window = startsAt && endsAt
        ? { starts_at: startsAt, ends_at: endsAt }
        : undefined;
      if (mode === "agent")
        await operationsData.createAgent(
          providerId,
          {
            user_id: form.get("user_id"),
            display_name: form.get("display_name"),
          },
          crypto.randomUUID(),
        );
      if (mode === "team")
        await operationsData.createTeam(
          providerId,
          { name: form.get("name"), parent_team_id: null },
          crypto.randomUUID(),
        );
      if (mode === "leave")
        await operationsData.createLeaveRequest(
          providerId,
          agentId,
          {
            leave_type: form.get("leave_type"),
            window: window!,
            extent: form.get("extent"),
            reason: form.get("reason"),
          },
          crypto.randomUUID(),
        );
      if (mode === "availability")
        await operationsData.createAvailability(
          providerId,
          agentId,
          { window: window!, available: form.get("available") === "true" },
          crypto.randomUUID(),
        );
      if (mode === "skill")
        await operationsData.createAgentSkill(
          providerId,
          agentId,
          {
            skill_id: form.get("skill_id"),
            proficiency: form.get("proficiency"),
            effective_from: startsAt!,
            effective_to: form.get("effective_to")
              ? indiaDateTimeToIso(String(form.get("effective_to")))
              : null,
          },
          crypto.randomUUID(),
        );
      if (mode === "certification")
        await operationsData.createAgentCertification(
          providerId,
          agentId,
          {
            certification_type_id: form.get("certification_type_id"),
            issuer: form.get("issuer"),
            credential_reference: form.get("credential_reference"),
            issued_at: form.get("issued_at"),
            expires_at: form.get("expires_at")
              ? indiaDateTimeToIso(String(form.get("expires_at")))
              : null,
            document_ids: [],
          },
          crypto.randomUUID(),
        );
      if (mode === "verifySkill" && qualification)
        await operationsData.verifyAgentSkill(
          providerId,
          agentId,
          String(qualification.id),
          {
            action: form.get("action"),
            reason: form.get("reason"),
            expected_revision: attrs(qualification).revision,
          },
          crypto.randomUUID(),
        );
      if (mode === "verifyCertification" && qualification)
        await operationsData.verifyAgentCertification(
          providerId,
          agentId,
          String(qualification.id),
          {
            action: form.get("action"),
            reason: form.get("reason"),
            expected_revision: attrs(qualification).revision,
          },
          crypto.randomUUID(),
        );
      if (mode === "reviewLeave" && selectedLeaveRequest)
        await operationsData.transitionLeaveRequest(
          providerId,
          String(selectedLeaveRequest.id),
          String(form.get("action")) as "approve" | "reject",
          { reason: form.get("reason"), expected_revision: attrs(selectedLeaveRequest).revision },
          crypto.randomUUID(),
        );
      setMode(null);
      setQualification(null);
      setSelectedLeaveRequest(null);
      setMessage("Workforce change saved by the server.");
      await load();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  const agentStateCount = (states: string[]) => agents.data.filter((agent) => states.includes(String(attrs(agent).status || "").toUpperCase())).length;
  const activeCount = agentStateCount(["ACTIVE", "AVAILABLE", "ON_SITE", "ON-SITE", "ON_LEAVE"]);
  const availableCount = agentStateCount(["AVAILABLE"]);
  const onSiteCount = agentStateCount(["ON_SITE", "ON-SITE"]);
  const unavailableCount = agentStateCount(["ON_LEAVE", "UNAVAILABLE", "SUSPENDED"]);
  const selected = agents.data.find((agent) => agent.id === selectedAgent);
  const formTitle = mode === "agent" ? "Add workforce member" : mode === "team" ? "Create team" : mode === "leave" ? "Request leave" : mode === "availability" ? "Set availability" : mode === "skill" ? "Add skill attainment" : mode === "certification" ? "Add certification" : mode === "reviewLeave" ? "Review leave request" : "Review qualification";
  return (
    <section className="content feature-page workforce-page">
      <PageHeader
        title="Workforce management"
        description="Manage provider-scoped agents, teams, leave, availability, skills and certifications through authorized workflows."
        action={canManageWorkforce && <Button onClick={() => setMode("agent")}>Add member</Button>}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      <div className="workforce-kpi-grid" aria-label="Workforce summary">
        {[["Active team members", `${activeCount} shown`, "blue"], ["Available today", `${availableCount} shown`, "green"], ["On site", `${onSiteCount} shown`, "purple"], ["On leave / unavailable", `${unavailableCount} shown`, "orange"]].map(([title, value, tone]) => <article className={`workforce-kpi ${tone}`} key={title}><span>{title}</span><strong>{value}</strong><small>From the current server-filtered page of {agents.data.length} members</small></article>)}
      </div>
      <nav className="workforce-tabs" aria-label="Workforce sections">
        {([["team", "Team"], ["availability", "Availability & Dispatch"], ["skills", "Skills & Certifications"], ["leave", "Leave & Holidays"]] as const).map(([key, title]) => <button type="button" key={key} className={tab === key ? "active" : ""} aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)}>{title}</button>)}
      </nav>
      <div className="workforce-tab-actions">
        {canManageWorkforce && tab === "team" && <Button variant="secondary" onClick={() => setMode("team")}>Create team</Button>}
        {canManageWorkforce && tab === "availability" && <Button onClick={() => setMode("availability")} disabled={!agents.data.length}>Set availability</Button>}
        {canManageWorkforce && tab === "skills" && <><Button onClick={() => setMode("skill")} disabled={!agents.data.length}>Add skill</Button><Button variant="secondary" onClick={() => setMode("certification")} disabled={!agents.data.length}>Add certification</Button></>}
        {canManageWorkforce && tab === "leave" && <Button onClick={() => setMode("leave")} disabled={!agents.data.length}>Request leave</Button>}
      </div>
      {mode && (
        <OperationsDialog title={formTitle} onClose={() => { setMode(null); setQualification(null); setSelectedLeaveRequest(null); }} busy={busy}>
          <form
            className="provider-form"
            onSubmit={(event) => void submit(event)}
          >
            {mode === "agent" && (
              <>
                <label>
                  User ID *
                  <input
                    name="user_id"
                    required
                    placeholder="Authorized user UUID"
                  />
                </label>
                <label>
                  Display name *<input name="display_name" required />
                </label>
              </>
            )}
            {mode === "team" && (
              <label>
                Team name *<input name="name" required />
              </label>
            )}
            {["leave", "availability", "certification", "verifySkill", "verifyCertification"].includes(mode) && (
              <label>
                Agent *
                <select name="agent_id" required defaultValue={selectedAgent}>
                  <option value="">Select agent</option>
                  {agents.data.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {label(agent)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {["leave", "availability"].includes(mode) && (
              <>
                <label>
                  Starts *
                  <input name="starts_at" type="datetime-local" required />
                </label>
                <label>
                  Ends *<input name="ends_at" type="datetime-local" required />
                </label>
              </>
            )}
            {mode === "leave" && (
              <>
                <label>
                  Leave type
                  <select name="leave_type">
                    <option>ANNUAL</option>
                    <option>SICK</option>
                    <option>PERSONAL</option>
                  </select>
                </label>
                <label>
                  Extent
                  <select name="extent">
                    <option value="full_day">Full day</option>
                    <option value="partial_day">Partial day</option>
                  </select>
                </label>
                <label>
                  Reason *<textarea name="reason" required />
                </label>
              </>
            )}
            {mode === "reviewLeave" && selectedLeaveRequest && (
              <>
                <p><strong>{String(attrs(selectedLeaveRequest).leave_type || "Leave request")}</strong><br />{String(attrs(selectedLeaveRequest).starts_at || "Start time unavailable")} – {String(attrs(selectedLeaveRequest).ends_at || "End time unavailable")}</p>
                <label>Decision *<select name="action" required><option value="approve">Approve</option><option value="reject">Reject</option></select></label>
                <label>Reason *<textarea name="reason" required minLength={1} maxLength={1000} /></label>
                <p className="notice">The server checks the request revision and lifecycle before recording this decision.</p>
              </>
            )}
            {mode === "availability" && (
              <label>
                State
                <select name="available">
                  <option value="true">Available</option>
                  <option value="false">Unavailable</option>
                </select>
              </label>
            )}
            {mode === "skill" && (
              <>
                <label>
                  Effective from *
                  <input name="starts_at" type="datetime-local" required />
                </label>
                <label>
                  Skill *
                  <select name="skill_id" required>
                    <option value="">Select skill</option>
                    {skills.data.map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {label(skill)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Proficiency *
                  <input
                    name="proficiency"
                    required
                    placeholder="e.g. expert"
                  />
                </label>
                <label>
                  Valid through
                  <input name="effective_to" type="datetime-local" />
                </label>
              </>
            )}
            {mode === "certification" && (
              <>
                <label>
                  Certification *
                  <select name="certification_type_id" required>
                    <option value="">Select certification</option>
                    {certificationTypes.data.map((item) => (
                      <option key={item.id} value={item.id}>
                        {label(item)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Issuer *<input name="issuer" required />
                </label>
                <label>
                  Credential reference *
                  <input name="credential_reference" required />
                </label>
                <label>
                  Issued *<input name="issued_at" type="date" required />
                </label>
                <label>
                  Expires
                  <input name="expires_at" type="datetime-local" />
                </label>
              </>
            )}
            {["verifySkill", "verifyCertification"].includes(mode) && (
              <>
                <p>
                  Selected qualification:{" "}
                  {qualification ? String(qualification.id) : ""}
                </p>
                <label>
                  Decision
                  <select name="action">
                    <option value="verify">Verify</option>
                    <option value="reject">Reject</option>
                    <option value="revoke">Revoke</option>
                  </select>
                </label>
                <label>
                  Reason *<textarea name="reason" required />
                </label>
              </>
            )}
            {
              <div className="provider-form-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setMode(null);
                    setQualification(null);
                    setSelectedLeaveRequest(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" busy={busy}>
                  Save
                </Button>
              </div>
            }
          </form>
        </OperationsDialog>
      )}
      <div className={`workforce-content-grid workforce-tab-${tab}`}>
        {(tab === "team" || tab === "availability") && <section className="detail-card workforce-directory">
          <div className="section-heading">
            <h2>Agents</h2>
            <span>{agents.data.length} loaded</span>
          </div>
          <FilterToolbar resultLabel="Server-filtered workforce records">
            <label>
              Search agents
              <input
                aria-label="Search agents"
                placeholder="Name or agent ID"
                value={agentQuery}
                onChange={(event) => {
                  setAgentQuery(event.target.value);
                  setAgentCursor({});
                }}
              />
            </label>
            <label>
              Status
              <select
                aria-label="Filter agents by status"
                value={agentStatus}
                onChange={(event) => {
                  setAgentStatus(event.target.value);
                  setAgentCursor({});
                }}
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </label>
            <label>Rows per page<select aria-label="Workforce rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setAgentCursor({}); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label>
          </FilterToolbar>
          {agents.data.map((agent) => (
            <button
              type="button"
              className={`workforce-agent-row${selectedAgent === agent.id ? " selected" : ""}`}
              aria-pressed={selectedAgent === agent.id}
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id)}
            >
              <Status>{String(attrs(agent).status || "ACTIVE")}</Status>
              <strong>{label(agent)}</strong>
              <small>{agent.id}</small>
              <span className="workforce-agent-open">View details →</span>
            </button>
          ))}
          <div className="server-pagination" aria-label="Workforce agent pages">
            <span>{agents.data.length} rows · {pageSize} per page</span>
            <div>
              <Button
                type="button"
                variant="secondary"
                disabled={!agents.page?.previous}
                onClick={() =>
                  setAgentCursor({ before: agents.page?.previous || undefined })
                }
              >
                Previous
              </Button>
              <Button
                type="button"
                disabled={!agents.page?.next}
                onClick={() =>
                  setAgentCursor({ after: agents.page?.next || undefined })
                }
              >
                Next
              </Button>
            </div>
          </div>
        </section>}
        {tab === "team" && selected && <OperationsDialog title={label(selected)} onClose={() => setSelectedAgent("")} className="workforce-detail-dialog"><section className="detail-card workforce-detail-panel">
          <div className="workforce-detail-heading"><h2>{label(selected)}<small>Provider-scoped workforce record</small></h2>{canManageAccess && <Button variant="secondary" onClick={() => { window.location.hash = "team-access"; }}>Manage provider access</Button>}</div>
          {selected ? <dl className="workforce-facts"><dt>Member ID</dt><dd>{selected.id}</dd><dt>Role</dt><dd>{String(attrs(selected).role_name || attrs(selected).role || "Not returned by the provider directory")}</dd><dt>Status</dt><dd><Status>{String(attrs(selected).status || "ACTIVE")}</Status></dd><dt>Team</dt><dd>{String(attrs(selected).team_name || "Not assigned")}</dd></dl> : <p>Select a member to review their provider-scoped details.</p>}
          {canManageAccess && <p className="workforce-access-note">Role grants and membership permissions are managed in Team &amp; Access, separately from workforce qualifications. Select the member there before changing access.</p>}
          <h3>Provider teams</h3>
          {teams.data.length ? teams.data.map((team) => <article className="workforce-team-row" key={team.id}><span><strong>{label(team)}</strong><small>{String(attrs(team).description || "")}</small></span><Status>{String(attrs(team).status || "ACTIVE")}</Status></article>) : <p>No teams are available in this provider workspace.</p>}
        </section></OperationsDialog>}
        {tab === "leave" && <section className="detail-card workforce-leave-panel">
          <h2>Leave requests</h2>
          {leave.data.length ? leave.data.map((item) => (
            <article className="workforce-team-row" key={item.id}>
              <span><strong>{String(attrs(item).leave_type || item.id)}</strong><small>{String(attrs(item).starts_at || "Date not returned")}</small></span>
              <Status>{String(attrs(item).status || "REQUESTED")}</Status>
              {canReviewLeave && String(attrs(item).status || "REQUESTED").toUpperCase() === "REQUESTED" && <Button variant="quiet" onClick={() => { setSelectedLeaveRequest(item); setMode("reviewLeave"); }}>Review</Button>}
            </article>
          )) : <p>No leave requests are recorded in the current provider response.</p>}
        </section>}
        {tab === "availability" && <section className="detail-card workforce-availability-panel"><h2>Availability & Dispatch</h2><p>Current status is shown from the provider agent directory. Set availability records with an effective time window; an agent status alone does not promise dispatch eligibility.</p><div className="workforce-status-list">{agents.data.map((agent) => <article className="workforce-team-row" key={agent.id}><span><strong>{label(agent)}</strong><small>{agent.id}</small></span><Status>{String(attrs(agent).status || "NOT_REPORTED")}</Status></article>)}</div></section>}
        {tab === "skills" && <section className="detail-card workforce-qualification-panel">
          <h2>Skills & Certifications</h2>
          <p>Selected member: {selected ? label(selected) : "Select a member in the Team tab."}</p>
          <div className="workforce-qualification-columns"><section><h3>Skill attainments</h3>{agentSkills.data.length ? agentSkills.data.map((item) => <article className="workforce-team-row" key={item.id}><span><strong>{String(attrs(item).skill_name || attrs(item).name || "Skill attainment")}</strong><small>{String(attrs(item).proficiency || "Proficiency not returned")}</small></span><Status>{String(attrs(item).verification || "PENDING")}</Status>{attrs(item).verification !== "verified" && <Button variant="quiet" onClick={() => { setQualification(item); setMode("verifySkill"); }}>Review</Button>}</article>) : <p>No skill attainments returned for this member.</p>}</section><section><h3>Certifications</h3>{agentCertifications.data.length ? agentCertifications.data.map((item) => <article className="workforce-team-row" key={item.id}><span><strong>{String(attrs(item).certification_name || attrs(item).name || "Certification")}</strong><small>{String(attrs(item).issuer || "Issuer not returned")}</small></span><Status>{String(attrs(item).verification || "PENDING")}</Status>{attrs(item).verification !== "verified" && <Button variant="quiet" onClick={() => { setQualification(item); setMode("verifyCertification"); }}>Review</Button>}</article>) : <p>No certifications returned for this member.</p>}</section></div>
        </section>}
      </div>
    </section>
  );
}

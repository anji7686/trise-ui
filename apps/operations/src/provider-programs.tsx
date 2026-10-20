import { FormEvent, useEffect, useState } from "react";
import { Button, PageHeader } from "@trise/ui";
import {
  operationsData,
  type Collection,
  type GenericAttributes,
  type ProviderOperationsDashboard,
  type Resource,
} from "./data";
import { OperationsStatus as Status } from "./operations-status";
import { EmptyState } from "./operations-shared";
import { OperationsDialog } from "./operations-dialog";
import { formatIndiaDate, formatIndiaDateTime } from "./subscription-support";

const fail = (error: unknown) =>
  (error as { message?: string })?.message ||
  "The request could not be completed.";
const label = (attributes: GenericAttributes) =>
  String(
    attributes.name ||
      attributes.contract_number ||
      attributes.display_name ||
      attributes.title ||
      attributes.id ||
      "Authorized record",
  );
const relationshipId = (value: unknown) => {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && typeof candidate === "object" && "id" in candidate
    ? String(candidate.id)
    : "";
};

// This workspace is mounted only when the server-projected provider `projects`
// capability grants access. Every mutating request is still authorized server-side.
export function ProviderPrograms({ providerId, canManage = true, canConfigure = false }: { providerId: string; canManage?: boolean; canConfigure?: boolean }) {
  type ContractPage = Collection<GenericAttributes> & { summary?: { active_contracts: number; preventive_visits_due: number; renewals_due_this_month: number; covered_assets: number } };
  type ContractTab = "coverage" | "schedule" | "visits" | "renewals" | "billing";
  const [contracts, setContracts] = useState<ContractPage | null>(null);
  const [selected, setSelected] = useState<Resource<GenericAttributes> | null>(
    null,
  );
  const [iterations, setIterations] =
    useState<Collection<GenericAttributes> | null>(null);
  const [scopes, setScopes] = useState<Collection<GenericAttributes> | null>(
    null,
  );
  const [assets, setAssets] = useState<Collection<GenericAttributes> | null>(
    null,
  );
  const [coverageRules, setCoverageRules] = useState<Collection<GenericAttributes> | null>(null);
  const [versions, setVersions] = useState<Collection<GenericAttributes> | null>(null);
  const [amendments, setAmendments] = useState<Collection<GenericAttributes> | null>(null);
  const [servicePlan, setServicePlan] = useState<Resource<GenericAttributes> | null>(null);
  const [tab, setTab] = useState<ContractTab>("coverage");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("");
  const [limit, setLimit] = useState(10);
  const [after, setAfter] = useState("");
  const [before, setBefore] = useState("");
  const [action, setAction] = useState<"renew" | "amend" | "iteration" | null>(
    null,
  );
  async function reload() {
    setLoading(true);
    setError("");
    try {
      const result = await operationsData.maintenanceContracts(providerId, {
        query: search, status: statusFilter, limit, after: after || undefined,
        before: before || undefined,
        ...(expiryFilter === "90" ? { expiresAfter: new Date().toISOString().slice(0, 10), expiresBefore: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10) } : {}),
      });
      setContracts(result);
      if (!selected && result.data[0]) void open(result.data.find((row) => Number(row.attributes.asset_count || 0) > 0) || result.data[0]);
    } finally { setLoading(false); }
  }
  useEffect(() => {
    reload().catch((cause) => setError(fail(cause)));
  }, [providerId, search, statusFilter, limit, after, before, expiryFilter]);
  async function open(contract: Resource<GenericAttributes>) {
    setSelected(contract);
    setTab("coverage");
    setError("");
    setIterations(null);
    setScopes(null);
    setMessage("");
    try {
      const [nextIterations, nextScopes, nextAssets, nextRules, nextVersions, nextAmendments, nextPlan] = await Promise.all([
        operationsData.maintenanceContractIterations(providerId, contract.id),
        operationsData.maintenanceContractAssetScopes(providerId, contract.id),
        operationsData.assets(providerId),
        operationsData.maintenanceContractCoverageRules(providerId, contract.id),
        operationsData.maintenanceContractVersions(providerId, contract.id),
        operationsData.maintenanceContractAmendments(providerId, contract.id),
        contract.relationships?.service_plan
          ? operationsData.maintenanceContractServicePlan(providerId, contract.id)
          : Promise.resolve(null),
      ]);
      setIterations(nextIterations);
      setScopes(nextScopes);
      setAssets(nextAssets);
      setCoverageRules(nextRules);
      setVersions(nextVersions);
      setAmendments(nextAmendments);
      setServicePlan(nextPlan);
    } catch (cause) {
      setError(fail(cause));
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (action === "renew") {
        const successor = await operationsData.renewMaintenanceContract(
          providerId,
          selected.id,
          {
            effective_from: `${String(form.get("effective_from"))}T00:00:00Z`,
            effective_to: `${String(form.get("effective_to"))}T23:59:59Z`,
            expected_revision: Number(selected.attributes.revision),
            reason: String(form.get("reason")),
          },
          crypto.randomUUID(),
        );
        setMessage(
          `Successor contract ${successor.id} created as a draft. The predecessor remains immutable.`,
        );
      } else if (action === "amend") {
        const addAssetId = String(form.get("add_asset_id") || "");
        const removeAssetId = String(form.get("remove_asset_id") || "");
        const amendment = await operationsData.amendMaintenanceContract(
          providerId,
          selected.id,
          {
            effective_at: `${String(form.get("effective_at"))}T00:00:00Z`,
            reason: String(form.get("reason")),
            expected_revision: Number(selected.attributes.revision),
            add_asset_ids: addAssetId ? [addAssetId] : [],
            remove_asset_ids: removeAssetId ? [removeAssetId] : [],
          },
          crypto.randomUUID(),
        );
        setMessage(
          `Amendment ${amendment.id} created as a successor version. Historical coverage was preserved.`,
        );
      } else if (action === "iteration") {
        const iteration = await operationsData.createMaintenanceIteration(
          providerId,
          selected.id,
          {
            asset_scope_id: String(form.get("asset_scope_id")),
            due_at: `${String(form.get("due_at"))}T00:00:00Z`,
            reason: String(form.get("reason")),
          },
          crypto.randomUUID(),
        );
        setMessage(`Preventive maintenance iteration ${iteration.id} planned.`);
      }
      setAction(null);
      event.currentTarget.reset();
      await reload();
      if (action !== "renew") {
        const fresh = await operationsData.maintenanceContract(
          providerId,
          selected.id,
        );
        setSelected(fresh);
        await open(fresh);
      }
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  async function transitionIteration(
    iteration: Resource<GenericAttributes>,
    transition: string,
  ) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const updated = await operationsData.transitionMaintenanceIteration(
        providerId,
        selected.id,
        iteration.id,
        {
          transition,
          expected_revision: Number(iteration.attributes.revision),
          due_at:
            transition === "schedule" || transition === "reschedule"
              ? new Date().toISOString()
              : undefined,
          reason:
            transition === "skip" || transition === "cancel"
              ? "Provider operations decision recorded in the authorized workspace."
              : undefined,
        },
        crypto.randomUUID(),
      );
      setIterations((current) =>
        current
          ? {
              ...current,
              data: current.data.map((row) =>
                row.id === updated.id ? updated : row,
              ),
            }
          : current,
      );
      setMessage(`Iteration ${iteration.id} transitioned to ${transition}.`);
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  const activeScopes =
    scopes?.data.filter(
      (scope) => String(scope.attributes.status || "ACTIVE").toUpperCase() === "ACTIVE",
    ) || [];
  const activeAssetIds = new Set(
    activeScopes.map((scope) => relationshipId(scope.relationships?.asset)).filter(Boolean),
  );
  const assetLabel = (scope: Resource<GenericAttributes>) => {
    const id = relationshipId(scope.relationships?.asset);
    const asset = assets?.data.find((row) => row.id === id);
    return asset ? label(asset.attributes) : `Asset ${id.slice(0, 8) || scope.id.slice(0, 8)}`;
  };
  const summary = contracts?.summary;
  const date = (value: unknown) => value ? formatIndiaDate(String(value)) : "—";
  return (
    <section className="content feature-page">
      <PageHeader
        title="AMC & preventive maintenance"
        description="Provider-scoped maintenance contracts, immutable coverage revisions and due preventive work."
        action={canConfigure ? <Button variant="secondary" onClick={() => { window.location.hash = 'configuration/maintenance-policies'; }}>Configure preventive maintenance</Button> : undefined}
      />
      {error && (
        <div className="feature-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      {!contracts && !error && (
        <p className="notice">Loading authorized maintenance contracts…</p>
      )}
      {contracts && <>
        <div className="feature-summary-grid amc-summary-grid">
          <div><span>Active AMC contracts</span><strong>{summary?.active_contracts ?? "—"}</strong><small>Provider-scoped active agreements</small></div>
          <div><span>Preventive visits due</span><strong>{summary?.preventive_visits_due ?? "—"}</strong><small>Planned visits due in the next 30 days</small></div>
          <div><span>Renewals due this month</span><strong>{summary?.renewals_due_this_month ?? "—"}</strong><small>Based on persisted contract expiry dates</small></div>
          <div><span>Assets covered</span><strong>{summary?.covered_assets ?? "—"}</strong><small>Active asset coverage scopes</small></div>
        </div>
          <form className="amc-filter-bar" onSubmit={(event) => { event.preventDefault(); setSelected(null); setAfter(""); setBefore(""); setSearch(searchDraft.trim()); }}>
            <label>Search contracts<input aria-label="Search AMC contracts" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Contract number or customer" /></label>
            <label>Contract status<select aria-label="Contract status" value={statusFilter} onChange={(event) => { setSelected(null); setStatusFilter(event.target.value); setAfter(""); setBefore(""); }}><option value="">All statuses</option>{["draft", "active", "approved", "suspended", "cancelled", "terminated", "expired"].map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
            <label>Expiry window<select aria-label="Expiry window" value={expiryFilter} onChange={(event) => { setSelected(null); setExpiryFilter(event.target.value); setAfter(""); setBefore(""); }}><option value="">Any expiry</option><option value="90">Next 90 days</option></select></label>
            <Button type="submit" variant="secondary">Search</Button>
            <Button type="button" variant="quiet" onClick={() => { setSelected(null); setSearchDraft(""); setSearch(""); setStatusFilter(""); setExpiryFilter(""); setAfter(""); setBefore(""); }}>Clear</Button>
          </form>
          <div className="amc-workspace">
          <div className="amc-register-panel">
            <div className="section-heading"><div><h3>AMC contracts</h3><p>Provider-scoped contract register · filters and page size are applied by the API.</p></div><label className="amc-page-size">Rows per page<select aria-label="Rows per page" value={limit} onChange={(event) => { setSelected(null); setLimit(Number(event.target.value)); setAfter(""); setBefore(""); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label></div>
            {contracts.data.length ? <div className="amc-table-wrap"><table className="amc-contract-table" aria-label="AMC contracts"><thead><tr><th>Contract No.</th><th>Customer</th><th>Assets</th><th>Plan</th><th>Expiry date</th><th>Status</th><th>Renewal</th><th></th></tr></thead><tbody>{contracts.data.map((contract) => { const expiry = contract.attributes.effective_to; const remaining = expiry ? Math.ceil((new Date(String(expiry)).getTime() - Date.now()) / 86400000) : null; return <tr key={contract.id} aria-current={selected?.id === contract.id ? "true" : undefined}><td><strong>{String(contract.attributes.contract_number || label(contract.attributes))}</strong></td><td>{String(contract.attributes.customer_name || "Authorized customer")}</td><td>{String(contract.attributes.asset_count ?? "—")}</td><td>{String(contract.attributes.plan_code || "Service plan")}</td><td>{date(expiry)}</td><td><Status>{String(contract.attributes.status || "VISIBLE")}</Status></td><td>{remaining !== null && remaining <= 90 ? remaining <= 0 ? "Expired" : `${remaining} days` : "Not due"}</td><td><Button variant="quiet" onClick={() => void open(contract)}>View</Button></td></tr>; })}</tbody></table></div> : <EmptyState title={loading ? "Loading contracts" : "No maintenance contracts"} description={loading ? "Loading the selected provider's authorized contracts." : "No contracts match these server-side filters. New AMC creation remains governed by quotation conversion."} />}
            <div className="server-pagination"><span>Showing {contracts.data.length} records · {limit} per page</span><div><Button variant="secondary" disabled={!contracts.page?.previous || loading} onClick={() => { setAfter(""); setBefore(contracts.page?.previous || ""); }}>Previous</Button><Button variant="secondary" disabled={!contracts.page?.next || loading} onClick={() => { setBefore(""); setAfter(contracts.page?.next || ""); }}>Next</Button></div></div>
          </div>
      
      {selected && (
        <section className="amc-detail-panel">
          <button className="text-button" onClick={() => { setSelected(null); void reload().catch((cause) => setError(fail(cause))); }}>
            ← AMC &amp; maintenance
          </button>
          <div className="amc-detail-heading"><div><Status>{String(selected.attributes.status || "VISIBLE")}</Status><h2>{String(selected.attributes.contract_number || label(selected.attributes))}</h2><p>{String(selected.attributes.customer_name || "Authorized customer")} · Revision {String(selected.attributes.revision || "server-managed")}</p></div><div className="amc-detail-dates"><span>Effective {date(selected.attributes.effective_from)}</span><strong>Expires {date(selected.attributes.effective_to)}</strong></div></div>
          <div className="amc-detail-stats"><div><strong>{String(selected.attributes.asset_count ?? activeScopes.length)}</strong><span>Covered assets</span></div><div><strong>{String(selected.attributes.plan_code || "—")}</strong><span>Service plan</span></div><div><strong>v{String(selected.attributes.version || 1)}</strong><span>Contract version</span></div><div><strong>{String(iterations?.data.length ?? "—")}</strong><span>Maintenance iterations</span></div></div>
          {canManage && <div className="provider-form-actions amc-actions">
            <Button variant="secondary" onClick={() => setAction("renew")}>
              Renew contract
            </Button>
            <Button variant="secondary" onClick={() => setAction("amend")}>
              Create amendment
            </Button>
            <Button
              variant="secondary"
              onClick={() => setAction("iteration")}
              disabled={!activeScopes.length}
            >
              Plan preventive visit
            </Button>
          </div>}
          <div className="lead-detail-tabs amc-tabs" role="tablist" aria-label="AMC contract detail sections">{(["coverage", "schedule", "visits", "renewals", "billing"] as ContractTab[]).map((item) => <button type="button" role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>
          {tab === "coverage" && <div className="amc-detail-grid"><section className="detail-card"><h3>Included coverage rules</h3>{coverageRules?.data.length ? coverageRules.data.map((rule) => <article className="amc-rule-row" key={rule.id}><Status>{String(rule.attributes.status || "ACTIVE")}</Status><strong>{String(rule.attributes.code || rule.attributes.coverage_kind || "Coverage rule")}</strong><span>{String(rule.attributes.description || rule.attributes.coverage_kind || "Contract-defined coverage")}</span></article>) : <p className="notice">No coverage rules were returned for this contract version.</p>}</section><section className="detail-card"><h3>Covered assets</h3>{activeScopes.length ? activeScopes.map((scope) => <article className="amc-rule-row" key={scope.id}><strong>{assetLabel(scope)}</strong><span>Effective {date(scope.attributes.effective_from)}{scope.attributes.effective_to ? ` · through ${date(scope.attributes.effective_to)}` : " · active"}</span></article>) : <p className="notice">No active asset scopes are linked to this contract.</p>}</section></div>}
          {(tab === "schedule" || tab === "visits") && <><div className="section-heading"><div><h3>{tab === "schedule" ? "Preventive maintenance schedule" : "Visit history"}</h3><p>Persisted iterations and their current lifecycle states.</p></div></div>{iterations?.data.length ? (
            iterations.data.map((iteration) => (
              <article className="amc-iteration-row" key={iteration.id}>
                <Status>{String(iteration.attributes.status || "DUE")}</Status>
                <strong>{date(
                    iteration.attributes.due_at ||
                      iteration.attributes.scheduled_for,
                  )}</strong><span>{String(
                    iteration.attributes.description ||
                      iteration.attributes.service_type ||
                      iteration.attributes.outcome_reason ||
                      "Authorized maintenance iteration",
                  )}</span>
                {canManage && ["PLANNED", "RESCHEDULED"].includes(
                  String(iteration.attributes.status),
                ) && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void transitionIteration(iteration, "schedule")
                    }
                  >
                    Schedule
                  </Button>
                )}
                {canManage && ["PLANNED", "SCHEDULED"].includes(
                  String(iteration.attributes.status),
                ) && (
                  <Button
                    variant="quiet"
                    disabled={busy}
                    onClick={() => void transitionIteration(iteration, "skip")}
                  >
                    Skip
                  </Button>
                )}
              </article>
            ))
          ) : (
            <p className="notice">
              No iterations were returned for this contract.
            </p>
          )}</>}
          {tab === "renewals" && <div className="detail-card"><h3>Renewal and amendment history</h3>{amendments?.data.length ? amendments.data.map((item) => <article className="amc-rule-row" key={item.id}><strong>Amendment · version {String(item.attributes.version || "—")}</strong><span>{String(item.attributes.reason || "Commercial successor version recorded")}</span><small>{date(item.attributes.effective_from)}</small></article>) : <p className="notice">No amendments are recorded. Renewals create a separate successor contract and do not overwrite this history.</p>}{versions?.data.length ? <p className="notice">{versions.data.length} immutable version record(s) are available for this contract.</p> : null}</div>}
          {tab === "billing" && <div className="detail-card"><h3>Service plan and commercial terms</h3><dl className="amc-definition-list"><dt>Plan reference</dt><dd>{selected.relationships?.service_plan ? "Linked service plan" : "Not linked"}</dd><dt>Source quotation</dt><dd>{String(selected.attributes.source_quotation_id || "Not supplied")}</dd><dt>Paid renewal</dt><dd>{selected.attributes.paid_renewal === true ? "Yes" : "No / not marked paid"}</dd><dt>Commercial snapshot</dt><dd>{selected.attributes.commercial_party_snapshot_present === true ? "Captured at activation" : "Not captured"}</dd></dl>{servicePlan && <p className="notice">Service plan details loaded from the authorized API.</p>}</div>}
          <p className="notice">
            Historical contract versions are immutable. Renewal and amendment
            use server-created successor versions.
          </p>
          {action && canManage && (
            <OperationsDialog
              title={action === "renew" ? "Renew AMC contract" : action === "amend" ? "Create AMC amendment" : "Plan preventive maintenance"}
              busy={busy}
              onClose={() => setAction(null)}
            >
              <div className="amc-action-dialog-content">
                <p className="notice">{action === "renew" ? "A successor contract draft is created; the current contract remains unchanged." : action === "amend" ? "Amendments create versioned successor records. Existing coverage history is preserved." : "Plan a visit only for an asset currently covered by this contract."}</p>
                <form className="quotation-modal-form" onSubmit={(event) => void submit(event)}>
                {action === "renew" && (
                  <>
                    <label>
                      Effective from *
                      <input name="effective_from" type="date" required />
                    </label>
                    <label>
                      Effective to *
                      <input name="effective_to" type="date" required />
                    </label>
                  </>
                )}
                {action === "amend" && (
                  <>
                    <label>
                      Effective at *
                      <input name="effective_at" type="date" required />
                    </label>
                    <label>
                      Add asset (optional)
                      <select name="add_asset_id">
                        <option value="">No asset added</option>
                        {assets?.data
                          .filter((asset) => !activeAssetIds.has(asset.id))
                          .map((asset) => (
                            <option key={asset.id} value={asset.id}>
                              {label(asset.attributes)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Remove asset (optional)
                      <select name="remove_asset_id">
                        <option value="">No asset removed</option>
                        {assets?.data
                          .filter((asset) => activeAssetIds.has(asset.id))
                          .map((asset) => (
                            <option key={asset.id} value={asset.id}>
                              {label(asset.attributes)}
                            </option>
                          ))}
                      </select>
                    </label>
                  </>
                )}
                {action === "iteration" && (
                  <>
                    <label>
                      Covered asset *
                      <select name="asset_scope_id" required>
                        <option value="">Select covered asset</option>
                        {activeScopes.map((scope) => (
                          <option key={scope.id} value={scope.id}>
                            {String(
                              scope.attributes.asset_display_name ||
                                scope.attributes.asset_id ||
                                scope.id,
                            )}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Due at *<input name="due_at" type="date" required />
                    </label>
                  </>
                )}
                <label>
                  Reason *<textarea name="reason" required minLength={3} />
                </label>
                <div className="provider-form-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setAction(null)}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" busy={busy}>
                    {action === "renew"
                      ? "Create successor draft"
                      : action === "amend"
                        ? "Create immutable amendment"
                        : "Plan preventive visit"}
                  </Button>
                </div>
                </form>
              </div>
            </OperationsDialog>
          )}
        </section>
      )}
      </div>
      </>}
    </section>
  );
}

export function ReportsWorkspace({ providerId }: { providerId: string }) {
  const [dashboard, setDashboard] =
    useState<ProviderOperationsDashboard | null>(null);
  const [jobs, setJobs] = useState<Collection<GenericAttributes> | null>(null);
  const [reports, setReports] = useState<Resource<GenericAttributes>[]>([]);
  const [schedules, setSchedules] = useState<Resource<GenericAttributes>[]>([]);
  const [exports, setExports] = useState<Resource<GenericAttributes>[]>([]);
  const [selected, setSelected] = useState<Resource<GenericAttributes> | null>(
    null,
  );
  const [preview, setPreview] = useState<Array<Record<string, unknown>> | null>(
    null,
  );
  const [tab, setTab] = useState<
    "overview" | "builder" | "schedules" | "exports"
  >("overview");
  const [reportEditorOpen, setReportEditorOpen] = useState(false);
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);
  const [exportEditorOpen, setExportEditorOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("CSV");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const read = (
    row: Resource<GenericAttributes> | null,
    key: string,
    fallback = "",
  ) => String(row?.attributes[key] ?? fallback);
  const reloadReports = async () => {
    const result = await operationsData.providerReports(providerId);
    setReports(result.data || []);
    setSchedules(result.schedules || []);
    setExports(result.exports || []);
  };
  useEffect(() => {
    Promise.all([
      operationsData.providerOperationsDashboard(providerId),
      operationsData.jobs(providerId),
      operationsData.providerReports(providerId),
    ])
      .then(([summary, jobRows, result]) => {
        setDashboard(summary);
        setJobs(jobRows as Collection<GenericAttributes>);
        setReports(result.data || []);
        setSchedules(result.schedules || []);
        setExports(result.exports || []);
      })
      .catch((cause) => setError(fail(cause)));
  }, [providerId]);
  async function saveReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const body = {
        name: String(form.get("name")),
        category: String(form.get("category")),
        dimensions: form.getAll("dimensions").map(String),
        measures: form.getAll("measures").map(String),
        filters: {},
      };
      const saved = selected
        ? await operationsData.updateProviderReport(
            providerId,
            selected.id,
            {
              ...body,
              expected_revision: Number(read(selected, "revision", "0")),
            },
            crypto.randomUUID(),
          )
        : await operationsData.createProviderReport(
            providerId,
            body,
            crypto.randomUUID(),
          );
      setSelected(saved);
      setReportEditorOpen(false);
      setMessage(
        selected ? "Report definition updated." : "Report definition created.",
      );
      await reloadReports();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  async function requestExport(format: string) {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await operationsData.exportProviderReport(
        providerId,
        selected.id,
        format,
        {},
        crypto.randomUUID(),
      );
      setMessage(`${format} export queued. Track progress in Export history.`);
      setExportEditorOpen(false);
      await reloadReports();
      setTab("exports");
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await operationsData.createProviderReportSchedule(
        providerId,
        {
          report_id: selected.id,
          frequency: String(form.get("frequency")),
          format: String(form.get("format")),
          recipient_emails: String(form.get("recipients"))
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        },
        crypto.randomUUID(),
      );
      setMessage(
        "Scheduled report saved. Delivery uses an authorized private download link.",
      );
      setScheduleEditorOpen(false);
      await reloadReports();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  async function toggleSchedule(schedule: Resource<GenericAttributes>) {
    setBusy(true);
    setError("");
    try {
      await operationsData.updateProviderReportSchedule(
        providerId,
        schedule.id,
        {
          enabled: read(schedule, "enabled") !== "true",
          expected_revision: Number(read(schedule, "revision", "0")),
        },
        crypto.randomUUID(),
      );
      await reloadReports();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  async function runScheduleNow(schedule: Resource<GenericAttributes>) {
    setBusy(true);
    setError("");
    try {
      await operationsData.runProviderReportSchedule(
        providerId,
        schedule.id,
        crypto.randomUUID(),
      );
      setMessage(
        "Scheduled report execution queued. Track it in Export history.",
      );
      await reloadReports();
      setTab("exports");
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  async function downloadExport(item: Resource<GenericAttributes>) {
    setBusy(true);
    setError("");
    try {
      const transfer = await operationsData.downloadProviderReportExport(
        providerId,
        item.id,
      );
      if (transfer.url) {
        const anchor = document.createElement("a");
        anchor.href = transfer.url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
      } else if (transfer.blob) {
        const url = URL.createObjectURL(transfer.blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${read(item, "category", "report").toLowerCase()}-report.${read(item, "format", "csv").toLowerCase()}`;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
      setMessage("Authorized report download started.");
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content feature-page reports-workspace">
      <PageHeader
        title="Reports & analytics"
        description="Provider-scoped operational reporting, bounded previews, private exports and scheduled delivery."
      />
      {error && (
        <div className="feature-error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      <nav className="subnav" aria-label="Reports workspace">
        <Button
          variant={tab === "overview" ? "primary" : "quiet"}
          onClick={() => setTab("overview")}
        >
          Overview
        </Button>
        <Button
          variant={tab === "builder" ? "primary" : "quiet"}
          onClick={() => setTab("builder")}
        >
          Custom report builder
        </Button>
        <Button
          variant={tab === "schedules" ? "primary" : "quiet"}
          onClick={() => setTab("schedules")}
        >
          Scheduled reports
        </Button>
        <Button
          variant={tab === "exports" ? "primary" : "quiet"}
          onClick={() => setTab("exports")}
        >
          Export history
        </Button>
      </nav>
      {tab === "overview" && (
        <>
          {!dashboard && !error && (
            <p className="notice">Loading authorized analytics…</p>
          )}
          {dashboard && (
            <>
              <div className="reports-kpi-grid">
                {([
                  ["Leads", dashboard.attributes.counts.leads, "L"],
                  ["Stage payments due", dashboard.attributes.counts.open_payment_schedules, "₹"],
                  ["Active jobs", dashboard.attributes.counts.active_jobs, "J"],
                  ["AMC renewals due", dashboard.attributes.counts.amc_renewals_due, "A"],
                ] as const).map(
                  ([title, value, icon]) => (
                    <article className="reports-kpi-card" key={title}>
                      <span className="reports-kpi-icon" aria-hidden="true">{icon}</span>
                      <div><span>{title}</span>
                      <strong>{String(value)}</strong></div>
                    </article>
                  ),
                )}
              </div>
              <div className="reports-overview-grid">
                <section className="detail-card reports-panel">
                  <h3>Stage payment activity</h3><p className="notice">Project payment obligations from the authorized provider dashboard.</p>
                  {dashboard.attributes.payment_stage_rows.length ? <div className="reports-table-wrap"><table className="reports-table"><thead><tr><th>Project / stage</th><th>Due</th><th>Status</th></tr></thead><tbody>{dashboard.attributes.payment_stage_rows.slice(0, 6).map((stage) => <tr key={stage.id}><td><strong>{stage.project_title || stage.milestone_code}</strong><small>{stage.description}</small></td><td>{stage.currency_code} {stage.amount}</td><td><Status>{stage.status}</Status></td></tr>)}</tbody></table></div> : <EmptyState title="No payment stages returned" description="Stage obligations will appear when available in the authorized dashboard data." />}
                </section>
                <section className="detail-card reports-panel">
                  <h3>Operational outcome</h3><p className="notice">Live workload indicators; not modeled as historical trend data.</p>
                  <div className="reports-health-list">
                    <div><span>Technicians available</span><strong>{dashboard.attributes.technician_availability.available} / {dashboard.attributes.technician_availability.total}</strong></div>
                    <div><span>On-site</span><strong>{dashboard.attributes.technician_availability.on_site}</strong></div>
                    <div><span>Open escalations</span><strong>{dashboard.attributes.counts.escalations}</strong></div>
                    <div><span>Today's appointments</span><strong>{dashboard.attributes.counts.todays_appointments}</strong></div>
                  </div>
                  <div className="reports-panel-divider"><h4>Recent audit activity</h4>
                    {dashboard.attributes.recent_audit.length ? dashboard.attributes.recent_audit.slice(0, 5).map((entry) => <article className="reports-audit-row" key={entry.id}><Status>{entry.action}</Status><span>{entry.resource_kind || "Operational event"}</span><time>{entry.occurred_at ? formatIndiaDateTime(entry.occurred_at) : "Time not supplied"}</time></article>) : <p className="notice">No recent provider audit activity.</p>}
                  </div>
                </section>
              </div>
            </>
          )}
          {jobs && (
            <section className="detail-card reports-panel reports-job-source">
              <div><h3>Job report sources</h3><p>Execution evidence and persisted service reports remain available in Jobs.</p></div>
              <div><strong>{jobs.data.length}</strong><span>authorized jobs in the current result page</span><Button variant="secondary" onClick={() => { window.location.hash = "jobs"; }}>Open Jobs</Button></div>
            </section>
          )}
        </>
      )}
      {tab === "builder" && (
        <section className="detail-card reports-panel">
          <div className="reports-section-heading"><div><h3>Custom report builder</h3><p>Build provider-scoped reports from server-allowlisted dimensions and measures.</p></div><Button onClick={() => { setSelected(null); setReportEditorOpen(true); }}>Create report</Button></div>
          {reports.length ? <div className="reports-definition-grid">{reports.map((report) => <article className="reports-definition-card" key={report.id}>
            <div className="reports-definition-title"><Status>{read(report, "category")}</Status><span>Revision {read(report, "revision")}</span></div>
            <h4>{read(report, "name")}</h4>
            <p>{String(report.attributes.dimensions || "No dimensions")}</p>
            <div className="reports-actions">
              <Button variant="secondary" onClick={() => { setSelected(report); setPreview(null); setReportEditorOpen(true); }}>Edit</Button>
              <Button variant="secondary" busy={busy} onClick={() => { setSelected(report); void operationsData.previewProviderReport(providerId, report.id).then((result) => { setPreview(result.data); setMessage(`Preview loaded: ${result.meta.row_count} rows available; maximum ${result.meta.limit} shown.`); }).catch((cause) => setError(fail(cause))); }}>Preview</Button>
              <Button variant="secondary" onClick={() => { setSelected(report); setExportEditorOpen(true); }}>Export</Button>
              <Button variant="quiet" onClick={() => { setSelected(report); setScheduleEditorOpen(true); setTab("schedules"); }}>Schedule</Button>
            </div>
          </article>)}</div> : <EmptyState title="No saved report definitions" description="Create a report definition to preview data, queue exports, or schedule delivery." />}
          {preview && <div className="reports-preview"><h4>Bounded preview</h4><pre>{JSON.stringify(preview, null, 2)}</pre></div>}
        </section>
      )}
      {tab === "schedules" && (
        <section className="detail-card reports-panel">
          <div className="reports-section-heading"><div><h3>Scheduled reports</h3><p>Manage recurring provider-scoped exports and delivery history.</p></div><Button disabled={!reports.length} onClick={() => { setSelected(reports[0] || null); setScheduleEditorOpen(true); }}>New schedule</Button></div>
          {!reports.length && <p className="notice">Create a report definition before scheduling delivery.</p>}
          {schedules.map((schedule) => (
            <article className="record-card" key={schedule.id}>
              <Status>{read(schedule, "status")}</Status>
              <strong>
                {read(schedule, "frequency")} · {read(schedule, "format")}
              </strong>
              <span>{read(schedule, "recipient_emails")}</span>
              <small>
                Next: {read(schedule, "next_run_at", "Not scheduled")} · Last:{" "}
                {read(schedule, "last_run_at", "Not run")}
              </small>
              {read(schedule, "enabled") === "true" && (
                <Button
                  variant="secondary"
                  busy={busy}
                  onClick={() => void runScheduleNow(schedule)}
                >
                  Run now
                </Button>
              )}
              <Button
                variant="secondary"
                busy={busy}
                onClick={() => void toggleSchedule(schedule)}
              >
                {read(schedule, "enabled") === "true" ? "Pause" : "Resume"}
              </Button>
            </article>
          ))}
        </section>
      )}
      {tab === "exports" && (
        <section className="detail-card reports-panel">
          <h3>Export history</h3>
          {exports.length ? (
            exports.map((item) => (
              <article className="record-card" key={item.id}>
                <Status>{read(item, "status")}</Status>
                <strong>
                  {read(item, "category")} · {read(item, "format")}
                </strong>
                <span>
                  {read(item, "failure_reason", "No failure recorded")}
                </span>
                {read(item, "status") === "COMPLETED" && (
                  <Button
                    variant="secondary"
                    busy={busy}
                    onClick={() => void downloadExport(item)}
                  >
                    Download
                  </Button>
                )}
              </article>
            ))
          ) : (
            <EmptyState
              title="No exports yet"
              description="Queued and completed provider-scoped exports will appear here."
            />
          )}
        </section>
      )}
      {reportEditorOpen && <OperationsDialog title={selected ? "Edit report definition" : "Create report definition"} busy={busy} onClose={() => setReportEditorOpen(false)}>
        <form className="reports-editor-form" onSubmit={(event) => void saveReport(event)}>
          <p className="notice">Only server-allowlisted dimensions and measures are accepted.</p>
          <label>Report name *<input name="name" required defaultValue={read(selected, "name")} /></label>
          <label>Category *<select name="category" defaultValue={read(selected, "category", "PROJECTS")}><option>LEADS</option><option>PROJECTS</option><option>PAYMENTS</option><option>MATERIALS</option><option>SERVICE_REQUESTS</option><option>JOBS</option><option>WORKFORCE</option><option>ASSETS</option><option>AMC</option></select></label>
          <fieldset className="report-allowlist-picker" aria-label="Dimensions"><legend>Dimensions</legend>{[["status", "Status"], ["provider_created_at", "Created date"], ["customer", "Customer"], ["project", "Project"], ["stage", "Stage"], ["technician", "Technician"]].map(([value, title]) => <label key={value}><input type="checkbox" name="dimensions" value={value} defaultChecked={Array.isArray(selected?.attributes.dimensions) ? (selected!.attributes.dimensions as string[]).includes(value) : value === "status" || value === "project"} />{title}</label>)}</fieldset>
          <fieldset className="report-allowlist-picker" aria-label="Measures"><legend>Measures</legend>{[["count", "Record count"], ["amount", "Amount"], ["outstanding", "Outstanding"], ["duration", "Duration"]].map(([value, title]) => <label key={value}><input type="checkbox" name="measures" value={value} defaultChecked={Array.isArray(selected?.attributes.measures) ? (selected!.attributes.measures as string[]).includes(value) : value === "count"} />{title}</label>)}</fieldset>
          <div className="reports-actions"><Button type="button" variant="quiet" onClick={() => setReportEditorOpen(false)}>Cancel</Button><Button type="submit" busy={busy}>{selected ? "Update report" : "Save report"}</Button></div>
        </form>
      </OperationsDialog>}
      {scheduleEditorOpen && selected && <OperationsDialog title={`Schedule · ${read(selected, "name")}`} busy={busy} onClose={() => setScheduleEditorOpen(false)}>
        <form className="reports-editor-form" onSubmit={(event) => void saveSchedule(event)}>
          <label>Saved report *<select value={selected?.id || ""} required onChange={(event) => setSelected(reports.find((report) => report.id === event.target.value) || null)}><option value="">Select a saved report</option>{reports.map((report) => <option key={report.id} value={report.id}>{read(report, "name")}</option>)}</select></label>
          <label>Frequency<select name="frequency" defaultValue="WEEKLY"><option>DAILY</option><option>WEEKLY</option><option>MONTHLY</option></select></label>
          <label>Format<select name="format" defaultValue="CSV"><option>CSV</option><option>XLSX</option><option>PDF</option></select></label>
          <label>Authorized recipients *<input name="recipients" required placeholder="recipient@example.test" /></label>
          <p className="notice">Recipients must be authorized for this provider. Delivery uses an expiring private download link.</p>
          <div className="reports-actions"><Button type="button" variant="quiet" onClick={() => setScheduleEditorOpen(false)}>Cancel</Button><Button type="submit" busy={busy}>Create schedule</Button></div>
        </form>
      </OperationsDialog>}
      {exportEditorOpen && selected && <OperationsDialog title={`Export · ${read(selected, "name")}`} busy={busy} onClose={() => setExportEditorOpen(false)}>
        <div className="reports-editor-form"><label>File format<select value={exportFormat} onChange={(event) => setExportFormat(event.target.value)}><option>CSV</option><option>XLSX</option><option>PDF</option></select></label><div className="reports-actions"><Button variant="quiet" onClick={() => setExportEditorOpen(false)}>Cancel</Button><Button busy={busy} onClick={() => void requestExport(exportFormat)}>Queue export</Button></div></div>
      </OperationsDialog>}
    </section>
  );
}

import { FormEvent, useEffect, useState } from "react";
import { Button, PageHeader } from "@trise/ui";
import {
  operationsData,
  type Collection,
  type GenericAttributes,
  type ProviderOperationsDashboard,
  type ProviderWorkJourney,
  type Resource,
} from "./data";
import { OperationsStatus as Status } from "./operations-status";
import { EmptyState, ProviderActionMenu } from "./operations-shared";
import { OperationsDialog } from "./operations-dialog";
import { formatIndiaDate, formatIndiaDateTime } from "./subscription-support";
import { WorkflowFollowUpAction, WorkflowFollowUpDialog } from "./workflow-follow-ups";
import {
  JourneyTimelineDialog,
  WorkflowChainAction,
} from "./provider-journey-timeline";
import { SvgIcon } from "./icons";

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

const objectRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const money = (value: unknown, currency = "INR") => {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(number)
    : "—";
};
const invoiceDate = (value: unknown) => value ? formatIndiaDate(String(value)) : "—";

function ProviderAmcBilling({ providerId, contractId, canManage }: { providerId: string; contractId: string; canManage: boolean }) {
  const [invoices, setInvoices] = useState<(Collection<GenericAttributes> & { summary?: { total: number; outstanding_amount: string; overdue: number; paid: number } }) | null>(null);
  const [selected, setSelected] = useState<Resource<GenericAttributes> | null>(null);
  const [payments, setPayments] = useState<Resource<GenericAttributes>[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function reload() {
    setError("");
    const result = await operationsData.providerCustomerInvoices(providerId, undefined, contractId);
    setInvoices(result);
    if (selected) {
      const refreshed = result.data.find((item) => item.id === selected.id);
      if (refreshed) setSelected(await operationsData.providerCustomerInvoice(providerId, refreshed.id));
    }
  }
  useEffect(() => { void reload().catch((cause) => setError(fail(cause))); }, [providerId, contractId]);
  useEffect(() => {
    if (!selected) { setPayments([]); return; }
    void operationsData.providerCustomerInvoicePayments(providerId, selected.id)
      .then((result) => setPayments(result.data || []))
      .catch((cause) => setError(fail(cause)));
  }, [providerId, selected?.id]);

  async function createInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      await operationsData.createProviderCustomerInvoice(providerId, {
        contract_id: contractId,
        billing_period_start: String(form.get("billing_period_start")),
        billing_period_end: String(form.get("billing_period_end")),
        due_at: new Date(`${String(form.get("due_at"))}T23:59:59`).toISOString(),
        period_months: Number(form.get("period_months") || 12),
        tax_rate_percent: Number(form.get("tax_rate_percent") || 0),
        tax_label: String(form.get("tax_label") || "GST"),
        notes: String(form.get("notes") || ""),
      }, crypto.randomUUID());
      setCreateOpen(false); setMessage("AMC invoice draft created. Review the per-elevator lines before issuing."); await reload();
    } catch (cause) { setError(fail(cause)); } finally { setBusy(false); }
  }
  async function issueInvoice(invoice: Resource<GenericAttributes>) {
    setBusy(true); setError("");
    try { await operationsData.issueProviderCustomerInvoice(providerId, invoice.id, { expected_revision: Number(invoice.attributes.revision) }, crypto.randomUUID()); setMessage("Invoice issued to the customer."); await reload(); setSelected(await operationsData.providerCustomerInvoice(providerId, invoice.id)); }
    catch (cause) { setError(fail(cause)); } finally { setBusy(false); }
  }
  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    const form = new FormData(event.currentTarget); setBusy(true); setError("");
    try {
      await operationsData.createProviderCustomerInvoicePayment(providerId, selected.id, {
        amount: Number(form.get("amount")), payment_reference: String(form.get("payment_reference")), method: String(form.get("method")),
        instrument_reference: String(form.get("instrument_reference") || ""),
      }, crypto.randomUUID());
      setPaymentOpen(false); setMessage("Payment evidence recorded. Online and UPI evidence remains pending finance verification."); await reload(); setSelected(await operationsData.providerCustomerInvoice(providerId, selected.id));
    } catch (cause) { setError(fail(cause)); } finally { setBusy(false); }
  }
  async function transitionPayment(payment: Resource<GenericAttributes>, transition: "SETTLED" | "BOUNCED" | "REVERSED") {
    if (!selected) return; setBusy(true); setError("");
    try {
      await operationsData.transitionProviderCustomerInvoicePayment(providerId, selected.id, payment.id, { transition, expected_revision: Number(payment.attributes.revision), reason: `${transition} recorded from the AMC billing workspace.` }, crypto.randomUUID());
      setMessage(`Payment marked ${transition.toLowerCase()}.`); await reload(); setSelected(await operationsData.providerCustomerInvoice(providerId, selected.id));
    } catch (cause) { setError(fail(cause)); } finally { setBusy(false); }
  }
  const selectedAttributes = selected?.attributes || {};
  const lines = Array.isArray(selectedAttributes.lines) ? selectedAttributes.lines.map(objectRecord) : [];
  return <section className="amc-billing-workspace">
    {error && <div className="feature-error" role="alert">{error}</div>}
    {message && <div className="notice" role="status">{message}</div>}
    <div className="amc-billing-head"><div><span className="page-eyebrow">Provider → customer billing</span><h3>AMC invoices &amp; payments</h3><p>One invoice per contract period, with a transparent line for every covered elevator and selected plan.</p></div>{canManage && <Button onClick={() => setCreateOpen(true)}><SvgIcon name="plus" size={15} /> Create invoice draft</Button>}</div>
    <div className="amc-billing-summary"><div><span>Invoices</span><strong>{invoices?.summary?.total ?? "—"}</strong></div><div><span>Outstanding</span><strong>{money(invoices?.summary?.outstanding_amount)}</strong></div><div><span>Overdue</span><strong>{invoices?.summary?.overdue ?? "—"}</strong></div><div><span>Paid</span><strong>{invoices?.summary?.paid ?? "—"}</strong></div></div>
    <div className="amc-billing-grid">
      <section className="detail-card"><div className="section-heading"><div><h4>Contract billing history</h4><p>Issued and draft invoices stay linked to this AMC contract.</p></div><span>{invoices?.data.length || 0} records</span></div>{invoices?.data.length ? <div className="amc-invoice-list">{invoices.data.map((invoice) => <button type="button" key={invoice.id} className={`amc-invoice-row ${selected?.id === invoice.id ? "is-selected" : ""}`} onClick={() => void operationsData.providerCustomerInvoice(providerId, invoice.id).then(setSelected).catch((cause) => setError(fail(cause)))}><span><strong>{String(invoice.attributes.invoice_number || invoice.id.slice(0, 8))}</strong><small>{invoiceDate(invoice.attributes.billing_period_start)} → {invoiceDate(invoice.attributes.billing_period_end)}</small></span><span><Status>{String(invoice.attributes.status || "DRAFT")}</Status><strong>{money(invoice.attributes.total_amount, String(invoice.attributes.currency_code || "INR"))}</strong></span></button>)}</div> : <EmptyState title="No AMC invoices yet" description="Create a draft after the contract has been activated and its elevator plan snapshots are ready." />}</section>
      <section className="detail-card amc-invoice-detail">{selected ? <><div className="section-heading"><div><Status>{String(selectedAttributes.status || "DRAFT")}</Status><h4>{String(selectedAttributes.invoice_number || "AMC invoice")}</h4><p>Due {invoiceDate(selectedAttributes.due_at)} · {String(selectedAttributes.collection_state || "CURRENT")}</p></div><strong className="amc-invoice-total">{money(selectedAttributes.total_amount, String(selectedAttributes.currency_code || "INR"))}</strong></div><div className="amc-invoice-kpis"><span>Subtotal <strong>{money(selectedAttributes.subtotal_amount)}</strong></span><span>Tax <strong>{money(selectedAttributes.tax_amount)}</strong></span><span>Paid <strong>{money(selectedAttributes.amount_paid)}</strong></span><span>Balance <strong>{money(selectedAttributes.outstanding_amount)}</strong></span></div><div className="amc-invoice-actions">{canManage && String(selectedAttributes.status) === "DRAFT" && <Button disabled={busy} onClick={() => void issueInvoice(selected)}>Issue invoice</Button>}{canManage && ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(String(selectedAttributes.status)) && <Button variant="secondary" disabled={busy} onClick={() => setPaymentOpen(true)}>Record payment</Button>}</div><div className="amc-invoice-lines"><h5>Elevator plan lines</h5>{lines.length ? lines.map((line, index) => <article key={String(line.contract_asset_scope_id || index)}><div><strong>{String(line.asset_display_name || `Elevator ${index + 1}`)}</strong><span>{String(line.plan_name || line.plan_code || "AMC plan")} · v{String(line.plan_version || "—")}</span></div><strong>{money(line.line_total, String(line.currency_code || "INR"))}</strong></article>) : <p className="notice">No line snapshot was returned.</p>}</div><div className="amc-invoice-payments"><h5>Payment evidence</h5>{payments.length ? payments.map((payment) => <article key={payment.id}><div><Status>{String(payment.attributes.status || "RECEIVED")}</Status><strong>{String(payment.attributes.payment_reference || "Payment")}</strong><span>{String(payment.attributes.method || "—").replaceAll("_", " ")}</span></div><div><strong>{money(payment.attributes.amount, String(payment.attributes.currency_code || "INR"))}</strong>{canManage && ["RECEIVED", "PENDING_VERIFICATION"].includes(String(payment.attributes.status)) && <Button variant="quiet" disabled={busy} onClick={() => void transitionPayment(payment, "SETTLED")}>Verify settlement</Button>}</div></article>) : <p className="notice">No payment evidence recorded.</p>}</div></> : <EmptyState title="Select an invoice" description="The detail panel shows the frozen community elevator lines, tax snapshot and payment evidence." />}</section>
    </div>
    {createOpen && <OperationsDialog title="Create AMC invoice draft" busy={busy} onClose={() => setCreateOpen(false)}><form className="quotation-modal-form" onSubmit={(event) => void createInvoice(event)}><p className="notice">The server reads the active contract elevator scopes and generates one line per elevator. Repeating the same period returns the existing invoice.</p><label>Billing period start *<input name="billing_period_start" type="date" required /></label><label>Billing period end *<input name="billing_period_end" type="date" required /></label><label>Due date *<input name="due_at" type="date" required /></label><label>Period months<select name="period_months" defaultValue="12"><option value="12">12 months</option><option value="6">6 months</option><option value="3">3 months</option><option value="1">1 month</option></select></label><label>Tax rate %<input name="tax_rate_percent" type="number" min="0" max="100" step="0.01" defaultValue="0" /></label><label>Tax label<input name="tax_label" defaultValue="GST" /></label><label>Notes<textarea name="notes" maxLength={2000} /></label><div className="provider-form-actions"><Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" busy={busy}>Create draft</Button></div></form></OperationsDialog>}
    {paymentOpen && selected && <OperationsDialog title={`Record payment · ${String(selectedAttributes.invoice_number || "AMC invoice")}`} busy={busy} onClose={() => setPaymentOpen(false)}><form className="quotation-modal-form" onSubmit={(event) => void recordPayment(event)}><label>Amount *<input name="amount" type="number" min="0.01" step="0.01" max={String(selectedAttributes.outstanding_amount || "")} required /></label><label>Payment reference *<input name="payment_reference" required /></label><label>Method<select name="method" defaultValue="BANK_TRANSFER"><option value="BANK_TRANSFER">Bank transfer</option><option value="UPI">UPI</option><option value="ONLINE">Online</option><option value="CHEQUE">Cheque</option><option value="CASH">Cash</option></select></label><label>Instrument reference<input name="instrument_reference" /></label><div className="provider-form-actions"><Button type="button" variant="secondary" onClick={() => setPaymentOpen(false)}>Cancel</Button><Button type="submit" busy={busy}>Record evidence</Button></div></form></OperationsDialog>}
  </section>;
}

// This workspace is mounted only when the server-projected provider `projects`
// capability grants access. Every mutating request is still authorized server-side.
export function ProviderPrograms({ providerId, canManage = true, canConfigure = false, route }: { providerId: string; canManage?: boolean; canConfigure?: boolean; route?: { id?: string } }) {
  type ContractPage = Collection<GenericAttributes> & { summary?: { active_contracts: number; preventive_visits_due: number; renewals_due_this_month: number; covered_assets: number } };
  type ContractTab = "coverage" | "schedule" | "visits" | "renewals" | "billing";
  const [contracts, setContracts] = useState<ContractPage | null>(null);
  const [selected, setSelected] = useState<Resource<GenericAttributes> | null>(
    null,
  );
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [journey, setJourney] = useState<ProviderWorkJourney | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [journeyError, setJourneyError] = useState("");
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
      const routedContract = route?.id
        ? result.data.find((contract) => contract.id === route.id)
        : null;
      if (routedContract && selected?.id !== routedContract.id) {
        await open(routedContract);
      }
    } finally { setLoading(false); }
  }
  useEffect(() => {
    reload().catch((cause) => setError(fail(cause)));
  }, [providerId, search, statusFilter, limit, after, before, expiryFilter, route?.id]);
  useEffect(() => {
    if (!selected) {
      setJourney(null);
      setJourneyError("");
      setJourneyLoading(false);
      return;
    }
    let active = true;
    setJourney(null);
    setJourneyError("");
    setJourneyLoading(true);
    void operationsData.providerWorkJourneyForResource(
      providerId,
      "MaintenanceContract",
      selected.id,
    )
      .then((value) => { if (active) setJourney(value); })
      .catch((cause) => { if (active) setJourneyError(fail(cause)); })
      .finally(() => { if (active) setJourneyLoading(false); });
    return () => { active = false; };
  }, [providerId, selected?.id]);
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
  const contractStatus = selected ? String(selected.attributes.status || "").toUpperCase() : "";
  const contractAbandoned = ["CANCELLED", "TERMINATED"].includes(contractStatus);
  const contractExpired = contractStatus === "EXPIRED";
  const contractConcluded = ["CANCELLED", "TERMINATED", "EXPIRED", "COMPLETED", "CLOSED"].includes(contractStatus);
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
          <div className="amc-workspace amc-workspace--full">
          <div className="amc-register-panel">
            <div className="section-heading"><div><h3>AMC contracts</h3><p>Provider-scoped contract register · filters and page size are applied by the API.</p></div><label className="amc-page-size">Rows per page<select aria-label="Rows per page" value={limit} onChange={(event) => { setSelected(null); setLimit(Number(event.target.value)); setAfter(""); setBefore(""); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label></div>
            {contracts.data.length ? <div className="amc-table-wrap"><table className="amc-contract-table" aria-label="AMC contracts"><thead><tr><th>Contract No.</th><th>Customer</th><th>Assets</th><th>Plan</th><th>Expiry date</th><th>Status</th><th>Renewal</th><th>Actions</th></tr></thead><tbody>{contracts.data.map((contract) => { const expiry = contract.attributes.effective_to; const remaining = expiry ? Math.ceil((new Date(String(expiry)).getTime() - Date.now()) / 86400000) : null; return <tr key={contract.id} aria-current={selected?.id === contract.id ? "true" : undefined}><td><strong>{String(contract.attributes.contract_number || label(contract.attributes))}</strong></td><td>{String(contract.attributes.customer_name || "Authorized customer")}</td><td>{String(contract.attributes.asset_count ?? "—")}</td><td>{String(contract.attributes.plan_code || "Service plan")}</td><td>{date(expiry)}</td><td><Status>{String(contract.attributes.status || "VISIBLE")}</Status></td><td>{remaining !== null && remaining <= 90 ? remaining <= 0 ? "Expired" : `${remaining} days` : "Not due"}</td><td><ProviderActionMenu label={`Actions for contract ${String(contract.attributes.contract_number || contract.id.slice(0, 8))}`} actions={[{ id: 'view', label: 'View', onSelect: () => void open(contract) }]} /></td></tr>; })}</tbody></table></div> : <EmptyState title={loading ? "Loading contracts" : "No maintenance contracts"} description={loading ? "Loading the selected provider's authorized contracts." : "No contracts match these server-side filters. New AMC creation remains governed by quotation conversion."} />}
            <div className="server-pagination"><span>Showing {contracts.data.length} records · {limit} per page</span><div><Button variant="secondary" disabled={!contracts.page?.previous || loading} onClick={() => { setAfter(""); setBefore(contracts.page?.previous || ""); }}>Previous</Button><Button variant="secondary" disabled={!contracts.page?.next || loading} onClick={() => { setBefore(""); setAfter(contracts.page?.next || ""); }}>Next</Button></div></div>
          </div>
      
      {selected && (
        <OperationsDialog title={String(selected.attributes.contract_number || label(selected.attributes))} onClose={() => setSelected(null)} className="amc-detail-dialog">
        <section className="amc-detail-panel">
          <div className="amc-detail-heading"><div><Status>{String(selected.attributes.status || "VISIBLE")}</Status><h2>{String(selected.attributes.contract_number || label(selected.attributes))}</h2><p>{String(selected.attributes.customer_name || "Authorized customer")} · Revision {String(selected.attributes.revision || "server-managed")}</p></div><div className="amc-detail-dates"><span>Effective {date(selected.attributes.effective_from)}</span><strong>Expires {date(selected.attributes.effective_to)}</strong></div>{contractConcluded && <div className={`workflow-concluded-inline${contractAbandoned ? ' workflow-concluded-inline--abandoned' : ''}${contractExpired ? ' workflow-concluded-inline--expired' : ''}`} role="status"><span className="workflow-concluded-inline-icon" aria-hidden="true"><SvgIcon name={contractAbandoned ? 'x' : 'shield'} size={14} /></span><span className="workflow-concluded-inline-copy"><strong>{contractAbandoned ? 'Journey abandoned — read-only' : contractExpired ? 'Contract expired — read-only' : 'Workflow concluded — read-only'}</strong><small>{contractAbandoned ? 'No further updates or downstream actions are allowed.' : contractExpired ? 'Contract expired and is retained for history.' : 'Contract is concluded and retained for history.'}</small></span></div>}</div>
          <div className="amc-detail-stats"><div><strong>{String(selected.attributes.asset_count ?? activeScopes.length)}</strong><span>Covered assets</span></div><div><strong>{String(selected.attributes.plan_code || "—")}</strong><span>Service plan</span></div><div><strong>v{String(selected.attributes.version || 1)}</strong><span>Contract version</span></div><div><strong>{String(iterations?.data.length ?? "—")}</strong><span>Maintenance iterations</span></div></div>
          <div className="provider-form-actions amc-actions">
            <WorkflowFollowUpAction providerId={providerId} targetResourceKind="MaintenanceContract" targetResourceId={selected.id} onClick={() => setFollowUpOpen(true)} />
            <Button variant="secondary" className="workflow-timeline-action" onClick={() => setTimelineOpen(true)} title="View timeline and audit history"><SvgIcon name="activity" size={15} /> Timeline</Button>
            <WorkflowChainAction journey={journey} loading={journeyLoading} currentResourceKind="MaintenanceContract" currentResourceId={selected.id} />
          {canManage && <>
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
          </>}
          </div>
          <div className="lifecycle-tabs amc-tabs workflow-detail-tabs" role="tablist" aria-label="AMC contract detail sections">{(["coverage", "schedule", "visits", "renewals", "billing"] as ContractTab[]).map((item) => <button type="button" role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>
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
                  String(iteration.attributes.status || "").toUpperCase(),
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
                  String(iteration.attributes.status || "").toUpperCase(),
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
          {tab === "billing" && <><ProviderAmcBilling providerId={providerId} contractId={selected.id} canManage={canManage} /><div className="detail-card"><h3>Service plan and commercial terms</h3><dl className="amc-definition-list"><dt>Plan reference</dt><dd>{selected.relationships?.service_plan ? "Linked service plan" : selected.attributes.amc_plan_count ? `${String(selected.attributes.amc_plan_count)} published AMC plan version(s)` : "Not linked"}</dd><dt>Source quotation</dt><dd>{String(selected.attributes.source_quotation_id || "Not supplied")}</dd><dt>Paid renewal</dt><dd>{selected.attributes.paid_renewal === true ? "Yes" : "No / not marked paid"}</dd><dt>Commercial snapshot</dt><dd>{selected.attributes.commercial_party_snapshot_present === true ? "Captured at activation" : "Not captured"}</dd></dl>{servicePlan && <p className="notice">Service plan details loaded from the authorized API.</p>}</div></>}
          {timelineOpen && <JourneyTimelineDialog journey={journey} loading={journeyLoading} error={journeyError} emptyLabel="No journey events are available for this AMC contract." onClose={() => setTimelineOpen(false)} />}
          <WorkflowFollowUpDialog open={followUpOpen} onClose={() => setFollowUpOpen(false)} providerId={providerId} targetResourceKind="MaintenanceContract" targetResourceId={selected.id} stage="AMC" readOnly={['CANCELLED', 'TERMINATED', 'EXPIRED'].includes(String(selected.attributes.status || '').toUpperCase())} title="AMC journey follow-ups" />
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
        </OperationsDialog>
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

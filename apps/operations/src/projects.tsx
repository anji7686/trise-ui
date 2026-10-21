import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, FilterToolbar, PageHeader } from "@trise/ui";
import { useAuth } from "@trise/auth";
import {
  operationsData,
  type Collection,
  type GenericAttributes,
  type MaterialRequirementAttributes,
  type PaymentScheduleAttributes,
  type ProviderDocumentAttributes,
  type QualityFindingAttributes,
  type Resource,
  type ServiceCaseAttributes,
  type ShipmentAttributes,
} from "./data";
import { OperationsPriority as Priority, OperationsStatus as Status } from "./operations-status";
import { ActionFeedback, EmptyState, ProviderActionMenu } from "./operations-shared";
import { OperationsDialog } from "./operations-dialog";
import { sha256Hex } from "./provider-document-upload";
import { indiaDateTimeToIso } from './subscription-support';
import { accessData } from "./access-data";

const fail = (error: unknown) =>
  (error as { message?: string })?.message ||
  "The request could not be completed.";
const uuid = () => crypto.randomUUID();

export function ProjectsWorkspace({ providerId }: { providerId: string }) {
  const { session } = useAuth();
  const [effectivePermissions, setEffectivePermissions] = useState<string[] | null>(null);
  const [projects, setProjects] =
    useState<Collection<ServiceCaseAttributes> | null>(null);
  const [selected, setSelected] =
    useState<Resource<ServiceCaseAttributes> | null>(null);
  const [error, setError] = useState("");
  const [pageCursor, setPageCursor] = useState<{ after?: string; before?: string }>({});
  const [pageLimit, setPageLimit] = useState(10);
  const [queryText, setQueryText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  useEffect(() => {
    let active = true;
    setEffectivePermissions(null);
    if (!session?.userId) return;
    void accessData.selfEffectivePermissions(providerId).then((preview) => {
      if (active) setEffectivePermissions(preview.data.attributes.membership_active
        ? preview.data.attributes.permissions.filter((permission) => permission.grant_effective).map((permission) => permission.code)
        : []);
    }).catch(() => { if (active) setEffectivePermissions([]); });
    return () => { active = false; };
  }, [providerId, session?.userId]);
  useEffect(() => {
    operationsData
      .serviceCases(providerId, { ...pageCursor, limit: pageLimit, query: queryText.trim() || undefined, status: statusFilter || undefined })
      .then(setProjects)
      .catch((cause) => setError(fail(cause)));
  }, [providerId, pageCursor, pageLimit, queryText, statusFilter]);
  useEffect(() => { setPageCursor({}); setSelected(null); }, [queryText, statusFilter]);
  const visibleProjects = projects?.data || [];
  const canExecuteStages = effectivePermissions?.includes("SERVICE_JOB_EXECUTE") === true;
  return (
    <section className="content feature-page">
      <PageHeader
        title="Installation Projects"
        description="Coordinate project material requirements, shipments and delivery reconciliation."
      />
      {error && (
        <div className="feature-error" role="alert">
          {error}
        </div>
      )}
      {!projects && !error && (
        <p className="notice">Loading authorized projects…</p>
      )}
      {projects && !selected && (
        <>
          <div className="feature-summary-grid project-summary-grid"><div><span>Active projects</span><strong>{projects.data.filter((project) => !['DRAFT', 'CLOSED', 'CANCELLED'].includes(String(project.attributes.status).toUpperCase())).length}</strong><small>Provider-scoped execution</small></div><div><span>Draft projects</span><strong>{projects.data.filter((project) => String(project.attributes.status).toUpperCase() === 'DRAFT').length}</strong><small>Awaiting governed approval</small></div><div><span>Payment schedules</span><strong>{projects.data.filter((project) => Number(project.attributes.payment_schedule_total || 0) > 0).length}</strong><small>Accepted commercial baseline</small></div><div><span>QA / handover</span><strong>{projects.data.filter((project) => ['QA', 'HANDOVER', 'COMPLETED'].includes(String(project.attributes.status).toUpperCase())).length}</strong><small>Stage-gated completion</small></div></div>
          <FilterToolbar resultLabel={`Showing ${visibleProjects.length} of ${projects.data.length} authorized projects`}>
            <label>Search projects<input aria-label="Search projects" placeholder="Search project name or type…" value={queryText} onChange={(event) => setQueryText(event.target.value)} /></label>
            <label>Status<select aria-label="Filter projects by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{['DRAFT', 'OPEN', 'APPROVED', 'ACTIVE', 'IN_PROGRESS', 'INSTALLATION', 'QA', 'HANDOVER', 'COMPLETED', 'CANCELLED', 'CLOSED'].map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          </FilterToolbar>
          {visibleProjects.length ? (
            <div className="project-register-scroll" role="region" aria-label="Projects register" tabIndex={0}>
              <table className="project-register">
                <thead><tr><th scope="col">Project</th><th scope="col">Type</th><th scope="col">Revision</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {visibleProjects.map((project) => (
                    <tr key={project.id}>
                      <td data-label="Project"><strong>{project.attributes.title}</strong></td>
                      <td data-label="Type">{project.attributes.project_classification_key || "Service project"}</td>
                      <td data-label="Revision">{project.attributes.revision}</td>
                      <td data-label="Status"><Status>{project.attributes.status}</Status></td>
                      <td data-label="Actions"><ProviderActionMenu label={`Actions for ${project.attributes.title || project.id.slice(0, 8)}`} actions={[{ id: 'open', label: 'Open project', onSelect: () => setSelected(project) }]} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No installation projects"
              description={projects.data.length ? "Clear the filters or move to another server page." : "Projects created through an accepted commercial workflow appear here."}
            />
          )}
          <div className="server-pagination" aria-label="Project pages"><label className="page-size-control">Rows per page<select aria-label="Project rows per page" value={pageLimit} onChange={(event) => { setPageLimit(Number(event.target.value)); setPageCursor({}); setSelected(null); }}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label><div><Button type="button" variant="secondary" disabled={!projects.page?.previous} onClick={() => { setSelected(null); setPageCursor({ before: projects.page?.previous || undefined }); }}>Previous</Button><Button type="button" disabled={!projects.page?.next} onClick={() => { setSelected(null); setPageCursor({ after: projects.page?.next || undefined }); }}>Next</Button></div></div>
        </>
      )}
      {selected && (
        <ProjectDetail
          providerId={providerId}
          project={selected}
          permissions={effectivePermissions || []}
          canExecuteStages={canExecuteStages}
          back={() => setSelected(null)}
          onSaved={setSelected}
        />
      )}
    </section>
  );
}

function ProjectEditForm({ providerId, project, onSaved }: { providerId: string; project: Resource<ServiceCaseAttributes>; onSaved: (project: Resource<ServiceCaseAttributes>) => void }) {
  const editable = ['DRAFT', 'OPEN'].includes(String(project.attributes.status).toUpperCase());
  const [form, setForm] = useState({ title: project.attributes.title, project_classification_key: project.attributes.project_classification_key || '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { setForm({ title: project.attributes.title, project_classification_key: project.attributes.project_classification_key || '' }); }, [project.id, project.attributes.revision]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); setMessage(''); try { const updated = await operationsData.updateServiceCase(providerId, project.id, { ...form, expected_revision: project.attributes.revision }, uuid()); onSaved(updated); setMessage('Project draft updated by the server.'); } catch (cause) { setError(fail(cause)); } finally { setBusy(false); } }
  return <section className="detail-card" aria-label="Edit project draft"><div className="section-heading"><div><h3>Edit project draft</h3><p>Only draft/open project identity fields are editable here. Commercial changes use governed change orders.</p></div><Status>{project.attributes.status}</Status></div>{error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}<form className="provider-form" onSubmit={(event) => void submit(event)}><label>Project name *<input required maxLength={200} disabled={!editable} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Project classification<input maxLength={80} disabled={!editable} value={form.project_classification_key} onChange={(event) => setForm({ ...form, project_classification_key: event.target.value })} /></label><Button type="submit" busy={busy} disabled={!editable}>{editable ? 'Save project draft' : 'Project editing locked by lifecycle'}</Button></form></section>;
}

function ProjectDetail({
  providerId,
  project,
  permissions,
  canExecuteStages,
  back,
  onSaved,
}: {
  providerId: string;
  project: Resource<ServiceCaseAttributes>;
  permissions: string[];
  canExecuteStages: boolean;
  back: () => void;
  onSaved: (project: Resource<ServiceCaseAttributes>) => void;
}) {
  const hasPermission = (code: string) => permissions.includes(code);
  const [orders, setOrders] = useState<Collection<GenericAttributes> | null>(
    null,
  );
  const [payments, setPayments] =
    useState<Collection<GenericAttributes> | null>(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'execution' | 'quality' | 'commercial'>('overview');
  const load = () =>
    Promise.all([
      operationsData.changeOrders(providerId, project.id),
      operationsData.payments(providerId, project.id),
    ])
      .then(([changeOrders, paymentRows]) => {
        setOrders(changeOrders);
        setPayments(paymentRows);
      })
      .catch((cause) => setError(fail(cause)));
  useEffect(() => {
    void load();
  }, [providerId, project.id]);
  const approvedOrders = (orders?.data || []).filter(
    (order) => String(order.attributes.status) === "APPROVED",
  );
  const firstBaseline = approvedOrders[0]?.attributes.baseline as
    { payment_schedule_total?: string } | undefined;
  const baseTotal = Number(
    project.attributes.payment_schedule_total ??
      firstBaseline?.payment_schedule_total ??
      "0",
  );
  const approvedDelta = approvedOrders.reduce(
    (total, order) => total + Number(order.attributes.commercial_delta || 0),
    0,
  );
  const approvedScheduleDays = approvedOrders.reduce(
    (total, order) => total + Number(order.attributes.schedule_delta_days || 0),
    0,
  );
  const currency = String(
    project.attributes.project_currency_code ||
      approvedOrders[0]?.attributes.currency_code ||
      "INR",
  );
  return (
    <>
      <div className="project-detail-toolbar">
        <button className="text-button" onClick={back}>← Projects</button>
        {hasPermission("SERVICE_JOB_EDIT") && ['DRAFT', 'OPEN'].includes(String(project.attributes.status).toUpperCase()) && <Button variant="secondary" onClick={() => setEditDialog(true)}>Edit project</Button>}
      </div>
      <section className="project-detail-heading"><div><h2>{project.attributes.title}</h2><p>{project.attributes.project_classification_key || 'Service project'} · Revision {project.attributes.revision}</p></div><Status>{project.attributes.status}</Status></section>
      <nav className="project-detail-tabs" role="tablist" aria-label="Project work areas">
        {([['overview', 'Overview'], ['execution', 'Stages & execution'], ['quality', 'QA & handover'], ['commercial', 'Commercial']] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={activeTab === key} onClick={() => setActiveTab(key)}>{label}</button>)}
      </nav>
      {activeTab === 'overview' && <LegacyProjectDetailContent providerId={providerId} project={project} permissions={permissions} />}
      {activeTab === 'execution' && <><ProjectJobControl providerId={providerId} project={project} canCreateJob={hasPermission("SERVICE_JOB_EDIT")} /><StagePlanning providerId={providerId} caseId={project.id} projectAssets={project.attributes.project_assets || []} canEditStages={hasPermission("SERVICE_JOB_EDIT")} canExecuteStages={canExecuteStages} /></>}
      {activeTab === 'quality' && <><QualityFindingPanel providerId={providerId} project={project} canEditFindings={hasPermission("SERVICE_JOB_EDIT")} /><HandoverPanel providerId={providerId} project={project} canRequestHandover={hasPermission("SERVICE_JOB_EDIT")} /></>}
      {activeTab === 'commercial' && <>
      <ProjectLifecycleActions providerId={providerId} project={project} permissions={permissions} onSaved={onSaved} />
      <section className="detail-card">
        <div className="section-heading">
          <div>
            <h3>Change orders</h3>
            <p>
              Version project scope, commercial or schedule amendments before
              applying them to delivery.
            </p>
          </div>
          {hasPermission("SERVICE_JOB_EDIT") && <Button variant="secondary" onClick={() => setDialog(true)}>
            Add change order
          </Button>}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {approvedOrders.length > 0 && (
          <div
            className="record-card"
            aria-label="Approved project adjustments"
          >
            <strong>Approved project adjustments</strong>
            <span>
              Original payment schedule total: {baseTotal.toFixed(2)} {currency}
            </span>
            <span>
              Approved commercial delta: +{approvedDelta.toFixed(2)} {currency}
            </span>
            <span>
              Adjusted project total: {(baseTotal + approvedDelta).toFixed(2)}{" "}
              {currency}
            </span>
            <span>
              Approved schedule extension: {approvedScheduleDays} days
            </span>
            <small>
              Issued quotation revisions and original payment schedules remain
              immutable; these are derived approved project adjustments.
            </small>
          </div>
        )}
        {orders?.data.length ? (
          orders.data.map((order) => {
            const baseline = order.attributes.baseline as
              | { payment_schedule_total?: string; stage_count?: number }
              | undefined;
            return (
              <article className="record-card" key={order.id}>
                <Status>{String(order.attributes.status || "DRAFT")}</Status>
                <strong>
                  {String(order.attributes.change_number || order.id)} ·{" "}
                  {String(order.attributes.change_type || "")}
                </strong>
                <span>
                  {String(order.attributes.description || "")} · +
                  {String(order.attributes.commercial_delta || "0")}{" "}
                  {String(order.attributes.currency_code || "INR")} ·{" "}
                  {String(order.attributes.schedule_delta_days || "0")} days
                </span>
                {baseline && (
                  <small>
                    Baseline: payment schedules{" "}
                    {String(baseline.payment_schedule_total || "0")}{" "}
                    {String(order.attributes.currency_code || "INR")} ·{" "}
                    {String(baseline.stage_count || 0)} stages
                  </small>
                )}
                {order.attributes.status === "DRAFT" && hasPermission("SERVICE_JOB_EDIT") && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void operationsData
                        .transitionChangeOrder(
                          providerId,
                          order.id,
                          {
                            expected_revision: order.attributes.revision,
                            transition: "SUBMITTED",
                          },
                          uuid(),
                        )
                        .then(load)
                        .catch((cause) => setError(fail(cause)))
                    }
                  >
                    Submit for approval
                  </Button>
                )}
                {order.attributes.status === "SUBMITTED" && hasPermission("PROJECT_APPROVE") && (
                  <>
                    <small>
                      Awaiting independent approval. The requester cannot
                      approve this change order.
                    </small>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void operationsData
                          .transitionChangeOrder(
                            providerId,
                            order.id,
                            {
                              expected_revision: order.attributes.revision,
                              transition: "APPROVED",
                              reason: "Independent provider approval",
                            },
                            uuid(),
                          )
                          .then(load)
                          .catch((cause) => setError(fail(cause)))
                      }
                    >
                      Approve change order
                    </Button>
                  </>
                )}
              </article>
            );
          })
        ) : (
          <p className="notice">No change orders recorded.</p>
        )}
      </section>
      <section className="detail-card">
        <h3>Payment history</h3>
        {payments?.data.length ? (
          payments.data.map((payment) => (
            <article className="record-card" key={payment.id}>
              <Status>{String(payment.attributes.status || "UNKNOWN")}</Status>
              <strong>
                {String(payment.attributes.payment_reference || payment.id)}
              </strong>
              <span>
                {String(payment.attributes.method || "")} ·{" "}
                {String(payment.attributes.amount || "0")}{" "}
                {String(payment.attributes.currency_code || "")}
              </span>
              {["RECEIVED", "PENDING_VERIFICATION"].includes(
                String(payment.attributes.status),
              ) && hasPermission("PAYMENT_SETTLEMENT_VERIFY") && (
                <>
                  <small>
                    Awaiting an independent verifier; received and
                    online-pending states are not settled collections.
                  </small>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void operationsData
                        .transitionPayment(
                          providerId,
                          payment.id,
                          {
                            expected_revision: payment.attributes.revision,
                            transition: "SETTLED",
                          },
                          uuid(),
                        )
                        .then(load)
                        .catch((cause) => setError(fail(cause)))
                    }
                  >
                    Settle payment
                  </Button>
                </>
              )}
              {payment.attributes.status === "RECEIVED" && hasPermission("PAYMENT_SETTLEMENT_VERIFY") && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    void operationsData
                      .transitionPayment(
                        providerId,
                        payment.id,
                        {
                          expected_revision: payment.attributes.revision,
                          transition: "BOUNCED",
                          reason: "Payment instrument returned unpaid",
                        },
                        uuid(),
                      )
                      .then(load)
                      .catch((cause) => setError(fail(cause)))
                  }
                >
                  Record bounce
                </Button>
              )}
              {payment.attributes.status === "SETTLED" && hasPermission("PAYMENT_REVERSAL_REVIEW") && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    void operationsData
                      .transitionPayment(
                        providerId,
                        payment.id,
                        {
                          expected_revision: payment.attributes.revision,
                          transition: "REVERSED",
                          reason: "Provider correction",
                        },
                        uuid(),
                      )
                      .then(load)
                      .catch((cause) => setError(fail(cause)))
                  }
                >
                  Reverse settlement
                </Button>
              )}
            </article>
          ))
        ) : (
          <p className="notice">No customer payments recorded.</p>
        )}
      </section>
      </>}
      {editDialog && <OperationsDialog title="Edit project draft" onClose={() => setEditDialog(false)}><ProjectEditForm providerId={providerId} project={project} onSaved={onSaved} /></OperationsDialog>}
      {dialog && (
        <ChangeOrderDialog
          providerId={providerId}
          caseId={project.id}
          close={() => setDialog(false)}
          saved={() => {
            setDialog(false);
            void load();
          }}
        />
      )}
    </>
  );
}

function ProjectLifecycleActions({ providerId, project, permissions, onSaved }: { providerId: string; project: Resource<ServiceCaseAttributes>; permissions: string[]; onSaved: (project: Resource<ServiceCaseAttributes>) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const next = project.attributes.status === "OPEN" || project.attributes.status === "DRAFT" || project.attributes.status === "REJECTED" ? "SUBMITTED" : project.attributes.status === "PENDING_APPROVAL" ? "APPROVED" : project.attributes.status === "APPROVED" ? "ACTIVE" : null;
  const requiredPermission = next === "SUBMITTED" ? "SERVICE_JOB_EDIT" : next === "APPROVED" ? "PROJECT_APPROVE" : next === "ACTIVE" ? "PROJECT_ACTIVATE" : null;
  if (!next || !requiredPermission || !permissions.includes(requiredPermission)) return null;
  async function transition() {
    setBusy(true); setError("");
    try { const updated = await operationsData.transitionServiceCase(providerId, project.id, { transition: next, expected_revision: project.attributes.revision }, uuid()); onSaved(updated); } catch (cause) { setError(fail(cause)); } finally { setBusy(false); }
  }
  return <section className="detail-card" aria-label="Project lifecycle actions"><div className="section-heading"><div><h3>Project lifecycle</h3><p>Submission, approval and activation are separate server-controlled decisions. Activation does not settle payments or complete execution.</p></div><Status>{project.attributes.status}</Status></div>{error && <p className="error" role="alert">{error}</p>}<Button variant="secondary" busy={busy} onClick={() => void transition()}>{next === "SUBMITTED" ? "Submit for approval" : next === "APPROVED" ? "Approve project" : "Activate project"}</Button></section>;
}

function LegacyProjectDetailContent({
  providerId,
  project,
  permissions,
}: {
  providerId: string;
  project: Resource<ServiceCaseAttributes>;
  permissions: string[];
}) {
  const can = (code: string) => permissions.includes(code);
  const canEditProject = can("SERVICE_JOB_EDIT");
  const canReleaseMaterials = can("MATERIAL_SHIPMENT_RELEASE");
  const canVerifyDelivery = can("MATERIAL_DELIVERY_VERIFY");
  const canRecordPayment = can("PAYMENT_RECORD");
  const canReleaseStage = can("PAYMENT_STAGE_RELEASE");
  const [requirements, setRequirements] =
    useState<Collection<MaterialRequirementAttributes> | null>(null);
  const [shipments, setShipments] =
    useState<Collection<ShipmentAttributes> | null>(null);
  const [schedules, setSchedules] =
    useState<Collection<PaymentScheduleAttributes> | null>(null);
  const [linkedJobs, setLinkedJobs] =
    useState<Collection<GenericAttributes> | null>(null);
  const [dialog, setDialog] = useState<
    "material" | "shipment" | "delivery" | "schedule" | "payment" | "release" | null
  >(null);
  const [activeShipment, setActiveShipment] =
    useState<Resource<ShipmentAttributes> | null>(null);
  const [activeSchedule, setActiveSchedule] =
    useState<Resource<PaymentScheduleAttributes> | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const reload = () =>
    Promise.all([
      operationsData.materialRequirements(providerId, project.id),
      operationsData.shipments(providerId, project.id),
      operationsData.paymentSchedules(providerId, project.id),
      operationsData.serviceCaseJobs(providerId, project.id),
    ])
      .then(([r, s, p, j]) => {
        setRequirements(r);
        setShipments(s);
        setSchedules(p);
        setLinkedJobs(j);
      })
      .catch((cause) => setError(fail(cause)));
  useEffect(() => {
    void reload();
  }, [providerId, project.id]);
  return (
    <>
      <div className="feature-detail">
        <h2>{project.attributes.title}</h2>
        <Status>{project.attributes.status}</Status>
        <p>
          {project.attributes.project_classification_key || "Service project"} ·
          Provider-owned project
        </p>
        {error && (
          <div className="feature-error" role="alert">
            {error}
          </div>
        )}
        {message && <ActionFeedback>{message}</ActionFeedback>}
        <div className="action-footer">
          {canEditProject && <Button onClick={() => setDialog("material")}>
            Add material requirement
          </Button>}
          {canReleaseMaterials && <Button
            variant="secondary"
            disabled={!requirements?.data.length}
            onClick={() => setDialog("shipment")}
          >
            Create shipment
          </Button>}
          {canEditProject && <Button variant="secondary" onClick={() => setDialog("schedule")}>
            Add payment milestone
          </Button>}
        </div>
        <section className="detail-card">
          <h3>Linked installation jobs</h3>
          {linkedJobs?.data.length ? (
            linkedJobs.data.map((job) => (
              <article className="record-card" key={job.id}>
                <strong>
                  {String(job.attributes.service_job_id || job.id)}
                </strong>
                <span>
                  {String(job.attributes.role || "INSTALLATION")} · execution
                  remains in the Jobs workspace
                </span>
                <Button
                  variant="secondary"
                  onClick={() => {
                    window.location.hash =
                      "jobs/" + (job.attributes.service_job_id || job.id);
                  }}
                >
                  Open execution job
                </Button>
              </article>
            ))
          ) : (
            <p className="notice">
              No installation Service Jobs are linked to this project.
            </p>
          )}
        </section>
        <section className="detail-card">
          <h3>Material requirements</h3>
          {requirements?.data.length ? (
            requirements.data.map((item) => (
              <article className="record-card" key={item.id}>
                <strong>
                  {item.attributes.material_code} —{" "}
                  {item.attributes.description}
                </strong>
                <span>
                  Required {item.attributes.required_quantity}{" "}
                  {item.attributes.unit_code} · Accepted{" "}
                  {item.attributes.accepted_quantity} · Rejected{" "}
                  {item.attributes.rejected_quantity} · Remaining{" "}
                  {item.attributes.remaining_quantity}
                </span>
              </article>
            ))
          ) : (
            <p className="notice">No requirements recorded.</p>
          )}
        </section>
        <section className="detail-card">
          <h3>Shipments</h3>
          {shipments?.data.length ? (
            shipments.data.map((item) => (
              <article className="record-card" key={item.id}>
                <Status>{item.attributes.status}</Status>
                <strong>{item.attributes.shipment_number}</strong>
                {item.attributes.lines.map((line) => (
                  <span key={line.id}>
                    {line.material_code}: dispatched {line.dispatched_quantity},
                    accepted {line.accepted_quantity}, rejected{" "}
                    {line.rejected_quantity}
                  </span>
                ))}
                {["DISPATCHED", "PARTIALLY_ACCEPTED"].includes(
                  item.attributes.status,
                ) && canVerifyDelivery && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setActiveShipment(item);
                      setDialog("delivery");
                    }}
                  >
                    Record delivery
                  </Button>
                )}
                <ShipmentEvidence providerId={providerId} shipment={item} />
              </article>
            ))
          ) : (
            <p className="notice">No shipments recorded.</p>
          )}
        </section>
        <section className="detail-card">
          <h3>Customer payment schedule</h3>
          {schedules?.data.length ? (
            schedules.data.map((schedule) => (
              <article className="record-card" key={schedule.id}>
                <Status>{schedule.attributes.status}</Status>
                <strong>
                  {schedule.attributes.milestone_code} —{" "}
                  {schedule.attributes.description}
                </strong>
                <span>
                  Due {schedule.attributes.due_amount}{" "}
                  {schedule.attributes.currency_code} · Collected{" "}
                  {schedule.attributes.collected_amount} · Outstanding{" "}
                  {schedule.attributes.outstanding_amount}
                </span>
                {canRecordPayment && <Button
                  variant="secondary"
                  disabled={schedule.attributes.outstanding_amount === "0"}
                  onClick={() => {
                    setActiveSchedule(schedule);
                    setDialog("payment");
                  }}
                >
                  Record collection
                </Button>}
                {canReleaseStage && schedule.attributes.outstanding_amount === "0" && (
                  <Button variant="secondary" onClick={() => { setActiveSchedule(schedule); setDialog("release"); }}>
                    Authorize stage release
                  </Button>
                )}
              </article>
            ))
          ) : (
            <p className="notice">No payment milestones recorded.</p>
          )}
        </section>
      </div>
      {dialog === "material" && (
        <MaterialDialog
          providerId={providerId}
          caseId={project.id}
          close={() => setDialog(null)}
          saved={() => {
            setDialog(null);
            setMessage("Material requirement recorded.");
            void reload();
          }}
        />
      )}
      {dialog === "shipment" && (
        <ShipmentDialog
          providerId={providerId}
          caseId={project.id}
          requirements={requirements?.data || []}
          close={() => setDialog(null)}
          saved={() => {
            setDialog(null);
            setMessage("Shipment dispatched.");
            void reload();
          }}
        />
      )}
      {dialog === "delivery" && activeShipment && (
        <DeliveryDialog
          providerId={providerId}
          shipment={activeShipment}
          close={() => setDialog(null)}
          saved={() => {
            setDialog(null);
            setMessage("Delivery reconciliation recorded.");
            void reload();
          }}
        />
      )}
      {dialog === "schedule" && (
        <PaymentScheduleDialog
          providerId={providerId}
          caseId={project.id}
          expectedRevision={project.attributes.revision}
          close={() => setDialog(null)}
          saved={() => {
            setDialog(null);
            setMessage("Payment milestone recorded.");
            void reload();
          }}
        />
      )}
      {dialog === "payment" && activeSchedule && (
        <PaymentDialog
          providerId={providerId}
          caseId={project.id}
          schedule={activeSchedule}
          close={() => setDialog(null)}
          saved={() => {
            setDialog(null);
            setMessage("Payment recorded as pending verification or received.");
            void reload();
          }}
        />
      )}
      {dialog === "release" && activeSchedule && (
        <StageReleaseDialog providerId={providerId} caseId={project.id} schedule={activeSchedule} close={() => setDialog(null)} saved={() => { setDialog(null); setMessage("Stage release decision recorded."); void reload(); }} />
      )}
    </>
  );
}

function QualityFindingPanel({
  providerId,
  project,
  canEditFindings,
}: {
  providerId: string;
  project: Resource<ServiceCaseAttributes>;
  canEditFindings: boolean;
}) {
  const units = project.attributes.project_assets || [];
  const [findings, setFindings] =
    useState<Collection<QualityFindingAttributes> | null>(null);
  const [form, setForm] = useState({
    asset_id: units.length === 1 ? units[0].id : "",
    severity: "HIGH",
    title: "",
    description: "",
    corrective_action: "",
    evidence_id: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const load = () =>
    operationsData
      .qualityFindings(providerId, project.id)
      .then(setFindings)
      .catch((cause) => setError(fail(cause)));
  useEffect(() => {
    void load();
  }, [providerId, project.id]);
  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operationsData.createQualityFinding(
        providerId,
        project.id,
        {
          asset_id: form.asset_id || undefined,
          severity: form.severity,
          title: form.title,
          description: form.description,
          corrective_action: form.corrective_action,
          evidence_ids: form.evidence_id ? [form.evidence_id] : [],
        },
        uuid(),
      );
      setMessage("Quality finding recorded.");
      setShowForm(false);
      setForm((current) => ({
        ...current,
        title: "",
        description: "",
        corrective_action: "",
        evidence_id: "",
      }));
      await load();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  async function transition(
    finding: Resource<QualityFindingAttributes>,
    next: string,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operationsData.transitionQualityFinding(
        providerId,
        finding.id,
        {
          transition: next,
          expected_revision: finding.attributes.revision,
          evidence_ids: form.evidence_id
            ? [form.evidence_id]
            : finding.attributes.evidence_ids,
          resolution_notes:
            next === "RESOLVED" ? "Independent reinspection passed" : undefined,
        },
        uuid(),
      );
      setMessage(`Quality finding ${next.toLowerCase().replaceAll("_", " ")}.`);
      await load();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail-card" aria-label="Quality findings">
      <div className="section-heading">
        <div>
          <h3>Commissioning defects and reinspection</h3>
          <p>
            Record punch-list findings, track rectification and require
            evidence-backed independent reinspection before resolution.
          </p>
        </div>
        {canEditFindings && <Button variant="secondary" onClick={() => setShowForm(true)}>Report defect</Button>}
      </div>
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
      {findings?.data.some((finding) => ["RECTIFICATION_IN_PROGRESS", "READY_FOR_REINSPECTION"].includes(finding.attributes.status)) && <label className="reinspection-evidence-field">Reinspection evidence document ID<input aria-label="Reinspection evidence document ID" value={form.evidence_id} onChange={(event) => setForm({ ...form, evidence_id: event.target.value })} /></label>}
      {showForm && canEditFindings && <OperationsDialog title="Report commissioning defect" busy={busy} onClose={() => setShowForm(false)}><form className="provider-form quality-finding-form" onSubmit={(event) => void create(event)}>
        <label>
          Elevator unit{units.length > 1 ? " *" : ""}
          <select
            aria-label="Quality finding elevator unit"
            required={units.length > 1}
            value={form.asset_id}
            onChange={(event) =>
              setForm({ ...form, asset_id: event.target.value })
            }
          >
            <option value="">Project-wide finding</option>
            {units.map((unit) => (
              <option value={unit.id} key={unit.id}>
                {unit.display_name || unit.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select
            aria-label="Quality finding severity"
            value={form.severity}
            onChange={(event) =>
              setForm({ ...form, severity: event.target.value })
            }
          >
            <option>LOW</option>
            <option>MEDIUM</option>
            <option>MAJOR</option>
            <option>CRITICAL</option>
          </select>
        </label>
        <label>
          Finding title
          <input
            aria-label="Quality finding title"
            required
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
          />
        </label>
        <label>
          Description
          <textarea
            aria-label="Quality finding description"
            required
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </label>
        <label>
          Corrective action
          <textarea
            aria-label="Quality finding corrective action"
            required
            value={form.corrective_action}
            onChange={(event) =>
              setForm({ ...form, corrective_action: event.target.value })
            }
          />
        </label>
        <label>
          Evidence document ID
          <input
            aria-label="Quality finding evidence document ID"
            value={form.evidence_id}
            onChange={(event) =>
              setForm({ ...form, evidence_id: event.target.value })
            }
            placeholder="Optional while reporting; required for reinspection"
          />
        </label>
        <Button type="submit" busy={busy}>
          Report defect
        </Button>
      </form></OperationsDialog>}
      {findings?.data.length ? (
        <div className="record-grid">
          {findings.data.map((finding) => (
            <article className="record-card" key={finding.id}>
              <Status>{finding.attributes.status}</Status>
              <strong>
                {finding.attributes.finding_number} · {finding.attributes.title}
              </strong>
              <span>
                <Priority>{finding.attributes.severity}</Priority> · {finding.attributes.description}
              </span>
              <small>
                Corrective action: {finding.attributes.corrective_action}
              </small>
              {finding.attributes.status === "OPEN" && canEditFindings && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    void transition(finding, "RECTIFICATION_IN_PROGRESS")
                  }
                  disabled={busy}
                >
                  Start rectification
                </Button>
              )}
              {finding.attributes.status === "RECTIFICATION_IN_PROGRESS" && canEditFindings && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    void transition(finding, "READY_FOR_REINSPECTION")
                  }
                  disabled={busy || !form.evidence_id}
                >
                  Submit for reinspection
                </Button>
              )}
              {finding.attributes.status === "READY_FOR_REINSPECTION" && canEditFindings && (
                <>
                  <small>Independent reviewer required for resolution.</small>
                  <Button
                    variant="secondary"
                    onClick={() => void transition(finding, "RESOLVED")}
                    disabled={busy || !form.evidence_id}
                  >
                    Pass reinspection
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void transition(finding, "REINSPECTION_FAILED")
                    }
                    disabled={busy || !form.evidence_id}
                  >
                    Fail reinspection
                  </Button>
                </>
              )}
              {finding.attributes.status === "REINSPECTION_FAILED" && canEditFindings && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    void transition(finding, "RECTIFICATION_IN_PROGRESS")
                  }
                  disabled={busy}
                >
                  Reopen rectification
                </Button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="notice">No commissioning defects recorded.</p>
      )}
    </section>
  );
}

function HandoverPanel({
  providerId,
  project,
  canRequestHandover,
}: {
  providerId: string;
  project: Resource<ServiceCaseAttributes>;
  canRequestHandover: boolean;
}) {
  const units = project.attributes.project_assets || [];
  const [assetId, setAssetId] = useState(units.length === 1 ? units[0].id : "");
  const [evidenceId, setEvidenceId] = useState("");
  const [events, setEvents] = useState<Array<Resource<GenericAttributes>>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  async function request(event: FormEvent) {
    event.preventDefault();
    if (!units.length || !assetId) { setError("An authorized elevator unit is required for per-unit handover."); return; }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const created = await operationsData.requestHandover(
        providerId,
        project.id,
        {
          expected_revision: project.attributes.revision,
          asset_id: assetId || undefined,
          evidence_ids: [evidenceId.trim()],
        },
        uuid(),
      );
      setEvents((current) => [...current, created]);
      setMessage("Handover request recorded by the server.");
      setShowRequestDialog(false);
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  async function accept(event: Resource<GenericAttributes>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const accepted = await operationsData.acceptHandover(
        providerId,
        project.id,
        {
          expected_revision: project.attributes.revision,
          asset_id: event.attributes.asset_id,
          evidence_ids: [evidenceId.trim()],
          acknowledgement_method: "SIGNATURE",
        },
        uuid(),
      );
      setEvents((current) => [...current, accepted]);
      setMessage("Customer handover acknowledgment recorded by the server.");
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail-card" aria-label="Quality and handover">
      <div className="section-heading">
        <div>
          <h3>Quality and handover</h3>
          <p>
            Request and acknowledge handover per elevator unit only after
            server-enforced milestone, evidence and authorization gates pass.
          </p>
        </div>
        {canRequestHandover && <Button variant="secondary" disabled={!units.length} title={!units.length ? "Link an authorized elevator unit before requesting handover." : undefined} onClick={() => setShowRequestDialog(true)}>Request handover</Button>}
      </div>
      {!units.length && <p className="notice">Per-unit handover is unavailable until an authorized elevator unit is linked to this project.</p>}
      {units.length > 1 && (
        <p className="notice">
          This project has {units.length} elevator units. Select one unit;
          handing over one unit does not complete the others.
        </p>
      )}
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
      {events.length === 0 && <p className="notice">No per-unit handover requests recorded.</p>}
      {showRequestDialog && canRequestHandover && <OperationsDialog title="Request per-unit handover" busy={busy} onClose={() => setShowRequestDialog(false)}><form className="provider-form handover-request-form" onSubmit={(event) => void request(event)}>
        <label>
          Elevator unit{units.length > 1 ? " *" : ""}
          <select
            aria-label="Handover elevator unit"
            required
            value={assetId}
            onChange={(event) => setAssetId(event.target.value)}
          >
            <option value="">Select an authorized elevator unit</option>
            {units.map((unit) => (
              <option value={unit.id} key={unit.id}>
                {unit.display_name || unit.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Evidence document ID *
          <input
            aria-label="Handover evidence document ID"
            required
            value={evidenceId}
            onChange={(event) => setEvidenceId(event.target.value)}
            placeholder="Authorized finalized document UUID"
          />
        </label>
        <Button
          type="submit"
          busy={busy}
          disabled={!units.length || !assetId || !evidenceId.trim()}
        >
          Request handover
        </Button>
      </form></OperationsDialog>}
      {events.length > 0 && (
        <div className="record-grid">
          {events.map((event) => (
            <article className="record-card" key={event.id}>
              <Status>
                {String(event.attributes.event_kind || "HANDOVER")}
              </Status>
              <strong>
                {units.find((unit) => unit.id === event.attributes.asset_id)
                  ?.display_name ||
                  String(event.attributes.asset_id || "Project")}
              </strong>
              <span>
                Server revision{" "}
                {String(
                  event.attributes.service_case_revision ||
                    project.attributes.revision,
                )}
              </span>
              {event.attributes.event_kind === "REQUESTED" && (
                <Button
                  variant="secondary"
                  onClick={() => void accept(event)}
                  disabled={busy}
                >
                  Record customer acknowledgment
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectJobControl({
  providerId,
  project,
  canCreateJob,
}: {
  providerId: string;
  project: Resource<ServiceCaseAttributes>;
  canCreateJob: boolean;
}) {
  const [dialog, setDialog] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <section className="detail-card">
      <div className="section-heading">
        <div>
          <h3>Installation execution</h3>
          <p>
            Create a project-linked Service Job; assignment, qualification and
            work execution remain governed by the canonical Jobs workspace.
          </p>
        </div>
        {canCreateJob && <Button
          variant="secondary"
          onClick={() => {
            setError("");
            setDialog(true);
          }}
        >
          Create installation job
        </Button>}
      </div>
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
      {dialog && canCreateJob && (
        <ProjectJobDialog
          providerId={providerId}
          project={project}
          close={() => setDialog(false)}
          saved={() => {
            setDialog(false);
            setMessage(
              "Installation Service Job created and linked to this project.",
            );
          }}
        />
      )}
    </section>
  );
}

function ProjectJobDialog({
  providerId,
  project,
  close,
  saved,
}: {
  providerId: string;
  project: Resource<ServiceCaseAttributes>;
  close: () => void;
  saved: () => void;
}) {
  const [serviceTypes, setServiceTypes] =
    useState<Collection<GenericAttributes> | null>(null);
  const [form, setForm] = useState({
    service_type_id: "",
    summary: `Installation execution — ${project.attributes.title}`,
    asset_id: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void operationsData
      .serviceTypes(providerId)
      .then(setServiceTypes)
      .catch((cause) => setError(fail(cause)));
  }, [providerId]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await operationsData.createServiceCaseJob(
        providerId,
        project.id,
        {
          service_type_id: form.service_type_id,
          summary: form.summary,
          asset_id: form.asset_id || undefined,
          role: "INSTALLATION",
        },
        uuid(),
      );
      saved();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <OperationsDialog
      title="Create installation job"
      busy={busy}
      onClose={close}
    >
      <form className="provider-form project-job-form" onSubmit={(event) => void submit(event)}>
        {error && (
          <p className="feature-error" role="alert">
            {error}
          </p>
        )}
        <label>
          Service type *
          <select
            required
            value={form.service_type_id}
            onChange={(event) =>
              setForm({ ...form, service_type_id: event.target.value })
            }
          >
            <option value="">Select an authorized service type</option>
            {(serviceTypes?.data || []).map((item) => (
              <option key={item.id} value={item.id}>
                {String(
                  item.attributes.name || item.attributes.code || item.id,
                )}
              </option>
            ))}
          </select>
        </label>
        <label>
          Summary *
          <input
            required
            value={form.summary}
            onChange={(event) =>
              setForm({ ...form, summary: event.target.value })
            }
          />
        </label>
        {(project.attributes.project_assets || []).length > 0 && (
          <label>
            Elevator unit
            <select
              aria-label="Elevator unit"
              value={form.asset_id}
              onChange={(event) =>
                setForm({ ...form, asset_id: event.target.value })
              }
            >
              <option value="">Project-wide execution</option>
              {(project.attributes.project_assets || []).map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.display_name || asset.id}
                </option>
              ))}
            </select>
          </label>
        )}
        <Button type="submit" busy={busy} disabled={!form.service_type_id}>
          Create and link job
        </Button>
      </form>
    </OperationsDialog>
  );
}

function StagePlanning({
  providerId,
  caseId,
  projectAssets,
  canEditStages,
  canExecuteStages,
}: {
  providerId: string;
  caseId: string;
  canExecuteStages: boolean;
  canEditStages: boolean;
  projectAssets: Array<{
    id: string;
    display_name?: string | null;
    role: string;
    status: string;
  }>;
}) {
  const [stages, setStages] = useState<Collection<GenericAttributes> | null>(
    null,
  );
  const [dialog, setDialog] = useState(false);
  const [error, setError] = useState("");
  const reload = () =>
    operationsData
      .serviceStages(providerId, caseId)
      .then(setStages)
      .catch((cause) => setError(fail(cause)));
  useEffect(() => {
    void reload();
  }, [providerId, caseId]);
  const rows = stages?.data || [];
  const completed = rows.filter(
    (stage) => String(stage.attributes.status) === "COMPLETED",
  ).length;
  return (
    <section className="detail-card">
      <div className="section-heading">
        <div>
          <h3>Installation milestones</h3>
          <p>
            {completed} of {rows.length} completed ·{" "}
            {rows.length ? Math.round((completed / rows.length) * 100) : 0}%
            overall progress
          </p>
        </div>
        {canEditStages && <Button variant="secondary" onClick={() => setDialog(true)}>
          Add milestone
        </Button>}
      </div>
      {projectAssets.length > 1 && (
        <div className="record-card">
          <strong>Elevator unit progress</strong>
          {projectAssets.map((asset) => {
            const unitRows = rows.filter(
              (stage) => stage.attributes.asset_id === asset.id,
            );
            const unitCompleted = unitRows.filter(
              (stage) => String(stage.attributes.status) === "COMPLETED",
            ).length;
            return (
              <span key={asset.id}>
                {asset.display_name || asset.id}: {unitCompleted}/
                {unitRows.length} completed ·{" "}
                {unitRows.length
                  ? Math.round((unitCompleted / unitRows.length) * 100)
                  : 0}
                %
              </span>
            );
          })}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {rows.length ? (
        rows.map((stage) => (
          <article className="record-card" key={stage.id}>
            <Status>{String(stage.attributes.status || "READY")}</Status>
            <strong>
              {String(stage.attributes.code || stage.id)} ·{" "}
              {String(stage.attributes.title || "")}
            </strong>
            <span>
              {stage.attributes.asset_id
                ? `Elevator unit ${String(stage.attributes.asset_id)}`
                : "Project-wide milestone"}
              {stage.attributes.planned_start_at
                ? ` · Planned ${String(stage.attributes.planned_start_at)}`
                : ""}
            </span>
            {canExecuteStages && ["READY", "IN_PROGRESS"].includes(
              String(stage.attributes.status),
            ) && (
              <Button
                variant="secondary"
                onClick={() =>
                  void operationsData
                    .transitionServiceStage(
                      providerId,
                      stage.id,
                      {
                        transition:
                          String(stage.attributes.status) === "READY"
                            ? "IN_PROGRESS"
                            : "COMPLETED",
                        expected_revision: Number(
                          stage.attributes.revision || 1,
                        ),
                        evidence_ids:
                          String(stage.attributes.status) === "IN_PROGRESS"
                            ? [crypto.randomUUID()]
                            : undefined,
                      },
                      uuid(),
                    )
                    .then(reload)
                    .catch((cause) => setError(fail(cause)))
                }
              >
                {String(stage.attributes.status) === "IN_PROGRESS"
                  ? "Complete milestone"
                  : "Start milestone"}
              </Button>
            )}
          </article>
        ))
      ) : (
        <p className="notice">No installation milestones configured.</p>
      )}
      {dialog && canEditStages && (
        <StageDialog
          providerId={providerId}
          caseId={caseId}
          existing={rows}
          projectAssets={projectAssets}
          close={() => setDialog(false)}
          saved={() => {
            setDialog(false);
            void reload();
          }}
        />
      )}
    </section>
  );
}

function StageDialog({
  providerId,
  caseId,
  existing,
  projectAssets,
  close,
  saved,
}: {
  providerId: string;
  caseId: string;
  existing: Resource<GenericAttributes>[];
  projectAssets: Array<{
    id: string;
    display_name?: string | null;
    role: string;
    status: string;
  }>;
  close: () => void;
  saved: () => void;
}) {
  const [form, setForm] = useState({
    code: "",
    title: "",
    planned_start_at: "",
    planned_end_at: "",
    mandatory: true,
    asset_id: "",
    prerequisite_stage_ids: [] as string[],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await operationsData.createServiceStage(
        providerId,
        caseId,
        { ...form, planned_start_at: form.planned_start_at ? indiaDateTimeToIso(form.planned_start_at) : null, planned_end_at: form.planned_end_at ? indiaDateTimeToIso(form.planned_end_at) : null, prerequisite_stage_ids: form.prerequisite_stage_ids },
        uuid(),
      );
      saved();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <OperationsDialog
      title="Add installation milestone"
      busy={busy}
      onClose={close}
    >
      <form className="provider-form" onSubmit={(event) => void submit(event)}>
        {error && (
          <p className="feature-error" role="alert">
            {error}
          </p>
        )}
        <label>
          Code *
          <input
            required
            value={form.code}
            onChange={(event) => setForm({ ...form, code: event.target.value })}
          />
        </label>
        <label>
          Title *
          <input
            required
            value={form.title}
            onChange={(event) =>
              setForm({ ...form, title: event.target.value })
            }
          />
        </label>
        {projectAssets.length > 0 && (
          <label>
            Elevator unit
            <select
              aria-label="Elevator unit"
              value={form.asset_id}
              onChange={(event) =>
                setForm({ ...form, asset_id: event.target.value })
              }
            >
              <option value="">Project-wide milestone</option>
              {projectAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.display_name || asset.id}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Planned start
          <input
            type="datetime-local"
            value={form.planned_start_at}
            onChange={(event) =>
              setForm({ ...form, planned_start_at: event.target.value })
            }
          />
        </label>
        <label>
          Planned end
          <input
            type="datetime-local"
            value={form.planned_end_at}
            onChange={(event) =>
              setForm({ ...form, planned_end_at: event.target.value })
            }
          />
        </label>
        <label>
          Prerequisite
          <select
            multiple
            value={form.prerequisite_stage_ids}
            onChange={(event) =>
              setForm({
                ...form,
                prerequisite_stage_ids: Array.from(
                  event.target.selectedOptions,
                  (option) => option.value,
                ),
              })
            }
          >
            {existing.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {String(stage.attributes.code || stage.id)} ·{" "}
                {String(stage.attributes.title || "")}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" busy={busy}>
          Save milestone
        </Button>
      </form>
    </OperationsDialog>
  );
}

function ShipmentEvidence({
  providerId,
  shipment,
}: {
  providerId: string;
  shipment: Resource<ShipmentAttributes>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] =
    useState<Collection<ProviderDocumentAttributes> | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    void operationsData
      .shipmentDocuments(providerId, shipment.id)
      .then(setDocuments)
      .catch((cause) => setError(fail(cause)));
  }, [providerId, shipment.id]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = input.current?.files?.[0];
    if (!file) return;
    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (
      !allowed.includes(file.type) ||
      file.size < 1 ||
      file.size > 26_214_400
    ) {
      setError(
        "Shipment proof must be a non-empty PDF, PNG, JPEG, XLS, or XLSX file no larger than 25 MiB.",
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      const checksum = await sha256Hex(file);
      const key = crypto.randomUUID();
      const created = await operationsData.createProviderDocument(
        providerId,
        {
          filename: file.name,
          media_type: file.type,
          size_bytes: file.size,
          checksum,
          classification: "GENERAL_SUPPORTING_EVIDENCE",
          visibility: "internal",
          owner: { type: "SERVICE_CASE_SHIPMENT", id: shipment.id },
          source: { type: "SERVICE_CASE_SHIPMENT", id: shipment.id },
        },
        key,
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
          `Private storage rejected the upload (HTTP ${response.status}).`,
        );
      await operationsData.finalizeProviderDocument(
        providerId,
        created.document.id,
        { version_id: created.version.id, checksum, size_bytes: file.size },
        `${key}-finalize`,
      );
      setDocuments(
        await operationsData.shipmentDocuments(providerId, shipment.id),
      );
      if (input.current) input.current.value = "";
      setMessage("Delivery proof finalized and associated with this shipment.");
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  async function download(document: Resource<ProviderDocumentAttributes>) {
    if (!document.attributes.current_version_id) return;
    setDownloadBusy(document.id);
    setError("");
    try {
      const transfer = await operationsData.authorizeProviderDocumentDownload(
        providerId,
        document.id,
        document.attributes.current_version_id,
        uuid(),
        "attachment",
      );
      window.open(transfer.url, "_blank", "noopener,noreferrer");
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setDownloadBusy(null);
    }
  }
  return (
    <details>
      <summary>Delivery proof</summary>
      <form className="provider-form" onSubmit={(event) => void upload(event)}>
        <label>
          PDF, PNG, JPEG, XLS or XLSX
          <input
            ref={input}
            type="file"
            accept="application/pdf,image/png,image/jpeg,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
          />
        </label>
        <Button type="submit" busy={busy}>
          {busy ? "Uploading…" : "Upload proof"}
        </Button>
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
      </form>
      {documents?.data.length ? (
        <div aria-label="Finalized delivery proof">
          {documents.data.map((document) => (
            <p key={document.id}>
              {document.attributes.filename} · {document.attributes.status} ·{" "}
              {document.attributes.scan_state}{" "}
              <Button
                type="button"
                variant="secondary"
                disabled={downloadBusy === document.id}
                onClick={() => void download(document)}
              >
                {downloadBusy === document.id
                  ? "Authorizing…"
                  : "Download proof"}
              </Button>
            </p>
          ))}
        </div>
      ) : (
        <p className="notice">
          No delivery proof is associated with this shipment.
        </p>
      )}
    </details>
  );
}

function PaymentScheduleDialog({
  providerId,
  caseId,
  expectedRevision,
  close,
  saved,
}: {
  providerId: string;
  caseId: string;
  expectedRevision: number;
  close: () => void;
  saved: () => void;
}) {
  const [basis, setBasis] = useState("0");
  const [currency, setCurrency] = useState("INR");
  const [stages, setStages] = useState([
    { milestone_code: "ADVANCE", description: "Customer advance", percentage: "20", trigger_kind: "MANUAL", material_release_condition: "", customer_acceptance_required: false },
    { milestone_code: "HANDOVER", description: "Final handover", percentage: "80", trigger_kind: "HANDOVER", material_release_condition: "", customer_acceptance_required: true },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const totalBasisPoints = stages.reduce((sum, stage) => sum + Math.round(Number(stage.percentage || 0) * 100), 0);
    const identifiers = stages.map((stage) => stage.milestone_code.trim().toLowerCase());
    if (!Number.isFinite(Number(basis)) || Number(basis) <= 0) { setError("Enter the accepted payable total used as the payment basis."); return; }
    if (stages.some((stage) => !Number.isFinite(Number(stage.percentage)) || Number(stage.percentage) < 0)) { setError("Stage percentages must be valid non-negative numbers."); return; }
    if (new Set(identifiers).size !== identifiers.length || identifiers.some((identifier) => !identifier)) { setError("Every stage must have a unique identifier."); return; }
    if (totalBasisPoints !== 10000) { setError(`Stage percentages must total exactly 100.00% (currently ${(totalBasisPoints / 100).toFixed(2)}%).`); return; }
    setBusy(true);
    try {
      await operationsData.configurePaymentSchedules(
        providerId,
        caseId,
        { expected_revision: expectedRevision, payment_basis_amount: basis, payment_basis_currency_code: currency.toUpperCase(), stages: stages.map((stage, index) => ({ ...stage, sequence: index + 1, percentage: Number(stage.percentage) })) },
        uuid(),
      );
      saved();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  const totalBasisPoints = stages.reduce((sum, stage) => sum + Math.round(Number(stage.percentage || 0) * 100), 0);
  const basisCents = Math.round(Number(basis || 0) * 100);
  let allocatedCents = 0;
  const stageAmounts = stages.map((stage, index) => {
    const roundedCents = Math.round(basisCents * Math.round(Number(stage.percentage || 0) * 100) / 10000);
    const cents = index === stages.length - 1 ? basisCents - allocatedCents : roundedCents;
    allocatedCents += cents;
    return cents;
  });
  return (
    <OperationsDialog title="Configure payment stages" busy={busy} onClose={close}>
      <form className="provider-form payment-stage-editor" onSubmit={(event) => void submit(event)}>
        {error && <p className="feature-error">{error}</p>}
        <p className="notice payment-stage-guidance">Calculated stage amounts use the payable basis. Configure any number of stages; allocation must total exactly 100.00%. The accepted schedule remains immutable after acceptance.</p>
        <div className="payment-stage-basis"><label>Payment basis *<input aria-label="Payment basis" required type="number" min="0.01" step="0.01" value={basis} onChange={(event) => setBasis(event.target.value)} /></label>
        <label>Currency *<input aria-label="Payment currency" required maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value)} /></label></div>
        {stages.map((stage, index) => {
          return <fieldset className="record-card payment-stage-card" key={`${stage.milestone_code}-${index}`}><legend>Stage {index + 1}</legend>
            <label>Identifier *<input required value={stage.milestone_code} onChange={(event) => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, milestone_code: event.target.value } : item))} /></label>
            <label>Name *<input required value={stage.description} onChange={(event) => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} /></label>
            <label>Percentage *<input required type="number" min="0" max="100" step="0.01" value={stage.percentage} onChange={(event) => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, percentage: event.target.value } : item))} /></label>
            <label>Calculated amount<input readOnly value={`${(stageAmounts[index] / 100).toFixed(2)} ${currency.toUpperCase()}`} /></label>
            <label>Trigger<select value={stage.trigger_kind} onChange={(event) => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, trigger_kind: event.target.value } : item))}><option value="MANUAL">Manual</option><option value="CUSTOMER_ACCEPTANCE">Customer acceptance</option><option value="STAGE_COMPLETION">Stage completion</option><option value="DELIVERY">Delivery</option><option value="HANDOVER">Handover</option></select></label>
            <label>Material release condition<input value={stage.material_release_condition} onChange={(event) => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, material_release_condition: event.target.value } : item))} /></label>
            <label><input type="checkbox" checked={stage.customer_acceptance_required} onChange={(event) => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, customer_acceptance_required: event.target.checked } : item))} /> Customer acceptance required</label>
            <Button type="button" variant="secondary" disabled={stages.length <= 1} onClick={() => setStages(stages.filter((_, itemIndex) => itemIndex !== index))}>Remove stage</Button>
          </fieldset>;
        })}
        <p className={`payment-stage-total${totalBasisPoints === 10000 ? ' is-valid' : ' is-invalid'}`} role="status">Total allocation: {(totalBasisPoints / 100).toFixed(2)}% · {(stageAmounts.reduce((sum, amount) => sum + amount, 0) / 100).toFixed(2)} {currency.toUpperCase()}</p>
        <div className="payment-stage-actions"><Button type="button" variant="secondary" onClick={() => setStages([...stages, { milestone_code: `STAGE_${stages.length + 1}`, description: "New stage", percentage: "0", trigger_kind: "MANUAL", material_release_condition: "", customer_acceptance_required: false }])}>Add stage</Button>
        <Button type="submit" busy={busy}>Save payment-stage configuration</Button></div>
      </form>
    </OperationsDialog>
  );
}

function StageReleaseDialog({
  providerId,
  caseId,
  schedule,
  close,
  saved,
}: {
  providerId: string;
  caseId: string;
  schedule: Resource<PaymentScheduleAttributes>;
  close: () => void;
  saved: () => void;
}) {
  const [quotationRevision, setQuotationRevision] = useState("1");
  const [ruleVersion, setRuleVersion] = useState("ELEVATOR_STAGE_RELEASE_V1");
  const [reason, setReason] = useState("Settlement verified");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payments = await operationsData.payments(providerId, caseId);
      const settledPaymentIds = payments.data.filter((payment) => String(payment.attributes.status) === "SETTLED" && String(payment.attributes.payment_schedule_id) === schedule.id).map((payment) => payment.id);
      if (!settledPaymentIds.length) throw new Error("No settled payment evidence is available for this stage.");
      await operationsData.createStageRelease(providerId, caseId, { payment_schedule_id: schedule.id, settled_payment_ids: settledPaymentIds, accepted_quotation_revision: Number(quotationRevision), release_rule_version: ruleVersion, decision: "AUTHORIZED", reason }, uuid());
      saved();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  return <OperationsDialog title={`Authorize ${schedule.attributes.milestone_code} release`} busy={busy} onClose={close}>
    <form className="provider-form project-action-form stage-release-form" onSubmit={(event) => void submit(event)}>
      {error && <p className="feature-error" role="alert">{error}</p>}
      <p className="notice">Only independently settled payments for this stage are submitted as evidence. The accepted quotation revision is checked by the server.</p>
      <label>Accepted quotation revision *<input required type="number" min="1" value={quotationRevision} onChange={(event) => setQuotationRevision(event.target.value)} /></label>
      <label>Release rule version *<input required maxLength={80} value={ruleVersion} onChange={(event) => setRuleVersion(event.target.value)} /></label>
      <label>Decision reason *<textarea required maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <Button type="submit" busy={busy}>Authorize material/execution release</Button>
    </form>
  </OperationsDialog>;
}

function PaymentDialog({
  providerId,
  caseId,
  schedule,
  close,
  saved,
}: {
  providerId: string;
  caseId: string;
  schedule: Resource<PaymentScheduleAttributes>;
  close: () => void;
  saved: () => void;
}) {
  const [form, setForm] = useState({
    payment_reference: `COL-${Date.now()}`,
    method: "CASH",
    amount: schedule.attributes.outstanding_amount,
    currency_code: schedule.attributes.currency_code,
    instrument_reference: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await operationsData.createPayment(
        providerId,
        caseId,
        { ...form, payment_schedule_id: schedule.id },
        uuid(),
      );
      saved();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <OperationsDialog
      title={`Record collection — ${schedule.attributes.milestone_code}`}
      busy={busy}
      onClose={close}
    >
      <form className="provider-form project-action-form payment-entry-form" onSubmit={(event) => void submit(event)}>
        {error && <p className="feature-error">{error}</p>}
        <label>
          Payment reference *
          <input
            required
            value={form.payment_reference}
            onChange={(event) =>
              setForm({ ...form, payment_reference: event.target.value })
            }
          />
        </label>
        <label>
          Method *
          <select
            required
            value={form.method}
            onChange={(event) =>
              setForm({ ...form, method: event.target.value })
            }
          >
            <option value="CASH">Cash received</option>
            <option value="CHEQUE">Cheque received</option>
            <option value="ONLINE">Online pending verification</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
          </select>
        </label>
        <label>
          Amount *
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            max={schedule.attributes.outstanding_amount}
            value={form.amount}
            onChange={(event) =>
              setForm({ ...form, amount: event.target.value })
            }
          />
        </label>
        <label>
          Instrument/reference
          <input
            value={form.instrument_reference}
            onChange={(event) =>
              setForm({ ...form, instrument_reference: event.target.value })
            }
          />
        </label>
        <p className="notice">
          Cash and cheque are recorded as received; online is recorded as
          pending verification until an authorized verifier settles it.
        </p>
        <Button type="submit" busy={busy}>
          Record collection
        </Button>
      </form>
    </OperationsDialog>
  );
}

function MaterialDialog({
  providerId,
  caseId,
  close,
  saved,
}: {
  providerId: string;
  caseId: string;
  close: () => void;
  saved: () => void;
}) {
  const [form, setForm] = useState({
    material_code: "",
    description: "",
    required_quantity: "",
    unit_code: "UNIT",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await operationsData.createMaterialRequirement(
        providerId,
        caseId,
        form,
        uuid(),
      );
      saved();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <OperationsDialog
      title="Add material requirement"
      busy={busy}
      onClose={close}
    >
      <form className="provider-form project-action-form material-requirement-form" onSubmit={(e) => void submit(e)}>
        {error && <p className="feature-error">{error}</p>}
        <label>
          Material code *
          <input
            required
            value={form.material_code}
            onChange={(e) =>
              setForm({ ...form, material_code: e.target.value })
            }
          />
        </label>
        <label>
          Description *
          <input
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label>
          Required quantity *
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={form.required_quantity}
            onChange={(e) =>
              setForm({ ...form, required_quantity: e.target.value })
            }
          />
        </label>
        <label>
          Unit *
          <input
            required
            value={form.unit_code}
            onChange={(e) => setForm({ ...form, unit_code: e.target.value })}
          />
        </label>
        <Button type="submit" busy={busy}>
          Save requirement
        </Button>
      </form>
    </OperationsDialog>
  );
}

function ShipmentDialog({
  providerId,
  caseId,
  requirements,
  close,
  saved,
}: {
  providerId: string;
  caseId: string;
  requirements: Resource<MaterialRequirementAttributes>[];
  close: () => void;
  saved: () => void;
}) {
  const [requirement, setRequirement] = useState(requirements[0]?.id || "");
  const [quantity, setQuantity] = useState("");
  const [number, setNumber] = useState("SHIP-1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = requirements.find((item) => item.id === requirement);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await operationsData.createShipment(
        providerId,
        caseId,
        {
          shipment_number: number,
          lines: [
            {
              material_requirement_id: requirement,
              dispatched_quantity: quantity,
            },
          ],
        },
        uuid(),
      );
      saved();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <OperationsDialog title="Dispatch shipment" busy={busy} onClose={close}>
      <form className="provider-form project-action-form shipment-create-form" onSubmit={(e) => void submit(e)}>
        {error && <p className="feature-error">{error}</p>}
        <label>
          Shipment number *
          <input
            required
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </label>
        <label>
          Material *
          <select
            required
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
          >
            {requirements.map((item) => (
              <option key={item.id} value={item.id}>
                {item.attributes.material_code} — remaining{" "}
                {item.attributes.remaining_quantity}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quantity *
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            max={selected?.attributes.remaining_quantity}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <Button type="submit" busy={busy} disabled={!requirement || !quantity}>
          Dispatch shipment
        </Button>
      </form>
    </OperationsDialog>
  );
}

function ChangeOrderDialog({
  providerId,
  caseId,
  close,
  saved,
}: {
  providerId: string;
  caseId: string;
  close: () => void;
  saved: () => void;
}) {
  const [form, setForm] = useState({
    change_type: "SCOPE",
    description: "",
    commercial_delta: "0",
    currency_code: "INR",
    schedule_delta_days: "0",
    changes: '{"reason":""}',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const changes = JSON.parse(form.changes) as Record<string, unknown>;
      await operationsData.createChangeOrder(
        providerId,
        caseId,
        { ...form, changes },
        uuid(),
      );
      saved();
    } catch (cause) {
      setError(
        cause instanceof SyntaxError
          ? "Changes must be valid JSON."
          : fail(cause),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <OperationsDialog title="Add change order" busy={busy} onClose={close}>
      <form className="provider-form" onSubmit={(event) => void submit(event)}>
        {error && (
          <p className="feature-error" role="alert">
            {error}
          </p>
        )}
        <label>
          Change type *
          <select
            value={form.change_type}
            onChange={(event) =>
              setForm({ ...form, change_type: event.target.value })
            }
          >
            <option value="SCOPE">Scope</option>
            <option value="MATERIAL">Material</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="SCHEDULE">Schedule</option>
            <option value="TECHNICAL">Technical</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label>
          Description *
          <textarea
            required
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </label>
        <label>
          Commercial delta
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.commercial_delta}
            onChange={(event) =>
              setForm({ ...form, commercial_delta: event.target.value })
            }
          />
        </label>
        <label>
          Schedule delta (days)
          <input
            type="number"
            min="0"
            step="1"
            value={form.schedule_delta_days}
            onChange={(event) =>
              setForm({ ...form, schedule_delta_days: event.target.value })
            }
          />
        </label>
        <label>
          Change details (JSON)
          <textarea
            required
            value={form.changes}
            onChange={(event) =>
              setForm({ ...form, changes: event.target.value })
            }
          />
        </label>
        <Button type="submit" busy={busy}>
          Save draft
        </Button>
      </form>
    </OperationsDialog>
  );
}

function DeliveryDialog({
  providerId,
  shipment,
  close,
  saved,
}: {
  providerId: string;
  shipment: Resource<ShipmentAttributes>;
  close: () => void;
  saved: () => void;
}) {
  const line = shipment.attributes.lines[0];
  const [accepted, setAccepted] = useState(line?.dispatched_quantity || "0");
  const [rejected, setRejected] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await operationsData.recordShipmentDelivery(
        providerId,
        shipment.id,
        {
          lines: [
            {
              shipment_line_id: line.id,
              accepted_quantity: accepted,
              rejected_quantity: rejected,
              rejection_reason:
                Number(rejected) > 0 ? "Damaged on arrival" : undefined,
            },
          ],
        },
        uuid(),
      );
      saved();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <OperationsDialog
      title={`Record delivery — ${shipment.attributes.shipment_number}`}
      busy={busy}
      onClose={close}
    >
      <form className="provider-form project-action-form delivery-reconcile-form" onSubmit={(e) => void submit(e)}>
        {error && <p className="feature-error">{error}</p>}
        <p className="notice">Dispatched: {line?.dispatched_quantity}</p>
        <label>
          Accepted quantity *
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={accepted}
            onChange={(e) => setAccepted(e.target.value)}
          />
        </label>
        <label>
          Rejected quantity *
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={rejected}
            onChange={(e) => setRejected(e.target.value)}
          />
        </label>
        <Button type="submit" busy={busy}>
          Save delivery
        </Button>
      </form>
    </OperationsDialog>
  );
}

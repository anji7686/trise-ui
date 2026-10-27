import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, FilterToolbar, PageHeader } from "@trise/ui";
import { useAuth } from "@trise/auth";
import {
  DEFAULT_PAGE_SIZE,
  operationsData,
  type Collection,
  type GenericAttributes,
  type MaterialRequirementAttributes,
  type PaymentAttributes,
  type PaymentScheduleAttributes,
  type ProviderDocumentAttributes,
  type ServiceCaseBlockerAttributes,
  type ProviderWorkJourney,
  type QualityFindingAttributes,
  type Resource,
  type ServiceCaseAttributes,
  type ShipmentAttributes,
} from "./data";
import { OperationsPriority as Priority, OperationsStatus as Status } from "./operations-status";
import { SvgIcon } from "./icons";
import { ActionNotification, displayLabel, EmptyState, ProviderActionMenu } from "./operations-shared";
import { OperationsDialog } from "./operations-dialog";
import { sha256Hex } from "./provider-document-upload";
import { indiaDateTimeToIso } from './subscription-support';
import { accessData } from "./access-data";
import { JourneyAbandonAction } from "./journey-abandon-action";
import { WorkflowFollowUpAction, WorkflowFollowUpDialog } from "./workflow-follow-ups";
import {
  JourneyTimelineDialog,
  WorkflowChainAction,
} from "./provider-journey-timeline";

const fail = (error: unknown) =>
  (error as { message?: string })?.message ||
  "The request could not be completed.";
const uuid = () => crypto.randomUUID();
const PROJECT_CLASSIFICATION_OPTIONS = [
  ["ELEVATOR_INSTALLATION", "Elevator installation"],
  ["ELEVATOR_MODIFICATION", "Elevator modification"],
  ["ELEVATOR_TAKEOVER", "Elevator takeover"],
  ["SERVICE_PROJECT", "Service project"],
] as const;
const projectClassificationLabel = (value: unknown) => displayLabel(value, "Service project");

export function ProjectsWorkspace({ providerId, route }: { providerId: string; route?: { id?: string } }) {
  const { session } = useAuth();
  const [effectivePermissions, setEffectivePermissions] = useState<string[] | null>(null);
  const [projects, setProjects] =
    useState<Collection<ServiceCaseAttributes> | null>(null);
  const [selected, setSelected] =
    useState<Resource<ServiceCaseAttributes> | null>(null);
  const [error, setError] = useState("");
  const [pageCursor, setPageCursor] = useState<{ after?: string; before?: string }>({});
  const pageLimit = DEFAULT_PAGE_SIZE;
  const [queryText, setQueryText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const providerRoleContext = session?.providerCapabilities.find((context) => context.providerId === providerId)?.roleContext?.toUpperCase();
  // The effective-permissions endpoint is authoritative. Do not infer project
  // mutations from ordinary role labels. Provider Administrator is the one
  // supported compatibility exception for legacy memberships: the API
  // authorizes this server-projected owner context, while finance-only
  // settlement/release grants remain absent from this fallback.
  const providerAdminFallback = Boolean(session?.platformAdmin || ["PROVIDER_ADMIN", "ADMIN"].includes(providerRoleContext || ""));
  const providerAdminProjectPermissions = ["SERVICE_JOB_EDIT", "PROJECT_APPROVE", "PROJECT_ACTIVATE", "MATERIAL_SHIPMENT_RELEASE", "MATERIAL_DELIVERY_VERIFY", "PAYMENT_RECORD"];
  const projectPermissions = providerAdminFallback
    ? Array.from(new Set([...(effectivePermissions || []), ...providerAdminProjectPermissions]))
    : (effectivePermissions || []);
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
    if (!route?.id) setSelected(null);
    operationsData
      .serviceCases(providerId, { ...pageCursor, limit: pageLimit, query: queryText.trim() || undefined, status: statusFilter || undefined })
      .then((result) => {
        setProjects(result);
        const listed = route?.id
          ? result.data.find((project) => project.id === route.id)
          : null;
        if (listed) setSelected(listed);
        else if (route?.id) {
          void operationsData
            .serviceCase(providerId, route.id)
            .then(setSelected)
            .catch((cause) => setError(fail(cause)));
        }
      })
      .catch((cause) => setError(fail(cause)));
  }, [providerId, pageCursor, pageLimit, queryText, statusFilter, route?.id]);
  useEffect(() => { setPageCursor({}); setSelected(null); }, [queryText, statusFilter]);
  const visibleProjects = projects?.data || [];
  const canExecuteStages = projectPermissions.includes("SERVICE_JOB_EXECUTE");
  return (
    <section className="content feature-page">
      {!selected && <PageHeader
        title="Installation Projects"
        description="Coordinate project material requirements, shipments and delivery reconciliation."
      />}
      {error && <ActionNotification kind="error" title="Project action needs attention" onClose={() => setError("")}>{error}</ActionNotification>}
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
                <thead><tr><th scope="col">Project</th><th scope="col">Customer</th><th scope="col">Type</th><th scope="col">Revision</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {visibleProjects.map((project) => (
                    <tr key={project.id}>
                      <td data-label="Project"><strong>{project.attributes.title}</strong></td>
                      <td data-label="Customer"><div className="project-customer-cell"><strong>{project.attributes.customer?.display_name || "Customer not linked"}</strong>{project.attributes.customer?.relationship_status && <small>{project.attributes.customer.relationship_status === "ACTIVE" ? "Linked customer" : displayLabel(project.attributes.customer.relationship_status)}</small>}</div></td>
                      <td data-label="Type">{projectClassificationLabel(project.attributes.project_classification_key)}</td>
                      <td data-label="Revision">{project.attributes.revision}</td>
                      <td data-label="Status"><Status>{project.attributes.journey_status_label === 'ABANDONED' ? 'Abandoned' : displayLabel(project.attributes.status, 'Not available')}</Status>{project.attributes.journey_status_label === 'ABANDONED' ? <small className="workflow-concluded-label">Journey abandoned</small> : project.attributes.journey_stage_status === 'COMPLETED' && <small className="workflow-concluded-label">Workflow concluded</small>}</td>
                      <td data-label="Actions"><ProviderActionMenu label={`Actions for ${project.attributes.title || 'project'}`} actions={[{ id: 'open', label: 'Open project', onSelect: () => { window.location.hash = `projects/${encodeURIComponent(project.id)}`; } }]} /></td>
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
          <div className="server-pagination" aria-label="Project pages"><div><Button type="button" variant="secondary" disabled={!projects.page?.previous} onClick={() => { setSelected(null); setPageCursor({ before: projects.page?.previous || undefined }); }}>Previous</Button><Button type="button" disabled={!projects.page?.next} onClick={() => { setSelected(null); setPageCursor({ after: projects.page?.next || undefined }); }}>Next</Button></div></div>
        </>
      )}
      {selected && (
        <ProjectDetail
          providerId={providerId}
          project={selected}
          permissions={projectPermissions}
          canExecuteStages={canExecuteStages}
          back={() => {
            if (route?.id) window.location.hash = "projects";
            else setSelected(null);
          }}
          onSaved={setSelected}
        />
      )}
    </section>
  );
}

function ProjectEditForm({ providerId, project, onSaved }: { providerId: string; project: Resource<ServiceCaseAttributes>; onSaved: (project: Resource<ServiceCaseAttributes>) => void }) {
  const projectStatus = String(project.attributes.status).toUpperCase();
  const editable = ['DRAFT', 'OPEN'].includes(projectStatus);
  const assetSelectionEditable = editable && projectStatus === 'DRAFT';
  const [form, setForm] = useState({ title: project.attributes.title, project_classification_key: project.attributes.project_classification_key || '', service_location_id: project.attributes.service_location_id || '', asset_ids: project.attributes.asset_ids || project.attributes.project_assets?.map((asset) => asset.id) || [] });
  const [locations, setLocations] = useState<Collection<GenericAttributes>>({ data: [] });
  const [assets, setAssets] = useState<Collection<GenericAttributes>>({ data: [] });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => {
    setForm({ title: project.attributes.title, project_classification_key: project.attributes.project_classification_key || '', service_location_id: project.attributes.service_location_id || '', asset_ids: project.attributes.asset_ids || project.attributes.project_assets?.map((asset) => asset.id) || [] });
    if (!project.attributes.customer_relationship_id) {
      setLocations({ data: [] });
      setAssets({ data: [] });
      return;
    }
    void Promise.all([
      operationsData.locations(providerId, project.attributes.customer_relationship_id, { limit: 100 }),
      operationsData.assets(providerId, { customerRelationshipId: project.attributes.customer_relationship_id, limit: 100 }),
    ])
      .then(([locationResult, assetResult]) => { setLocations(locationResult); setAssets(assetResult); })
      .catch((cause) => setError(fail(cause)));
  }, [providerId, project.id, project.attributes.revision]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(''); setMessage(''); try { const body = { title: form.title, project_classification_key: form.project_classification_key, service_location_id: form.service_location_id, expected_revision: project.attributes.revision, ...(assetSelectionEditable ? { asset_ids: form.asset_ids } : {}) }; const updated = await operationsData.updateServiceCase(providerId, project.id, body, uuid()); onSaved(updated); setMessage('Project draft updated.'); } catch (cause) { setError(fail(cause)); } finally { setBusy(false); } }
  const classificationOptions = PROJECT_CLASSIFICATION_OPTIONS.some(([value]) => value === form.project_classification_key)
    ? PROJECT_CLASSIFICATION_OPTIONS
    : form.project_classification_key
      ? [[form.project_classification_key, projectClassificationLabel(form.project_classification_key)] as const, ...PROJECT_CLASSIFICATION_OPTIONS]
      : PROJECT_CLASSIFICATION_OPTIONS;
  return <section className="detail-card" aria-label="Edit project draft"><div className="section-heading"><div><h3>Edit project draft</h3><p>Capture the customer service site and link the provider-authorized elevator units before activation.</p></div><Status>{displayLabel(project.attributes.status, 'Not available')}</Status></div>{error && <ActionNotification kind="error" title="Project action needs attention" onClose={() => setError('')}>{error}</ActionNotification>}{message && <ActionNotification title="Project update completed" onClose={() => setMessage('')}>{message}</ActionNotification>}<form className="provider-form project-edit-form" onSubmit={(event) => void submit(event)}><label>Project name *<input required maxLength={200} disabled={!editable} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Project type<select disabled={!editable} value={form.project_classification_key} onChange={(event) => setForm({ ...form, project_classification_key: event.target.value })}><option value="">Select project type</option>{classificationOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Project service location *<select required disabled={!editable || !project.attributes.customer_relationship_id} value={form.service_location_id} onChange={(event) => setForm({ ...form, service_location_id: event.target.value })}><option value="">Select an authorized customer site</option>{locations.data.map((location) => <option key={location.id} value={location.id}>{String(location.attributes.name || location.attributes.display_name || 'Authorized site')}</option>)}</select><small className="form-help">Required before project activation and installation-job creation.</small></label><fieldset className="project-asset-selection"><legend>Elevator units / assets</legend><p>{assetSelectionEditable ? 'Choose the installed or registered units from the customer asset catalogue. The selected units become the project scope.' : 'Elevator units are locked after the project draft is activated.'}</p>{assets.data.length ? <div className="project-asset-options" role="group" aria-label="Project elevator units">{assets.data.map((asset) => { const label = String(asset.attributes.display_name || asset.attributes.name || asset.attributes.equipment_code || asset.attributes.identifier || 'Elevator asset'); const checked = form.asset_ids.includes(asset.id); return <label className="project-asset-option" key={asset.id}><input type="checkbox" disabled={!assetSelectionEditable} checked={checked} onChange={(event) => setForm({ ...form, asset_ids: event.target.checked ? [...form.asset_ids, asset.id] : form.asset_ids.filter((id) => id !== asset.id) })} /><span><strong>{label}</strong><small>{String(asset.attributes.asset_type_name || asset.attributes.category || 'Provider-authorized asset')}</small></span></label>; })}</div> : <p className="notice">No provider-authorized assets are available for this customer yet. Register the elevator unit first, then return to this project draft.</p>}</fieldset><Button type="submit" busy={busy} disabled={!editable || !form.service_location_id}>{editable ? 'Save project draft' : 'Project editing locked by lifecycle'}</Button></form></section>;
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
  const { session } = useAuth();
  const hasPermission = (code: string) => permissions.includes(code);
  const [journey, setJourney] = useState<ProviderWorkJourney | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(true);
  const roleContext = session?.providerCapabilities.find((context) => context.providerId === providerId)?.roleContext?.toUpperCase();
  const canAbandon = Boolean(session?.platformAdmin || ['PROVIDER_ADMIN', 'ADMIN', 'MARKETING_MANAGER', 'OPERATIONS_REVIEWER'].includes(roleContext || ''));
  const workflowConcluded = project.attributes.journey_stage_status === 'COMPLETED' || project.attributes.journey_status === 'CANCELLED' || (journey !== null && journey.attributes.status !== 'ACTIVE');
  const handoverInProgress = (project.attributes.handover_events || []).some((event) => ['REQUESTED', 'ACCEPTED'].includes(String(event.event_kind)));
  const canEditWorkflow = (code: string) => hasPermission(code) && !workflowConcluded;
  const [orders, setOrders] = useState<Collection<GenericAttributes> | null>(
    null,
  );
  const [payments, setPayments] =
    useState<Collection<PaymentAttributes> | null>(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'readiness' | 'execution' | 'quality' | 'commercial'>('overview');
  const [followUpOpen, setFollowUpOpen] = useState(false);
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
  useEffect(() => {
    let active = true;
    setJourney(null);
    setJourneyLoading(true);
    void operationsData.serviceCaseJourney(providerId, project.id)
      .then((value) => { if (active) setJourney(value); })
      .catch((cause) => { if (active) setError(fail(cause)); })
      .finally(() => { if (active) setJourneyLoading(false); });
    return () => { active = false; };
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
  const refreshProject = async () => {
    try {
      const refreshed = await operationsData.serviceCase(providerId, project.id);
      onSaved(refreshed);
    } catch (cause) {
      setError(fail(cause));
    }
  };
  return (
    <>
      <PageHeader eyebrow="Project & Delivery" title="Project details" description="Move the accepted commercial scope through execution, quality and handover." action={<div className="lifecycle-detail-actions"><Button variant="secondary" className="workflow-back-action" onClick={back} title="Back to Projects"><SvgIcon name="arrow-left" size={15} /> Back</Button><Button variant="secondary" className="workflow-timeline-action" onClick={() => setTimelineOpen(true)} title="View timeline and audit history"><SvgIcon name="activity" size={15} /> Timeline</Button><WorkflowChainAction journey={journey} loading={journeyLoading} currentResourceKind="ServiceCase" currentResourceId={project.id} /><WorkflowFollowUpAction providerId={providerId} journeyId={journey?.id} targetResourceKind="ServiceCase" targetResourceId={project.id} onClick={() => setFollowUpOpen(true)} /><JourneyAbandonAction providerId={providerId} journey={journey} canAbandon={canAbandon && !workflowConcluded} onAbandoned={(updated) => { setJourney(updated); onSaved({ ...project, attributes: { ...project.attributes, journey_status: 'CANCELLED', journey_status_label: 'ABANDONED', journey_stage_status: 'COMPLETED', journey_abandonment_reason: updated.attributes.abandonment_reason } }); }} /></div>} />
      <section className="project-detail-record-header"><div><span className="eyebrow">Installation project</span><h2>{project.attributes.title}</h2><p>{projectClassificationLabel(project.attributes.project_classification_key)} · Revision {project.attributes.revision}{project.attributes.service_location_name ? ` · Site: ${project.attributes.service_location_name}` : ' · Site: Not selected'}</p></div><div className="lifecycle-current-step"><span>Current workflow step</span><strong>{project.attributes.journey_status_label === 'ABANDONED' ? 'Journey abandoned' : handoverInProgress ? 'Handover in progress' : displayLabel(project.attributes.status, 'Open')}</strong><small>{project.attributes.journey_status_label === 'ABANDONED' ? 'This shared journey was stopped by an authorized provider authority.' : workflowConcluded && handoverInProgress ? 'Project scope is read-only while handover and financial close continue.' : workflowConcluded ? 'This project stage is concluded and remains read-only.' : 'Use the lifecycle tabs to coordinate the next authorized team action.'}</small></div><Status>{project.attributes.journey_status_label === 'ABANDONED' ? 'Abandoned' : displayLabel(project.attributes.status, 'Not available')}</Status><ProjectNextActionCard project={project} blockers={project.attributes.active_blocker_count || 0} />{workflowConcluded && <div className={`workflow-concluded-inline${project.attributes.journey_status_label === 'ABANDONED' ? ' workflow-concluded-inline--abandoned' : ''}`} role="status"><span className="workflow-concluded-inline-icon" aria-hidden="true"><SvgIcon name={project.attributes.journey_status_label === 'ABANDONED' ? 'x' : 'shield'} size={14} /></span><span className="workflow-concluded-inline-copy"><strong>{project.attributes.journey_status_label === 'ABANDONED' ? 'Journey abandoned — read-only' : handoverInProgress ? 'Project execution concluded — handover active' : 'Workflow concluded — read-only'}</strong><small>{project.attributes.journey_status_label === 'ABANDONED' ? 'No further updates or downstream actions are allowed.' : handoverInProgress ? 'Project updates are closed. Handover payment, customer acceptance and AMC commencement continue here.' : 'Project stage complete. Continue in the linked downstream workflow.'}</small></span></div>}</section>
      <ProjectJourneyStepper project={project} />
      <nav className="project-detail-tabs workflow-detail-tabs" role="tablist" aria-label="Project work areas">
        {([['overview', 'Overview'], ['readiness', 'Readiness & blockers'], ['execution', 'Stages & execution'], ['quality', 'QA & handover'], ['commercial', 'Commercial']] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={activeTab === key} onClick={() => setActiveTab(key)}>{label}</button>)}
      </nav>
      {activeTab === 'overview' && <><ProjectOverviewCommandCenter project={project} journey={journey} /><ProjectAccessGovernancePanel permissions={permissions} /><LegacyProjectDetailContent providerId={providerId} project={project} permissions={permissions} onEdit={() => setEditDialog(true)} onProjectChanged={() => { void refreshProject(); }} canEditIdentity={canEditWorkflow("SERVICE_JOB_EDIT") && ['DRAFT', 'OPEN'].includes(String(project.attributes.status).toUpperCase())} showPaymentSchedule={false} /></>}
      {activeTab === 'readiness' && <ProjectBlockersPanel providerId={providerId} project={project} permissions={permissions} />}
      <WorkflowFollowUpDialog open={followUpOpen} onClose={() => setFollowUpOpen(false)} providerId={providerId} targetResourceKind="ServiceCase" targetResourceId={project.id} stage="PROJECT" readOnly={workflowConcluded} title="Project journey follow-ups" />
      {timelineOpen && <JourneyTimelineDialog journey={journey} loading={journeyLoading} error="" emptyLabel="No journey events are available for this project." onClose={() => setTimelineOpen(false)} />}
      {activeTab === 'execution' && <><ProjectJobControl providerId={providerId} project={project} canCreateJob={canEditWorkflow("SERVICE_JOB_EDIT")} /><StagePlanning providerId={providerId} caseId={project.id} projectAssets={project.attributes.project_assets || []} canEditStages={canEditWorkflow("SERVICE_JOB_EDIT")} canExecuteStages={canExecuteStages && !workflowConcluded} /></>}
      {activeTab === 'quality' && <><ProjectQualitySummary project={project} /><QualityFindingPanel providerId={providerId} project={project} canEditFindings={canEditWorkflow("SERVICE_JOB_EDIT")} /><HandoverPanel providerId={providerId} project={project} canRequestHandover={canEditWorkflow("SERVICE_JOB_EDIT")} canCommenceCoverage={hasPermission("SERVICE_JOB_EDIT")} /></>}
      {activeTab === 'commercial' && <>
      <ProjectCommercialStagePanel providerId={providerId} project={project} permissions={permissions} onChanged={() => { void refreshProject(); void load(); }} />
      <ProjectLifecycleActions providerId={providerId} project={project} permissions={permissions} onSaved={onSaved} />
        <section className="detail-card project-change-orders">
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
        {error && <ActionNotification kind="error" title="Change-order action needs attention" onClose={() => setError("")}>{error}</ActionNotification>}
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
                <Status>{displayLabel(order.attributes.status, "Draft")}</Status>
                <strong>
                  {String(order.attributes.change_number || "Change order")} ·{" "}
                  {displayLabel(order.attributes.change_type, "Change")}
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
      <section className="detail-card project-payment-history">
        <h3>Payment history</h3>
        {payments?.data.length ? (
          payments.data.map((payment) => (
            <article className="record-card" key={payment.id}>
              <Status>{displayLabel(payment.attributes.status, "Not available")}</Status>
              <strong>
                {String(payment.attributes.payment_reference || "Payment record")}
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

function ProjectJourneyStepper({ project }: { project: Resource<ServiceCaseAttributes> }) {
  const status = String(project.attributes.status || "DRAFT").toUpperCase();
  const steps = [
    { key: "DRAFT", label: "Draft" },
    { key: "SUBMITTED", label: "Submitted" },
    { key: "APPROVED", label: "Approved" },
    { key: "ACTIVE", label: "Active" },
    { key: "EXECUTION", label: "Execution" },
    { key: "QA", label: "QA" },
    { key: "HANDOVER", label: "Handover" },
    { key: "COMPLETED", label: "Completed" },
  ];
  const index = status === "PENDING_APPROVAL" ? 1 : status === "IN_PROGRESS" || status === "INSTALLATION" ? 4 : steps.findIndex((step) => step.key === status) >= 0 ? steps.findIndex((step) => step.key === status) : 0;
  return <section className="project-journey-stepper" aria-label="Project lifecycle progress">
    {steps.map((step, stepIndex) => <div className={`project-journey-step${stepIndex < index ? " is-complete" : ""}${stepIndex === index ? " is-current" : ""}`} key={step.key}>
      <span className="project-journey-step-marker" aria-hidden="true">{stepIndex < index ? "✓" : stepIndex + 1}</span><span>{step.label}</span>
    </div>)}
  </section>;
}

function ProjectNextActionCard({ project, blockers }: { project: Resource<ServiceCaseAttributes>; blockers: number }) {
  const nextPayment = project.attributes.next_payment_schedule;
  const handoverEvents = project.attributes.handover_events || [];
  const coverageActive = handoverEvents.some((event) => String(event.event_kind).toUpperCase() === "COMMENCED");
  const handoverAccepted = handoverEvents.some((event) => String(event.event_kind).toUpperCase() === "ACCEPTED");
  const handoverRequested = handoverEvents.some((event) => String(event.event_kind).toUpperCase() === "REQUESTED");
  const title = blockers > 0
    ? `Resolve ${blockers} active blocker${blockers === 1 ? "" : "s"}`
    : nextPayment
      ? `Collect or authorize ${displayLabel(nextPayment.milestone_code, "payment stage")}`
      : coverageActive
        ? "AMC coverage active"
        : handoverAccepted
          ? "Commence AMC coverage"
          : handoverRequested
            ? "Complete customer handover"
            : "Continue project execution";
  const detail = blockers > 0
    ? "Dependencies are visible in Readiness & blockers. Resolve or notify the responsible stakeholder before progressing."
    : nextPayment
      ? `${nextPayment.description} · Outstanding ${nextPayment.outstanding_amount} · due ${nextPayment.due_on || "date not set"}`
      : coverageActive
        ? "The handed-over elevator unit has an active provider free-AMC coverage source. Continue with scheduled service work."
        : handoverAccepted
          ? "Customer handover is accepted. Select the approved provider free-AMC or warranty source in Quality & handover."
          : handoverRequested
            ? "The customer must acknowledge the requested elevator unit handover before coverage can start."
            : "Use the next lifecycle action allowed by your server-projected role.";
  return <section className={`project-next-action-card${blockers > 0 ? " is-blocked" : ""}`} aria-label="Project next action">
    <div><span className="eyebrow">Next action</span><h3>{title}</h3><p>{detail}</p></div><Status>{blockers > 0 ? "BLOCKED" : coverageActive ? "ACTIVE" : "READY"}</Status>
  </section>;
}

function ProjectOverviewCommandCenter({ project, journey }: { project: Resource<ServiceCaseAttributes>; journey: ProviderWorkJourney | null }) {
  const attributes = project.attributes;
  const progress = typeof attributes.progress_percent === "number" ? `${Math.round(attributes.progress_percent)}%` : "—";
  const activeBlockers = typeof attributes.active_blocker_count === "number" ? String(attributes.active_blocker_count) : "—";
  const criticalBlockers = typeof attributes.critical_blocker_count === "number" ? String(attributes.critical_blocker_count) : "—";
  const unitCount = attributes.project_assets ? String(attributes.project_assets.length) : "—";
  const stages = attributes.stage_count ?? attributes.stages?.length;
  const completedStages = attributes.completed_stage_count ?? attributes.stages?.filter((stage) => String(stage.status) === "COMPLETED").length;
  const nextPayment = attributes.next_payment_schedule;
  const latestEvents = (journey?.attributes.events || []).slice(0, 4);
  const milestoneSummary = (journey?.attributes.workflow_milestones || []).filter((milestone) => milestone.status !== "NOT_STARTED");

  return <section className="project-command-center" aria-label="Project delivery command center">
    <div className="project-command-intro">
      <div><span className="eyebrow">Delivery command center</span><h3>{attributes.title}</h3><p>{attributes.customer?.display_name || "Customer not linked"} · {projectClassificationLabel(attributes.project_classification_key)} · Revision {attributes.revision}</p></div>
      <Status>{attributes.journey_status_label === "ABANDONED" ? "Abandoned" : displayLabel(attributes.status, "Not available")}</Status>
    </div>
    <div className="project-command-kpis" aria-label="Project delivery summary">
      <div><span>Delivery progress</span><strong>{progress}</strong><small>{stages !== undefined ? `${completedStages ?? 0} of ${stages} stages complete` : "Server summary unavailable"}</small></div>
      <div><span>Active blockers</span><strong>{activeBlockers}</strong><small>{criticalBlockers === "—" ? "Readiness summary unavailable" : `${criticalBlockers} critical`}</small></div>
      <div><span>Next payment gate</span><strong>{nextPayment ? displayLabel(nextPayment.milestone_code, "Payment stage") : "None"}</strong><small>{nextPayment ? `Outstanding ${nextPayment.outstanding_amount} ${attributes.project_currency_code || "INR"}` : "No open stage returned"}</small></div>
      <div><span>Elevator units</span><strong>{unitCount}</strong><small>Per-unit execution tracking</small></div>
    </div>
    <div className="project-command-grid">
      <section className="project-command-panel"><div className="section-heading"><div><span className="eyebrow">Server-linked journey</span><h4>Delivery progress</h4><p>Only initiated stages are shown here; the full lifecycle remains available in the header stepper.</p></div></div>{milestoneSummary.length ? <div className="project-command-milestones">{milestoneSummary.map((milestone) => <div key={milestone.code} className={`project-command-milestone is-${milestone.status.toLowerCase()}`}><span aria-hidden="true">{milestone.status === "COMPLETED" ? "✓" : "•"}</span><div><strong>{milestone.label}</strong><small>{milestone.status === "COMPLETED" ? "Completed" : "Active"}{milestone.resource_count ? ` · ${milestone.resource_count} record${milestone.resource_count === 1 ? "" : "s"}` : ""}</small></div></div>)}</div> : <p className="notice">No downstream journey milestones have been initiated.</p>}</section>
      <section className="project-command-panel"><div className="section-heading"><div><span className="eyebrow">Readiness snapshot</span><h4>What needs attention</h4><p>Use the dedicated tabs for governed mutations and evidence.</p></div></div><div className="project-command-checklist"><div><span>Stage readiness</span><strong>{stages !== undefined ? `${completedStages ?? 0}/${stages} complete` : "Not available"}</strong></div><div><span>Payment control</span><strong>{nextPayment ? `${displayLabel(nextPayment.milestone_code, "Next stage")} · ${nextPayment.due_on || "Date not set"}` : "No open payment stage"}</strong></div><div><span>Blocker risk</span><strong className={criticalBlockers !== "0" && criticalBlockers !== "—" ? "is-risk" : ""}>{criticalBlockers === "—" ? "Not available" : criticalBlockers === "0" ? "No critical blockers" : `${criticalBlockers} critical blocker${criticalBlockers === "1" ? "" : "s"}`}</strong></div></div></section>
    </div>
    <section className="project-command-activity" aria-label="Recent project activity"><div className="section-heading"><div><span className="eyebrow">Recent activity</span><h4>Latest delivery events</h4></div><small>{latestEvents.length ? `${latestEvents.length} latest events` : "No events returned"}</small></div>{latestEvents.length ? <div className="project-command-event-list">{latestEvents.map((event) => <div key={event.id} className="project-command-event"><span className="project-command-event-dot" aria-hidden="true" /><div><strong>{displayLabel(event.attributes.action, "Project activity")}</strong><small>{event.attributes.actor_name || "Authorized provider actor"} · {event.attributes.occurred_at ? new Date(event.attributes.occurred_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Time not available"}</small></div></div>)}</div> : <p className="notice">The project history will appear after the first server-recorded action.</p>}</section>
  </section>;
}

function ProjectQualitySummary({ project }: { project: Resource<ServiceCaseAttributes> }) {
  const units = project.attributes.project_assets || [];
  const unitProgress = project.attributes.unit_progress || [];
  const completedUnits = unitProgress.filter((unit) => unit.progress_percent >= 100).length;
  return <section className="project-quality-summary" aria-label="Quality and handover summary"><div><span className="eyebrow">Quality gate</span><h3>Inspection & handover readiness</h3><p>Resolve open findings and complete each linked elevator unit independently before customer acceptance.</p></div><div className="project-quality-summary-facts"><div><span>Units in scope</span><strong>{units.length || "—"}</strong></div><div><span>Units complete</span><strong>{unitProgress.length ? `${completedUnits}/${unitProgress.length}` : "—"}</strong></div><div><span>Project progress</span><strong>{typeof project.attributes.progress_percent === "number" ? `${Math.round(project.attributes.progress_percent)}%` : "—"}</strong></div></div></section>;
}

function ProjectAccessGovernancePanel({ permissions }: { permissions: string[] }) {
  const checks = [
    ["Project setup & stage edits", "SERVICE_JOB_EDIT"],
    ["Project approval", "PROJECT_APPROVE"],
    ["Project activation", "PROJECT_ACTIVATE"],
    ["Payment evidence", "PAYMENT_RECORD"],
    ["Stage release", "PAYMENT_STAGE_RELEASE"],
    ["Execution evidence", "SERVICE_JOB_EXECUTE"],
  ] as const;
  return <section className="project-governance-panel" aria-label="Project access governance"><div><span className="eyebrow">Server-projected access</span><h3>Governed project actions</h3><p>These indicators come from the current provider capability response. The API remains authoritative for every action.</p></div><div className="project-governance-grid">{checks.map(([label, permission]) => <div key={permission}><span>{label}</span><Status>{permissions.includes(permission) ? "Available" : "Read only"}</Status></div>)}</div></section>;
}

function ProjectBlockersPanel({ providerId, project, permissions }: { providerId: string; project: Resource<ServiceCaseAttributes>; permissions: string[] }) {
  const [blockers, setBlockers] = useState<Collection<ServiceCaseBlockerAttributes> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const canEdit = permissions.includes("SERVICE_JOB_EDIT");
  const load = () => operationsData.blockers(providerId, project.id).then(setBlockers).catch((cause) => setError(fail(cause)));
  useEffect(() => { void load(); }, [providerId, project.id]);
  const active = (blockers?.data || []).filter((item) => ["OPEN", "IN_PROGRESS"].includes(item.attributes.status));
  return <>
    <section className="detail-card project-readiness-card">
      <div className="section-heading"><div><span className="eyebrow">Readiness gate</span><h3>Site readiness & blockers</h3><p>Track shaft, machine-room structure, electrical supply, payment and contractor dependencies before a stage is started.</p></div>{canEdit && <Button variant="secondary" onClick={() => setDialogOpen(true)}>Add blocker</Button>}</div>
      {error && <ActionNotification kind="error" title="Blocker action needs attention" onClose={() => setError("")}>{error}</ActionNotification>}
      {message && <ActionNotification title="Blocker update completed" onClose={() => setMessage("")}>{message}</ActionNotification>}
      <div className="feature-summary-grid project-summary-grid"><div><span>Active blockers</span><strong>{active.length}</strong><small>Open dependencies</small></div><div><span>Critical</span><strong>{active.filter((item) => item.attributes.severity === "CRITICAL").length}</strong><small>Needs escalation</small></div><div><span>Stakeholders</span><strong>{new Set(active.map((item) => item.attributes.stakeholder_type)).size}</strong><small>Customer / builder / contractor</small></div></div>
      <div className="project-readiness-layout">
        <div className="project-readiness-blockers">{active.length ? active.map((item) => <article className="record-card project-blocker-card" key={item.id}><div className="record-card-heading"><Status>{displayLabel(item.attributes.severity, "Normal")}</Status><Status>{displayLabel(item.attributes.status, "Open")}</Status></div><strong>{item.attributes.title}</strong><span>{item.attributes.description}</span><small>{displayLabel(item.attributes.category, "Readiness")} · {displayLabel(item.attributes.stakeholder_type, "Stakeholder")} {item.attributes.stakeholder_name ? `· ${item.attributes.stakeholder_name}` : ""}{item.attributes.due_on ? ` · due ${item.attributes.due_on}` : ""}</small>{item.attributes.impact_days > 0 && <small>Estimated impact: {item.attributes.impact_days} day{item.attributes.impact_days === 1 ? "" : "s"}</small>}<div className="action-footer">{canEdit && <Button variant="secondary" onClick={() => void operationsData.notifyBlocker(providerId, item.id, { expected_revision: item.attributes.revision }, uuid()).then(() => { setMessage("Stakeholder notification request recorded in the project history."); return load(); }).catch((cause) => setError(fail(cause)))}>Notify stakeholder</Button>}{canEdit && <Button variant="secondary" onClick={() => void operationsData.transitionBlocker(providerId, item.id, { expected_revision: item.attributes.revision, transition: "RESOLVED", resolution_note: "Resolved after stakeholder confirmation" }, uuid()).then(() => { setMessage("Blocker resolved and the project gate was re-evaluated."); return load(); }).catch((cause) => setError(fail(cause)))}>Mark resolved</Button>}</div></article>) : <p className="notice">No active blockers. Add a readiness or dependency exception when the next stage cannot proceed.</p>}</div>
        <aside className="project-readiness-impact"><span className="eyebrow">Gate impact</span><h4>Before the next stage starts</h4><p>Resolve or explicitly notify every active dependency. The server still decides whether a stage, shipment or handover action can proceed.</p><ul><li><strong>{active.filter((item) => item.attributes.blocking).length}</strong><span>blocking dependencies</span></li><li><strong>{active.filter((item) => item.attributes.severity === "CRITICAL").length}</strong><span>critical escalations</span></li><li><strong>{new Set(active.map((item) => item.attributes.category)).size}</strong><span>readiness categories</span></li></ul></aside>
      </div>
    </section>
    <section className="detail-card project-readiness-guidance-card"><div className="section-heading"><div><h3>Readiness checklist guidance</h3><p>Use the existing checklist/evidence workflow for the source proof; this panel stores only the exception that needs coordination.</p></div></div><div className="readiness-guidance-grid"><div><strong>Structure</strong><span>Shaft dimensions and plumb, pit/waterproofing, overhead, machine-room foundation/access, anchors, landing openings and lifting path.</span></div><div><strong>Electrical</strong><span>Dedicated supply, voltage/phase/frequency, isolator/protection, earthing, lighting/socket, ventilation, emergency lighting and ARD/generator readiness.</span></div></div></section>
    {dialogOpen && <BlockerDialog providerId={providerId} caseId={project.id} close={() => setDialogOpen(false)} saved={() => { setDialogOpen(false); setMessage("Project blocker recorded."); void load(); }} />}
  </>;
}

function BlockerDialog({ providerId, caseId, close, saved }: { providerId: string; caseId: string; close: () => void; saved: () => void }) {
  const [form, setForm] = useState({ category: "SITE_READINESS", severity: "WARNING", stakeholder_type: "BUILDER", stakeholder_name: "", stakeholder_reference: "", title: "", description: "", due_on: "", impact_days: "0", blocking: true });
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); try { await operationsData.createBlocker(providerId, caseId, { ...form, impact_days: Number(form.impact_days) }, uuid()); saved(); } catch (cause) { setError(fail(cause)); } finally { setBusy(false); } }
  return <OperationsDialog title="Add project blocker" busy={busy} onClose={close}><form className="provider-form project-action-form" onSubmit={(event) => void submit(event)}>{error && <p className="feature-error" role="alert">{error}</p>}<div className="form-grid-two"><label>Category *<select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="SITE_READINESS">Site readiness</option><option value="STRUCTURAL">Structural</option><option value="ELECTRICAL">Electrical</option><option value="MATERIAL">Material</option><option value="PAYMENT">Payment</option><option value="DEPENDENCY">Dependency</option><option value="QA">QA</option></select></label><label>Severity *<select required value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}><option>INFO</option><option>WARNING</option><option>CRITICAL</option></select></label></div><label>Title *<input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Electrical supply not ready" /></label><label>Description *<textarea required maxLength={4000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe what is missing and what must happen next." /></label><div className="form-grid-two"><label>Stakeholder *<select value={form.stakeholder_type} onChange={(event) => setForm({ ...form, stakeholder_type: event.target.value })}><option>CUSTOMER</option><option>BUILDER</option><option>CONTRACTOR</option><option>INTERNAL</option><option>OTHER</option></select></label><label>Target contact/name<input value={form.stakeholder_name} onChange={(event) => setForm({ ...form, stakeholder_name: event.target.value })} /></label></div><label>Contact reference<input value={form.stakeholder_reference} onChange={(event) => setForm({ ...form, stakeholder_reference: event.target.value })} placeholder="Phone or email" /></label><div className="form-grid-two"><label>Due date<input type="date" value={form.due_on} onChange={(event) => setForm({ ...form, due_on: event.target.value })} /></label><label>Expected impact (days)<input type="number" min="0" step="1" value={form.impact_days} onChange={(event) => setForm({ ...form, impact_days: event.target.value })} /></label></div><label><input type="checkbox" checked={form.blocking} onChange={(event) => setForm({ ...form, blocking: event.target.checked })} /> Blocks dependent project progress</label><Button type="submit" busy={busy}>Save blocker</Button></form></OperationsDialog>;
}

function ProjectLifecycleActions({ providerId, project, permissions, onSaved }: { providerId: string; project: Resource<ServiceCaseAttributes>; permissions: string[]; onSaved: (project: Resource<ServiceCaseAttributes>) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const workflowConcluded = project.attributes.journey_stage_status === 'COMPLETED' || project.attributes.journey_status === 'CANCELLED';
  const next = project.attributes.status === "OPEN" || project.attributes.status === "DRAFT" || project.attributes.status === "REJECTED" ? "SUBMITTED" : project.attributes.status === "SUBMITTED" || project.attributes.status === "PENDING_APPROVAL" ? "APPROVED" : project.attributes.status === "APPROVED" ? "ACTIVE" : null;
  const requiredPermission = next === "SUBMITTED" ? "SERVICE_JOB_EDIT" : next === "APPROVED" ? "PROJECT_APPROVE" : next === "ACTIVE" ? "PROJECT_ACTIVATE" : null;
  if (workflowConcluded || !next || !requiredPermission || !permissions.includes(requiredPermission)) return null;
  async function transition() {
    setBusy(true); setError("");
    try { const updated = await operationsData.transitionServiceCase(providerId, project.id, { transition: next, expected_revision: project.attributes.revision }, uuid()); onSaved(updated); } catch (cause) { setError(fail(cause)); } finally { setBusy(false); }
  }
  return <section className="detail-card project-lifecycle-actions" aria-label="Project lifecycle actions"><div className="section-heading"><div><h3>Project lifecycle</h3><p>Submission, approval and activation are separate server-controlled decisions. Activation does not settle payments or complete execution.</p></div><Status>{displayLabel(project.attributes.status, "Not available")}</Status></div>{error && <ActionNotification kind="error" title="Project lifecycle action needs attention" onClose={() => setError('')}>{error}</ActionNotification>}<Button variant="secondary" busy={busy} onClick={() => void transition()}>{next === "SUBMITTED" ? "Submit for approval" : next === "APPROVED" ? "Approve project" : "Activate project"}</Button></section>;
}

function ProjectCommercialStagePanel({ providerId, project, permissions, onChanged }: { providerId: string; project: Resource<ServiceCaseAttributes>; permissions: string[]; onChanged: () => void }) {
  const [schedules, setSchedules] = useState<Collection<PaymentScheduleAttributes> | null>(null);
  const [payments, setPayments] = useState<Collection<PaymentAttributes> | null>(null);
  const [activeSchedule, setActiveSchedule] = useState<Resource<PaymentScheduleAttributes> | null>(null);
  const [dialog, setDialog] = useState<"schedule" | "payment" | "release" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [verifyingPaymentId, setVerifyingPaymentId] = useState<string | null>(null);
  const canRecordPayment = permissions.includes("PAYMENT_RECORD");
  const canReleaseStage = permissions.includes("PAYMENT_STAGE_RELEASE");
  const paymentStagePolicy = project.attributes.payment_stage_policy;
  const paymentStagesAllowed = paymentStagePolicy?.enabled !== false;
  const paymentStagesFrozen = paymentStagePolicy?.frozen === true;
  const load = () => Promise.all([
    operationsData.paymentSchedules(providerId, project.id),
    operationsData.payments(providerId, project.id),
  ]).then(([stageRows, paymentRows]) => {
    setSchedules(stageRows);
    setPayments(paymentRows);
  }).catch((cause) => setError(fail(cause)));
  useEffect(() => { void load(); }, [providerId, project.id]);
  const record = (schedule: Resource<PaymentScheduleAttributes>, next: "payment" | "release") => { setActiveSchedule(schedule); setDialog(next); setError(""); setMessage(""); };
  async function verifyPayment(payment: Resource<PaymentAttributes>) {
    setVerifyingPaymentId(payment.id);
    setError("");
    setMessage("");
    try {
      await operationsData.transitionPayment(providerId, payment.id, {
        transition: "SETTLED",
        expected_revision: payment.attributes.revision,
      }, uuid());
      setMessage("Payment evidence verified and settled.");
      await load();
      onChanged();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setVerifyingPaymentId(null);
    }
  }
  return <section className="project-commercial-stage-panel" aria-label="Payment stages and release control">
    <div className="section-heading"><div><span className="eyebrow">Commercial gate</span><h3>Payment stages & release control</h3><p>Stage-first view of the accepted commercial baseline. Allocation, credit and release decisions remain server-controlled and auditable.</p>{project.attributes.journey_stage_status === 'COMPLETED' && <small className="notice-inline">Project scope is read-only; Handover settlement and release remain available until financial close.</small>}</div>{canRecordPayment && paymentStagesAllowed && !paymentStagesFrozen && <Button variant="secondary" onClick={() => setDialog("schedule")}>Add payment stage</Button>}</div>
    {error && <ActionNotification kind="error" title="Payment stage action needs attention" onClose={() => setError("")}>{error}</ActionNotification>}
    {message && <ActionNotification title="Payment stage updated" onClose={() => setMessage("")}>{message}</ActionNotification>}
    {!paymentStagesAllowed && <p className="notice">Stage payments are not applicable to this project. AMC/service commercial terms remain contract-scoped.</p>}
    {paymentStagesAllowed && paymentStagesFrozen && <p className="notice">The accepted quotation froze the percentage plan. Collections, allocation evidence and authorized release remain available.</p>}
    {schedules?.data.length ? <div className="project-commercial-stage-list">{schedules.data.map((schedule) => { const due = Number(schedule.attributes.due_amount || 0); const collected = Number(schedule.attributes.collected_amount || 0); const outstanding = Number(schedule.attributes.outstanding_amount || 0); const collectedPercent = due > 0 ? Math.min(100, Math.round((collected / due) * 100)) : 0; const stagePayments = (payments?.data || []).filter((payment) => payment.attributes.payment_schedule_id === schedule.id || payment.attributes.allocations?.some((allocation) => allocation.payment_schedule_id === schedule.id)); return <article className="project-commercial-stage" key={schedule.id}><div className="project-commercial-stage-heading"><div><Status>{displayLabel(schedule.attributes.status, "Open")}</Status><h4>{displayLabel(schedule.attributes.milestone_code, "Payment stage")}</h4><p>{schedule.attributes.description}</p></div><strong>{schedule.attributes.currency_code} {schedule.attributes.due_amount}</strong></div><div className="project-commercial-stage-progress"><span style={{ width: `${collectedPercent}%` }} /><small>{collectedPercent}% collected · {schedule.attributes.currency_code} {schedule.attributes.outstanding_amount} outstanding</small></div><div className="project-commercial-stage-facts"><span>Due <strong>{schedule.attributes.due_on || "Date not set"}</strong></span><span>Collected <strong>{schedule.attributes.collected_amount}</strong></span><span>Release <strong>{outstanding <= 0 ? "Eligible for review" : "Awaiting evidence"}</strong></span></div>{stagePayments.length > 0 && <div className="project-commercial-payment-evidence" aria-label={`${displayLabel(schedule.attributes.milestone_code, "Payment stage")} payment evidence`}><strong>Payment evidence</strong>{stagePayments.map((payment) => <div className="project-commercial-payment-row" key={payment.id}><span><Status>{displayLabel(payment.attributes.status, "Received")}</Status><strong>{payment.attributes.payment_reference}</strong><small>{displayLabel(payment.attributes.method, "Payment method")} · {payment.attributes.amount} {payment.attributes.currency_code}</small></span>{canReleaseStage && ["RECEIVED", "PENDING_VERIFICATION"].includes(payment.attributes.status) && <Button variant="quiet" busy={verifyingPaymentId === payment.id} disabled={verifyingPaymentId !== null} onClick={() => void verifyPayment(payment)}>Verify settlement</Button>}</div>)}</div>}<div className="action-footer">{canRecordPayment && outstanding > 0 && <Button variant="secondary" onClick={() => record(schedule, "payment")}>Record collection</Button>}{canReleaseStage && outstanding <= 0 && <Button variant="secondary" onClick={() => record(schedule, "release")}>Authorize stage release</Button>}</div></article>; })}</div> : schedules ? <p className="notice">No payment stages have been configured for this project.</p> : <p className="notice">Loading payment stages…</p>}
    {dialog === "schedule" && <PaymentScheduleDialog providerId={providerId} caseId={project.id} expectedRevision={project.attributes.revision} initialBasis={project.attributes.adjusted_project_total || project.attributes.payment_schedule_total || "0"} initialStages={paymentStagePolicy?.stages || []} close={() => setDialog(null)} saved={() => { setDialog(null); setMessage("Payment stage recorded."); void load(); onChanged(); }} />}
    {dialog === "payment" && activeSchedule && <PaymentDialog providerId={providerId} caseId={project.id} schedule={activeSchedule} close={() => setDialog(null)} saved={() => { setDialog(null); setMessage("Payment evidence recorded for verification."); void load(); onChanged(); }} />}
    {dialog === "release" && activeSchedule && <StageReleaseDialog providerId={providerId} caseId={project.id} schedule={activeSchedule} close={() => setDialog(null)} saved={() => { setDialog(null); setMessage("Stage release decision recorded."); void load(); onChanged(); }} />}
  </section>;
}

function LegacyProjectDetailContent({
  providerId,
  project,
  permissions,
  onEdit,
  onProjectChanged,
  canEditIdentity,
  showPaymentSchedule = true,
}: {
  providerId: string;
  project: Resource<ServiceCaseAttributes>;
  permissions: string[];
  onEdit: () => void;
  onProjectChanged: () => void;
  canEditIdentity: boolean;
  showPaymentSchedule?: boolean;
}) {
  const can = (code: string) => permissions.includes(code);
  const canEditProject = can("SERVICE_JOB_EDIT");
  const canReleaseMaterials = can("MATERIAL_SHIPMENT_RELEASE");
  const canVerifyDelivery = can("MATERIAL_DELIVERY_VERIFY");
  const canRecordPayment = can("PAYMENT_RECORD");
  const canReleaseStage = can("PAYMENT_STAGE_RELEASE");
  const paymentStagePolicy = project.attributes.payment_stage_policy;
  const paymentStagesAllowed = paymentStagePolicy?.enabled !== false;
  const paymentStagesFrozen = paymentStagePolicy?.frozen === true;
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
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("Project delivery, handover and first preventive AMC cycle completed.");
  const [closeBusy, setCloseBusy] = useState(false);
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
      <div className="feature-detail project-overview-detail">
        <div className="section-heading project-overview-heading">
          <div>
            <h2>{project.attributes.title}</h2>
            <p>
              {projectClassificationLabel(project.attributes.project_classification_key)} ·
              Provider-owned project
            </p>
          </div>
          <div className="project-overview-heading-actions">
            <Status>{displayLabel(project.attributes.status, "Not available")}</Status>
            {canEditIdentity && <Button variant="secondary" onClick={onEdit}><SvgIcon name="pencil" size={15} /> Edit project</Button>}
          </div>
        </div>
        {error && <ActionNotification kind="error" title="Project action needs attention" onClose={() => setError("")}>{error}</ActionNotification>}
        {message && <ActionNotification title="Project update completed" onClose={() => setMessage("")}>{message}</ActionNotification>}
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
          {canEditProject && paymentStagesAllowed && !paymentStagesFrozen && <Button variant="secondary" onClick={() => setDialog("schedule")}>
            Add payment milestone
          </Button>}
          {can("PROJECT_APPROVE") && String(project.attributes.status).toUpperCase() === "ACTIVE" && project.attributes.project_close_ready && <Button variant="secondary" onClick={() => setCloseOpen(true)}>
            Close project
          </Button>}
        </div>
        {can("PROJECT_APPROVE") && String(project.attributes.status).toUpperCase() === "ACTIVE" && !project.attributes.project_close_ready && (project.attributes.project_close_blockers || []).length > 0 && <p className="notice">Project close is locked until: {project.attributes.project_close_blockers?.join("; ")}</p>}
        <section className="project-material-gate" aria-label="Materials and delivery release gate">
          <div><span className="eyebrow">Execution gate</span><h3>Materials & delivery</h3><p>Planned scope, payment evidence and dispatch records stay provider-scoped. The API decides when release is permitted.</p></div>
          <div className="project-material-gate-facts"><div><span>Material scope</span><strong>{requirements ? `${requirements.data.length} line${requirements.data.length === 1 ? "" : "s"}` : "Loading…"}</strong></div><div><span>Payment evidence</span><strong>{schedules ? (schedules.data.some((schedule) => Number(schedule.attributes.outstanding_amount || 0) <= 0) ? "Stage settled" : "Pending" ) : "Loading…"}</strong></div><div><span>Dispatch records</span><strong>{shipments ? String(shipments.data.length) : "Loading…"}</strong></div></div>
        </section>
        <section className="detail-card project-linked-jobs">
          <h3>Linked installation jobs</h3>
          {linkedJobs?.data.length ? (
            linkedJobs.data.map((job) => (
              <article className="record-card" key={job.id}>
                <strong>
                  {String(job.attributes.service_job_number || job.attributes.service_job_reference || "Installation job")}
                </strong>
                <span>
                  {displayLabel(job.attributes.role, "Installation")} · execution
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
        <section className="detail-card project-material-requirements">
          <h3>Material requirements</h3>
          <p className="notice">
            Planned materials are captured from the accepted quotation snapshot or added to this project by the provider. Inventory and stock are not represented here.
          </p>
          {requirements?.data.length ? (
            requirements.data.map((item) => (
              <article className="record-card" key={item.id}>
                <strong>{item.attributes.description}</strong>
                <span>
                  Planned {item.attributes.required_quantity}{" "}
                  {item.attributes.unit_code} · Accepted{" "}
                  {item.attributes.accepted_quantity} · Rejected{" "}
                  {item.attributes.rejected_quantity} · Remaining{" "}
                  {item.attributes.remaining_quantity}
                </span>
                <small>
                  {item.attributes.source_kind === "QUOTATION_SNAPSHOT"
                    ? `Quotation snapshot${item.attributes.source_quotation_number ? ` · ${item.attributes.source_quotation_number}` : ""}${item.attributes.source_quotation_revision ? ` · Revision ${item.attributes.source_quotation_revision}` : ""}`
                    : "Project-added material"}
                  {item.attributes.category ? ` · ${displayLabel(item.attributes.category)}` : ""}
                </small>
                {item.attributes.notes && <small>{item.attributes.notes}</small>}
              </article>
            ))
          ) : (
            <p className="notice">No requirements recorded.</p>
          )}
        </section>
        <section className="detail-card project-shipments">
          <h3>Shipments</h3>
          {shipments?.data.length ? (
            shipments.data.map((item) => (
              <article className="record-card" key={item.id}>
                <Status>{displayLabel(item.attributes.status, "Not available")}</Status>
                <strong>{item.attributes.shipment_number}</strong>
                {item.attributes.lines.map((line) => (
                  <span key={line.id}>
                    {displayLabel(line.description, "Material line")}: dispatched {line.dispatched_quantity},
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
        {showPaymentSchedule && <section className="detail-card project-payment-schedule">
          <h3>Customer payment schedule</h3>
          {!paymentStagesAllowed && <p className="notice">Stage payments are not applicable to this quotation type. AMC/service commercial terms are managed as a contract or service total.</p>}
          {paymentStagesAllowed && paymentStagesFrozen && <p className="notice">Payment stages were frozen when the quotation was issued. Collections and release evidence remain available; the percentage plan cannot be changed here.</p>}
          {schedules?.data.length ? (
            schedules.data.map((schedule) => (
              <article className="record-card" key={schedule.id}>
                <Status>{displayLabel(schedule.attributes.status, "Not available")}</Status>
                <strong>
                  {displayLabel(schedule.attributes.milestone_code, "Payment stage")} —{" "}
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
        </section>}
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
            onProjectChanged();
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
            onProjectChanged();
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
            onProjectChanged();
          }}
        />
      )}
      {dialog === "schedule" && (
        <PaymentScheduleDialog
          providerId={providerId}
          caseId={project.id}
          expectedRevision={project.attributes.revision}
          initialBasis={project.attributes.adjusted_project_total || project.attributes.payment_schedule_total || "0"}
          initialStages={project.attributes.payment_stage_policy?.stages || []}
          close={() => setDialog(null)}
          saved={() => {
            setDialog(null);
            setMessage("Payment milestone recorded.");
            void reload();
            onProjectChanged();
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
            onProjectChanged();
          }}
        />
      )}
      {dialog === "release" && activeSchedule && (
        <StageReleaseDialog providerId={providerId} caseId={project.id} schedule={activeSchedule} close={() => setDialog(null)} saved={() => { setDialog(null); setMessage("Stage release decision recorded."); void reload(); onProjectChanged(); }} />
      )}
      {closeOpen && <OperationsDialog title="Close project" busy={closeBusy} onClose={() => setCloseOpen(false)}><form className="provider-form project-action-form" onSubmit={(event) => { event.preventDefault(); setCloseBusy(true); setError(""); void operationsData.closeServiceCase(providerId, project.id, { expected_revision: project.attributes.revision, reason: closeReason }, uuid()).then(() => { setCloseOpen(false); setMessage("Project closed. AMC and service history remains available from the shared journey."); onProjectChanged(); }).catch((cause) => setError(fail(cause))).finally(() => setCloseBusy(false)); }}><p className="notice">This records the governed project close after handover acceptance and the first preventive service report. The AMC/service journey remains active.</p><label>Close reason *<textarea required minLength={3} maxLength={500} value={closeReason} onChange={(event) => setCloseReason(event.target.value)} /></label>{error && <p className="feature-error" role="alert">{error}</p>}<div className="provider-form-actions"><Button type="button" variant="quiet" onClick={() => setCloseOpen(false)}>Cancel</Button><Button type="submit" busy={closeBusy}>Confirm close</Button></div></form></OperationsDialog>}
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
      <section className="detail-card project-quality-findings" aria-label="Quality findings">
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
      {error && <ActionNotification kind="error" title="Quality action needs attention" onClose={() => setError("")}>{error}</ActionNotification>}
      {message && <ActionNotification durationMs={null} title="Quality update completed" onClose={() => setMessage("")}>{message}</ActionNotification>}
      {findings?.data.some((finding) => ["RECTIFICATION_IN_PROGRESS", "READY_FOR_REINSPECTION"].includes(finding.attributes.status)) && <label className="reinspection-evidence-field">Reinspection evidence reference<input aria-label="Reinspection evidence document ID" placeholder="Paste the approved evidence reference" value={form.evidence_id} onChange={(event) => setForm({ ...form, evidence_id: event.target.value })} /></label>}
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
                {unit.display_name || "Elevator unit"}
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
              <Status>{displayLabel(finding.attributes.status, "Not available")}</Status>
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
  canCommenceCoverage,
}: {
  providerId: string;
  project: Resource<ServiceCaseAttributes>;
  canRequestHandover: boolean;
  canCommenceCoverage: boolean;
}) {
  const units = project.attributes.project_assets || [];
  const [assetId, setAssetId] = useState(units.length === 1 ? units[0].id : "");
  const [evidenceId, setEvidenceId] = useState("");
  const [events, setEvents] = useState<Array<Resource<GenericAttributes>>>(() =>
    (project.attributes.handover_events || []).map((event) => ({
      id: event.id,
      type: "service-case-handover-evidence",
      attributes: event,
      relationships: {},
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [sources, setSources] = useState<Collection<GenericAttributes> | null>(null);
  const [sourceId, setSourceId] = useState("");
  useEffect(() => {
    setEvents(
      (project.attributes.handover_events || []).map((event) => ({
        id: event.id,
        type: "service-case-handover-evidence",
        attributes: event,
        relationships: {},
      })),
    );
  }, [project.id, project.attributes.revision, project.attributes.handover_events]);
  useEffect(() => {
    if (!canCommenceCoverage || !events.some((event) => String(event.attributes.event_kind) === "ACCEPTED")) {
      setSources(null);
      return;
    }
    void operationsData.coverageSources(providerId, project.id)
      .then(setSources)
      .catch(() => setSources({ data: [] }));
  }, [canCommenceCoverage, providerId, project.id, events]);
  const requestableUnits = units.filter((unit) => !events.some((event) => event.attributes.asset_id === unit.id && ["REQUESTED", "ACCEPTED"].includes(String(event.attributes.event_kind))));
  const commencedEvent = events.find((event) => String(event.attributes.event_kind) === "COMMENCED");
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
  async function commenceCoverage() {
    const source = sources?.data.find((item) => item.id === sourceId);
    if (!source) { setError("Select an approved coverage source before commencing AMC."); return; }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const commenced = await operationsData.commenceCoverage(providerId, project.id, {
        expected_revision: project.attributes.revision,
        asset_id: units.length === 1 ? units[0].id : undefined,
        ...(source.attributes.kind === "WARRANTY" ? { source_warranty_id: source.id } : { source_contract_version_id: source.id }),
        effective_from: new Date().toISOString(),
      }, uuid());
      setEvents((current) => [...current, commenced]);
      setMessage("AMC coverage commenced for the handed-over elevator unit.");
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="detail-card project-handover-panel" aria-label="Quality and handover">
      <div className="section-heading">
        <div>
          <h3>Quality and handover</h3>
          <p>
            Request and acknowledge handover per elevator unit only after
            server-enforced milestone, evidence and authorization gates pass.
          </p>
        </div>
        {canRequestHandover && requestableUnits.length > 0 && <Button variant="secondary" onClick={() => { setAssetId(requestableUnits[0].id); setShowRequestDialog(true); }}>Request handover</Button>}
      </div>
      {!units.length && <p className="notice">Per-unit handover is unavailable until an authorized elevator unit is linked to this project.</p>}
      {units.length > 1 && (
        <p className="notice">
          This project has {units.length} elevator units. Select one unit;
          handing over one unit does not complete the others.
        </p>
      )}
      {error && <ActionNotification kind="error" title="Handover action needs attention" onClose={() => setError("")}>{error}</ActionNotification>}
      {message && <ActionNotification title="Handover update completed" onClose={() => setMessage("")}>{message}</ActionNotification>}
      <section className="amc-coverage-placeholder" aria-label="AMC coverage after handover">
        <div>
          <span className="page-eyebrow">Coverage after handover</span>
          <h3>Provider free AMC</h3>
          <p>Free AMC becomes customer maintenance coverage only after an accepted unit handover and an approved, provider-scoped source are selected.</p>
        </div>
        <div className="amc-coverage-placeholder-state">{commencedEvent ? <><Status>Active</Status><span>Coverage commenced for {units.length === 1 ? units[0].display_name || "the handed-over unit" : "the accepted unit"}.</span></> : !canCommenceCoverage ? <><Status>Provider operation required</Status><span>Coverage commencement is available to an authorized provider operations role.</span></> : <>{sources?.data.length ? <><Status>Ready</Status><select aria-label="AMC coverage source" value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">Select approved source</option>{sources.data.map((source) => { const plan = source.attributes.amc_plan as { name?: string; version?: number } | undefined; return <option value={source.id} key={source.id}>{String(source.attributes.label || source.id)}{plan?.name ? ` · ${plan.name} v${plan.version || 1}` : ""}</option>; })}</select><Button variant="secondary" busy={busy} disabled={!sourceId || !events.some((event) => String(event.attributes.event_kind) === "ACCEPTED")} onClick={() => void commenceCoverage()}>Commence AMC coverage</Button></> : <><Status>Source required</Status><span>{events.some((event) => String(event.attributes.event_kind) === "ACCEPTED") ? "No active scoped contract or warranty is available for this unit." : "Customer unit acceptance is required before coverage can start."}</span><Button variant="secondary" onClick={() => { window.location.hash = "amc"; }}>Open AMC contracts</Button></>}</>}</div>
      </section>
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
                {unit.display_name || "Elevator unit"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Handover evidence reference *
          <input
            aria-label="Handover evidence document ID"
            required
            value={evidenceId}
            onChange={(event) => setEvidenceId(event.target.value)}
            placeholder="Approved evidence reference"
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
      {events.length > 0 && <div className="record-grid">{units.map((unit) => { const unitEvents = events.filter((event) => event.attributes.asset_id === unit.id); const accepted = unitEvents.some((event) => String(event.attributes.event_kind) === "ACCEPTED"); const requested = unitEvents.some((event) => String(event.attributes.event_kind) === "REQUESTED"); const commenced = unitEvents.some((event) => String(event.attributes.event_kind) === "COMMENCED"); return <article className="record-card" key={unit.id}><Status>{commenced ? "AMC active" : accepted ? "Accepted" : requested ? "Awaiting customer" : "Not requested"}</Status><strong>{unit.display_name || "Elevator unit"}</strong><span>{commenced ? "Coverage commenced" : accepted ? "Customer accepted handover" : requested ? "Awaiting customer acknowledgment in the customer portal." : "Ready for provider handover request."}</span><small>{unitEvents.length ? `Latest server revision ${String(unitEvents[unitEvents.length - 1].attributes.service_case_revision || project.attributes.revision)}` : "No handover event recorded"}</small></article>; })}</div>}
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
  const hasExecutionLocation = Boolean(project.attributes.service_location_id || (project.attributes.project_assets || []).length);
  return (
    <section className="detail-card project-execution-control">
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
          disabled={!hasExecutionLocation}
          onClick={() => {
            setError("");
            setDialog(true);
          }}
        >
          Create installation job
        </Button>}
      </div>
      {!hasExecutionLocation && <p className="notice" role="status">A project service location or a linked elevator unit with an active service site is required before an installation job can be created.</p>}
      {message && <ActionNotification title="Project execution update completed" onClose={() => setMessage("")}>{message}</ActionNotification>}
      {error && <ActionNotification kind="error" title="Project execution action needs attention" onClose={() => setError("")}>{error}</ActionNotification>}
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
                  item.attributes.name || (item.attributes.code ? displayLabel(item.attributes.code) : "Authorized service type"),
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
                  {asset.display_name || "Elevator unit"}
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
  const stageColumns = [
    ["READY", "Ready"],
    ["IN_PROGRESS", "In progress"],
    ["COMPLETED", "Completed"],
  ] as const;
  const stageCard = (stage: Resource<GenericAttributes>) => <article className="record-card project-stage-card" key={stage.id}>
    <Status>{displayLabel(stage.attributes.status, "Ready")}</Status>
    <strong>{String(stage.attributes.title || (stage.attributes.code ? displayLabel(stage.attributes.code) : "Execution stage"))}</strong>
    <span>{stage.attributes.asset_id ? `Elevator unit ${projectAssets.find((asset) => asset.id === stage.attributes.asset_id)?.display_name || "selected"}` : "Project-wide milestone"}{stage.attributes.planned_start_at ? ` · Planned ${String(stage.attributes.planned_start_at)}` : ""}</span>
    {canExecuteStages && ["READY", "IN_PROGRESS"].includes(String(stage.attributes.status)) && <Button variant="secondary" onClick={() => void operationsData.transitionServiceStage(providerId, stage.id, { transition: String(stage.attributes.status) === "READY" ? "IN_PROGRESS" : "COMPLETED", expected_revision: Number(stage.attributes.revision || 1), evidence_ids: String(stage.attributes.status) === "IN_PROGRESS" ? [crypto.randomUUID()] : undefined }, uuid()).then(reload).catch((cause) => setError(fail(cause)))}>{String(stage.attributes.status) === "IN_PROGRESS" ? "Complete milestone" : "Start milestone"}</Button>}
  </article>;
  return (
    <section className="detail-card project-execution-planning">
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
                {asset.display_name || "Elevator unit"}: {unitCompleted}/
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
        <div className="project-execution-board" aria-label="Installation execution board">
          {stageColumns.map(([status, label]) => <section className="project-execution-column" key={status}><div className="project-execution-column-heading"><h4>{label}</h4><span>{rows.filter((stage) => String(stage.attributes.status) === status).length}</span></div>{rows.filter((stage) => String(stage.attributes.status) === status).map(stageCard)}</section>)}
          {rows.some((stage) => !stageColumns.some(([status]) => status === String(stage.attributes.status))) && <section className="project-execution-column"><div className="project-execution-column-heading"><h4>Other</h4><span>{rows.filter((stage) => !stageColumns.some(([status]) => status === String(stage.attributes.status))).length}</span></div>{rows.filter((stage) => !stageColumns.some(([status]) => status === String(stage.attributes.status))).map(stageCard)}</section>}
        </div>
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
                  {asset.display_name || "Elevator unit"}
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
                {String(stage.attributes.title || (stage.attributes.code ? displayLabel(stage.attributes.code) : "Execution stage"))} ·{" "}
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
        {message && <ActionNotification title="Delivery proof update completed" onClose={() => setMessage("")}>{message}</ActionNotification>}
        {error && <ActionNotification kind="error" title="Delivery proof action needs attention" onClose={() => setError("")}>{error}</ActionNotification>}
      </form>
      {documents?.data.length ? (
        <div aria-label="Finalized delivery proof">
          {documents.data.map((document) => (
            <p key={document.id}>
              {document.attributes.filename} · {displayLabel(document.attributes.status, "Not available")} ·{" "}
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

type PaymentStageSeed = {
  code: string;
  description: string;
  percentage: string | number;
  sequence: number;
  trigger_kind: string;
  customer_acceptance_required?: boolean;
};

const PAYMENT_RELEASE_CONDITIONS = [
  ["", "No material release condition"],
  ["SETTLED_PAYMENT", "Settled payment"],
  ["APPROVED_CREDIT", "Approved customer credit"],
  ["CUSTOMER_ACCEPTANCE", "Customer acceptance"],
  ["HANDOVER_APPROVAL", "Handover approval"],
] as const;

function seededPaymentStages(initialStages: PaymentStageSeed[]) {
  if (initialStages.length > 0) {
    return initialStages
      .slice()
      .sort((left, right) => left.sequence - right.sequence)
      .map((stage) => ({
        milestone_code: stage.code,
        description: stage.description,
        percentage: String(stage.percentage),
        trigger_kind: stage.trigger_kind,
        material_release_condition: "",
        customer_acceptance_required: stage.customer_acceptance_required === true,
      }));
  }
  return [
    { milestone_code: "ADVANCE", description: "Customer advance", percentage: "20", trigger_kind: "MANUAL", material_release_condition: "", customer_acceptance_required: false },
    { milestone_code: "HANDOVER", description: "Final handover", percentage: "80", trigger_kind: "HANDOVER", material_release_condition: "", customer_acceptance_required: true },
  ];
}

function PaymentScheduleDialog({
  providerId,
  caseId,
  expectedRevision,
  initialBasis = "0",
  initialStages = [],
  close,
  saved,
}: {
  providerId: string;
  caseId: string;
  expectedRevision: number;
  initialBasis?: string | number;
  initialStages?: PaymentStageSeed[];
  close: () => void;
  saved: () => void;
}) {
  const [basis, setBasis] = useState(String(initialBasis || "0"));
  const [currency, setCurrency] = useState("INR");
  const [stages, setStages] = useState(() => seededPaymentStages(initialStages));
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
        {initialStages.length > 0 && <p className="notice">Stages were prefilled from the accepted quotation. Review the allocation and save; the project keeps that commercial snapshot.</p>}
        <p className="notice payment-stage-guidance">Calculated stage amounts use the payable basis. Configure any number of stages; allocation must total exactly 100.00%. The accepted schedule remains immutable after acceptance.</p>
        <div className="payment-stage-basis"><label>Payment basis *<input aria-label="Payment basis" required type="number" min="0.01" step="0.01" value={basis} onChange={(event) => setBasis(event.target.value)} /></label>
        <label>Currency *<select aria-label="Payment currency" required value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="INR">INR · Indian rupee</option>{currency !== "INR" && <option value={currency}>{currency}</option>}</select></label></div>
        {stages.map((stage, index) => {
          return <fieldset className="record-card payment-stage-card" key={`${stage.milestone_code}-${index}`}><legend>Stage {index + 1}</legend>
            <label>Identifier *<input required value={stage.milestone_code} onChange={(event) => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, milestone_code: event.target.value } : item))} /></label>
            <label>Name *<input required value={stage.description} onChange={(event) => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} /></label>
            <label>Percentage *<input required type="number" min="0" max="100" step="0.01" value={stage.percentage} onChange={(event) => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, percentage: event.target.value } : item))} /></label>
            <label>Calculated amount<input readOnly value={`${(stageAmounts[index] / 100).toFixed(2)} ${currency.toUpperCase()}`} /></label>
            <label>Trigger<select value={stage.trigger_kind} onChange={(event) => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, trigger_kind: event.target.value } : item))}><option value="MANUAL">Manual</option><option value="CUSTOMER_ACCEPTANCE">Customer acceptance</option><option value="STAGE_COMPLETION">Stage completion</option><option value="DELIVERY">Delivery</option><option value="HANDOVER">Handover</option></select></label>
            <label>Material release condition<select value={stage.material_release_condition} onChange={(event) => setStages(stages.map((item, itemIndex) => itemIndex === index ? { ...item, material_release_condition: event.target.value } : item))}>{PAYMENT_RELEASE_CONDITIONS.map(([value, label]) => <option value={value} key={value || "NONE"}>{label}</option>)}{stage.material_release_condition && !PAYMENT_RELEASE_CONDITIONS.some(([value]) => value === stage.material_release_condition) && <option value={stage.material_release_condition}>{stage.material_release_condition}</option>}</select></label>
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
  const [releaseBasis, setReleaseBasis] = useState<"SETTLED_PAYMENT" | "APPROVED_CREDIT">("SETTLED_PAYMENT");
  const [creditAmount, setCreditAmount] = useState(schedule.attributes.outstanding_amount);
  const [creditDueOn, setCreditDueOn] = useState("");
  const [creditReference, setCreditReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payments = await operationsData.payments(providerId, caseId);
      const settledPaymentIds = payments.data.filter((payment) => String(payment.attributes.status) === "SETTLED" && (payment.attributes.allocations || []).some((allocation) => allocation.payment_schedule_id === schedule.id) || (String(payment.attributes.status) === "SETTLED" && String(payment.attributes.payment_schedule_id) === schedule.id)).map((payment) => payment.id);
      if (releaseBasis === "SETTLED_PAYMENT" && !settledPaymentIds.length) throw new Error("No settled payment evidence is available for this stage.");
      if (releaseBasis === "APPROVED_CREDIT" && (!Number(creditAmount) || !creditDueOn)) throw new Error("Approved credit amount and due date are required.");
      await operationsData.createStageRelease(providerId, caseId, { payment_schedule_id: schedule.id, settled_payment_ids: releaseBasis === "SETTLED_PAYMENT" ? settledPaymentIds : [], accepted_quotation_revision: Number(quotationRevision), release_rule_version: ruleVersion, decision: "AUTHORIZED", release_basis: releaseBasis, approved_credit_amount: releaseBasis === "APPROVED_CREDIT" ? creditAmount : undefined, credit_due_on: releaseBasis === "APPROVED_CREDIT" ? creditDueOn : undefined, credit_reference: releaseBasis === "APPROVED_CREDIT" ? creditReference : undefined, reason }, uuid());
      saved();
    } catch (cause) {
      setError(fail(cause));
    } finally {
      setBusy(false);
    }
  }
  return <OperationsDialog title={`Authorize ${displayLabel(schedule.attributes.milestone_code, "payment stage")} release`} busy={busy} onClose={close}>
    <form className="provider-form project-action-form stage-release-form" onSubmit={(event) => void submit(event)}>
      {error && <p className="feature-error" role="alert">{error}</p>}
      <p className="notice">Choose whether this stage is released by settled receipts or by an explicitly approved customer credit arrangement. The accepted quotation revision is checked by the server.</p>
      <label>Accepted quotation revision *<input required type="number" min="1" value={quotationRevision} onChange={(event) => setQuotationRevision(event.target.value)} /></label>
      <label>Release rule version *<input required maxLength={80} value={ruleVersion} onChange={(event) => setRuleVersion(event.target.value)} /></label>
      <label>Release basis *<select value={releaseBasis} onChange={(event) => setReleaseBasis(event.target.value as "SETTLED_PAYMENT" | "APPROVED_CREDIT")}><option value="SETTLED_PAYMENT">Settled payment</option><option value="APPROVED_CREDIT">Approved customer credit</option></select></label>
      {releaseBasis === "APPROVED_CREDIT" && <><label>Approved credit amount *<input required type="number" min={schedule.attributes.outstanding_amount} step="0.01" value={creditAmount} onChange={(event) => setCreditAmount(event.target.value)} /></label><label>Credit due date *<input required type="date" value={creditDueOn} onChange={(event) => setCreditDueOn(event.target.value)} /></label><label>Credit reference<input value={creditReference} onChange={(event) => setCreditReference(event.target.value)} placeholder="Builder commitment / approval reference" /></label></>}
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
  const [schedules, setSchedules] = useState<Collection<PaymentScheduleAttributes> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void operationsData.paymentSchedules(providerId, caseId).then(setSchedules).catch((cause) => setError(fail(cause))); }, [providerId, caseId]);
  const allocationPreview = (() => {
    const candidates = (schedules?.data || [schedule]).filter((item) => (item.attributes.sequence || 0) >= (schedule.attributes.sequence || 0) && item.attributes.status !== "SETTLED" && Number(item.attributes.outstanding_amount) > 0).sort((left, right) => (left.attributes.sequence || 0) - (right.attributes.sequence || 0));
    let remaining = Number(form.amount || 0);
    return candidates.flatMap((item) => { const amount = Math.min(remaining, Number(item.attributes.outstanding_amount)); if (!Number.isFinite(amount) || amount <= 0) return []; remaining -= amount; return [{ payment_schedule_id: item.id, amount: amount.toFixed(2) }]; });
  })();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const previewTotal = allocationPreview.reduce((total, item) => total + Number(item.amount), 0);
      if (previewTotal < Number(form.amount)) { setError("The amount is greater than the current and future open stage balances."); return; }
      await operationsData.createPayment(
        providerId,
        caseId,
        { ...form, payment_schedule_id: schedule.id, allocations: allocationPreview },
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
      title={`Record collection — ${displayLabel(schedule.attributes.milestone_code, "payment stage")}`}
      busy={busy}
      onClose={close}
    >
      <form className="provider-form project-action-form payment-entry-form" onSubmit={(event) => void submit(event)}>
        {error && <p className="feature-error">{error}</p>}
        <label>
          Payment reference *
          <input
            aria-label="Payment reference *"
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
            aria-label="Amount *"
            required
            type="number"
            min="0.01"
            step="0.01"
            max={(schedules?.data || [schedule]).filter((item) => (item.attributes.sequence || 0) >= (schedule.attributes.sequence || 0)).reduce((total, item) => total + Number(item.attributes.outstanding_amount || 0), 0).toFixed(2)}
            value={form.amount}
            onChange={(event) =>
              setForm({ ...form, amount: event.target.value })
            }
          />
        </label>
        <div className="payment-allocation-preview"><strong>Allocation preview</strong>{allocationPreview.length ? allocationPreview.map((item) => <span key={item.payment_schedule_id}>{displayLabel((schedules?.data || [schedule]).find((candidate) => candidate.id === item.payment_schedule_id)?.attributes.milestone_code, "Payment stage")}: {item.amount} {form.currency_code}</span>) : <small>Enter an amount to see the current stage and future-stage allocation.</small>}</div>
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
  const availableRequirements = requirements.filter(
    (item) => Number(item.attributes.remaining_quantity) > 0,
  );
  const [lines, setLines] = useState(
    availableRequirements.map((item) => ({
      material_requirement_id: item.id,
      dispatched_quantity: "",
    })),
  );
  const [number, setNumber] = useState(() => `SHIP-${Date.now()}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function updateQuantity(materialRequirementId: string, quantity: string) {
    setLines((current) =>
      current.map((line) =>
        line.material_requirement_id === materialRequirementId
          ? { ...line, dispatched_quantity: quantity }
          : line,
      ),
    );
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const selectedLines = lines.filter((line) => Number(line.dispatched_quantity) > 0);
    if (!selectedLines.length) {
      setError("Enter a dispatch quantity for at least one material line.");
      return;
    }
    setBusy(true);
    try {
      await operationsData.createShipment(
        providerId,
        caseId,
        {
          shipment_number: number,
          lines: selectedLines,
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
        <div className="shipment-material-lines" aria-label="Shipment material lines">
          <div className="shipment-material-lines-header">
            <strong>Material lines</strong>
            <small>Select one or more planned materials for this dispatch.</small>
          </div>
          {availableRequirements.length ? availableRequirements.map((item) => {
            const line = lines.find((entry) => entry.material_requirement_id === item.id);
            return (
              <div className="shipment-material-line" key={item.id}>
                <div>
                  <strong>{item.attributes.description}</strong>
                  <small>Remaining {item.attributes.remaining_quantity} {item.attributes.unit_code}</small>
                </div>
                <label>
                  Dispatch quantity
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={item.attributes.remaining_quantity}
                    value={line?.dispatched_quantity || ""}
                    onChange={(event) => updateQuantity(item.id, event.target.value)}
                  />
                </label>
              </div>
            );
          }) : <p className="notice">No open planned material quantity is available for dispatch.</p>}
        </div>
        <Button type="submit" busy={busy} disabled={!availableRequirements.length}>
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
  const [decisions, setDecisions] = useState(
    shipment.attributes.lines.map((line) => ({
      shipment_line_id: line.id,
      accepted_quantity:
        Number(line.accepted_quantity) > 0 || Number(line.rejected_quantity) > 0
          ? line.accepted_quantity
          : line.dispatched_quantity,
      rejected_quantity: line.rejected_quantity || "0",
      rejection_reason: line.rejection_reason || "",
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const invalidDecision = decisions.some((decision) => {
    const line = shipment.attributes.lines.find((item) => item.id === decision.shipment_line_id);
    return !line || Number(decision.accepted_quantity) < 0 || Number(decision.rejected_quantity) < 0 ||
      Number(decision.accepted_quantity) + Number(decision.rejected_quantity) > Number(line.dispatched_quantity) ||
      (Number(decision.rejected_quantity) > 0 && !decision.rejection_reason.trim());
  });
  function updateDecision(shipmentLineId: string, changes: Partial<typeof decisions[number]>) {
    setDecisions((current) => current.map((decision) =>
      decision.shipment_line_id === shipmentLineId ? { ...decision, ...changes } : decision,
    ));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!decisions.length || invalidDecision) {
      setError("Account for every shipment line. A rejected quantity also needs a reason.");
      return;
    }
    setBusy(true);
    try {
      await operationsData.recordShipmentDelivery(
        providerId,
        shipment.id,
        {
          expected_revision: shipment.attributes.revision,
          lines: decisions.map((decision) => ({
            ...decision,
            rejection_reason: Number(decision.rejected_quantity) > 0
              ? decision.rejection_reason.trim()
              : undefined,
          })),
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
        <p className="notice">Verify every dispatched line. Partial acceptance remains open until the outstanding quantity is reconciled.</p>
        <div className="delivery-material-lines" aria-label="Shipment delivery lines">
          {shipment.attributes.lines.map((line) => {
            const decision = decisions.find((item) => item.shipment_line_id === line.id);
            if (!decision) return null;
            return (
              <div className="delivery-material-line" key={line.id}>
                <div className="delivery-material-line-heading">
                  <strong>{line.description || "Material line"}</strong>
                  <small>Dispatched {line.dispatched_quantity}</small>
                </div>
                <label>
                  Accepted
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={decision.accepted_quantity}
                    onChange={(event) => updateDecision(line.id, { accepted_quantity: event.target.value })}
                  />
                </label>
                <label>
                  Rejected
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={decision.rejected_quantity}
                    onChange={(event) => updateDecision(line.id, { rejected_quantity: event.target.value })}
                  />
                </label>
                <label className="delivery-rejection-reason">
                  Rejection reason{Number(decision.rejected_quantity) > 0 ? " *" : ""}
                  <input
                    required={Number(decision.rejected_quantity) > 0}
                    value={decision.rejection_reason}
                    onChange={(event) => updateDecision(line.id, { rejection_reason: event.target.value })}
                    placeholder="Required for rejected quantity"
                  />
                </label>
              </div>
            );
          })}
        </div>
        <Button type="submit" busy={busy} disabled={!decisions.length || invalidDecision}>
          Save delivery
        </Button>
      </form>
    </OperationsDialog>
  );
}

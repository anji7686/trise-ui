import { useEffect, useState, type FormEvent } from 'react';
import { Button, PageHeader, SortedSelect, InfoNotice } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { ExecutionPanel } from './execution';
import { DEFAULT_PAGE_SIZE, operationsData, type AgentAttributes, type AssignmentAttributes, type Collection, type JobAttributes, type PartDefinitionAttributes, type PartUsageAttributes, type ProviderWorkJourney, type Resource, type ServiceReportAttributes, type VisitAttributes, type WorkNoteAttributes } from './data';
import { SvgIcon } from './icons';
import { ActionNotification, displayLabel, OperationsDrawer, ProviderActionMenu, WorkspaceTabs } from './operations-shared';
import { OperationsDialog } from './operations-dialog';
import { formatIndiaDateTime, indiaDateTimeToIso, localDateTime } from './subscription-support';
import './jobs.css';
import { WorkflowFollowUpAction, WorkflowFollowUpDialog } from './workflow-follow-ups';
import { JourneyTimelineDialog, WorkflowChainAction } from './provider-journey-timeline';

type T = (key: string) => string;
function messageOf(error: unknown) { return (error as { message?: string })?.message || 'The request could not be completed.'; }
function labelFor(job: Resource<JobAttributes>) { return job.attributes.summary?.trim() || 'Service job'; }
function nextStepFor(job: Resource<JobAttributes> | undefined, assignmentStatus: string): [string, string] {
  if (assignmentStatus === 'PROPOSED') return ['Accept assignment', 'Review the work and accept it to take ownership.'];
  switch (String(job?.attributes.status || '').toUpperCase()) {
    case 'CREATED': return ['Schedule the visit', 'Set the visit window before travelling to site.'];
    case 'SCHEDULED': return ['Start travel', 'Begin the route when you are on the way.'];
    case 'ON_THE_WAY': return ['Open visit and check in', 'Confirm arrival before starting service.'];
    case 'ARRIVED': return ['Start service', 'Open the execution workspace after check-in.'];
    case 'WORK_STARTED':
    case 'IN_PROGRESS': return ['Complete service', 'Record the report and evidence before closing.'];
    case 'COMPLETED':
    case 'CLOSED': return ['Work complete', 'This assignment is read-only.'];
    default: return ['Review assignment', 'Open the work item to see the next authorized action.'];
  }
}

export { TechnicianExecution };
function localDateTimeInput(date = new Date()) { return localDateTime(date); }
type NearbyLocation = { latitude: number; longitude: number; accuracy_m: number; radius_m: number };
function distanceLabel(distanceM?: number) {
  if (distanceM == null) return 'Location unavailable';
  return distanceM < 1000 ? `${Math.round(distanceM)} m away` : `${(distanceM / 1000).toFixed(1)} km away`;
}

export function Jobs({ providerId, route, myWorkAllowed = false, executionAllowed = false, assignmentAllowed = false }: { providerId: string; t: T; route?: { id?: string }; myWorkAllowed?: boolean; executionAllowed?: boolean; assignmentAllowed?: boolean }) {
  const myWorkRoute = myWorkAllowed && route?.id === 'my-work';
  const agentWorkspace = myWorkRoute;
  const [jobs, setJobs] = useState<Collection<JobAttributes> | null>(null); const [assignments, setAssignments] = useState<Collection<AssignmentAttributes> | null>(null); const [agents, setAgents] = useState<Collection<AgentAttributes> | null>(null); const [selectedJob, setSelectedJob] = useState<Resource<JobAttributes> | null>(null); const [query, setQuery] = useState(''); const [status, setStatus] = useState(''); const [assignmentStatus, setAssignmentStatus] = useState(''); const [nearbyLocation] = useState<NearbyLocation | null>(null); const [tab, setTab] = useState<'jobs' | 'my-work'>(agentWorkspace ? 'my-work' : 'jobs'); const [error, setError] = useState(''); const [pageCursor, setPageCursor] = useState<{ after?: string; before?: string }>({}); const pageLimit = DEFAULT_PAGE_SIZE;
  useEffect(() => {
    let active = true;
    setError('');
    setTab(agentWorkspace ? 'my-work' : 'jobs');
    const assignmentRequest = nearbyLocation
      ? operationsData.nearbyAssignments(providerId, { ...nearbyLocation, statuses: assignmentStatus ? [assignmentStatus] : undefined, limit: DEFAULT_PAGE_SIZE })
      : operationsData.assignments(providerId, { limit: DEFAULT_PAGE_SIZE, statuses: assignmentStatus ? [assignmentStatus] : undefined });
    const load = async () => {
      if (agentWorkspace) {
        const assignmentResult = await assignmentRequest;
        if (!active) return;
        setJobs({ data: [] });
        setAgents({ data: [] });
        setAssignments(assignmentResult);
        setSelectedJob(null);
        return;
      }
      const [jobResult, agentResult, assignmentResult] = await Promise.all([
        operationsData.jobs(providerId, { ...pageCursor, limit: pageLimit, query: query.trim() || undefined, status: status || undefined }),
        operationsData.agents(providerId),
        assignmentRequest,
      ]);
      if (!active) return;
      setJobs(jobResult);
      setAgents(agentResult);
      setAssignments(assignmentResult);
      if (!route?.id) {
        setSelectedJob(null);
        return;
      }
      const listed = jobResult.data.find((item) => item.id === route.id);
      if (listed) {
        setSelectedJob(listed);
        return;
      }
      try {
        const requested = await operationsData.job(providerId, route.id);
        if (active) setSelectedJob(requested);
      } catch (cause) {
        if (active) setError(messageOf(cause));
      }
    };
    void load().catch((cause) => { if (active) setError(messageOf(cause)); });
    return () => { active = false; };
  }, [agentWorkspace, assignmentStatus, nearbyLocation, providerId, route?.id, pageCursor, pageLimit, query, status]);
  const filtered = jobs?.data || [];
  const assignmentFor = (jobId: string) => assignments?.data.find((assignment) => (assignment.relationships.job as { id?: string } | null | undefined)?.id === jobId);
  const technicianFor = (jobId: string) => {
    const assignment = assignmentFor(jobId);
    const agentId = (assignment?.relationships.agent as { id?: string } | null | undefined)?.id;
    return agents?.data.find((agent) => agent.id === agentId)?.attributes.display_name || (assignment ? 'Assigned' : 'Unassigned');
  };
  if (error) return <section className="content"><div className="page-error"><strong>Jobs could not be loaded</strong><p>{error}</p><Button onClick={() => window.location.reload()}>Retry</Button></div></section>;
  if (!jobs || !assignments || !agents) return <section className="content"><p className="notice">Loading jobs and assignments…</p></section>;
  if (selectedJob && route?.id) return <JobDetail job={selectedJob} providerId={providerId} agents={agents} allowVisitCreation={executionAllowed || myWorkAllowed} allowAssignment={assignmentAllowed} onBack={() => { window.location.hash = 'jobs'; }} onChanged={async () => setJobs(await operationsData.jobs(providerId, { limit: pageLimit }))} />;
 return <><section className="content jobs-page"><div className="page-toolbar"><div><h2>{tab === 'jobs' ? 'Jobs & assignments' : 'My work'}</h2><p>{tab === 'jobs' ? 'Review authorized work and assign eligible agents.' : 'Work assigned to the current operational context.'}</p></div><WorkspaceTabs label="Job workspace" activeId={tab} onChange={(id) => setTab(id as 'jobs' | 'my-work')} tabs={[{ id: 'jobs', label: 'Jobs' }, ...(myWorkAllowed ? [{ id: 'my-work', label: 'My Work' }] : [])]} /></div>{tab === 'jobs' ? <><div className="feature-summary-grid jobs-summary-grid"><div><span>Visible jobs</span><strong>{jobs.data.length}</strong><small>Current provider page</small></div><div><span>Open jobs</span><strong>{jobs.data.filter((job) => !['COMPLETED', 'CANCELLED', 'CLOSED'].includes(job.attributes.status)).length}</strong><small>Server lifecycle state</small></div><div><span>Proposed assignments</span><strong>{assignments.data.filter((assignment) => assignment.attributes.status === 'PROPOSED').length}</strong><small>Awaiting agent response</small></div><div><span>Records per page</span><strong>{pageLimit}</strong><small>Backend cursor pagination</small></div></div><div className="filter-toolbar"><label>Search jobs<input aria-label="Search jobs" value={query} onChange={(event) => { setQuery(event.target.value); setPageCursor({}); }} placeholder="Search by job number, title, site or customer" /></label><label>Status<SortedSelect aria-label="Filter jobs by status" value={status} onChange={(event) => { setStatus(event.target.value); setPageCursor({}); }}><option value="">All statuses</option>{['CREATED', 'SCHEDULED', 'ON_THE_WAY', 'ARRIVED', 'WORK_STARTED', 'IN_PROGRESS', 'COMPLETED', 'RESOLVED', 'CLOSED', 'CANCELLED'].map((value) => <option value={value} key={value}>{value}</option>)}</SortedSelect></label></div><p className="list-count">Showing {filtered.length} jobs returned by the server</p>{filtered.length === 0 ? <p className="notice">No authorized jobs match these filters.</p> : <div className="job-register-scroll"><table className="job-register"><thead><tr><th scope="col">Job No.</th><th scope="col">Title / service</th><th scope="col">Scheduled time</th><th scope="col">Technician</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>{filtered.map((job) => { const assignment = assignmentFor(job.id); const scheduledAt = job.attributes.scheduled_window?.starts_at || job.attributes.scheduled_at || assignment?.attributes.scheduled_start_at; return <tr key={job.id} data-job-id={job.id} className={selectedJob?.id === job.id ? 'is-selected' : undefined}><td data-label="Job No."><span className="job-reference">{labelFor(job)}</span></td><td data-label="Title / service"><strong>{labelFor(job)}</strong></td><td data-label="Scheduled time">{scheduledAt ? formatIndiaDateTime(scheduledAt) : 'Not scheduled'}</td><td data-label="Technician">{technicianFor(job.id)}</td><td data-label="Status"><Status>{displayLabel(job.attributes.status)}</Status></td><td data-label="Action"><ProviderActionMenu label={`Actions for ${labelFor(job)}`} actions={[{ id: 'open', label: 'Open job', onSelect: () => { window.location.hash = `jobs/${job.id}`; } }]} /></td></tr>; })}</tbody></table></div>}<div className="server-pagination" aria-label="Job pages"><div><Button type="button" variant="secondary" disabled={!jobs.page?.previous} onClick={() => setPageCursor({ before: jobs.page?.previous || undefined })}>Previous</Button><Button type="button" disabled={!jobs.page?.next} onClick={() => setPageCursor({ after: jobs.page?.next || undefined })}>Next</Button></div></div></> : <MyWork assignments={assignments} jobs={jobs} providerId={providerId} statusFilter={assignmentStatus} onStatusChange={setAssignmentStatus} onChanged={async () => { const [nextAssignments, nextJobs] = await Promise.all([operationsData.assignments(providerId, { limit: DEFAULT_PAGE_SIZE, statuses: assignmentStatus ? [assignmentStatus] : undefined }), myWorkRoute ? Promise.resolve({ data: [] } as Collection<JobAttributes>) : operationsData.jobs(providerId, { limit: pageLimit })]); setAssignments(nextAssignments); setJobs(nextJobs); }} />}</section>{selectedJob && <OperationsDrawer title={`Job: ${labelFor(selectedJob)}`} onClose={() => setSelectedJob(null)}><JobDetail job={selectedJob} providerId={providerId} agents={agents} allowVisitCreation={executionAllowed || myWorkAllowed} allowAssignment={assignmentAllowed} onBack={() => setSelectedJob(null)} onChanged={async () => setJobs(await operationsData.jobs(providerId))} /></OperationsDrawer>}</>;
}

function MyWork({ assignments, jobs, providerId, statusFilter, onStatusChange, onChanged }: { assignments: Collection<AssignmentAttributes>; jobs: Collection<JobAttributes>; providerId: string; statusFilter: string; onStatusChange: (status: string) => void; onChanged: () => Promise<void> }) {
  const [busyId, setBusyId] = useState('');
  const [loadingJobId, setLoadingJobId] = useState('');
  const [openJobId, setOpenJobId] = useState('');
  const [error, setError] = useState('');
  const [loadedJobs, setLoadedJobs] = useState<Record<string, Resource<JobAttributes>>>({});
  const [visibleCount, setVisibleCount] = useState(DEFAULT_PAGE_SIZE);
  const [nearbyLocation, setNearbyLocation] = useState<NearbyLocation | null>(null);
  const [nearbyAssignments, setNearbyAssignments] = useState<Collection<AssignmentAttributes> | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [workStatus, setWorkStatus] = useState(statusFilter);
  useEffect(() => { setLoadedJobs({}); setOpenJobId(''); setVisibleCount(DEFAULT_PAGE_SIZE); }, [providerId]);
  useEffect(() => { if (!nearbyLocation) { setWorkStatus(statusFilter); setNearbyAssignments(assignments); } }, [assignments, nearbyLocation, statusFilter]);
  const visibleAssignmentCollection = nearbyAssignments || assignments;
  async function loadNearby(location: NearbyLocation, nextStatus = workStatus) {
    const result = await operationsData.nearbyAssignments(providerId, { ...location, statuses: nextStatus ? [nextStatus] : undefined, limit: DEFAULT_PAGE_SIZE });
    setNearbyAssignments(result);
  }
  function requestNearbyLocation(radiusM = nearbyLocation?.radius_m || 10000) {
    if (!navigator.geolocation) { setLocationError('Device location is not available. Use All assigned work instead.'); return; }
    setLocating(true); setLocationError('');
    navigator.geolocation.getCurrentPosition((position) => {
      const accuracy = position.coords.accuracy;
      if (!Number.isFinite(accuracy) || accuracy > 1000) { setLocationError('Location accuracy is too low to safely find nearby jobs.'); setLocating(false); return; }
      const location = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy_m: accuracy, radius_m: radiusM };
      setNearbyLocation(location);
      void loadNearby(location).catch((cause) => setLocationError(messageOf(cause))).finally(() => setLocating(false));
    }, () => { setLocationError('Location permission was denied or the device location is unavailable.'); setLocating(false); }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 });
  }
  function clearNearbyLocation() { setNearbyLocation(null); setNearbyAssignments(assignments); setLocationError(''); }
  async function loadJob(jobId: string) {
    setLoadingJobId(jobId); setError('');
    try { const job = await operationsData.job(providerId, jobId); setLoadedJobs((current) => ({ ...current, [jobId]: job })); setOpenJobId(jobId); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setLoadingJobId(''); }
  }
  async function refreshWork() { if (nearbyLocation) await loadNearby(nearbyLocation); else await onChanged(); }
  async function decide(assignment: Resource<AssignmentAttributes>, action: 'accept' | 'decline') {
    setBusyId(assignment.id); setError('');
    try {
      const body = { expected_revision: assignment.attributes.revision || 0 };
      if (action === 'accept') await operationsData.acceptAssignment(providerId, assignment.id, body, crypto.randomUUID());
      else await operationsData.declineAssignment(providerId, assignment.id, body, crypto.randomUUID());
      await refreshWork();
    } catch (cause) { setError(messageOf(cause)); }
    finally { setBusyId(''); }
  }
  const visibleAssignments = visibleAssignmentCollection.data.slice(0, visibleCount);
  const openJob = openJobId ? loadedJobs[openJobId] : undefined;
  return <div className="job-list">
    {error && <ActionNotification kind="error" title="Assignment action needs attention" onClose={() => setError('')}>{error}</ActionNotification>}
    <div className="my-work-toolbar"><div><span className="my-work-eyebrow">Active assignment queue</span><strong>{visibleAssignmentCollection.data.length}</strong><small>{nearbyLocation ? `Nearest work within ${(nearbyLocation.radius_m / 1000).toFixed(0)} km · one-time location search` : 'Server-filtered to your authorized work'}</small></div><div className="my-work-filter-group"><label>Status<SortedSelect aria-label="Filter my work by status" value={workStatus} onChange={(event) => { const nextStatus = event.target.value; setWorkStatus(nextStatus); if (!nearbyLocation) onStatusChange(nextStatus); if (nearbyLocation) void loadNearby(nearbyLocation, nextStatus).catch((cause) => setLocationError(messageOf(cause))); }}><option value="">All active statuses</option><option value="PROPOSED">Needs your response</option><option value="ASSIGNED">Assigned</option><option value="ACCEPTED">Accepted</option><option value="EN_ROUTE">En route</option><option value="ARRIVED">Arrived</option><option value="WORKING">Working</option></SortedSelect></label><label>Location<SortedSelect aria-label="Filter my work by location" value={nearbyLocation ? 'nearby' : 'all'} onChange={(event) => { if (event.target.value === 'nearby') requestNearbyLocation(); else clearNearbyLocation(); }}><option value="all">All assigned work</option><option value="nearby">Near me</option></SortedSelect></label>{nearbyLocation && <label>Radius<SortedSelect aria-label="Nearby work radius" value={String(nearbyLocation.radius_m)} onChange={(event) => { const radius = Number(event.target.value); const next = { ...nearbyLocation, radius_m: radius }; setNearbyLocation(next); void loadNearby(next).catch((cause) => setLocationError(messageOf(cause))); }}><option value="2000">2 km</option><option value="5000">5 km</option><option value="10000">10 km</option><option value="25000">25 km</option></SortedSelect></label>}{nearbyLocation && <Button type="button" variant="secondary" busy={locating} onClick={() => requestNearbyLocation(nearbyLocation.radius_m)}>Refresh location</Button>}</div></div>
    {locationError && <ActionNotification kind="error" title="Nearby work unavailable" onClose={() => setLocationError('')}>{locationError}</ActionNotification>}
    {visibleAssignmentCollection.data.length === 0 ? <p className="notice">No active assignments match this status or location filter.</p> : <>
      {visibleAssignments.map((assignment) => {
        const jobId = (assignment.relationships.job as { id?: string } | null | undefined)?.id;
        const job = jobId ? jobs.data.find((item) => item.id === jobId) || loadedJobs[jobId] : undefined;
        const [nextLabel, nextHint] = nextStepFor(job, assignment.attributes.status);
        const assignmentJobSummary = assignment.attributes.job_summary || 'Assigned service work';
        return <article className="job-list-row" key={assignment.id} data-job-id={job?.id || jobId || undefined}>
          <div className="job-list-summary"><Status>{displayLabel(assignment.attributes.status)}</Status><h3>{job ? labelFor(job) : assignmentJobSummary}</h3><div className="job-list-meta"><span>{assignment.attributes.scheduled_start_at ? formatIndiaDateTime(assignment.attributes.scheduled_start_at) : 'Schedule not supplied'}</span>{nearbyLocation && <span className="job-distance-badge">{distanceLabel(assignment.attributes.distance_m)}</span>}</div><div className="job-next-step"><span>Next step</span><strong>{nextLabel}</strong><small>{nextHint}</small></div></div>
          <div className="action-footer">
            {assignment.attributes.status === 'PROPOSED' ? <><Button busy={busyId === assignment.id} onClick={() => void decide(assignment, 'accept')}>Accept assignment</Button><Button variant="danger" busy={busyId === assignment.id} onClick={() => void decide(assignment, 'decline')}>Decline assignment</Button></> : job ? <Button variant="secondary" onClick={() => setOpenJobId(job.id)}>Open job</Button> : jobId ? <div className="job-lazy-action"><span className="list-count">Details load only when opened.</span><Button variant="secondary" busy={loadingJobId === jobId} onClick={() => void loadJob(jobId)}>Open job</Button></div> : <span className="list-count">Job details are unavailable.</span>}
          </div>
        </article>;
      })}
      <div className="list-count">Showing {visibleAssignments.length} of {visibleAssignmentCollection.data.length} authorized assignments</div>
      {visibleCount < visibleAssignmentCollection.data.length && <Button variant="secondary" onClick={() => setVisibleCount((count) => Math.min(count + 15, visibleAssignmentCollection.data.length))}>Load more assignments</Button>}
    </>}
    {openJob && <OperationsDialog title={`Job actions · ${labelFor(openJob)}`} className="my-work-job-dialog" onClose={() => setOpenJobId('')}><JobDetail job={openJob} providerId={providerId} agents={{ data: [] }} assignedAgentId={(visibleAssignmentCollection.data.find((item) => (item.relationships.job as { id?: string } | null | undefined)?.id === openJob.id)?.relationships.agent as { id?: string } | null | undefined)?.id} allowVisitCreation onBack={() => setOpenJobId('')} onChanged={refreshWork} /></OperationsDialog>}
  </div>;
}

function TechnicianExecution({ job, providerId, agentId, onChanged, onJobUpdated }: { job: Resource<JobAttributes>; providerId: string; agentId?: string; onChanged: () => Promise<void>; onJobUpdated?: (job: Resource<JobAttributes>) => void }) { const [currentJob, setCurrentJob] = useState(job); const [visit, setVisit] = useState<Resource<VisitAttributes> | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [message, setMessage] = useState(''); useEffect(() => { setCurrentJob(job); }, [job, job.id]); function applyJob(next: Resource<JobAttributes>) { setCurrentJob(next); onJobUpdated?.(next); } function refreshInBackground() { void onChanged().catch((cause) => setError(messageOf(cause))); } async function openVisit() { setBusy(true); setError(''); try { const existing = await operationsData.visits(providerId, currentJob.id); if (existing.data[0]) { setVisit(existing.data[0]); setMessage('Visit opened.'); } else { setVisit(await operationsData.createVisit(providerId, currentJob.id, { notes: 'Created from technician My Work' }, crypto.randomUUID())); setMessage('Visit created.'); } } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); } } async function transition(status: 'SCHEDULED' | 'ON_THE_WAY') { setBusy(true); setError(''); try { const next = await operationsData.transitionJob(providerId, currentJob.id, { status, effective_at: new Date().toISOString(), expected_revision: currentJob.attributes.revision }, crypto.randomUUID()); applyJob(next); setMessage(status === 'SCHEDULED' ? 'Job scheduled.' : 'Travel started.'); refreshInBackground(); } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); } } async function execute(action: 'checkIn' | 'start' | 'complete') { if (!visit) return; setBusy(true); setError(''); try { const next = await operationsData[action](providerId, currentJob.id, { visit_id: visit.id, effective_at: new Date().toISOString(), expected_revision: currentJob.attributes.revision }, crypto.randomUUID()); applyJob(next); setMessage(`${action === 'checkIn' ? 'Check-in' : action === 'start' ? 'Service started' : 'Service completed'} accepted.`); refreshInBackground(); } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); } } return <div className="technician-execution">{visit ? <small>Visit status · {displayLabel(visit.attributes.status, 'Open')}</small> : <Button busy={busy} onClick={() => void openVisit()}>Open visit</Button>}<div className="inline-actions">{currentJob.attributes.status === 'CREATED' && <Button disabled={busy} onClick={() => void transition('SCHEDULED')}>Schedule</Button>}{currentJob.attributes.status === 'SCHEDULED' && <Button disabled={busy} onClick={() => void transition('ON_THE_WAY')}>Start travel</Button>}<Button disabled={busy || !visit || currentJob.attributes.status !== 'ON_THE_WAY'} onClick={() => void execute('checkIn')}>Check in</Button><Button disabled={busy || !visit || currentJob.attributes.status !== 'ARRIVED'} onClick={() => void execute('start')}>Start service</Button><Button disabled={busy || !visit || !['WORK_STARTED', 'IN_PROGRESS'].includes(currentJob.attributes.status)} onClick={() => void execute('complete')}>Complete</Button></div>{agentId && visit && <ExecutionPanel providerId={providerId} jobId={currentJob.id} visitId={visit.id} agentId={agentId} />}{error && <ActionNotification kind="error" title="Job action needs attention" onClose={() => setError('')}>{error}</ActionNotification>}{message && <ActionNotification title="Execution update completed" onClose={() => setMessage('')}>{message}</ActionNotification>}</div>; }

export function JobDetail({ job, providerId, agents, assignedAgentId, allowVisitCreation: requestedAllowVisitCreation, allowAssignment: requestedAllowAssignment = false, onBack, onChanged }: { job: Resource<JobAttributes>; providerId: string; agents: Collection<AgentAttributes>; assignedAgentId?: string; allowVisitCreation: boolean; allowAssignment?: boolean; onBack: () => void; onChanged: () => Promise<void> }) {
  const [tab, setTab] = useState<'overview' | 'assignment' | 'execution' | 'evidence' | 'history'>(requestedAllowVisitCreation ? 'execution' : 'overview');
  const [currentJob, setCurrentJob] = useState(job);
  const [visit, setVisit] = useState<Resource<VisitAttributes> | null>(null);
  const [agentId, setAgentId] = useState('');
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [journey, setJourney] = useState<ProviderWorkJourney | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(true);
  const [journeyError, setJourneyError] = useState('');
  const [assignmentStartAt, setAssignmentStartAt] = useState(localDateTimeInput(new Date(Date.now() + 60_000)));
  const [evidenceDialog, setEvidenceDialog] = useState<'note' | 'part' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState<Collection<WorkNoteAttributes> | null>(null);
  const [parts, setParts] = useState<Collection<PartUsageAttributes> | null>(null);
  const [reports, setReports] = useState<Collection<ServiceReportAttributes> | null>(null);
  const [partDefinitions, setPartDefinitions] = useState<Collection<PartDefinitionAttributes> | null>(null);
  const [relatedLabels, setRelatedLabels] = useState<Record<string, string | null>>({});
  const [note, setNote] = useState('');
  const [part, setPart] = useState({ description: '', quantity: '1', unit: 'each', source: 'EXTERNAL', part_definition_id: '' });

  useEffect(() => {
    setCurrentJob(job);
  }, [job]);

  useEffect(() => {
    Promise.all([operationsData.visits(providerId, job.id), operationsData.notes(providerId, job.id), operationsData.parts(providerId, job.id), operationsData.reports(providerId, job.id), operationsData.partDefinitions(providerId)])
      .then(([visits, noteResult, partResult, reportResult, definitionResult]) => { setVisit(visits.data[0] || null); setNotes(noteResult); setParts(partResult); setReports(reportResult); setPartDefinitions(definitionResult); })
      .catch((cause) => setError(messageOf(cause)));
  }, [providerId, job.id]);

  useEffect(() => {
    let active = true;
    const relationTypes: Record<string, string> = { asset: "assets", customer_relationship: "customer-relationships", service_location: "service-locations" };
    const entries = Object.entries(relationTypes).flatMap(([key, type]) => {
      const relation = job.relationships[key];
      if (!relation || Array.isArray(relation)) return [];
      return [[key, operationsData.genericDetail(providerId, `/${type}/${encodeURIComponent(relation.id)}`)] as const];
    });
    Promise.all(entries.map(async ([key, request]) => {
      try {
        const resource = await request;
        const attributes = resource.attributes;
        const label = [attributes.display_name, attributes.name, attributes.equipment_code, attributes.code, attributes.customer_name]
          .find((value) => typeof value === "string" && value.trim());
        return [key, typeof label === "string" ? label : null] as const;
      } catch {
        return [key, null] as const;
      }
    })).then((labels) => { if (active) setRelatedLabels(Object.fromEntries(labels)); });
    return () => { active = false; };
  }, [providerId, job.id, job.relationships]);

  useEffect(() => {
    let active = true;
    setJourney(null);
    setJourneyError('');
    setJourneyLoading(true);
    void operationsData.providerWorkJourneyForResource(providerId, 'ServiceJob', job.id)
      .then((value) => { if (active) setJourney(value); })
      .catch((cause) => { if (active) setJourneyError(messageOf(cause)); })
      .finally(() => { if (active) setJourneyLoading(false); });
    return () => { active = false; };
  }, [providerId, job.id]);

  async function createVisit() {
    setBusy(true); setError('');
    try { setVisit(await operationsData.createVisit(providerId, job.id, { notes: 'Created from job detail' }, crypto.randomUUID())); setMessage('Visit created.'); }
    catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); }
  }

  async function assign(event: FormEvent) {
    event.preventDefault(); if (!agentId) return;
    setBusy(true); setError('');
    try {
      await operationsData.assign(providerId, job.id, { agent_id: agentId, effective_at: indiaDateTimeToIso(assignmentStartAt), expected_revision: job.attributes.revision }, crypto.randomUUID());
      await onChanged(); setAssignmentOpen(false); setMessage('Assignment accepted by the server.'); setTab('assignment');
    } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); }
  }

  async function saveNote(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const created = await operationsData.createNote(providerId, job.id, { text: note.trim(), visibility: 'internal', recorded_at: new Date().toISOString() }, crypto.randomUUID());
      setNotes((current) => current ? { ...current, data: [created, ...current.data] } : { data: [created] }); setNote(''); setEvidenceDialog(null); setMessage('Internal note saved.');
    } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); }
  }

  async function savePart(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const source = part.source;
      const item = source === 'PROVIDER'
        ? { description: part.description.trim(), quantity: Number(part.quantity), unit: part.unit.trim(), usage_kind: 'INSTALLED', source, part_definition_id: part.part_definition_id }
        : { description: part.description.trim(), quantity: Number(part.quantity), unit: part.unit.trim(), usage_kind: 'INSTALLED', source, external_part_snapshot: { name: part.description.trim() } };
      const created = await operationsData.recordPart(providerId, job.id, { recorded_at: new Date().toISOString(), item }, crypto.randomUUID());
      setParts((current) => current ? { ...current, data: [created, ...current.data] } : { data: [created] }); setPart({ description: '', quantity: '1', unit: 'each', source: 'EXTERNAL', part_definition_id: '' }); setEvidenceDialog(null); setMessage('Part usage recorded.');
    } catch (cause) { setError(messageOf(cause)); } finally { setBusy(false); }
  }

  const submittedReport = reports?.data.some((report) => report.attributes.status.toUpperCase() === 'SUBMITTED') === true;
  const partFormReady = part.description.trim().length > 0 && part.unit.trim().length > 0 && Number(part.quantity) > 0 && (part.source !== 'PROVIDER' || Boolean(part.part_definition_id));
  const jobStatus = String(currentJob.attributes.status || '').toUpperCase();
  const journeyAbandoned = journey?.attributes.status === 'CANCELLED' || jobStatus === 'CANCELLED';
  const workflowConcluded = ['COMPLETED', 'CLOSED', 'CANCELLED'].includes(jobStatus) || journeyAbandoned;
  const allowVisitCreation = requestedAllowVisitCreation && !workflowConcluded;
  const allowAssignment = requestedAllowAssignment && !workflowConcluded;
  return <section className="content job-detail">
    <PageHeader eyebrow="Service Operations" title="Job details" description="Assign the authorized technician, open the visit, execute the service and preserve evidence." action={<div className="lifecycle-detail-actions"><Button variant="secondary" className="workflow-back-action" onClick={onBack} title="Back to Jobs"><SvgIcon name="arrow-left" size={15} /> Back</Button><Button variant="secondary" className="workflow-timeline-action" onClick={() => setTimelineOpen(true)} title="View timeline and audit history"><SvgIcon name="activity" size={15} /> Timeline</Button><WorkflowChainAction journey={journey} loading={journeyLoading} currentResourceKind="ServiceJob" currentResourceId={job.id} /><WorkflowFollowUpAction providerId={providerId} targetResourceKind="ServiceJob" targetResourceId={job.id} onClick={() => setFollowUpOpen(true)} />{allowAssignment && <Button variant="secondary" aria-label="Assign or reassign technician" onClick={() => setAssignmentOpen(true)}><SvgIcon name="users" size={15} /> Assign</Button>}</div>} />
    <section className="job-detail-record-header"><div><span className="eyebrow">Service job</span><h2>{labelFor(currentJob)}</h2><p>{currentJob.attributes.summary || 'Authorized service work'} · {currentJob.attributes.summary || 'Authorized service work'}</p></div><div className="lifecycle-current-step"><span>Current workflow step</span><strong>{displayLabel(currentJob.attributes.status, 'Created')}</strong><small>Progress through assignment, execution, evidence and history in order.</small></div><Status>{journeyAbandoned ? 'Abandoned' : displayLabel(currentJob.attributes.status, 'Not available')}</Status>{workflowConcluded && <div className={`workflow-concluded-inline${journeyAbandoned ? ' workflow-concluded-inline--abandoned' : ''}`} role="status"><span className="workflow-concluded-inline-icon" aria-hidden="true"><SvgIcon name={journeyAbandoned ? 'x' : 'shield'} size={14} /></span><span className="workflow-concluded-inline-copy"><strong>{journeyAbandoned ? 'Journey abandoned — read-only' : 'Workflow concluded — read-only'}</strong><small>{journeyAbandoned ? 'No further updates or downstream actions are allowed.' : 'Service work is complete and retained for history.'}</small></span></div>}</section>
    {error && <ActionNotification kind="error" title="Job action needs attention" onClose={() => setError('')}>{error}</ActionNotification>}{message && <ActionNotification title="Job update completed" onClose={() => setMessage('')}>{message}</ActionNotification>}
    <div className="job-detail-tabs workflow-detail-tabs"><WorkspaceTabs label="Job detail sections" activeId={tab} onChange={(id) => setTab(id as typeof tab)} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'assignment', label: 'Assignment' }, { id: 'execution', label: 'Execution' }, { id: 'evidence', label: 'Evidence' }, { id: 'history', label: 'History' }]} /></div>
    {tab === 'overview' && <section className="detail-section"><h3>Overview</h3><dl><dt>Service</dt><dd>{job.attributes.summary || 'Service job'}</dd><dt>Schedule</dt><dd>{job.attributes.scheduled_window?.starts_at ? `${formatIndiaDateTime(job.attributes.scheduled_window.starts_at)} – ${formatIndiaDateTime(job.attributes.scheduled_window.ends_at)}` : job.attributes.scheduled_at ? formatIndiaDateTime(job.attributes.scheduled_at) : 'Not scheduled'}</dd><dt>Revision</dt><dd>{job.attributes.revision}</dd><dt>Asset, customer, and location</dt><dd>Asset: {relatedLabels.asset || 'Not linked'} · Customer: {relatedLabels.customer_relationship || 'Not linked'} · Location: {relatedLabels.service_location || 'Not linked'}</dd></dl></section>}
    {tab === 'assignment' && <section className="detail-section"><h3>Assignment</h3><p>Technician qualification and availability are checked by the server when assignment is submitted.</p>{allowAssignment ? <Button onClick={() => setAssignmentOpen(true)}>Assign or reassign technician</Button> : <p className="notice">Assignment changes are restricted to authorized dispatch or operations roles.</p>}</section>}
    {tab === 'execution' && <section className="detail-section"><h3>Execution</h3>{workflowConcluded ? <p className="notice">This service work is concluded and read-only. Execution updates are no longer available.</p> : allowVisitCreation ? <TechnicianExecution job={currentJob} providerId={providerId} agentId={assignedAgentId} onChanged={onChanged} onJobUpdated={setCurrentJob} /> : visit ? <><p>Visit status: <Status>{displayLabel(visit.attributes.status, 'Open')}</Status></p><ExecutionPanel providerId={providerId} jobId={job.id} visitId={visit.id} agentId={agentId || undefined} /></> : <><div className="execution-visit-gate"><span className="execution-visit-gate-icon" aria-hidden="true"><SvgIcon name="clipboard" size={20} /></span><div><strong>Execution visit required</strong><p>An authorized technician must open a visit before checklist, work-session, and evidence actions become available.</p></div><Status>Awaiting visit</Status></div>{allowVisitCreation && <Button variant="secondary" busy={busy} onClick={() => void createVisit()}>Create visit</Button>}</>}</section>}
    {tab === 'evidence' && <section className="detail-section"><div className="evidence-heading"><div><h3>Evidence</h3><p>Record provider, customer or external material usage before the service report is submitted.</p></div><div className="evidence-actions">{workflowConcluded ? <span className="notice">Evidence is read-only after service completion.</span> : <><Button variant="secondary" onClick={() => setEvidenceDialog('note')}>Add work note</Button><Button disabled={submittedReport} title={submittedReport ? 'Part usage is locked after the service report is submitted.' : undefined} onClick={() => setEvidenceDialog('part')}>Record part usage</Button></>}</div></div>{submittedReport && <p className="notice">Service report submitted. Parts &amp; materials used are read-only for this job.</p>}<div className="evidence-list">{notes?.data.slice(0, 5).map((item) => <p key={item.id}><Status>Internal</Status>{item.attributes.text}</p>)}{parts?.data.slice(0, 5).map((item) => <p key={item.id}><Status>{displayLabel(item.attributes.source, 'Provider')}</Status>{item.attributes.description} · {item.attributes.quantity} {item.attributes.unit} · {displayLabel(item.attributes.usage_kind, 'Used')}</p>)}{notes && parts && notes.data.length === 0 && parts.data.length === 0 && <p className="notice">No work notes or part usage have been recorded for this job.</p>}</div></section>}
    {tab === 'history' && <section className="detail-section"><h3>History</h3><p>Only authorized history returned by the server is shown. Broader immutable history is available from Audit history.</p></section>}
    <WorkflowFollowUpDialog open={followUpOpen} onClose={() => setFollowUpOpen(false)} providerId={providerId} targetResourceKind="ServiceJob" targetResourceId={job.id} stage="SERVICE" readOnly={['COMPLETED', 'CLOSED', 'CANCELLED'].includes(currentJob.attributes.status)} title="Service job follow-ups" />
    {timelineOpen && <JourneyTimelineDialog journey={journey} loading={journeyLoading} error={journeyError} emptyLabel="No journey events are available for this service job." onClose={() => setTimelineOpen(false)} />}
    {assignmentOpen && allowAssignment && <OperationsDrawer title="Assign or reassign technician" onClose={() => setAssignmentOpen(false)} busy={busy}><form className="task-form" onSubmit={assign}><p className="field-hint">Choose from this provider's authorized technicians. The server checks qualification, availability, tenant scope and job revision when you confirm.</p><label>Technician<SortedSelect value={agentId} onChange={(event) => setAgentId(event.target.value)} required><option value="">Select an authorized technician</option>{agents.data.map((agent) => <option value={agent.id} key={agent.id}>{agent.attributes.display_name || 'Authorized technician'}</option>)}</SortedSelect></label><label>Assignment start<input type="datetime-local" min={localDateTimeInput()} value={assignmentStartAt} onChange={(event) => setAssignmentStartAt(event.target.value)} required /></label><div className="assignment-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setAssignmentOpen(false)}>Cancel</Button><Button type="submit" busy={busy || !agentId || !assignmentStartAt}>Confirm assignment</Button></div></form></OperationsDrawer>}
    {evidenceDialog === 'note' && <OperationsDialog title="Add internal work note" busy={busy} onClose={() => setEvidenceDialog(null)}><form className="task-form" onSubmit={saveNote}><p className="field-hint">This note is internal to the Service Provider and is not exposed as customer-visible content.</p><label>Note<textarea autoFocus value={note} onChange={(event) => setNote(event.target.value)} required maxLength={4000} rows={5} /></label><div className="evidence-dialog-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setEvidenceDialog(null)}>Cancel</Button><Button type="submit" busy={busy || !note.trim()}>Save note</Button></div></form></OperationsDialog>}
    {evidenceDialog === 'part' && <OperationsDialog title="Record part usage" busy={busy} onClose={() => setEvidenceDialog(null)}><form className="task-form" onSubmit={savePart}><label>Part source<SortedSelect value={part.source} onChange={(event) => setPart((current) => ({ ...current, source: event.target.value, part_definition_id: '' }))}><option value="PROVIDER">Provider catalogue</option><option value="CUSTOMER">Customer supplied</option><option value="EXTERNAL">External / unlisted</option></SortedSelect></label>{part.source === 'PROVIDER' && <label>Provider part<SortedSelect value={part.part_definition_id} onChange={(event) => setPart((current) => ({ ...current, part_definition_id: event.target.value }))} required><option value="">Select a provider part</option>{partDefinitions?.data.map((definition) => <option key={definition.id} value={definition.id}>{definition.attributes.name} · {definition.attributes.code}</option>)}</SortedSelect></label>}<label>Part description<input autoFocus value={part.description} onChange={(event) => setPart((current) => ({ ...current, description: event.target.value }))} required maxLength={200} /></label><label>Quantity<input type="number" min="0.001" step="0.001" value={part.quantity} onChange={(event) => setPart((current) => ({ ...current, quantity: event.target.value }))} required /></label><label>Unit<input value={part.unit} onChange={(event) => setPart((current) => ({ ...current, unit: event.target.value }))} required maxLength={40} /></label><div className="evidence-dialog-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setEvidenceDialog(null)}>Cancel</Button><Button type="submit" busy={busy || !partFormReady || submittedReport}>Record part</Button></div></form></OperationsDialog>}
  </section>;
}

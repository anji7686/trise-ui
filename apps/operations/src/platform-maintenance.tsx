import { useEffect, useState } from 'react';
import { Button, DetailSection, StatePanel } from '@trise/ui';
import { operationsData, PLATFORM_AVAILABILITY_CHANGED_EVENT, type Resource } from './data';
import { AdminPageHeader } from './platform-admin-ui';
import { OperationsDialog } from './operations-dialog';
import { OperationsStatus as Status } from './operations-status';

type MaintenanceAttributes = {
  status: 'SCHEDULED' | 'ACTIVE' | 'ENDED';
  mode: 'FULL_PLATFORM' | 'NEW_ACTIVITY_INTAKE' | 'PLATFORM_ADMINISTRATION';
  label: string;
  blocked_scopes: string[];
  reason: string;
  starts_at?: string | null;
  scheduled_end_at?: string | null;
  ended_at?: string | null;
  activated_by_user_id: string;
  deactivated_by_user_id?: string | null;
  revision: number;
  pre_maintenance_snapshot: Record<string, unknown>;
  notification_summary: Record<string, unknown>;
};

type MaintenanceResponse = { data: Resource<MaintenanceAttributes> | null; latest?: Resource<MaintenanceAttributes> | null };
type Mode = MaintenanceAttributes['mode'];
type MaintenanceConfirmation = 'activate' | 'deactivate' | 'update';

const errorText = (error: unknown) => (error as { message?: string })?.message || 'The maintenance control request could not be completed.';
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'Not available';
const indiaDateTimeInput = (value = new Date()) => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(value).reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
};
const defaultMaintenanceStart = () => indiaDateTimeInput(new Date(Date.now() + 60_000));
const indiaDateTimeTimestamp = (value: string) => `${value}:00+05:30`;
const indiaDateTimeFromServer = (value?: string | null) => value ? indiaDateTimeInput(new Date(value)) : '';
const notifyAvailabilityChanged = () => window.dispatchEvent(new Event(PLATFORM_AVAILABILITY_CHANGED_EVENT));
const modeDescriptions: Record<Mode, { title: string; description: string; impact: string }> = {
  FULL_PLATFORM: { title: 'Full platform maintenance', description: 'Temporarily blocks all authenticated write activities across the platform.', impact: 'Reads, login, notification viewing and Global Administrator recovery remain available. Existing records are not changed.' },
  NEW_ACTIVITY_INTAKE: { title: 'Pause new activity intake', description: 'Blocks new requests, bookings, leads, jobs, cases, quotations and subscription requests.', impact: 'Existing provider work and records can continue to be updated. No provider or operation status is suspended.' },
  PLATFORM_ADMINISTRATION: { title: 'Platform administration maintenance', description: 'Blocks platform configuration and provider administration writes.', impact: 'Customer and provider operational activity remains available. Global Administrators can still recover the control.' },
};

export function PlatformMaintenancePage({ capabilities = [] }: { capabilities?: string[] }) {
  const canWrite = capabilities.includes('PLATFORM_MAINTENANCE_WRITE');
  const [current, setCurrent] = useState<Resource<MaintenanceAttributes> | null>(null);
  const [latest, setLatest] = useState<Resource<MaintenanceAttributes> | null>(null);
  const [mode, setMode] = useState<Mode>('FULL_PLATFORM');
  const [reason, setReason] = useState('');
  const [scheduledStartAt, setScheduledStartAt] = useState(defaultMaintenanceStart());
  const [scheduledEndAt, setScheduledEndAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errorKind, setErrorKind] = useState<'validation' | 'request'>('request');
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState<MaintenanceConfirmation | null>(null);

  const setValidationError = (value: string) => {
    setErrorKind('validation');
    setError(value);
  };

  async function load() {
    setError('');
    try {
      const response = await operationsData.platformMaintenance() as MaintenanceResponse;
      setCurrent(response.data);
      setLatest(response.latest || response.data);
      setScheduledStartAt(indiaDateTimeFromServer(response.data?.attributes.starts_at) || defaultMaintenanceStart());
      setScheduledEndAt(indiaDateTimeFromServer(response.data?.attributes.scheduled_end_at));
    } catch (cause) { setError(errorText(cause)); }
  }

  useEffect(() => { void load(); }, []);

  async function activateConfirmed() {
    if (!reason.trim() || busy || !scheduledStartAt || !scheduledEndAt) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await operationsData.activatePlatformMaintenance({ mode, reason: reason.trim(), scheduled_start_at: indiaDateTimeTimestamp(scheduledStartAt), scheduled_end_at: indiaDateTimeTimestamp(scheduledEndAt) }, crypto.randomUUID());
      setCurrent(response.data); setLatest(response.data); setReason(''); setScheduledStartAt(indiaDateTimeFromServer(response.data.attributes.starts_at) || indiaDateTimeInput()); setScheduledEndAt(indiaDateTimeFromServer(response.data.attributes.scheduled_end_at)); setMessage(response.data.attributes.status === 'SCHEDULED' ? 'Maintenance is scheduled. Service Provider administrators were notified.' : 'Maintenance is active. Service Provider administrators were notified.');
      notifyAvailabilityChanged();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  function activate() {
    if (!reason.trim() || busy) return;
    if (!scheduledStartAt || !scheduledEndAt) {
      setValidationError('Set both the maintenance start and end date/time before activating maintenance.');
      return;
    }
    const startTime = new Date(indiaDateTimeTimestamp(scheduledStartAt)).getTime();
    const endTime = new Date(indiaDateTimeTimestamp(scheduledEndAt)).getTime();
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
      setValidationError('Enter valid maintenance start and end date/time values.');
      return;
    }
    if (endTime <= startTime) {
      setValidationError('The maintenance end time must be after the start time.');
      return;
    }
    setConfirmation('activate');
  }

  async function deactivateConfirmed() {
    if (!current || !reason.trim() || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await operationsData.deactivatePlatformMaintenance({ expected_revision: current.attributes.revision, reason: reason.trim() }, crypto.randomUUID());
      setCurrent(null); setLatest(response.data); setReason(''); setScheduledStartAt(defaultMaintenanceStart()); setScheduledEndAt(''); setMessage('Maintenance ended. Normal platform activity is available again.');
      notifyAvailabilityChanged();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  function deactivate() {
    if (!current || !reason.trim() || busy) return;
    setConfirmation('deactivate');
  }

  async function updateWindowConfirmed() {
    if (!current || !scheduledStartAt || !scheduledEndAt || !reason.trim() || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await operationsData.updatePlatformMaintenanceWindow({ expected_revision: current.attributes.revision, scheduled_start_at: indiaDateTimeTimestamp(scheduledStartAt), scheduled_end_at: indiaDateTimeTimestamp(scheduledEndAt), reason: reason.trim() }, crypto.randomUUID());
      setCurrent(response.data); setLatest(response.data); setReason(''); setScheduledStartAt(indiaDateTimeFromServer(response.data.attributes.starts_at) || defaultMaintenanceStart()); setScheduledEndAt(indiaDateTimeFromServer(response.data.attributes.scheduled_end_at)); setMessage('The maintenance window was updated and recorded in the audit history.');
      notifyAvailabilityChanged();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  function updateWindow() {
    if (!current || !scheduledStartAt || !scheduledEndAt || !reason.trim() || busy) return;
    if (current.attributes.status === 'SCHEDULED' && new Date(indiaDateTimeTimestamp(scheduledStartAt)).getTime() <= Date.now()) {
      setValidationError('The scheduled maintenance start time must be in the future.');
      return;
    }
    if (new Date(indiaDateTimeTimestamp(scheduledEndAt)).getTime() <= new Date(indiaDateTimeTimestamp(scheduledStartAt)).getTime() || new Date(indiaDateTimeTimestamp(scheduledEndAt)).getTime() <= Date.now()) {
      setValidationError('The maintenance end time must be after the start time and in the future.');
      return;
    }
    setConfirmation('update');
  }

  async function completeConfirmation() {
    const action = confirmation;
    setConfirmation(null);
    if (action === 'activate') await activateConfirmed();
    if (action === 'deactivate') await deactivateConfirmed();
    if (action === 'update') await updateWindowConfirmed();
  }

  const selected = current?.attributes.mode || mode;
  const selectedDescription = modeDescriptions[selected];
  const messageTitle = message.startsWith('Maintenance ended')
    ? 'Maintenance ended'
    : message.startsWith('Maintenance is scheduled')
      ? 'Maintenance scheduled'
      : message.startsWith('Maintenance is active')
        ? 'Maintenance activated'
        : 'Maintenance update saved';
  const confirmationCopy = confirmation === 'activate'
    ? { title: 'Schedule platform maintenance?', description: 'This will notify active Service Provider administrators now. The selected platform activity will pause automatically at the start time and remain protected until the end time.', action: `Window: ${formatDate(indiaDateTimeTimestamp(scheduledStartAt))} – ${formatDate(indiaDateTimeTimestamp(scheduledEndAt))}`, confirmLabel: 'Schedule maintenance', variant: 'danger' as const }
    : confirmation === 'deactivate'
      ? { title: current?.attributes.status === 'SCHEDULED' ? 'Cancel scheduled maintenance?' : 'End platform maintenance?', description: current?.attributes.status === 'SCHEDULED' ? 'The scheduled window will be cancelled and no platform activity will be paused. Provider administrators will be notified.' : 'Normal platform activity will be restored immediately. Existing provider operations, jobs, subscriptions, contracts and configuration will not be changed.', action: current?.attributes.status === 'SCHEDULED' ? 'Scheduled window cancellation' : `Recovery reason: ${reason.trim()}`, confirmLabel: current?.attributes.status === 'SCHEDULED' ? 'Cancel scheduled maintenance' : 'End maintenance', variant: 'primary' as const }
      : confirmation === 'update'
        ? { title: 'Update the maintenance window?', description: 'Activity users and Service Provider administrators will see the new start and end times. The platform remains available until the start time, then pauses automatically for the configured window.', action: `Window: ${formatDate(indiaDateTimeTimestamp(scheduledStartAt))} – ${formatDate(indiaDateTimeTimestamp(scheduledEndAt))}`, confirmLabel: 'Save maintenance window', variant: 'primary' as const }
        : null;
  return <section className="platform-page platform-maintenance-page">
    <AdminPageHeader breadcrumbs={[{ label: 'Platform Overview', href: 'platform/overview' }, { label: 'Maintenance control' }]} eyebrow="Platform administration / Operations" title="Platform maintenance control" description="Pause platform activity through one audited control. Provider accounts, Business Operations, jobs, contracts and configuration remain unchanged and are available again when maintenance ends." />
    {error && <StatePanel title={errorKind === 'validation' ? 'Check maintenance details' : 'Maintenance control unavailable'}><span>{error}</span>{errorKind === 'request' && <Button variant="secondary" onClick={() => void load()}>Retry</Button>}</StatePanel>}
    <div className="platform-summary-grid platform-maintenance-summary">
      <article className="platform-summary-card"><span>Status</span><strong>{current ? current.attributes.status : 'OPERATIONAL'}</strong><small>{current ? `${current.attributes.status === 'SCHEDULED' ? 'Scheduled from' : 'Active since'} ${formatDate(current.attributes.starts_at)}` : 'No platform maintenance control is active'}</small></article>
      <article className="platform-summary-card"><span>Scope</span><strong>{current ? current.attributes.label : 'Normal activity'}</strong><small>{current ? current.attributes.blocked_scopes.join(', ') : 'Provider and platform state is unchanged'}</small></article>
      <article className="platform-summary-card"><span>Provider state</span><strong>Preserved</strong><small>No provider status or operation assignment is changed</small></article>
      <article className="platform-summary-card"><span>Audit</span><strong>Required</strong><small>Activation, notifications and recovery are recorded</small></article>
    </div>
    {current && <DetailSection title={current.attributes.status === 'SCHEDULED' ? 'Scheduled maintenance' : 'Active maintenance'} description={current.attributes.status === 'SCHEDULED' ? 'The platform remains available until the start time, then the selected scope is enforced automatically until the end time.' : 'The control is blocking only the selected API write scope. Existing data is not suspended or deleted.'}><div className={`platform-maintenance-active platform-maintenance-active--${current.attributes.status.toLowerCase()}`}><div className="platform-maintenance-active-copy"><div className="platform-maintenance-active-heading"><span className="platform-maintenance-state-mark" aria-hidden="true">{current.attributes.status === 'SCHEDULED' ? '◷' : '!'}</span><div><Status>{current.attributes.status === 'SCHEDULED' ? 'MAINTENANCE SCHEDULED' : 'MAINTENANCE ACTIVE'}</Status><h2>{current.attributes.label}</h2></div></div><p>{current.attributes.reason}</p></div><dl><div><dt>Starts</dt><dd>{formatDate(current.attributes.starts_at)}</dd></div><div><dt>Ends</dt><dd>{formatDate(current.attributes.scheduled_end_at)}</dd></div><div><dt>Notifications</dt><dd>{String(current.attributes.notification_summary.notification_count || 0)} sent in-app</dd></div><div><dt>Revision</dt><dd>{current.attributes.revision}</dd></div></dl></div></DetailSection>}
    <DetailSection title={current ? (current.attributes.status === 'SCHEDULED' ? 'Manage scheduled maintenance' : 'Manage active maintenance') : 'Schedule maintenance'} description={current ? (current.attributes.status === 'SCHEDULED' ? 'Update the window or cancel it before it starts. No platform activity is blocked until the start time.' : 'Update the end time or end the control early. No provider or Business Operation restoration is required because this feature does not mutate those records.') : 'Choose the smallest safe scope and a start/end window. The platform will enforce the selected scope automatically during that period.'}>
      {!current && <div className="platform-maintenance-mode-grid">{(Object.keys(modeDescriptions) as Mode[]).map((candidate) => <label className={`platform-maintenance-mode${mode === candidate ? ' selected' : ''}`} key={candidate}><input type="radio" name="maintenance-mode" value={candidate} checked={mode === candidate} disabled={!canWrite || busy} onChange={() => setMode(candidate)} /><span><strong>{modeDescriptions[candidate].title}</strong><small>{modeDescriptions[candidate].description}</small></span></label>)}</div>}
      <div className="platform-maintenance-impact"><div className="platform-maintenance-impact-heading"><span className="platform-maintenance-info-mark" aria-hidden="true">i</span><strong>{current ? 'Recovery behavior' : selectedDescription.title}</strong></div><p>{current ? 'Normal API activity will be allowed immediately after the control is ended. Existing provider operation assignments, active subscriptions, contracts, jobs and configuration remain exactly as they were.' : selectedDescription.impact}</p></div>
      <div className="platform-maintenance-window-header"><div><span className="platform-maintenance-section-label">MAINTENANCE WINDOW</span><h3>{current ? 'Manage the controlled time window' : 'Choose when the control applies'}</h3></div><span className="platform-maintenance-timezone">IST · Asia/Kolkata</span></div>
      <div className="platform-maintenance-single-window"><span aria-hidden="true">✓</span><p><strong>Single maintenance control</strong>{current ? ' A second maintenance window cannot be created until this window is cancelled or ends automatically.' : ' Only one maintenance window can be active or scheduled at a time.'}</p></div>
      <div className="platform-maintenance-window-grid"><label className="platform-maintenance-window"><span>Start date and time <b>*</b></span><div className="platform-maintenance-input-shell"><span className="platform-maintenance-input-icon" aria-hidden="true">◷</span><input type="datetime-local" required min={indiaDateTimeInput()} value={scheduledStartAt} disabled={!canWrite || busy || current?.attributes.status === 'ACTIVE'} onChange={(event) => setScheduledStartAt(event.target.value)} /></div><small>{current?.attributes.status === 'ACTIVE' ? 'The active window has already started.' : 'The platform stays available until this time.'}</small></label><label className="platform-maintenance-window"><span>End date and time <b>*</b></span><div className="platform-maintenance-input-shell"><span className="platform-maintenance-input-icon" aria-hidden="true">◷</span><input type="datetime-local" required min={scheduledStartAt || indiaDateTimeInput()} value={scheduledEndAt} disabled={!canWrite || busy} onChange={(event) => setScheduledEndAt(event.target.value)} /></div><small>The window closes automatically at this time.</small></label></div>
      <div className="platform-maintenance-window-preview"><div><span>Window starts</span><strong>{formatDate(scheduledStartAt ? indiaDateTimeTimestamp(scheduledStartAt) : null)}</strong></div><span className="platform-maintenance-window-line" aria-hidden="true" /><div><span>Window ends</span><strong>{formatDate(scheduledEndAt ? indiaDateTimeTimestamp(scheduledEndAt) : null)}</strong></div></div>
      <label className="platform-maintenance-reason"><span>{current ? 'Action reason *' : 'Maintenance reason *'}</span><textarea required minLength={3} maxLength={1000} rows={4} value={reason} disabled={!canWrite || busy} onChange={(event) => setReason(event.target.value)} placeholder={current ? 'Explain the window update or why normal activity is being restored' : 'Explain the maintenance window and expected impact'} /><small>Visible to Platform Administration and included in the audit record.</small></label>
      {!canWrite && <p className="platform-form-note">Your platform role can view maintenance state but cannot activate or end it. Only the authorized Global Administrator can control the platform-wide switch.</p>}
      <div className="platform-form-actions">{current ? <><Button variant="secondary" busy={busy} disabled={!canWrite || !scheduledStartAt || !scheduledEndAt || reason.trim().length < 3} onClick={() => void updateWindow()}>Save maintenance window</Button><Button variant="primary" busy={busy} disabled={!canWrite || reason.trim().length < 3} onClick={() => void deactivate()}>{current.attributes.status === 'SCHEDULED' ? 'Cancel scheduled maintenance' : 'End maintenance'}</Button></> : <Button variant="danger" busy={busy} disabled={!canWrite || !scheduledStartAt || !scheduledEndAt || reason.trim().length < 3} onClick={() => void activate()}>Schedule maintenance</Button>}</div>
      {message && <OperationsDialog title={messageTitle} onClose={() => setMessage('')} className="platform-notification-dialog"><div className="platform-notification-body" role="status"><span className="platform-notification-icon" aria-hidden="true">✓</span><p>{message}</p></div><div className="platform-form-actions"><Button type="button" onClick={() => setMessage('')}>Continue</Button></div></OperationsDialog>}
    </DetailSection>
    {latest && !current && latest.attributes.status === 'ENDED' && <DetailSection title="Last maintenance window" description="Historical control details are retained for audit and operational review."><dl className="platform-definition-list"><dt>Scope</dt><dd>{latest.attributes.label}</dd><dt>Started</dt><dd>{formatDate(latest.attributes.starts_at)}</dd><dt>Expected completion</dt><dd>{formatDate(latest.attributes.scheduled_end_at)}</dd><dt>Ended</dt><dd>{formatDate(latest.attributes.ended_at)}</dd><dt>Reason</dt><dd>{latest.attributes.reason}</dd></dl></DetailSection>}
    {confirmationCopy && <OperationsDialog title={confirmationCopy.title} busy={busy} onClose={() => setConfirmation(null)} className="platform-confirmation-dialog platform-maintenance-confirmation-dialog"><p>{confirmationCopy.description}</p><div className="platform-maintenance-confirmation-summary"><strong>{confirmationCopy.action}</strong><span>Action reason: {reason.trim()}</span></div><div className="platform-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirmation(null)}>Cancel</Button><Button type="button" variant={confirmationCopy.variant} busy={busy} onClick={() => void completeConfirmation()}>{confirmationCopy.confirmLabel}</Button></div></OperationsDialog>}
  </section>;
}

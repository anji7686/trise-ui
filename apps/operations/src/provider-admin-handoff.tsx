import { useState, type FormEvent } from 'react';
import { Button, DetailSection, StatePanel } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { operationsData, type PlatformProviderAttributes, type PlatformProviderManagerAssignment, type Resource } from './data';
import { localDateTime } from './subscription-support';
import { useSubscriptionActions } from './use-subscription-actions';
import { useReviewReason } from './subscription-review';
import { useScopedRecords } from './use-scoped-records';
import { ProviderAdminInvitationManager } from './provider-admin-invitations';

export function ProviderAdminHandoff({ provider, capabilities }: { provider: Resource<PlatformProviderAttributes>; capabilities: string[] }) {
  const [userId, setUserId] = useState('');
  const [startsAt, setStartsAt] = useState(() => localDateTime(new Date()));
  const [endsAt, setEndsAt] = useState('');
  const canRead = capabilities.includes('PLATFORM_PROVIDER_READ');
  const assignments = useScopedRecords(`manager-assignments:${provider.id}`, after => operationsData.platformProviderManagerAssignments(provider.id, { after }), canRead);
  const { busy, error, setError, run } = useSubscriptionActions(`handoff:${provider.id}`);
  const review = useReviewReason(provider.id);
  async function assign(event: FormEvent) {
    event.preventDefault();
    if (Date.parse(endsAt) <= Date.parse(startsAt)) { setError('The assignment end must be after its start.'); return; }
    const body = { provider_id: provider.id, user_id: userId.trim(), effective_from: new Date(startsAt).toISOString(), effective_to: new Date(endsAt).toISOString() };
    await run(JSON.stringify(['manager-assignment', body]), key => operationsData.createPlatformProviderManagerAssignment(body, key), async () => { setUserId(''); setEndsAt(''); if (canRead) await assignments.load(); });
  }
  async function end(assignment: Resource<PlatformProviderManagerAssignment>) {
    const record = assignment; const reason = await review.ask('End delegated onboarding assignment'); if (reason === null) return;
    const body = { expected_revision: record.attributes.revision, reason };
    await run(JSON.stringify(['end-manager-assignment', record.id, body]), key => operationsData.endPlatformProviderManagerAssignment(record.id, body, key), () => assignments.load());
  }
  const configured = provider.attributes.provider_admin_setup;
  return <DetailSection title="Administrator setup and onboarding handoff" description="Provider administrator membership and delegated platform onboarding are separate grants.">
    {review.modal}
    <p>Provider administrator setup: <Status>{configured === 'configured' ? 'Configured' : configured === 'not_configured' ? 'Not configured' : 'Not available'}</Status></p>
    <ol><li>Review provider identity, business verification and subscription records.</li><li>Confirm the intended administrator is an existing verified user.</li><li>Create an administrator invitation when separately authorized. The intended user accepts from their own account; invitation creation does not grant membership.</li><li>Confirm the refreshed provider record reports administrator setup as configured, then verify access in the provider workspace.</li></ol>
    {(error || (canRead && assignments.error)) && <StatePanel title="Onboarding assignment needs attention">{error || assignments.error}</StatePanel>}
    {capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE') && <>
      <p>A delegated manager must separately hold an active platform grant with PLATFORM_PROVIDER_ONBOARD. Assigning a provider here creates no user, platform grant or provider membership.</p>
      <form className="platform-filter-toolbar" onSubmit={assign}><label>Existing platform user ID<input disabled={busy} required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" value={userId} onChange={event => setUserId(event.target.value)} /></label><label>Assignment starts<input disabled={busy} required type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} /></label><label>Assignment ends<input disabled={busy} required type="datetime-local" value={endsAt} onChange={event => setEndsAt(event.target.value)} /></label><Button type="submit" busy={busy}>Assign onboarding manager</Button></form>

    </>}
    {canRead ? <div>
      <h3>Delegated onboarding assignments</h3>
      {assignments.loading && <p role="status">Loading assignments…</p>}
      <div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>User</th><th>Status</th><th>Effective window</th><th>Actions</th></tr></thead><tbody>{assignments.records.map(assignment => <tr key={assignment.id}><td>{assignment.attributes.user_id}</td><td><Status>{assignment.attributes.status}</Status></td><td>{new Date(assignment.attributes.effective_from).toLocaleString()} to {assignment.attributes.effective_to ? new Date(assignment.attributes.effective_to).toLocaleString() : 'No recorded end'}</td><td>{assignment.attributes.status === 'ACTIVE' && capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE') && <Button disabled={busy || assignments.loading} variant="secondary" onClick={() => void end(assignment)}>End assignment</Button>}</td></tr>)}</tbody></table></div>
      {!assignments.loading && !assignments.error && !assignments.records.length && <p>No delegated onboarding assignments recorded.</p>}
      <p>{assignments.records.length} assignments loaded.</p>
      <Button disabled={busy || assignments.loading} variant="quiet" onClick={() => void assignments.load()}>Refresh assignments</Button>
      {assignments.cursor && <Button busy={assignments.loading} disabled={busy} onClick={() => void assignments.loadMore()}>Load more assignments</Button>}
    </div> : <p>Assignment history requires provider read permission.</p>}
    {capabilities.includes('PLATFORM_PROVIDER_ADMIN_INVITE') ? <ProviderAdminInvitationManager key={provider.id} providerId={provider.id} /> : <p>Administrator invitation management requires a separate platform grant.</p>}
  </DetailSection>;
}

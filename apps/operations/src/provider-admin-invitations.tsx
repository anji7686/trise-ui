import { useState, type FormEvent } from 'react';
import { Button, DetailSection, PageHeader, StatePanel } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { operationsData, type ProviderAdminInvitation } from './data';
import { localDateTime } from './subscription-support';
import { useSubscriptionActions } from './use-subscription-actions';
import { useReviewReason } from './subscription-review';
import { useScopedRecords } from './use-scoped-records';

export function validInvitationExpiry(value: string, now = Date.now()) {
  const expiry = Date.parse(value);
  return Number.isFinite(expiry) && expiry > now && expiry <= now + 7 * 24 * 60 * 60 * 1000;
}

export function ProviderAdminInvitationManager({ providerId }: { providerId: string }) {
  const list = useScopedRecords(`admin-invitations:${providerId}`, after => operationsData.platformProviderAdminInvitations(providerId, after));
  const { busy, error, setError, run } = useSubscriptionActions(`admin-invitations:${providerId}`);
  const review = useReviewReason(providerId);
  const [userId, setUserId] = useState('');
  const [expiresAt, setExpiresAt] = useState(() => localDateTime(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)));
  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!validInvitationExpiry(expiresAt)) { setError('Choose a future expiry within seven days.'); return; }
    const reason = await review.ask('Invite provider administrator'); if (reason === null) return;
    const body = { user_id: userId.trim(), expires_at: new Date(expiresAt).toISOString(), reason };
    await run(JSON.stringify(['admin-invite', providerId, body]), key => operationsData.createPlatformProviderAdminInvitation(providerId, body, key), async () => { setUserId(''); await list.load(); });
  }
  async function revoke(invitation: ProviderAdminInvitation) {
    const reason = await review.ask('Revoke pending administrator invitation'); if (reason === null) return;
    const body = { expected_revision: invitation.attributes.revision, reason };
    await run(JSON.stringify(['admin-invite-revoke', providerId, invitation.id, body]), key => operationsData.revokePlatformProviderAdminInvitation(providerId, invitation.id, body, key), () => list.load());
  }
  return <DetailSection title="Provider administrator invitations" description="Invite an existing verified user. Membership begins only after that user accepts; provider activation remains a separate decision.">
    {review.modal}
    <p>The intended administrator signs in normally and opens Administrator invitations from their account menu. New users must first complete the normal identity registration process. No message is sent by this action.</p>
    {(error || list.error) && <StatePanel title="Administrator invitation needs attention">{error || list.error}<Button disabled={busy || list.loading} onClick={() => void list.load()}>Reload invitations</Button></StatePanel>}
    <form className="platform-filter-toolbar" onSubmit={invite}>
      <label>Existing administrator user ID<input required disabled={busy || list.loading} pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" value={userId} onChange={event => setUserId(event.target.value)} /></label>
      <label>Accept before<input required disabled={busy || list.loading} type="datetime-local" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} /></label>
      <Button type="submit" disabled={list.loading} busy={busy}>Create administrator invitation</Button>
    </form>
    {list.loading && <p role="status">Loading invitations…</p>}
    <div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>User</th><th>Status</th><th>Accept before</th><th>Actions</th></tr></thead><tbody>{list.records.map(row => <tr key={row.id}><td>{row.attributes.target_user_id}</td><td><Status>{row.attributes.status === 'PENDING' && row.attributes.expired ? 'Expired' : row.attributes.status}</Status></td><td>{new Date(row.attributes.expires_at).toLocaleString()}</td><td>{row.attributes.status === 'PENDING' && <Button disabled={busy || list.loading} variant="quiet" onClick={() => void revoke(row)}>Revoke invitation</Button>}</td></tr>)}</tbody></table></div>
    {!list.loading && !list.error && !list.records.length && <p>No administrator invitations recorded.</p>}
    <p>{list.records.length} invitations loaded.</p>{list.cursor && <Button disabled={busy} busy={list.loading} onClick={() => void list.loadMore()}>Load more invitations</Button>}
  </DetailSection>;
}

export function MyProviderAdminInvitations({ onAccepted }: { onAccepted: () => Promise<void> }) {
  const list = useScopedRecords('my-admin-invitations', after => operationsData.myProviderAdminInvitations(after));
  const { busy, error, run } = useSubscriptionActions('my-admin-invitations');
  const [confirming, setConfirming] = useState<ProviderAdminInvitation | null>(null);
  async function accept(invitation: ProviderAdminInvitation) {
    const body = { expected_revision: invitation.attributes.revision };
    await run(JSON.stringify(['accept-admin-invite', invitation.id, body]), key => operationsData.acceptProviderAdminInvitation(invitation.id, body, key), async () => { setConfirming(null); await list.load(); await onAccepted(); });
  }
  return <section className="platform-page"><PageHeader eyebrow="My account" title="Administrator invitations" description="Only invitations addressed to your signed-in identity are shown. Acceptance grants provider administrator membership; provider activation remains separate." />
    {(error || list.error) && <StatePanel title="Invitation could not be completed">{error || list.error}<Button disabled={busy || list.loading} onClick={() => void list.load()}>Reload invitations</Button></StatePanel>}
    {list.loading && <p role="status">Loading your invitations…</p>}
    {list.records.map(row => <DetailSection key={row.id} title={row.attributes.provider_name}><Status>{row.attributes.status === 'PENDING' && row.attributes.expired ? 'Expired' : row.attributes.status}</Status><p>Accept before {new Date(row.attributes.expires_at).toLocaleString()}</p>
      {row.attributes.status === 'PENDING' && !row.attributes.expired && (confirming?.id === row.id ? <div><p>Confirm provider administrator membership for {row.attributes.provider_name}.</p><div className="platform-form-actions"><Button disabled={busy} variant="secondary" onClick={() => setConfirming(null)}>Cancel</Button><Button busy={busy} disabled={list.loading} onClick={() => void accept(row)}>Confirm acceptance</Button></div></div> : <Button disabled={busy || list.loading} onClick={() => setConfirming(row)}>Accept invitation</Button>)}
      {row.attributes.status === 'ACCEPTED' && <p>Membership accepted. Reload the workspace list to check available provider access.</p>}
    </DetailSection>)}
    {!list.loading && !list.error && !list.records.length && <p>No administrator invitations addressed to you.</p>}
    {list.cursor && <Button busy={list.loading} disabled={busy} onClick={() => void list.loadMore()}>Load more invitations</Button>}
  </section>;
}

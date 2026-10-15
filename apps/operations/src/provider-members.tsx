import { useRef, useState } from 'react';
import { Button } from '@trise/ui';
import { accessData, type AccessMember, type AccessRole, type TeamInvitation } from './access-data';
import { OperationsDialog } from './operations-dialog';
import { OperationsStatus } from './operations-status';
import { useScopedRecords } from './use-scoped-records';

export function MemberRoleBadges({ roles, administrator = false, membershipContext }: { roles: AccessMember['attributes']['roles']; administrator?: boolean; membershipContext?: string }) {
  const legacy = membershipContext && !administrator ? ({ OPERATIONS: 'Operations access', DISPATCHER: 'Dispatcher access', AGENT: 'Agent access' } as Record<string, string>)[membershipContext] : null;
  return <span>{administrator && <span className="status">Provider Administrator · membership access </span>}{legacy && <span className="status">{legacy} · membership access </span>}{roles.length ? roles.map(role => <span className="status" key={role.id}>{role.name}{!role.enabled && ' · Disabled'} </span>) : !administrator && !legacy ? 'No assigned roles' : null}</span>;
}

export function ProviderMembers({ providerId, roleId, readOnly = false }: { providerId: string; roleId?: string; readOnly?: boolean }) {
  const members = useScopedRecords(`members:${providerId}:${roleId || ''}`, after => accessData.members(providerId, after, roleId));
  const [selected, setSelected] = useState<AccessMember | null>(null);
  const [transitioning, setTransitioning] = useState<{ member: AccessMember; action: 'suspend' | 'restore' } | null>(null);
  return <section>{members.error && <p role="alert">{members.error}</p>}{members.loading && <p role="status">Loading members…</p>}<div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr>{['Member Name', 'Email', 'Assigned Roles', 'Status', 'Actions'].map(name => <th key={name}>{name}</th>)}</tr></thead><tbody>{members.records.map(member => <tr key={member.id}><td>{member.attributes.name || 'Name not recorded'}</td><td>{member.attributes.email || 'Email not recorded'}</td><td><MemberRoleBadges roles={member.attributes.roles} administrator={member.attributes.administrator} membershipContext={member.attributes.membership_context} /></td><td><OperationsStatus>{member.attributes.status}</OperationsStatus></td><td>{!readOnly && member.attributes.status === 'active' && <Button variant="quiet" disabled={members.loading} onClick={() => setTransitioning({ member, action: 'suspend' })}>Suspend Access</Button>}{!readOnly && member.attributes.status === 'suspended' && <Button variant="quiet" disabled={members.loading} onClick={() => setTransitioning({ member, action: 'restore' })}>Restore Access</Button>}{member.attributes.status === 'active' && <Button variant="quiet" disabled={readOnly || members.loading} onClick={() => setSelected(member)}>Manage Roles</Button>}</td></tr>)}</tbody></table></div>{!members.loading && members.records.length === 0 && <p>No members loaded.</p>}{members.cursor && <Button disabled={members.loading} onClick={() => void members.loadMore()}>Load more members</Button>}{selected && <MemberRoleEditor member={selected} providerId={providerId} onClose={() => setSelected(null)} onSaved={async () => { setSelected(null); await members.load(); }} />}{transitioning && <MemberAccessTransition member={transitioning.member} action={transitioning.action} providerId={providerId} onClose={() => setTransitioning(null)} onSaved={async () => { setTransitioning(null); await members.load(); }} />}</section>;
}

function MemberAccessTransition({ member, action, providerId, onClose, onSaved }: { member: AccessMember; action: 'suspend' | 'restore'; providerId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const request = useRef({ payload: '', key: '' });
  async function submit() {
    const trimmed = reason.trim(); if (!trimmed) { setError('A reason is required.'); return; }
    const payload = `${action}:${member.attributes.revision}:${trimmed}`; if (request.current.payload !== payload) request.current = { payload, key: crypto.randomUUID() };
    setBusy(true); setError('');
    try { await accessData.transitionMember(providerId, member, action, trimmed, request.current.key); await onSaved(); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const suspend = action === 'suspend';
  return <OperationsDialog title={suspend ? 'Suspend Provider Access' : 'Restore Provider Access'} onClose={onClose} busy={busy}><form onSubmit={event => { event.preventDefault(); void submit(); }}><p><strong>{member.attributes.name || 'Provider member'}</strong><br />{member.attributes.email || 'Email not recorded'}</p><p>This changes access only for the current Service Provider. The action is recorded with your identity, timestamp, and reason.</p><label>Reason<textarea required minLength={1} maxLength={1000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>{error && <p role="alert">{error}</p>}<div className="platform-form-actions"><Button type="button" variant="quiet" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !reason.trim()}>{suspend ? 'Confirm Suspension' : 'Confirm Restoration'}</Button></div></form></OperationsDialog>;
}

function MemberRoleEditor({ member, providerId, onClose, onSaved }: { member: AccessMember; providerId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const roles = useScopedRecords(`member-roles:${providerId}`, after => accessData.providerRoles(providerId, after));
  const [selected, setSelected] = useState(member.attributes.roles.map(role => role.id));
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const request = useRef({ payload: '', key: '' });
  async function save() {
    const payload = JSON.stringify([...selected].sort()); if (request.current.payload !== payload) request.current = { payload, key: crypto.randomUUID() };
    setBusy(true); setError('');
    try { await accessData.replaceMemberRoles(providerId, member, selected, request.current.key); await onSaved(); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const available = roles.records.filter(role => role.attributes.assignable || selected.includes(role.id));
  const missing = member.attributes.roles.filter(role => selected.includes(role.id) && !roles.records.some(item => item.id === role.id));
  return <OperationsDialog title="Manage Roles" onClose={onClose} busy={busy}><form onSubmit={event => { event.preventDefault(); void save(); }}><p><strong>{member.attributes.name || 'Provider member'}</strong><br />{member.attributes.email || 'Email not recorded'}</p>{member.attributes.administrator && <p>Provider administrator access is protected and remains separate from these roles.</p>}{roles.loading && <p role="status">Loading available roles…</p>}{available.map(role => <RoleChoice key={role.id} role={role} checked={selected.includes(role.id)} busy={busy} onChange={checked => setSelected(checked ? [...selected, role.id] : selected.filter(id => id !== role.id))} />)}{missing.map(role => <label className="access-role-choice" key={role.id}><input type="checkbox" checked disabled={busy} onChange={() => setSelected(selected.filter(id => id !== role.id))} />{role.name} · Currently assigned; load more roles or remove</label>)}{roles.cursor && <Button type="button" variant="quiet" disabled={busy || roles.loading} onClick={() => void roles.loadMore()}>Load more available roles</Button>}{(error || roles.error) && <p role="alert">{error || roles.error}</p>}<div className="platform-form-actions"><Button type="button" variant="quiet" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || roles.loading || !!roles.error}>Save</Button></div></form></OperationsDialog>;
}

function RoleChoice({ role, checked, busy, onChange }: { role: AccessRole; checked: boolean; busy: boolean; onChange: (checked: boolean) => void }) {
  return <label className="access-role-choice"><input type="checkbox" checked={checked} disabled={busy || (!checked && !role.attributes.assignable)} onChange={event => onChange(event.target.checked)} /><span><strong>{role.attributes.name}</strong><small>{role.attributes.description || 'No responsibilities recorded'}{role.attributes.role_type === 'default' && ' · Platform role'}</small>{!role.attributes.assignable && <small>Unavailable for new assignments</small>}</span></label>;
}

export function ProviderInvitations({ providerId }: { providerId: string }) {
  const invitations = useScopedRecords(`team-invitations:${providerId}`, after => accessData.teamInvitations(providerId, after));
  const administratorInvitations = useScopedRecords(`administrator-invitations:${providerId}`, after => accessData.invitations(providerId, after));
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function revoke(item: TeamInvitation) {
    if (!window.confirm(`Revoke the pending invitation for ${item.attributes.email || 'this member'}?`)) return;
    setBusy(true); setError('');
    try { await accessData.revokeTeamInvitation(providerId, item, crypto.randomUUID()); await invitations.load(); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <section><h2>Team invitations</h2><p>Invitations are available in the existing verified user’s signed-in account. No email is sent.</p>{(error || invitations.error) && <p role="alert">{error || invitations.error}</p>}{invitations.loading && <p role="status">Loading invitations…</p>}<div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Email</th><th>Status</th><th>Expires</th><th>Actions</th></tr></thead><tbody>{invitations.records.map(item => <tr key={item.id}><td>{item.attributes.email || 'Existing verified user'}</td><td><OperationsStatus>{item.attributes.expired && item.attributes.status === 'pending' ? 'Expired' : item.attributes.status}</OperationsStatus></td><td>{new Date(item.attributes.expires_at).toLocaleString()}</td><td>{item.attributes.status === 'pending' && !item.attributes.expired && <Button variant="quiet" disabled={busy} onClick={() => void revoke(item)}>Revoke</Button>}</td></tr>)}</tbody></table></div>{!invitations.loading && invitations.records.length === 0 && <p>No team invitations yet.</p>}{invitations.cursor && <Button disabled={invitations.loading} onClick={() => void invitations.loadMore()}>Load more invitations</Button>}<h2>Administrator enrollment</h2><p>Protected administrator invitations are issued through Platform Administration.</p>{administratorInvitations.error && <p role="alert">{administratorInvitations.error}</p>}<div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Invitation reference</th><th>Status</th><th>Expires</th></tr></thead><tbody>{administratorInvitations.records.map(item => <tr key={item.id}><td>{item.id}</td><td>{item.attributes.expired && item.attributes.status === 'PENDING' ? 'Expired' : item.attributes.status}</td><td>{new Date(item.attributes.expires_at).toLocaleString()}</td></tr>)}</tbody></table></div>{administratorInvitations.cursor && <Button disabled={administratorInvitations.loading} onClick={() => void administratorInvitations.loadMore()}>Load more administrator invitations</Button>}</section>;
}

export function AddMemberEditor({ providerId, onClose, onCreated }: { providerId: string; onClose: () => void; onCreated: () => void }) {
  const roles = useScopedRecords(`invite-roles:${providerId}`, after => accessData.providerRoles(providerId, after));
  const [email, setEmail] = useState(''); const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const request = useRef({ payload: '', key: '' });
  async function create() {
    if (!selected.length) { setError('Select at least one available role.'); return; }
    const input = { email: email.trim(), role_ids: selected, expires_at: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString() };
    const payload = JSON.stringify(input); if (request.current.payload !== payload) request.current = { payload, key: crypto.randomUUID() };
    setBusy(true); setError('');
    try { await accessData.createTeamInvitation(providerId, input, request.current.key); onCreated(); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <OperationsDialog title="Add Member" onClose={onClose} busy={busy}><form onSubmit={event => { event.preventDefault(); void create(); }}><p>Invite an existing verified TRISE user to this Provider Account. They accept from Team invitations in their signed-in account.</p><label>Email Address<input type="email" required maxLength={320} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label><fieldset><legend>Roles</legend>{roles.loading && <p role="status">Loading available roles…</p>}{roles.records.filter(role => role.attributes.assignable).map(role => <RoleChoice key={role.id} role={role} checked={selected.includes(role.id)} busy={busy} onChange={checked => setSelected(checked ? [...selected, role.id] : selected.filter(id => id !== role.id))} />)}{!roles.loading && !roles.records.some(role => role.attributes.assignable) && <p>No assignable roles are available yet. Platform Administration must publish an eligible role first.</p>}{roles.cursor && <Button type="button" variant="quiet" disabled={roles.loading || busy} onClick={() => void roles.loadMore()}>Load more roles</Button>}</fieldset>{(error || roles.error) && <p role="alert">{error || roles.error}</p>}<div className="platform-form-actions"><Button type="button" variant="quiet" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || roles.loading || !!roles.error || !selected.length}>Create Invitation</Button></div></form></OperationsDialog>;
}

export function MyTeamInvitations({ onAccepted }: { onAccepted: () => Promise<void> }) {
  const invitations = useScopedRecords('my-team-invitations', accessData.myTeamInvitations);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function accept(item: TeamInvitation) {
    if (!window.confirm(`Join ${item.attributes.provider_name || 'this provider'} with the offered roles?`)) return;
    setBusy(true); setError('');
    try { await accessData.acceptTeamInvitation(item, crypto.randomUUID()); await invitations.load(); await onAccepted(); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <section className="platform-page"><h1>Team invitations</h1><p>Invitations addressed to your signed-in identity appear here.</p>{(error || invitations.error) && <p role="alert">{error || invitations.error}</p>}{invitations.loading && <p role="status">Loading invitations…</p>}<div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Provider Account</th><th>Roles offered</th><th>Status</th><th>Action</th></tr></thead><tbody>{invitations.records.map(item => <tr key={item.id}><td>{item.attributes.provider_name || 'Provider account'}</td><td>{item.attributes.role_ids.length} role{item.attributes.role_ids.length === 1 ? '' : 's'}</td><td><OperationsStatus>{item.attributes.expired && item.attributes.status === 'pending' ? 'Expired' : item.attributes.status}</OperationsStatus></td><td>{item.attributes.status === 'pending' && !item.attributes.expired && <Button disabled={busy} onClick={() => void accept(item)}>Accept invitation</Button>}</td></tr>)}</tbody></table></div>{!invitations.loading && !invitations.records.length && <p>No team invitations addressed to you.</p>}{invitations.cursor && <Button disabled={invitations.loading} onClick={() => void invitations.loadMore()}>Load more invitations</Button>}</section>;
}

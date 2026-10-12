import { useRef, useState } from 'react';
import { Button } from '@trise/ui';
import { accessData, type AccessMember, type AccessRole } from './access-data';
import { OperationsDialog } from './operations-dialog';
import { OperationsStatus } from './operations-status';
import { useScopedRecords } from './use-scoped-records';

export function MemberRoleBadges({ roles }: { roles: AccessMember['attributes']['roles'] }) {
  return <span>{roles.length ? roles.map(role => <span className="status" key={role.id}>{role.name}{!role.enabled && ' · Disabled'} </span>) : 'No assigned roles'}</span>;
}

export function ProviderMembers({ providerId, roleId, readOnly = false }: { providerId: string; roleId?: string; readOnly?: boolean }) {
  const members = useScopedRecords(`members:${providerId}:${roleId || ''}`, after => accessData.members(providerId, after, roleId));
  const [selected, setSelected] = useState<AccessMember | null>(null);
  return <section>{members.error && <p role="alert">{members.error}</p>}{members.loading && <p role="status">Loading members…</p>}<div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr>{['Member Name', 'Email', 'Assigned Roles', 'Status', 'Actions'].map(name => <th key={name}>{name}</th>)}</tr></thead><tbody>{members.records.map(member => <tr key={member.id}><td>{member.attributes.name || 'Name not recorded'}{member.attributes.administrator && <small> · Provider administrator</small>}</td><td>{member.attributes.email || 'Email not recorded'}</td><td><MemberRoleBadges roles={member.attributes.roles} /></td><td><OperationsStatus>{member.attributes.status}</OperationsStatus></td><td><Button variant="quiet" disabled={readOnly || members.loading || member.attributes.status !== 'active'} onClick={() => setSelected(member)}>Manage Roles</Button></td></tr>)}</tbody></table></div>{!members.loading && members.records.length === 0 && <p>No members loaded.</p>}{members.cursor && <Button disabled={members.loading} onClick={() => void members.loadMore()}>Load more members</Button>}{selected && <MemberRoleEditor member={selected} providerId={providerId} onClose={() => setSelected(null)} onSaved={async () => { setSelected(null); await members.load(); }} />}</section>;
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
  return <label className="access-role-choice"><input type="checkbox" checked={checked} disabled={busy || (!checked && !role.attributes.assignable)} onChange={event => onChange(event.target.checked)} />{role.attributes.name}{role.attributes.role_type === 'default' && ' · Platform default'}{!role.attributes.assignable && ' · Remove unavailable role before saving'}</label>;
}

export function ProviderInvitations({ providerId }: { providerId: string }) {
  const invitations = useScopedRecords(`provider-invitations:${providerId}`, after => accessData.invitations(providerId, after));
  return <section><p>Administrator invitations follow the approved enrollment workflow. An invitee accepts while signed in. Invitation creation is managed by authorized platform administrators.</p>{invitations.error && <p role="alert">{invitations.error}</p>}{invitations.loading && <p role="status">Loading invitations…</p>}<div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Invitation reference</th><th>Status</th><th>Expires</th></tr></thead><tbody>{invitations.records.map(item => <tr key={item.id}><td>{item.id}</td><td>{item.attributes.expired && item.attributes.status === 'PENDING' ? 'Expired' : item.attributes.status}</td><td>{new Date(item.attributes.expires_at).toLocaleString()}</td></tr>)}</tbody></table></div>{!invitations.loading && invitations.records.length === 0 && <p>No invitations loaded.</p>}{invitations.cursor && <Button disabled={invitations.loading} onClick={() => void invitations.loadMore()}>Load more invitations</Button>}</section>;
}

import { ProviderMembers, ProviderInvitations } from './provider-members';
import { useEffect, useRef, useState } from 'react';
import { Button, PageHeader } from '@trise/ui';
import { accessData, type AccessRole, type AccessPermission } from './access-data';
import { AccessMatrix } from './access-matrix';
import { OperationsDialog } from './operations-dialog';
import { OperationsStatus } from './operations-status';
import { useScopedRecords } from './use-scoped-records';

export function ProviderAccessPage({ providerId }: { providerId: string }) {
  const [tab, setTab] = useState('members');
  return <section className="content feature-page"><PageHeader eyebrow="Settings" title="Team & Access" description="Manage members and their access in this provider account." /><nav aria-label="Team & Access tabs" className="admin-detail-tabs">{[['members', 'Members'], ['roles', 'Roles & Permissions'], ['invitations', 'Invitations']].map(([key, label]) => <Button key={key} variant={tab === key ? 'primary' : 'quiet'} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>{label}</Button>)}</nav>{tab === 'roles' ? <ProviderRoles providerId={providerId} /> : tab === 'members' ? <ProviderMembers providerId={providerId} /> : <ProviderInvitations providerId={providerId} />}</section>;
}

export function ProviderRoles({ providerId }: { providerId: string }) {
  const roles = useScopedRecords(`roles:${providerId}`, after => accessData.providerRoles(providerId, after));
  const permissions = useScopedRecords(`permissions:${providerId}`, () => accessData.providerPermissions(providerId));
  const [editor, setEditor] = useState<{ role?: AccessRole; view?: boolean } | null>(null);
  const [memberRole, setMemberRole] = useState<AccessRole | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const active = useRef(true); useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function toggle(role: AccessRole) {
    setBusy(true); setError('');
    try { await accessData.setCustomEnabled(providerId, role, crypto.randomUUID()); if (active.current) await roles.load(); }
    catch (cause) { if (active.current) setError((cause as Error).message); } finally { if (active.current) setBusy(false); }
  }
  return <section>{(error || roles.error || permissions.error) && <p role="alert">{error || roles.error || permissions.error}</p>}{roles.loading && <p role="status">Loading roles…</p>}{(['default', 'custom'] as const).map(type => <section key={type}><div className="platform-form-actions access-section-heading"><h2>{type === 'default' ? 'Default Roles' : 'Custom Roles'}</h2>{type === 'custom' && <Button disabled={roles.loading || permissions.loading || !!permissions.error} onClick={() => setEditor({})}>New Custom Role</Button>}</div>{type === 'default' && <p>🔒 Platform managed. Default role definitions are read-only.</p>}<div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Role Name</th><th>Responsibilities</th><th>Status</th><th>Actions</th></tr></thead><tbody>{roles.records.filter(role => role.attributes.role_type === type).map(role => <tr key={role.id}><td>{type === 'default' && <span aria-label="Platform managed">🔒 </span>}{role.attributes.name}</td><td>{role.attributes.description || '—'}</td><td><OperationsStatus>{role.attributes.enabled ? 'Enabled' : 'Disabled'}</OperationsStatus></td><td><div className="platform-form-actions"><Button variant="quiet" onClick={() => setEditor({ role, view: true })}>View permissions</Button><Button variant="quiet" onClick={() => setMemberRole(role)}>View assigned members</Button>{type === 'custom' && <><Button variant="quiet" disabled={busy || roles.loading} onClick={() => setEditor({ role })}>Edit Role</Button><Button variant="quiet" disabled={busy || roles.loading} onClick={() => void toggle(role)}>{role.attributes.enabled ? 'Disable' : 'Enable'}</Button></>}</div></td></tr>)}</tbody></table></div>{!roles.loading && !roles.records.some(role => role.attributes.role_type === type) && <p>No {type} roles loaded.</p>}</section>)}{roles.cursor && <Button disabled={roles.loading} onClick={() => void roles.loadMore()}>Load more roles</Button>}{memberRole && <OperationsDialog title={`Members with ${memberRole.attributes.name}`} onClose={() => setMemberRole(null)}><ProviderMembers readOnly providerId={providerId} roleId={memberRole.id} /></OperationsDialog>}{editor && <CustomRoleEditor role={editor.role} permissions={permissions.records} providerId={providerId} readOnly={editor.view || editor.role?.attributes.role_type === 'default'} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await roles.load(); }} />}</section>;
}

function CustomRoleEditor({ role, permissions, providerId, readOnly, onClose, onSaved }: { role?: AccessRole; permissions: AccessPermission[]; providerId: string; readOnly?: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(role?.attributes.name || ''); const [description, setDescription] = useState(role?.attributes.description || '');
  const [grants, setGrants] = useState<Record<string, boolean>>(role?.attributes.permissions || {}); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const request = useRef({ payload: '', key: '' });
  async function save() {
    if (!name.trim()) { setError('Enter a role name.'); return; }
    const delegable = new Set(permissions.filter(item => item.attributes.delegable && !item.attributes.protected).map(item => item.attributes.code));
    const input = { name: name.trim(), description, permissions: Object.fromEntries(Object.entries(grants).filter(([code]) => delegable.has(code))) };
    const payload = JSON.stringify(input);
    if (request.current.payload !== payload) request.current = { payload, key: crypto.randomUUID() };
    setBusy(true); setError('');
    try { if (role) await accessData.updateCustom(providerId, role, input, request.current.key); else await accessData.createCustom(providerId, input, request.current.key); await onSaved(); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <OperationsDialog title={readOnly ? 'Role permissions' : role ? 'Edit Custom Role' : 'New Custom Role'} onClose={onClose} busy={busy}><form onSubmit={event => { event.preventDefault(); void save(); }}><div className="platform-form-grid"><label>Role Name<input required maxLength={200} disabled={readOnly || busy} value={name} onChange={event => setName(event.target.value)} /></label><label>Responsibilities<textarea maxLength={2000} disabled={readOnly || busy} value={description} onChange={event => setDescription(event.target.value)} /></label></div><AccessMatrix permissions={permissions} grants={grants} onChange={setGrants} custom readOnly={readOnly || busy} />{error && <p role="alert">{error}</p>}<div className="platform-form-actions"><Button type="button" variant="quiet" disabled={busy} onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>{!readOnly && <Button type="submit" disabled={busy}>Save</Button>}</div></form></OperationsDialog>;
}

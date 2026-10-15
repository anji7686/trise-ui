import { AddMemberEditor, ProviderMembers, ProviderInvitations } from './provider-members';
import { useEffect, useRef, useState } from 'react';
import { Button, PageHeader } from '@trise/ui';
import { accessData, type AccessRole, type AccessPermission } from './access-data';
import { AccessMatrix } from './access-matrix';
import { OperationsDialog } from './operations-dialog';
import { OperationsStatus } from './operations-status';
import { useScopedRecords } from './use-scoped-records';

export function ProviderAccessPage({ providerId }: { providerId: string }) {
  const [tab, setTab] = useState('members');
  const [adding, setAdding] = useState(false);
  return <section className="content feature-page"><PageHeader eyebrow="Settings" title="Team & Access" description="Add members and assign the roles available to this provider." /><div className="platform-form-actions"><Button onClick={() => setAdding(true)}>Add Member</Button></div><nav aria-label="Team & Access tabs" className="admin-detail-tabs">{[['members', 'Members'], ['invitations', 'Invitations'], ['roles', 'Available Roles']].map(([key, label]) => <Button key={key} variant={tab === key ? 'primary' : 'quiet'} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>{label}</Button>)}</nav>{tab === 'roles' ? <ProviderRoles providerId={providerId} /> : tab === 'members' ? <ProviderMembers providerId={providerId} /> : <ProviderInvitations providerId={providerId} />}{adding && <AddMemberEditor providerId={providerId} onClose={() => setAdding(false)} onCreated={() => { setAdding(false); setTab('invitations'); }} />}</section>;
}

export function ProviderRoles({ providerId }: { providerId: string }) {
  const roles = useScopedRecords(`roles:${providerId}`, after => accessData.providerRoles(providerId, after));
  const permissions = useScopedRecords(`permissions:${providerId}`, () => accessData.providerPermissions(providerId));
  const [editor, setEditor] = useState<{ role?: AccessRole; view?: boolean } | null>(null);
  const [memberRole, setMemberRole] = useState<AccessRole | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [customEnabled, setCustomEnabled] = useState(false);
  useEffect(() => { let mounted = true; accessData.providerRoles(providerId).then(page => { if (mounted) setCustomEnabled(page.custom_role_management_enabled === true); }).catch(() => { if (mounted) setCustomEnabled(false); }); return () => { mounted = false; }; }, [providerId]);
  const active = useRef(true); useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function toggle(role: AccessRole) {
    setBusy(true); setError('');
    try { await accessData.setCustomEnabled(providerId, role, crypto.randomUUID()); if (active.current) await roles.load(); }
    catch (cause) { if (active.current) setError((cause as Error).message); } finally { if (active.current) setBusy(false); }
  }
  const visibleRoles = roles.records.filter(role => role.attributes.role_type === 'default' || customEnabled || role.attributes.enabled);
  return <section>{(error || roles.error || permissions.error) && <p role="alert">{error || roles.error || permissions.error}</p>}{roles.loading && <p role="status">Loading roles…</p>}{(['default', 'custom'] as const).map(type => <section key={type}><div className="platform-form-actions access-section-heading"><h2>{type === 'default' ? 'Platform Default Roles' : 'Provider Custom Roles'}</h2>{type === 'custom' && customEnabled && <Button disabled={roles.loading || permissions.loading || !!permissions.error} onClick={() => setEditor({})}>New Custom Role</Button>}</div>{type === 'default' && <p>🔒 Platform managed. Assign an available role from Members; definitions are read-only.</p>}{type === 'custom' && !customEnabled && <p>Custom-role management is unavailable for this provider. Existing assignments remain visible.</p>}<div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Role</th><th>Responsibilities</th><th>Type</th><th>Status</th><th>Action</th></tr></thead><tbody>{visibleRoles.filter(role => role.attributes.role_type === type).map(role => <tr key={role.id}><td>{role.attributes.name}</td><td>{role.attributes.description || '—'}</td><td>{type === 'default' ? 'Platform Default' : 'Provider Custom'}</td><td><OperationsStatus>{role.attributes.enabled ? 'Enabled' : 'Disabled'}</OperationsStatus></td><td><div className="platform-form-actions"><Button variant="quiet" onClick={() => setEditor({ role, view: true })}>View responsibilities & permissions</Button><Button variant="quiet" onClick={() => setMemberRole(role)}>View assigned members</Button>{type === 'custom' && customEnabled && <><Button variant="quiet" disabled={busy || roles.loading} onClick={() => setEditor({ role })}>Edit Role</Button><Button variant="quiet" disabled={busy || roles.loading} onClick={() => void toggle(role)}>{role.attributes.enabled ? 'Disable' : 'Enable'}</Button></>}</div></td></tr>)}</tbody></table></div>{!roles.loading && !visibleRoles.some(role => role.attributes.role_type === type) && <p>{type === 'default' ? 'No published, enabled roles are available for this Business Operation yet.' : 'No custom roles available.'}</p>}</section>)}{roles.cursor && <Button disabled={roles.loading} onClick={() => void roles.loadMore()}>Load more roles</Button>}{memberRole && <OperationsDialog title={`Members with ${memberRole.attributes.name}`} onClose={() => setMemberRole(null)}><ProviderMembers readOnly providerId={providerId} roleId={memberRole.id} /></OperationsDialog>}{editor && <CustomRoleEditor role={editor.role} permissions={permissions.records} providerId={providerId} readOnly={editor.view || editor.role?.attributes.role_type === 'default'} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await roles.load(); }} />}</section>;
}

function CustomRoleEditor({ role, permissions, providerId, readOnly, onClose, onSaved }: { role?: AccessRole; permissions: AccessPermission[]; providerId: string; readOnly?: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(role?.attributes.name || ''); const [description, setDescription] = useState(role?.attributes.description || '');
  const [grants, setGrants] = useState<Record<string, boolean>>(role?.attributes.permissions || {}); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const request = useRef({ payload: '', key: '' });
  if (readOnly && role) return <OperationsDialog title={role.attributes.name} onClose={onClose}><p>{role.attributes.description || 'No responsibilities recorded.'}</p><h3>Permitted actions</h3><ul>{permissions.filter(item => role.attributes.permissions[item.attributes.code] === true).map(item => <li key={item.id}>{item.attributes.module}: {item.attributes.action}</li>)}</ul>{!Object.values(role.attributes.permissions).some(Boolean) && <p>No additional permissions recorded.</p>}<Button type="button" variant="quiet" onClick={onClose}>Close</Button></OperationsDialog>;
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

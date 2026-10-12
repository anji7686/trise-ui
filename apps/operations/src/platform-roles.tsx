import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@trise/auth';
import { Button } from '@trise/ui';
import { accessData, type AccessRole, type AccessPermission, type DefaultRoleInput } from './access-data';
import { AccessMatrix } from './access-matrix';
import { OperationsDialog } from './operations-dialog';
import { OperationsStatus } from './operations-status';
import { AdminPageHeader } from './platform-admin-ui';
import { useScopedRecords } from './use-scoped-records';

export function PlatformRolesPage({ capabilities }: { capabilities: string[] }) {
  const { session } = useAuth();
  const allowed = capabilities.includes('PLATFORM_ACCESS_READ');
  const roles = useScopedRecords(`platform-roles:${session?.userId}`, accessData.platformRoles, allowed);
  const permissions = useScopedRecords(`platform-permissions:${session?.userId}`, accessData.platformPermissions, allowed);
  const [editor, setEditor] = useState<{ role?: AccessRole; view?: boolean } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);
  async function act(action: () => Promise<unknown>) {
    const current = generation.current; setBusy(true); setError('');
    try { await action(); if (current === generation.current) { await roles.load(); await permissions.load(); } }
    catch (cause) { if (current === generation.current) setError((cause as Error).message); }
    finally { if (current === generation.current) setBusy(false); }
  }
  if (!allowed) return <section role="status">Roles &amp; Permissions requires platform access authority.</section>;
  return <section className="platform-page"><AdminPageHeader breadcrumbs={[{ label: 'Platform Overview', href: 'platform/overview' }, { label: 'Access & Governance' }, { label: 'Roles & Permissions' }]} eyebrow="Platform administration / Access & Governance" title="Roles & Permissions" description="Govern default roles and provider permission delegation." action={capabilities.includes('PLATFORM_ACCESS_WRITE') && <Button disabled={roles.loading || permissions.loading} onClick={() => setEditor({})}>New Default Role</Button>} />
    {(error || roles.error || permissions.error) && <p role="alert">{error || roles.error || permissions.error}</p>}
    {roles.loading && <p role="status">Loading roles…</p>}
    <div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr>{['Role Name', 'Responsibilities', 'Business Operation applicability', 'Type', 'Status', 'Actions'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{roles.records.map(role => {
      const pending = role.attributes.reviews.find(review => review.status === 'pending');
      const approved = role.attributes.reviews.find(review => review.status === 'approved');
      return <tr key={role.id}><td>{role.attributes.name}<small> · v{role.attributes.version}</small></td><td>{role.attributes.description || '—'}</td><td>{role.attributes.applies_to_all_operations ? 'All operations' : `${role.attributes.business_operation_type_ids.length} selected operations`}</td><td>Platform default</td><td><OperationsStatus>{role.attributes.enabled ? role.attributes.status : 'Disabled'}</OperationsStatus></td><td><div className="platform-form-actions"><Button variant="quiet" onClick={() => setEditor({ role, view: true })}>View Role</Button>{capabilities.includes('PLATFORM_ACCESS_WRITE') && <Button variant="quiet" disabled={busy || roles.loading || permissions.loading} onClick={() => setEditor({ role })}>{role.attributes.status === 'draft' ? 'Edit Role Draft' : 'New Version Draft'}</Button>}{role.attributes.status === 'draft' && !pending && !approved && capabilities.includes('PLATFORM_ACCESS_WRITE') && <Button disabled={busy} onClick={() => void act(() => accessData.submitReview(role, crypto.randomUUID()))}>Submit for review</Button>}{pending && pending.submitted_by_user_id !== session?.userId && capabilities.includes('PLATFORM_ACCESS_REVIEW') && <Button disabled={busy} onClick={() => void act(() => accessData.approveReview(role, pending.id, crypto.randomUUID()))}>Approve review</Button>}{approved && capabilities.includes('PLATFORM_ACCESS_PUBLISH') && <Button disabled={busy} onClick={() => void act(() => accessData.publish(role, approved.id, crypto.randomUUID()))}>Publish Changes</Button>}{role.attributes.status === 'active' && capabilities.includes('PLATFORM_ACCESS_PUBLISH') && <Button disabled={busy || roles.loading} variant="quiet" onClick={() => void act(() => accessData.setDefaultEnabled(role, crypto.randomUUID()))}>{role.attributes.enabled ? 'Disable Role' : 'Enable Role'}</Button>}</div></td></tr>;
    })}</tbody></table></div>
    {!roles.loading && roles.records.length === 0 && <p>No default roles have been created.</p>}{roles.cursor && <Button disabled={roles.loading} onClick={() => void roles.loadMore()}>Load more roles</Button>}
    <h2>Provider permission delegation</h2><p>Protected permissions remain locked.</p><div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Module</th><th>Action</th><th>Delegation</th></tr></thead><tbody>{permissions.records.map(permission => <tr key={permission.id}><td>{permission.attributes.module}</td><td>{permission.attributes.action}</td><td>{permission.attributes.protected ? <span>🔒 Protected</span> : <Button variant="quiet" disabled={busy || !capabilities.includes('PLATFORM_ACCESS_DELEGATE')} onClick={() => void act(() => accessData.delegate(permission, crypto.randomUUID()))}>{permission.attributes.delegable ? 'Delegated — disable' : 'Not delegated — enable'}</Button>}</td></tr>)}</tbody></table></div>
    {editor && <DefaultRoleEditor role={editor.role} readOnly={editor.view} permissions={permissions.records} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await roles.load(); }} />}
  </section>;
}

function DefaultRoleEditor({ role, permissions, readOnly, onClose, onSaved }: { role?: AccessRole; permissions: AccessPermission[]; readOnly?: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(role?.attributes.name || ''); const [description, setDescription] = useState(role?.attributes.description || '');
  const [grants, setGrants] = useState(role?.attributes.permissions || {}); const [all, setAll] = useState(role?.attributes.applies_to_all_operations ?? true);
  const [ids, setIds] = useState(role?.attributes.business_operation_type_ids || []); const [operations, setOperations] = useState<Array<{ id: string; attributes: { name: string } }>>([]);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const request = useRef({ payload: '', key: '' });
  useEffect(() => { let active = true; accessData.operations().then(value => { if (active) setOperations(value.data); }).catch(cause => { if (active) setError((cause as Error).message); }); return () => { active = false; }; }, []);
  async function save() {
    if (!name.trim() || (!all && ids.length === 0)) { setError('Enter a role name and choose applicable operations.'); return; }
    setBusy(true); setError('');
    const input: DefaultRoleInput = { name: name.trim(), description, permissions: grants, applies_to_all_operations: all, business_operation_type_ids: all ? [] : ids };
    const payload = JSON.stringify(input);
    if (request.current.payload !== payload) request.current = { payload, key: crypto.randomUUID() };
    try { if (role?.attributes.status === 'draft') await accessData.updateDefault(role, input, request.current.key); else await accessData.createDefault(role ? { ...input, predecessor_id: role.id } : input, request.current.key); await onSaved(); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <OperationsDialog title={readOnly ? 'View Role' : 'Default Role Draft'} onClose={onClose} busy={busy}><form onSubmit={event => { event.preventDefault(); void save(); }}><div className="platform-form-grid"><label>Role Name<input required maxLength={200} value={name} disabled={readOnly || busy} onChange={event => setName(event.target.value)} /></label><label>Responsibilities<textarea maxLength={2000} value={description} disabled={readOnly || busy} onChange={event => setDescription(event.target.value)} /></label><label><input type="checkbox" checked={all} disabled={readOnly || busy} onChange={event => setAll(event.target.checked)} /> All Business Operations</label>{!all && operations.map(operation => <label key={operation.id}><input type="checkbox" checked={ids.includes(operation.id)} disabled={readOnly || busy} onChange={event => setIds(event.target.checked ? [...ids, operation.id] : ids.filter(id => id !== operation.id))} />{operation.attributes.name}</label>)}</div><AccessMatrix permissions={permissions} grants={grants} onChange={setGrants} readOnly={readOnly || busy} />{error && <p role="alert">{error}</p>}<div className="platform-form-actions"><Button type="button" variant="quiet" disabled={busy} onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>{!readOnly && <Button type="submit" disabled={busy}>Save Draft</Button>}</div></form></OperationsDialog>;
}

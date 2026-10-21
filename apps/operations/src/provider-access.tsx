import { AddMemberEditor, ProviderMembers, ProviderInvitations } from './provider-members';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, PageHeader } from '@trise/ui';
import { accessData, type AccessRole, type AccessPermission, type RoleTemplateAdoptionPreview } from './access-data';
import { AccessMatrix } from './access-matrix';
import { OperationsDialog } from './operations-dialog';
import { OperationsStatus } from './operations-status';
import { useScopedRecords } from './use-scoped-records';
import { useOptionalAuth } from '../../../packages/auth/src';
import { navigationForSession } from './navigation';
import { ProviderAudit } from './provider-audit';
import { ProviderActionMenu } from './operations-shared';

export function ProviderAccessPage({ providerId, capabilities: suppliedCapabilities }: { providerId: string; capabilities?: string[] }) {
  const { session } = useOptionalAuth() || { session: null };
  const capabilities = suppliedCapabilities ?? (session ? navigationForSession(session, providerId).context?.capabilities || [] : []);
  const providerName = session?.providerCapabilities.find(context => context.providerId === providerId)?.displayName || 'Selected Service Provider';
  const [tab, setTab] = useState('members');
  const [adding, setAdding] = useState(false);
  const canAssignRoles = capabilities.includes('team_access');
  const canManageInvitations = capabilities.includes('team_invitation_manage');
  const canViewAudit = capabilities.includes('audit');
  const visibleTabs = [['members', 'Members'], ['roles', 'Roles & Permissions'], ...(canManageInvitations ? [['invitations', 'Invitations']] : []), ...(canViewAudit ? [['audit', 'Audit Logs']] : [])];
  useEffect(() => { if (tab === 'invitations' && !canManageInvitations) setTab('members'); }, [tab, canManageInvitations]);
  const rolesTab = tab === 'roles' || tab === 'audit';
  return <section className="content feature-page"><PageHeader eyebrow="Settings" title={rolesTab ? 'Roles & Permissions' : 'Team & Access'} description={rolesTab ? `Manage roles used by ${providerName}. System templates are read-only; Provider roles are editable only when enabled for this workspace.` : 'Manage this Provider’s membership and authorized role capabilities.'} /><nav aria-label="Team access views" className="admin-detail-tabs">{visibleTabs.map(([key, label]) => <Button key={key} variant={tab === key ? 'primary' : 'quiet'} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>{label}</Button>)}</nav>{tab === 'roles' ? <ProviderRoles providerId={providerId} providerName={providerName} /> : tab === 'audit' ? <ProviderAudit providerId={providerId} accessOnly embedded /> : tab === 'members' ? <ProviderMembers providerId={providerId} providerName={providerName} onAddMember={canAssignRoles && canManageInvitations ? () => setAdding(true) : undefined} /> : <ProviderInvitations providerId={providerId} />}{adding && <AddMemberEditor providerId={providerId} onClose={() => setAdding(false)} onCreated={() => { setAdding(false); setTab('invitations'); }} />}</section>;
}

export function ProviderRoles({ providerId, providerName = 'Selected Service Provider' }: { providerId: string; providerName?: string }) {
  const [roleSearch, setRoleSearch] = useState('');
  const [enabledFilter, setEnabledFilter] = useState('');
  const [roleFilters, setRoleFilters] = useState({ q: '', enabled: '' });
  const [category, setCategory] = useState<'all' | 'default' | 'custom'>('all');
  const [rolePageLimit, setRolePageLimit] = useState(10);
  const [rolePage, setRolePage] = useState(1);
  const roles = useScopedRecords(`roles:${providerId}:${roleFilters.q}:${roleFilters.enabled}:${rolePageLimit}`, after => accessData.providerRoles(providerId, after, { ...roleFilters, limit: rolePageLimit }));
  const permissions = useScopedRecords(`permissions:${providerId}`, () => accessData.providerPermissions(providerId));
  const [editor, setEditor] = useState<{ role?: AccessRole; view?: boolean } | null>(null);
  const [memberRole, setMemberRole] = useState<AccessRole | null>(null);
  const [adoption, setAdoption] = useState<{ template: AccessRole; providerRole?: AccessRole } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [customEnabled, setCustomEnabled] = useState(false);
  useEffect(() => { let mounted = true; accessData.providerRoles(providerId).then(page => { if (mounted) setCustomEnabled(page.custom_role_management_enabled === true); }).catch(() => { if (mounted) setCustomEnabled(false); }); return () => { mounted = false; }; }, [providerId]);
  const active = useRef(true); useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  function applyRoleFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRolePage(1);
    setRoleFilters({ q: roleSearch.trim(), enabled: enabledFilter });
  }
  async function nextRolePage() {
    const nextStart = rolePage * rolePageLimit;
    if (nextStart >= roles.records.length && roles.cursor) await roles.loadMore();
    setRolePage(page => page + 1);
  }
  async function toggle(role: AccessRole) {
    setBusy(true); setError('');
    try { await accessData.setCustomEnabled(providerId, role, crypto.randomUUID()); if (active.current) await roles.load(); }
    catch (cause) { if (active.current) setError((cause as Error).message); } finally { if (active.current) setBusy(false); }
  }
  const latestRoles = latestProviderRoles(roles.records).filter(role => role.attributes.role_type === 'default' || customEnabled || role.attributes.enabled);
  const matchingRoles = latestRoles.filter(role => category === 'all' || role.attributes.role_type === category);
  const visibleRoles = matchingRoles.slice((rolePage - 1) * rolePageLimit, rolePage * rolePageLimit);
  const templateCount = latestRoles.filter(role => role.attributes.role_type === 'default').length;
  const providerRoleCount = latestRoles.filter(role => role.attributes.role_type === 'custom').length;
  const assignmentCountFor = (pattern: RegExp) => latestRoles.reduce((total, role) =>
    pattern.test(`${role.attributes.role_code} ${role.attributes.name}`) ? total + role.attributes.active_assignment_count : total, 0);
  return <section className="provider-roles-workspace">{(error || roles.error || permissions.error) && <p role="alert">{error || roles.error || permissions.error}</p>}
    <div className="provider-role-overview" aria-label="Role overview">
      <article className="provider-role-stat stat-blue"><span>Provider Administrator</span><strong>{assignmentCountFor(/ADMINISTRATOR|PROVIDER_ADMIN/)}</strong><small>Loaded active assignments</small></article>
      <article className="provider-role-stat stat-green"><span>Provider Reviewer</span><strong>{assignmentCountFor(/REVIEWER|PROVIDER_REVIEW/)}</strong><small>Loaded active assignments</small></article>
      <article className="provider-role-stat stat-orange"><span>Provider Operator</span><strong>{assignmentCountFor(/OPERATOR|PROVIDER_OPERATOR/)}</strong><small>Loaded active assignments</small></article>
      <article className="provider-role-stat stat-purple"><span>Read Only User</span><strong>{assignmentCountFor(/READ[_ ]ONLY|VIEWER/)}</strong><small>Loaded active assignments</small></article>
      <article className="provider-role-stat stat-slate"><span>Custom Roles</span><strong>{providerRoleCount}</strong><small>Provider-owned definitions loaded</small></article>
    </div>
    <section className="provider-role-directory" aria-label="Provider roles">
      <header className="provider-role-directory-heading"><div><h2>Role directory</h2><p>Choose a role to inspect its access or see who has it. Template roles are managed by TRISE; Provider roles belong to this workspace.</p></div>{customEnabled && <Button disabled={roles.loading || permissions.loading || !!permissions.error} onClick={() => setEditor({})}>Create Provider role</Button>}</header>
      <p className="provider-role-scope-note">These are role definitions available within the selected Provider. They are not Platform Administration team members.</p>
      {customEnabled === false && <p className="provider-role-policy-note">Creating and editing Provider roles is currently disabled for this Provider. You can still review eligible roles and their members.</p>}
      <form className="provider-role-filters" onSubmit={applyRoleFilters}>
        <label>Search roles<input aria-label="Search provider roles" value={roleSearch} maxLength={100} onChange={event => setRoleSearch(event.target.value)} placeholder="Role name or description" /></label>
        <nav className="provider-role-category-tabs" aria-label="Role type filters">{([['all', 'All roles', latestRoles.length], ['default', 'System templates', templateCount], ['custom', 'Provider roles', providerRoleCount]] as const).map(([key, label, count]) => <button type="button" key={key} aria-pressed={category === key} className={category === key ? 'is-active' : ''} onClick={() => { setRolePage(1); setCategory(key); }}><span>{label}</span><strong>{count}</strong></button>)}</nav>
        <label>Status<select aria-label="Filter roles by enabled status" value={enabledFilter} onChange={event => setEnabledFilter(event.target.value)}><option value="">All statuses</option><option value="true">Enabled</option><option value="false">Disabled</option></select></label>
        <Button type="submit" disabled={roles.loading}>Apply filters</Button>
        <Button type="button" variant="quiet" disabled={roles.loading && !roles.records.length} onClick={() => { setRoleSearch(''); setEnabledFilter(''); setRoleFilters({ q: '', enabled: '' }); setCategory('all'); setRolePage(1); }}>Reset</Button>
      </form>
      {roles.loading && <p role="status">Loading roles…</p>}
      <div className="platform-provider-table-wrap"><table className="platform-provider-table provider-role-table"><thead><tr><th>Role</th><th>Type</th><th>Users</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{visibleRoles.map(role => {
        const type = role.attributes.role_type;
        const matchingTemplate = type === 'custom' && role.attributes.template_source
          ? latestRoles.find(candidate => candidate.attributes.role_type === 'default' && candidate.attributes.role_code === role.attributes.role_code && candidate.id !== role.attributes.template_source?.role_id && candidate.attributes.version > (role.attributes.template_source?.version ?? 0))
          : undefined;
        return <tr key={role.id}><td data-label="Role"><strong>{role.attributes.name}</strong>{role.attributes.description && <small className="provider-role-description-inline">{role.attributes.description}</small>}<small className="provider-role-version">Latest version · v{role.attributes.version}</small></td><td data-label="Type">{type === 'default' ? 'System template' : 'Provider role'}</td><td data-label="Assigned people">{role.attributes.active_assignment_count}</td><td data-label="Status"><OperationsStatus>{role.attributes.enabled ? 'Enabled' : 'Disabled'}</OperationsStatus></td><td data-label="Updated">{new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(role.attributes.updated_at))}</td><td data-label="Actions"><ProviderActionMenu label={`Actions for ${role.attributes.name}`} actions={[{ id: 'permissions', label: 'View permissions', onSelect: () => setEditor({ role, view: true }) }, { id: 'members', label: 'View members', onSelect: () => setMemberRole(role) }, ...(type === 'default' && customEnabled && role.attributes.status === 'active' ? [{ id: 'adopt', label: 'Adopt as Provider role', disabled: busy || roles.loading, onSelect: () => setAdoption({ template: role }) }] : []), ...(type === 'custom' && customEnabled ? [{ id: 'edit', label: 'Edit role', disabled: busy || roles.loading, onSelect: () => setEditor({ role }) }, ...(matchingTemplate ? [{ id: 'preview-template', label: 'Preview template update', disabled: busy || roles.loading, onSelect: () => setAdoption({ template: matchingTemplate, providerRole: role }) }] : []), { id: 'toggle', label: role.attributes.enabled ? 'Disable role' : 'Enable role', disabled: busy || roles.loading, onSelect: () => void toggle(role) }] : [])]} /></td></tr>;
      })}</tbody></table></div>
      {!roles.loading && !visibleRoles.length && <p className="provider-role-empty">No roles match the selected filters.</p>}
      <div className="provider-role-pagination"><span>{visibleRoles.length} roles on page {rolePage} · {latestRoles.length} loaded from the Provider API</span><label>Rows per page<select aria-label="Provider roles per page" value={rolePageLimit} onChange={event => { setRolePage(1); setRolePageLimit(Number(event.target.value)); }}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select></label><div><Button type="button" variant="secondary" disabled={roles.loading || rolePage === 1} onClick={() => setRolePage(page => Math.max(1, page - 1))}>Previous</Button><Button type="button" variant="secondary" disabled={roles.loading || (rolePage * rolePageLimit >= roles.records.length && !roles.cursor)} onClick={() => void nextRolePage()}>Next</Button></div></div>
    </section>
    {memberRole && <OperationsDialog title={`Members with ${memberRole.attributes.name}`} onClose={() => setMemberRole(null)}><ProviderMembers readOnly providerId={providerId} providerName={providerName} roleId={memberRole.id} /></OperationsDialog>}{editor && <CustomRoleEditor role={editor.role} permissions={permissions.records} providerId={providerId} readOnly={editor.view || editor.role?.attributes.role_type === 'default'} onClose={() => setEditor(null)} onSaved={async () => { setEditor(null); await roles.load(); }} />}{adoption && <RoleTemplateAdoptionDialog providerId={providerId} template={adoption.template} providerRole={adoption.providerRole} onClose={() => setAdoption(null)} onAdopted={async () => { setAdoption(null); await roles.load(); }} />}</section>;
}

function RoleTemplateAdoptionDialog({ providerId, template, providerRole, onClose, onAdopted }: { providerId: string; template: AccessRole; providerRole?: AccessRole; onClose: () => void; onAdopted: () => Promise<void> }) {
  const [preview, setPreview] = useState<RoleTemplateAdoptionPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const idempotencyKey = useRef<string | null>(null);
  useEffect(() => {
    let current = true;
    const input = { template_role_id: template.id, ...(providerRole ? { provider_role_id: providerRole.id, expected_revision: providerRole.attributes.revision } : {}) };
    accessData.previewRoleTemplateAdoption(providerId, input).then(result => { if (current) setPreview(result.data); }).catch(cause => { if (current) setError((cause as Error).message); });
    return () => { current = false; };
  }, [providerId, template, providerRole]);
  async function adopt() {
    if (!preview?.can_adopt) return;
    setBusy(true); setError('');
    try {
      idempotencyKey.current ||= crypto.randomUUID();
      await accessData.adoptRoleTemplate(providerId, { template_role_id: template.id, expected_template_version: preview.template_version, ...(providerRole ? { provider_role_id: providerRole.id, expected_revision: providerRole.attributes.revision } : {}) }, idempotencyKey.current);
      await onAdopted();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <OperationsDialog title={providerRole ? `Review ${template.attributes.name} template update` : `Adopt ${template.attributes.name}`} onClose={onClose} busy={busy} className="role-editor-drawer">
    <p>This creates a new Provider-local role revision. Platform defaults and other Providers remain unchanged. Existing member assignments are not moved to the new role.</p>
    {!preview && !error && <p role="status">Loading permission comparison…</p>}
    {preview && <><p><strong>Platform template:</strong> {preview.template_name} · v{preview.template_version}{providerRole ? ` · Provider role revision ${providerRole.attributes.revision}` : ''}</p>
      <div className="role-adoption-diff"><section><h3>Permissions added</h3>{preview.added.length ? <ul>{preview.added.map(code => <li key={code}>{code}</li>)}</ul> : <p>None</p>}</section><section><h3>Permissions removed</h3>{preview.removed.length ? <ul>{preview.removed.map(code => <li key={code}>{code}</li>)}</ul> : <p>None</p>}</section><section><h3>Conflicts</h3>{preview.conflicts.length ? <ul>{preview.conflicts.map(code => <li key={code}>{code}</li>)}</ul> : <p>None</p>}</section></div>
      {error && <p role="alert">{error}</p>}<div className="platform-form-actions"><Button type="button" variant="quiet" disabled={busy} onClick={onClose}>Cancel</Button><Button type="button" disabled={busy || !preview.can_adopt} onClick={() => void adopt()}>{busy ? 'Applying…' : providerRole ? 'Adopt update' : 'Create Provider role'}</Button></div>
    </>}
    {error && !preview && <p role="alert">{error}</p>}
  </OperationsDialog>;
}

export function latestProviderRoles(records: AccessRole[]) {
  const latest = new Map<string, AccessRole>();
  for (const role of records) {
    const identity = `${role.attributes.role_type}:${role.attributes.role_code || role.attributes.name.trim().toLocaleLowerCase()}`;
    const current = latest.get(identity);
    if (!current || role.attributes.version > current.attributes.version ||
      (role.attributes.version === current.attributes.version && role.attributes.updated_at > current.attributes.updated_at)) latest.set(identity, role);
  }
  return [...latest.values()].sort((left, right) => left.attributes.name.localeCompare(right.attributes.name));
}

function CustomRoleEditor({ role, permissions, providerId, readOnly, onClose, onSaved }: { role?: AccessRole; permissions: AccessPermission[]; providerId: string; readOnly?: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(role?.attributes.name || ''); const [description, setDescription] = useState(role?.attributes.description || '');
  const [grants, setGrants] = useState<Record<string, boolean>>(role?.attributes.permissions || {}); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const request = useRef({ payload: '', key: '' });
  if (readOnly && role) return <OperationsDialog title={role.attributes.name} onClose={onClose} className="role-permission-detail"><p className="access-role-choice-meta">{role.attributes.role_type === 'default' ? 'Platform default' : 'Provider custom'} · v{role.attributes.version} · {Object.values(role.attributes.permissions).filter(Boolean).length} permissions</p><p className="provider-role-description" title={role.attributes.description}>{role.attributes.description || 'No responsibilities recorded.'}</p><AccessMatrix permissions={permissions} grants={role.attributes.permissions} readOnly title="Feature-level permission matrix" /><Button type="button" variant="quiet" onClick={onClose}>Close</Button></OperationsDialog>;
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
  return <OperationsDialog title={readOnly ? 'Role permissions' : role ? 'Edit Custom Role' : 'New Custom Role'} onClose={onClose} busy={busy} className="role-editor-drawer"><form onSubmit={event => { event.preventDefault(); void save(); }}><div className="platform-form-grid"><label>Role Name<input required maxLength={200} disabled={readOnly || busy} value={name} onChange={event => setName(event.target.value)} /></label><label>Responsibilities<textarea maxLength={2000} disabled={readOnly || busy} value={description} onChange={event => setDescription(event.target.value)} /></label></div><AccessMatrix permissions={permissions} grants={grants} onChange={setGrants} custom readOnly={readOnly || busy} />{error && <p role="alert">{error}</p>}<div className="platform-form-actions"><Button type="button" variant="quiet" disabled={busy} onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</Button>{!readOnly && <Button type="submit" disabled={busy}>Save</Button>}</div></form></OperationsDialog>;
}

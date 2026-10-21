import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@trise/ui';
import { accessData, type AccessMember, type AccessRole, type EffectivePermissionPreview, type TeamInvitation } from './access-data';
import { OperationsDialog } from './operations-dialog';
import { OperationsStatus } from './operations-status';
import { useScopedRecords } from './use-scoped-records';
import { formatIndiaDateTime } from './subscription-support';
import { ProviderActionMenu } from './operations-shared';

export function MemberRoleBadges({ roles, administrator = false, membershipContext }: { roles: AccessMember['attributes']['roles']; administrator?: boolean; membershipContext?: string }) {
  const legacy = membershipContext && !administrator ? ({ OPERATIONS: 'Operations access', DISPATCHER: 'Dispatcher access', AGENT: 'Agent access' } as Record<string, string>)[membershipContext] : null;
  return <span>{administrator && <span className="status">Provider Administrator · membership access </span>}{legacy && <span className="status">{legacy} · membership access </span>}{roles.length ? roles.map(role => <span className="status" key={role.id}>{role.name}{!role.enabled && ' · Disabled'} </span>) : !administrator && !legacy ? 'No assigned roles' : null}</span>;
}

export function ProviderMembers({ providerId, providerName = 'Selected Service Provider', roleId, readOnly = false, onAddMember }: { providerId: string; providerName?: string; roleId?: string; readOnly?: boolean; onAddMember?: () => void }) {
  const [memberRecords, setMemberRecords] = useState<AccessMember[]>([]);
  const [memberPage, setMemberPage] = useState<{ next?: string | null; previous?: string | null; limit?: number } | null>(null);
  const [memberLoading, setMemberLoading] = useState(true);
  const [memberError, setMemberError] = useState('');
  const [queryDraft, setQueryDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [filters, setFilters] = useState({ q: '', status: '' });
  const [limit, setLimit] = useState(10);
  const requestId = useRef(0);
  const loadPage = useCallback(async (cursor: { after?: string | null; before?: string | null } = {}) => {
    const current = ++requestId.current;
    setMemberLoading(true); setMemberError('');
    try {
      const result = await accessData.members(providerId, cursor.after, roleId, { ...filters, limit }, cursor.before);
      if (current === requestId.current) { setMemberRecords(result.data); setMemberPage(result.page || null); }
    } catch (cause) {
      if (current === requestId.current) setMemberError((cause as Error).message || 'Provider members could not be loaded.');
    } finally { if (current === requestId.current) setMemberLoading(false); }
  }, [providerId, roleId, filters, limit]);
  useEffect(() => { void loadPage(); return () => { requestId.current += 1; }; }, [loadPage]);
  const [selected, setSelected] = useState<AccessMember | null>(null);
  const [preview, setPreview] = useState<AccessMember | null>(null);
  const [transitioning, setTransitioning] = useState<{ member: AccessMember; action: 'suspend' | 'restore' } | null>(null);
  if (preview) return <section className="effective-access-workspace" aria-labelledby="effective-access-title">
    <div className="effective-access-workspace-toolbar"><Button variant="quiet" onClick={() => setPreview(null)}>Back to members</Button><span>Provider-scoped</span></div>
    <header><h2 id="effective-access-title">Effective Access &amp; Provider Isolation</h2><p>Explain why access is available for this membership. The selected provider is evaluated independently.</p></header>
    <EffectiveAccessPreview member={preview} providerId={providerId} providerName={providerName} />
  </section>;
  function applyFilters(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setFilters({ q: queryDraft.trim(), status: statusDraft }); }
  function resetFilters() { setQueryDraft(''); setStatusDraft(''); setFilters({ q: '', status: '' }); }
  const activeCount = memberRecords.filter(member => member.attributes.status === 'active').length;
  const suspendedCount = memberRecords.filter(member => member.attributes.status === 'suspended').length;
  return <div className={`provider-members-workspace${selected ? ' has-assignment-panel' : ''}`}>
    <section className="provider-members-list" aria-label="Provider users">
      <header className="provider-member-summary"><div><h2>Provider members</h2><p>Manage access in the selected Provider only. Suspended memberships remain visible for restoration.</p></div>{onAddMember && <Button onClick={onAddMember}>Add member</Button>}</header>
      <div className="provider-role-overview provider-member-overview" aria-label="Member summary"><article className="provider-role-stat stat-blue"><span>Members on this page</span><strong>{memberRecords.length}</strong><small>Current filtered results</small></article><article className="provider-role-stat stat-green"><span>Active</span><strong>{activeCount}</strong><small>On this page</small></article><article className="provider-role-stat stat-orange"><span>Suspended</span><strong>{suspendedCount}</strong><small>On this page · restorable</small></article></div>
      <form className="provider-member-filters" onSubmit={applyFilters}><label>Search members<input aria-label="Search provider members" value={queryDraft} maxLength={100} onChange={event => setQueryDraft(event.target.value)} placeholder="Name or email" /></label><label>Status<select aria-label="Filter members by status" value={statusDraft} onChange={event => setStatusDraft(event.target.value)}><option value="">All current members</option><option value="active">Active</option><option value="suspended">Suspended</option></select></label><Button type="submit" disabled={memberLoading}>Apply filters</Button><Button type="button" variant="quiet" disabled={memberLoading && !memberRecords.length} onClick={resetFilters}>Reset</Button><label className="provider-member-page-size">Rows per page<select aria-label="Members per page" value={limit} onChange={event => setLimit(Number(event.target.value))}><option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option></select></label></form>
      {memberError && <p role="alert">{memberError}</p>}
      {memberLoading && <p role="status">Loading members…</p>}
      <div className="platform-provider-table-wrap"><table className="platform-provider-table provider-members-table"><thead><tr>{['Member Name', 'Email', 'Assigned Roles', 'Status', 'Actions'].map(name => <th key={name}>{name}</th>)}</tr></thead><tbody>{memberRecords.map(member => <tr key={member.id}><td data-label="Member Name">{member.attributes.name || 'Name not recorded'}</td><td data-label="Email">{member.attributes.email || 'Email not recorded'}</td><td data-label="Assigned Roles"><MemberRoleBadges roles={member.attributes.roles} administrator={member.attributes.administrator} membershipContext={member.attributes.membership_context} /></td><td data-label="Status"><OperationsStatus>{member.attributes.status}</OperationsStatus></td><td data-label="Actions"><ProviderActionMenu label={`Actions for ${member.attributes.name || member.attributes.email || 'Provider member'}`} actions={[{ id: 'view', label: 'View access', onSelect: () => setPreview(member), disabled: memberLoading }, ...(!readOnly && member.attributes.status === 'active' ? [{ id: 'manage', label: 'Manage roles', onSelect: () => setSelected(member), disabled: memberLoading }, { id: 'suspend', label: 'Suspend access', onSelect: () => setTransitioning({ member, action: 'suspend' }), disabled: memberLoading }] : []), ...(!readOnly && member.attributes.status === 'suspended' ? [{ id: 'restore', label: 'Restore access', onSelect: () => setTransitioning({ member, action: 'restore' }), disabled: memberLoading }] : [])]} /></td></tr>)}</tbody></table></div>
      {!memberLoading && memberRecords.length === 0 && <p>No current Provider members match these filters.</p>}
      <div className="server-pagination" aria-label="Provider member pages"><span>{memberRecords.length} members shown · {memberPage?.limit || limit} per page</span><div><Button type="button" variant="secondary" disabled={!memberPage?.previous || memberLoading} onClick={() => void loadPage({ before: memberPage?.previous })}>Previous</Button><Button type="button" disabled={!memberPage?.next || memberLoading} onClick={() => void loadPage({ after: memberPage?.next })}>Next</Button></div></div>
    </section>
    {selected && <MemberRoleEditor member={selected} providerId={providerId} providerName={providerName} inline onClose={() => setSelected(null)} onSaved={async () => { setSelected(null); await loadPage(); }} />}
    {transitioning && <MemberAccessTransition member={transitioning.member} action={transitioning.action} providerId={providerId} onClose={() => setTransitioning(null)} onSaved={async () => { setTransitioning(null); await loadPage(); }} />}
  </div>;
}

function EffectiveAccessPreview({ member, providerId, providerName }: { member: AccessMember; providerId: string; providerName: string; onClose?: () => void }) {
  const [preview, setPreview] = useState<EffectivePermissionPreview | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    let current = true;
    setPreview(null); setError('');
    accessData.effectivePermissions(providerId, member.id).then(result => {
      if (current && result.data.attributes.provider_id === providerId) setPreview(result.data);
      else if (current) setError('The server returned a different provider context. Preview was discarded.');
    }).catch(cause => { if (current) setError((cause as Error).message); });
    return () => { current = false; };
  }, [member.id, providerId]);
  const filtered = preview?.attributes.permissions.filter(permission =>
    `${permission.module} ${permission.code} ${permission.action}`.toLowerCase().includes(query.trim().toLowerCase())
  ) || [];
  const grantedCount = preview?.attributes.permissions.filter(permission => permission.grant_effective).length || 0;
  return <div className="effective-access-preview">
    <p className="effective-access-intro">Final resource, lifecycle and protected-operation checks remain server-enforced.</p>
    {error && <p role="alert">{error}</p>}
    {!preview && !error && <p role="status">Loading effective grants…</p>}
    {preview && <>
      <div className="effective-access-layout">
        <aside className="effective-access-context" aria-label="Selected user and context">
          <h3>Selected user and context</h3>
          <dl>
            <div><dt>User</dt><dd><strong>{member.attributes.name || 'Provider member'}</strong><span>{member.attributes.email || 'Email not recorded'}</span></dd></div>
            <div><dt>Active provider</dt><dd><strong>{providerName}</strong><span>Provider context ID: {preview.attributes.provider_id}</span></dd></div>
            <div><dt>Membership</dt><dd><strong>{preview.attributes.membership_status}</strong><span>{preview.attributes.membership_active ? 'Active membership' : 'Inactive membership'}</span></dd></div>
            <div><dt>Access mode / revision</dt><dd><strong>{preview.attributes.access_mode}</strong><span>Revision {preview.attributes.membership_revision}</span></dd></div>
          </dl>
          <h4>Assigned roles</h4>
          {preview.attributes.role_assignments.length ? <ul className="effective-access-roles">{preview.attributes.role_assignments.map(role => <li key={role.id}><strong>{role.name}</strong><span>{role.role_type === 'default' ? 'Platform default' : 'Provider custom'} · v{role.version}</span></li>)}</ul> : <p>No active, effective and applicable roles are assigned to this membership.</p>}
          <div className="effective-access-boundary"><strong>{preview.attributes.membership_active ? grantedCount : 0} effective role grants</strong><span>Same business identity across Providers does not permit shared operational access.</span></div>
        </aside>
        <section className="effective-access-decisions" aria-label="Effective permission decisions">
          <h3>Effective permission decisions</h3>
          <p>A role grant is not a final authorization decision for a specific record or lifecycle action.</p>
          <label>Filter permissions<input aria-label="Filter effective permissions" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search feature, code or action" /></label>
          <div className="platform-provider-table-wrap access-preview-table-wrap"><table className="platform-provider-table"><thead><tr><th>Capability</th><th>Role grant</th><th>Policy check</th><th>Effective grant</th></tr></thead><tbody>{filtered.map(permission => {
            const effectiveGrant = preview.attributes.membership_active && permission.grant_effective;
            return <tr key={permission.code}><td data-label="Capability"><strong>{permission.module}: {permission.action}</strong><small>{permission.code}</small></td><td data-label="Role grant">{permission.grant_effective ? `Granted by ${permission.source_roles.map(role => role.name).join(', ')}` : 'Not granted'}</td><td data-label="Policy check">{permission.protected ? 'Protected operation' : permission.additional_policy || `${permission.resource_scope || 'Provider'} scope; resource and lifecycle checks apply`}</td><td data-label="Effective grant"><span className={`effective-grant-state${effectiveGrant ? ' is-granted' : ' is-denied'}`}>{effectiveGrant ? 'GRANTED' : 'NOT GRANTED'}</span></td></tr>;
          })}</tbody></table></div>
          {!filtered.length && <p>No permissions match that filter.</p>}
          <p className="provider-form-note">Approval, project activation, payment release, qualifications, record ownership, independent QA and provider isolation are still enforced independently by their resource APIs.</p>
        </section>
      </div>
    </>}
  </div>;
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

function MemberRoleEditor({ member, providerId, providerName, inline = false, onClose, onSaved }: { member: AccessMember; providerId: string; providerName: string; inline?: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const roles = useScopedRecords(`member-roles:${providerId}`, after => accessData.providerRoles(providerId, after));
  const [selected, setSelected] = useState(member.attributes.roles.map(role => role.id));
  const [effectiveAccess, setEffectiveAccess] = useState<EffectivePermissionPreview | null>(null);
  const [effectiveAccessError, setEffectiveAccessError] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const request = useRef({ payload: '', key: '' });
  useEffect(() => {
    let current = true;
    setEffectiveAccess(null); setEffectiveAccessError('');
    accessData.effectivePermissions(providerId, member.id).then(result => {
      if (current && result.data.attributes.provider_id === providerId) setEffectiveAccess(result.data);
      else if (current) setEffectiveAccessError('The server returned a different Provider context. Preview was discarded.');
    }).catch(cause => { if (current) setEffectiveAccessError((cause as Error).message); });
    return () => { current = false; };
  }, [member.id, providerId]);
  async function save() {
    const payload = JSON.stringify([...selected].sort()); if (request.current.payload !== payload) request.current = { payload, key: crypto.randomUUID() };
    setBusy(true); setError('');
    try { await accessData.replaceMemberRoles(providerId, member, selected, request.current.key); await onSaved(); }
    catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const available = roles.records.filter(role => role.attributes.assignable || selected.includes(role.id));
  const missing = member.attributes.roles.filter(role => selected.includes(role.id) && !roles.records.some(item => item.id === role.id));
  const form = <form onSubmit={event => { event.preventDefault(); void save(); }}>
    {member.attributes.administrator && <p>Provider administrator access is protected and remains separate from these roles.</p>}
    <h3>Provider role assignments</h3>
    {roles.loading && <p role="status">Loading available roles…</p>}
    {available.map(role => <RoleChoice key={role.id} role={role} checked={selected.includes(role.id)} busy={busy} onChange={checked => setSelected(checked ? [...selected, role.id] : selected.filter(id => id !== role.id))} />)}
    {missing.map(role => <label className="access-role-choice" key={role.id}><input type="checkbox" checked disabled={busy} onChange={() => setSelected(selected.filter(id => id !== role.id))} />{role.name} · Currently assigned; load more roles or remove</label>)}
    {roles.cursor && <Button type="button" variant="quiet" disabled={busy || roles.loading} onClick={() => void roles.loadMore()}>Load more available roles</Button>}
    {(error || roles.error) && <p role="alert">{error || roles.error}</p>}
    <div className="platform-form-actions"><Button type="button" variant="quiet" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || roles.loading || !!roles.error}>Save assignments</Button></div>
  </form>;
  if (inline) return <aside className="member-assignment-panel" role="region" aria-label="Assign roles">
    <header><div><h2>Assign roles — {member.attributes.name || 'Provider member'}</h2><p>{member.attributes.email || 'Email not recorded'}</p></div><Button type="button" variant="quiet" disabled={busy} onClick={onClose}>Close</Button></header>
    <span className="member-assignment-provider">Current Provider: {providerName}</span>
    <section className="member-assignment-access-preview" aria-label="Current effective access">
      <h3>Effective access preview</h3>
      <p>Saved roles only. Pending selections below are not active until saved; record and lifecycle policies still apply.</p>
      {effectiveAccessError && <p role="alert">{effectiveAccessError}</p>}
      {!effectiveAccess && !effectiveAccessError && <p role="status">Loading current effective access…</p>}
      {effectiveAccess && <>
        <strong>{effectiveAccess.attributes.membership_active ? effectiveAccess.attributes.permissions.filter(permission => permission.grant_effective).length : 0} effective role grants</strong>
        <div>{(['PROJECT_APPROVE', 'PROJECT_ACTIVATE'] as const).map(code => {
          const permission = effectiveAccess.attributes.permissions.find(candidate => candidate.code === code);
          return <span key={code}><b>{code === 'PROJECT_APPROVE' ? 'Project approval' : 'Project activation'}</b>{permission?.grant_effective ? 'Role grant present' : 'Not granted'}</span>;
        })}</div>
      </>}
    </section>
    {form}
  </aside>;
  return <OperationsDialog title="Manage Roles" onClose={onClose} busy={busy} className="member-assignment-drawer">{form}</OperationsDialog>;
}

function RoleChoice({ role, checked, busy, onChange }: { role: AccessRole; checked: boolean; busy: boolean; onChange: (checked: boolean) => void }) {
  const permissionCount = Object.values(role.attributes.permissions).filter(Boolean).length;
  const source = role.attributes.role_type === 'default' ? 'Platform default' : 'Provider custom';
  return <label className="access-role-choice"><input type="checkbox" checked={checked} disabled={busy || (!checked && !role.attributes.assignable)} onChange={event => onChange(event.target.checked)} /><span><strong>{role.attributes.name}</strong><small className="access-role-choice-meta">{source} · v{role.attributes.version} · {permissionCount} permission{permissionCount === 1 ? '' : 's'}</small><small className="access-role-choice-description">{role.attributes.description || 'No responsibilities recorded'}</small>{!role.attributes.assignable && <small>Unavailable for new assignments</small>}</span></label>;
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
  return <section><h2>Team invitations</h2><p>Invitations are available in the existing verified user’s signed-in account. No email is sent.</p>{(error || invitations.error) && <p role="alert">{error || invitations.error}</p>}{invitations.loading && <p role="status">Loading invitations…</p>}<div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Email</th><th>Status</th><th>Expires</th><th>Actions</th></tr></thead><tbody>{invitations.records.map(item => <tr key={item.id}><td>{item.attributes.email || 'Existing verified user'}</td><td><OperationsStatus>{item.attributes.expired && item.attributes.status === 'pending' ? 'Expired' : item.attributes.status}</OperationsStatus></td><td>{formatIndiaDateTime(item.attributes.expires_at)}</td><td>{item.attributes.status === 'pending' && !item.attributes.expired && <Button variant="quiet" disabled={busy} onClick={() => void revoke(item)}>Revoke</Button>}</td></tr>)}</tbody></table></div>{!invitations.loading && invitations.records.length === 0 && <p>No team invitations yet.</p>}{invitations.cursor && <Button disabled={invitations.loading} onClick={() => void invitations.loadMore()}>Load more invitations</Button>}<h2>Administrator enrollment</h2><p>Protected administrator invitations are issued through Platform Administration.</p>{administratorInvitations.error && <p role="alert">{administratorInvitations.error}</p>}<div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Invitation reference</th><th>Status</th><th>Expires</th></tr></thead><tbody>{administratorInvitations.records.map(item => <tr key={item.id}><td>{item.id}</td><td>{item.attributes.expired && item.attributes.status === 'PENDING' ? 'Expired' : item.attributes.status}</td><td>{formatIndiaDateTime(item.attributes.expires_at)}</td></tr>)}</tbody></table></div>{administratorInvitations.cursor && <Button disabled={administratorInvitations.loading} onClick={() => void administratorInvitations.loadMore()}>Load more administrator invitations</Button>}</section>;
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
  return <OperationsDialog title="Add Member" onClose={onClose} busy={busy}><form onSubmit={event => { event.preventDefault(); void create(); }}><p>Invite an existing verified TRISE user to this Provider Account. They accept from Team invitations in their signed-in account.</p><label>Email Address<input type="email" required maxLength={320} value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label><fieldset><legend>Roles</legend>{roles.loading && <p role="status">Loading available roles…</p>}{roles.records.filter(role => role.attributes.assignable).map(role => <RoleChoice key={role.id} role={role} checked={selected.includes(role.id)} busy={busy} onChange={checked => setSelected(checked ? [...selected, role.id] : selected.filter(id => id !== role.id))} />)}{!roles.loading && !roles.error && !roles.records.some(role => role.attributes.assignable) && <p>No assignable roles are available yet. Platform Administration must publish an eligible role first.</p>}{roles.cursor && <Button type="button" variant="quiet" disabled={roles.loading || busy} onClick={() => void roles.loadMore()}>Load more roles</Button>}</fieldset>{(error || roles.error) && <p role="alert">{error || roles.error}</p>}<div className="platform-form-actions"><Button type="button" variant="quiet" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || roles.loading || !!roles.error || !selected.length}>Create Invitation</Button></div></form></OperationsDialog>;
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

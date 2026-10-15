import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@trise/ui';
import { operationsData, type PlatformProviderUserAttributes, type Resource } from './data';

export type ProviderAdminInviteRecipient = { user_id: string; full_name: string; email: string; mobile: string; provider_name?: string; business_name?: string };
type Props = { providerId: string; businessId?: string; selectedUserId?: string; onSelect: (recipient: ProviderAdminInviteRecipient) => void; onCreateUser: () => void };

const normalize = (row: Resource<PlatformProviderUserAttributes>): ProviderAdminInviteRecipient => ({ user_id: row.attributes.user_id, full_name: row.attributes.name?.trim() || 'Unnamed user', email: row.attributes.email?.trim() || '', mobile: row.attributes.mobile?.trim() || '', provider_name: row.attributes.provider_name || undefined, business_name: row.attributes.business_name || undefined });

export function ProviderAdminInviteRecipientPicker({ providerId, businessId, selectedUserId, onSelect, onCreateUser }: Props) {
  const [scope, setScope] = useState<'provider' | 'business'>('provider');
  const [query, setQuery] = useState(''); const [appliedQuery, setAppliedQuery] = useState('');
  const [rows, setRows] = useState<ProviderAdminInviteRecipient[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  useEffect(() => { let cancelled = false; setLoading(true); setError(''); void operationsData.platformProviderUsers({ ...(scope === 'provider' ? { providerId } : { businessId }), q: appliedQuery || undefined, status: 'active' }).then((response) => { if (!cancelled) setRows(response.data.map(normalize).filter((row) => row.email)); }).catch((cause) => { if (!cancelled) setError((cause as { message?: string })?.message || 'Verified users could not be loaded.'); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, [appliedQuery, businessId, providerId, scope]);
  function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setAppliedQuery(query.trim()); }
  return <section className="platform-invite-picker" aria-label="Select an existing verified user">
    <div className="platform-invite-picker-header"><div><strong>Choose an existing verified user</strong><p className="platform-muted">Select a user already known to TRISE. The invitation will be addressed to that identity.</p></div><Button type="button" variant="quiet" onClick={onCreateUser}>Create or verify a user first</Button></div>
    <div className="platform-invite-picker-tabs" role="tablist" aria-label="User scope"><button type="button" role="tab" aria-selected={scope === 'provider'} className={scope === 'provider' ? 'active' : ''} onClick={() => { setScope('provider'); setQuery(''); setAppliedQuery(''); }}>Provider users</button><button type="button" role="tab" aria-selected={scope === 'business'} className={scope === 'business' ? 'active' : ''} disabled={!businessId} onClick={() => { setScope('business'); setQuery(''); setAppliedQuery(''); }}>Business users</button></div>
    <form className="platform-invite-picker-search" onSubmit={search}><label>Filter by name, email or mobile<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Start typing to filter users" /></label><Button type="submit" variant="secondary" disabled={loading}>Search</Button></form>
    {error && <p className="platform-field-error" role="alert">{error}</p>}{loading ? <p className="platform-muted">Loading active verified users…</p> : rows.length ? <div className="platform-invite-recipient-list" role="listbox" aria-label={`${scope === 'provider' ? 'Provider' : 'Business'} users`}>{rows.map((row) => <button type="button" role="option" aria-selected={selectedUserId === row.user_id} className={`platform-invite-recipient ${selectedUserId === row.user_id ? 'selected' : ''}`} key={row.user_id} onClick={() => onSelect(row)}><span><strong>{row.full_name}</strong><small>{row.email}{row.mobile ? ` · ${row.mobile}` : ''}</small></span><span className="platform-invite-recipient-context">{scope === 'business' ? row.provider_name || 'Business user' : row.business_name || 'Provider user'}</span></button>)}</div> : <p className="platform-muted">No active verified users match this filter.</p>}
    <p className="platform-form-note">Only users returned by the authorized server directory can be selected. Suspended, revoked or unverified identities cannot be invited from this form.</p>
  </section>;
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Status } from '@trise/ui';
import { customerData, type AssetAttributes, type Collection, type Link, type LocationAttributes, type MembershipInvitationAttributes, type NotificationPreferenceOption, type ProviderAttributes, type ProviderSupportContact, type Resource, type ResourceMembershipAttributes, type TimelineEntryAttributes } from './data';
import { classifyCustomerState, CustomerStatePanel } from './customer-state';
import { notificationPreferenceChannel, notificationPreferenceTitle } from './notification-preferences';
import { customerPlaceProviderSummary, mergeCustomerPlaces, placeProvidersNeedingNextPage, type CustomerPlace } from './customer-places';
import { customerReadableName } from './coverage-list';
import { customerVisibleAddressLines } from './customer-display';

type T = (key: string) => string;
type Provider = Resource<ProviderAttributes>;
type Scoped<TValue> = { providerId: string; providerName: string; resource: Resource<TValue> };
export const customerSidebarDestinations = [
  ['home', '/', 'Overview', 'home'],
  ['assets', '/assets', 'My assets', 'assets'],
  ['places', '/places', 'My places', 'places'],
  ['bookings', '/bookings', 'Service & bookings', 'bookings'],
  ['projects', '/projects', 'Projects', 'projects'],
  ['quotations', '/quotations', 'Approvals', 'quotations'],
  ['coverage', '/coverage', 'AMC & warranty', 'coverage'],
  ['documents', '/documents', 'Documents', 'documents'],
  ['timeline', '/timeline', 'Service history', 'timeline'],
] as const;
const page = (title: string, description: string, content: ReactNode, pageClass = '') => <section className={`content customer-feature-page ${pageClass}`.trim()}><header className="customer-feature-heading"><div><h1>{title}</h1><p>{description}</p></div></header>{content}</section>;
const errorMessage = (error: unknown) => (error as { message?: string })?.message || 'We could not load this information. Try again.';
export const customerPlaceDisplayAddress = (location: LocationAttributes) => {
  const lines = location.address_lines || [];
  const customerFacingLines = customerVisibleAddressLines(lines);
  if (lines.length) return customerFacingLines.slice(0, 2).join(', ');
  const references = location.address_references || {};
  return ['locality', 'post_office', 'city', 'district', 'state', 'pin_code', 'country'].map(key => references[key]).filter(Boolean).join(', ');
};
const displayAddress = customerPlaceDisplayAddress;
export const customerPlaceTypeLabel = (classification?: string | null) => classification
  ? classification.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
  : 'Place';
export const customerPlaceStatusLabel = (status?: string | null) => status
  ? status.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
  : 'Active';
export function customerPlaceDisplayName(name?: string | null): string {
  const readable = name?.trim() ? customerReadableName(name) : '';
  if (/^synthetic\b/i.test(readable)) return 'Service location';
  const customerName = readable.replace(/\s*[·—-]\s*building test$/i, '').trim();
  return customerName || 'Service location';
}

export function CustomerPlacesPage({ providers, onOpenPlace, t }: { providers: Provider[] | null; onOpenPlace: (id: string) => void; t: T }) {
  const [places, setPlaces] = useState<CustomerPlace[] | null>(null); const [nextByProvider, setNextByProvider] = useState<Record<string, string | null>>({}); const [loadedByProvider, setLoadedByProvider] = useState<Record<string, number>>({}); const [error, setError] = useState(''); const [search, setSearch] = useState(''); const [query, setQuery] = useState(''); const [classification, setClassification] = useState(''); const [visibleCount, setVisibleCount] = useState(15); const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setQuery(search.trim()), 300); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => { let active = true; setPlaces(null); setNextByProvider({}); setLoadedByProvider({}); setVisibleCount(15); setError(''); if (!providers) return () => { active = false; }; Promise.all(providers.map(async provider => ({ providerId: provider.id, providerName: provider.attributes.display_name || 'Service provider', result: await customerData.locations(provider.id, { limit: 15 }, { query, classification }) }))).then(results => { if (!active) return; const cursors: Record<string, string | null> = {}; const loaded: Record<string, number> = {}; for (const result of results) { cursors[result.providerId] = result.result.page?.next || null; loaded[result.providerId] = result.result.data.length; } setPlaces(mergeCustomerPlaces(results.map(result => ({ providerId: result.providerId, providerName: result.providerName, data: result.result.data })))); setNextByProvider(cursors); setLoadedByProvider(loaded); }).catch(cause => { if (active) setError(errorMessage(cause)); }); return () => { active = false; }; }, [providers?.map(provider => provider.id).join('|'), query, classification]);
  async function loadMore() { if (!providers || !places || loadingMore) return; const pendingIds = placeProvidersNeedingNextPage(providers.map(provider => provider.id), loadedByProvider, nextByProvider, visibleCount); if (!pendingIds.length) { if (places.length > visibleCount) setVisibleCount(current => current + 15); return; } setLoadingMore(true); setError(''); try { const pending = providers.filter(provider => pendingIds.includes(provider.id)); const results = await Promise.all(pending.map(async provider => ({ providerId: provider.id, providerName: provider.attributes.display_name || 'Service provider', result: await customerData.locations(provider.id, { limit: 15, after: nextByProvider[provider.id] || undefined }, { query, classification }) }))); const cursors = { ...nextByProvider }; const loaded = { ...loadedByProvider }; const newPages = results.map(result => { cursors[result.providerId] = result.result.page?.next || null; loaded[result.providerId] = (loaded[result.providerId] || 0) + result.result.data.length; return { providerId: result.providerId, providerName: result.providerName, data: result.result.data }; }); setPlaces(mergeCustomerPlaces([...providers.map(provider => ({ providerId: provider.id, providerName: provider.attributes.display_name || 'Service provider', data: places.filter(place => place.providerId === provider.id).map(place => place.resource) })), ...newPages])); setNextByProvider(cursors); setLoadedByProvider(loaded); setVisibleCount(current => current + 15); } catch (cause) { setError(errorMessage(cause)); } finally { setLoadingMore(false); } }
  if (error && !places) return page('Your places', 'The locations connected to your service relationships.', <DataState message={error} />);
  if (!places) return page('Your places', 'The locations connected to your service relationships.', <DataState message={t('loading')} />);
  const hasMore = places.length > visibleCount || placeProvidersNeedingNextPage(providers?.map(provider => provider.id) || [], loadedByProvider, nextByProvider, visibleCount).length > 0;
  return page('Your places', 'The spaces, assets and people connected to your care.', <><div className="customer-place-filters"><label><span>Search places</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, address or location code" /></label><label><span>Place type</span><select value={classification} onChange={event => setClassification(event.target.value)}><option value="">All places</option><option value="COMMUNITY">Community</option><option value="BUILDING">Building</option><option value="SITE">Site</option><option value="REGISTERED_OFFICE">Office</option></select></label></div>{places.length ? <div className="customer-place-grid">{places.slice(0, visibleCount).map(({ providerId, providerNames, resource }) => <button className="customer-place-card" key={`${providerId}:${resource.id}`} onClick={() => onOpenPlace(resource.id)}><span className="customer-place-card-top"><span className="customer-place-icon" aria-hidden="true">⌂</span><span className="customer-place-access">Authorized location</span></span><strong className="customer-place-name">{customerPlaceDisplayName(resource.attributes.name)}</strong><span className="customer-place-description">{customerPlaceTypeLabel(resource.attributes.classification)}{displayAddress(resource.attributes) ? ` · ${displayAddress(resource.attributes)}` : ''}</span><span className="customer-place-card-footer"><span>{resource.attributes.service_location_code ? `${resource.attributes.service_location_code} · ` : ''}{customerPlaceProviderSummary(providerNames)}</span><span aria-hidden="true">›</span></span></button>)}</div> : <DataState message="No places match your search. Clear the filters or try another name or location code." />}{error && <p className="customer-feature-error" role="alert">{error}</p>}{hasMore && <div className="customer-place-pagination"><span>Showing {Math.min(visibleCount, places.length)} places</span><Button disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Loading…' : 'Load more'}</Button></div>}</>);
}

export function CustomerPlaceDetailPage({ id, providers, onBack, onOpenMembers, onOpenAssets, onOpenAsset, t }: { id: string; providers: Provider[] | null; onBack: () => void; onOpenMembers: () => void; onOpenAssets: (locationId: string, locationName: string) => void; onOpenAsset: (providerId: string, id: string) => void; t: T }) {
  const [place, setPlace] = useState<Scoped<LocationAttributes> | null>(null); const [assets, setAssets] = useState<Scoped<AssetAttributes>[] | null>(null); const [assetError, setAssetError] = useState(''); const [error, setError] = useState('');
  useEffect(() => { let active = true; setPlace(null); setError(''); if (!providers) return () => { active = false; }; (async () => { for (const provider of providers) { try { const resource = await customerData.location(provider.id, id); if (active) setPlace({ providerId: provider.id, providerName: provider.attributes.display_name || 'Service provider', resource }); return; } catch { /* Continue only across the signed-in customer’s authorized relationships. */ } } if (active) setError('This place is not available in your customer account.'); })(); return () => { active = false; }; }, [id, providers?.map(provider => provider.id).join('|')]);
  useEffect(() => { let active = true; setAssets(null); setAssetError(''); if (!place) return () => { active = false; }; const relation = place.resource.relationships.service_location; const serviceLocation = relation && !Array.isArray(relation) ? relation : undefined; if (!serviceLocation) { setAssets([]); return () => { active = false; }; } customerData.assets(place.providerId, { limit: 15 }, { locationId: serviceLocation.id }).then(result => { if (active) setAssets(result.data.map(resource => ({ providerId: place.providerId, providerName: place.providerName, resource }))); }).catch(cause => { if (active) setAssetError(errorMessage(cause)); }); return () => { active = false; }; }, [place]);
  if (error) return page('Place details', 'Authorized place information.', <><button type="button" className="customer-place-back" onClick={onBack}>‹ My places</button><DataState message={error} /></>, 'customer-place-detail-page');
  if (!place) return page('Place details', 'Authorized place information.', <><button type="button" className="customer-place-back" onClick={onBack}>‹ My places</button><DataState message={t('loading')} /></>, 'customer-place-detail-page');
  const { resource, providerName } = place;
  return page(customerPlaceDisplayName(resource.attributes.name), 'The service location connected to this customer relationship.', <><button type="button" className="customer-place-back" onClick={onBack}>‹ My places</button><div className="customer-feature-toolbar"><Button onClick={onOpenMembers}>People & permissions</Button><Button onClick={() => onOpenAssets(id, customerPlaceDisplayName(resource.attributes.name))}>View all assets</Button></div><section className="customer-feature-panel"><div className="customer-feature-panel-heading"><div><h2>Place information</h2><p>Only details authorized for your customer account are shown.</p></div><Status>{customerPlaceStatusLabel(resource.attributes.service_location_status)}</Status></div><dl className="customer-feature-details">{[['Place type', customerPlaceTypeLabel(resource.attributes.classification)], ['Location code', resource.attributes.service_location_code || 'Not provided'], ['Address', displayAddress(resource.attributes) || 'Address not provided'], ['Service provider', providerName], ['Time zone', resource.attributes.time_zone || 'Not provided']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section><section className="customer-feature-panel"><div className="customer-feature-panel-heading"><div><h2>Assets at this place</h2><p>Assets the service API has linked to this location.</p></div></div>{assetError && <p className="customer-feature-error" role="alert">{assetError}</p>}{!assets ? <DataState message={t('loading')} /> : assets.length ? <div className="customer-place-asset-list">{assets.map(item => <button key={`${item.providerId}:${item.resource.id}`} onClick={() => onOpenAsset(item.providerId, item.resource.id)}><span><strong>{customerReadableName(item.resource.attributes.name)}</strong><small>{item.resource.attributes.service_location_code || item.resource.attributes.status}</small></span><span aria-hidden="true">›</span></button>)}</div> : <DataState message="No assets are linked to this place." />}</section><section className="customer-feature-panel"><div className="customer-feature-panel-heading"><div><h2>People & permissions</h2><p>Place membership and commercial approval are separate permissions.</p></div></div><Button onClick={onOpenMembers}>Review access</Button></section></>, 'customer-place-detail-page');
}

export function CustomerMembershipsPage({ providers, t }: { providers: Provider[] | null; t: T }) {
  const [memberships, setMemberships] = useState<Scoped<ResourceMembershipAttributes>[] | null>(null); const [invitations, setInvitations] = useState<Scoped<MembershipInvitationAttributes>[] | null>(null); const [locations, setLocations] = useState<Record<string, string>>({}); const [error, setError] = useState(''); const [accepting, setAccepting] = useState(''); const [refresh, setRefresh] = useState(0);
  const providerKey = providers?.map(provider => provider.id).join('|') ?? 'loading';
  useEffect(() => { let active = true; setMemberships(null); setInvitations(null); setError(''); if (!providers) return () => { active = false; }; Promise.all(providers.map(async provider => { const [members, invites] = await Promise.all([customerData.resourceMemberships(provider.id, { limit: 100 }), customerData.membershipInvitations(provider.id, { limit: 100 })]); return { providerId: provider.id, providerName: provider.attributes.display_name || 'Service provider', members, invites }; })).then(async results => { if (!active) return; const membershipRows = results.flatMap(result => result.members.data.map(resource => ({ providerId: result.providerId, providerName: result.providerName, resource }))); const invitationRows = results.flatMap(result => result.invites.data.map(resource => ({ providerId: result.providerId, providerName: result.providerName, resource }))); setMemberships(membershipRows); setInvitations(invitationRows); const locationIds = [...new Set([...membershipRows.map(row => row.resource.relationships.service_location), ...invitationRows.map(row => row.resource.relationships.service_location)].flatMap(link => link && !Array.isArray(link) ? [link.id] : []))]; const names = await Promise.all(locationIds.map(async id => { const owner = results.find(result => membershipRows.some(row => row.providerId === result.providerId && row.resource.relationships.service_location && !Array.isArray(row.resource.relationships.service_location) && row.resource.relationships.service_location.id === id) || invitationRows.some(row => row.providerId === result.providerId && row.resource.relationships.service_location && !Array.isArray(row.resource.relationships.service_location) && row.resource.relationships.service_location.id === id)); if (!owner) return [id, 'Authorized place'] as const; try { const resource = await customerData.serviceLocation(owner.providerId, id); return [id, customerPlaceDisplayName(resource.attributes.display_name || resource.attributes.service_location_code || 'Authorized place')] as const; } catch { return [id, 'Authorized place'] as const; } })); if (active) setLocations(Object.fromEntries(names)); }).catch(cause => { if (active) setError(errorMessage(cause)); }); return () => { active = false; }; }, [providerKey, refresh]);
  async function accept(item: Scoped<MembershipInvitationAttributes>) { setAccepting(item.resource.id); setError(''); try { await customerData.acceptMembershipInvitation(item.providerId, item.resource.id); setRefresh(value => value + 1); } catch (cause) { setError(errorMessage(cause)); } finally { setAccepting(''); } }
  if (error && !memberships) return page('Family & sharing', 'Review access to your places and assets.', <DataState message={error} />);
  if (!memberships || !invitations) return page('Family & sharing', 'Review access to your places and assets.', <DataState message={t('loading')} />);
  const active = memberships.filter(item => item.resource.attributes.status === 'ACTIVE'); const pending = invitations.filter(item => item.resource.attributes.status === 'PENDING');
  return page('Family & sharing', 'See who can access your places and what each person can do.', <><div className="customer-feature-notice">Access is limited to authorized places. Only the invitation recipient can accept an invitation.</div>{error && <p className="customer-feature-error" role="alert">{error}</p>}{pending.length > 0 && <section className="customer-feature-panel"><div className="customer-feature-panel-heading"><div><h2>Invitations</h2><p>Review the place and access before accepting.</p></div></div><div className="customer-place-asset-list">{pending.map(item => { const place = item.resource.relationships.service_location; const placeId = place && !Array.isArray(place) ? place.id : ''; return <article className="customer-member-invitation" key={`${item.providerId}:${item.resource.id}`}><div><strong>{item.resource.attributes.role.replaceAll('_', ' ')}</strong><small>{locations[placeId] || 'Authorized place'} · {item.providerName}</small><small>{(item.resource.attributes.capabilities || []).map(value => value.replaceAll('_', ' ').toLowerCase()).join(' · ')}</small><small>Expires {new Date(item.resource.attributes.expires_at).toLocaleDateString('en-IN')}</small></div>{item.resource.attributes.can_accept && <Button disabled={accepting === item.resource.id} onClick={() => void accept(item)}>{accepting === item.resource.id ? 'Accepting…' : 'Accept'}</Button>}</article>; })}</div></section>}{active.length ? <div className="customer-feature-grid">{active.map(({ providerId, providerName, resource }) => { const place = resource.relationships.service_location; const placeId = place && !Array.isArray(place) ? place.id : ''; return <article className="customer-feature-panel customer-member-card" key={`${providerId}:${resource.id}`}><div className="customer-feature-panel-heading"><div><h2>{resource.attributes.member_display_name || resource.attributes.role?.replaceAll('_', ' ') || 'Place member'}</h2><p>{resource.attributes.role?.replaceAll('_', ' ') || 'Member'} · {locations[placeId] || 'Authorized place'}</p></div><Status>Active</Status></div><dl className="customer-feature-details"><div><dt>Authorized service provider</dt><dd>{providerName}</dd></div><div><dt>Access granted</dt><dd>{resource.attributes.effective_from ? new Date(resource.attributes.effective_from).toLocaleDateString('en-IN') : 'Date not provided'}</dd></div><div><dt>Access scope</dt><dd>{resource.attributes.inheritance_mode === 'DESCENDANTS' ? 'This place and permitted child places' : 'This place only'}</dd></div></dl><div className="customer-permission-chips">{(resource.attributes.capabilities || []).map(capability => <span key={capability}>{capability.replaceAll('_', ' ').toLowerCase()}</span>)}</div></article>; })}</div> : <DataState message="No active place memberships were found for your account." />}<section className="customer-feature-panel customer-member-share-note"><h2>Share access safely</h2><p>Place managers can invite an identified account and choose its role and permissions. Email invitations are not available until recipient verification and delivery are connected.</p></section></>);
}

export function CustomerNotificationPreferencesPage({ providers, t, goTo }: { providers: Provider[] | null; t: T; goTo: (path: string) => void }) {
  type PreferenceRow = { providerId: string; providerName: string; option: NotificationPreferenceOption };
  const [preferences, setPreferences] = useState<PreferenceRow[] | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [idempotencyKeys, setIdempotencyKeys] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const providerKey = providers?.map(provider => provider.id).join('|') ?? 'loading';
  const keyFor = (item: PreferenceRow) => `${item.providerId}:${item.option.category}:${item.option.channel}`;
  useEffect(() => {
    let active = true;
    setPreferences(null);
    setDraft({});
    setIdempotencyKeys({});
    setError('');
    if (!providers) return () => { active = false; };
    Promise.all(providers.map(async provider => ({
      providerId: provider.id,
      providerName: provider.attributes.display_name || 'Service provider',
      result: await customerData.notificationPreferenceOptions(provider.id),
    }))).then(results => {
      if (!active) return;
      const rows = results.flatMap(result => result.result.data.map(option => ({ providerId: result.providerId, providerName: result.providerName, option })));
      setPreferences(rows);
      setDraft(Object.fromEntries(rows.map(item => [keyFor(item), item.option.enabled])));
    }).catch(cause => { if (active) setError(errorMessage(cause)); });
    return () => { active = false; };
  }, [providerKey]);

  async function save() {
    if (!preferences || saving) return;
    const changed = preferences.filter(item => draft[keyFor(item)] !== item.option.enabled);
    if (!changed.length) return;
    const commandKeys = Object.fromEntries(changed.map(item => {
      const key = keyFor(item);
      return [key, idempotencyKeys[key] || `customer-preference-${crypto.randomUUID()}`];
    }));
    setIdempotencyKeys(current => ({ ...current, ...commandKeys }));
    setSaving(true);
    setError('');
    try {
      for (const item of changed) {
        const result = await customerData.setNotificationPreference(item.providerId, {
          category: item.option.category,
          channel: item.option.channel,
          enabled: draft[keyFor(item)],
          expected_revision: item.option.revision,
        }, commandKeys[keyFor(item)]);
        setPreferences(current => current?.map(entry => keyFor(entry) === keyFor(item) ? {
          ...entry,
          option: { ...entry.option, enabled: result.attributes.enabled, preference_id: result.id, revision: result.attributes.revision },
        } : entry) ?? null);
        setIdempotencyKeys(current => { const next = { ...current }; delete next[keyFor(item)]; return next; });
      }
    } catch (cause) {
      setError(`${errorMessage(cause)} Any earlier changes were saved; review the toggles before trying again.`);
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = preferences?.some(item => draft[keyFor(item)] !== item.option.enabled) ?? false;
  const description = 'Choose how you receive permitted service updates.';
  if (error && !preferences) return page('Updates, your way.', description, <DataState message={error} />);
  if (!preferences) return page('Updates, your way.', description, <DataState message={t('loading')} />);
  return page('Updates, your way.', description, <>
    <button type="button" className="text-button customer-preference-back" onClick={() => goTo('/alerts')}>← Notifications</button>
    <form className="customer-feature-panel customer-notification-preferences-form" onSubmit={event => { event.preventDefault(); void save(); }}>
      {preferences.length ? <div className="customer-preference-list">{preferences.map(item => {
        const key = keyFor(item);
        return <label className="customer-preference-row" key={key}>
          <span><strong>{notificationPreferenceTitle(item.option.category)}</strong><small>{notificationPreferenceChannel(item.option.channel)} · {item.providerName}</small></span>
          <input type="checkbox" role="switch" checked={draft[key] ?? item.option.enabled} disabled={saving} onChange={event => setDraft(current => ({ ...current, [key]: event.target.checked }))} aria-label={`${notificationPreferenceTitle(item.option.category)} via ${notificationPreferenceChannel(item.option.channel)}`} />
        </label>;
      })}</div> : <DataState message="No optional notification channels are enabled for your service relationships." />}
      <div className="customer-feature-notice">Required safety and account notices follow the applicable notification policy and cannot be disabled here.</div>
      {error && <p className="customer-feature-error" role="alert">{error}</p>}
      <div className="customer-preference-save-row"><span aria-live="polite">{saving ? 'Saving preferences…' : hasChanges ? 'Unsaved changes' : 'All changes saved'}</span><Button disabled={!hasChanges || saving || preferences.length === 0} type="submit">{saving ? 'Saving…' : 'Save preferences'}</Button></div>
    </form>
    <p className="customer-feature-footnote">These settings record your preference. They do not replace legal consent or service-provider notification policy.</p>
  </>);
}

export function timelineTarget(source: Link | Link[] | null | undefined, asset: Link | Link[] | null | undefined): { path: string; label: string } | null {
  const sourceLink = Array.isArray(source) ? source[0] : source;
  if (sourceLink?.id && sourceLink.type === 'service-requests') return { path: `/request/${encodeURIComponent(sourceLink.id)}`, label: 'View request' };
  if (sourceLink?.id && sourceLink.type === 'service-jobs') return { path: `/service/${encodeURIComponent(sourceLink.id)}`, label: 'View service' };
  if (sourceLink?.id && sourceLink.type === 'service-bookings') return { path: `/booking/${encodeURIComponent(sourceLink.id)}`, label: 'View appointment' };
  if (sourceLink?.id && sourceLink.type === 'service-reports') return { path: `/documents/source/${encodeURIComponent(sourceLink.id)}`, label: 'View shared report' };
  if (sourceLink?.id && sourceLink.type === 'quotations') return { path: `/quotation/${encodeURIComponent(sourceLink.id)}`, label: 'View quotation' };
  if (sourceLink?.id && sourceLink.type === 'service-cases') return { path: `/projects/${encodeURIComponent(sourceLink.id)}`, label: 'View project' };
  if (sourceLink?.id && sourceLink.type === 'maintenance-contracts') return { path: `/coverage/contract/${encodeURIComponent(sourceLink.id)}`, label: 'View agreement' };
  if (sourceLink?.id && sourceLink.type === 'warranties') return { path: `/coverage/warranty/${encodeURIComponent(sourceLink.id)}`, label: 'View warranty' };
  if (sourceLink?.id && sourceLink.type === 'documents') return { path: `/documents/${encodeURIComponent(sourceLink.id)}`, label: 'View shared document' };
  if (sourceLink?.id && sourceLink.type === 'assets') return { path: `/asset/${encodeURIComponent(sourceLink.id)}`, label: 'View asset' };
  const assetLink = Array.isArray(asset) ? asset[0] : asset;
  if (assetLink?.id && assetLink.type === 'assets') return { path: `/asset/${encodeURIComponent(assetLink.id)}`, label: 'View asset' };
  return null;
}

const timelineTitles: Record<string, string> = {
  SERVICE_REQUEST_CREATED: 'Service request submitted',
  SERVICE_REQUEST_UPDATED: 'Service request updated',
  SERVICE_REQUEST_TRANSITIONED: 'Service request status changed',
  SERVICE_BOOKING_CREATED: 'Appointment requested',
  SERVICE_BOOKING_UPDATED: 'Appointment updated',
  SERVICE_JOB_CREATED: 'Service visit created',
  SERVICE_JOB_ASSIGNED: 'Service team assigned',
  SERVICE_JOB_ARRIVED: 'Service team arrived',
  SERVICE_JOB_WORK_STARTED: 'Service work started',
  SERVICE_JOB_TRANSITIONED: 'Service status updated',
  SERVICE_REPORT_CREATED: 'Service report prepared',
  SERVICE_REPORT_SUBMITTED: 'Service report submitted',
};

export function timelinePresentation(eventName: string, source?: Link | Link[] | null): { title: string; scope: string; scopeLabel: string } {
  const sourceLink = Array.isArray(source) ? source[0] : source;
  const event = eventName.toUpperCase();
  const sourceType = sourceLink?.type || '';
  const scope = sourceType.includes('quotation') || event.includes('QUOTATION') ? 'quotation'
    : sourceType.includes('maintenance-contract') || sourceType.includes('warranty') || event.includes('COVERAGE') || event.includes('WARRANTY') ? 'coverage'
      : sourceType.includes('project') || sourceType.includes('service-cases') || event.includes('PROJECT') || event.includes('HANDOVER') ? 'project'
        : sourceType.includes('document') || sourceType.includes('service-reports') || event.includes('DOCUMENT') || event.includes('REPORT') ? 'document'
          : sourceType.includes('service-requests') || event.includes('REQUEST') ? 'request' : 'service';
  const scopeLabel = ({ quotation: 'Quotation', coverage: 'Coverage', project: 'Project', document: 'Document', request: 'Service request', service: 'Service' } as const)[scope];
  const fallback = eventName.replaceAll('.', ' ').replaceAll('_', ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
  return { title: timelineTitles[event] || fallback, scope, scopeLabel };
}

export function CustomerTimelinePage({ providers, t, onNavigate }: { providers: Provider[] | null; t: T; onNavigate: (providerId: string, path: string) => void }) {
  const [entries, setEntries] = useState<Scoped<TimelineEntryAttributes>[] | null>(null);
  const [error, setError] = useState('');
  const [cursors, setCursors] = useState<Record<string, string | null>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [retryRevision, setRetryRevision] = useState(0);
  const providerKey = providers?.map(provider => provider.id).join('|') ?? 'loading';
  const retry = () => setRetryRevision(value => value + 1);
  useEffect(() => {
    let active = true;
    setEntries(null); setError(''); setCursors({});
    if (!providers) return () => { active = false; };
    if (providers.length === 0) { setEntries([]); return () => { active = false; }; }
    Promise.all(providers.map(async provider => {
      try {
        return { providerId: provider.id, providerName: provider.attributes.display_name || 'Service provider', result: await customerData.timeline(provider.id, { limit: 15 }) };
      } catch (failure) {
        return { providerId: provider.id, providerName: provider.attributes.display_name || 'Service provider', failure };
      }
    })).then(results => {
      if (!active) return;
      const pages = results.filter((result): result is { providerId: string; providerName: string; result: Collection<TimelineEntryAttributes> } => 'result' in result);
      const failures = results.filter((result): result is { providerId: string; providerName: string; failure: unknown } => 'failure' in result);
      if (failures.length === results.length) {
        setError(errorMessage(failures[0]?.failure));
        return;
      }
      setEntries(pages.flatMap(result => result.result.data.map(resource => ({ providerId: result.providerId, providerName: result.providerName, resource }))));
      setCursors(Object.fromEntries(pages.map(result => [result.providerId, result.result.page?.next ?? null])));
      if (failures.length) setError('Some service-provider history could not load. Retry to see the complete history.');
    });
    return () => { active = false; };
  }, [providerKey, retryRevision]);
  async function loadMore() {
    if (!providers || loadingMore || error || !Object.values(cursors).some(Boolean)) return;
    setLoadingMore(true);
    try {
      const results = await Promise.all(providers.filter(provider => cursors[provider.id]).map(async provider => {
        try {
          return { providerId: provider.id, providerName: provider.attributes.display_name || 'Service provider', result: await customerData.timeline(provider.id, { limit: 15, after: cursors[provider.id]! }) };
        } catch (failure) {
          return { providerId: provider.id, providerName: provider.attributes.display_name || 'Service provider', failure };
        }
      }));
      const pages = results.filter((result): result is { providerId: string; providerName: string; result: Collection<TimelineEntryAttributes> } => 'result' in result);
      const failures = results.filter((result): result is { providerId: string; providerName: string; failure: unknown } => 'failure' in result);
      setEntries(current => {
        const seen = new Set((current || []).map(entry => `${entry.providerId}:${entry.resource.id}`));
        return [...(current || []), ...pages.flatMap(result => result.result.data.map(resource => ({ providerId: result.providerId, providerName: result.providerName, resource }))).filter(entry => !seen.has(`${entry.providerId}:${entry.resource.id}`))];
      });
      setCursors(current => ({ ...current, ...Object.fromEntries(pages.map(result => [result.providerId, result.result.page?.next ?? null])) }));
      setError(failures.length ? 'Some service-provider history could not load. Retry to see the complete history.' : '');
    } finally { setLoadingMore(false); }
  }
  if (error && !entries) return page('Your service story', 'A connected history of care, decisions and documents.', <DataState message={error} retry={classifyCustomerState(error) === 'denied' ? undefined : retry} actionLabel="Retry history" />);
  if (!entries) return page('Your service story', 'A connected history of care, decisions and documents.', <DataState message={t('loading')} />);
  const ordered = [...entries].sort((left, right) => right.resource.attributes.occurred_at.localeCompare(left.resource.attributes.occurred_at));
  const partialError = error ? <div className="customer-feature-error customer-alert-feed-error customer-timeline-error" role="alert"><span>{error}</span><Button disabled={loadingMore} onClick={retry}>Retry history</Button></div> : null;
  return page('Your service story', 'A connected history of care, decisions and documents.', <>{partialError}{ordered.length ? <section className="customer-feature-panel customer-timeline">{ordered.map(({ providerId, providerName, resource }) => { const target = timelineTarget(resource.relationships.source, resource.relationships.asset); const presentation = timelinePresentation(resource.attributes.event_name, resource.relationships.source); return <article className={`customer-timeline-item customer-timeline-item--${presentation.scope}`} key={`${providerId}:${resource.id}`}><time dateTime={resource.attributes.occurred_at}>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(resource.attributes.occurred_at))}</time><span className="customer-timeline-dot" aria-hidden="true" /><div><strong>{presentation.title}</strong>{resource.attributes.summary && <p className="customer-timeline-summary">{customerReadableName(resource.attributes.summary)}</p>}<small>{presentation.scopeLabel} · {providerName}</small>{target && <button type="button" className="text-button" onClick={() => onNavigate(providerId, target.path)}>{target.label} →</button>}</div></article>; })}</section> : !error ? <DataState message="Service updates and decisions will appear here when available." /> : null}{Object.values(cursors).some(Boolean) && !error && <Button disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? t('loading') : 'Load more history'}</Button>}</>);
}

export const customerMoreLinks = [['building', 'places', 'My places', 'Places and service context.'], ['building', 'projects', 'Installation projects', 'Readiness and per-unit handover.'], ['clipboard', 'quotations', 'Approvals', 'Quotations waiting for your decision.'], ['shield', 'coverage', 'AMC & warranty', 'Exact coverage and agreements.'], ['document', 'documents', 'Documents', 'Reports, agreements and proof.'], ['users', 'members', 'Family & sharing', 'Manage permitted access.'], ['timeline', 'timeline', 'Service history', 'Your connected service story.'], ['bell', 'alerts', 'Notifications', 'Updates that matter.'], ['user', 'profile', 'Profile & security', 'Your details and sign-in devices.'], ['help', 'help', 'Help & support', 'Find the next step.']] as const;

function CustomerMoreIcon({ name }: { name: (typeof customerMoreLinks)[number][0] }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeWidth: 1.7 };
  const paths: Record<(typeof customerMoreLinks)[number][0], ReactNode> = {
    building: <><path d="M4 20h16M6 20V8l6-4 6 4v12M9 10h.01M15 10h.01M9 14h.01M15 14h.01M11 20v-3h2v3" /></>,
    clipboard: <><path d="M9 5H6v15h12V5h-3M9 4h6v3H9zM9 12l2 2 4-4M9 17h6" /></>,
    shield: <><path d="M12 3 19 6v5c0 4.5-3 7.5-7 10-4-2.5-7-5.5-7-10V6zM9 12l2 2 4-4" /></>,
    document: <><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6" /></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20M16 5.5a3 3 0 0 1 0 5.8M17 14h.5a4 4 0 0 1 4 4v2" /></>,
    timeline: <><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
    bell: <><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0" /></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.6 1.7c-1 1.1-2.1 1.4-2.1 3M12 17.5h.01" /></>,
  };
  return <svg className="customer-more-icon-svg" viewBox="0 0 24 24" aria-hidden="true" {...common}>{paths[name]}</svg>;
}

export function disambiguateProviderNames<TValue extends { providerId: string; providerName: string }>(entries: TValue[]): TValue[] {
  const totals = new Map<string, number>();
  entries.forEach(entry => totals.set(entry.providerName, (totals.get(entry.providerName) || 0) + 1));
  const order = new Map<string, number>();
  const sequence = new Map<string, number>();
  [...entries].sort((left, right) => left.providerName.localeCompare(right.providerName) || left.providerId.localeCompare(right.providerId)).forEach(entry => {
    if (totals.get(entry.providerName)! <= 1) return;
    const next = (sequence.get(entry.providerName) || 0) + 1;
    sequence.set(entry.providerName, next);
    order.set(entry.providerId, next);
  });
  return entries.map(entry => totals.get(entry.providerName)! > 1
    ? { ...entry, providerName: `${entry.providerName} · Account\u00a0${order.get(entry.providerId)}` }
    : entry);
}

export function CustomerMorePage({ goTo }: { goTo: (path: string) => void }) {
  return page('A place for everything.', 'Your account, coverage and useful details.', <div className="customer-feature-panel customer-more-list">{customerMoreLinks.map(([icon, route, title, description]) => <button key={route} className="customer-more-link" onClick={() => goTo(`/${route}`)}><span className="customer-more-icon"><CustomerMoreIcon name={icon} /></span><span className="customer-more-copy"><strong>{title}</strong><small>{description}</small></span><span className="customer-more-chevron" aria-hidden="true">›</span></button>)}</div>);
}

type HelpProviderContact = { providerId: string; providerName: string; contact: ProviderSupportContact | null; error?: string };

export function CustomerHelpPage({ providers, goTo }: { providers: Provider[] | null; goTo: (path: string) => void }) {
  const [providerContacts, setProviderContacts] = useState<HelpProviderContact[] | null>(null);
  const [selectedContact, setSelectedContact] = useState<HelpProviderContact | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const supportDialogRef = useRef<HTMLDialogElement>(null);
  const providerKey = providers?.map(provider => provider.id).join('|') ?? 'loading';
  useEffect(() => {
    let active = true;
    setProviderContacts(null);
    if (!providers) return () => { active = false; };
    Promise.all(providers.map(async provider => {
      const providerName = provider.attributes.display_name || 'Service provider';
      try {
        const result = await customerData.supportContact(provider.id);
        return { providerId: provider.id, providerName, contact: result.data };
      } catch (cause) {
        return { providerId: provider.id, providerName, contact: null, error: errorMessage(cause) };
      }
    })).then(result => { if (active) setProviderContacts(disambiguateProviderNames(result)); });
    return () => { active = false; };
  }, [providerKey, reloadToken]);
  useEffect(() => {
    const dialog = supportDialogRef.current;
    if (!dialog) return;
    if (selectedContact && !dialog.open) dialog.showModal();
    if (!selectedContact && dialog.open) dialog.close();
  }, [selectedContact]);

  const content = <>
    <div className="customer-feature-grid customer-help-grid">
      <section className="customer-feature-panel customer-help-contact-panel">
        <div className="customer-feature-panel-heading"><div><h2>Your service providers</h2><p>Contact details for providers linked to your account.</p></div></div>
        {providerContacts === null ? <p role="status">Loading provider contact details…</p>
          : providerContacts.length === 0 ? <p>No active service-provider relationships are linked to your account.</p>
            : <div className="customer-help-provider-list">{providerContacts.map(entry => <article className="customer-help-provider" key={entry.providerId}>
              <div className="customer-help-provider-identity"><span className="customer-help-provider-avatar" aria-hidden="true">SP</span><span><strong>{entry.providerName}</strong><small>{entry.error ? 'Contact details could not be loaded.' : 'For appointments, coverage and existing requests.'}</small></span></div>
              <div className="customer-help-provider-actions"><Button onClick={() => setSelectedContact(entry)}>View contact details</Button>{entry.error && <Button onClick={() => setReloadToken(value => value + 1)}>Retry</Button>}</div>
            </article>)}</div>}
        <div className="customer-help-shortcuts">
          <button type="button" onClick={() => goTo('/bookings')}><span><strong>Track an existing service</strong><small>Check your visit or request status.</small></span><span aria-hidden="true">›</span></button>
          <button type="button" onClick={() => goTo('/coverage')}><span><strong>Understand my coverage</strong><small>View the exact agreement.</small></span><span aria-hidden="true">›</span></button>
          <button type="button" onClick={() => goTo('/quotations')}><span><strong>Review a quotation</strong><small>Scope, amount and approval.</small></span><span aria-hidden="true">›</span></button>
        </div>
      </section>
      <section className="customer-feature-panel customer-help-questions">
        <div className="customer-feature-panel-heading"><div><h2>Common questions</h2></div></div>
        <details><summary>Can I choose my technician?</summary><p>Your provider assigns an eligible technician. You can request a preferred service window.</p></details>
        <details><summary>Is a request a confirmed booking?</summary><p>Your provider reviews a request before confirming a time and assignment.</p></details>
        <details><summary>Does handover activate my AMC?</summary><p>AMC or warranty commencement requires the separate approved coverage source.</p></details>
        <div className="customer-feature-warning"><h3>Immediate safety concern?</h3><p>Move to safety and contact local emergency services. A service request is not an emergency dispatch confirmation.</p></div>
      </section>
    </div>
    {selectedContact && <dialog ref={supportDialogRef} className="customer-confirm-dialog customer-support-dialog" aria-labelledby="customer-support-dialog-title" onCancel={() => setSelectedContact(null)} onClose={() => setSelectedContact(null)}>
        <h2 id="customer-support-dialog-title">Contact details</h2>
        <p><strong>{selectedContact.providerName}</strong></p>
        {selectedContact.error ? <div role="alert"><p>Contact details could not be loaded. Retry to check again.</p><Button onClick={() => { setSelectedContact(null); setReloadToken(value => value + 1); }}>Retry contact details</Button></div> : selectedContact.contact ? <>
          <p>{selectedContact.contact.attributes.display_name}</p>
          {selectedContact.contact.attributes.contact_methods.email && <a href={`mailto:${selectedContact.contact.attributes.contact_methods.email}`}>Email {selectedContact.contact.attributes.contact_methods.email}</a>}
          {selectedContact.contact.attributes.contact_methods.mobile && <a href={`tel:${selectedContact.contact.attributes.contact_methods.mobile}`}>Call {selectedContact.contact.attributes.contact_methods.mobile}</a>}
          {selectedContact.contact.attributes.contact_methods.landline && <a href={`tel:${selectedContact.contact.attributes.contact_methods.landline}`}>Call landline {selectedContact.contact.attributes.contact_methods.landline}</a>}
          {!Object.values(selectedContact.contact.attributes.contact_methods).some(Boolean) && <p>No email or phone number has been shared by this provider.</p>}
        </> : <p>No customer-support contact has been shared by this provider.</p>}
        <Button onClick={() => supportDialogRef.current?.close()}>Close</Button>
    </dialog>}
  </>;
  return page('Let’s make it easier.', 'A clear next step, whenever you need one.', content, 'customer-help-page');
}

function DataState({ message, retry, actionLabel }: { message: string; retry?: () => void; actionLabel?: string }) { const kind = classifyCustomerState(message); const onAction = kind === 'denied' ? () => { window.location.hash = '/'; } : retry || (['loading', 'error', 'conflict', 'offline'].includes(kind) ? () => window.location.reload() : undefined); return <CustomerStatePanel kind={kind} message={message} onAction={onAction} actionLabel={retry ? actionLabel : undefined} />; }


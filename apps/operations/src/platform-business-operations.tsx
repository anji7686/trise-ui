import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button, DetailSection, StatePanel, SortedSelect } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { operationsData, type BusinessOperation, type ElevatorBusinessConfiguration } from './data';
import { AdminActionMenu, AdminDataTable, AdminEmptyState, AdminFilterBar, AdminPageHeader } from './platform-admin-ui';
import { formatIndiaDateTime } from './subscription-support';

const INDUSTRIES = [
  ['BUILDING_FACILITIES', 'Building facilities'],
  ['RENEWABLE_ENERGY', 'Renewable energy'],
  ['WATER_SYSTEMS', 'Water systems'],
  ['ELECTRICAL', 'Electrical'],
  ['RESIDENTIAL', 'Residential'],
  ['INDIVIDUAL_HOME', 'Individual home'],
  ['VILLA', 'Villa'],
  ['COMMUNITY_MULTI_BLOCK', 'Community / multi-block'],
  ['COMMERCIAL_OFFICE', 'Commercial / office'],
  ['COMMERCIAL_RETAIL', 'Commercial / retail'],
  ['COMMERCIAL_HOSPITALITY', 'Commercial / hospitality'],
  ['HEALTHCARE', 'Healthcare'],
  ['INDUSTRIAL', 'Industrial'],
  ['WAREHOUSE_LOGISTICS', 'Warehouse / logistics'],
  ['TRANSIT_PUBLIC', 'Transit / public'],
  ['BUILDING_FACILITIES_VERTICAL_TRANSPORT', 'Building facilities / vertical transport'],
] as const;

const ICONS = [
  ['', 'Not classified'],
  ['elevator', 'Elevator / lift'],
  ['escalator', 'Escalator'],
  ['moving-walkway', 'Moving walkway'],
  ['general-service', 'General service'],
] as const;

const CONFIGURATION_PROFILES = [
  ['NONE', 'No additional business configuration'],
  ['ELEVATOR_SERVICES', 'Elevator & Lift services'],
] as const;

const CONFIGURATION_SCOPES = [
  ['INSTALLATION_ONLY', 'Installation only'],
  ['SERVICE_MAINTENANCE', 'Service & maintenance'],
  ['MODERNISATION_ONLY', 'Modernisation only'],
  ['END_TO_END', 'End-to-end elevator services'],
] as const;

const CONFIGURATION_MULTI_FIELDS = [
  { key: 'service_models', label: 'Service models', options: [['AMC', 'Annual maintenance (AMC)'], ['BREAKDOWN', 'Breakdown service'], ['MODERNISATION', 'Modernisation'], ['SPARE_PARTS', 'Spare parts']] },
  { key: 'equipment_types', label: 'Equipment types', options: [['PASSENGER_LIFT', 'Passenger lift'], ['GOODS_LIFT', 'Goods lift'], ['ESCALATOR', 'Escalator'], ['SERVICE_LIFT', 'Service lift']] },
  { key: 'services', label: 'Services', options: [['AMC', 'AMC'], ['BREAKDOWN', 'Breakdown response'], ['MODERNISATION', 'Modernisation']] },
  { key: 'checklists', label: 'Checklists', options: [['ROUTINE_MAINTENANCE', 'Routine maintenance'], ['SAFETY_INSPECTION', 'Safety inspection'], ['MODERNISATION_HANDOVER', 'Modernisation handover']] },
  { key: 'industries', label: 'Industry segments', options: [['RESIDENTIAL', 'Residential'], ['COMMERCIAL', 'Commercial'], ['INDUSTRIAL', 'Industrial'], ['HEALTHCARE', 'Healthcare'], ['HOSPITALITY', 'Hospitality'], ['INSTITUTIONAL', 'Institutional']] },
  { key: 'standards', label: 'Standards references', options: [['IS_14665', 'IS 14665'], ['IS_15908', 'IS 15908'], ['IS_12855', 'IS 12855'], ['EN_81', 'EN 81']] },
] as const;

type ConfigurationListKey = (typeof CONFIGURATION_MULTI_FIELDS)[number]['key'];

const defaultElevatorConfiguration = (): ElevatorBusinessConfiguration => ({
  scope: 'END_TO_END',
  service_models: ['AMC', 'BREAKDOWN', 'MODERNISATION', 'SPARE_PARTS'],
  equipment_types: ['PASSENGER_LIFT', 'GOODS_LIFT', 'ESCALATOR', 'SERVICE_LIFT'],
  services: ['AMC', 'BREAKDOWN', 'MODERNISATION'],
  checklists: ['ROUTINE_MAINTENANCE', 'SAFETY_INSPECTION', 'MODERNISATION_HANDOVER'],
  industries: ['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'HEALTHCARE', 'HOSPITALITY', 'INSTITUTIONAL'],
  standards: ['IS_14665', 'IS_15908', 'IS_12855', 'EN_81'],
});

const human = (value?: string | null) => value ? value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not classified';
const errorText = (error: unknown) => (error as { message?: string })?.message || 'The Business Operation catalogue request could not be completed.';

type Draft = { code: string; name: string; description: string; industry_key: string; icon_key: string; display_order: string; is_active: boolean; is_selectable: boolean; configuration: ElevatorBusinessConfiguration | null };
const emptyDraft = (): Draft => ({ code: '', name: '', description: '', industry_key: 'RESIDENTIAL', icon_key: 'elevator', display_order: '0', is_active: true, is_selectable: true, configuration: null });

function editorLabel(operation: BusinessOperation | null) {
  return operation ? `Edit ${operation.attributes.name}` : 'Add Business Operation';
}

function ConfigurationSummary({ title, configuration }: { title: string; configuration?: ElevatorBusinessConfiguration | null }) {
  if (!configuration) return <section className="business-operation-card"><div className="business-operation-card-heading"><h3>{title}</h3><span className="business-operation-badge muted">Not configured</span></div><p className="platform-muted">No additional business configuration is attached to this operation.</p></section>;
  return <section className="business-operation-card">
    <div className="business-operation-card-heading"><div><span className="business-operation-kicker">Configuration profile</span><h3>{title}</h3></div><span className="business-operation-badge">Elevator &amp; Lift</span></div>
    <div className="business-operation-config-grid">
      <div className="business-operation-config-item"><span>Service scope</span><strong>{human(configuration.scope)}</strong></div>
      {CONFIGURATION_MULTI_FIELDS.map(field => <div className="business-operation-config-item" key={field.key}><span>{field.label}</span><ul className="business-operation-chip-list">{(configuration[field.key] as string[]).map(value => <li className="business-operation-chip" key={value}>{human(value)}</li>)}</ul></div>)}
    </div>
  </section>;
}

export function PlatformBusinessOperationsPage({ capabilities, currentUserId = '' }: { capabilities: string[]; currentUserId?: string }) {
  const [rows, setRows] = useState<BusinessOperation[]>([]);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'active' | 'inactive' | 'all'>('all');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [appliedActive, setAppliedActive] = useState<'active' | 'inactive' | 'all'>('all');
  const [editing, setEditing] = useState<BusinessOperation | null>(null);
  const [viewing, setViewing] = useState<BusinessOperation | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canWrite = capabilities.includes('PLATFORM_CONFIGURATION_WRITE');
  const canReview = capabilities.includes('PLATFORM_CONFIGURATION_REVIEW');
  const canPublish = capabilities.includes('PLATFORM_CONFIGURATION_PUBLISH');

  function closeActionMenus() {
    document.querySelectorAll<HTMLDetailsElement>('.admin-action-menu[open]').forEach(menu => { menu.open = false; });
  }

  async function load(search = appliedQuery, active = appliedActive) {
    setLoading(true); setError('');
    try {
      const result = await operationsData.platformBusinessOperations({ q: search || undefined, active: active === 'all' ? undefined : active === 'active' });
      setRows(result.data);
    } catch (cause) { setError(errorText(cause)); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const visibleRows = useMemo(() => [...rows].sort((left, right) => (left.attributes.display_order || 0) - (right.attributes.display_order || 0) || left.attributes.name.localeCompare(right.attributes.name)), [rows]);

  function openEditor(operation: BusinessOperation | null) {
    closeActionMenus();
    setEditorOpen(true);
    setViewing(null);
    setEditing(operation);
    const values = operation?.attributes.draft?.payload || operation?.attributes;
    setDraft(operation ? {
      code: values?.code || operation.attributes.code,
      name: values?.name || operation.attributes.name,
      description: values?.description || '',
      industry_key: values?.industry_key || 'RESIDENTIAL',
      icon_key: values?.icon_key || '',
      display_order: String(values?.display_order || 0),
      is_active: values?.is_active !== false,
      is_selectable: values?.is_selectable !== false,
      configuration: values?.configuration || null,
    } : emptyDraft());
    setError('');
  }

  function openViewer(operation: BusinessOperation) {
    closeActionMenus();
    setViewing(operation);
    setEditorOpen(false);
    setEditing(null);
    setError('');
  }

  function setConfigurationProfile(profile: string) {
    setDraft(current => ({ ...current, configuration: profile === 'ELEVATOR_SERVICES' ? current.configuration || defaultElevatorConfiguration() : null }));
  }

  function setConfigurationScope(scope: string) {
    setDraft(current => ({ ...current, configuration: current.configuration ? { ...current.configuration, scope } : defaultElevatorConfiguration() }));
  }

  function toggleConfigurationValue(field: ConfigurationListKey, value: string, checked: boolean) {
    setDraft(current => {
      const configuration = current.configuration || defaultElevatorConfiguration();
      const selected = configuration[field] as string[];
      const next = checked ? [...new Set([...selected, value])] : selected.filter(item => item !== value);
      return { ...current, configuration: { ...configuration, [field]: next } };
    });
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setAppliedQuery(query.trim()); setAppliedActive(activeFilter); void load(query.trim(), activeFilter);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || busy) return;
    if (!draft.code.trim() || !draft.name.trim() || !draft.industry_key) { setError('Code, name, and industry are required.'); return; }
    const displayOrder = Number(draft.display_order);
    if (!Number.isInteger(displayOrder) || displayOrder < 0) { setError('Display order must be a whole number of zero or greater.'); return; }
    if (draft.configuration && CONFIGURATION_MULTI_FIELDS.some(field => (draft.configuration?.[field.key] as string[]).length === 0)) { setError('Select at least one value in every elevator configuration group.'); return; }
    setBusy(true); setError('');
    try {
      if (editing) {
        const saved = await operationsData.updatePlatformBusinessOperation(editing.id, { expected_revision: editing.attributes.draft?.revision || editing.attributes.revision || 0, name: draft.name.trim(), description: draft.description.trim(), industry_key: draft.industry_key, icon_key: draft.icon_key || undefined, display_order: displayOrder, is_active: draft.is_active, is_selectable: draft.is_selectable, configuration: draft.configuration || undefined }, crypto.randomUUID());
        setRows(current => current.map(row => row.id === saved.id ? saved : row));
      } else {
        const saved = await operationsData.createPlatformBusinessOperation({ code: draft.code.trim().toUpperCase(), name: draft.name.trim(), description: draft.description.trim(), industry_key: draft.industry_key, icon_key: draft.icon_key, display_order: displayOrder, is_active: draft.is_active, is_selectable: draft.is_selectable, configuration: draft.configuration || undefined }, crypto.randomUUID());
        setRows(current => [saved, ...current]);
      }
      setEditing(null); setEditorOpen(false); setDraft(emptyDraft());
      await load();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  async function toggleAvailability(operation: BusinessOperation) {
    if (!canPublish || busy) return;
    const enabled = operation.attributes.availability?.enabled ?? (operation.attributes.is_active !== false && operation.attributes.is_selectable !== false);
    const action = enabled ? 'disable' : 'restore';
    if (!window.confirm(`${enabled ? 'Disable' : 'Restore'} ${operation.attributes.name} across the platform? This changes existing provider operation access and records a restorable before/after snapshot.`)) return;
    setBusy(true); setError('');
    try {
      const saved = await operationsData.setPlatformBusinessOperationAvailability(operation.id, { enabled: !enabled, expected_revision: operation.attributes.revision || 0, reason: `Global Administrator platform-wide availability ${action}` }, crypto.randomUUID());
      setRows(current => current.map(row => row.id === saved.id ? saved : row));
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  async function submitReview(operation: BusinessOperation) {
    const draft = operation.attributes.draft;
    if (!canReview || !draft || busy) return;
    setBusy(true); setError('');
    try { await operationsData.submitPlatformBusinessOperationReview(operation.id, { expected_revision: draft.revision, reason: draftReason(operation) }, crypto.randomUUID()); await load(appliedQuery, appliedActive); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  async function approveReview(operation: BusinessOperation) {
    const reviewId = operation.attributes.draft?.review_id;
    if (!canReview || !reviewId || busy) return;
    setBusy(true); setError('');
    try { await operationsData.approvePlatformBusinessOperationReview(operation.id, reviewId, crypto.randomUUID()); await load(appliedQuery, appliedActive); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  async function revokeReview(operation: BusinessOperation) {
    const reviewId = operation.attributes.draft?.review_id;
    if (!canReview || !reviewId || busy) return;
    if (!window.confirm(`Revoke the ${operation.attributes.draft?.review_status} review for ${operation.attributes.name}?`)) return;
    setBusy(true); setError('');
    try { await operationsData.revokePlatformBusinessOperationReview(operation.id, reviewId, 'Business Operation review revoked by Platform Administration', crypto.randomUUID()); await load(appliedQuery, appliedActive); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  async function publish(operation: BusinessOperation) {
    const draft = operation.attributes.draft;
    if (!canPublish || !draft?.review_id || busy) return;
    setBusy(true); setError('');
    try { await operationsData.publishPlatformBusinessOperation(operation.id, { expected_revision: draft.revision, review_id: draft.review_id }, crypto.randomUUID()); await load(appliedQuery, appliedActive); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  function draftReason(operation: BusinessOperation) {
    return operation.attributes.draft?.payload.name ? `Platform catalogue change: ${operation.attributes.draft.payload.name}` : 'Platform catalogue maintenance';
  }

  if (!capabilities.includes('PLATFORM_CONFIGURATION_READ')) return <StatePanel title="Business catalogue access is restricted">The server did not project platform configuration read capability for this session.</StatePanel>;
  return <section className="platform-page">
    <AdminPageHeader breadcrumbs={[{ label: 'Platform Overview', href: 'platform/overview' }, { label: 'Business Operation Catalogue' }]} eyebrow="Platform administration / Catalogue" title="Business Operation Catalogue" description="Maintain canonical operation types used by provider assignment, plan applicability, and business configuration. Changes are drafted, independently reviewed, and published without changing provider assignment IDs." action={canWrite ? <Button onClick={() => openEditor(null)}>Add operation</Button> : undefined} />
    <AdminFilterBar onSubmit={applyFilters}>
      <label>Search catalogue<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or code" maxLength={100} /></label>
      <label>Availability<SortedSelect value={activeFilter} onChange={event => setActiveFilter(event.target.value as typeof activeFilter)}><option value="active">Active only</option><option value="inactive">Inactive only</option><option value="all">All entries</option></SortedSelect></label>
      <Button type="submit">Apply filters</Button>
      <Button type="button" variant="quiet" onClick={() => { setQuery(''); setActiveFilter('all'); setAppliedQuery(''); setAppliedActive('all'); void load('', 'all'); }}>Reset</Button>
      <span>Applied: {appliedQuery || 'All names'} · {human(appliedActive)}</span>
    </AdminFilterBar>
    {error && <StatePanel title="Catalogue action needs attention"><span>{error}</span><Button variant="secondary" onClick={() => void load()}>Retry</Button></StatePanel>}
    {viewing ? <aside className="business-operation-drawer" role="dialog" aria-modal="true" aria-labelledby="business-operation-view-title">
      <button type="button" className="business-operation-drawer-backdrop" aria-label="Close operation details" onClick={() => setViewing(null)} />
      <section className="business-operation-drawer-panel">
        <header className="business-operation-drawer-header"><div><span className="business-operation-kicker">Catalogue details</span><h2 id="business-operation-view-title">{viewing.attributes.name}</h2><div className="business-operation-drawer-meta"><code>{viewing.attributes.code}</code><Status>{human(viewing.attributes.lifecycle_status)}</Status><span>Revision {viewing.attributes.revision || 1}</span></div></div><Button variant="quiet" aria-label="Close operation details" onClick={() => setViewing(null)}>Close</Button></header>
        <div className="business-operation-drawer-content">
          <div className="business-operation-summary-grid">
            <div className="business-operation-summary-card"><span>Platform availability</span><strong>{viewing.attributes.availability?.enabled === false ? 'Disabled' : 'Enabled'}</strong><small>Existing provider operation access is included</small></div>
            <div className="business-operation-summary-card"><span>Provider selection</span><strong>{viewing.attributes.is_selectable === false ? 'Not selectable' : 'Selectable'}</strong><small>Existing assignments remain</small></div>
            <div className="business-operation-summary-card"><span>Published at</span><strong>{viewing.attributes.published_at ? formatIndiaDateTime(viewing.attributes.published_at) : 'Not published'}</strong><small>India Standard Time</small></div>
            <div className="business-operation-summary-card"><span>Industry</span><strong>{human(viewing.attributes.industry_key)}</strong><small>{human(viewing.attributes.icon_key)} catalogue icon</small></div>
          </div>
          <section className="business-operation-card"><div className="business-operation-card-heading"><div><span className="business-operation-kicker">Published record</span><h3>Operation identity</h3></div><span className="business-operation-badge">Authoritative</span></div><dl className="business-operation-definition-list"><dt>Name</dt><dd>{viewing.attributes.name}</dd><dt>Code</dt><dd><code>{viewing.attributes.code}</code></dd><dt>Description</dt><dd>{viewing.attributes.description || 'No description supplied'}</dd></dl></section>
          <ConfigurationSummary title="Published business configuration" configuration={viewing.attributes.configuration} />
          {viewing.attributes.draft && <section className="business-operation-card"><div className="business-operation-card-heading"><div><span className="business-operation-kicker">Pending change</span><h3>Draft revision {viewing.attributes.draft.revision}</h3></div><Status>{human(viewing.attributes.draft.review_status || viewing.attributes.draft.status)}</Status></div><dl className="business-operation-definition-list"><dt>Draft name</dt><dd>{viewing.attributes.draft.payload.name}</dd><dt>Draft availability</dt><dd>{viewing.attributes.draft.payload.is_active === false ? 'Inactive' : 'Active'}</dd><dt>Draft provider selection</dt><dd>{viewing.attributes.draft.payload.is_selectable === false ? 'Not selectable' : 'Selectable'}</dd><dt>Review status</dt><dd>{viewing.attributes.draft.review_status ? human(viewing.attributes.draft.review_status) : 'Not submitted'}</dd></dl><ConfigurationSummary title="Draft business configuration" configuration={viewing.attributes.draft.payload.configuration} /></section>}
        </div>
        <footer className="business-operation-drawer-footer">{canWrite && <Button variant="secondary" onClick={() => openEditor(viewing)}>Edit draft</Button>}<Button variant="quiet" onClick={() => setViewing(null)}>Close view</Button></footer>
      </section>
    </aside> : null}
    {editorOpen ? <aside className="business-operation-drawer" role="dialog" aria-modal="true" aria-labelledby="business-operation-editor-title">
      <button type="button" className="business-operation-drawer-backdrop" aria-label="Close operation editor" onClick={() => { setEditing(null); setEditorOpen(false); setDraft(emptyDraft()); }} />
      <section className="business-operation-drawer-panel">
        <form onSubmit={save} className="business-operation-drawer-form">
          <header className="business-operation-drawer-header"><div><span className="business-operation-kicker">{editing ? 'Draft maintenance' : 'New catalogue operation'}</span><h2 id="business-operation-editor-title">{editorLabel(editing)}</h2><p>Use controlled selections for applicability and availability. Changes are audited and follow the review workflow.</p></div><Button type="button" variant="quiet" aria-label="Close operation editor" onClick={() => { setEditing(null); setEditorOpen(false); setDraft(emptyDraft()); }}>Close</Button></header>
          <div className="business-operation-drawer-content">
            <div className="business-operation-form-intro"><strong>{editing ? 'Edit the proposed revision' : 'Define the catalogue record'}</strong><span>Use the controlled lists below to keep catalogue data consistent.</span></div>
            <div className="platform-form-grid">
              <label>Code<input value={draft.code} disabled={Boolean(editing)} onChange={event => setDraft({ ...draft, code: event.target.value.toUpperCase() })} placeholder="ELEVATOR_SERVICE" maxLength={80} required /></label>
              <label>Name<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Elevator service" maxLength={160} required /></label>
              <label>Industry<SortedSelect value={draft.industry_key} onChange={event => setDraft({ ...draft, industry_key: event.target.value })} required>{INDUSTRIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SortedSelect></label>
              <label>Catalogue icon<SortedSelect value={draft.icon_key} onChange={event => setDraft({ ...draft, icon_key: event.target.value })}>{ICONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SortedSelect></label>
              <label>Display order<input type="number" min="0" step="1" value={draft.display_order} onChange={event => setDraft({ ...draft, display_order: event.target.value })} /></label>
              <label>Business configuration<SortedSelect value={draft.configuration ? 'ELEVATOR_SERVICES' : 'NONE'} onChange={event => setConfigurationProfile(event.target.value)}><option value={CONFIGURATION_PROFILES[0][0]}>{CONFIGURATION_PROFILES[0][1]}</option><option value={CONFIGURATION_PROFILES[1][0]}>{CONFIGURATION_PROFILES[1][1]}</option></SortedSelect></label>
              <label className="admin-form-field--full">Description <span className="platform-muted">(optional)</span><textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} maxLength={500} rows={3} /></label>
              <div className="admin-form-field--full business-operation-availability-note"><strong>Platform availability</strong><span>Managed by the single Global Administrator “Enable / Disable across platform” action after this catalogue record is published. The action preserves the current configuration and provider-operation state for restoration.</span></div>
              {draft.configuration && <fieldset className="admin-form-field--full business-operation-configuration-fieldset"><legend>Elevator &amp; Lift business configuration</legend>
                <label>Service scope<SortedSelect value={draft.configuration.scope} onChange={event => setConfigurationScope(event.target.value)}>{CONFIGURATION_SCOPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SortedSelect></label>
                <div className="business-operation-choice-grid">{CONFIGURATION_MULTI_FIELDS.map(field => <fieldset className="platform-form-choice" key={field.key}><legend>{field.label}</legend>{field.options.map(([value, label]) => <label key={value}><input type="checkbox" checked={(draft.configuration?.[field.key] as string[]).includes(value)} onChange={event => toggleConfigurationValue(field.key, value, event.target.checked)} /> {label}</label>)}</fieldset>)}</div>
              </fieldset>}
            </div>
          </div>
          <footer className="business-operation-drawer-footer"><Button type="button" variant="secondary" disabled={busy} onClick={() => { setEditing(null); setEditorOpen(false); setDraft(emptyDraft()); }}>Cancel</Button><Button type="submit" disabled={busy} busy={busy}>{editing ? 'Save changes' : 'Create operation'}</Button></footer>
        </form>
      </section>
    </aside> : null}
    <DetailSection title="Canonical operation types" description="Global Administrators can enable or disable an operation across the platform. The action updates provider operation access, preserves the published configuration, and records a restorable audit snapshot.">
      {loading ? <p className="platform-muted" role="status">Loading authoritative operation types…</p> : error ? <p className="platform-muted" role="status">Catalogue data is unavailable until the request succeeds.</p> : <AdminDataTable><table className="platform-provider-table"><caption className="sr-only">Platform Business Operation catalogue</caption><thead><tr><th>Operation</th><th>Industry</th><th>Status</th><th>Provider selection</th><th>Actions</th></tr></thead><tbody>{visibleRows.map(operation => {
        const draft = operation.attributes.draft;
        const platformEnabled = operation.attributes.availability?.enabled ?? (operation.attributes.is_active !== false && operation.attributes.is_selectable !== false);
        const proposedSelectable = draft?.payload.is_selectable ?? operation.attributes.is_selectable !== false;
        const reviewOpen = draft?.review_status === 'PENDING' || draft?.review_status === 'APPROVED';
        const ownPendingReview = Boolean(currentUserId) && draft?.review_status === 'PENDING' && operation.attributes.draft?.review_id && operation.attributes.draft?.review_submitted_by_user_id === currentUserId;
        return <tr key={operation.id}><td><strong>{operation.attributes.name}</strong><small>{operation.attributes.code}{operation.attributes.description ? ` · ${operation.attributes.description}` : ''}</small></td><td>{human(operation.attributes.industry_key)}</td><td><Status>{operation.attributes.lifecycle_status === 'DRAFT' ? 'DRAFT' : platformEnabled ? 'ACTIVE' : 'DISABLED'}</Status>{draft && <small>Draft v{draft.revision}{draft.review_status ? ` · ${human(draft.review_status)}` : ' · Not submitted'}</small>}{ownPendingReview && <small>Self-approval will be recorded in the audit trail</small>}</td><td>{proposedSelectable ? 'Selectable' : 'Not selectable'}{draft && <small>Proposed value</small>}</td><td><div className="business-operation-row-actions"><AdminActionMenu label={`Actions for ${operation.attributes.name}`}><button type="button" onClick={() => openViewer(operation)}>View details</button>
          {canWrite && <button type="button" disabled={busy} onClick={() => openEditor(operation)}>Edit draft</button>}
          {canPublish && <button type="button" disabled={busy} onClick={() => void toggleAvailability(operation)}>{platformEnabled ? 'Disable across platform' : 'Enable across platform'}</button>}
          {canReview && draft && !reviewOpen && <button type="button" disabled={busy} onClick={() => void submitReview(operation)}>Submit review</button>}
          {canReview && draft?.review_status === 'PENDING' && <button type="button" disabled={busy} title={ownPendingReview ? 'Self-approval will be recorded in the audit trail.' : undefined} onClick={() => void approveReview(operation)}>Approve review</button>}
          {canReview && draft && reviewOpen && <button type="button" className="admin-action-danger" disabled={busy} onClick={() => void revokeReview(operation)}>Revoke review</button>}
          {canPublish && draft?.review_status === 'APPROVED' && <button type="button" className="admin-action-primary" disabled={busy} onClick={() => void publish(operation)}>Publish</button>}
        </AdminActionMenu></div></td></tr>;
      })}</tbody></table>{!visibleRows.length && <AdminEmptyState title="No operation types found" description="Adjust the search or availability filter, or add a canonical operation type." />}</AdminDataTable>}
    </DetailSection>
    <p className="platform-form-note">Governance note: catalogue edits remain draft/review/publish changes. Platform availability is a separate Global Administrator action that updates existing provider-operation access, preserves the published configuration and prior provider state, and writes before/after audit evidence for restoration.</p>
  </section>;
}

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@trise/ui';
import { SvgIcon } from './icons';
import { operationsData, type BusinessOperation, type ElevatorBusinessConfiguration } from './data';

type RegistryStatus = 'Active' | 'In review' | 'Draft';
type RegistryScope = 'Platform rules' | 'Elevator & Lift Services' | 'India geography' | 'Provider overrides';

type RegistryItem = {
  id: string;
  name: string;
  scope: RegistryScope;
  control: 'Enable / Disable' | 'Radio choice' | 'Checkboxes' | 'Searchable select';
  value: string;
  status: RegistryStatus;
  kind?: string;
};

const registryGroups: Array<{ scope: RegistryScope; icon: 'settings' | 'building' | 'map-pin' | 'users'; tone: string; count: number; status: RegistryStatus; items: RegistryItem[] }> = [
  {
    scope: 'Platform rules', icon: 'settings', tone: 'blue', count: 8, status: 'Active', items: [
      { id: 'maintenance-reminder', name: 'Maintenance reminder (days)', scope: 'Platform rules', control: 'Enable / Disable', value: 'Enabled', status: 'Active', kind: 'maintenance-policies' },
      { id: 'approval-required', name: 'Require approval for changes', scope: 'Platform rules', control: 'Radio choice', value: 'Yes', status: 'Active', kind: 'approval-rules' },
      { id: 'document-types', name: 'Allowed document types', scope: 'Platform rules', control: 'Checkboxes', value: 'PDF · Image', status: 'In review', kind: 'document-policies' },
      { id: 'compliance-checklist', name: 'Default compliance checklist', scope: 'Platform rules', control: 'Searchable select', value: 'Standard (India)', status: 'Active', kind: 'checklist-templates' },
    ],
  },
  {
    scope: 'Elevator & Lift Services', icon: 'building', tone: 'purple', count: 6, status: 'In review', items: [
      { id: 'service-frequency', name: 'Service frequency', scope: 'Elevator & Lift Services', control: 'Searchable select', value: 'Quarterly', status: 'In review', kind: 'service-types' },
      { id: 'safety-checks', name: 'Mandatory safety checks', scope: 'Elevator & Lift Services', control: 'Enable / Disable', value: 'Enabled', status: 'Active', kind: 'checklist-templates' },
      { id: 'service-types', name: 'Allowed service types', scope: 'Elevator & Lift Services', control: 'Checkboxes', value: 'AMC · Breakdown', status: 'Draft', kind: 'service-types' },
    ],
  },
  {
    scope: 'India geography', icon: 'map-pin', tone: 'green', count: 5, status: 'Active', items: [
      { id: 'states', name: 'Applicable states', scope: 'India geography', control: 'Searchable select', value: 'All India', status: 'Active', kind: 'service-territories' },
      { id: 'state-rules', name: 'Enable state-specific rules', scope: 'India geography', control: 'Enable / Disable', value: 'Disabled', status: 'Draft', kind: 'service-territories' },
    ],
  },
  {
    scope: 'Provider overrides', icon: 'users', tone: 'orange', count: 4, status: 'Draft', items: [
      { id: 'provider-pricing', name: 'Provider-specific pricing', scope: 'Provider overrides', control: 'Enable / Disable', value: 'Enabled', status: 'In review', kind: 'provider-overrides' },
      { id: 'provider-sla', name: 'Custom SLA (hours)', scope: 'Provider overrides', control: 'Radio choice', value: '24', status: 'Active', kind: 'provider-overrides' },
    ],
  },
];

function routeTo(path: string) {
  window.location.hash = path;
}

const registryDestinations: Record<RegistryScope, string> = {
  'Platform rules': 'platform/configuration',
  'Elevator & Lift Services': 'platform/configuration/elevator',
  'India geography': 'platform/configuration/reference-data',
  'Provider overrides': 'platform/configuration/provider-overrides',
};

function StatusPill({ value }: { value: RegistryStatus | 'Enabled' | 'Disabled' | 'Override' | 'Inherited' }) {
  const tone = value === 'Active' || value === 'Enabled' ? 'success' : value === 'In review' ? 'warning' : value === 'Draft' ? 'info' : 'neutral';
  return <span className={`reference-status reference-status-${tone}`}>{value}</span>;
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange?: () => void }) {
  return <button type="button" className={`reference-toggle${enabled ? ' is-on' : ''}`} aria-pressed={enabled} onClick={onChange}><span /></button>;
}

export function PlatformConfigurationRegistry() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All statuses' | RegistryStatus>('All statuses');
  const [scope, setScope] = useState<'All scopes' | RegistryScope>('All scopes');
  const [enabled, setEnabled] = useState<Record<string, boolean>>({ 'maintenance-reminder': true, 'safety-checks': true, 'provider-pricing': true, 'state-rules': false });
  const [radioValues, setRadioValues] = useState<Record<string, string>>({ 'approval-required': 'Yes', 'provider-sla': '24' });
  const [checkedValues, setCheckedValues] = useState<Record<string, boolean>>({ 'document-types:PDF': true, 'document-types:Image': true, 'document-types:Video': false, 'service-types:AMC': true, 'service-types:Breakdown': true, 'service-types:Modernisation': false });
  const rows = useMemo(() => registryGroups.flatMap((group) => group.items).filter((item) => {
    const textMatch = !query.trim() || `${item.name} ${item.scope} ${item.value}`.toLowerCase().includes(query.trim().toLowerCase());
    return textMatch && (status === 'All statuses' || item.status === status) && (scope === 'All scopes' || item.scope === scope);
  }), [query, scope, status]);
  return <section className="platform-reference-page platform-reference-registry">
    <div className="reference-breadcrumb"><span>Platform administration</span><SvgIcon name="chevron-right" size={14} /><strong>Configuration</strong></div>
    <div className="reference-page-heading"><div><span className="reference-eyebrow">Platform administration</span><h1>Configuration registry</h1><p>Manage platform, business-type and provider-scoped settings with controlled options.</p></div><div className="reference-heading-actions"><label className="reference-search"><SvgIcon name="search" size={17} /><input aria-label="Search settings" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search settings..." /></label><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option>All statuses</option><option>Active</option><option>In review</option><option>Draft</option></select><select aria-label="Filter by scope" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}><option>All scopes</option>{registryGroups.map((group) => <option key={group.scope}>{group.scope}</option>)}</select></div></div>
    <div className="reference-summary-grid">{registryGroups.map((group) => <button type="button" key={group.scope} className={`reference-summary-card tone-${group.tone}`} aria-label={`Open ${group.scope} configuration`} onClick={() => routeTo(registryDestinations[group.scope])}><span className="reference-summary-icon"><SvgIcon name={group.icon} size={21} /></span><span><strong>{group.scope}</strong><small>{group.count} settings · Open template</small></span><StatusPill value={group.status} /></button>)}</div>
    <div className="reference-table-card"><div className="reference-table-scroll"><table className="reference-table"><thead><tr><th>Configuration item</th><th>Scope</th><th>Control</th><th>Value / selection</th><th>Status</th><th>Actions</th></tr></thead><tbody>{registryGroups.map((group) => { const visible = group.items.filter((item) => rows.includes(item)); if (!visible.length) return null; return <>{<tr><th colSpan={6} className={`reference-group-heading tone-${group.tone}`}><SvgIcon name={group.icon} size={18} /><span>{group.scope}</span></th></tr>}{visible.map((item) => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{item.scope}</td><td>{item.control}</td><td>{item.control === 'Enable / Disable' ? <span className="reference-control-value"><Toggle enabled={enabled[item.id] ?? item.value === 'Enabled'} onChange={() => setEnabled((current) => ({ ...current, [item.id]: !(current[item.id] ?? item.value === 'Enabled') }))} />{enabled[item.id] ?? item.value}</span> : item.control === 'Radio choice' ? <span className="reference-radio-options"><label><input type="radio" checked={radioValues[item.id] === item.value} onChange={() => setRadioValues((current) => ({ ...current, [item.id]: item.value }))} name={item.id} /> {item.value}</label><label><input type="radio" checked={radioValues[item.id] !== item.value} onChange={() => setRadioValues((current) => ({ ...current, [item.id]: item.value === 'Yes' ? 'No' : item.value === '24' ? '48' : '72' }))} name={item.id} /> {item.value === 'Yes' ? 'No' : item.value === '24' ? '48' : '72'}</label></span> : item.control === 'Checkboxes' ? <span className="reference-check-options"><label><input type="checkbox" checked={checkedValues[`${item.id}:${item.value.split(' · ')[0]}`] ?? true} onChange={() => setCheckedValues((current) => ({ ...current, [`${item.id}:${item.value.split(' · ')[0]}`]: !(current[`${item.id}:${item.value.split(' · ')[0]}`] ?? true) }))} /> {item.value.split(' · ')[0]}</label>{item.value.split(' · ')[1] && <label><input type="checkbox" checked={checkedValues[`${item.id}:${item.value.split(' · ')[1]}`] ?? true} onChange={() => setCheckedValues((current) => ({ ...current, [`${item.id}:${item.value.split(' · ')[1]}`]: !(current[`${item.id}:${item.value.split(' · ')[1]}`] ?? true) }))} /> {item.value.split(' · ')[1]}</label>}<label><input type="checkbox" checked={checkedValues[`${item.id}:${item.value === 'PDF · Image' ? 'Video' : 'Modernisation'}`] ?? false} onChange={() => setCheckedValues((current) => ({ ...current, [`${item.id}:${item.value === 'PDF · Image' ? 'Video' : 'Modernisation'}`]: !(current[`${item.id}:${item.value === 'PDF · Image' ? 'Video' : 'Modernisation'}`] ?? false) }))} /> {item.value === 'PDF · Image' ? 'Video' : 'Modernisation'}</label></span> : <select aria-label={item.name} defaultValue={item.value}><option>{item.value}</option><option>All India</option><option>Quarterly</option><option>Standard (India)</option></select>}</td><td><StatusPill value={item.status} /></td><td><button type="button" className="reference-more" aria-label={`Open ${item.name}`} onClick={() => routeTo(item.kind ? `platform/configuration/${item.kind}` : 'platform/configuration')} >•••</button></td></tr>)}</>})}</tbody></table></div></div>
    <p className="reference-form-note">All settings use controlled selections and are versioned through the existing draft, review, approval and publish lifecycle.</p>
  </section>;
}

const equipment = ['Passenger lift', 'Goods lift', 'Escalator', 'Service lift (Dumbwaiter)'];
const services = ['AMC', 'Breakdown', 'Modernisation'];
const checklists = ['Routine maintenance checklist', 'Safety inspection checklist', 'Modernisation handover checklist'];
const industries = ['Residential', 'Commercial', 'Industrial', 'Healthcare', 'Hospitality', 'Institutional'];
const standards = ['IS 14665 (Lifts)', 'IS 15908 (Escalators)', 'IS 12855 (Maintenance)', 'EN 81 (Lifts)'];
const toCode = (value: string) => value.toUpperCase().replaceAll(' ', '_').replaceAll(/[()&/.-]+/g, '_').replaceAll(/_+/g, '_').replace(/^_|_$/g, '');
const standardCode = (value: string) => value.startsWith('IS 14665') ? 'IS_14665' : value.startsWith('IS 15908') ? 'IS_15908' : value.startsWith('IS 12855') ? 'IS_12855' : 'EN_81';
const equipmentCode = (value: string) => value.startsWith('Service lift') ? 'SERVICE_LIFT' : toCode(value);
const elevatorSteps = ['Business scope', 'Equipment types', 'Service catalogue', 'Compliance checklists', 'Industry applicability', 'Standards references'];

function SelectionList({ search, items, selected, setSelected, icon, invalid, validationMessage }: { title?: string; search: string; items: string[]; selected: string[]; setSelected: (next: string[]) => void; icon: 'building' | 'settings' | 'clipboard'; invalid?: boolean; validationMessage?: string }) {
  const [query, setQuery] = useState('');
  const visible = items.filter((item) => item.toLowerCase().includes(query.toLowerCase()));
  return <div className="reference-step-list"><div className="reference-step-list-toolbar"><label className="reference-search"><SvgIcon name="search" size={15} /><input aria-label={search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={search} /></label><span className="reference-selected-count">{selected.length} selected⌄</span></div>{visible.length ? visible.map((item) => { const checked = selected.includes(item); return <label className="reference-selection-row" key={item}><span className="reference-drag">⁝⁝</span><input type="checkbox" checked={checked} onChange={() => setSelected(checked ? selected.filter((value) => value !== item) : [...selected, item])} /><span className="reference-row-icon"><SvgIcon name={icon} size={16} /></span><strong>{item}</strong><Toggle enabled={checked} onChange={() => setSelected(checked ? selected.filter((value) => value !== item) : [...selected, item])} /><small>{checked ? 'Enabled' : 'Disabled'}</small><span className="reference-chevron">›</span></label>; }) : <p className="reference-empty-state">No matching options. Try another search.</p>}{invalid && <p className="reference-feedback invalid-feedback" role="alert">{validationMessage || 'Select at least one option.'}</p>}</div>;
}

export function ElevatorBusinessConfigurationReference() {
  const [scope, setScope] = useState('SERVICE_MAINTENANCE');
  const [models, setModels] = useState(['AMC (Annual Maintenance Contract)', 'Breakdown / On-call', 'Modernisation']);
  const [equipmentSelected, setEquipmentSelected] = useState(equipment.slice(0, 3));
  const [serviceSelected, setServiceSelected] = useState(services);
  const [checklistSelected, setChecklistSelected] = useState(checklists.slice(0, 2));
  const [industrySelected, setIndustrySelected] = useState(industries.slice(0, 3));
  const [standardSelected, setStandardSelected] = useState(standards.slice(0, 2));
  const [operation, setOperation] = useState<BusinessOperation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});
  useEffect(() => {
    let current = true;
    setLoading(true);
    operationsData.platformBusinessOperations({ q: 'ELEVATOR_SERVICES' }).then((result) => {
      if (!current) return;
      const found = result.data.find((item) => item.attributes.code === 'ELEVATOR_SERVICES') || null;
      setOperation(found);
      const configuration = found?.attributes.draft?.payload.configuration || found?.attributes.configuration;
      if (configuration) {
        setScope(configuration.scope);
        setModels(configuration.service_models.map((value) => value === 'AMC' ? 'AMC (Annual Maintenance Contract)' : value === 'BREAKDOWN' ? 'Breakdown / On-call' : value === 'MODERNISATION' ? 'Modernisation' : 'Spare parts supply'));
        setEquipmentSelected(configuration.equipment_types.map((value) => equipment.find((item) => equipmentCode(item) === value) || value));
        setServiceSelected(configuration.services.map((value) => services.find((item) => toCode(item) === value) || value));
        setChecklistSelected(configuration.checklists.map((value) => checklists.find((item) => toCode(item).replace('CHECKLIST', '').replace(/^_/, '') === value) || value));
        setIndustrySelected(configuration.industries.map((value) => industries.find((item) => toCode(item) === value) || value));
        setStandardSelected(configuration.standards.map((value) => standards.find((item) => standardCode(item) === value) || value));
      }
    }).catch((cause) => { if (current) setError((cause as { message?: string }).message || 'Elevator business configuration could not be loaded.'); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);
  function stepValidationMessage(step: number) {
    if (step === 0 && models.length === 0) return 'Select at least one service model before continuing.';
    if (step === 1 && equipmentSelected.length === 0) return 'Select at least one equipment type before continuing.';
    if (step === 2 && serviceSelected.length === 0) return 'Select at least one service before continuing.';
    if (step === 3 && checklistSelected.length === 0) return 'Select at least one compliance checklist before continuing.';
    if (step === 4 && industrySelected.length === 0) return 'Select at least one industry before continuing.';
    if (step === 5 && standardSelected.length === 0) return 'Select at least one standards reference before saving.';
    return '';
  }
  function validateStep(step: number) {
    const message = stepValidationMessage(step);
    setValidationErrors((current) => {
      const next = { ...current };
      if (message) next[step] = message;
      else delete next[step];
      return next;
    });
    setError(message);
    return !message;
  }
  function validateConfiguration() {
    const firstInvalid = elevatorSteps.findIndex((_, index) => Boolean(stepValidationMessage(index)));
    if (firstInvalid >= 0) {
      validateStep(firstInvalid);
      setActiveStep(firstInvalid);
      return false;
    }
    setValidationErrors({});
    return true;
  }
  function buildConfiguration(): ElevatorBusinessConfiguration {
    return { scope, service_models: models.map((value) => value.startsWith('AMC') ? 'AMC' : value.startsWith('Breakdown') ? 'BREAKDOWN' : value.startsWith('Modernisation') ? 'MODERNISATION' : 'SPARE_PARTS'), equipment_types: equipmentSelected.map(equipmentCode), services: serviceSelected.map(toCode), checklists: checklistSelected.map((value) => toCode(value).replace('_CHECKLIST', '')), industries: industrySelected.map(toCode), standards: standardSelected.map(standardCode) };
  }
  async function saveDraft() {
    if (!validateConfiguration()) return;
    setBusy('save'); setError(''); setSaved('');
    try {
      const configuration = buildConfiguration();
      const result = operation ? await operationsData.updatePlatformBusinessOperation(operation.id, { expected_revision: operation.attributes.draft?.revision || operation.attributes.revision || 1, configuration }, crypto.randomUUID()) : await operationsData.createPlatformBusinessOperation({ code: 'ELEVATOR_SERVICES', name: 'Elevator & Lift Services', description: 'Elevator installation, inspection, repair and maintenance.', industry_key: 'BUILDING_FACILITIES', icon_key: 'building', display_order: 10, is_active: true, is_selectable: true, configuration }, crypto.randomUUID());
      setOperation(result); setSaved('Draft saved by the server.');
    } catch (cause) { setError((cause as { message?: string }).message || 'Elevator configuration draft could not be saved.'); } finally { setBusy(''); }
  }
  async function submitReview() {
    if (!validateConfiguration()) return;
    if (!operation?.attributes.draft) { setError('Save the elevator configuration before submitting it for review.'); return; }
    setBusy('submit'); setError(''); setSaved('');
    try { const result = await operationsData.submitPlatformBusinessOperationReview(operation.id, { expected_revision: operation.attributes.draft.revision, reason: 'Elevator & Lift Services configuration update' }, crypto.randomUUID()); setOperation((current) => current ? { ...current, attributes: { ...current.attributes, draft: { ...current.attributes.draft!, review_id: result.id, review_status: result.attributes.status } } } : current); setSaved('Submitted for review. An independent Platform Administrator must approve activation.'); routeTo('platform/configuration/reviews'); } catch (cause) { setError((cause as { message?: string }).message || 'Elevator configuration review submission was rejected.'); } finally { setBusy(''); }
  }
  return <section className="platform-reference-page platform-reference-editor">
    <div className="reference-breadcrumb"><button type="button" onClick={() => routeTo('platform/configuration')}>Home</button><SvgIcon name="chevron-right" size={14} /><button type="button" onClick={() => routeTo('platform/configuration')}>Business Configuration</button><SvgIcon name="chevron-right" size={14} /><strong>Edit Business</strong></div>
    <div className="reference-editor-heading"><div className="reference-title-with-icon"><span className="reference-title-icon"><SvgIcon name="building" size={26} /></span><div><h1>Elevator &amp; Lift Services</h1><p>Configure business scope, services, compliance and applicability for Elevator &amp; Lift Services.</p></div></div><div className="reference-draft-meta"><StatusPill value="Draft" /><small>Last updated just now</small></div></div>
    {loading && <p className="notice">Loading the current server configuration…</p>}{error && <p className="error" role="alert">{error}</p>}<div className="reference-editor-layout"><main><nav className="reference-stepper" aria-label="Business configuration steps">{elevatorSteps.map((label, index) => <button type="button" className={index === activeStep ? 'active' : index < activeStep ? 'complete' : ''} aria-current={index === activeStep ? 'step' : undefined} key={label} onClick={() => setActiveStep(index)}><b>{index + 1}</b><span>{label}</span></button>)}</nav>
      {activeStep === 0 && <section className="reference-editor-card"><div className="reference-step-label"><b>1</b><div><strong>Business scope</strong><small>Define what this business covers.</small></div></div><div className="reference-choice-columns"><fieldset><legend>Scope of services</legend>{[['INSTALLATION_ONLY', 'Installation only'], ['SERVICE_MAINTENANCE', 'Service & Maintenance'], ['MODERNISATION_ONLY', 'Modernisation only'], ['END_TO_END', 'End-to-end (Installation, Service & Modernisation)']].map(([code, value]) => <label key={code}><input type="radio" name="scope" checked={scope === code} onChange={() => setScope(code)} />{value}</label>)}</fieldset><fieldset className={validationErrors[0] ? 'reference-invalid' : undefined} aria-invalid={Boolean(validationErrors[0])}><legend>Service model</legend>{['AMC (Annual Maintenance Contract)', 'Breakdown / On-call', 'Modernisation', 'Spare parts supply'].map((value) => <label key={value}><input type="checkbox" checked={models.includes(value)} onChange={() => setModels(models.includes(value) ? models.filter((item) => item !== value) : [...models, value])} />{value}</label>)}</fieldset>{validationErrors[0] && <p className="reference-feedback invalid-feedback" role="alert">{validationErrors[0]}</p>}</div></section>}
      {activeStep === 1 && <section className="reference-editor-card"><div className="reference-step-label"><b>2</b><div><strong>Equipment types</strong><small>Select applicable equipment types.</small></div></div><SelectionList title="Equipment types" search="Search equipment types..." items={equipment} selected={equipmentSelected} setSelected={setEquipmentSelected} icon="building" invalid={Boolean(validationErrors[1])} validationMessage={validationErrors[1]} /></section>}
      {activeStep === 2 && <section className="reference-editor-card"><div className="reference-step-label"><b>3</b><div><strong>Service catalogue</strong><small>Select and configure service offerings.</small></div></div><SelectionList title="Service catalogue" search="Search services..." items={services} selected={serviceSelected} setSelected={setServiceSelected} icon="settings" invalid={Boolean(validationErrors[2])} validationMessage={validationErrors[2]} /></section>}
      {activeStep === 3 && <section className="reference-editor-card"><div className="reference-step-label"><b>4</b><div><strong>Compliance checklists</strong><small>Select applicable compliance checklists.</small></div></div><SelectionList title="Compliance checklists" search="Search checklists..." items={checklists} selected={checklistSelected} setSelected={setChecklistSelected} icon="clipboard" invalid={Boolean(validationErrors[3])} validationMessage={validationErrors[3]} /></section>}
      {activeStep === 4 && <section className="reference-editor-card reference-chip-card"><div className="reference-step-label"><b>5</b><div><strong>Industry applicability</strong><small>Select relevant industry segments.</small></div></div><div className={`reference-chip-list${validationErrors[4] ? ' reference-invalid' : ''}`}>{industries.map((value) => <label key={value}><input type="checkbox" checked={industrySelected.includes(value)} onChange={() => setIndustrySelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])} />{value}</label>)}{validationErrors[4] && <p className="reference-feedback invalid-feedback" role="alert">{validationErrors[4]}</p>}</div></section>}
      {activeStep === 5 && <section className="reference-editor-card reference-chip-card"><div className="reference-step-label"><b>6</b><div><strong>Standards references</strong><small>Select applicable standards.</small></div></div><div className={`reference-chip-list${validationErrors[5] ? ' reference-invalid' : ''}`}>{standards.map((value) => <label key={value}><input type="checkbox" checked={standardSelected.includes(value)} onChange={() => setStandardSelected((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])} />{value}</label>)}{validationErrors[5] && <p className="reference-feedback invalid-feedback" role="alert">{validationErrors[5]}</p>}</div></section>}
      <div className="reference-step-actions" aria-label="Business configuration step navigation"><Button variant="secondary" disabled={activeStep === 0} onClick={() => setActiveStep((current) => Math.max(0, current - 1))}>Previous</Button>{activeStep < elevatorSteps.length - 1 ? <Button onClick={() => { if (validateStep(activeStep)) setActiveStep((current) => Math.min(elevatorSteps.length - 1, current + 1)); }}>Continue</Button> : <span className="reference-step-complete">All configuration sections reviewed</span>}</div>
      {saved && <p className="reference-inline-success" role="status">{saved}</p>}
    </main><aside className="reference-impact-rail"><div className="reference-impact-heading"><SvgIcon name="eye" size={24} /><div><h2>Impact preview</h2><p>See what will be affected by this configuration.</p></div></div><div className="reference-impact-stats"><article><strong>24</strong><small>Affected providers</small><span>of 24 providers</span></article><article><strong>186</strong><small>Active assets</small><span>of 186 assets</span></article></div><section><h3>Providers by status</h3><p><span className="dot green" />Active providers <strong>20</strong></p><p><span className="dot yellow" />In onboarding <strong>3</strong></p><p><span className="dot red" />Inactive <strong>1</strong></p></section><section><h3>Assets by equipment type</h3><p>Passenger lift <strong>128</strong></p><p>Goods lift <strong>42</strong></p><p>Escalator <strong>16</strong></p></section><div className="reference-warning"><strong>⚠ Existing service history is retained</strong><p>This change will not alter or delete existing service records, maintenance history, or compliance data.</p></div><div className="reference-rail-actions"><Button variant="secondary" disabled={Boolean(busy)} onClick={() => void saveDraft()}>Save draft</Button><Button disabled={Boolean(busy)} onClick={() => void submitReview()}>{busy === 'submit' ? 'Submitting…' : 'Submit for review'}</Button></div>{saved && <p className="reference-inline-success" role="status">{saved}</p>}</aside></div>
  </section>;
}

export function ProviderOverridesReference() {
  const [inheritance, setInheritance] = useState<Record<number, string>>({ 0: 'Override', 1: 'Override', 2: 'Override', 3: 'Override', 4: 'Override' });
  const [modules, setModules] = useState(['Service Requests', 'Work Orders', 'Asset Management', 'Invoicing', 'Reports']);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [message, setMessage] = useState('');
  const toggleModule = (module: string) => setModules((current) => current.includes(module) ? current.filter((item) => item !== module) : [...current, module]);
  return <section className="platform-reference-page platform-reference-overrides"><div className="reference-breadcrumb"><button type="button" onClick={() => routeTo('platform/configuration')}>Providers</button><SvgIcon name="chevron-right" size={14} /><strong>Provider overrides</strong></div><div className="reference-page-heading"><div><span className="reference-eyebrow">Provider configuration</span><h1>Provider overrides</h1><p>Configure provider-specific settings with safe inheritance from platform and business defaults.</p></div></div><div className="reference-provider-banner"><span className="reference-summary-icon tone-purple"><SvgIcon name="building" size={21} /></span><div><strong>LIFT RISE SERVICES <StatusPill value="Active" /></strong><small>Provider · Elevator &amp; Lift Services</small></div><dl><div><dt>Business category</dt><dd>Elevator &amp; Lift Services</dd></div><div><dt>Region</dt><dd>India</dd></div><div><dt>Status</dt><dd>● Active</dd></div></dl></div><div className="reference-tabs"><button className="active" type="button">Configuration</button><button type="button">History</button></div><div className="reference-override-layout"><main>{[['Service coverage', 'Select the India states and cities where this provider can offer services.'], ['Enabled modules', 'Select platform modules to enable for this provider.'], ['SLA', 'Set the service level agreement for this provider.'], ['Approval required', 'Require internal approval for key actions for this provider.'], ['Effective dates', 'Specify when these overrides should take effect.']].map(([title, description], index) => <section className="reference-override-card" key={title}><div className="reference-override-label"><SvgIcon name={index === 0 ? 'map-pin' : index === 1 ? 'grid' : index === 2 ? 'activity' : index === 3 ? 'shield' : 'calendar'} size={23} /><div><strong>{title}</strong><small>{description}</small></div></div><div className="reference-inheritance"><label><input type="radio" name={title} checked={inheritance[index] === 'Inherited from platform'} onChange={() => setInheritance((current) => ({ ...current, [index]: 'Inherited from platform' }))} /><strong>Inherited from platform</strong><small>All India (default)</small></label><label><input type="radio" name={title} checked={inheritance[index] === 'Inherited from Elevator & Lift Services'} onChange={() => setInheritance((current) => ({ ...current, [index]: 'Inherited from Elevator & Lift Services' }))} /><strong>Inherited from Elevator &amp; Lift Services</strong><small>Business default</small></label><label className={inheritance[index] === 'Override' ? 'selected' : ''}><input type="radio" name={title} checked={inheritance[index] === 'Override'} onChange={() => setInheritance((current) => ({ ...current, [index]: 'Override' }))} /><strong>Override</strong><small>Provider-specific value</small></label></div>{index === 0 && <div className="reference-field-row"><label>India states<select defaultValue="Maharashtra"><option>Maharashtra</option><option>Karnataka</option><option>All India</option></select></label><label>Cities (within selected states)<select defaultValue="Mumbai, Pune, Bengaluru"><option>Mumbai, Pune, Bengaluru</option><option>All cities</option></select></label></div>}{index === 1 && <div className="reference-module-grid">{['Service Requests', 'Work Orders', 'Asset Management', 'Invoicing', 'Reports', 'Spare Parts', 'Inspections', 'Customer Portal', 'API Access'].map((module) => <label key={module}><input type="checkbox" checked={modules.includes(module)} onChange={() => toggleModule(module)} />{module}<small>{module === 'API Access' ? 'Integrations via API' : 'Enabled provider module'}</small></label>)}</div>}{index === 2 && <label className="reference-full-field">SLA<select defaultValue="Premium (24-hour response)"><option>Premium (24-hour response)</option><option>Standard (48-hour response)</option><option>Basic (72-hour response)</option></select></label>}{index === 3 && <span className="reference-control-value"><Toggle enabled={approvalRequired} onChange={() => setApprovalRequired((current) => !current)} />Approval required <small>Changes and service activations require admin approval.</small></span>}{index === 4 && <div className="reference-field-row"><label>Effective from (India time)<input type="date" defaultValue="2025-03-01" /></label><label>Effective to (optional, India time)<input type="date" /></label><div className="reference-info-box"><strong>India time</strong><small>No timezone selection required. Dates are interpreted in India time (IST).</small></div></div>}</section>)}</main><aside className="reference-effective-rail"><h2>Effective configuration</h2><p>Summary of how settings will look for this provider.</p><section><h3>Provider <StatusPill value="Active" /></h3><strong>LIFT RISE SERVICES</strong><small>Elevator &amp; Lift Services · India</small></section><section><h3>Service coverage <StatusPill value={inheritance[0] === 'Override' ? 'Override' : 'Inherited'} /></h3><p>States <strong>Maharashtra, Karnataka</strong></p><p>Cities <strong>Mumbai, Pune, Bengaluru</strong></p></section><section><h3>Enabled modules <StatusPill value={inheritance[1] === 'Override' ? 'Override' : 'Inherited'} /></h3><p>{modules.join(' · ')}</p></section><section><h3>SLA <StatusPill value={inheritance[2] === 'Override' ? 'Override' : 'Inherited'} /></h3><p>Premium (24-hour response)</p></section><div className="reference-warning"><strong>⚠ Configuration conflicts</strong><p>Selected cities are limited to Maharashtra and Karnataka. Services will not be available in other states.</p></div><div className="reference-rail-actions"><Button variant="secondary" onClick={() => setMessage('Draft prepared. The existing provider configuration API is the persistence path for this override.')}>Save draft</Button><Button onClick={() => { setMessage('Submitted for review.'); routeTo('platform/configuration/reviews'); }}>Submit for review</Button></div>{message && <p className="reference-inline-success" role="status">{message}</p>}</aside></div></section>;
}

const providerModuleLabels: Record<string, string> = { SERVICE_REQUESTS: 'Service Requests', WORK_ORDERS: 'Work Orders', ASSET_MANAGEMENT: 'Asset Management', INVOICING: 'Invoicing', REPORTS: 'Reports', SPARE_PARTS: 'Spare Parts', INSPECTIONS: 'Inspections', CUSTOMER_PORTAL: 'Customer Portal', API_ACCESS: 'API Access' };
const defaultProviderOverride = { coverage: { inheritance: 'OVERRIDE', state_codes: ['MH', 'KA'], city_codes: ['MUMBAI', 'PUNE', 'BENGALURU'] }, modules: { inheritance: 'OVERRIDE', enabled: Object.keys(providerModuleLabels) }, sla: { inheritance: 'OVERRIDE', tier: 'PREMIUM_24H' }, approval: { inheritance: 'OVERRIDE', required: true }, effective_dates: { inheritance: 'OVERRIDE', from: '2025-03-01', to: null } };
type ProviderOverrideDraft = { coverage: { inheritance: string; state_codes: string[]; city_codes: string[] }; modules: { inheritance: string; enabled: string[] }; sla: { inheritance: string; tier: string }; approval: { inheritance: string; required: boolean }; effective_dates: { inheritance: string; from: string; to: string | null } };
type ProviderOverrideSection = keyof ProviderOverrideDraft;
const inheritanceLabel = (value: string) => value === 'PLATFORM' ? 'Inherited from platform' : value === 'BUSINESS' ? 'Inherited from Elevator & Lift Services' : 'Override';
const inheritanceCode = (value: string) => value === 'Inherited from platform' ? 'PLATFORM' : value === 'Inherited from Elevator & Lift Services' ? 'BUSINESS' : 'OVERRIDE';

export function ProviderOverridesReferenceV2() {
  const [providers, setProviders] = useState<Array<{ id: string; attributes: { display_name: string } }>>([]);
  const [providerId, setProviderId] = useState(new URLSearchParams(window.location.hash.split('?')[1] || '').get('provider_id') || '');
  const [providerName, setProviderName] = useState('Select a provider');
  const [configuration, setConfiguration] = useState<ProviderOverrideDraft>(defaultProviderOverride);
  const [providerRevision, setProviderRevision] = useState(0);
  const [draftRevision, setDraftRevision] = useState(0);
  const [reviewId, setReviewId] = useState('');
  const [reviewStatus, setReviewStatus] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { operationsData.platformProviders().then((result) => { const next = result.data.map((item) => ({ id: item.id, attributes: { display_name: item.attributes.display_name } })); setProviders(next); setProviderId((current) => current || next[0]?.id || ''); }).catch((cause) => setError((cause as { message?: string }).message || 'Provider directory could not be loaded.')); }, []);
  useEffect(() => {
    if (!providerId) return;
    let current = true;
    setBusy('load'); setError('');
    Promise.all([operationsData.platformProvider(providerId), operationsData.platformProviderConfigurationOverride(providerId)]).then(([provider, result]) => {
      if (!current) return;
      setProviderName(provider.attributes.display_name);
      setProviderRevision(result.data.attributes.provider_revision);
      setDraftRevision(result.data.attributes.draft?.revision || result.data.attributes.active?.revision || 0);
      setReviewId(result.data.attributes.review_id || '');
      setReviewStatus(result.data.attributes.review_status || '');
      setConfiguration((result.data.attributes.configuration || defaultProviderOverride) as ProviderOverrideDraft);
    }).catch((cause) => { if (current) setError((cause as { message?: string }).message || 'Provider override configuration could not be loaded.'); }).finally(() => { if (current) setBusy(''); });
    return () => { current = false; };
  }, [providerId]);
  const setSection = (section: ProviderOverrideSection, value: Record<string, unknown>) => setConfiguration((current) => ({ ...current, [section]: { ...current[section], ...value } }));
  const setInheritance = (section: ProviderOverrideSection, value: string) => setSection(section, { inheritance: inheritanceCode(value) });
  const save = async () => {
    if (!providerId) return;
    setBusy('save'); setError(''); setMessage('');
    try { const result = await operationsData.updatePlatformProviderConfigurationOverride(providerId, { expected_revision: providerRevision, configuration }, crypto.randomUUID()); setProviderRevision(result.data.attributes.provider_revision); setDraftRevision(result.data.attributes.draft?.revision || 0); setReviewId(''); setReviewStatus(''); setMessage('Draft saved by the server.'); } catch (cause) { setError((cause as { message?: string }).message || 'Provider override draft could not be saved.'); } finally { setBusy(''); }
  };
  const publish = async () => {
    if (!providerId || !draftRevision || !reviewId) return;
    setBusy('publish'); setError(''); setMessage('');
    try { const result = await operationsData.publishPlatformProviderConfigurationOverride(providerId, { expected_revision: providerRevision, review_id: reviewId }, crypto.randomUUID()); setProviderRevision(result.data.attributes.provider_revision); setDraftRevision(result.data.attributes.active?.revision || 0); setReviewStatus('CONSUMED'); setMessage('Approved provider configuration published.'); } catch (cause) { setError((cause as { message?: string }).message || 'Provider override could not be published.'); } finally { setBusy(''); }
  };
  const submit = async () => {
    if (!providerId || !draftRevision) { setError('Save the provider override before submitting it for review.'); return; }
    setBusy('submit'); setError(''); setMessage('');
    try { const result = await operationsData.submitPlatformProviderConfigurationOverrideReview(providerId, { expected_revision: draftRevision, reason: 'Provider override update from Platform Administration' }, crypto.randomUUID()); setReviewId(result.id); setMessage('Submitted for review.'); window.location.hash = `platform/configuration/reviews?provider_id=${encodeURIComponent(providerId)}`; } catch (cause) { setError((cause as { message?: string }).message || 'Provider override review submission was rejected.'); } finally { setBusy(''); }
  };
  const sectionInheritance = (section: ProviderOverrideSection) => inheritanceLabel(String(configuration[section]?.inheritance || 'OVERRIDE'));
  return <section className="platform-reference-page platform-reference-overrides"><div className="reference-breadcrumb"><button type="button" onClick={() => routeTo('platform/configuration')}>Configuration</button><SvgIcon name="chevron-right" size={14} /><strong>Provider overrides</strong></div><div className="reference-page-heading"><div><span className="reference-eyebrow">Provider configuration</span><h1>Provider overrides</h1><p>Configure provider-specific settings with safe inheritance from platform and business defaults.</p></div><label>Provider<select aria-label="Provider" value={providerId} onChange={(event) => setProviderId(event.target.value)}><option value="">Select a provider</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.attributes.display_name}</option>)}</select></label></div><div className="reference-provider-banner"><span className="reference-summary-icon tone-purple"><SvgIcon name="building" size={21} /></span><div><strong>{providerName} <StatusPill value="Active" /></strong><small>Provider · Elevator &amp; Lift Services</small></div><dl><div><dt>Region</dt><dd>India</dd></div><div><dt>Timezone</dt><dd>Asia/Kolkata</dd></div><div><dt>Status</dt><dd>● Active</dd></div></dl></div><div className="reference-tabs"><button className="active" type="button">Configuration</button><button type="button" onClick={() => routeTo(`platform/configuration/audit?provider_id=${encodeURIComponent(providerId)}`)}>History</button></div><div className="reference-override-layout"><main>{[['Service coverage', 'Select the India states and cities where this provider can offer services.'], ['Enabled modules', 'Select platform modules to enable for this provider.'], ['SLA', 'Set the service level agreement for this provider.'], ['Approval required', 'Require internal approval for key actions for this provider.'], ['Effective dates', 'Specify when these overrides should take effect.']].map(([title, description], index) => <section className="reference-override-card" key={title}><div className="reference-override-label"><SvgIcon name={index === 0 ? 'map-pin' : index === 1 ? 'grid' : index === 2 ? 'activity' : index === 3 ? 'shield' : 'calendar'} size={23} /><div><strong>{title}</strong><small>{description}</small></div></div><div className="reference-inheritance">{['Inherited from platform', 'Inherited from Elevator & Lift Services', 'Override'].map((value) => <label className={sectionInheritance(index === 0 ? 'coverage' : index === 1 ? 'modules' : index === 2 ? 'sla' : index === 3 ? 'approval' : 'effective_dates') === value ? 'selected' : ''} key={value}><input type="radio" name={title} checked={sectionInheritance(index === 0 ? 'coverage' : index === 1 ? 'modules' : index === 2 ? 'sla' : index === 3 ? 'approval' : 'effective_dates') === value} onChange={() => setInheritance(index === 0 ? 'coverage' : index === 1 ? 'modules' : index === 2 ? 'sla' : index === 3 ? 'approval' : 'effective_dates', value)} /><strong>{value}</strong><small>{value === 'Override' ? 'Provider-specific value' : 'Inherited default'}</small></label>)}</div>{index === 0 && <div className="reference-field-row"><label>India states<select value={configuration.coverage?.state_codes?.[0] || ''} onChange={(event) => setSection('coverage', { state_codes: event.target.value ? [event.target.value] : [] })}><option value="">Select state</option><option value="MH">Maharashtra</option><option value="KA">Karnataka</option><option value="DL">Delhi</option><option value="TN">Tamil Nadu</option></select></label><label>Cities (within selected states)<select value={configuration.coverage?.city_codes?.join(',') || ''} onChange={(event) => setSection('coverage', { city_codes: event.target.value ? event.target.value.split(',') : [] })}><option value="">Select cities</option><option value="MUMBAI,PUNE">Mumbai, Pune</option><option value="BENGALURU">Bengaluru</option><option value="DELHI">Delhi</option></select></label></div>}{index === 1 && <div className="reference-module-grid">{Object.entries(providerModuleLabels).map(([code, label]) => <label key={code}><input type="checkbox" checked={configuration.modules?.enabled?.includes(code)} onChange={() => setSection('modules', { enabled: configuration.modules?.enabled?.includes(code) ? configuration.modules.enabled.filter((item: string) => item !== code) : [...(configuration.modules?.enabled || []), code] })} />{label}<small>Enabled provider module</small></label>)}</div>}{index === 2 && <label className="reference-full-field">SLA<select value={configuration.sla?.tier || 'PREMIUM_24H'} onChange={(event) => setSection('sla', { tier: event.target.value })}><option value="PREMIUM_24H">Premium (24-hour response)</option><option value="STANDARD_48H">Standard (48-hour response)</option><option value="BASIC_72H">Basic (72-hour response)</option></select></label>}{index === 3 && <span className="reference-control-value"><Toggle enabled={configuration.approval?.required !== false} onChange={() => setSection('approval', { required: configuration.approval?.required === false })} />Approval required <small>Changes and service activations require admin approval.</small></span>}{index === 4 && <div className="reference-field-row"><label>Effective from (India time)<input type="date" value={configuration.effective_dates?.from || ''} onChange={(event) => setSection('effective_dates', { from: event.target.value })} /></label><label>Effective to (optional, India time)<input type="date" value={configuration.effective_dates?.to || ''} onChange={(event) => setSection('effective_dates', { to: event.target.value || null })} /></label><div className="reference-info-box"><strong>India time</strong><small>No timezone selection required. Dates are interpreted in India time (IST).</small></div></div>}</section>)}</main><aside className="reference-effective-rail"><h2>Effective configuration</h2><p>Summary of how settings will look for this provider.</p><section><h3>Provider <StatusPill value="Active" /></h3><strong>{providerName}</strong><small>Elevator &amp; Lift Services · India</small></section><section><h3>Service coverage <StatusPill value={sectionInheritance('coverage') as 'Override' | 'Inherited'} /></h3><p>States <strong>{configuration.coverage?.state_codes?.join(', ') || 'Inherited'}</strong></p><p>Cities <strong>{configuration.coverage?.city_codes?.join(', ') || 'Inherited'}</strong></p></section><section><h3>Enabled modules <StatusPill value={sectionInheritance('modules') as 'Override' | 'Inherited'} /></h3><p>{(configuration.modules?.enabled || []).map((item: string) => providerModuleLabels[item] || item).join(' · ')}</p></section><section><h3>SLA <StatusPill value={sectionInheritance('sla') as 'Override' | 'Inherited'} /></h3><p>{configuration.sla?.tier || 'Inherited'}</p></section><div className="reference-warning"><strong>⚠ Configuration conflicts</strong><p>Selected cities are limited to the selected India states. Services will not be available outside this coverage.</p></div><div className="reference-rail-actions"><Button variant="secondary" disabled={Boolean(busy) || !providerId} onClick={() => void save()}>Save draft</Button>{reviewStatus === 'APPROVED' ? <Button disabled={Boolean(busy) || !providerId} onClick={() => void publish()}>{busy === 'publish' ? 'Publishing…' : 'Publish approved'}</Button> : <Button disabled={Boolean(busy) || !providerId} onClick={() => void submit()}>{busy === 'submit' ? 'Submitting…' : 'Submit for review'}</Button>}</div>{error && <p className="error" role="alert">{error}</p>}{message && <p className="reference-inline-success" role="status">{message}</p>}{reviewId && <small>Review {reviewId.slice(0, 8)}… · {reviewStatus || 'draft'}</small>}</aside></div></section>;
}

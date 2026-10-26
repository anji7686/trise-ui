import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@trise/ui';
import { operationsData, type ProviderWorkJourney, type RequirementCatalogue, type RequirementRevisionAttributes, type Resource, type SiteSurveyAttributes } from './data';
import { RequirementMultiChoice } from './requirement-multi-choice';
import { ActionFeedback, ActionNotification } from './operations-shared';
import './site-survey-wizard.css';

const steps = ['Details', 'Validate', 'Authorize / Save'];
type Contact = { name: string; role: string; phone: string };
type Unit = { label: string; stops: string; capacity: string; type: string };
type SurveyForm = { surveyDate: string; siteAddress: string; latitude: string; longitude: string; accuracy: string; gpsSource: string; buildingType: string; contacts: Contact[]; referralName: string; referralContact: string; units: Unit[]; shaftWidth: string; shaftDepth: string; pitDepth: string; headroom: string; accessNotes: string; capacity: string; requirementsStops: string; quantity: string; liftType: string; application: string; industrySegment: string; technology: string; capacityBand: string; driveType: string; speedBand: string; doorConfiguration: string; doorType: string; machineRoom: string; controlSystem: string; accessibilityFeatures: string[]; safetyFeatures: string[]; finish: string; standardsReferences: string[]; step: number };
const initialForm: SurveyForm = { surveyDate: '', siteAddress: '', latitude: '', longitude: '', accuracy: '', gpsSource: 'MANUAL', buildingType: '', contacts: [{ name: '', role: '', phone: '' }], referralName: '', referralContact: '', units: [{ label: 'Unit 1', stops: '', capacity: '', type: 'PASSENGER_TRACTION' }], shaftWidth: '', shaftDepth: '', pitDepth: '', headroom: '', accessNotes: '', capacity: '', requirementsStops: '', quantity: '1', liftType: '', application: '', industrySegment: '', technology: '', capacityBand: '', driveType: '', speedBand: '', doorConfiguration: '', doorType: '', machineRoom: '', controlSystem: '', accessibilityFeatures: [], safetyFeatures: [], finish: '', standardsReferences: [], step: 0 };
const objectValue = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const textValue = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const surveyGpsSource = (value: unknown) => textValue(value).toUpperCase() === 'BROWSER_GEOLOCATION' || textValue(value).toUpperCase() === 'GPS' ? 'GPS' : 'MANUAL';
const positiveNumber = (value: string) => value.trim() ? Number(value) : undefined;
const isDraftSurvey = (survey: Resource<SiteSurveyAttributes>) => String(survey.attributes.status || '').toUpperCase() === 'DRAFT';

function fromSurvey(record: Resource<SiteSurveyAttributes>): SurveyForm {
  const context = objectValue(record.attributes.survey_context);
  const gps = objectValue(context.gps);
  const contacts = Array.isArray(context.contacts) ? context.contacts.map((entry) => { const item = objectValue(entry); return { name: textValue(item.name), role: textValue(item.role), phone: textValue(item.phone) }; }) : initialForm.contacts;
  const scope = objectValue(record.attributes.requirement_scope);
  const scopeUnits = Array.isArray(scope.units) ? scope.units : [];
  const sourceUnits = scopeUnits.length ? scopeUnits : record.attributes.unit_details;
  const units = sourceUnits.length ? sourceUnits.map((entry, index) => ({ label: textValue(entry.label) || `Unit ${index + 1}`, stops: textValue(entry.stops), capacity: textValue(entry.capacity_kg), type: textValue(entry.equipment_type_code || entry.type) || 'PASSENGER_TRACTION' })) : initialForm.units;
  const building = objectValue(record.attributes.building_details);
  const measures = objectValue(record.attributes.technical_measurements);
  const access = objectValue(record.attributes.access_conditions);
  const requirements = objectValue(scope.requirements || record.attributes.requirements);
  const referral = objectValue(context.referral);
  const previousStep = Number(context.step) || 0;
  const step = previousStep >= 7 ? 2 : previousStep >= 5 ? 1 : 0;
  const arrayValue = (value: unknown) => Array.isArray(value) ? value.map(textValue) : [];
  const firstUnit = units[0];
  return { ...initialForm, surveyDate: record.attributes.survey_date || '', siteAddress: textValue(context.site_address), latitude: textValue(gps.latitude), longitude: textValue(gps.longitude), accuracy: textValue(gps.accuracy_m), gpsSource: surveyGpsSource(gps.source), buildingType: textValue(building.building_type), contacts: contacts.length ? contacts : initialForm.contacts, referralName: textValue(referral.name), referralContact: textValue(referral.contact), units, shaftWidth: textValue(measures.shaft_width_mm), shaftDepth: textValue(measures.shaft_depth_mm), pitDepth: textValue(measures.pit_depth_mm), headroom: textValue(measures.headroom_mm), accessNotes: textValue(access.notes), capacity: textValue(firstUnit?.capacity || requirements.capacity_kg), requirementsStops: textValue(firstUnit?.stops || requirements.stops), quantity: String(units.length || Number(requirements.quantity) || 1), liftType: textValue(firstUnit?.type || requirements.equipment_type_code || requirements.lift_type), application: textValue(requirements.application), industrySegment: textValue(requirements.industry_segment), technology: textValue(requirements.technology), capacityBand: textValue(requirements.capacity_band), driveType: textValue(requirements.drive_type), speedBand: textValue(requirements.speed_band), doorConfiguration: textValue(requirements.door_configuration), doorType: textValue(requirements.door_type), machineRoom: textValue(requirements.machine_room), controlSystem: textValue(requirements.control_system), accessibilityFeatures: arrayValue(requirements.accessibility_features), safetyFeatures: arrayValue(requirements.safety_features), finish: textValue(requirements.finish), standardsReferences: arrayValue(requirements.standards_references), step };
}

function fromExistingLeadData(journey: ProviderWorkJourney | null, revision: Resource<RequirementRevisionAttributes> | null): SurveyForm {
  const context = journey?.attributes.context || {};
  const site = context.site || {};
  const requester = context.requester || {};
  const referral = context.referral || {};
  const capturedRequirements = objectValue(context.requirements?.captured);
  const latestRequirements = objectValue(context.requirements?.latest || revision?.attributes.requirements);
  const requirements = { ...capturedRequirements, ...latestRequirements };
  const text = (value: unknown) => textValue(value);
  const array = (value: unknown) => Array.isArray(value) ? value.map(text) : [];
  const requirementUnits = Array.isArray(requirements.units) ? requirements.units : [];
  const quantity = Math.max(1, Number(requirements.quantity) || requirementUnits.length || 1);
  const units = requirementUnits.length ? requirementUnits.map((entry, index) => ({ label: text(objectValue(entry).label) || `Unit ${index + 1}`, stops: text(objectValue(entry).stops), capacity: text(objectValue(entry).capacity_kg), type: text(objectValue(entry).equipment_type_code || objectValue(entry).type) || 'PASSENGER_TRACTION' })) : Array.from({ length: quantity }, (_, index) => ({ label: `Unit ${index + 1}`, stops: text(requirements.stops), capacity: text(requirements.capacity_kg), type: text(requirements.equipment_type_code || requirements.lift_type) || 'PASSENGER_TRACTION' }));
  const requesterContact = text(requester.contact_reference);
  const requesterName = text(requester.name);
  return {
    ...initialForm,
    siteAddress: text(site.summary),
    latitude: text(site.latitude),
    longitude: text(site.longitude),
    accuracy: text(site.accuracy_m),
    gpsSource: surveyGpsSource(site.source),
    buildingType: text(requirements.industry_segment || requirements.building_type),
    contacts: requesterName || requesterContact ? [{ name: requesterName, role: 'Requester', phone: requesterContact }] : initialForm.contacts,
    referralName: text(referral.name),
    referralContact: text(referral.number || referral.email),
    units,
    shaftWidth: text(requirements.shaft_width_mm),
    shaftDepth: text(requirements.shaft_depth_mm),
    pitDepth: text(requirements.pit_depth_mm),
    headroom: text(requirements.headroom_mm),
    accessNotes: text(requirements.notes),
    capacity: text(requirements.capacity_kg),
    requirementsStops: text(requirements.stops),
    quantity: text(requirements.quantity) || '1',
    liftType: text(requirements.equipment_type_code || requirements.lift_type),
    application: text(requirements.application),
    industrySegment: text(requirements.industry_segment),
    technology: text(requirements.technology),
    capacityBand: text(requirements.capacity_band),
    driveType: text(requirements.drive_type),
    speedBand: text(requirements.speed_band),
    doorConfiguration: text(requirements.door_configuration),
    doorType: text(requirements.door_type),
    machineRoom: text(requirements.machine_room),
    controlSystem: text(requirements.control_system),
    accessibilityFeatures: array(requirements.accessibility_features),
    safetyFeatures: array(requirements.safety_features),
    finish: text(requirements.finish),
    standardsReferences: array(requirements.standards_references),
  };
}

const optionsFor = (catalogue: RequirementCatalogue | null, code: string) => catalogue?.groups.find((group) => group.code === code)?.options || [];
const requirementPayload = (form: SurveyForm) => ({ business_operation_code: 'ELEVATOR_SERVICES', profile_mode: 'PER_UNIT', units: form.units.map((unit, index) => ({ unit_key: `UNIT-${index + 1}`, label: unit.label || `Unit ${index + 1}`, equipment_type_code: unit.type || undefined, stops: positiveNumber(unit.stops), capacity_kg: positiveNumber(unit.capacity) })), application: form.application || undefined, industry_segment: form.industrySegment || undefined, technology: form.technology || undefined, capacity_band: form.capacityBand || undefined, drive_type: form.driveType || undefined, speed_band: form.speedBand || undefined, door_configuration: form.doorConfiguration || undefined, door_type: form.doorType || undefined, machine_room: form.machineRoom || undefined, control_system: form.controlSystem || undefined, accessibility_features: form.accessibilityFeatures, safety_features: form.safetyFeatures, finish: form.finish || undefined, standards_references: form.standardsReferences, notes: form.accessNotes || undefined });
const defaultRequiredRequirementFields = ['equipment_type_code', 'industry_segment', 'application', 'technology', 'drive_type', 'capacity_kg', 'stops', 'quantity', 'speed_band', 'door_configuration', 'door_type', 'machine_room', 'control_system', 'finish'];
const defaultRequiredMultiRequirementFields = ['safety_features', 'standards_references'];
const missingRequirementFields = (catalogue: RequirementCatalogue | null, values: Record<string, unknown>) => {
  const required = catalogue?.completion?.required_fields || defaultRequiredRequirementFields;
  const requiredMulti = catalogue?.completion?.required_multi_fields || defaultRequiredMultiRequirementFields;
  const perUnit = Array.isArray(values.units) && values.units.length > 0;
  const missing = required.filter((field) => perUnit && ['equipment_type_code', 'capacity_kg', 'stops', 'quantity'].includes(field) ? false : values[field] === undefined || values[field] === null || values[field] === '');
  if (perUnit) (values.units as Array<Record<string, unknown>>).forEach((unit, index) => { if (!unit.equipment_type_code) missing.push(`units[${index}].equipment_type_code`); if (!unit.stops) missing.push(`units[${index}].stops`); if (!unit.capacity_kg) missing.push(`units[${index}].capacity_kg`); });
  return [...missing, ...requiredMulti.filter((field) => !Array.isArray(values[field]) || !(values[field] as unknown[]).length)];
};
const humanizeKey = (key: string) => key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const detailLabels: Record<string, string> = {
  status: 'Submission status', revision: 'Survey revision', survey_date: 'Survey date', created_at: 'Submitted at', workflow_step: 'Survey step',
  site_address: 'Site address', building_details: 'Building type', gps_coordinates: 'Site coordinates', location_source: 'Location source', accuracy_m: 'GPS accuracy', captured_at: 'Location captured',
  contacts: 'Site contacts', referral: 'Referral source', quantity: 'Total units', stops: 'Stops / floors', capacity_kg: 'Capacity (kg)', equipment_type_code: 'Equipment type', industry_segment: 'Industry / site segment',
  application: 'Application', technology: 'Technology', drive_type: 'Drive type', speed_band: 'Speed band', door_configuration: 'Door configuration', door_type: 'Door type', machine_room: 'Machine room',
  control_system: 'Control system', finish: 'Finish', accessibility_features: 'Accessibility features', safety_features: 'Safety / emergency features', standards_references: 'Standards references', notes: 'Additional requirements',
  label: 'Unit name', type: 'Equipment type', unit_count: 'Units captured', unit_details: 'Unit profiles', shaft_width_mm: 'Shaft width (mm)', shaft_depth_mm: 'Shaft depth (mm)', pit_depth_mm: 'Pit depth (mm)', headroom_mm: 'Headroom (mm)'
};
const detailLabel = (key: string) => detailLabels[key] || humanizeKey(key);
const readableCode = (value: string) => value.split('_').map((part) => /^[A-Z]{2,}\d*$/.test(part) ? part : part.charAt(0) + part.slice(1).toLowerCase()).join(' ');
const hasDetailValue = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.some(hasDetailValue);
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).some(hasDetailValue);
  return true;
};
const readableValue = (value: unknown, key?: string): string => {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map((item) => readableValue(item, key)).join(', ') : 'None recorded';
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([nestedKey, item]) => `${detailLabel(nestedKey)}: ${readableValue(item, nestedKey)}`).join(' · ');
  const text = String(value);
  if (['created_at', 'captured_at'].includes(key || '') && !Number.isNaN(new Date(text).getTime())) return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(text));
  if (key === 'survey_date' && /^\d{4}-\d{2}-\d{2}$/.test(text)) return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(`${text}T00:00:00+05:30`));
  return /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(text) ? readableCode(text) : text;
};

function SubmittedDetailList({ values }: { values: Record<string, unknown> }) {
  const entries = Object.entries(values).filter(([, value]) => hasDetailValue(value));
  return entries.length ? <dl className="site-survey-submitted-fields">{entries.map(([key, value]) => <div key={key}><dt>{detailLabel(key)}</dt><dd>{readableValue(value, key)}</dd></div>)}</dl> : null;
}

function SubmittedCard({ icon, title, description, values, children, wide = false }: { icon: string; title: string; description: string; values: Record<string, unknown>; children?: ReactNode; wide?: boolean }) {
  if (!Object.values(values).some(hasDetailValue) && !children) return null;
  return <article className={`site-survey-submitted-card${wide ? ' site-survey-submitted-card-wide' : ''}`}><div className="site-survey-submitted-card-heading"><span className="site-survey-card-icon">{icon}</span><div><h4>{title}</h4><p>{description}</p></div></div>{children || <SubmittedDetailList values={values} />}</article>;
}

function withoutKeys(values: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !keys.includes(key)));
}

function SubmittedUnitProfiles({ units }: { units: Array<Record<string, unknown>> }) {
  return <div className="site-survey-submitted-units">{units.map((unit, index) => <article className="site-survey-submitted-unit" key={`submitted-unit-${index}`}><div className="site-survey-submitted-unit-heading"><strong>{readableValue(unit.label) !== 'Not recorded' ? readableValue(unit.label) : `Unit ${index + 1}`}</strong><span>Unit {index + 1}</span></div><SubmittedDetailList values={{ type: unit.equipment_type_code || unit.type, stops: unit.stops, capacity_kg: unit.capacity_kg, ...(objectValue(unit.requirements)) }} /></article>)}</div>;
}

function FinalRequirementDetails({ revision }: { revision: Resource<RequirementRevisionAttributes> }) {
  const attributes = revision.attributes;
  const scope = objectValue(attributes.requirement_scope);
  const values = objectValue(scope.requirements || attributes.requirements);
  const units = Array.isArray(scope.units) ? scope.units.map((unit) => objectValue(unit)) : Array.isArray(values.units) ? values.units.map((unit) => objectValue(unit)) : [];
  const shared = withoutKeys(values, ['units', 'profile_mode', 'quantity', 'stops', 'capacity_kg']);
  return <section className="site-survey-final-requirements"><div className="site-survey-submitted-heading"><div><span className="eyebrow">Final active requirements</span><strong>Requirement revision {attributes.revision_number}</strong><small>{attributes.approved ? 'Approved requirement scope' : 'Latest captured requirement scope · approval pending'}</small></div><span className="site-survey-readonly">Current</span></div><div className="site-survey-requirement-history-content"><SubmittedDetailList values={shared} />{units.length > 0 && <><h4>Elevator units</h4><SubmittedUnitProfiles units={units} /></>}</div></section>;
}

function SubmittedSurveySnapshot({ survey, label = 'Submitted survey', open = true, includeRequirements = true, finalRevision = null }: { survey: Resource<SiteSurveyAttributes>; label?: string; open?: boolean; includeRequirements?: boolean; finalRevision?: Resource<RequirementRevisionAttributes> | null }) {
  const attributes = survey.attributes;
  const revisionScope = objectValue(finalRevision?.attributes.requirement_scope);
  const context = objectValue(attributes.survey_context);
  const gps = objectValue(context.gps);
  const contacts = Array.isArray(context.contacts) ? context.contacts : [];
  const referral = objectValue(context.referral);
  const scopedUnits = Array.isArray(revisionScope.units) ? revisionScope.units : [];
  const units = (scopedUnits.length ? scopedUnits : attributes.unit_details).map((unit) => objectValue(unit));
  const requirementValues = objectValue(revisionScope.requirements || finalRevision?.attributes.requirements || (includeRequirements ? attributes.requirements : {}));
  const unitValuesAreCaptured = units.length > 0 && units.every((unit) => hasDetailValue(unit.stops) && hasDetailValue(unit.capacity_kg));
  const sharedRequirementValues = unitValuesAreCaptured ? withoutKeys(requirementValues, ['quantity', 'stops', 'capacity_kg', 'units', 'profile_mode']) : withoutKeys(requirementValues, ['units', 'profile_mode']);
  const measurementValues = withoutKeys({ ...objectValue(attributes.technical_measurements), ...objectValue(attributes.access_conditions) }, ['notes']);
  const remainingContext = Object.fromEntries(Object.entries(context).filter(([key]) => !['gps', 'contacts', 'referral', 'site_address', 'step'].includes(key)));
  return <details className="site-survey-history-item" open={open}>
    <summary className="site-survey-history-summary">
      <div><span className="eyebrow">{label}</span><strong>{attributes.status} · survey revision {attributes.revision}{finalRevision ? ` · requirement revision ${finalRevision.attributes.revision_number}` : ''}</strong><small>{attributes.survey_date || 'Date not set'}{attributes.created_at ? ` · submitted ${new Date(attributes.created_at).toLocaleString()}` : ''}</small></div>
      <span className="site-survey-history-summary-side"><span className="site-survey-readonly">Read-only snapshot</span><span className="site-survey-accordion-chevron" aria-hidden="true">⌄</span></span>
    </summary>
    <div className="site-survey-history-item-body"><div className="site-survey-submitted-grid">
      <SubmittedCard icon="01" title="Submission" description="Status, revision and survey timing" values={{ status: attributes.status, revision: attributes.revision, survey_date: attributes.survey_date, created_at: attributes.created_at, workflow_step: context.step }} />
      <SubmittedCard icon="02" title="Site & location" description="Visit location and building context" values={{ site_address: context.site_address, building_details: attributes.building_details, gps_coordinates: gps.latitude && gps.longitude ? `${gps.latitude}, ${gps.longitude}` : undefined, location_source: gps.source ? surveyGpsSource(gps.source) : undefined, accuracy_m: gps.accuracy_m, captured_at: gps.captured_at }} />
      <SubmittedCard icon="03" title="Contacts & referral" description="People and attribution captured during the visit" values={{ contacts: contacts.length ? contacts : undefined, referral: Object.keys(referral).length ? referral : undefined }} />
      <SubmittedCard icon="04" title="Shared requirement profile" description={finalRevision?.attributes.approved ? 'Approved requirements shared by all captured units' : 'Latest captured requirements shared by all captured units'} values={sharedRequirementValues} wide />
      <SubmittedCard icon="05" title="Technical measurements" description="Recorded dimensions and access conditions" values={measurementValues} />
      <SubmittedCard icon="06" title="Visit context" description="Additional context captured during this survey" values={remainingContext} />
      <SubmittedCard icon="07" title="Elevator units" description="Unit identity and unit-level sizing; detailed technical profiles can vary by unit" values={{ unit_count: units.length || attributes.proposed_elevator_count }} wide><SubmittedUnitProfiles units={units} /></SubmittedCard>
    </div></div>
  </details>;
}

export function SiteSurveyWizard({ providerId, leadId, leadTitle, onSubmitted, onMessage, onRequirementSaved, onLocationCaptured, readOnly = false }: { providerId: string; leadId: string; leadTitle: string; onSubmitted: (id: string) => void; onMessage: (value: string) => void; onRequirementSaved?: () => Promise<void>; onLocationCaptured?: (location: { latitude: number; longitude: number; accuracy: number; capturedAt: string }) => void; readOnly?: boolean }) {
  const [surveys, setSurveys] = useState<Resource<SiteSurveyAttributes>[]>([]);
  const [record, setRecord] = useState<Resource<SiteSurveyAttributes> | null>(null);
  const [latestRevision, setLatestRevision] = useState<Resource<RequirementRevisionAttributes> | null>(null);
  const [requirementRevisions, setRequirementRevisions] = useState<Resource<RequirementRevisionAttributes>[]>([]);
  const [catalogue, setCatalogue] = useState<RequirementCatalogue | null>(null);
  const [prefilledForm, setPrefilledForm] = useState<SurveyForm>(initialForm);
  const [form, setForm] = useState<SurveyForm>(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [gpsMessage, setGpsMessage] = useState('');
  const [prefillNotice, setPrefillNotice] = useState('');
  const [active, setActive] = useState(false);
  const activeSurveys = useMemo(() => surveys.filter(isDraftSurvey), [surveys]);
  const latestSubmitted = useMemo(() => surveys.find((survey) => !isDraftSurvey(survey)) || null, [surveys]);

  useEffect(() => {
    let current = true;
    setRecord(null); setSurveys([]); setLatestRevision(null); setRequirementRevisions([]); setActive(false); setForm(initialForm); setPrefilledForm(initialForm); setPrefillNotice(''); setError('');
    void Promise.all([
      operationsData.siteSurveys(providerId, leadId),
      operationsData.elevatorRequirementCatalogue(providerId),
      operationsData.marketingLeadJourney(providerId, leadId).catch(() => null),
      operationsData.requirementRevisions(providerId, leadId).catch(() => ({ data: [] })),
    ]).then(([result, options, journey, revisions]) => {
      if (!current) return;
      setSurveys(result.data); setCatalogue(options); setLatestRevision(revisions.data[0] || null); setRequirementRevisions(revisions.data);
      const submitted = result.data.find((survey) => !isDraftSurvey(survey));
      const draft = result.data.find(isDraftSurvey);
      if (submitted) onSubmitted(submitted.id);
      const existing = fromExistingLeadData(journey, revisions.data[0] || null);
      setPrefilledForm(existing);
      if (!draft && !submitted && (journey?.attributes.context.site?.summary || revisions.data.length || journey?.attributes.context.referral?.name)) {
        setForm(existing);
        setPrefillNotice('Lead, Work Intake, referral, location, and saved requirement details have been prefilled. Confirm only the survey-specific changes.');
      }
    }).catch((cause) => { if (current) setError((cause as Error).message || 'Survey setup could not be loaded.'); });
    return () => { current = false; };
  }, [providerId, leadId]);

  function update<K extends keyof SurveyForm>(key: K, value: SurveyForm[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function begin() {
    setRecord(null);
    setForm(latestSubmitted ? fromSurvey(latestSubmitted) : prefilledForm);
    setActive(true);
    setNotice(latestSubmitted ? 'Submitted survey loaded. Edit the details and submit to create the next survey revision.' : '');
    setError('');
  }
  function resume(draft: Resource<SiteSurveyAttributes>) { setRecord(draft); setForm(fromSurvey(draft)); setActive(true); setNotice('Draft loaded. Continue where you left off.'); setError(''); }

  async function save(status: 'DRAFT' | 'SUBMITTED') {
    setBusy(true); setError(''); setNotice('');
    const payload = {
      status,
      survey_date: form.surveyDate || undefined,
      building_details: { building_type: form.industrySegment || form.buildingType || undefined },
      technical_measurements: { shaft_width_mm: positiveNumber(form.shaftWidth), shaft_depth_mm: positiveNumber(form.shaftDepth), pit_depth_mm: positiveNumber(form.pitDepth), headroom_mm: positiveNumber(form.headroom) },
      access_conditions: { notes: form.accessNotes || undefined },
      requirements: requirementPayload(form),
      survey_context: { step: form.step, site_address: form.siteAddress, gps: { latitude: form.latitude || undefined, longitude: form.longitude || undefined, accuracy_m: positiveNumber(form.accuracy), source: surveyGpsSource(form.gpsSource), captured_at: form.latitude && form.longitude ? new Date().toISOString() : undefined }, contacts: form.contacts.filter((contact) => contact.name || contact.role || contact.phone), referral: { name: form.referralName || undefined, contact: form.referralContact || undefined } },
    };
    try {
      let saved: Resource<SiteSurveyAttributes>;
      if (record) saved = await operationsData.updateSiteSurveyDraft(providerId, leadId, record.id, { ...payload, expected_revision: record.attributes.revision }, crypto.randomUUID());
      else saved = await operationsData.createSiteSurvey(providerId, leadId, payload, crypto.randomUUID());
      const normalizedSaved = { ...saved, attributes: { ...saved.attributes, status } };
      setRecord(normalizedSaved); setSurveys((current) => [normalizedSaved, ...current.filter((item) => item.id !== normalizedSaved.id)]);
      if (status === 'SUBMITTED') { setActive(false); onSubmitted(saved.id); onMessage('Site survey submitted. A provider-only draft quotation was created; customer delivery remains unavailable until it is reviewed and published.'); }
      else setNotice('Draft saved securely. You can resume it from this lead later.');
    } catch (cause) { setError((cause as Error).message || 'Survey could not be saved.'); }
    finally { setBusy(false); }
  }

  async function saveRequirements() {
    await save('DRAFT');
    await onRequirementSaved?.();
    setNotice('Partial requirements saved in the survey draft. Complete all mandatory fields before submitting the survey.');
  }

  function captureGps() {
    setGpsMessage('');
    if (!navigator.geolocation) { setGpsMessage('Location access is unavailable in this browser. Enter coordinates manually.'); return; }
    navigator.geolocation.getCurrentPosition((position) => { const capturedAt = new Date().toISOString(); update('latitude', String(position.coords.latitude)); update('longitude', String(position.coords.longitude)); update('accuracy', String(Math.round(position.coords.accuracy))); update('gpsSource', 'GPS'); onLocationCaptured?.({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt }); setGpsMessage('Coordinates captured from this device. Review and confirm the location before saving.'); }, () => setGpsMessage('Location permission was not granted. Enter coordinates manually to continue.'), { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (form.step < 2) { update('step', form.step + 1); return; } if (!form.surveyDate || !form.units.length) { setError('Add a survey date and at least one proposed unit before submitting.'); return; } const missing = missingRequirementFields(catalogue, requirementPayload(form)); if (missing.length) { setError(`Complete mandatory requirements before submitting: ${missing.map(humanizeKey).join(', ')}`); return; } void save('SUBMITTED'); }

  if (readOnly) {
    const submittedSurveys = surveys.filter((survey) => !isDraftSurvey(survey));
    return <div className="site-survey-workspace">
      <div className="workflow-concluded-banner" role="status"><strong>Survey &amp; requirements are read-only</strong><span>This Lead journey stage is concluded. The submitted requirement snapshot is retained below for reference; editing and new revisions are disabled.</span></div>
      {submittedSurveys[0] ? <div className="site-survey-history-stack"><SubmittedSurveySnapshot survey={submittedSurveys[0]} label="Final survey & requirements" includeRequirements={false} finalRevision={requirementRevisions[0]} /></div> : requirementRevisions[0] ? <FinalRequirementDetails revision={requirementRevisions[0]} /> : <p className="site-survey-empty-detail">No submitted survey details are available for this lead.</p>}
    </div>;
  }

  return <div className="site-survey-workspace">
    {error && <ActionNotification kind="error" title="Survey action needs attention" onClose={() => setError('')}>{error}</ActionNotification>}
    {notice && <ActionNotification kind="success" title="Survey update saved" onClose={() => setNotice('')}>{notice}</ActionNotification>}
    {!active && <div className="site-survey-draft-toolbar"><div><strong>Survey &amp; requirements</strong><span>{latestSubmitted ? `Submitted revision ${latestSubmitted.attributes.revision} · ${latestSubmitted.attributes.status}` : latestRevision ? `Requirement revision ${latestRevision.attributes.revision_number || 'latest'} active` : 'No submitted survey yet'}</span></div><Button type="button" onClick={begin}>{latestSubmitted ? 'Edit & submit update' : latestRevision ? 'Start survey from saved requirements' : 'Start survey'}</Button></div>}
    {!active && activeSurveys.map((draft) => <div className="site-survey-draft-row" key={draft.id}><div><strong>Draft · {draft.attributes.survey_date || 'Date not set'}</strong><span>Revision {draft.attributes.revision} · saved {draft.attributes.created_at ? new Date(draft.attributes.created_at).toLocaleString() : 'recently'}</span></div><Button type="button" variant="secondary" onClick={() => resume(draft)}>Resume draft</Button></div>)}
    {!active && latestSubmitted && <SubmittedSurveySnapshot survey={latestSubmitted} label="Final survey & requirements" includeRequirements={false} finalRevision={requirementRevisions[0]} />}
    {!active && !latestSubmitted && requirementRevisions[0] && <FinalRequirementDetails revision={requirementRevisions[0]} />}
    {active && <form className="site-survey-wizard" onSubmit={submit}>
      <header><div><span className="eyebrow">Marketing · Site survey</span><h3>{record ? 'Resume survey draft' : latestSubmitted ? 'Update submitted survey' : 'New site survey'}</h3><p>{leadTitle}</p></div><Button type="button" variant="secondary" disabled={busy} onClick={() => setActive(false)}>Close</Button></header>
      {prefillNotice && <ActionFeedback kind="info"><span>{prefillNotice}</span></ActionFeedback>}
      <nav className="site-survey-stepper" aria-label="Survey steps">{steps.map((label, index) => <button key={label} type="button" aria-current={form.step === index ? 'step' : undefined} className={form.step === index ? 'current' : index < form.step ? 'complete' : ''} disabled={index > form.step} onClick={() => update('step', index)}><span>{index + 1}</span>{label}</button>)}</nav>
      <div className={`site-survey-step-content site-survey-step-${form.step}`}>
        {form.step === 0 && <>
          <section><h4>Survey setup</h4><p>The survey remains attached to its authorized marketing lead. A survey does not create a Customer or quotation recipient.</p><label>Lead<input readOnly value={leadTitle} /></label><label>Site visit date<input type="date" required value={form.surveyDate} onChange={(event) => update('surveyDate', event.target.value)} /></label><label>Building / site segment<select value={form.industrySegment} onChange={(event) => update('industrySegment', event.target.value)}><option value="">Select from catalogue</option>{optionsFor(catalogue, 'INDUSTRY_SEGMENT').map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label><label>Site address<textarea rows={3} value={form.siteAddress} onChange={(event) => update('siteAddress', event.target.value)} /></label><div className="site-survey-gps-grid"><label>Latitude<input inputMode="decimal" value={form.latitude} onChange={(event) => { update('latitude', event.target.value); update('gpsSource', 'MANUAL'); }} /></label><label>Longitude<input inputMode="decimal" value={form.longitude} onChange={(event) => { update('longitude', event.target.value); update('gpsSource', 'MANUAL'); }} /></label><label>Accuracy (m)<input type="number" min="0" value={form.accuracy} onChange={(event) => update('accuracy', event.target.value)} /></label></div><Button type="button" variant="secondary" onClick={captureGps}>Capture device location</Button><p role="status">{gpsMessage || `Location source: ${surveyGpsSource(form.gpsSource)}. Manual entry remains available if permission is denied.`}</p></section>
          <section><h4>Site contacts</h4><p>Capture contacts relevant to this site survey only. A contact is not automatically authorized to accept quotations.</p>{form.contacts.map((contact, index) => <div className="site-survey-contact" key={index}><label>Name<input value={contact.name} onChange={(event) => update('contacts', form.contacts.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /></label><label>Site role<input value={contact.role} onChange={(event) => update('contacts', form.contacts.map((item, i) => i === index ? { ...item, role: event.target.value } : item))} /></label><label>Contact reference<input value={contact.phone} onChange={(event) => update('contacts', form.contacts.map((item, i) => i === index ? { ...item, phone: event.target.value } : item))} /></label><Button type="button" variant="secondary" disabled={form.contacts.length === 1} onClick={() => update('contacts', form.contacts.filter((_, i) => i !== index))}>Remove</Button></div>)}<Button type="button" variant="secondary" onClick={() => update('contacts', [...form.contacts, { name: '', role: '', phone: '' }])}>Add site contact</Button></section>
          <section><h4>Referral and proposed units</h4><p>Referral details are attribution only; they do not create a Customer or receive quotations automatically.</p><label>Referrer name<input value={form.referralName} onChange={(event) => update('referralName', event.target.value)} /></label><label>Referrer contact reference<input value={form.referralContact} onChange={(event) => update('referralContact', event.target.value)} /></label>{form.units.map((unit, index) => <div className="site-survey-unit" key={index}><label>Unit label<input value={unit.label} onChange={(event) => update('units', form.units.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} /></label><label>Equipment type<select value={unit.type} onChange={(event) => update('units', form.units.map((item, i) => i === index ? { ...item, type: event.target.value } : item))}>{optionsFor(catalogue, 'EQUIPMENT_TYPE').map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label><label>Stops<input type="number" min="1" value={unit.stops} onChange={(event) => update('units', form.units.map((item, i) => i === index ? { ...item, stops: event.target.value } : item))} /></label><label>Capacity (kg)<input type="number" min="1" value={unit.capacity} onChange={(event) => update('units', form.units.map((item, i) => i === index ? { ...item, capacity: event.target.value } : item))} /></label><Button type="button" variant="secondary" disabled={form.units.length === 1} onClick={() => update('units', form.units.filter((_, i) => i !== index))}>Remove unit</Button></div>)}<Button type="button" variant="secondary" disabled={form.units.length >= 50} onClick={() => update('units', [...form.units, { label: `Unit ${form.units.length + 1}`, stops: '', capacity: '', type: 'PASSENGER_TRACTION' }])}>Add another unit</Button></section>
        </>}
        {form.step === 1 && <section><h4>Site measurements and shared requirements</h4><ActionFeedback kind="info"><span>Unit count, equipment type, stops, and capacity are captured once in the unit list on the Details step. This section records only shared site and technical requirements; per-unit differences remain attached to the selected unit.</span></ActionFeedback><div className="site-survey-technical-grid"><label>Shaft width (mm)<input type="number" min="1" value={form.shaftWidth} onChange={(event) => update('shaftWidth', event.target.value)} /></label><label>Shaft depth (mm)<input type="number" min="1" value={form.shaftDepth} onChange={(event) => update('shaftDepth', event.target.value)} /></label><label>Pit depth (mm)<input type="number" min="0" value={form.pitDepth} onChange={(event) => update('pitDepth', event.target.value)} /></label><label>Headroom (mm)<input type="number" min="0" value={form.headroom} onChange={(event) => update('headroom', event.target.value)} /></label><label>Industry / site segment<select value={form.industrySegment} onChange={(event) => update('industrySegment', event.target.value)}><option value="">Select from catalogue</option>{optionsFor(catalogue, 'INDUSTRY_SEGMENT').map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label><label>Application<select value={form.application} onChange={(event) => update('application', event.target.value)}><option value="">Select from catalogue</option>{optionsFor(catalogue, 'APPLICATION').map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label><label>Technology<select value={form.technology} onChange={(event) => update('technology', event.target.value)}><option value="">Select from catalogue</option>{optionsFor(catalogue, 'TECHNOLOGY').map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label><label>Drive type<select value={form.driveType} onChange={(event) => update('driveType', event.target.value)}><option value="">Select from catalogue</option>{optionsFor(catalogue, 'DRIVE_TYPE').map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label><label>Door configuration<select value={form.doorConfiguration} onChange={(event) => update('doorConfiguration', event.target.value)}><option value="">Select from catalogue</option>{optionsFor(catalogue, 'DOOR_CONFIGURATION').map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label><label>Door type<select value={form.doorType} onChange={(event) => update('doorType', event.target.value)}><option value="">Select from catalogue</option>{optionsFor(catalogue, 'DOOR_TYPE').map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label><label>Machine room<select value={form.machineRoom} onChange={(event) => update('machineRoom', event.target.value)}><option value="">Select from catalogue</option>{optionsFor(catalogue, 'MACHINE_ROOM').map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label><label>Control system<select value={form.controlSystem} onChange={(event) => update('controlSystem', event.target.value)}><option value="">Select from catalogue</option>{optionsFor(catalogue, 'CONTROL_SYSTEM').map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label><label>Finish<select value={form.finish} onChange={(event) => update('finish', event.target.value)}><option value="">Select from catalogue</option>{optionsFor(catalogue, 'FINISH').map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label><label>Speed band<select value={form.speedBand} onChange={(event) => update('speedBand', event.target.value)}><option value="">Select from catalogue</option>{optionsFor(catalogue, 'SPEED_BAND').map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label></div><div className="site-survey-choice-grid"><RequirementMultiChoice name="accessibility_features" title="Accessibility features" help="Select every accessibility feature required for the site." options={optionsFor(catalogue, 'ACCESSIBILITY_FEATURE')} value={form.accessibilityFeatures} onChange={(value) => update('accessibilityFeatures', value)} /><RequirementMultiChoice name="safety_features" title="Safety / emergency features" help="Select the safety and emergency functions to include in the technical scope." options={optionsFor(catalogue, 'SAFETY_FEATURE')} value={form.safetyFeatures} onChange={(value) => update('safetyFeatures', value)} /><RequirementMultiChoice name="standards_references" title="Standards references" help="Select the applicable reference standards; final compliance remains subject to authority review." options={optionsFor(catalogue, 'STANDARDS_REFERENCE')} value={form.standardsReferences} onChange={(value) => update('standardsReferences', value)} /></div><label>Access conditions / notes<textarea rows={3} value={form.accessNotes} onChange={(event) => update('accessNotes', event.target.value)} /></label></section>}
        {form.step === 2 && <section><h4>Review and authorize</h4><dl className="site-survey-summary"><dt>Lead</dt><dd>{leadTitle}</dd><dt>Survey date</dt><dd>{form.surveyDate || 'Not set'}</dd><dt>Address</dt><dd>{form.siteAddress || 'Not recorded'}</dd><dt>GPS</dt><dd>{form.latitude && form.longitude ? `${form.latitude}, ${form.longitude} · ${surveyGpsSource(form.gpsSource)}` : 'Not recorded'}</dd><dt>Contacts</dt><dd>{form.contacts.filter((item) => item.name || item.role || item.phone).length}</dd><dt>Referral</dt><dd>{form.referralName || 'Not recorded'}</dd><dt>Proposed units</dt><dd>{form.units.length}</dd><dt>Measurements</dt><dd>{form.shaftWidth || '—'} × {form.shaftDepth || '—'} mm</dd><dt>Evidence</dt><dd>Manage files in the shared Lead documents and photos section.</dd></dl><p>Submission freezes this survey revision. Further assessment should use a new survey record.</p></section>}
      </div>
      <footer><div>{form.step > 0 && <Button type="button" variant="secondary" disabled={busy} onClick={() => update('step', form.step - 1)}>Previous</Button>}<span>Step {form.step + 1} of {steps.length}</span></div><div>{form.step === 1 && <Button type="button" variant="secondary" busy={busy} disabled={busy} onClick={() => void saveRequirements()}>Save requirements</Button>}<Button type="button" variant="secondary" busy={busy} disabled={busy} onClick={() => void save('DRAFT')}>Save draft</Button>{form.step < 2 ? <Button type="submit" disabled={busy}>Continue</Button> : <Button type="submit" busy={busy} disabled={busy}>Submit survey</Button>}</div></footer>
    </form>}
  </div>;
}

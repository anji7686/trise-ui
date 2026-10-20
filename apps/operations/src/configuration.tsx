import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { operationsData, type Collection, type ConfigurationAudit, type ConfigurationImpact, type ConfigurationReview, type GenericAttributes, type Resource } from './data';
import { SearchableSelect, type LookupOption } from './searchable-select';
import { formatIndiaDateTime, indiaDateTimeToIso, localDateTime } from './subscription-support';

type T = (key: string) => string;

type FieldKind = 'text' | 'number' | 'boolean' | 'date' | 'select' | 'lines';
type Field = { key: string; label: string; kind?: FieldKind; required?: boolean; options?: string[]; lookup?: string };
type RepeatableField = { key: string; label: string; kind?: 'text' | 'number' | 'boolean' | 'select'; options?: string[] };
type RepeatableSchema = { fields: RepeatableField[]; empty: () => Record<string, unknown> };

const shortReference = (value: string) => value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
const configurationLabel = (value: string) => ({
  'business-operation-types': 'Business Operation Catalogue',
  'reference-data-imports': 'Reference Data Import',
  'provider-configuration-overrides': 'Provider Configuration Override'
}[value] || value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()));

export const CONFIGURATION_TYPES = [
  'asset-families', 'asset-types', 'asset-definitions', 'service-types', 'checklist-templates',
  'notification-triggers', 'notification-policies', 'notification-templates', 'skills',
  'certification-types', 'working-calendars', 'holiday-calendars', 'service-territories',
  'assignment-policies', 'asset-criticalities', 'service-priorities', 'emergency-rules',
  'sla-policies', 'identifier-policies', 'maintenance-policies'
] as const;

export const PLATFORM_CONFIGURATION_TYPES = [
  'asset-families', 'asset-types', 'asset-definitions', 'service-types', 'checklist-templates',
  'notification-triggers', 'notification-policies', 'notification-templates', 'skills',
  'certification-types', 'holiday-calendars', 'asset-criticalities', 'service-priorities',
  'sla-policies', 'identifier-policies', 'maintenance-policies'
] as const;

const common = (extra: Field[] = []): Field[] => [
  { key: 'code', label: 'Code', required: true },
  { key: 'name', label: 'Name', required: true },
  { key: 'effective_from', label: 'Effective from (India time)', kind: 'date', required: true },
  { key: 'effective_to', label: 'Effective to (India time)', kind: 'date' },
  ...extra
];

const FIELDS: Record<string, Field[]> = {
  'asset-families': common(),
  'asset-types': common([{ key: 'asset_family_id', label: 'Asset family', kind: 'select', lookup: 'asset-families', required: true }]),
  'asset-definitions': common([{ key: 'asset_type_id', label: 'Asset type', kind: 'select', lookup: 'asset-types', required: true }, { key: 'identifier_policy_id', label: 'Identifier policy', kind: 'select', lookup: 'identifier-policies' }, { key: 'primary_identifier_strategy', label: 'Primary identifier strategy' }, { key: 'technology', label: 'Technology', kind: 'select' }, { key: 'industry_segments', label: 'Applicable industries', kind: 'lines' }, { key: 'applications', label: 'Applications', kind: 'lines' }, { key: 'standards_references', label: 'Standards references', kind: 'lines' }, { key: 'safety_critical', label: 'Safety critical', kind: 'boolean', required: true }, { key: 'inspection_required', label: 'Inspection required', kind: 'boolean', required: true }, { key: 'maintenance_required', label: 'Maintenance required', kind: 'boolean', required: true }, { key: 'verification_required_before_use', label: 'Verification required before use', kind: 'boolean', required: true }, { key: 'attributes', label: 'Attributes', kind: 'lines' }, { key: 'components', label: 'Components', kind: 'lines' }]),
  'service-types': common([{ key: 'fulfilment_modes', label: 'Fulfilment modes (one per line)', kind: 'lines', required: true }, { key: 'category', label: 'Capability category' }]),
  'checklist-templates': common([{ key: 'items', label: 'Checklist items: key|label|required|type (one per line)', kind: 'lines', required: true }]),
  'notification-policies': common([{ key: 'event_type', label: 'Event type', required: true }, { key: 'category', label: 'Category', kind: 'select', options: ['TRANSACTIONAL', 'SERVICE', 'OPERATIONAL', 'MARKETING'], required: true }, { key: 'mandatory', label: 'Mandatory', kind: 'boolean', required: true }, { key: 'channels', label: 'Channels (one per line)', kind: 'lines', required: true }]),
  'notification-templates': common([{ key: 'policy_id', label: 'Notification policy', kind: 'select', lookup: 'notification-policies', required: true }, { key: 'channel', label: 'Channel', required: true }, { key: 'locale', label: 'Locale', required: true }, { key: 'subject', label: 'Subject' }, { key: 'body', label: 'Body', kind: 'lines', required: true }]),
  'notification-triggers': common([{ key: 'event_name', label: 'Event name', required: true }, { key: 'category', label: 'Category', kind: 'select', options: ['TRANSACTIONAL', 'SERVICE', 'OPERATIONAL', 'MARKETING'], required: true }, { key: 'policy_id', label: 'Notification policy', kind: 'select', lookup: 'notification-policies', required: true }, { key: 'template_id', label: 'Notification template', kind: 'select', lookup: 'notification-templates', required: true }, { key: 'enabled', label: 'Enabled', kind: 'boolean', required: true }]),
  skills: common([{ key: 'proficiency_levels', label: 'Proficiency levels (one per line)', kind: 'lines', required: true }, { key: 'verification_required', label: 'Verification required', kind: 'boolean', required: true }]),
  'certification-types': common([{ key: 'issuer', label: 'Issuer', required: true }, { key: 'verification_required', label: 'Verification required', kind: 'boolean', required: true }, { key: 'expiry_required', label: 'Expiry required', kind: 'boolean', required: true }]),
  'working-calendars': common([{ key: 'schedule', label: 'Schedule entries: weekday|start|end (one per line)', kind: 'lines', required: true }]),
  'holiday-calendars': common([{ key: 'holidays', label: 'Holidays: date|code|category|non_working (one per line)', kind: 'lines', required: true }]),
  'service-territories': common([{ key: 'kind', label: 'Scope kind', required: true }, { key: 'references', label: 'Scope references (one per line)', kind: 'lines' }]),
  'assignment-policies': common([{ key: 'mode', label: 'Mode', kind: 'select', options: ['MANUAL', 'ASSISTED', 'AUTOMATIC'], required: true }, { key: 'scope', label: 'Scope kind', required: true }, { key: 'precedence', label: 'Precedence', kind: 'number', required: true }, { key: 'rules', label: 'Rules: key|value (one per line)', kind: 'lines', required: true }, { key: 'capacity', label: 'Capacity: key|value (one per line)', kind: 'lines', required: true }, { key: 'fallback_mode', label: 'Fallback mode', kind: 'select', options: ['MANUAL', 'ASSISTED'], required: true }, { key: 'tie_break_reference', label: 'Tie-break reference', required: true }, { key: 'acceptance_required', label: 'Acceptance required', kind: 'boolean', required: true }, { key: 'proposal_hold_minutes', label: 'Proposal hold minutes', kind: 'number', required: true }, { key: 'acceptance_timeout_minutes', label: 'Acceptance timeout minutes', kind: 'number', required: true }]),
  'asset-criticalities': common([{ key: 'rank', label: 'Rank', kind: 'number', required: true }]),
  'service-priorities': common([{ key: 'rank', label: 'Rank', kind: 'number', required: true }, { key: 'description', label: 'Description', kind: 'lines' }, { key: 'sla_policy_id', label: 'SLA policy', kind: 'select', lookup: 'sla-policies' }, { key: 'assignment_policy_id', label: 'Assignment policy', kind: 'select', lookup: 'assignment-policies' }]),
  'emergency-rules': common([{ key: 'priority_id', label: 'Priority', kind: 'select', lookup: 'service-priorities', required: true }, { key: 'sla_policy_id', label: 'SLA policy', kind: 'select', lookup: 'sla-policies', required: true }, { key: 'escalation_policy_id', label: 'Escalation policy (no authorized lookup operation)', kind: 'select', lookup: 'escalation-policies', required: true }, { key: 'assignment_policy_id', label: 'Assignment policy', kind: 'select', lookup: 'assignment-policies', required: true }, { key: 'required_response', label: 'Required response', kind: 'lines' }]),
  'sla-policies': common([{ key: 'response_target_minutes', label: 'Response target minutes', kind: 'number' }, { key: 'assignment_target_minutes', label: 'Assignment target minutes', kind: 'number' }, { key: 'acceptance_target_minutes', label: 'Acceptance target minutes', kind: 'number' }, { key: 'dispatch_target_minutes', label: 'Dispatch target minutes', kind: 'number' }, { key: 'arrival_target_minutes', label: 'Arrival target minutes', kind: 'number' }, { key: 'work_start_target_minutes', label: 'Work-start target minutes', kind: 'number' }, { key: 'resolution_target_minutes', label: 'Resolution target minutes', kind: 'number' }, { key: 'business_hours_policy_reference', label: 'Business-hours policy reference', required: true }, { key: 'pause_resume_policy_reference', label: 'Pause/resume policy reference', required: true }]),
  'identifier-policies': [{ key: 'identifier_kind', label: 'Identifier kind', required: true }, { key: 'normalization_version', label: 'Normalization version', required: true }, { key: 'name', label: 'Name', required: true }, { key: 'strategy', label: 'Strategy', kind: 'select', options: ['PROVIDED', 'GENERATED', 'COMPOSITE', 'OPTIONAL'], required: true }, { key: 'effective_from', label: 'Effective from (India time)', kind: 'date', required: true }, { key: 'effective_to', label: 'Effective to (India time)', kind: 'date' }, { key: 'composite_fields', label: 'Composite fields (one per line)', kind: 'lines' }],
  'maintenance-policies': common([{ key: 'source', label: 'Policy source', required: true }, { key: 'recurrence_policy', label: 'Recurrence policy', kind: 'select', options: ['from_due', 'from_completion', 'explicit_schedule', 'none'], required: true }, { key: 'maintenance_rules', label: 'Rules: sequence|code|trigger_kind (one per line)', kind: 'lines', required: true }, { key: 'asset_definition_id', label: 'Asset definition', kind: 'select', lookup: 'asset-definitions' }])
};

const FIELD_OPTION_OVERRIDES: Record<string, Record<string, string[]>> = {
  'asset-definitions': { primary_identifier_strategy: ['PROVIDED', 'GENERATED', 'COMPOSITE', 'OPTIONAL'], technology: ['ELECTRIC_TRACTION', 'ELECTRIC_TRACTION_MRL', 'COMPACT_PASSENGER_LIFT', 'HYDRAULIC', 'HEAVY_DUTY_ELECTRIC_OR_HYDRAULIC', 'ELECTRIC_OR_HYDRAULIC', 'COMPACT_ELECTRIC_LIFT', 'ELECTRIC_RAIL_GUIDED', 'CONTINUOUS_STEP_CONVEYOR', 'CONTINUOUS_PALLET_CONVEYOR'] },
  'service-types': { category: ['INSTALLATION', 'REPAIR', 'PREVENTIVE_MAINTENANCE', 'INSPECTION', 'MODERNIZATION', 'EMERGENCY'] },
  'notification-templates': { channel: ['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP'], locale: ['en-IN'] },
  'service-territories': { kind: ['COUNTRY', 'STATE_UT', 'DISTRICT', 'CITY', 'PINCODE', 'CUSTOMER_ZONE'] },
  'assignment-policies': { tie_break_reference: ['SKILL_MATCH', 'NEAREST', 'LEAST_BUSY', 'ROUND_ROBIN'] },
  'maintenance-policies': { source: ['PLATFORM_CATALOGUE', 'MANUFACTURER', 'PROVIDER_POLICY', 'LEGAL_REQUIREMENT'] }
};

const REPEATABLE_SCHEMAS: Record<string, RepeatableSchema> = {
  attributes: { fields: [{ key: 'code', label: 'Code', kind: 'text' }, { key: 'label', label: 'Label', kind: 'text' }, { key: 'value_type', label: 'Value type', kind: 'select', options: ['STRING', 'NUMBER', 'BOOLEAN', 'DATE'] }, { key: 'unit_code', label: 'Unit', kind: 'select', options: ['', 'KG', 'MPS', 'M', 'COUNT'] }, { key: 'required', label: 'Required', kind: 'boolean' }], empty: () => ({ code: '', label: '', value_type: 'STRING', unit_code: '', required: true }) },
  components: { fields: [{ key: 'code', label: 'Code', kind: 'text' }, { key: 'position_kind', label: 'Position', kind: 'select', options: ['INTERNAL', 'EXTERNAL', 'MACHINE_ROOM', 'PIT', 'CAR_TOP'] }, { key: 'trackable', label: 'Trackable', kind: 'boolean' }, { key: 'replaceable', label: 'Replaceable', kind: 'boolean' }], empty: () => ({ code: '', position_kind: 'INTERNAL', trackable: true, replaceable: true }) },
  items: { fields: [{ key: 'key', label: 'Key', kind: 'text' }, { key: 'label', label: 'Label', kind: 'text' }, { key: 'type', label: 'Type', kind: 'select', options: ['BOOLEAN', 'TEXT', 'NUMBER', 'PHOTO', 'PASS_FAIL'] }, { key: 'required', label: 'Required', kind: 'boolean' }], empty: () => ({ key: '', label: '', type: 'BOOLEAN', required: true }) },
  schedule: { fields: [{ key: 'weekday', label: 'Weekday', kind: 'select', options: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }, { key: 'start', label: 'Start', kind: 'text' }, { key: 'end', label: 'End', kind: 'text' }], empty: () => ({ weekday: 'monday', start: '09:00', end: '18:00' }) },
  holidays: { fields: [{ key: 'date', label: 'Date', kind: 'text' }, { key: 'code', label: 'Code', kind: 'text' }, { key: 'category', label: 'Category', kind: 'select', options: ['PUBLIC', 'OPTIONAL', 'COMPANY'] }, { key: 'non_working', label: 'Non-working', kind: 'boolean' }], empty: () => ({ date: '', code: '', category: 'PUBLIC', non_working: true }) },
  rules: { fields: [{ key: 'name', label: 'Rule', kind: 'text' }, { key: 'value', label: 'Value', kind: 'text' }], empty: () => ({ name: '', value: '' }) },
  capacity: { fields: [{ key: 'name', label: 'Capacity metric', kind: 'text' }, { key: 'value', label: 'Limit', kind: 'number' }], empty: () => ({ name: '', value: '' }) },
  maintenance_rules: { fields: [{ key: 'sequence', label: 'Sequence', kind: 'number' }, { key: 'code', label: 'Rule code', kind: 'text' }, { key: 'trigger_kind', label: 'Trigger', kind: 'select', options: ['TIME', 'USAGE', 'EVENT', 'MANUAL'] }], empty: () => ({ sequence: 1, code: '', trigger_kind: 'TIME' }) }
};

const TOKEN_OPTIONS: Record<string, string[]> = {
  fulfilment_modes: ['INSTALLATION', 'REPAIR', 'PREVENTIVE_MAINTENANCE', 'INSPECTION', 'MODERNIZATION', 'BREAKDOWN'],
  channels: ['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP'],
  proficiency_levels: ['BASIC', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'],
  industry_segments: ['RESIDENTIAL', 'INDIVIDUAL_HOME', 'VILLA', 'COMMUNITY_MULTI_BLOCK', 'COMMERCIAL_OFFICE', 'COMMERCIAL_RETAIL', 'COMMERCIAL_HOSPITALITY', 'HEALTHCARE', 'INDUSTRIAL', 'WAREHOUSE_LOGISTICS', 'TRANSIT_PUBLIC', 'BUILDING_FACILITIES_VERTICAL_TRANSPORT'],
  applications: ['PASSENGER_TRANSPORT', 'BUILDING_VERTICAL_TRANSPORT', 'SPACE_EFFICIENT_INSTALLATION', 'PRIVATE_HOME_PRIVATE_VILLA_LOW_RISE', 'LOW_RISE_PASSENGER_TRANSPORT', 'LIMITED_HEADROOM', 'STAFF_SERVICE_GOODS_ASSISTED_TRANSPORT', 'BED_TRANSPORT', 'PATIENT_TRANSPORT', 'MEDICAL_EQUIPMENT_TRANSPORT', 'EMERGENCY_PATIENT_TRANSPORT', 'GOODS_TRANSPORT', 'OCCASIONAL_PASSENGER_TRANSPORT', 'PALLET_TRANSPORT', 'MATERIAL_HANDLING', 'FACTORY_LOGISTICS', 'VEHICLE_PARKING', 'VEHICLE_TRANSFER', 'SMALL_GOODS_FOOD_DOCUMENT_TRANSPORT', 'STEP_FREE_ACCESS', 'WHEELCHAIR_ACCESSIBILITY', 'STAIR_ACCESSIBILITY_PERSONAL_MOBILITY', 'FIRE_SERVICE_ACCESS_EMERGENCY_RESPONSE', 'PLANNED_EVACUATION_FIRE_LIFE_SAFETY', 'HIGH_VOLUME_PEOPLE_MOVEMENT_MULTI_LEVEL_PUBLIC_ACCESS', 'HORIZONTAL_OR_INCLINED_PEOPLE_MOVEMENT_AIRPORT_MALL_TRANSIT'],
  standards_references: ['IS 17900 (Part 1):2022', 'IS 17900 (Part 2):2022', 'IS 17900 (Part 3/Sec 1):2023', 'IS 17900 (Part 3/Sec 2):2025', 'IS 17900 (Part 4):2025', 'IS 17900 (Part 5):2026', 'IS 17900 (Part 6):2022', 'IS 17900 (Part 7/Sec 4):2025', 'IS 17900 (Part 7/Sec 6):2025', 'IS 17900 (Part 10):2025', 'IS 17900 (Part 11):2025', 'IS 15785:2007', 'IS 15259:2002', 'IS 14671:1999', 'IS 17900 (Part 20):2024', 'IS 4591 (Part 1/Sec 1):2020', 'IS 4591 (Part 1/Sec 2):2020', 'IS 4591 (Part 1/Sec 3):2020', 'IS 4591 (Part 2):2022', 'NBC India Part 8 Section 5']
};

function repeatableSchema(key: string): RepeatableSchema | undefined {
  return REPEATABLE_SCHEMAS[key];
}

function TokenOptions({ field, value, onChange, disabled }: { field: Field; value: string; onChange: (value: string) => void; disabled: boolean }) {
  const selected = new Set(value.split('\n').map((item) => item.trim()).filter(Boolean));
  const options = TOKEN_OPTIONS[field.key] || [];
  return <span className="configuration-token-options" aria-label={`${field.label} options`}>{options.map((option) => <label key={option}><input type="checkbox" checked={selected.has(option)} disabled={disabled} onChange={(event) => { const next = new Set(selected); if (event.target.checked) next.add(option); else next.delete(option); onChange(options.filter((candidate) => next.has(candidate)).join('\n')); }} /> {option.replaceAll('_', ' ')}</label>)}</span>;
}

function parseLines(key: string, value: string): unknown {
  if (/^[[{]/.test(value.trim())) {
    try {
      const parsed = JSON.parse(value);
      if (key === 'capacity' && Array.isArray(parsed)) return Object.fromEntries(parsed.map((row) => [row.name, row.value]));
      return parsed;
    } catch { /* fall through to the legacy line parser */ }
  }
  const lines = value.split('\n').map((line) => line.trim()).filter(Boolean);
  if (key === 'fulfilment_modes' || key === 'channels' || key === 'proficiency_levels' || key === 'references') return lines;
  if (key === 'body') return { body: lines.join('\n') };
  if (key === 'capacity') return Object.fromEntries(lines.map((line) => { const [name, value] = line.split('|'); return [name, value]; }));
  if (key === 'rules') return lines.map((line) => { const [name, value] = line.split('|'); return { name, value }; });
  if (key === 'attributes') return lines.map((line) => { const [code, label, value_type, required] = line.split('|'); return { code, label, value_type, required: required !== 'false' }; });
  if (key === 'components') return lines.map((line) => { const [code, position_kind, trackable, replaceable] = line.split('|'); return { code, position_kind, trackable: trackable === 'true', replaceable: replaceable === 'true' }; });
  if (key === 'schedule') return lines.map((line) => { const [weekday, start, end] = line.split('|'); return { weekday, start, end }; });
  if (key === 'holidays') return lines.map((line) => { const [date, code, category, non_working] = line.split('|'); return { date, code, category, non_working: non_working !== 'false' }; });
  if (key === 'items') return lines.map((line) => { const [itemKey, label, required, type] = line.split('|'); return { key: itemKey, label, required: required !== 'false', type: type || 'boolean' }; });
  if (key === 'maintenance_rules') return lines.map((line) => { const [sequence, code, trigger_kind] = line.split('|'); return { sequence: Number(sequence), code, trigger_kind }; });
  return lines;
}

function formatValue(field: Field, value: unknown): string {
  if (field.kind === 'date') return value ? localDateTime(new Date(String(value))) : '';
  if (field.kind === 'lines') {
    if (field.key === 'body' && value && typeof value === 'object') return String((value as { body?: unknown }).body || '');
    if (field.key === 'maintenance_rules' && Array.isArray(value)) return JSON.stringify(value);
    if (field.key === 'capacity' && value && typeof value === 'object' && !Array.isArray(value)) return JSON.stringify(Object.entries(value as Record<string, unknown>).map(([name, rowValue]) => ({ name, value: rowValue })));
    if (Array.isArray(value)) return repeatableSchema(field.key) ? JSON.stringify(value) : value.map((item) => typeof item === 'object' ? Object.values(item as Record<string, unknown>).join('|') : String(item)).join('\n');
  }
  return value == null ? '' : String(value);
}

function RepeatableRows({ field, value, onChange, disabled }: { field: Field; value: string; onChange: (value: string) => void; disabled: boolean }) {
  const schema = repeatableSchema(field.key);
  if (TOKEN_OPTIONS[field.key]) return <TokenOptions field={field} value={value} onChange={onChange} disabled={disabled} />;
  if (!schema) return <textarea required={field.required} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} rows={4} />;
  let rows: Record<string, unknown>[] = [];
  try { rows = JSON.parse(value || '[]'); if (!Array.isArray(rows)) rows = []; } catch { rows = []; }
  const update = (index: number, key: string, next: string | boolean) => onChange(JSON.stringify(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: next } : row)));
  return <div className="configuration-repeatable" aria-label={`${field.label} rows`}>
    {rows.map((row, index) => <div className="configuration-repeatable-row" key={`${field.key}-${index}`}>
      {schema.fields.map((rowField) => rowField.kind === 'boolean' ? <span className="configuration-radio-group" key={rowField.key}><span>{rowField.label}</span><label><input type="radio" name={`${field.key}-${index}-${rowField.key}`} checked={row[rowField.key] === true} disabled={disabled} onChange={() => update(index, rowField.key, true)} /> Yes</label><label><input type="radio" name={`${field.key}-${index}-${rowField.key}`} checked={row[rowField.key] === false} disabled={disabled} onChange={() => update(index, rowField.key, false)} /> No</label></span> : <label key={rowField.key}>{rowField.label}{rowField.kind === 'select' ? <select value={String(row[rowField.key] ?? '')} disabled={disabled} onChange={(event) => update(index, rowField.key, event.target.value)}>{rowField.options?.map((option) => <option value={option} key={option}>{option}</option>)}</select> : <input type={rowField.kind === 'number' ? 'number' : 'text'} value={String(row[rowField.key] ?? '')} disabled={disabled} onChange={(event) => update(index, rowField.key, rowField.kind === 'number' ? event.target.value : event.target.value)} />}</label>)}
      <Button type="button" variant="quiet" disabled={disabled} onClick={() => onChange(JSON.stringify(rows.filter((_, rowIndex) => rowIndex !== index)))}>Remove</Button>
    </div>)}
    <Button type="button" variant="secondary" disabled={disabled} onClick={() => onChange(JSON.stringify([...rows, schema.empty()]))}>Add row</Button>
  </div>;
}

export function ConfigurationReviewInbox({ platformCapabilities = [], currentUserId = '' }: { platformCapabilities?: string[]; currentUserId?: string }) {
  const [reviews, setReviews] = useState<ConfigurationReview[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REVOKED' | 'CONSUMED'>('PENDING');
  const canReview = platformCapabilities.includes('PLATFORM_CONFIGURATION_REVIEW');
  async function load() {
    setLoading(true);
    try { setError(''); setReviews((await operationsData.configurationReviewInbox(status)).data); } catch (cause) { setError((cause as { message?: string }).message || 'Configuration approval queue could not be loaded.'); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [status]);
  async function decide(review: ConfigurationReview, action: 'approve' | 'revoke') {
    setBusy(true); setError('');
    try {
      const attributes = review.attributes;
      if (attributes.configuration_type === 'business-operation-types') {
        const operationId = String((attributes as GenericAttributes & { business_operation_type_id?: string }).business_operation_type_id || '');
        if (!operationId) throw new Error('Business Operation review is missing its canonical operation ID.');
        if (action === 'approve') await operationsData.approvePlatformBusinessOperationReview(operationId, review.id, crypto.randomUUID());
        else await operationsData.revokePlatformBusinessOperationReview(operationId, review.id, 'Revoked from platform approval queue', crypto.randomUUID());
      } else if (attributes.configuration_type === 'reference-data-imports') {
        if (action === 'approve') await operationsData.approveReferenceDataImportReview(attributes.configuration_id, review.id, crypto.randomUUID());
        else await operationsData.revokeReferenceDataImportReview(attributes.configuration_id, review.id, 'Revoked from platform approval queue', crypto.randomUUID());
      } else if (attributes.configuration_type === 'provider-configuration-overrides') {
        const providerId = String(attributes.provider_id || attributes.configuration_id || '');
        if (!providerId) throw new Error('Provider override review is missing its provider ID.');
        if (action === 'approve') await operationsData.approvePlatformProviderConfigurationOverrideReview(providerId, review.id, crypto.randomUUID());
        else await operationsData.revokePlatformProviderConfigurationOverrideReview(providerId, review.id, 'Revoked from platform approval queue', crypto.randomUUID());
      } else if (action === 'approve') await operationsData.approveConfigurationReview('', attributes.configuration_type, attributes.configuration_id, review.id, crypto.randomUUID());
      else await operationsData.revokeConfigurationReview('', attributes.configuration_type, attributes.configuration_id, review.id, { reason: 'Revoked from platform approval queue' }, crypto.randomUUID());
      await load();
    } catch (cause) { setError((cause as { message?: string }).message || `Configuration review could not be ${action}d.`); } finally { setBusy(false); }
  }
  const tabs: Array<[typeof status, string]> = [['PENDING', 'Pending'], ['APPROVED', 'Approved'], ['REVOKED', 'Rejected'], ['CONSUMED', 'Published']];
  return <section className="platform-reference-page configuration-review-inbox"><div className="reference-breadcrumb"><span>Platform administration</span><span>›</span><strong>Approvals</strong></div><div className="reference-page-heading"><div><span className="reference-eyebrow">Platform administration / Governance</span><h1>Approval inbox</h1><p>Review configuration changes before they become available to providers. Global Administrators may self-approve when required; the action is recorded in the audit trail.</p></div><div className="reference-heading-actions"><select aria-label="Approval status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="PENDING">Pending review</option><option value="APPROVED">Approved</option><option value="REVOKED">Rejected</option><option value="CONSUMED">Published</option></select><select aria-label="Approval scope"><option>All scopes</option><option>Platform rules</option><option>Elevator &amp; Lift Services</option><option>Provider overrides</option></select></div></div><div className="reference-tabs">{tabs.map(([value, label]) => <button className={status === value ? 'active' : ''} type="button" key={value} onClick={() => setStatus(value)}>{label}</button>)}</div>{error && <p className="error" role="alert">{error}</p>}{loading ? <p className="notice">Loading configuration approvals…</p> : !reviews.length && !error ? <p className="notice">No {status.toLowerCase()} platform configuration reviews.</p> : <div className="reference-table-card"><div className="reference-table-scroll"><table className="reference-table"><caption className="sr-only">Configuration reviews</caption><thead><tr><th>Configuration</th><th>Candidate</th><th>Submitted</th><th>Reason</th><th>Actions</th></tr></thead><tbody>{reviews.map((review) => { const ownReview = Boolean(currentUserId) && review.attributes.submitted_by_user_id === currentUserId; const configurationId = String(review.attributes.configuration_id || ''); const openPath = review.attributes.configuration_type === 'business-operation-types' ? '#platform/business-operations' : review.attributes.configuration_type === 'reference-data-imports' ? '#platform/configuration/reference-data' : review.attributes.configuration_type === 'provider-configuration-overrides' ? `#platform/configuration/provider-overrides?provider_id=${encodeURIComponent(String(review.attributes.provider_id || configurationId))}` : `#platform/configuration/${review.attributes.configuration_type}`; return <tr key={review.id}><td><strong>{configurationLabel(review.attributes.configuration_type)}</strong><small>{configurationId ? <span title={configurationId}>Reference {shortReference(configurationId)}</span> : 'Reference not returned'}</small>{ownReview && <small>Self-approval will be recorded in the audit trail</small>}</td><td>Version {review.attributes.candidate_version} · Revision {review.attributes.candidate_revision}</td><td>{formatIndiaDateTime(review.attributes.submitted_at)}</td><td>{review.attributes.reason || 'No reason provided'}</td><td className="platform-form-actions"><Button variant="quiet" disabled={busy} onClick={() => { window.location.hash = openPath; }}>Open</Button>{status === 'PENDING' && canReview && <Button disabled={busy} title={ownReview ? 'Self-approval will be recorded in the audit trail.' : undefined} onClick={() => void decide(review, 'approve')}>Approve</Button>}{status === 'PENDING' && canReview && <Button variant="danger" disabled={busy} onClick={() => void decide(review, 'revoke')}>Revoke</Button>}</td></tr>; })}</tbody></table></div></div>}</section>;
}

export function ConfigurationAuditInbox() {
  const [audit, setAudit] = useState<ConfigurationAudit | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('ALL');
  async function load() {
    setLoading(true);
    try { setError(''); setAudit(await operationsData.configurationAuditInbox()); } catch (cause) { setError((cause as { message?: string }).message || 'Configuration audit history could not be loaded.'); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const rows = audit ? [...audit.audit.map((entry) => ({ id: `audit-${entry.id}`, timestamp: entry.occurred_at, label: entry.action, detail: `${entry.resource_kind} · ${entry.resource_id}`, kind: 'Audit' })), ...audit.events.map((entry) => ({ id: `event-${entry.id}`, timestamp: entry.occurred_at, label: entry.event_type, detail: `${entry.aggregate_type} · ${entry.aggregate_id}`, kind: 'Event' }))].sort((left, right) => String(right.timestamp || '').localeCompare(String(left.timestamp || ''))) : [];
  const filteredRows = rows.filter((row) => (!query.trim() || `${row.label} ${row.detail} ${row.kind}`.toLowerCase().includes(query.trim().toLowerCase())) && (action === 'ALL' || row.label.toLowerCase().includes(action.toLowerCase())));
  return <section className="platform-reference-page configuration-audit-inbox"><div className="reference-breadcrumb"><span>Platform administration</span><span>›</span><strong>Audit log</strong></div><div className="reference-page-heading"><div><span className="reference-eyebrow">Platform administration / Governance</span><h1>Configuration audit log</h1><p>Immutable configuration, review, publication, restore and reference-data events.</p></div><div className="reference-heading-actions"><label className="reference-search"><input aria-label="Search audit log" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search audit log..." /></label><select aria-label="Audit status" value={action} onChange={(event) => setAction(event.target.value)}><option value="ALL">All actions</option><option value="DRAFT">Draft</option><option value="APPROVED">Approved</option><option value="PUBLISHED">Published</option><option value="RESTORED">Restored</option></select></div></div><div className="reference-table-card"><div className="reference-table-scroll">{error && <p className="error" role="alert">{error}</p>}{loading ? <p className="notice">Loading configuration audit history…</p> : !error && !filteredRows.length ? <p className="notice">No platform configuration events match the selected filters.</p> : <table className="reference-table"><caption className="sr-only">Configuration audit history</caption><thead><tr><th>Event</th><th>Action</th><th>Resource</th><th>Occurred (India time)</th></tr></thead><tbody>{filteredRows.map((row) => <tr key={row.id}><td><Status>{row.kind}</Status></td><td><strong>{row.label}</strong></td><td>{row.detail}</td><td>{row.timestamp ? formatIndiaDateTime(row.timestamp) : 'Time unavailable'}</td></tr>)}</tbody></table>}</div></div></section>;
}

export function ConfigurationAdmin({ providerId, t, initialKind, platformOnly = false, platformCapabilities = [] }: { providerId: string; t: T; initialKind?: string; platformOnly?: boolean; platformCapabilities?: string[] }) {
  void t;
  const availableTypes: readonly string[] = platformOnly ? PLATFORM_CONFIGURATION_TYPES : CONFIGURATION_TYPES;
  const readOnly = platformOnly && !platformCapabilities.includes('PLATFORM_CONFIGURATION_WRITE');
  const canReview = !platformOnly || platformCapabilities.includes('PLATFORM_CONFIGURATION_REVIEW');
  const canPublish = !platformOnly || platformCapabilities.includes('PLATFORM_CONFIGURATION_PUBLISH');
  const [kind, setKind] = useState<string>(availableTypes.includes(initialKind || '') ? initialKind! : availableTypes[0]);
  const [items, setItems] = useState<Collection<GenericAttributes> | null>(null);
  const [selected, setSelected] = useState<Resource<GenericAttributes> | null>(null);
  const [lookups, setLookups] = useState<Record<string, Collection<GenericAttributes>>>({});
  const [lookupSearch, setLookupSearch] = useState<Record<string, string>>({});
  const [reviews, setReviews] = useState<Resource<GenericAttributes>[]>([]);
  const [audit, setAudit] = useState<ConfigurationAudit | null>(null);
  const [impact, setImpact] = useState<ConfigurationImpact['data']['attributes'] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [reviewId, setReviewId] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fields = (FIELDS[kind] || common()).map((field) => {
    const options = FIELD_OPTION_OVERRIDES[kind]?.[field.key];
    return options ? { ...field, kind: 'select' as const, options } : field;
  });
  const lookupTypes = useMemo(() => [...new Set(fields.flatMap((field) => field.lookup ? [field.lookup] : []))], [fields]);
  async function load() {
    setError(''); setSelected(null); setReviewId(''); setReviews([]); setAudit(null); setImpact(null);
    try { setItems(await operationsData.configuration(providerId, kind)); const loaded = await Promise.all(lookupTypes.map(async (type) => [type, await operationsData.configuration(providerId, type, 'ACTIVE')] as const)); setLookups(Object.fromEntries(loaded)); } catch (cause) { setError((cause as { message?: string }).message || 'Configuration records could not be loaded.'); }
  }
  useEffect(() => { void load(); }, [providerId, kind]);
  async function loadReviews(recordId: string) {
    try {
      const result = await operationsData.configurationReviews(providerId, kind, recordId);
      setReviews(result.data as Resource<GenericAttributes>[]);
      const current = result.data.find((review) => ['pending', 'approved'].includes(String(review.attributes.status).toLowerCase()));
      setReviewId(current?.id || '');
    } catch (cause) {
      setReviews([]);
      setError((cause as { message?: string }).message || 'Configuration reviews could not be loaded.');
    }
  }
  async function loadAudit(recordId: string) {
    try { setAudit(await operationsData.configurationAudit(providerId, kind, recordId)); } catch { setAudit(null); }
  }
  async function loadImpact(recordId: string) {
    try { setImpact((await operationsData.configurationImpact(providerId, kind, recordId)).data.attributes); } catch { setImpact(null); }
  }
  function select(record: Resource<GenericAttributes>) {
    setSelected(record); const definition = (record.attributes.definition || {}) as Record<string, unknown>; setValues(Object.fromEntries(fields.map((field) => [field.key, formatValue(field, definition[field.key])]))); setMessage(''); setError(''); void loadReviews(record.id); void loadAudit(record.id); void loadImpact(record.id);
  }
  function setValue(key: string, value: string) { setValues((current) => ({ ...current, [key]: value })); }
  function buildDefinition() {
    const original = selected?.attributes.definition && typeof selected.attributes.definition === 'object' ? selected.attributes.definition as Record<string, unknown> : {};
    const definition: Record<string, unknown> = kind === 'maintenance-policies' ? { ...original } : {};
    fields.filter((field) => values[field.key] !== undefined && values[field.key] !== '').forEach((field) => {
      const raw = values[field.key];
      if (kind === 'service-types' && ['fulfilment_modes', 'category'].includes(field.key)) {
        definition.metadata = { ...(definition.metadata as Record<string, unknown> || {}), [field.key]: field.kind === 'lines' ? parseLines(field.key, raw) : raw };
        return;
      }
      if (kind === 'notification-policies' && field.key === 'channels') {
        definition.channel_rules = { channels: parseLines(field.key, raw) };
        return;
      }
      if (kind === 'notification-templates' && field.key === 'body') {
        definition.content = parseLines(field.key, raw);
        return;
      }
      const outputKey = field.key === 'maintenance_rules' ? 'rules' : field.key;
      if (field.kind === 'number') definition[outputKey] = Number(raw);
      else if (field.kind === 'boolean') definition[outputKey] = raw === 'true';
      else if (field.kind === 'date') definition[outputKey] = indiaDateTimeToIso(raw);
      else if (field.key === 'maintenance_rules') {
        const previousRules = Array.isArray(original.rules) ? original.rules as Array<Record<string, unknown>> : [];
        const editedRules = parseLines(field.key, raw) as Array<{ sequence: number; code: string; trigger_kind: string }>;
        definition.rules = editedRules.map((rule, index) => ({ ...(previousRules.find((previous) => previous.code === rule.code) || previousRules[index]), ...rule }));
      }
      else if (field.kind === 'lines') definition[outputKey] = parseLines(field.key, raw);
      else definition[outputKey] = raw;
    });
    return definition;
  }
  async function save(event: FormEvent) { event.preventDefault(); setError(''); setMessage(''); try { const definition = buildDefinition(); const result = selected ? await operationsData.updateConfiguration(providerId, kind, selected.id, { definition, expected_revision: selected.attributes.revision }, crypto.randomUUID()) : await operationsData.createConfiguration(providerId, kind, { name: String(values.name || values.code || 'Draft configuration'), definition }, crypto.randomUUID()); setSelected(result); setValues(Object.fromEntries(fields.map((field) => [field.key, formatValue(field, (result.attributes.definition as Record<string, unknown> | undefined)?.[field.key])] ))); setMessage('Draft saved by the server'); await load(); } catch (cause) { setError((cause as { message?: string }).message || 'Draft could not be saved. Review the fields and retry.'); } }
  async function command(action: 'submit' | 'approve' | 'revoke' | 'activate' | 'archive' | 'restore') { if (!selected) return; setError(''); setMessage(''); try { let result: Resource<GenericAttributes> | undefined; if (action === 'submit') { result = await operationsData.submitConfigurationReview(providerId, kind, selected.id, { expected_revision: selected.attributes.revision, reason: reason || undefined }, crypto.randomUUID()); setReviewId(result.id); } else if (action === 'approve') result = await operationsData.approveConfigurationReview(providerId, kind, selected.id, reviewId, crypto.randomUUID()); else if (action === 'revoke') result = await operationsData.revokeConfigurationReview(providerId, kind, selected.id, reviewId, { reason: reason || 'Revoked from operations workspace' }, crypto.randomUUID()); else if (action === 'activate') result = await operationsData.activateConfiguration(providerId, kind, selected.id, { expected_revision: selected.attributes.revision, review_reference: reviewId }, crypto.randomUUID()); else if (action === 'restore') result = await operationsData.restoreConfiguration(providerId, kind, selected.id, { reason: reason || 'Restored from platform catalogue' }, crypto.randomUUID()); else result = await operationsData.archiveConfiguration(providerId, kind, selected.id, { expected_revision: selected.attributes.revision }, crypto.randomUUID()); setMessage(`Configuration ${action} request accepted by the server`); await load(); if (action !== 'submit' && result?.attributes?.kind) select(result); } catch (cause) { setError((cause as { message?: string }).message || `Configuration ${action} was rejected.`); } }
  const maintenancePolicy = kind === 'maintenance-policies';
  const selectedStatus = String(selected?.attributes.status || '').toLowerCase();
  const canDisable = !readOnly && selectedStatus !== 'archived' && impact?.can_archive === true;
  return <section className={`content configuration-admin${maintenancePolicy ? ' maintenance-policy-configuration' : ''}`}><div className="section-heading configuration-heading"><div><h2>{maintenancePolicy ? 'Preventive maintenance policies' : platformOnly ? 'Platform business catalogue' : 'Typed configuration administration'}</h2><p>{maintenancePolicy ? 'Versioned maintenance schedules. Only fields supported by the configuration API are editable here.' : platformOnly ? 'Platform-owned catalogue only. Providers can select published entries where supported; canonical rows cannot be edited from provider workspaces.' : 'Explicit adapters for the accepted registry; no executable or arbitrary JSON input.'}</p></div><label>Type<select aria-label="Configuration type" value={kind} onChange={(event) => setKind(event.target.value)}>{availableTypes.map((type) => <option value={type} key={type}>{type}</option>)}</select></label></div>{error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}<div className="configuration-layout"><div className="record-grid">{items?.data.map((item) => <button className="record-card" key={item.id} onClick={() => select(item)}><Status>{String(item.attributes.status)}</Status><strong>{String(item.attributes.name || item.attributes.kind || item.id)}</strong><small>Version {String(item.attributes.version)} · revision {String(item.attributes.revision)}</small></button>)}{items && items.data.length === 0 && <p className="notice">No records for this type. Create a draft with the typed form.</p>}</div><form className={`detail-card typed-form${maintenancePolicy ? ' maintenance-policy-editor' : ''}`} onSubmit={save}><h3>{selected ? 'Edit draft' : maintenancePolicy ? 'Create maintenance policy draft' : 'Create draft'}</h3>{maintenancePolicy && <p className="notice">Policy rules schedule maintenance due records; they do not imply job acceptance or customer entitlement.</p>}{fields.map((field) => field.kind === 'select' && field.lookup ? <SearchableSelect key={field.key} label={field.label} searchLabel={`Search ${field.label.toLowerCase()}`} search={lookupSearch[field.lookup] || ''} onSearch={(value) => setLookupSearch((current) => ({ ...current, [field.lookup!]: value }))} value={values[field.key] || ''} onChange={(value) => setValue(field.key, value)} options={(lookups[field.lookup]?.data || []).map((record): LookupOption => ({ id: record.id, label: String(record.attributes.name || record.attributes.code || record.id), detail: `v${String(record.attributes.version || '')}` }))} placeholder="Select an authorized record" required={field.required} disabled={readOnly} /> : <label key={field.key}>{field.label}{field.kind === 'select' ? <select required={field.required} disabled={readOnly} value={values[field.key] || ''} onChange={(event) => setValue(field.key, event.target.value)}><option value="">{field.options ? `Select ${field.label.toLowerCase()}` : 'Select an authorized record'}</option>{field.options?.map((option) => <option value={option} key={option}>{option}</option>)}</select> : field.kind === 'boolean' ? <span className="configuration-radio-group"><label><input type="radio" name={`${kind}-${field.key}`} required={field.required} disabled={readOnly} checked={values[field.key] === 'true'} onChange={() => setValue(field.key, 'true')} /> Yes</label><label><input type="radio" name={`${kind}-${field.key}`} required={field.required} disabled={readOnly} checked={values[field.key] === 'false'} onChange={() => setValue(field.key, 'false')} /> No</label></span> : field.kind === 'lines' ? <RepeatableRows field={field} value={values[field.key] || ''} onChange={(value) => setValue(field.key, value)} disabled={readOnly} /> : <input required={field.required} disabled={readOnly} type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'datetime-local' : 'text'} value={values[field.key] || ''} onChange={(event) => setValue(field.key, event.target.value)} />}</label>)}{!readOnly && <Button type="submit">{selected ? 'Save draft' : 'Create draft'}</Button>}{readOnly && <p className="notice">Read-only catalogue access. Draft and lifecycle changes require platform capability.</p>}{selected && <><div className="configuration-impact" aria-label="Configuration impact"><h4>Impact preview</h4>{impact ? <><p>{impact.total_dependents} dependent configuration(s), {impact.provider_adoptions} provider-scoped match(es).</p>{impact.warnings.length ? <ul>{impact.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p className="notice">No active dependency blocks archival.</p>}</> : <p className="notice">Impact preview unavailable.</p>}</div><div className="configuration-commands">{reviews.length ? <label>Review<select aria-label="Configuration review" value={reviewId} onChange={(event) => setReviewId(event.target.value)}>{reviews.map((review) => <option value={review.id} key={review.id}>{String(review.attributes.status)} · {review.id.slice(0, 8)} · revision {String(review.attributes.candidate_revision || '')}</option>)}</select></label> : <p className="notice">No review exists for this revision. Submit the draft for review first.</p>}<label>Review reason<input disabled={!canReview} aria-label="Review reason" placeholder="Optional reason or decision note" value={reason} onChange={(event) => setReason(event.target.value)} /> </label>{canReview && <Button type="button" onClick={() => void command('submit')}>Submit review</Button>}{canReview && <Button type="button" disabled={!reviewId} onClick={() => void command('approve')}>Approve review</Button>}{canReview && <Button type="button" disabled={!reviewId} onClick={() => void command('revoke')}>Revoke review</Button>}{canPublish && <Button type="button" disabled={!reviewId} onClick={() => void command('activate')}>Activate approved revision</Button>}{!readOnly && <Button type="button" disabled={!canDisable} onClick={() => void command('archive')}>Archive</Button>}</div>{audit && <section className="configuration-audit" aria-label="Configuration audit history"><h4>Change history</h4>{audit.audit.length ? audit.audit.slice(0, 20).map((entry) => <p key={entry.id}><Status>{entry.action}</Status> · {entry.occurred_at ? formatIndiaDateTime(entry.occurred_at) : 'Time unavailable'}</p>) : <p className="notice">No audit entries returned.</p>}</section>}</>}</form></div></section>;
}

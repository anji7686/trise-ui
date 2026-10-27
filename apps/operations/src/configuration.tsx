import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { operationsData, PLATFORM_PAGE_SIZE, type Collection, type ConfigurationAudit, type ConfigurationImpact, type ConfigurationReview, type GenericAttributes, type Resource } from './data';
import { SearchableSelect, type LookupOption } from './searchable-select';
import { OperationsDialog } from './operations-dialog';
import { formatIndiaDateTime, indiaDateTimeToIso, localDateTime } from './subscription-support';

type T = (key: string) => string;

function ConfigurationReturnBanner({ returnTo }: { returnTo?: string }) {
  if (!returnTo) return null;
  return <div className="configuration-return-banner" role="status"><div><strong>Provider setup in progress</strong><small>Resolve this requirement, then return to the selected provider’s readiness checklist.</small></div><Button type="button" variant="secondary" onClick={() => { window.location.hash = returnTo; }}>Back to provider setup</Button></div>;
}

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
const CONFIGURATION_TYPE_LABEL_OVERRIDES: Record<string, string> = {
  'asset-families': 'Asset families',
  'asset-types': 'Asset types',
  'asset-definitions': 'Asset definitions',
  'service-types': 'Service types',
  'checklist-templates': 'Checklist templates',
  'notification-triggers': 'Notification triggers',
  'notification-policies': 'Notification policies',
  'notification-templates': 'Notification templates',
  skills: 'Skills',
  'certification-types': 'Certification types',
  'working-calendars': 'Working calendars',
  'holiday-calendars': 'Holiday calendars',
  'service-territories': 'Service territories',
  'assignment-policies': 'Assignment policies',
  'asset-criticalities': 'Asset criticalities',
  'service-priorities': 'Service priorities',
  'emergency-rules': 'Emergency rules',
  'sla-policies': 'SLA policies',
  'identifier-policies': 'Identifier policies',
  'maintenance-policies': 'Maintenance policies'
};
const configurationTypeLabel = (value: string) => CONFIGURATION_TYPE_LABEL_OVERRIDES[value] || configurationLabel(value);

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

// Provider operators choose a business name. The API creates the stable
// technical identifier and keeps it immutable for integrations and audit.
const PROVIDER_GENERATED_CODE_TYPES = new Set([
  'asset-families', 'asset-types', 'asset-definitions', 'service-types', 'checklist-templates',
  'skills', 'certification-types', 'working-calendars', 'holiday-calendars', 'service-territories',
  'assignment-policies', 'asset-criticalities', 'service-priorities', 'emergency-rules',
  'sla-policies', 'maintenance-policies'
]);

export const CONFIGURATION_TYPE_GROUPS: Array<{ label: string; options: Array<{ value: string; label: string; description: string }> }> = [
  {
    label: 'Assets & service catalogue',
    options: [
      { value: 'asset-families', label: 'Asset families', description: 'Group related equipment and site assets.' },
      { value: 'asset-types', label: 'Asset types', description: 'Define the equipment categories providers can use.' },
      { value: 'asset-definitions', label: 'Asset definitions', description: 'Configure equipment attributes, identifiers and safety rules.' },
      { value: 'service-types', label: 'Service types', description: 'Define supported installation, repair and maintenance services.' },
      { value: 'checklist-templates', label: 'Checklist templates', description: 'Create reusable inspection and execution checklists.' },
    ],
  },
  {
    label: 'Communication & notifications',
    options: [
      { value: 'notification-triggers', label: 'Notification triggers', description: 'Define events that can start a notification.' },
      { value: 'notification-policies', label: 'Notification policies', description: 'Control recipients, channels and delivery behavior.' },
      { value: 'notification-templates', label: 'Notification templates', description: 'Manage reusable message content for platform events.' },
    ],
  },
  {
    label: 'Workforce & scheduling',
    options: [
      { value: 'skills', label: 'Skills', description: 'Maintain skills used for assignment and eligibility.' },
      { value: 'certification-types', label: 'Certification types', description: 'Maintain certifications required for authorized work.' },
      { value: 'working-calendars', label: 'Working calendars', description: 'Define working windows used by schedules and SLA timing.' },
      { value: 'holiday-calendars', label: 'Holiday calendars', description: 'Define non-working holidays for India operations.' },
      { value: 'assignment-policies', label: 'Assignment policies', description: 'Control how work is proposed and assigned.' },
    ],
  },
  {
    label: 'Governance & service controls',
    options: [
      { value: 'asset-criticalities', label: 'Asset criticalities', description: 'Set the impact ranking used for service decisions.' },
      { value: 'service-priorities', label: 'Service priorities', description: 'Define service urgency and linked response controls.' },
      { value: 'emergency-rules', label: 'Emergency rules', description: 'Route emergency work using priority, SLA and assignment rules.' },
      { value: 'sla-policies', label: 'SLA policies', description: 'Set response, assignment, dispatch and resolution targets.' },
      { value: 'identifier-policies', label: 'Identifier policies', description: 'Control how equipment and operational references are formed.' },
      { value: 'maintenance-policies', label: 'Maintenance policies', description: 'Schedule preventive maintenance due work.' },
      { value: 'service-territories', label: 'Service territories', description: 'Define operational areas used for provider coverage.' },
    ],
  },
];

const CONFIGURATION_TYPE_OPTIONS = CONFIGURATION_TYPE_GROUPS.flatMap((group) => group.options);
const configurationTypeDescription = (value: string) => CONFIGURATION_TYPE_OPTIONS.find((option) => option.value === value)?.description || 'Authoritative configuration managed through the approved lifecycle.';

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
  'emergency-rules': common([{ key: 'priority_id', label: 'Priority', kind: 'select', lookup: 'service-priorities', required: true }, { key: 'sla_policy_id', label: 'SLA policy', kind: 'select', lookup: 'sla-policies', required: true }, { key: 'escalation_policy_id', label: 'Escalation policy reference', required: true }, { key: 'assignment_policy_id', label: 'Assignment policy', kind: 'select', lookup: 'assignment-policies', required: true }, { key: 'required_response', label: 'Required response', kind: 'lines' }]),
  'sla-policies': common([{ key: 'response_target_minutes', label: 'Response target minutes', kind: 'number' }, { key: 'assignment_target_minutes', label: 'Assignment target minutes', kind: 'number' }, { key: 'acceptance_target_minutes', label: 'Acceptance target minutes', kind: 'number' }, { key: 'dispatch_target_minutes', label: 'Dispatch target minutes', kind: 'number' }, { key: 'arrival_target_minutes', label: 'Arrival target minutes', kind: 'number' }, { key: 'work_start_target_minutes', label: 'Work-start target minutes', kind: 'number' }, { key: 'resolution_target_minutes', label: 'Resolution target minutes', kind: 'number' }, { key: 'business_hours_policy_reference', label: 'Business-hours policy reference', required: true }, { key: 'pause_resume_policy_reference', label: 'Pause/resume policy reference', required: true }]),
  'identifier-policies': [{ key: 'identifier_kind', label: 'Identifier type', required: true }, { key: 'normalization_version', label: 'Normalization version', required: true }, { key: 'name', label: 'Name', required: true }, { key: 'strategy', label: 'Strategy', kind: 'select', options: ['PROVIDED', 'GENERATED', 'COMPOSITE', 'OPTIONAL'], required: true }, { key: 'effective_from', label: 'Effective from (India time)', kind: 'date', required: true }, { key: 'effective_to', label: 'Effective to (India time)', kind: 'date' }, { key: 'composite_fields', label: 'Composite fields (one per line)', kind: 'lines' }],
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

function configurationFieldValue(kind: string, field: Field, definition: Record<string, unknown>): unknown {
  if (kind === 'notification-policies' && field.key === 'channels') {
    return (definition.channel_rules as { channels?: unknown } | undefined)?.channels;
  }
  if (kind === 'notification-templates' && field.key === 'body') return definition.content;
  if (kind === 'service-types' && ['fulfilment_modes', 'category'].includes(field.key)) {
    return (definition.metadata as Record<string, unknown> | undefined)?.[field.key];
  }
  if (kind === 'maintenance-policies' && field.key === 'maintenance_rules') return definition.rules;
  return definition[field.key];
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
  const [page, setPage] = useState<{ next?: string | null; previous?: string | null }>({});
  const [cursor, setCursor] = useState<{ after?: string; before?: string }>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'REVOKED' | 'CONSUMED'>('PENDING');
  const canReview = platformCapabilities.includes('PLATFORM_CONFIGURATION_REVIEW');
  async function load() {
    setLoading(true);
    try { setError(''); const result = await operationsData.configurationReviewInbox(status, cursor); setReviews(result.data); setPage(result.page || {}); } catch (cause) { setError((cause as { message?: string }).message || 'Configuration approval queue could not be loaded.'); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [status, cursor]);
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
  return <section className="platform-reference-page configuration-review-inbox"><div className="reference-breadcrumb"><span>Platform administration</span><span>›</span><strong>Approvals</strong></div><div className="reference-page-heading"><div><span className="reference-eyebrow">Platform administration / Governance</span><h1>Approval inbox</h1><p>Review configuration changes before they become available to providers. Global Administrators may self-approve when required; the action is recorded in the audit trail.</p></div><div className="reference-heading-actions"><select aria-label="Approval status" value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setCursor({}); }}><option value="PENDING">Pending review</option><option value="APPROVED">Approved</option><option value="REVOKED">Rejected</option><option value="CONSUMED">Published</option></select><select aria-label="Approval scope"><option>All scopes</option><option>Platform rules</option><option>Elevator &amp; Lift Services</option><option>Provider overrides</option></select></div></div><div className="reference-tabs">{tabs.map(([value, label]) => <button className={status === value ? 'active' : ''} type="button" key={value} onClick={() => { setStatus(value); setCursor({}); }}>{label}</button>)}</div>{error && <p className="error" role="alert">{error}</p>}{loading ? <p className="notice">Loading configuration approvals…</p> : !reviews.length && !error ? <p className="notice">No {status.toLowerCase()} platform configuration reviews.</p> : <div className="reference-table-card"><div className="reference-table-scroll"><table className="reference-table"><caption className="sr-only">Configuration reviews</caption><thead><tr><th>Configuration</th><th>Candidate</th><th>Submitted</th><th>Reason</th><th>Actions</th></tr></thead><tbody>{reviews.map(review => { const ownReview = Boolean(currentUserId) && review.attributes.submitted_by_user_id === currentUserId; const configurationId = String(review.attributes.configuration_id || ''); const openPath = review.attributes.configuration_type === 'business-operation-types' ? '#platform/business-operations' : review.attributes.configuration_type === 'reference-data-imports' ? '#platform/configuration/reference-data' : review.attributes.configuration_type === 'provider-configuration-overrides' ? `#platform/configuration/provider-overrides?provider_id=${encodeURIComponent(String(review.attributes.provider_id || configurationId))}` : `#platform/configuration/${review.attributes.configuration_type}`; return <tr key={review.id}><td data-label="Configuration"><strong>{configurationLabel(review.attributes.configuration_type)}</strong><small>{configurationId ? <span title={configurationId}>Reference {shortReference(configurationId)}</span> : 'Reference not returned'}</small></td><td data-label="Candidate">Version {review.attributes.candidate_version} · Revision {review.attributes.candidate_revision}</td><td data-label="Submitted">{formatIndiaDateTime(review.attributes.submitted_at)}</td><td data-label="Reason">{review.attributes.reason || 'No reason provided'}</td><td data-label="Actions"><div className="configuration-review-row-actions"><Button variant="quiet" disabled={busy} onClick={() => { window.location.hash = openPath; }}>Open</Button>{status === 'PENDING' && canReview && <Button disabled={busy} title={ownReview ? 'Self-approval will be recorded in the audit trail.' : undefined} onClick={() => void decide(review, 'approve')}>Approve</Button>}{status === 'PENDING' && canReview && <Button variant="danger" disabled={busy} onClick={() => void decide(review, 'revoke')}>Revoke</Button>}</div></td></tr>; })}</tbody></table></div></div>}{!loading && !error && reviews.length > 0 && <div className="server-pagination" aria-label="Configuration approval pages"><span>Showing {reviews.length} records · {PLATFORM_PAGE_SIZE} per page</span><div><Button type="button" variant="secondary" disabled={!page.previous || loading} onClick={() => setCursor({ before: page.previous || undefined })}>Previous</Button><Button type="button" disabled={!page.next || loading} onClick={() => setCursor({ after: page.next || undefined })}>Next</Button></div></div>}</section>;
}

export function ConfigurationAuditInbox() {
  const [audit, setAudit] = useState<ConfigurationAudit | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('ALL');
  const [source, setSource] = useState<'ALL' | 'AUDIT' | 'EVENT'>('ALL');
  const [resourceKind, setResourceKind] = useState('ALL');
  const [filters, setFilters] = useState({ query: '', action: 'ALL', source: 'ALL' as 'ALL' | 'AUDIT' | 'EVENT', resourceKind: 'ALL' });
  const [cursor, setCursor] = useState<{ after?: string; before?: string }>({});
  async function load() {
    setLoading(true);
    try {
      setError('');
      setAudit(await operationsData.configurationAuditInbox({ q: filters.query, action: filters.action, source: filters.source, resourceKind: filters.resourceKind, ...cursor }));
    } catch (cause) { setError((cause as { message?: string }).message || 'Configuration audit history could not be loaded.'); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [filters, cursor]);
  const rows = audit?.data || [];
  const resourceLabel = (value: string) => value.replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (letter) => letter.toUpperCase());
  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCursor({});
    setFilters({ query: query.trim(), action, source, resourceKind });
  }
  function clearFilters() {
    setQuery(''); setAction('ALL'); setSource('ALL'); setResourceKind('ALL'); setCursor({});
    setFilters({ query: '', action: 'ALL', source: 'ALL', resourceKind: 'ALL' });
  }
  const resourceOptions = [
    ['ALL', 'All resource types'], ['ServiceType', 'Service type'], ['ChecklistDefinition', 'Checklist template'],
    ['SkillDefinition', 'Skill'], ['CertificationDefinition', 'Certification type'], ['WorkingCalendar', 'Working calendar'],
    ['HolidayCalendar', 'Holiday calendar'], ['AssignmentPolicy', 'Assignment policy'], ['AssetCriticalityDefinition', 'Asset criticality'],
    ['ServicePriority', 'Service priority'], ['SlaPolicy', 'SLA policy'], ['EmergencyRule', 'Emergency rule'],
    ['ConfigurationReview', 'Configuration review'], ['ReferenceDataImport', 'Reference-data import'], ['BusinessOperationType', 'Business operation'],
    ['BusinessOperationTypeDraft', 'Business operation draft']
  ];
  return <section className="platform-reference-page configuration-audit-inbox"><div className="reference-breadcrumb"><span>Platform administration</span><span>›</span><strong>Audit log</strong></div><div className="reference-page-heading"><div><span className="reference-eyebrow">Platform administration / Governance</span><h1>Configuration audit log</h1><p>Immutable configuration, review, publication, restore and reference-data events.</p></div></div><form className="reference-heading-actions configuration-audit-filters" onSubmit={applyFilters}><label className="reference-search"><input aria-label="Search audit log" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search event, action or resource…" /></label><label>Source<select aria-label="Filter audit log by source" value={source} onChange={(event) => setSource(event.target.value as typeof source)}><option value="ALL">Audit and events</option><option value="AUDIT">Audit records</option><option value="EVENT">Domain events</option></select></label><label>Action<select aria-label="Filter audit log by action" value={action} onChange={(event) => setAction(event.target.value)}><option value="ALL">All actions</option><option value="DRAFT">Draft changes</option><option value="APPROVED">Approvals</option><option value="PUBLISHED">Published</option><option value="RESTORED">Restored</option></select></label><label>Resource<select aria-label="Filter audit log by resource" value={resourceKind} onChange={(event) => setResourceKind(event.target.value)}>{resourceOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><Button type="submit">Apply filters</Button>{(query || action !== 'ALL' || source !== 'ALL' || resourceKind !== 'ALL') && <Button type="button" variant="quiet" onClick={clearFilters}>Clear</Button>}</form><div className="reference-table-card"><div className="reference-table-scroll">{error && <p className="error" role="alert">{error}</p>}{loading ? <p className="notice">Loading configuration audit history…</p> : !rows.length ? <p className="notice">No platform configuration events match the selected filters.</p> : <table className="reference-table"><caption className="sr-only">Configuration audit history</caption><thead><tr><th>Source</th><th>Action / event</th><th>Resource</th><th>Occurred (India time)</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><Status>{row.attributes.source === 'EVENT' ? 'Event' : 'Audit'}</Status></td><td><strong>{row.attributes.label}</strong></td><td><strong>{resourceLabel(row.attributes.resource_kind)}</strong><small>Configuration record</small></td><td>{row.attributes.occurred_at ? formatIndiaDateTime(row.attributes.occurred_at) : 'Time unavailable'}</td></tr>)}</tbody></table>}</div></div><div className="server-pagination" aria-label="Configuration audit pages"><span>Showing {rows.length} records · {PLATFORM_PAGE_SIZE} per page</span><div><Button type="button" variant="secondary" disabled={!audit?.page?.previous || loading} onClick={() => setCursor({ before: audit?.page?.previous || undefined })}>Previous</Button><Button type="button" disabled={!audit?.page?.next || loading} onClick={() => setCursor({ after: audit?.page?.next || undefined })}>Next</Button></div></div></section>;
}

export function ConfigurationAdmin({ providerId, t, initialKind, platformOnly = false, platformCapabilities = [] }: { providerId: string; t: T; initialKind?: string; platformOnly?: boolean; platformCapabilities?: string[] }) {
  void t;
  const returnTo = new URLSearchParams(window.location.hash.split('?')[1] || '').get('return_to') || undefined;
  const availableTypes: readonly string[] = platformOnly ? PLATFORM_CONFIGURATION_TYPES : CONFIGURATION_TYPES;
  const readOnly = platformOnly && !platformCapabilities.includes('PLATFORM_CONFIGURATION_WRITE');
  const canReview = !platformOnly || platformCapabilities.includes('PLATFORM_CONFIGURATION_REVIEW');
  const canPublish = !platformOnly || platformCapabilities.includes('PLATFORM_CONFIGURATION_PUBLISH');
  const [kind, setKind] = useState<string>(availableTypes.includes(initialKind || '') ? initialKind! : availableTypes[0]);
  const [items, setItems] = useState<Collection<GenericAttributes> | null>(null);
  const [configurationPage, setConfigurationPage] = useState<{ next?: string | null; previous?: string | null }>({});
  const [configurationCursor, setConfigurationCursor] = useState<{ after?: string; before?: string }>({});
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
  const loadSequence = useRef(0);
  // The shell keeps ConfigurationAdmin mounted while a child navigation item
  // changes the hash. Sync the route-selected catalogue into local state so
  // the page follows the clicked menu item instead of remaining on the first
  // catalogue loaded after login.
  useEffect(() => {
    const nextKind = availableTypes.includes(initialKind || '') ? initialKind! : availableTypes[0];
    if (nextKind === kind) return;
    setKind(nextKind);
    setItems(null);
    setConfigurationPage({});
    setConfigurationCursor({});
    setSelected(null);
    setReviewId('');
    setReviews([]);
    setAudit(null);
    setImpact(null);
    setValues({});
    setMessage('');
    setError('');
  }, [initialKind, platformOnly]);
  const fields = (FIELDS[kind] || common()).map((field) => {
    const options = FIELD_OPTION_OVERRIDES[kind]?.[field.key];
    return options ? { ...field, kind: 'select' as const, options } : field;
  }).filter((field) => field.key !== 'code')
    .filter((field) => !platformOnly || !field.lookup || availableTypes.includes(field.lookup));
  const providerGeneratedCode = !platformOnly && PROVIDER_GENERATED_CODE_TYPES.has(kind);
  const lookupTypes = useMemo(() => [...new Set(fields.flatMap((field) => field.lookup ? [field.lookup] : []))], [fields]);
  async function load(preserveSelection = false) {
    const sequence = ++loadSequence.current;
    setError('');
    if (!preserveSelection) { setSelected(null); setReviewId(''); setReviews([]); setAudit(null); setImpact(null); }
    try {
      const result = await operationsData.configuration(providerId, kind, undefined, configurationCursor);
      const loaded = await Promise.all(lookupTypes.map(async (type) => [type, await operationsData.configuration(providerId, type, 'ACTIVE')] as const));
      if (sequence !== loadSequence.current) return;
      setItems(result);
      setConfigurationPage(result.page || {});
      setLookups(Object.fromEntries(loaded));
    } catch (cause) {
      if (sequence === loadSequence.current) setError((cause as { message?: string }).message || 'Configuration records could not be loaded.');
    }
  }
  useEffect(() => { void load(); }, [providerId, kind, configurationCursor.after, configurationCursor.before]);
  async function loadReviews(recordId: string) {
    try {
      const result = await operationsData.configurationReviews(providerId, kind, recordId);
      setReviews(result.data as Resource<GenericAttributes>[]);
      const current = result.data.find((review) => ['pending', 'approved'].includes(String(review.attributes.status).toLowerCase()));
      setReviewId(current?.id || '');
    } catch (cause) {
      setReviews([]);
      const message = (cause as { message?: string }).message || '';
      if (!message.toLowerCase().includes('not found')) setError(message || 'Configuration reviews could not be loaded.');
    }
  }
  async function loadAudit(recordId: string) {
    try { setAudit(await operationsData.configurationAudit(providerId, kind, recordId)); } catch { setAudit(null); }
  }
  async function loadImpact(recordId: string) {
    try { setImpact((await operationsData.configurationImpact(providerId, kind, recordId)).data.attributes); } catch { setImpact(null); }
  }
  function select(record: Resource<GenericAttributes>) {
    setSelected(record); const definition = (record.attributes.definition || {}) as Record<string, unknown>; setValues(Object.fromEntries(fields.map((field) => [field.key, formatValue(field, configurationFieldValue(kind, field, definition))]))); setMessage(''); setError(''); void loadReviews(record.id); void loadAudit(record.id); void loadImpact(record.id);
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
  async function save(event: FormEvent): Promise<boolean> { event.preventDefault(); setError(''); setMessage(''); try { const definition = buildDefinition(); const result = selected ? await operationsData.updateConfiguration(providerId, kind, selected.id, { definition, expected_revision: selected.attributes.revision }, crypto.randomUUID()) : await operationsData.createConfiguration(providerId, kind, { name: String(values.name || values.code || 'Draft configuration'), definition }, crypto.randomUUID()); setSelected(result); setValues(Object.fromEntries(fields.map((field) => [field.key, formatValue(field, configurationFieldValue(kind, field, (result.attributes.definition || {}) as Record<string, unknown>))]))); setMessage('Configuration draft saved.'); await load(true); return true; } catch (cause) { setError((cause as { message?: string }).message || 'Draft could not be saved. Review the fields and retry.'); return false; } }
  async function command(action: 'submit' | 'approve' | 'revoke' | 'activate' | 'archive' | 'restore') { if (!selected) return; setError(''); setMessage(''); try { let result: Resource<GenericAttributes> | undefined; if (action === 'submit') { result = await operationsData.submitConfigurationReview(providerId, kind, selected.id, { expected_revision: selected.attributes.revision, reason: reason || undefined }, crypto.randomUUID()); setReviewId(result.id); } else if (action === 'approve') result = await operationsData.approveConfigurationReview(providerId, kind, selected.id, reviewId, crypto.randomUUID()); else if (action === 'revoke') result = await operationsData.revokeConfigurationReview(providerId, kind, selected.id, reviewId, { reason: reason || 'Revoked from operations workspace' }, crypto.randomUUID()); else if (action === 'activate') result = await operationsData.activateConfiguration(providerId, kind, selected.id, { expected_revision: selected.attributes.revision, review_reference: reviewId }, crypto.randomUUID()); else if (action === 'restore') result = await operationsData.restoreConfiguration(providerId, kind, selected.id, { reason: reason || 'Restored from platform catalogue' }, crypto.randomUUID()); else result = await operationsData.archiveConfiguration(providerId, kind, selected.id, { expected_revision: selected.attributes.revision }, crypto.randomUUID()); setMessage(`Configuration ${action.replaceAll('_', ' ').toLowerCase()} completed.`); await load(true); if (action === 'submit') await loadReviews(selected.id); else { const refreshed = await operationsData.configurationDetail(providerId, kind, selected.id); select(refreshed); } } catch (cause) { setError((cause as { message?: string }).message || `Configuration ${action} was rejected.`); } }
  const maintenancePolicy = kind === 'maintenance-policies';
  const selectedStatus = String(selected?.attributes.status || '').toLowerCase();
  const canDisable = !readOnly && selectedStatus !== 'archived' && impact?.can_archive === true;
  function newDraft() {
    setSelected(null); setReviewId(''); setReason(''); setValues(Object.fromEntries(fields.map((field) => [field.key, '']))); setMessage(''); setError('');
  }
  function newRevision() {
    if (!selected) return;
    setSelected(null);
    setReviewId('');
    setReviews([]);
    setAudit(null);
    setImpact(null);
    setReason('');
    setMessage('');
    setError('');
  }
  if (kind === 'notification-policies') return <><ConfigurationReturnBanner returnTo={returnTo} /><NotificationPolicyWorkspace
    availableTypes={availableTypes}
    kind={kind}
    onKindChange={(nextKind) => { setKind(nextKind); setConfigurationCursor({}); }}
    platformOnly={platformOnly}
    readOnly={readOnly}
    canReview={canReview}
    canPublish={canPublish}
    canDisable={canDisable}
    items={items}
    selected={selected}
    values={values}
    setValue={setValue}
    select={select}
    newDraft={newDraft}
    save={save}
    reviews={reviews}
    reviewId={reviewId}
    setReviewId={setReviewId}
    reason={reason}
    setReason={setReason}
    command={command}
    impact={impact}
    audit={audit}
    error={error}
    message={message}
  /></>;
  return <><ConfigurationReturnBanner returnTo={returnTo} /><ConfigurationCatalogueWorkspace
    key={kind}
    kind={kind}
    availableTypes={availableTypes}
    platformOnly={platformOnly}
    providerGeneratedCode={providerGeneratedCode}
    maintenancePolicy={maintenancePolicy}
    readOnly={readOnly}
    canReview={canReview}
    canPublish={canPublish}
    canDisable={canDisable}
    items={items}
    selected={selected}
    fields={fields}
    values={values}
    lookups={lookups}
    lookupSearch={lookupSearch}
    reviews={reviews}
    reviewId={reviewId}
    reason={reason}
    impact={impact}
    audit={audit}
    error={error}
    message={message}
    configurationPage={configurationPage}
    onKindChange={(nextKind) => { setKind(nextKind); setConfigurationCursor({}); }}
    onLookupSearchChange={(fieldKey, value) => setLookupSearch((current) => ({ ...current, [fieldKey]: value }))}
    onValueChange={setValue}
    onSelect={select}
    onNewDraft={newDraft}
    onNewRevision={newRevision}
    onSave={save}
    onCommand={command}
    onReviewChange={setReviewId}
    onReasonChange={setReason}
    onPageChange={setConfigurationCursor}
  /></>;
}

type ConfigurationDialogMode = 'view' | 'edit' | 'new';

function configurationDisplayLabel(value: unknown): string {
  return String(value || 'Not set').replaceAll('_', ' ').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function configurationEffectiveDates(record: Resource<GenericAttributes>): string {
  const definition = record.attributes.definition && typeof record.attributes.definition === 'object' ? record.attributes.definition as Record<string, unknown> : {};
  const from = definition.effective_from ? String(definition.effective_from) : '';
  const to = definition.effective_to ? String(definition.effective_to) : '';
  if (!from && !to) return 'Effective date not set';
  const formatDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : formatIndiaDateTime(date.toISOString());
  };
  return `${from ? formatDate(from) : 'Open'} → ${to ? formatDate(to) : 'Open'}`;
}

function ConfigurationStructuredValue({ value }: { value: string }) {
  const text = value.trim();
  if (!text) return <span className="configuration-view-empty">Not configured</span>;
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { parsed = undefined; }
  if (Array.isArray(parsed)) {
    return <div className="configuration-view-chips">{parsed.map((item, index) => <span className="configuration-view-chip" key={`${index}-${String(item)}`}>{typeof item === 'object' && item !== null ? Object.entries(item as Record<string, unknown>).map(([key, entry]) => `${configurationDisplayLabel(key)}: ${String(entry)}`).join(' · ') : configurationDisplayLabel(item)}</span>)}</div>;
  }
  if (parsed && typeof parsed === 'object') {
    return <div className="configuration-view-chips">{Object.entries(parsed as Record<string, unknown>).map(([key, entry]) => <span className="configuration-view-chip" key={key}>{configurationDisplayLabel(key)}: {String(entry)}</span>)}</div>;
  }
  return <span>{text.split('\n').filter(Boolean).map(configurationDisplayLabel).join(' · ')}</span>;
}

function ConfigurationValueView({ field, value, lookups }: { field: Field; value: string; lookups: Record<string, Collection<GenericAttributes>> }) {
  if (field.lookup) {
    const record = lookups[field.lookup]?.data.find((item) => item.id === value);
    return <span>{record ? String(record.attributes.name || record.attributes.code || record.id) : value || 'Not selected'}</span>;
  }
  if (field.kind === 'boolean') return <Status>{value === 'true' ? 'Enabled' : value === 'false' ? 'Disabled' : 'Not set'}</Status>;
  if (field.kind === 'lines') return <ConfigurationStructuredValue value={value} />;
  if (field.kind === 'select') return <span>{value ? configurationDisplayLabel(value) : 'Not selected'}</span>;
  if (field.kind === 'date' && value) {
    const date = new Date(value);
    return <span>{Number.isNaN(date.getTime()) ? value : formatIndiaDateTime(date.toISOString())}</span>;
  }
  return <span>{value || 'Not set'}</span>;
}

type ConfigurationCatalogueWorkspaceProps = {
  kind: string;
  availableTypes: readonly string[];
  platformOnly: boolean;
  providerGeneratedCode: boolean;
  maintenancePolicy: boolean;
  readOnly: boolean;
  canReview: boolean;
  canPublish: boolean;
  canDisable: boolean;
  items: Collection<GenericAttributes> | null;
  selected: Resource<GenericAttributes> | null;
  fields: Field[];
  values: Record<string, string>;
  lookups: Record<string, Collection<GenericAttributes>>;
  lookupSearch: Record<string, string>;
  reviews: Resource<GenericAttributes>[];
  reviewId: string;
  reason: string;
  impact: ConfigurationImpact['data']['attributes'] | null;
  audit: ConfigurationAudit | null;
  error: string;
  message: string;
  configurationPage: { next?: string | null; previous?: string | null };
  onKindChange: (value: string) => void;
  onLookupSearchChange: (key: string, value: string) => void;
  onValueChange: (key: string, value: string) => void;
  onSelect: (record: Resource<GenericAttributes>) => void;
  onNewDraft: () => void;
  onNewRevision: () => void;
  onSave: (event: FormEvent) => Promise<boolean>;
  onCommand: (action: 'submit' | 'approve' | 'revoke' | 'activate' | 'archive' | 'restore') => Promise<void>;
  onReviewChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onPageChange: (cursor: { after?: string; before?: string }) => void;
};

function ConfigurationGovernancePanel({ selected, readOnly, canReview, canPublish, canDisable, reviews, reviewId, reason, impact, audit, onReviewChange, onReasonChange, onCommand }: Pick<ConfigurationCatalogueWorkspaceProps, 'selected' | 'readOnly' | 'canReview' | 'canPublish' | 'canDisable' | 'reviews' | 'reviewId' | 'reason' | 'impact' | 'audit' | 'onReviewChange' | 'onReasonChange' | 'onCommand'>) {
  if (!selected) return null;
  const configurationStatus = String(selected.attributes.status || 'DRAFT').toUpperCase();
  const reviewStatus = String(reviews.find((review) => review.id === reviewId)?.attributes.status || '').toUpperCase();
  const canSubmit = canReview && configurationStatus === 'DRAFT' && !['PENDING', 'APPROVED'].includes(reviewStatus);
  const canApprove = canReview && reviewStatus === 'PENDING';
  const canReject = canReview && ['PENDING', 'APPROVED'].includes(reviewStatus);
  const canEnable = canPublish && configurationStatus === 'DRAFT' && reviewStatus === 'APPROVED';
  return <section className="configuration-governance-panel" aria-label="Configuration lifecycle controls">
    <div className="configuration-dialog-section-heading"><div><span className="section-kicker">Governance</span><h3>Review, enable &amp; disable</h3></div><Status>{String(selected.attributes.status || 'DRAFT')}</Status></div>
    <p className="configuration-dialog-muted">Changes remain versioned. Submit a draft for review, enable an approved revision, or disable it after the dependency check.</p>
    <div className="configuration-impact" aria-label="Configuration impact"><h4>Impact preview</h4>{impact ? <><p>{impact.total_dependents} dependent configuration(s) · {impact.provider_adoptions} provider-scoped match(es).</p>{impact.warnings.length ? <ul>{impact.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p className="notice">No active dependency blocks were returned.</p>}</> : <p className="notice">Impact preview is loading or unavailable.</p>}</div>
    <div className="configuration-governance-grid">
      {reviews.length ? <label>Review revision<select aria-label="Configuration review" value={reviewId} onChange={(event) => onReviewChange(event.target.value)}>{reviews.map((review) => <option value={review.id} key={review.id}>{configurationDisplayLabel(review.attributes.status)} · Revision {String(review.attributes.candidate_revision || '—')}</option>)}</select></label> : <p className="notice">No review exists for this revision. Submit the draft for review first.</p>}
      <label>Decision note<input disabled={!canReview} aria-label="Review reason" placeholder="Optional reason or decision note" value={reason} onChange={(event) => onReasonChange(event.target.value)} /></label>
    </div>
    <div className="configuration-governance-actions">
      {canSubmit && <Button type="button" variant="secondary" onClick={() => void onCommand('submit')}>Submit for review</Button>}
      {canApprove && <Button type="button" onClick={() => void onCommand('approve')}>Approve revision</Button>}
      {canReject && <Button type="button" variant="danger" onClick={() => void onCommand('revoke')}>Reject review</Button>}
      {canEnable && <Button type="button" onClick={() => void onCommand('activate')}>Enable approved revision</Button>}
      {!readOnly && configurationStatus !== 'ARCHIVED' && <Button type="button" variant="danger" disabled={!canDisable} title={canDisable ? 'Disable this configuration' : 'Resolve active dependencies before disabling'} onClick={() => void onCommand('archive')}>Disable</Button>}
    </div>
    <details className="configuration-audit"><summary>View change history</summary>{audit?.audit.length ? <div>{audit.audit.slice(0, 20).map((entry) => <p key={entry.id}><Status>{entry.action}</Status><span>{entry.occurred_at ? formatIndiaDateTime(entry.occurred_at) : 'Time unavailable'}</span></p>)}</div> : <p className="notice">No audit entries returned.</p>}</details>
  </section>;
}

function ConfigurationCatalogueWorkspace({ kind, availableTypes, platformOnly, providerGeneratedCode, maintenancePolicy, readOnly, canReview, canPublish, canDisable, items, selected, fields, values, lookups, lookupSearch, reviews, reviewId, reason, impact, audit, error, message, configurationPage, onKindChange, onLookupSearchChange, onValueChange, onSelect, onNewDraft, onNewRevision, onSave, onCommand, onReviewChange, onReasonChange, onPageChange }: ConfigurationCatalogueWorkspaceProps) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dialogMode, setDialogMode] = useState<ConfigurationDialogMode | null>(null);
  const records = items?.data || [];
  const filteredRecords = records.filter((record) => {
    const definition = record.attributes.definition && typeof record.attributes.definition === 'object' ? record.attributes.definition as Record<string, unknown> : {};
    const searchText = [record.attributes.name, record.attributes.code, definition.category, definition.description].map((value) => String(value || '')).join(' ').toLowerCase();
    return (!query.trim() || searchText.includes(query.trim().toLowerCase())) && (statusFilter === 'ALL' || String(record.attributes.status || '').toUpperCase() === statusFilter);
  });
  const openRecord = (mode: ConfigurationDialogMode, record: Resource<GenericAttributes>) => { onSelect(record); setDialogMode(mode); };
  const openNew = () => { onNewDraft(); setDialogMode('new'); };
  const openNewRevision = () => { onNewRevision(); setDialogMode('new'); };
  const submit = async (event: FormEvent) => { if (await onSave(event)) setDialogMode('edit'); };
  const selectedDefinition = selected?.attributes.definition && typeof selected.attributes.definition === 'object' ? selected.attributes.definition as Record<string, unknown> : {};
  const selectedName = String(selected?.attributes.name || selectedDefinition.name || selectedDefinition.code || configurationTypeLabel(kind));
  const selectedCode = String(selectedDefinition.code || 'Generated by server');
  const selectedLifecycleStatus = String(selected?.attributes.status || 'DRAFT').toUpperCase();
  const editingAllowed = !readOnly && (!selected || selectedLifecycleStatus === 'DRAFT');
  const description = maintenancePolicy ? 'Versioned maintenance schedules used to create preventive maintenance due work.' : platformOnly ? 'Manage global catalogue definitions. Providers can read and adopt published entries but cannot edit canonical platform rows.' : 'Use approved master data to keep provider operations consistent and auditable.';
  const renderEditorField = (field: Field) => {
    if (field.kind === 'select' && field.lookup) return <SearchableSelect key={field.key} label={field.label} searchLabel={`Search ${field.label.toLowerCase()}`} search={lookupSearch[field.lookup] || ''} onSearch={(value) => onLookupSearchChange(field.lookup!, value)} value={values[field.key] || ''} onChange={(value) => onValueChange(field.key, value)} options={(lookups[field.lookup]?.data || []).map((record): LookupOption => ({ id: record.id, label: String(record.attributes.name || record.attributes.code || record.id), detail: `v${String(record.attributes.version || '')}` }))} placeholder="Search and select an authorized record" required={field.required} disabled={!editingAllowed} />;
    if (field.kind === 'boolean') return <fieldset className="configuration-choice-field" key={field.key}><legend>{field.label}</legend><div className="configuration-radio-group"><label><input type="radio" name={`${kind}-${field.key}`} required={field.required} disabled={!editingAllowed} checked={values[field.key] === 'true'} onChange={() => onValueChange(field.key, 'true')} /> Enabled / Yes</label><label><input type="radio" name={`${kind}-${field.key}`} required={field.required} disabled={!editingAllowed} checked={values[field.key] === 'false'} onChange={() => onValueChange(field.key, 'false')} /> Disabled / No</label></div></fieldset>;
    return <label key={field.key}><span>{field.label}</span>{field.kind === 'select' ? <select required={field.required} disabled={!editingAllowed} value={values[field.key] || ''} onChange={(event) => onValueChange(field.key, event.target.value)}><option value="">{field.options ? `Select ${field.label.toLowerCase()}` : 'Select an authorized record'}</option>{field.options?.map((option) => <option value={option} key={option}>{configurationDisplayLabel(option)}</option>)}</select> : field.kind === 'lines' ? <RepeatableRows field={field} value={values[field.key] || ''} onChange={(value) => onValueChange(field.key, value)} disabled={!editingAllowed} /> : <input required={field.required} disabled={!editingAllowed} type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'datetime-local' : 'text'} value={values[field.key] || ''} onInput={(event) => onValueChange(field.key, event.currentTarget.value)} onChange={(event) => onValueChange(field.key, event.target.value)} />}</label>;
  };
  return <section className={`content configuration-admin configuration-admin-modern${maintenancePolicy ? ' maintenance-policy-configuration' : ''}`}>
    <header className="configuration-catalogue-hero"><div><span className="page-eyebrow">{platformOnly ? 'Platform administration' : 'Provider configuration · Master data'}</span><h1>{maintenancePolicy ? 'Preventive maintenance policies' : platformOnly ? 'Business configuration' : configurationTypeLabel(kind)}</h1><p>{platformOnly ? description : configurationTypeDescription(kind)}</p></div>{platformOnly && <div className="configuration-catalogue-actions"><label className="configuration-type-selector"><span>Configuration area</span><select aria-label="Configuration type" value={kind} onChange={(event) => { setDialogMode(null); onKindChange(event.target.value); }}>{CONFIGURATION_TYPE_GROUPS.map((group) => <optgroup label={group.label} key={group.label}>{group.options.filter((option) => availableTypes.includes(option.value)).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</optgroup>)}</select><small>{configurationTypeDescription(kind)}</small></label></div>}</header>
    {error && <p className="error configuration-feedback" role="alert">{error}</p>}{message && <p className="success configuration-feedback" role="status">{message}</p>}
    <div className="configuration-catalogue-toolbar"><label className="configuration-catalogue-search"><span className="sr-only">Search {configurationTypeLabel(kind)}</span><input aria-label={`Search ${configurationTypeLabel(kind)}`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${configurationTypeLabel(kind).toLowerCase()}…`} /></label><label><span className="sr-only">Filter by status</span><select aria-label="Filter configuration status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Enabled</option><option value="DRAFT">Draft</option><option value="ARCHIVED">Disabled</option></select></label><span className="configuration-catalogue-result-count">{filteredRecords.length} {filteredRecords.length === 1 ? 'record' : 'records'}</span></div>
    <section className="configuration-catalogue-list-card" aria-labelledby="configuration-catalogue-list-title"><div className="configuration-catalogue-card-heading"><div><span className="section-kicker">Authoritative catalogue</span><h3 id="configuration-catalogue-list-title">{configurationTypeLabel(kind)}</h3></div><div className="configuration-catalogue-card-actions"><span className="configuration-catalogue-card-hint">{platformOnly ? 'Publish governed platform defaults for provider workspaces.' : 'Published platform defaults already apply. Add a provider override only when your operating policy needs a change.'}</span>{!readOnly && <Button type="button" variant={platformOnly ? 'primary' : 'secondary'} onClick={openNew}>{platformOnly ? '＋ New draft' : '＋ Add provider override'}</Button>}</div></div><div className="configuration-catalogue-table" role="table" aria-label={`${configurationTypeLabel(kind)} records`}><div className="configuration-catalogue-table-head" role="row"><span>Configuration</span><span>Status</span><span>Revision</span><span>Effective window</span><span>Actions</span></div>{!items && <p className="notice">Loading {configurationTypeLabel(kind).toLowerCase()}…</p>}{items && !filteredRecords.length && <div className="configuration-catalogue-empty"><strong>No records match these filters</strong><p>{platformOnly ? 'No published or draft platform records match these filters.' : 'No provider-specific values match these filters. Published platform defaults, when available, are already used by this provider.'}</p>{!readOnly && <Button type="button" variant="secondary" onClick={openNew}>{platformOnly ? 'Create draft' : 'Add provider override'}</Button>}</div>}{filteredRecords.map((record) => <div className="configuration-catalogue-row" role="row" key={record.id}><div className="configuration-catalogue-primary"><strong>{String(record.attributes.name || record.attributes.code || 'Unnamed configuration')}</strong><span className={`configuration-scope-chip is-${String(record.attributes.scope || 'provider')}`}>{record.attributes.scope === 'platform' ? 'Platform default' : 'Provider setting'}</span><small>{record.attributes.code && record.attributes.code !== record.attributes.name ? String(record.attributes.code) : 'Master data record'}</small></div><Status>{String(record.attributes.status || 'DRAFT')}</Status><span className="configuration-catalogue-revision">Version {String(record.attributes.version || '—')} · Rev {String(record.attributes.revision || '—')}</span><span className="configuration-catalogue-effective">{configurationEffectiveDates(record)}</span><div className="configuration-catalogue-row-actions"><Button type="button" variant="quiet" onClick={() => openRecord('view', record)}>View</Button>{!readOnly && record.attributes.scope !== 'platform' && String(record.attributes.status || '').toUpperCase() === 'DRAFT' && <Button type="button" variant="secondary" onClick={() => openRecord('edit', record)}>Edit</Button>}</div></div>)}</div></section>
    {items && <div className="server-pagination configuration-catalogue-pagination" aria-label="Configuration records pages"><span>Showing {filteredRecords.length} records · {PLATFORM_PAGE_SIZE} per page</span><div><Button type="button" variant="secondary" disabled={!configurationPage.previous} onClick={() => onPageChange({ before: configurationPage.previous || undefined })}>Previous</Button><Button type="button" disabled={!configurationPage.next} onClick={() => onPageChange({ after: configurationPage.next || undefined })}>Next</Button></div></div>}
    {dialogMode && <OperationsDialog title={dialogMode === 'view' ? `View ${configurationTypeLabel(kind)}` : dialogMode === 'edit' ? `Edit ${configurationTypeLabel(kind)}` : `New ${configurationTypeLabel(kind)} draft`} onClose={() => setDialogMode(null)} className="configuration-catalogue-dialog"><section className="configuration-dialog-body"><div className="configuration-dialog-intro"><div><span className="section-kicker">{dialogMode === 'view' ? 'Read-only view' : dialogMode === 'edit' ? 'Versioned editor' : 'New draft'}</span><h3>{selectedName}</h3>{selected && <small className="configuration-generated-code">System identifier: <code>{selectedCode}</code></small>}<p>{dialogMode === 'view' ? 'Review the current values, lifecycle state and audit history.' : editingAllowed ? 'Use controlled fields and related master records. Save a draft before review or publication.' : 'This configuration is no longer a draft. Review its lifecycle state and audit history below.'}</p></div>{selected && <Status>{String(selected.attributes.status || 'DRAFT')}</Status>}</div>{providerGeneratedCode && dialogMode !== 'view' && <p className="configuration-generated-code-note">The system identifier is generated from the name, for example <code>Test Elevator</code> becomes <code>TEST_ELEVATOR</code>. It remains stable when the name is edited.</p>}{dialogMode === 'view' ? <><div className="configuration-view-grid">{fields.map((field) => <div className="configuration-view-field" key={field.key}><dt>{field.label}</dt><dd><ConfigurationValueView field={field} value={values[field.key] || ''} lookups={lookups} /></dd></div>)}</div>{selected && selectedLifecycleStatus !== 'DRAFT' && <p className="notice">This revision is immutable. Create a new revision to update it; the current record remains available for audit and existing references.</p>}{selected && <ConfigurationGovernancePanel selected={selected} readOnly={readOnly} canReview={canReview} canPublish={canPublish} canDisable={canDisable} reviews={reviews} reviewId={reviewId} reason={reason} impact={impact} audit={audit} onReviewChange={onReviewChange} onReasonChange={onReasonChange} onCommand={onCommand} />}<div className="configuration-dialog-actions"><Button type="button" variant="quiet" onClick={() => setDialogMode(null)}>Close</Button>{selected && !readOnly && selectedLifecycleStatus === 'DRAFT' && <Button type="button" onClick={() => setDialogMode('edit')}>Edit draft</Button>}{selected && !readOnly && selectedLifecycleStatus !== 'DRAFT' && <Button type="button" onClick={openNewRevision}>{selected.attributes.scope === 'platform' ? 'Create provider override' : 'Create new revision'}</Button>}</div></> : <form className="configuration-editor-form" onSubmit={submit}><div className="configuration-editor-grid">{fields.map(renderEditorField)}</div>{maintenancePolicy && <p className="notice">Policy rules schedule maintenance due records; they do not imply job acceptance or customer entitlement.</p>}{readOnly && <p className="notice">Read-only catalogue access. Draft and lifecycle changes require platform capability.</p>}{selected && !editingAllowed && <p className="notice">Only draft configurations can be edited. This record is read-only after lifecycle activation or archival.</p>}<div className="configuration-dialog-actions"><Button type="button" variant="quiet" onClick={() => setDialogMode(null)}>Cancel</Button>{editingAllowed && <Button type="submit">{selected ? 'Save draft' : 'Create draft'}</Button>}</div>{selected && <ConfigurationGovernancePanel selected={selected} readOnly={readOnly} canReview={canReview} canPublish={canPublish} canDisable={canDisable} reviews={reviews} reviewId={reviewId} reason={reason} impact={impact} audit={audit} onReviewChange={onReviewChange} onReasonChange={onReasonChange} onCommand={onCommand} />}</form>}</section></OperationsDialog>}
  </section>;
}

type NotificationPolicyCommand = (action: 'submit' | 'approve' | 'revoke' | 'activate' | 'archive' | 'restore') => Promise<void>;

type NotificationPolicyWorkspaceProps = {
  availableTypes: readonly string[];
  kind: string;
  onKindChange: (kind: string) => void;
  platformOnly: boolean;
  readOnly: boolean;
  canReview: boolean;
  canPublish: boolean;
  canDisable: boolean;
  items: Collection<GenericAttributes> | null;
  selected: Resource<GenericAttributes> | null;
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  select: (record: Resource<GenericAttributes>) => void;
  newDraft: () => void;
  save: (event: FormEvent) => Promise<boolean>;
  reviews: Resource<GenericAttributes>[];
  reviewId: string;
  setReviewId: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  command: NotificationPolicyCommand;
  impact: ConfigurationImpact['data']['attributes'] | null;
  audit: ConfigurationAudit | null;
  error: string;
  message: string;
};

function notificationPolicyLabel(value: unknown): string {
  return String(value || 'Not set').replaceAll('_', ' ').replaceAll('.', ' · ').replace(/\b\w/g, (letter) => letter.toUpperCase()).replace(/\bIn\b/g, 'in');
}

function notificationPolicyChannels(record: Resource<GenericAttributes> | null): string[] {
  if (!record) return [];
  const definition = record.attributes.definition && typeof record.attributes.definition === 'object' ? record.attributes.definition as Record<string, unknown> : {};
  const value = configurationFieldValue('notification-policies', { key: 'channels', label: 'Channels', kind: 'lines' }, definition);
  return Array.isArray(value) ? value.map(String) : [];
}

function NotificationPolicyWorkspace({ availableTypes, kind, onKindChange, platformOnly, readOnly, canReview, canPublish, canDisable, items, selected, values, setValue, select, newDraft, save, reviews, reviewId, setReviewId, reason, setReason, command, impact, audit, error, message }: NotificationPolicyWorkspaceProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const records = items?.data || [];
  const categories = [...new Set(records.map((record) => String((record.attributes.definition as Record<string, unknown> | undefined)?.category || '')).filter(Boolean))].sort();
  const filteredRecords = records.filter((record) => {
    const definition = record.attributes.definition && typeof record.attributes.definition === 'object' ? record.attributes.definition as Record<string, unknown> : {};
    const searchable = [record.attributes.name, record.attributes.code, definition.event_type, definition.category].map((value) => String(value || '')).join(' ').toLowerCase();
    return (!query.trim() || searchable.includes(query.trim().toLowerCase())) && (statusFilter === 'ALL' || String(record.attributes.status || '').toUpperCase() === statusFilter) && (categoryFilter === 'ALL' || String(definition.category || '') === categoryFilter);
  });
  const activeCount = records.filter((record) => ['ACTIVE', 'PUBLISHED'].includes(String(record.attributes.status || '').toUpperCase())).length;
  const mandatoryCount = records.filter((record) => Boolean((record.attributes.definition as Record<string, unknown> | undefined)?.mandatory)).length;
  const channelCount = new Set(records.flatMap((record) => notificationPolicyChannels(record))).size;
  const selectedStatus = String(selected?.attributes.status || '').toUpperCase();
  const currentReview = reviews.find((review) => review.id === reviewId);
  const eventOptions = [...new Set(records.map((record) => String((record.attributes.definition as Record<string, unknown> | undefined)?.event_type || '')).filter(Boolean))].sort();
  const channelValues = new Set((values.channels || '').split('\n').map((value) => value.trim()).filter(Boolean));
  const toggleChannel = (channel: string, checked: boolean) => {
    const next = TOKEN_OPTIONS.channels.filter((option) => checked ? channelValues.has(option) || option === channel : channelValues.has(option) && option !== channel);
    setValue('channels', next.join('\n'));
  };
  const openNew = () => { newDraft(); setEditorOpen(true); };
  const openRecord = (record: Resource<GenericAttributes>) => { select(record); setEditorOpen(true); };
  const field = (key: string, label: string, input: ReactNode) => <label className="notification-policy-field" key={key}><span>{label}</span>{input}</label>;
  return <section className="content notification-policy-workspace">
    <header className="notification-policy-hero">
      <div>
        <span className="page-eyebrow">{platformOnly ? 'Platform administration' : 'Provider configuration · Communication controls'}</span>
        <h1>{platformOnly ? 'Business configuration' : 'Notification policies'}</h1>
        <p>{platformOnly ? 'Manage global catalogue definitions. Providers can read and adopt published entries but cannot edit canonical platform rows.' : 'Decide which operational events notify people, where the message is delivered, and which notices cannot be turned off.'}</p>
      </div>
      <div className="notification-policy-hero-actions">
        {platformOnly && <label className="configuration-type-selector notification-policy-type-select"><span>Configuration area</span><select aria-label="Configuration type" value={kind} onChange={(event) => onKindChange(event.target.value)}>{CONFIGURATION_TYPE_GROUPS.map((group) => <optgroup label={group.label} key={group.label}>{group.options.filter((option) => availableTypes.includes(option.value)).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</optgroup>)}</select><small>{configurationTypeDescription(kind)}</small></label>}
        {!readOnly && <Button type="button" variant="primary" onClick={openNew}>＋ New policy</Button>}
      </div>
    </header>
    {error && <p className="error notification-policy-feedback" role="alert">{error}</p>}
    {message && <p className="success notification-policy-feedback" role="status">{message}</p>}
    <div className="notification-policy-stat-grid" aria-label="Notification policy summary">
      <div className="notification-policy-stat"><span>All policies</span><strong>{records.length}</strong><small>Available in this configuration area</small></div>
      <div className="notification-policy-stat notification-policy-stat-success"><span>Active</span><strong>{activeCount}</strong><small>Currently eligible for delivery</small></div>
      <div className="notification-policy-stat notification-policy-stat-warning"><span>Required</span><strong>{mandatoryCount}</strong><small>Cannot be opted out of</small></div>
      <div className="notification-policy-stat notification-policy-stat-accent"><span>Channels</span><strong>{channelCount}</strong><small>Delivery methods configured</small></div>
    </div>
    <div className="notification-policy-toolbar">
      <label className="notification-policy-search"><span className="sr-only">Search notification policies</span><input aria-label="Search notification policies" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by policy or event" /></label>
      <label><span className="sr-only">Filter by status</span><select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option><option value="DRAFT">Draft</option><option value="ARCHIVED">Archived</option></select></label>
      <label><span className="sr-only">Filter by category</span><select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="ALL">All categories</option>{categories.map((category) => <option key={category} value={category}>{notificationPolicyLabel(category)}</option>)}</select></label>
      <span className="notification-policy-result-count">{filteredRecords.length} {filteredRecords.length === 1 ? 'policy' : 'policies'}</span>
    </div>
    <div className="notification-policy-main notification-policy-main-list-only">
      <section className="notification-policy-list-card" aria-labelledby="notification-policy-list-title">
        <div className="notification-policy-card-heading"><div><span className="section-kicker">Policy catalogue</span><h2 id="notification-policy-list-title">Delivery rules</h2></div><span className="notification-policy-card-hint">Select a policy to review its scope</span></div>
        {!items && <p className="notice">Loading notification policies…</p>}
        {items && !filteredRecords.length && <div className="notification-policy-empty"><strong>No policies match these filters</strong><p>Clear the search or create a new policy draft for this configuration area.</p>{!readOnly && <Button type="button" variant="secondary" onClick={openNew}>Create policy draft</Button>}</div>}
        <div className="notification-policy-record-list">{filteredRecords.map((record) => {
          const definition = record.attributes.definition && typeof record.attributes.definition === 'object' ? record.attributes.definition as Record<string, unknown> : {};
          const channels = notificationPolicyChannels(record);
          const isSelected = record.id === selected?.id;
          const rawName = String(record.attributes.name || '');
          const rawCode = String(record.attributes.code || '');
          const technicalName = /^[A-Z0-9_-]+$/.test(rawName);
          const displayName = rawName && rawName !== rawCode && !technicalName ? rawName : notificationPolicyLabel(definition.event_type || rawName || rawCode || 'Unnamed policy');
          return <button type="button" className={`notification-policy-record${isSelected ? ' selected' : ''}`} aria-label={`Open ${displayName}`} key={record.id} onClick={() => openRecord(record)}>
            <span className="notification-policy-record-title"><strong>{displayName}</strong><small>{notificationPolicyLabel(definition.event_type || rawCode)}</small></span>
            <span className="notification-policy-record-meta"><small>Category</small><strong>{notificationPolicyLabel(definition.category)}</strong></span>
            <span className="notification-policy-record-meta"><small>Delivery</small><strong>{channels.length ? channels.map(notificationPolicyLabel).join(' · ') : 'Not configured'}</strong></span>
            <span className="notification-policy-record-meta"><small>Required</small><strong>{definition.mandatory ? 'Yes' : 'No'}</strong></span>
            <span className="notification-policy-record-status"><Status>{String(record.attributes.status || 'DRAFT')}</Status><small>Revision {String(record.attributes.revision || '—')}</small></span>
            <span className="notification-policy-record-chevron" aria-hidden="true">›</span>
          </button>;
        })}</div>
      </section>
      {editorOpen && <OperationsDialog title={selected ? 'Edit notification policy' : 'Create notification policy'} onClose={() => setEditorOpen(false)} className="notification-policy-dialog"><section className="notification-policy-editor-card" aria-labelledby="notification-policy-editor-title">
        <div className="notification-policy-card-heading"><div><span className="section-kicker">{selected ? 'Selected policy' : 'New policy'}</span><h2 id="notification-policy-editor-title">{selected ? 'Policy details' : 'Create a draft'}</h2></div>{selected && <Status>{selectedStatus || 'DRAFT'}</Status>}</div>
        {readOnly && <div className="notification-policy-readonly"><strong>Read-only access</strong><span>This catalogue is visible here, but your current role cannot create or publish policy changes.</span></div>}
        {!selected && <div className="notification-policy-guidance"><strong>Start with the event and delivery channels</strong><p>Save a draft first. Review and publication controls appear after the policy has been created.</p></div>}
        <form className="notification-policy-editor-form" onSubmit={save}>
          <div className="notification-policy-field-grid">
            {field('code', 'Policy code', <input required value={values.code || ''} disabled={readOnly} onChange={(event) => setValue('code', event.target.value)} placeholder="Example: WORK_INTAKE_ASSIGNMENT" />)}
            {field('name', 'Policy name', <input required value={values.name || ''} disabled={readOnly} onChange={(event) => setValue('name', event.target.value)} placeholder="A clear name for operators" />)}
            {field('event_type', 'Event type', <><input required list="notification-policy-event-options" value={values.event_type || ''} disabled={readOnly} onChange={(event) => setValue('event_type', event.target.value)} placeholder="Choose or enter an event" /><datalist id="notification-policy-event-options">{eventOptions.map((option) => <option value={option} key={option} />)}</datalist></>)}
            {field('category', 'Category', <select required value={values.category || ''} disabled={readOnly} onChange={(event) => setValue('category', event.target.value)}><option value="">Select category</option>{['TRANSACTIONAL', 'SERVICE', 'OPERATIONAL', 'MARKETING'].map((option) => <option value={option} key={option}>{notificationPolicyLabel(option)}</option>)}</select>)}
            {field('effective_from', 'Effective from (India time)', <input required type="datetime-local" value={values.effective_from || ''} disabled={readOnly} onChange={(event) => setValue('effective_from', event.target.value)} />)}
            {field('effective_to', 'Effective to (optional)', <input type="datetime-local" value={values.effective_to || ''} disabled={readOnly} onChange={(event) => setValue('effective_to', event.target.value)} />)}
          </div>
          <fieldset className="notification-policy-fieldset"><legend>Policy behavior</legend><div className="notification-policy-field-grid"><div className="notification-policy-choice-field"><span>Mandatory notice</span><small>Required notices remain enabled for the intended audience.</small><div className="notification-policy-radio-row"><label><input type="radio" name="notification-policy-mandatory" checked={values.mandatory === 'true'} disabled={readOnly} onChange={() => setValue('mandatory', 'true')} /> Required</label><label><input type="radio" name="notification-policy-mandatory" checked={values.mandatory === 'false'} disabled={readOnly} onChange={() => setValue('mandatory', 'false')} /> Optional</label></div></div><div className="notification-policy-choice-field"><span>Delivery channels</span><small>Choose where the notification is delivered.</small><div className="notification-policy-channel-grid">{TOKEN_OPTIONS.channels.map((channel) => <label key={channel}><input type="checkbox" checked={channelValues.has(channel)} disabled={readOnly} onChange={(event) => toggleChannel(channel, event.target.checked)} /> <span>{notificationPolicyLabel(channel)}</span></label>)}</div></div></div></fieldset>
          {!readOnly && <div className="notification-policy-form-actions"><Button type="submit">{selected ? 'Save changes' : 'Save draft'}</Button>{selected && <Button type="button" variant="quiet" onClick={openNew}>New policy</Button>}</div>}
        </form>
        {selected && <>
          <section className="notification-policy-lifecycle" aria-labelledby="notification-policy-lifecycle-title"><div className="notification-policy-card-heading"><div><span className="section-kicker">Governance</span><h3 id="notification-policy-lifecycle-title">Review &amp; publication</h3></div>{currentReview && <Status>{String(currentReview.attributes.status || 'PENDING')}</Status>}</div><p className="notification-policy-muted">A policy becomes available only after the configured review and publication controls complete.</p>{reviews.length ? <label className="notification-policy-review-select"><span>Review revision</span><select aria-label="Configuration review" value={reviewId} onChange={(event) => setReviewId(event.target.value)}>{reviews.map((review) => <option value={review.id} key={review.id}>{notificationPolicyLabel(review.attributes.status)} · Revision {String(review.attributes.candidate_revision || '—')}</option>)}</select></label> : <p className="notice">No review exists for this revision. Submit the draft for review first.</p>}<label className="notification-policy-review-reason"><span>Decision note</span><input disabled={!canReview} aria-label="Review reason" placeholder="Optional reason or decision note" value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="notification-policy-lifecycle-actions">{canReview && <Button type="button" variant="secondary" onClick={() => void command('submit')}>Submit for review</Button>}{canReview && <Button type="button" disabled={!reviewId} onClick={() => void command('approve')}>Approve revision</Button>}{canReview && <Button type="button" variant="danger" disabled={!reviewId} onClick={() => void command('revoke')}>Reject review</Button>}{canPublish && <Button type="button" disabled={!reviewId} onClick={() => void command('activate')}>Enable policy</Button>}{!readOnly && selectedStatus === 'ARCHIVED' && <Button type="button" variant="secondary" onClick={() => void command('restore')}>Restore policy</Button>}{!readOnly && selectedStatus !== 'ARCHIVED' && <Button type="button" variant="quiet" disabled={!canDisable} onClick={() => void command('archive')}>Disable policy</Button>}</div></section>
          <section className="notification-policy-impact" aria-label="Policy impact"><div><span className="section-kicker">Safety check</span><h3>Before disabling</h3></div>{impact ? <p>{impact.total_dependents} dependent configuration(s) · {impact.provider_adoptions} provider adoption(s). {impact.warnings.length ? impact.warnings.join(' ') : 'No active dependency blocks were returned.'}</p> : <p>Impact information is loading or unavailable.</p>}</section>
          <details className="notification-policy-audit"><summary>View change history</summary>{audit?.audit.length ? <div>{audit.audit.slice(0, 20).map((entry) => <p key={entry.id}><Status>{entry.action}</Status><span>{entry.occurred_at ? formatIndiaDateTime(entry.occurred_at) : 'Time unavailable'}</span></p>)}</div> : <p className="notice">No audit entries returned.</p>}</details>
        </>}
      </section></OperationsDialog>}
    </div>
  </section>;
}

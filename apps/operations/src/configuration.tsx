import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { operationsData, type Collection, type GenericAttributes, type Resource } from './data';

type T = (key: string) => string;

type FieldKind = 'text' | 'number' | 'boolean' | 'date' | 'select' | 'lines';
type Field = { key: string; label: string; kind?: FieldKind; required?: boolean; options?: string[]; lookup?: string };

export const CONFIGURATION_TYPES = [
  'asset-families', 'asset-types', 'asset-definitions', 'service-types', 'checklist-templates',
  'notification-triggers', 'notification-policies', 'notification-templates', 'skills',
  'certification-types', 'working-calendars', 'holiday-calendars', 'service-territories',
  'assignment-policies', 'asset-criticalities', 'service-priorities', 'emergency-rules',
  'sla-policies', 'identifier-policies', 'maintenance-policies'
] as const;

const common = (extra: Field[] = []): Field[] => [
  { key: 'code', label: 'Code', required: true },
  { key: 'name', label: 'Name', required: true },
  { key: 'effective_from', label: 'Effective from', kind: 'date', required: true },
  { key: 'effective_to', label: 'Effective to', kind: 'date' },
  ...extra
];

const FIELDS: Record<string, Field[]> = {
  'asset-families': common(),
  'asset-types': common([{ key: 'asset_family_id', label: 'Asset family', kind: 'select', lookup: 'asset-families', required: true }]),
  'asset-definitions': common([{ key: 'asset_type_id', label: 'Asset type', kind: 'select', lookup: 'asset-types', required: true }, { key: 'identifier_policy_id', label: 'Identifier policy', kind: 'select', lookup: 'identifier-policies' }, { key: 'primary_identifier_strategy', label: 'Primary identifier strategy' }, { key: 'attributes', label: 'Attributes: code|label|value_type|required (one per line)', kind: 'lines' }, { key: 'components', label: 'Components: code|position_kind|trackable|replaceable (one per line)', kind: 'lines' }]),
  'service-types': common([{ key: 'fulfilment_modes', label: 'Fulfilment modes (one per line)', kind: 'lines', required: true }, { key: 'category', label: 'Capability category' }]),
  'checklist-templates': common([{ key: 'items', label: 'Checklist items: key|label|required|type (one per line)', kind: 'lines', required: true }]),
  'notification-policies': common([{ key: 'event_type', label: 'Event type', required: true }, { key: 'category', label: 'Category', kind: 'select', options: ['TRANSACTIONAL', 'SERVICE', 'OPERATIONAL', 'MARKETING'], required: true }, { key: 'mandatory', label: 'Mandatory', kind: 'boolean', required: true }, { key: 'channels', label: 'Channels (one per line)', kind: 'lines', required: true }]),
  'notification-templates': common([{ key: 'policy_id', label: 'Notification policy', kind: 'select', lookup: 'notification-policies', required: true }, { key: 'channel', label: 'Channel', required: true }, { key: 'locale', label: 'Locale', required: true }, { key: 'subject', label: 'Subject' }, { key: 'body', label: 'Body', kind: 'lines', required: true }]),
  'notification-triggers': common([{ key: 'event_name', label: 'Event name', required: true }, { key: 'category', label: 'Category', kind: 'select', options: ['TRANSACTIONAL', 'SERVICE', 'OPERATIONAL', 'MARKETING'], required: true }, { key: 'policy_id', label: 'Notification policy', kind: 'select', lookup: 'notification-policies', required: true }, { key: 'template_id', label: 'Notification template', kind: 'select', lookup: 'notification-templates', required: true }, { key: 'enabled', label: 'Enabled', kind: 'boolean', required: true }]),
  skills: common([{ key: 'proficiency_levels', label: 'Proficiency levels (one per line)', kind: 'lines', required: true }, { key: 'verification_required', label: 'Verification required', kind: 'boolean', required: true }]),
  'certification-types': common([{ key: 'issuer', label: 'Issuer', required: true }, { key: 'verification_required', label: 'Verification required', kind: 'boolean', required: true }, { key: 'expiry_required', label: 'Expiry required', kind: 'boolean', required: true }]),
  'working-calendars': common([{ key: 'time_zone', label: 'IANA time zone', required: true }, { key: 'schedule', label: 'Schedule entries: weekday|start|end (one per line)', kind: 'lines', required: true }]),
  'holiday-calendars': common([{ key: 'holidays', label: 'Holidays: date|code|category|non_working (one per line)', kind: 'lines', required: true }]),
  'service-territories': common([{ key: 'kind', label: 'Scope kind', required: true }, { key: 'references', label: 'Scope references (one per line)', kind: 'lines' }]),
  'assignment-policies': common([{ key: 'mode', label: 'Mode', kind: 'select', options: ['MANUAL', 'ASSISTED', 'AUTOMATIC'], required: true }, { key: 'scope', label: 'Scope kind', required: true }, { key: 'precedence', label: 'Precedence', kind: 'number', required: true }, { key: 'rules', label: 'Rules: key|value (one per line)', kind: 'lines', required: true }, { key: 'capacity', label: 'Capacity: key|value (one per line)', kind: 'lines', required: true }, { key: 'fallback_mode', label: 'Fallback mode', kind: 'select', options: ['MANUAL', 'ASSISTED'], required: true }, { key: 'tie_break_reference', label: 'Tie-break reference', required: true }, { key: 'acceptance_required', label: 'Acceptance required', kind: 'boolean', required: true }, { key: 'proposal_hold_minutes', label: 'Proposal hold minutes', kind: 'number', required: true }, { key: 'acceptance_timeout_minutes', label: 'Acceptance timeout minutes', kind: 'number', required: true }]),
  'asset-criticalities': common([{ key: 'rank', label: 'Rank', kind: 'number', required: true }]),
  'service-priorities': common([{ key: 'rank', label: 'Rank', kind: 'number', required: true }, { key: 'description', label: 'Description', kind: 'lines' }, { key: 'sla_policy_id', label: 'SLA policy', kind: 'select', lookup: 'sla-policies' }, { key: 'assignment_policy_id', label: 'Assignment policy', kind: 'select', lookup: 'assignment-policies' }]),
  'emergency-rules': common([{ key: 'priority_id', label: 'Priority', kind: 'select', lookup: 'service-priorities', required: true }, { key: 'sla_policy_id', label: 'SLA policy', kind: 'select', lookup: 'sla-policies', required: true }, { key: 'escalation_policy_id', label: 'Escalation policy (no authorized lookup operation)', kind: 'select', lookup: 'escalation-policies', required: true }, { key: 'assignment_policy_id', label: 'Assignment policy', kind: 'select', lookup: 'assignment-policies', required: true }, { key: 'required_response', label: 'Required response', kind: 'lines' }]),
  'sla-policies': common([{ key: 'response_target_minutes', label: 'Response target minutes', kind: 'number' }, { key: 'assignment_target_minutes', label: 'Assignment target minutes', kind: 'number' }, { key: 'acceptance_target_minutes', label: 'Acceptance target minutes', kind: 'number' }, { key: 'dispatch_target_minutes', label: 'Dispatch target minutes', kind: 'number' }, { key: 'arrival_target_minutes', label: 'Arrival target minutes', kind: 'number' }, { key: 'work_start_target_minutes', label: 'Work-start target minutes', kind: 'number' }, { key: 'resolution_target_minutes', label: 'Resolution target minutes', kind: 'number' }, { key: 'business_hours_policy_reference', label: 'Business-hours policy reference', required: true }, { key: 'pause_resume_policy_reference', label: 'Pause/resume policy reference', required: true }]),
  'identifier-policies': [{ key: 'identifier_kind', label: 'Identifier kind', required: true }, { key: 'normalization_version', label: 'Normalization version', required: true }, { key: 'name', label: 'Name', required: true }, { key: 'strategy', label: 'Strategy', kind: 'select', options: ['PROVIDED', 'GENERATED', 'COMPOSITE', 'OPTIONAL'], required: true }, { key: 'effective_from', label: 'Effective from', kind: 'date', required: true }, { key: 'effective_to', label: 'Effective to', kind: 'date' }, { key: 'composite_fields', label: 'Composite fields (one per line)', kind: 'lines' }],
  'maintenance-policies': common([{ key: 'source', label: 'Source', required: true }, { key: 'timezone_name', label: 'IANA time zone', required: true }, { key: 'recurrence_policy', label: 'Recurrence policy', kind: 'select', options: ['from_due', 'from_completion', 'explicit_schedule', 'none'], required: true }, { key: 'maintenance_rules', label: 'Rules: sequence|code|trigger_kind (one per line)', kind: 'lines', required: true }, { key: 'asset_definition_id', label: 'Asset definition', kind: 'select', lookup: 'asset-definitions' }, { key: 'service_location_id', label: 'Service location (no list operation in current contract)', kind: 'select', lookup: 'service-locations' }])
};

function parseLines(key: string, value: string): unknown {
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
  if (field.kind === 'lines') {
    if (field.key === 'body' && value && typeof value === 'object') return String((value as { body?: unknown }).body || '');
    if (Array.isArray(value)) return value.map((item) => typeof item === 'object' ? Object.values(item as Record<string, unknown>).join('|') : String(item)).join('\n');
  }
  return value == null ? '' : String(value);
}

export function ConfigurationAdmin({ providerId, t }: { providerId: string; t: T }) {
  void t;
  const [kind, setKind] = useState<string>('service-types');
  const [items, setItems] = useState<Collection<GenericAttributes> | null>(null);
  const [selected, setSelected] = useState<Resource<GenericAttributes> | null>(null);
  const [lookups, setLookups] = useState<Record<string, Collection<GenericAttributes>>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [reviewId, setReviewId] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fields = FIELDS[kind] || common();
  const lookupTypes = useMemo(() => [...new Set(fields.flatMap((field) => field.lookup ? [field.lookup] : []))], [fields]);
  async function load() {
    setError(''); setSelected(null); setReviewId('');
    try { setItems(await operationsData.configuration(providerId, kind)); const loaded = await Promise.all(lookupTypes.map(async (type) => [type, await operationsData.configuration(providerId, type)] as const)); setLookups(Object.fromEntries(loaded)); } catch (cause) { setError((cause as { message?: string }).message || 'Configuration records could not be loaded.'); }
  }
  useEffect(() => { void load(); }, [providerId, kind]);
  function select(record: Resource<GenericAttributes>) {
    setSelected(record); const definition = (record.attributes.definition || {}) as Record<string, unknown>; setValues(Object.fromEntries(fields.map((field) => [field.key, formatValue(field, definition[field.key])]))); setMessage(''); setError('');
  }
  function setValue(key: string, value: string) { setValues((current) => ({ ...current, [key]: value })); }
  function buildDefinition() {
    const definition: Record<string, unknown> = {};
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
      else if (field.kind === 'lines') definition[outputKey] = parseLines(field.key, raw);
      else definition[outputKey] = raw;
    });
    return definition;
  }
  async function save(event: FormEvent) { event.preventDefault(); setError(''); setMessage(''); try { const definition = buildDefinition(); const result = selected ? await operationsData.updateConfiguration(providerId, kind, selected.id, { definition, expected_revision: selected.attributes.revision }, crypto.randomUUID()) : await operationsData.createConfiguration(providerId, kind, { name: String(values.name || values.code || 'Draft configuration'), definition }, crypto.randomUUID()); setSelected(result); setValues(Object.fromEntries(fields.map((field) => [field.key, formatValue(field, (result.attributes.definition as Record<string, unknown> | undefined)?.[field.key])] ))); setMessage('Draft saved by the server'); await load(); } catch (cause) { setError((cause as { message?: string }).message || 'Draft could not be saved. Review the fields and retry.'); } }
  async function command(action: 'submit' | 'approve' | 'revoke' | 'activate' | 'archive') { if (!selected) return; setError(''); setMessage(''); try { let result: Resource<GenericAttributes> | undefined; if (action === 'submit') { result = await operationsData.submitConfigurationReview(providerId, kind, selected.id, { expected_revision: selected.attributes.revision, reason: reason || undefined }, crypto.randomUUID()); setReviewId(result.id); } else if (action === 'approve') result = await operationsData.approveConfigurationReview(providerId, kind, selected.id, reviewId, crypto.randomUUID()); else if (action === 'revoke') result = await operationsData.revokeConfigurationReview(providerId, kind, selected.id, reviewId, { reason: reason || 'Revoked from operations workspace' }, crypto.randomUUID()); else if (action === 'activate') result = await operationsData.activateConfiguration(providerId, kind, selected.id, { expected_revision: selected.attributes.revision, review_reference: reviewId }, crypto.randomUUID()); else result = await operationsData.archiveConfiguration(providerId, kind, selected.id, { expected_revision: selected.attributes.revision }, crypto.randomUUID()); if (action !== 'submit' && result?.attributes?.kind) setSelected(result); setMessage(`Configuration ${action} request accepted by the server`); await load(); } catch (cause) { setError((cause as { message?: string }).message || `Configuration ${action} was rejected.`); } }
  return <section className="content configuration-admin"><div className="section-heading"><div><h2>Typed configuration administration</h2><p>Explicit adapters for the accepted registry; no executable or arbitrary JSON input.</p></div><label>Type<select aria-label="Configuration type" value={kind} onChange={(event) => setKind(event.target.value)}>{CONFIGURATION_TYPES.map((type) => <option value={type} key={type}>{type}</option>)}</select></label></div>{error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}<div className="configuration-layout"><div className="record-grid">{items?.data.map((item) => <button className="record-card" key={item.id} onClick={() => select(item)}><Status>{String(item.attributes.status)}</Status><strong>{String(item.attributes.name || item.attributes.kind || item.id)}</strong><small>Version {String(item.attributes.version)} · revision {String(item.attributes.revision)}</small></button>)}{items && items.data.length === 0 && <p className="notice">No records for this type. Create a draft with the typed form.</p>}</div><form className="detail-card typed-form" onSubmit={save}><h3>{selected ? 'Edit draft' : 'Create draft'}</h3>{fields.map((field) => <label key={field.key}>{field.label}{field.kind === 'select' ? <select required={field.required} value={values[field.key] || ''} onChange={(event) => setValue(field.key, event.target.value)}><option value="">Select an authorized record</option>{field.options?.map((option) => <option value={option} key={option}>{option}</option>)}{field.lookup && lookups[field.lookup]?.data.map((record) => <option value={record.id} key={record.id}>{String(record.attributes.name || record.attributes.code || record.id)}</option>)}</select> : field.kind === 'boolean' ? <select required={field.required} value={values[field.key] || ''} onChange={(event) => setValue(field.key, event.target.value)}><option value="">Select</option><option value="true">Yes</option><option value="false">No</option></select> : field.kind === 'lines' ? <textarea required={field.required} value={values[field.key] || ''} onChange={(event) => setValue(field.key, event.target.value)} rows={4} /> : <input required={field.required} type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'datetime-local' : 'text'} value={values[field.key] || ''} onChange={(event) => setValue(field.key, event.target.value)} />}</label>)}<Button type="submit">{selected ? 'Save draft' : 'Create draft'}</Button>{selected && <div className="configuration-commands"><input aria-label="Review reference" placeholder="Review reference UUID" value={reviewId} onChange={(event) => setReviewId(event.target.value)} /><input aria-label="Review reason" placeholder="Review reason (optional)" value={reason} onChange={(event) => setReason(event.target.value)} /><Button type="button" onClick={() => void command('submit')}>Submit review</Button><Button type="button" disabled={!reviewId} onClick={() => void command('approve')}>Approve review</Button><Button type="button" disabled={!reviewId} onClick={() => void command('revoke')}>Revoke review</Button><Button type="button" disabled={!reviewId} onClick={() => void command('activate')}>Activate approved revision</Button><Button type="button" onClick={() => void command('archive')}>Archive</Button></div>}</form></div></section>;
}

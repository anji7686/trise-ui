import type { ReactNode } from 'react';

export type DisplayAttributes = Record<string, unknown>;
export type DisplayRecord = { id: string; attributes?: DisplayAttributes };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isOpaqueId(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}

export function humanize(value: unknown): string {
  return typeof value === 'string' && value.length > 0
    ? value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
    : 'Name unavailable';
}

export function displayName(record: DisplayRecord | null | undefined, fallback = 'Name unavailable'): string {
  const attributes = record?.attributes || {};
  const candidates = ['display_name', 'name', 'title', 'legal_name', 'filename', 'summary', 'description', 'code'];
  for (const key of candidates) {
    const value = attributes[key];
    const stringValue = typeof value === 'string' ? value.trim() : '';
    if (stringValue && !isOpaqueId(stringValue)) return stringValue;
  }
  return fallback;
}

export function contextLabel(record: DisplayRecord | null | undefined, context?: string): string | undefined {
  const attributes = record?.attributes || {};
  const values = [context, attributes.business_name, attributes.provider_name, attributes.city, attributes.state_or_union_territory]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()) && !isOpaqueId(value));
  return values.length ? values.join(' · ') : undefined;
}

export function EntitySummary({ record, context, className = '' }: { record?: DisplayRecord | null; context?: string; className?: string }): ReactNode {
  const label = displayName(record);
  const secondary = contextLabel(record, context);
  return <span className={`entity-summary ${className}`.trim()}><strong>{label}</strong>{secondary && <small>{secondary}</small>}</span>;
}

export function EntityOption({ record, context, children }: { record: DisplayRecord; context?: string; children?: ReactNode }) {
  return <option value={record.id}>{children || displayName(record)}{contextLabel(record, context) ? ` · ${contextLabel(record, context)}` : ''}</option>;
}

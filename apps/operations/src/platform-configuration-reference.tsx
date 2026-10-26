import { useEffect, useMemo, useState } from 'react';
import { Button } from '@trise/ui';
import { SvgIcon } from './icons';
import { operationsData, type BusinessOperation, type Collection, type GenericAttributes, type ReferenceDataImport } from './data';
import { PLATFORM_CONFIGURATION_TYPES } from './configuration';

type RegistryScope = 'Platform catalogue' | 'Business operations' | 'Reference data' | 'Provider overrides';
type RegistryStatus = 'Available' | 'Needs attention' | 'Loading' | 'Read-only';
type AreaTone = 'blue' | 'purple' | 'green' | 'orange';

type RegistryArea = {
  scope: RegistryScope;
  icon: 'settings' | 'clipboard' | 'map-pin' | 'shield';
  tone: AreaTone;
  route: string;
  owner: string;
  source: string;
  description: string;
};

const areas: RegistryArea[] = [
  {
    scope: 'Platform catalogue',
    icon: 'settings',
    tone: 'blue',
    route: 'platform/configuration/service-types',
    owner: 'Platform Administration',
    source: 'Typed configuration registry',
    description: 'Asset, service, checklist, workforce, notification, SLA and maintenance masters.',
  },
  {
    scope: 'Business operations',
    icon: 'clipboard',
    tone: 'purple',
    route: 'platform/business-operations',
    owner: 'Platform Administration',
    source: 'BusinessOperationType / ProviderOperation',
    description: 'Canonical operations, including Elevator & Lift configuration and availability controls.',
  },
  {
    scope: 'Reference data',
    icon: 'map-pin',
    tone: 'green',
    route: 'platform/configuration/reference-data',
    owner: 'Platform Administration',
    source: 'Versioned reference-data imports',
    description: 'India geography and PIN-code datasets used by searchable selectors.',
  },
  {
    scope: 'Provider overrides',
    icon: 'shield',
    tone: 'orange',
    route: 'platform/configuration/provider-overrides',
    owner: 'Platform Administration',
    source: 'Provider override + setup orchestrator',
    description: 'Provider-specific settings, readiness gates, review, approval and activation.',
  },
];

type AreaSnapshot = {
  status: RegistryStatus;
  detail: string;
  count?: string;
};

function routeTo(path: string) {
  window.location.hash = path;
}

function StatusPill({ value }: { value: RegistryStatus }) {
  const tone = value === 'Available' ? 'success' : value === 'Needs attention' ? 'warning' : value === 'Loading' ? 'info' : 'neutral';
  return <span className={`reference-status reference-status-${tone}`}>{value}</span>;
}

function errorMessage(cause: unknown) {
  return (cause as { message?: string })?.message || 'The configuration registry could not load one or more authoritative sources.';
}

function countConfigurations(results: PromiseSettledResult<Collection<GenericAttributes>>[]) {
  const successful = results.filter((result): result is PromiseFulfilledResult<Collection<GenericAttributes>> => result.status === 'fulfilled');
  return { successful: successful.length, total: results.length, records: successful.reduce((sum, result) => sum + result.value.data.length, 0) };
}

function latestImport(imports: ReferenceDataImport[]) {
  return [...imports].sort((left, right) => String(right.attributes.activated_at || right.attributes.retrieved_at || '').localeCompare(String(left.attributes.activated_at || left.attributes.retrieved_at || '')))[0];
}

export function PlatformConfigurationRegistry() {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'All areas' | RegistryScope>('All areas');
  const [snapshots, setSnapshots] = useState<Record<RegistryScope, AreaSnapshot> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    Promise.all([
      Promise.allSettled(PLATFORM_CONFIGURATION_TYPES.map((kind) => operationsData.configuration('', kind, 'ACTIVE'))),
      operationsData.platformBusinessOperations(),
      operationsData.referenceDataImports(),
    ]).then(([configurationResults, businessResult, referenceResult]) => {
      if (!current) return;
      const configurationCount = countConfigurations(configurationResults);
      const businessRows = businessResult.data;
      const activeBusinessRows = businessRows.filter((row: BusinessOperation) => row.attributes.is_active !== false && row.attributes.lifecycle_status !== 'ARCHIVED');
      const currentImport = latestImport(referenceResult.data);
      const referenceReady = Boolean(currentImport && currentImport.attributes.status === 'ACTIVE');
      setSnapshots({
        'Platform catalogue': {
          status: configurationCount.successful === configurationCount.total ? 'Available' : 'Needs attention',
          detail: configurationCount.successful === configurationCount.total ? 'Published masters are available for administration.' : `${configurationCount.successful} of ${configurationCount.total} catalogue groups responded.`,
          count: `${configurationCount.records} records · ${configurationCount.total} groups`,
        },
        'Business operations': {
          status: 'Available',
          detail: `${activeBusinessRows.length} active operation${activeBusinessRows.length === 1 ? '' : 's'} are visible in the canonical catalogue.`,
          count: `${businessRows.length} operations · server-backed`,
        },
        'Reference data': {
          status: referenceReady ? 'Available' : 'Needs attention',
          detail: currentImport ? `${currentImport.attributes.dataset_kind.replaceAll('_', ' ')} import is ${currentImport.attributes.status.toLowerCase()}.` : 'No reference-data import is available.',
          count: currentImport ? `${String(currentImport.attributes.counts.accepted ?? currentImport.attributes.counts.read ?? 0)} rows · versioned` : 'No active dataset',
        },
        'Provider overrides': {
          status: 'Read-only',
          detail: 'Open the dedicated provider selector to manage scoped overrides and setup readiness.',
          count: 'Provider-scoped · audited',
        },
      });
    }).catch((cause) => {
      if (current) setError(errorMessage(cause));
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, []);

  const visibleAreas = useMemo(() => areas.filter((area) => {
    const snapshot = snapshots?.[area.scope];
    const searchable = `${area.scope} ${area.owner} ${area.source} ${area.description} ${snapshot?.detail || ''}`.toLowerCase();
    return (!query.trim() || searchable.includes(query.trim().toLowerCase())) && (scope === 'All areas' || scope === area.scope);
  }), [query, scope, snapshots]);

  return <section className="platform-reference-page platform-reference-registry">
    <div className="reference-breadcrumb"><span>Platform administration</span><SvgIcon name="chevron-right" size={14} /><strong>Configuration</strong></div>
    <div className="reference-page-heading">
      <div><span className="reference-eyebrow">Platform administration</span><h1>Configuration registry</h1><p>One read-only map of the authoritative configuration areas. Open each area to perform its approved workflow.</p></div>
      <div className="reference-heading-actions"><label className="reference-search"><SvgIcon name="search" size={17} /><input aria-label="Search configuration areas" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search areas..." /></label><select aria-label="Filter by area" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}><option>All areas</option>{areas.map((area) => <option key={area.scope}>{area.scope}</option>)}</select></div>
    </div>
    <div className="reference-registry-notice"><span className="reference-summary-icon tone-blue"><SvgIcon name="shield" size={17} /></span><div><strong>Authoritative sources only</strong><p>This page does not edit or duplicate configuration. Platform masters, business operations, reference imports and provider overrides each keep their existing API, review and audit boundary.</p></div></div>
    {error && <div className="reference-registry-error" role="alert"><strong>Some registry data needs attention</strong><span>{error}</span><Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button></div>}
    {loading ? <div className="reference-table-card"><p className="notice">Loading configuration sources…</p></div> : <>
      <div className="reference-summary-grid">{areas.map((area) => { const snapshot = snapshots?.[area.scope] || { status: 'Needs attention', detail: 'Authoritative data is unavailable.' }; return <button type="button" key={area.scope} className={`reference-summary-card tone-${area.tone}`} aria-label={`Open ${area.scope}`} onClick={() => routeTo(area.route)}><span className="reference-summary-icon"><SvgIcon name={area.icon} size={21} /></span><span><strong>{area.scope}</strong><small>{snapshot.count || 'Server-backed configuration'}</small></span><StatusPill value={snapshot.status} /></button>; })}</div>
      <div className="reference-table-card"><div className="reference-table-scroll"><table className="reference-table"><caption className="sr-only">Configuration areas</caption><thead><tr><th>Configuration area</th><th>Owner</th><th>Authoritative data</th><th>Current state</th><th>Action</th></tr></thead><tbody>{visibleAreas.map((area) => { const snapshot = snapshots?.[area.scope] || { status: 'Needs attention', detail: 'Authoritative data is unavailable.' }; return <tr key={area.scope}><td><div className="reference-registry-area"><span className={`reference-summary-icon tone-${area.tone}`}><SvgIcon name={area.icon} size={18} /></span><span><strong>{area.scope}</strong><small>{area.description}</small></span></div></td><td>{area.owner}</td><td><strong>{area.source}</strong><small>{snapshot.detail}</small></td><td><StatusPill value={snapshot.status} /></td><td><Button variant="secondary" onClick={() => routeTo(area.route)}>Open area <SvgIcon name="chevron-right" size={14} /></Button></td></tr>; })}{!visibleAreas.length && <tr><td colSpan={5}><p className="notice">No configuration areas match the selected filters.</p></td></tr>}</tbody></table></div></div>
    </>}
    <p className="reference-form-note">Changes remain subject to the existing draft, review, approval, publish, restore and audit workflows of the selected area.</p>
  </section>;
}

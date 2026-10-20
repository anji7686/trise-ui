import { useEffect, useState } from 'react';
import { Button, StatePanel } from '@trise/ui';
import { operationsData, type IndiaGeographyEntry, type ReferenceDataImport } from './data';
import { OperationsStatus as Status } from './operations-status';
import { formatIndiaDateTime } from './subscription-support';

const shortReference = (value: string) => value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;

export function ReferenceDataAdmin({ platformCapabilities = [], currentUserId = '' }: { platformCapabilities?: string[]; currentUserId?: string }) {
  const [imports, setImports] = useState<ReferenceDataImport[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'COUNTRY' | 'STATE_UT' | 'DISTRICT' | 'CITY' | 'IMPORTS'>('IMPORTS');
  const [query, setQuery] = useState('');
  const [locations, setLocations] = useState<IndiaGeographyEntry[]>([]);
  const canReview = platformCapabilities.includes('PLATFORM_CONFIGURATION_REVIEW');
  const canPublish = platformCapabilities.includes('PLATFORM_CONFIGURATION_PUBLISH');

  async function load() {
    setLoading(true);
    try { setError(''); setImports((await operationsData.referenceDataImports()).data); } catch (cause) { setError((cause as { message?: string }).message || 'Reference-data import history could not be loaded.'); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (tab === 'IMPORTS') return;
    let current = true;
    setLoading(true); setError('');
    operationsData.indiaLocations({ kind: tab, q: query, limit: 50 }).then((result) => { if (current) setLocations(result.data); }).catch((cause) => { if (current) setError((cause as { message?: string }).message || 'Reference-data entries could not be loaded.'); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [query, tab]);

  async function submitReview(item: ReferenceDataImport) {
    setBusy(item.id); setError('');
    try { await operationsData.submitReferenceDataImportReview(item.id, { reason: 'Reference-data restore requested by Platform Administration' }, crypto.randomUUID()); await load(); } catch (cause) { setError((cause as { message?: string }).message || 'Reference-data review submission was rejected.'); } finally { setBusy(''); }
  }

  async function approveReview(item: ReferenceDataImport) {
    if (!item.attributes.review_id) return;
    setBusy(item.id); setError('');
    try { await operationsData.approveReferenceDataImportReview(item.id, item.attributes.review_id, crypto.randomUUID()); await load(); } catch (cause) { setError((cause as { message?: string }).message || 'Reference-data review approval was rejected.'); } finally { setBusy(''); }
  }

  async function revokeReview(item: ReferenceDataImport) {
    if (!item.attributes.review_id) return;
    if (!window.confirm(`Revoke the ${item.attributes.review_status} review for ${item.attributes.dataset_kind} import ${item.id.slice(0, 8)}?`)) return;
    setBusy(item.id); setError('');
    try { await operationsData.revokeReferenceDataImportReview(item.id, item.attributes.review_id, 'Reference-data restore review revoked by Platform Administration', crypto.randomUUID()); await load(); } catch (cause) { setError((cause as { message?: string }).message || 'Reference-data review revocation was rejected.'); } finally { setBusy(''); }
  }

  async function restore(item: ReferenceDataImport) {
    if (!item.attributes.review_id) return;
    if (!window.confirm(`Restore ${item.attributes.dataset_kind} import ${item.id.slice(0, 8)}? The current active dataset will be retained as a previous version.`)) return;
    setBusy(item.id); setError('');
    try { await operationsData.restoreReferenceDataImport(item.id, item.attributes.review_id, crypto.randomUUID()); await load(); } catch (cause) { setError((cause as { message?: string }).message || 'Reference-data restore was rejected.'); } finally { setBusy(''); }
  }

  const tabs: Array<[typeof tab, string]> = [['COUNTRY', 'Countries'], ['STATE_UT', 'States'], ['DISTRICT', 'Districts'], ['CITY', 'Cities'], ['IMPORTS', 'Import history']];

  return <section className="platform-reference-page reference-data-admin">
    <div className="reference-breadcrumb"><span>Platform administration</span><span>›</span><strong>Reference data</strong></div>
    <div className="reference-page-heading">
      <div><span className="reference-eyebrow">Platform administration / Master data</span><h1>Reference data</h1><p>Manage versioned India geography and PIN-code datasets used by searchable selectors.</p></div>
      <div className="reference-heading-actions"><label className="reference-search"><input aria-label="Search reference data" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search countries, states or cities..." /></label><Button disabled title="Stage a vetted dataset through the import task before review">Import dataset</Button></div>
    </div>
    <div className="reference-tabs">{tabs.map(([value, label]) => <button className={tab === value ? 'active' : ''} type="button" key={value} onClick={() => setTab(value)}>{label}</button>)}</div>
    {error && <StatePanel title="Reference-data action needs attention"><span>{error}</span><Button onClick={() => tab === 'IMPORTS' ? void load() : setTab(tab)}>Retry</Button></StatePanel>}
    {loading ? <p className="notice">Loading reference data…</p> : tab !== 'IMPORTS' ? <div className="reference-table-card"><div className="reference-table-scroll"><table className="reference-table"><caption className="sr-only">India {tab.toLowerCase()} reference entries</caption><thead><tr><th>Name</th><th>Code</th><th>Parent</th><th>State</th><th>Status</th></tr></thead><tbody>{locations.map((item) => <tr key={item.id}><td><strong>{item.attributes.name}</strong></td><td>{item.attributes.code}</td><td>{item.attributes.parent_code || '—'}</td><td>{item.attributes.state_code || '—'}</td><td><Status>ACTIVE</Status></td></tr>)}{!locations.length && <tr><td colSpan={5}><p className="notice">No matching entries.</p></td></tr>}</tbody></table></div></div> : !error && imports.length === 0 ? <p className="notice">No reference-data imports have been recorded.</p> : <div className="reference-table-card"><div className="reference-table-scroll"><table className="reference-table"><caption className="sr-only">Reference-data import history</caption><thead><tr><th>Dataset</th><th>Status</th><th>Review</th><th>Source</th><th>Rows</th><th>Retrieved</th><th>Lineage</th><th>Actions</th></tr></thead><tbody>{imports.map((item) => { const reviewStatus = item.attributes.review_status || 'NOT_SUBMITTED'; const stagedWithRows = item.attributes.status === 'STAGED' && String(item.attributes.counts.accepted ?? item.attributes.counts.read ?? 0) !== '0'; const reviewOpen = ['PENDING', 'APPROVED'].includes(reviewStatus); const ownPendingReview = reviewStatus === 'PENDING' && Boolean(currentUserId) && item.attributes.review_submitted_by_user_id === currentUserId; const importReference = item.id; return <tr key={item.id}><td><strong>{item.attributes.dataset_kind === 'INDIA_GEOGRAPHY' ? 'India geography' : 'India PIN codes'}</strong><small title={importReference}>Import {shortReference(importReference)}</small></td><td><Status>{item.attributes.status}</Status></td><td><Status>{reviewStatus}</Status>{ownPendingReview && <small>Self-approval will be recorded in the audit trail</small>}</td><td>{item.attributes.source_filename || item.attributes.source_url || 'Not recorded'}<small>{item.attributes.sha256 ? `SHA-256 ${item.attributes.sha256.slice(0, 12)}…` : 'Checksum unavailable'}</small></td><td>{String(item.attributes.counts.accepted ?? item.attributes.counts.read ?? 0)}</td><td>{item.attributes.retrieved_at ? formatIndiaDateTime(item.attributes.retrieved_at) : 'Not available'}</td><td>{item.attributes.supersedes_id ? <small title={item.attributes.supersedes_id}>Supersedes {shortReference(item.attributes.supersedes_id)}</small> : <small>Baseline / first version</small>}</td><td>{stagedWithRows && canReview && !reviewOpen && <Button variant="quiet" disabled={busy === item.id} onClick={() => void submitReview(item)}>{busy === item.id ? 'Submitting…' : 'Submit review'}</Button>}{stagedWithRows && canReview && reviewStatus === 'PENDING' && <Button variant="quiet" disabled={busy === item.id} title={ownPendingReview ? 'Self-approval will be recorded in the audit trail.' : undefined} onClick={() => void approveReview(item)}>{busy === item.id ? 'Approving…' : 'Approve'}</Button>}{stagedWithRows && canReview && reviewOpen && <Button variant="quiet" disabled={busy === item.id} onClick={() => void revokeReview(item)}>{busy === item.id ? 'Revoking…' : 'Revoke'}</Button>}{stagedWithRows && canPublish && reviewStatus === 'APPROVED' && <Button variant="quiet" disabled={busy === item.id} onClick={() => void restore(item)}>{busy === item.id ? 'Restoring…' : 'Restore active'}</Button>}</td></tr>; })}</tbody></table></div></div>}
  </section>;
}

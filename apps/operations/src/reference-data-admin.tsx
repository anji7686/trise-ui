import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, StatePanel } from '@trise/ui';
import { operationsData, type IndiaGeographyEntry, type ReferenceDataImport } from './data';
import { OperationsStatus as Status } from './operations-status';
import { formatIndiaDateTime } from './subscription-support';
import { SearchableSelect, type LookupOption } from './searchable-select';
import { IndiaStateSelect } from './use-india-geography';
import { normalizePincodeScope, readPincodeCsvChoices, type PincodeCsvChoices } from './pincode-csv';
import { OperationsDialog } from './operations-dialog';

const shortReference = (value: string) => value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;

export function ReferenceDataAdmin({ platformCapabilities = [], currentUserId = '' }: { platformCapabilities?: string[]; currentUserId?: string }) {
  const [imports, setImports] = useState<ReferenceDataImport[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'COUNTRY' | 'STATE_UT' | 'DISTRICT' | 'CITY' | 'IMPORTS'>('IMPORTS');
  const [query, setQuery] = useState('');
  const [locations, setLocations] = useState<IndiaGeographyEntry[]>([]);
  const [importPanelOpen, setImportPanelOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFileInputKey, setImportFileInputKey] = useState(0);
  const [scopeType, setScopeType] = useState<'ALL_INDIA' | 'STATE_UT' | 'DISTRICT' | 'CITY'>('ALL_INDIA');
  const [scopeState, setScopeState] = useState('');
  const [scopeDistrict, setScopeDistrict] = useState('');
  const [scopeCity, setScopeCity] = useState('');
  const [stateSearch, setStateSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [csvChoices, setCsvChoices] = useState<PincodeCsvChoices | null>(null);
  const [districtCsvBusy, setDistrictCsvBusy] = useState(false);
  const [districtCsvError, setDistrictCsvError] = useState('');
  const stateOptions = useMemo<LookupOption[]>(() => (csvChoices?.states || []).map((name) => ({ id: name, label: name })), [csvChoices]);
  const districtOptions = useMemo<LookupOption[]>(() => (csvChoices?.districtsByState[normalizePincodeScope(scopeState)] || []).map((name) => ({ id: name, label: name })), [csvChoices, scopeState]);
  const cityOptions = useMemo<LookupOption[]>(() => (csvChoices?.citiesByStateDistrict[normalizePincodeScope(scopeState)]?.[normalizePincodeScope(scopeDistrict)] || []).map((name) => ({ id: name, label: name })), [csvChoices, scopeDistrict, scopeState]);
  const [sourcePublishedOn, setSourcePublishedOn] = useState('');
  const [stageBusy, setStageBusy] = useState(false);
  const [stageNotice, setStageNotice] = useState('');
  const [selectedImportId, setSelectedImportId] = useState('');
  const [previewPincode, setPreviewPincode] = useState('');
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof operationsData.previewStagedIndiaPincode>> | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<ReferenceDataImport | null>(null);
  const [restoreError, setRestoreError] = useState('');
  const districtReadSequence = useRef(0);
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

  useEffect(() => {
    const sequence = ++districtReadSequence.current;
    if (!importFile) {
      setCsvChoices(null);
      setDistrictCsvBusy(false);
      setDistrictCsvError('');
      return undefined;
    }
    if (importFile.size > 30 * 1024 * 1024) {
      setDistrictCsvBusy(false);
      setDistrictCsvError('The CSV must be no larger than 30 MiB.');
      return undefined;
    }
    let current = true;
    setDistrictCsvBusy(true);
    setDistrictCsvError('');
    void readPincodeCsvChoices(importFile.stream(), () => current && sequence === districtReadSequence.current)
      .then((choices) => { if (current && sequence === districtReadSequence.current) { setCsvChoices(choices); setScopeState((selected) => choices.states.find((name) => normalizePincodeScope(name) === normalizePincodeScope(selected)) || (choices.states.length === 1 ? choices.states[0] : '')); setScopeType((currentType) => !choices.hasCityColumn && currentType === 'CITY' ? 'DISTRICT' : choices.states.length === 1 && currentType === 'ALL_INDIA' ? 'STATE_UT' : currentType); } })
      .catch((cause) => { if (current && sequence === districtReadSequence.current) setDistrictCsvError((cause as { message?: string }).message || 'Import choices could not be read from this CSV.'); })
      .finally(() => { if (current && sequence === districtReadSequence.current) setDistrictCsvBusy(false); });
    return () => { current = false; };
  }, [importFile]);

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
    setRestoreError('');
    setPendingRestore(item);
  }

  async function confirmRestore() {
    const reviewId = pendingRestore?.attributes.review_id;
    if (!pendingRestore || !reviewId) return;
    const item = pendingRestore;
    setBusy(item.id); setRestoreError('');
    try {
      await operationsData.restoreReferenceDataImport(item.id, reviewId, crypto.randomUUID());
      setPendingRestore(null);
      await load();
    } catch (cause) {
      setRestoreError((cause as { message?: string }).message || 'Reference-data restore was rejected.');
    } finally { setBusy(''); }
  }

  async function stagePincodeFile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setStageNotice(''); setPreview(null);
    if (!importFile) { setError('Choose the Department of Posts CSV file first.'); return; }
    if (importFile.size > 30 * 1024 * 1024) { setError('The CSV must be no larger than 30 MiB.'); return; }
    if (scopeType !== 'ALL_INDIA' && !stateOptions.some((option) => option.id === scopeState)) { setError('Select a State/UT listed in the selected CSV.'); return; }
    if (districtCsvBusy) { setError('Wait for State, district, and city choices to finish loading from the selected CSV.'); return; }
    if (districtCsvError) { setError(districtCsvError); return; }
    if (['DISTRICT', 'CITY'].includes(scopeType) && !districtOptions.some((option) => option.id === scopeDistrict)) { setError('Select a district listed in the selected CSV.'); return; }
    if (scopeType === 'CITY' && (!csvChoices?.hasCityColumn || !cityOptions.some((option) => option.id === scopeCity))) { setError('Select a city listed in the selected CSV.'); return; }

    setStageBusy(true);
    try {
      const imported = await operationsData.stageIndiaPincodeImport({ file: importFile, scopeType,
        state: scopeType === 'ALL_INDIA' ? undefined : scopeState.trim(),
        district: ['DISTRICT', 'CITY'].includes(scopeType) ? scopeDistrict.trim() : undefined,
        city: scopeType === 'CITY' ? scopeCity.trim() : undefined,
        sourcePublishedOn: sourcePublishedOn || undefined, key: crypto.randomUUID() });
      setImports((current) => [imported, ...current.filter((item) => item.id !== imported.id)].slice(0, 25));
      setSelectedImportId(imported.id);
      setPreviewPincode('');
      setStageNotice(`A complete PIN snapshot is staged with ${String(imported.attributes.counts.snapshot_rows ?? imported.attributes.counts.accepted ?? 0)} rows. It is not active until reviewed and restored.`);
      setImportFile(null);
      setCsvChoices(null);
      setImportFileInputKey((current) => current + 1);
    } catch (cause) {
      setError((cause as { message?: string }).message || 'The PIN directory could not be staged.');
    } finally { setStageBusy(false); }
  }

  async function previewPincodeJson(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setStageNotice(''); setPreview(null);
    if (!selectedImportId) { setError('Select a staged or active PIN dataset version.'); return; }
    const pincode = previewPincode.trim();
    if (!/^[1-9]\d{5}$/.test(pincode)) { setError('Enter a valid six-digit Indian PIN code.'); return; }
    setPreviewBusy(true);
    try { setPreview(await operationsData.previewStagedIndiaPincode(selectedImportId, pincode)); }
    catch (cause) { setError((cause as { message?: string }).message || 'The PIN lookup preview could not be loaded.'); }
    finally { setPreviewBusy(false); }
  }

  function downloadPreviewJson() {
    if (!preview) return;
    const blob = new Blob([`${JSON.stringify(preview, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `india-pin-${preview.data.pincode}-${selectedImportId.slice(0, 8)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const tabs: Array<[typeof tab, string]> = [['COUNTRY', 'Countries'], ['STATE_UT', 'States'], ['DISTRICT', 'Districts'], ['CITY', 'Cities'], ['IMPORTS', 'Import history']];

  return <section className="platform-reference-page reference-data-admin">
    <div className="reference-breadcrumb"><span>Platform administration</span><span>›</span><strong>Reference data</strong></div>
    <div className="reference-page-heading">
      <div><span className="reference-eyebrow">Platform administration / Master data</span><h1>Reference data</h1><p>Manage versioned India geography and PIN-code datasets used by searchable selectors.</p></div>
      <div className="reference-heading-actions"><label className="reference-search"><input aria-label="Search reference data" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search countries, states or cities..." /></label><Button disabled={!canPublish} title={!canPublish ? 'Platform configuration publish access is required.' : undefined} onClick={() => { setTab('IMPORTS'); setImportPanelOpen((current) => !current); }}>Import PIN directory</Button></div>
    </div>
    <div className="reference-tabs">{tabs.map(([value, label]) => <button className={tab === value ? 'active' : ''} type="button" key={value} onClick={() => setTab(value)}>{label}</button>)}</div>
    {error && <StatePanel title="Reference-data action needs attention"><span>{error}</span><Button onClick={() => tab === 'IMPORTS' ? void load() : setTab(tab)}>Retry</Button></StatePanel>}
    {tab === 'IMPORTS' && importPanelOpen && <div className="reference-table-card reference-pin-import-panel">
      <div className="reference-pin-import-intro"><div><h2>Import India PIN directory</h2><p>Choose the official monthly CSV. A successful import creates a staged version for review; it does not change the active lookup data.</p></div></div>
      <form onSubmit={(event) => void stagePincodeFile(event)}>
        <div className="platform-form-grid">
          <label>Import scope<select value={scopeType} onChange={(event) => { const nextScope = event.target.value as typeof scopeType; setScopeType(nextScope); if (nextScope === 'ALL_INDIA') { setScopeState(''); setScopeDistrict(''); setScopeCity(''); setStateSearch(''); setDistrictSearch(''); setCitySearch(''); } else if (nextScope === 'STATE_UT') { setScopeDistrict(''); setScopeCity(''); setDistrictSearch(''); setCitySearch(''); } else if (nextScope === 'DISTRICT') { setScopeCity(''); setCitySearch(''); } }} disabled={stageBusy}><option value="ALL_INDIA">All India snapshot (complete file)</option><option value="STATE_UT">One State/UT</option><option value="DISTRICT">One district</option><option value="CITY" disabled={!csvChoices?.hasCityColumn}>One city (requires City/City Name/Town)</option></select><small>Scoped imports preserve rows outside the selected scope. Import the complete India snapshot before a scoped refresh.</small></label>
          {scopeType !== 'ALL_INDIA' && (csvChoices ? <SearchableSelect label="State / UT" searchLabel="Search states in this CSV" search={stateSearch} onSearch={setStateSearch} value={scopeState} onChange={(value) => { setScopeState(value); setScopeDistrict(''); setScopeCity(''); setDistrictSearch(''); setCitySearch(''); }} options={stateOptions} placeholder="Select a State/UT from the uploaded CSV" disabled={stageBusy || districtCsvBusy || !stateOptions.length} /> : <IndiaStateSelect value={scopeState} onChange={(value) => { setScopeState(value); setScopeDistrict(''); setScopeCity(''); setDistrictSearch(''); setCitySearch(''); }} required disabled={stageBusy || districtCsvBusy} />)}
          {['DISTRICT', 'CITY'].includes(scopeType) && <div className="reference-pin-district-field"><SearchableSelect label="District" searchLabel="Search districts in this CSV" search={districtSearch} onSearch={setDistrictSearch} value={scopeDistrict} onChange={(value) => { setScopeDistrict(value); setScopeCity(''); setCitySearch(''); }} options={districtOptions} placeholder="Select a district from the uploaded CSV" disabled={stageBusy || districtCsvBusy || !districtOptions.length} /><small aria-live="polite">{districtCsvBusy ? 'Reading locations from the selected CSV…' : districtCsvError || (districtOptions.length ? `${districtOptions.length} districts found for ${scopeState}.` : importFile ? `No district values for ${scopeState} were found in this CSV.` : 'Choose a CSV and State/UT to load district choices.')}</small></div>}
          {scopeType === 'CITY' && <div className="reference-pin-district-field"><SearchableSelect label="City" searchLabel="Search cities in this CSV" search={citySearch} onSearch={setCitySearch} value={scopeCity} onChange={setScopeCity} options={cityOptions} placeholder="Select a city from the uploaded CSV" disabled={stageBusy || districtCsvBusy || !cityOptions.length} /><small aria-live="polite">{districtCsvBusy ? 'Reading city values from the selected CSV…' : !csvChoices?.hasCityColumn ? 'This CSV has no City/City Name/Town column. City-scoped import is unavailable.' : cityOptions.length ? `${cityOptions.length} cities found for ${scopeDistrict}.` : `No city values for ${scopeDistrict} were found in this CSV.`}</small></div>}
          <label>Department of Posts CSV<input key={importFileInputKey} type="file" accept=".csv,text/csv" onChange={(event) => { setImportFile(event.target.files?.[0] || null); setCsvChoices(null); setScopeDistrict(''); setScopeCity(''); setDistrictSearch(''); setCitySearch(''); setDistrictCsvError(''); }} disabled={stageBusy} required /><small>{importFile ? `${importFile.name} · ${(importFile.size / (1024 * 1024)).toFixed(1)} MiB` : 'Maximum 30 MiB. Required columns: PIN code, office name, district, and state. City scope requires a City/City Name/Town column.'}</small></label>
          <label>Source published on <span className="optional">Optional</span><input type="date" value={sourcePublishedOn} onChange={(event) => setSourcePublishedOn(event.target.value)} disabled={stageBusy} /></label>
        </div>
        <p className="platform-form-note">State, district, and optional City/City Name/Town choices are extracted from the uploaded CSV. City values are source labels and are never inferred from PIN codes or geography names. Scoped refreshes require an active all-India snapshot and a complete file for the selected scope.</p>
        <div className="reference-pin-import-actions"><Button type="submit" busy={stageBusy} disabled={!canPublish || stageBusy || districtCsvBusy}>{stageBusy ? 'Validating and staging…' : 'Validate and stage'}</Button><Button type="button" variant="secondary" disabled={stageBusy} onClick={() => setImportPanelOpen(false)}>Close</Button></div>
      </form>
    </div>}
    {tab === 'IMPORTS' && stageNotice && <p className="reference-pin-import-success" role="status">{stageNotice}</p>}
    {tab === 'IMPORTS' && <div className="reference-table-card reference-pin-json-panel">
      <div className="reference-pin-import-intro"><div><h2>Preview lookup JSON</h2><p>Inspect or download the exact response shape for one PIN from a selected import version.</p></div></div>
      <form className="reference-pin-json-form" onSubmit={(event) => void previewPincodeJson(event)}>
        <label>Dataset version<select value={selectedImportId} onChange={(event) => { setSelectedImportId(event.target.value); setPreview(null); }}><option value="">Choose an import</option>{imports.filter((item) => item.attributes.dataset_kind === 'INDIA_PINCODES').map((item) => <option key={item.id} value={item.id}>{item.attributes.source_filename || 'PIN dataset'} · {item.attributes.status} · {shortReference(item.id)}</option>)}</select></label>
        <label>PIN code<input inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} value={previewPincode} onChange={(event) => { setPreviewPincode(event.target.value.replace(/\D/g, '').slice(0, 6)); setPreview(null); }} placeholder="560036" /></label>
        <Button type="submit" variant="secondary" busy={previewBusy} disabled={previewBusy || !selectedImportId || !/^[1-9]\d{5}$/.test(previewPincode.trim())}>Preview JSON</Button>
        {preview && <Button type="button" variant="quiet" onClick={downloadPreviewJson}>Download JSON</Button>}
      </form>
      {preview && <pre className="reference-pin-json-output" aria-live="polite">{JSON.stringify(preview, null, 2)}</pre>}
    </div>}
    {loading ? <p className="notice">Loading reference data…</p> : tab !== 'IMPORTS' ? <div className="reference-table-card"><div className="reference-table-scroll"><table className="reference-table"><caption className="sr-only">India {tab.toLowerCase()} reference entries</caption><thead><tr><th>Name</th><th>Code</th><th>Parent</th><th>State</th><th>Status</th></tr></thead><tbody>{locations.map((item) => <tr key={item.id}><td><strong>{item.attributes.name}</strong></td><td>{item.attributes.code}</td><td>{item.attributes.parent_code || '—'}</td><td>{item.attributes.state_code || '—'}</td><td><Status>ACTIVE</Status></td></tr>)}{!locations.length && <tr><td colSpan={5}><p className="notice">No matching entries.</p></td></tr>}</tbody></table></div></div> : !error && imports.length === 0 ? <p className="notice">No reference-data imports have been recorded.</p> : <div className="reference-table-card"><div className="reference-table-scroll"><table className="reference-table"><caption className="sr-only">Reference-data import history</caption><thead><tr><th>Dataset</th><th>Status</th><th>Review</th><th>Source</th><th>Rows</th><th>Retrieved</th><th>Lineage</th><th>Actions</th></tr></thead><tbody>{imports.map((item) => { const reviewStatus = item.attributes.review_status || 'NOT_SUBMITTED'; const stagedWithRows = item.attributes.status === 'STAGED' && String(item.attributes.counts.snapshot_rows ?? item.attributes.counts.accepted ?? item.attributes.counts.read ?? 0) !== '0'; const reviewOpen = ['PENDING', 'APPROVED'].includes(reviewStatus); const ownPendingReview = reviewStatus === 'PENDING' && Boolean(currentUserId) && item.attributes.review_submitted_by_user_id === currentUserId; const importReference = item.id; return <tr key={item.id}><td><strong>{item.attributes.dataset_kind === 'INDIA_GEOGRAPHY' ? 'India geography' : 'India PIN codes'}</strong><small title={importReference}>Import {shortReference(importReference)}</small></td><td><Status>{item.attributes.status}</Status></td><td><Status>{reviewStatus}</Status>{ownPendingReview && <small>Self-approval will be recorded in the audit trail</small>}</td><td>{item.attributes.source_filename || item.attributes.source_url || 'Not recorded'}<small>{item.attributes.sha256 ? `SHA-256 ${item.attributes.sha256.slice(0, 12)}…` : 'Checksum unavailable'}</small></td><td>{String(item.attributes.counts.snapshot_rows ?? item.attributes.counts.accepted ?? item.attributes.counts.read ?? 0)}</td><td>{item.attributes.retrieved_at ? formatIndiaDateTime(item.attributes.retrieved_at) : 'Not available'}</td><td>{item.attributes.supersedes_id ? <small title={item.attributes.supersedes_id}>Supersedes {shortReference(item.attributes.supersedes_id)}</small> : <small>Baseline / first version</small>}</td><td>{stagedWithRows && canReview && !reviewOpen && <Button variant="quiet" disabled={busy === item.id} onClick={() => void submitReview(item)}>{busy === item.id ? 'Submitting…' : 'Submit review'}</Button>}{stagedWithRows && canReview && reviewStatus === 'PENDING' && <Button variant="quiet" disabled={busy === item.id} title={ownPendingReview ? 'Self-approval will be recorded in the audit trail.' : undefined} onClick={() => void approveReview(item)}>{busy === item.id ? 'Approving…' : 'Approve'}</Button>}{stagedWithRows && canReview && reviewOpen && <Button variant="quiet" disabled={busy === item.id} onClick={() => void revokeReview(item)}>{busy === item.id ? 'Revoking…' : 'Revoke'}</Button>}{stagedWithRows && canPublish && reviewStatus === 'APPROVED' && <Button variant="quiet" disabled={busy === item.id} onClick={() => void restore(item)}>{busy === item.id ? 'Restoring…' : 'Restore active'}</Button>}</td></tr>; })}</tbody></table></div></div>}
    {pendingRestore && <OperationsDialog title="Restore reference data?" busy={busy === pendingRestore.id} onClose={() => { setPendingRestore(null); setRestoreError(''); }} className="reference-data-restore-dialog">
      <p>Restore {pendingRestore.attributes.dataset_kind} import {pendingRestore.id.slice(0, 8)}? The current active dataset will be retained as a previous version.</p>
      {restoreError && <p className="error" role="alert">{restoreError}</p>}
      <div className="platform-form-actions"><Button type="button" variant="secondary" disabled={busy === pendingRestore.id} onClick={() => { setPendingRestore(null); setRestoreError(''); }}>Cancel</Button><Button type="button" busy={busy === pendingRestore.id} disabled={busy === pendingRestore.id} onClick={() => void confirmRestore()}>Restore active dataset</Button></div>
    </OperationsDialog>}
  </section>;
}

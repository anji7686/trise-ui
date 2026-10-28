import { useEffect, useState, type FormEvent } from 'react';
import { Button, StatePanel, SortedSelect } from '@trise/ui';
import { operationsData, type PlatformBillingSetup, type PlatformSaasTaxConfiguration, type PlatformTaxClassification, type PlatformTaxLegalSource, type PlatformTaxProfile, type Resource } from '../../data';
import { OperationsStatus as Status } from '../../operations-status';
import { AdminActionMenu, AdminDataTable, AdminEmptyState } from '../../platform-admin-ui';
import { IndiaStateSelect } from '../../use-india-geography';

type Registration = PlatformTaxProfile['attributes']['registrations'][number];

const messageFor = (error: unknown) => (error as { message?: string })?.message || 'Billing setup could not be loaded. Retry or contact support.';
const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());

function statusLabel(value: string) {
  return <Status>{titleCase(value)}</Status>;
}

export function TaxBillingSetupPage({ capabilities }: { capabilities: string[] }) {
  const canWrite = capabilities.includes('PLATFORM_TAX_WRITE');
  const canReview = capabilities.includes('PLATFORM_TAX_REVIEW');
  const canPublish = capabilities.includes('PLATFORM_TAX_PUBLISH');
  const [setup, setSetup] = useState<PlatformBillingSetup | null>(null);
  const [classifications, setClassifications] = useState<Resource<PlatformTaxClassification['attributes']>[]>([]);
  const [sources, setSources] = useState<Resource<PlatformTaxLegalSource['attributes']>[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [profileForm, setProfileForm] = useState({ legal_name: '', address: '' });
  const [registration, setRegistration] = useState({ gstin: '', registration_category: 'REGISTERED', state_or_union_territory: '', effective_from: new Date().toISOString().slice(0, 10) });
  const [config, setConfig] = useState({ classification_id: '', legal_source_id: '', effective_from: new Date().toISOString().slice(0, 10), description: 'TRISE SaaS subscription tax configuration', change_reason: '' });

  async function load() {
    setError('');
    try {
      const [response, classificationResponse, sourceResponse] = await Promise.all([operationsData.platformBillingSetup(), operationsData.platformTaxClassifications(), operationsData.platformTaxLegalSources()]);
      setSetup(response.data); setClassifications(classificationResponse.data); setSources(sourceResponse.data);
      const profile = response.data.profile;
      if (profile) setProfileForm({ legal_name: profile.attributes.legal_name || '', address: Object.values(profile.attributes.registered_address || {}).filter(Boolean).join(', ') });
    } catch (cause) {
      setError(messageFor(cause));
    }
  }

  useEffect(() => { void load(); }, []);

  async function mutate(action: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await action(); await load(); } catch (cause) { setError(messageFor(cause)); } finally { setBusy(false); }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    await mutate(() => operationsData.updatePlatformTaxProfile({ legal_name: profileForm.legal_name, registered_address: { line1: profileForm.address }, billing_address: { line1: profileForm.address }, status: 'ACTIVE' }, crypto.randomUUID()));
  }

  async function addRegistration(event: FormEvent) {
    event.preventDefault();
    if (!setup?.profile) return;
    const profileId = setup.profile.id;
    await mutate(() => operationsData.createPlatformTaxRegistration(profileId, registration, crypto.randomUUID()));
    setRegistration(current => ({ ...current, gstin: '', state_or_union_territory: '' }));
  }

  async function verifyRegistration(item: Registration) {
    if (!setup?.profile || !window.confirm('Confirm that the official GST registration evidence was reviewed?')) return;
    const note = window.prompt('Verification note');
    if (!note?.trim()) return;
    await mutate(() => operationsData.verifyPlatformTaxRegistration(setup.profile!.id, item.id, { expected_revision: item.attributes.revision, document_reviewed: true, verification_note: note }, crypto.randomUUID()));
  }

  async function setDefault(item: Registration) {
    if (!setup?.profile) return;
    await mutate(() => operationsData.setDefaultPlatformTaxRegistration(setup.profile!.id, item.id, crypto.randomUUID()));
  }

  async function saveConfiguration(event: FormEvent) {
    event.preventDefault();
    await mutate(() => operationsData.createPlatformSaasTaxConfiguration({ product_code: 'TRISE_SAAS_SUBSCRIPTION', ...config }, crypto.randomUUID()));
    setConfig(current => ({ ...current, classification_id: '', legal_source_id: '', change_reason: '' }));
  }

  async function configurationAction(item: PlatformSaasTaxConfiguration, action: 'submit' | 'approve' | 'publish') {
    const key = crypto.randomUUID();
    if (action === 'submit') return mutate(() => operationsData.submitPlatformSaasTaxConfiguration(item.id, key));
    if (action === 'approve') return mutate(() => operationsData.approvePlatformSaasTaxConfiguration(item.id, key));
    return mutate(() => operationsData.publishPlatformSaasTaxConfiguration(item.id, key));
  }

  if (error && !setup) return <StatePanel title="Billing setup needs attention"><span>{error}</span><Button onClick={() => void load()}>Retry</Button></StatePanel>;
  if (!setup) return <StatePanel title="Loading billing setup">Retrieving issuer, registration and SaaS tax readiness…</StatePanel>;

  const profile = setup.profile;
  const registrations = profile?.attributes.registrations || [];
  const configurations = setup.configurations;
  return <section className="tax-billing-setup">
    <div className="tax-billing-setup-heading"><div><p className="platform-eyebrow">Platform administration / Finance &amp; Taxation</p><h2>Central Billing Setup</h2><p className="platform-muted">Configure TRISE issuing entity, GST registrations and SaaS subscription tax setup for authoritative subscription billing.</p></div><div className="tax-billing-readiness-summary"><span>Central billing readiness</span>{statusLabel(setup.readiness)}<strong>{setup.active_registration_count} active GST registration{setup.active_registration_count === 1 ? '' : 's'}</strong></div></div>
    {error && <div className="tax-billing-error" role="alert"><strong>Setup action needs attention</strong><span>{error}</span><Button variant="quiet" onClick={() => void load()}>Retry</Button></div>}
    <div className="tax-billing-layout"><div className="tax-billing-steps">
      <article className="tax-billing-card"><div className="tax-billing-card-header"><div><span className="tax-billing-step">1</span><div><h3>Issuer profile</h3><p>Identify the TRISE legal entity that issues subscription invoices.</p></div></div>{statusLabel(setup.issuer_profile_status)}</div><form className="platform-form-grid" onSubmit={saveProfile}><label>Legal name<input required disabled={!canWrite} value={profileForm.legal_name} onChange={event => setProfileForm({ ...profileForm, legal_name: event.target.value })} /></label><label>Registered address<input required disabled={!canWrite} value={profileForm.address} onChange={event => setProfileForm({ ...profileForm, address: event.target.value })} /></label><div className="platform-form-actions"><Button type="submit" disabled={!canWrite || busy} busy={busy}>Save issuer profile</Button></div></form></article>

      <article className={`tax-billing-card${!profile ? ' tax-billing-card-locked' : ''}`}><div className="tax-billing-card-header"><div><span className="tax-billing-step">2</span><div><h3>GST registrations</h3><p>Add and verify registrations used by the issuing entity.</p></div></div>{statusLabel(setup.gst_registration_status)}</div>{!profile ? <AdminEmptyState title="Add issuer profile first" description="GST registrations can be added after the TRISE issuer profile is saved." /> : <><AdminDataTable><table className="platform-provider-table"><thead><tr><th>GSTIN</th><th>State / UT</th><th>Status</th><th>Default</th><th>Actions</th></tr></thead><tbody>{registrations.map(item => <tr key={item.id}><td>{item.attributes.gstin || 'Not applicable'}</td><td>{item.attributes.state_or_union_territory}</td><td>{statusLabel(item.attributes.verification_status)}</td><td>{item.attributes.is_default ? 'Default' : '—'}</td><td><AdminActionMenu label={`Actions for ${item.attributes.gstin || 'GST registration'}`}>{item.attributes.verification_status === 'PENDING' && canReview && <button type="button" disabled={busy} onClick={() => void verifyRegistration(item)}>Verify</button>}{item.attributes.verification_status === 'VERIFIED' && !item.attributes.is_default && canWrite && <button type="button" disabled={busy} onClick={() => void setDefault(item)}>Set default</button>}</AdminActionMenu></td></tr>)}</tbody></table>{!registrations.length && <AdminEmptyState title="No GST registrations added yet" description="Add a registration, then complete the authorized evidence review." />}</AdminDataTable><form className="platform-form-grid tax-billing-subform" onSubmit={addRegistration}><h4>Add GST registration</h4><label>GSTIN<input disabled={!canWrite} maxLength={15} pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]" title="Enter a valid 15-character GSTIN, or leave it blank for an unregistered category." value={registration.gstin} onChange={event => setRegistration({ ...registration, gstin: event.target.value.toUpperCase() })} /></label><label>Registration category<SortedSelect disabled={!canWrite} value={registration.registration_category} onChange={event => setRegistration({ ...registration, registration_category: event.target.value })}><option>REGISTERED</option><option>UNREGISTERED</option><option>COMPOSITION</option></SortedSelect></label><IndiaStateSelect value={registration.state_or_union_territory} onChange={value => setRegistration({ ...registration, state_or_union_territory: value })} required disabled={!canWrite} /><label>Effective from<input required disabled={!canWrite} type="date" value={registration.effective_from} onChange={event => setRegistration({ ...registration, effective_from: event.target.value })} /></label><div className="platform-form-actions"><Button type="submit" disabled={!canWrite || busy} busy={busy}>Add registration</Button></div></form></>}</article>

      <article className={`tax-billing-card${!profile || registrations.length === 0 ? ' tax-billing-card-locked' : ''}`}><div className="tax-billing-card-header"><div><span className="tax-billing-step">3</span><div><h3>SaaS subscription tax configuration</h3><p>Choose the approved classification and verified source used by central subscription billing.</p></div></div>{statusLabel(setup.saas_configuration_status)}</div>{!profile || registrations.length === 0 ? <AdminEmptyState title="Add a GST registration first" description="A SaaS configuration is available after the issuer profile and at least one registration exist." /> : <><form className="platform-form-grid" onSubmit={saveConfiguration}><label>Approved SaaS classification<SortedSelect required disabled={!canWrite} value={config.classification_id} onChange={event => setConfig({ ...config, classification_id: event.target.value })}><option value="">Select approved classification</option>{classifications.filter(item => item.attributes.status === 'ACTIVE').map(item => <option key={item.id} value={item.id}>{item.attributes.classification_code} · {item.attributes.description}</option>)}</SortedSelect></label><label>Verified legal source<SortedSelect required disabled={!canWrite} value={config.legal_source_id} onChange={event => setConfig({ ...config, legal_source_id: event.target.value })}><option value="">Select verified source</option>{sources.filter(item => item.attributes.verification_status === 'VERIFIED').map(item => <option key={item.id} value={item.id}>{item.attributes.notification_number}</option>)}</SortedSelect></label><label>Effective from<input required disabled={!canWrite} type="date" value={config.effective_from} onChange={event => setConfig({ ...config, effective_from: event.target.value })} /></label><label>Description<input required disabled={!canWrite} value={config.description} onChange={event => setConfig({ ...config, description: event.target.value })} /></label><div className="platform-form-actions"><Button type="submit" disabled={!canWrite || busy} busy={busy}>Save configuration draft</Button></div></form><p className="platform-form-note">Published central billing configuration is used by subscription billing tax preview and invoice issuance.</p><AdminDataTable><table className="platform-provider-table"><thead><tr><th>Classification</th><th>Effective from</th><th>Status</th><th>Actions</th></tr></thead><tbody>{configurations.map(item => <tr key={item.id}><td>{item.attributes.classification.code}</td><td>{item.attributes.effective_from}</td><td>{statusLabel(item.attributes.status)}</td><td><AdminActionMenu label={`Actions for ${item.attributes.classification.code}`}>{item.attributes.status === 'DRAFT' && canWrite && <button type="button" disabled={busy} onClick={() => void configurationAction(item, 'submit')}>Submit review</button>}{item.attributes.status === 'IN_REVIEW' && canReview && <button type="button" disabled={busy} onClick={() => void configurationAction(item, 'approve')}>Approve</button>}{item.attributes.status === 'APPROVED' && canPublish && <button type="button" disabled={busy} onClick={() => void configurationAction(item, 'publish')}>Publish</button>}</AdminActionMenu></td></tr>)}</tbody></table>{!configurations.length && <AdminEmptyState title="No SaaS tax configuration created yet" description="Create a draft after selecting an approved classification and verified source." />}</AdminDataTable></>}</article>

      <article className="tax-billing-card"><div className="tax-billing-card-header"><div><span className="tax-billing-step">4</span><div><h3>Review &amp; activate</h3><p>Confirm every dependency before central tax billing is used.</p></div></div>{statusLabel(setup.readiness)}</div><ul className="tax-billing-checklist">{setup.blockers.length ? setup.blockers.map(blocker => <li key={blocker} className="tax-billing-check tax-billing-check-blocked">{blocker}</li>) : <li className="tax-billing-check tax-billing-check-ready">Central billing setup is ready for eligible subscription transactions.</li>}</ul><p className="platform-form-note">Structural GST templates do not activate billing. Only an approved, published configuration with verified legal context can be used.</p></article>
    </div><aside className="tax-billing-sidecard"><h3>Setup summary</h3><dl><dt>Issuer profile</dt><dd>{statusLabel(setup.issuer_profile_status)}</dd><dt>Active GST registrations</dt><dd>{setup.active_registration_count}</dd><dt>Default GST registration</dt><dd>{setup.default_registration_id ? 'Selected' : 'Not selected'}</dd><dt>SaaS configuration</dt><dd>{statusLabel(setup.saas_configuration_status)}</dd><dt>Central billing</dt><dd>{statusLabel(setup.readiness)}</dd></dl><div className="platform-form-actions"><button className="admin-inline-link" onClick={() => { window.location.hash = 'platform/taxes?tab=rules'; }}>Go to Tax Rules</button><button className="admin-inline-link" onClick={() => { window.location.hash = 'platform/taxes?tab=sources'; }}>Go to Legal Sources</button><button className="admin-inline-link" onClick={() => { window.location.hash = 'platform/subscriptions'; }}>Go to Billing &amp; Payments</button></div></aside></div>
  </section>;
}

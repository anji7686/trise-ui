import { useEffect, useState } from 'react';
import { Button } from '@trise/ui';
import { operationsData, type PlatformProviderAttributes } from './data';
import { SearchableSelect } from './searchable-select';
import { SvgIcon } from './icons';

type ProviderRecord = { id: string; attributes: Pick<PlatformProviderAttributes, 'display_name' | 'provider_code' | 'business_name' | 'status'> };
type ProviderOverrideDraft = {
  coverage: { inheritance: string; state_codes: string[]; city_codes: string[] };
  modules: { inheritance: string; enabled: string[] };
  sla: { inheritance: string; tier: string };
  approval: { inheritance: string; required: boolean };
  effective_dates: { inheritance: string; from: string; to: string | null };
};
type ProviderOverrideSection = keyof ProviderOverrideDraft;

const providerModuleLabels: Record<string, string> = {
  SERVICE_REQUESTS: 'Service Requests', WORK_ORDERS: 'Work Orders', ASSET_MANAGEMENT: 'Asset Management',
  INVOICING: 'Invoicing', REPORTS: 'Reports', SPARE_PARTS: 'Spare Parts', INSPECTIONS: 'Inspections',
  CUSTOMER_PORTAL: 'Customer Portal', API_ACCESS: 'API Access',
};
const defaultProviderOverride: ProviderOverrideDraft = {
  coverage: { inheritance: 'OVERRIDE', state_codes: ['MH', 'KA'], city_codes: ['MUMBAI', 'PUNE', 'BENGALURU'] },
  modules: { inheritance: 'OVERRIDE', enabled: Object.keys(providerModuleLabels) },
  sla: { inheritance: 'OVERRIDE', tier: 'PREMIUM_24H' },
  approval: { inheritance: 'OVERRIDE', required: true },
  effective_dates: { inheritance: 'OVERRIDE', from: '2025-03-01', to: null },
};
const inheritanceOptions = ['Inherited from platform', 'Inherited from Elevator & Lift Services', 'Override'];
const inheritanceLabel = (value: string) => value === 'PLATFORM' ? 'Inherited from platform' : value === 'BUSINESS' ? 'Inherited from Elevator & Lift Services' : 'Override';
const inheritanceCode = (value: string) => value === 'Inherited from platform' ? 'PLATFORM' : value === 'Inherited from Elevator & Lift Services' ? 'BUSINESS' : 'OVERRIDE';
const errorText = (cause: unknown, fallback: string) => (cause as { message?: string })?.message || fallback;

function StatusPill({ value }: { value: string }) {
  const tone = ['ACTIVE', 'Enabled', 'Active'].includes(value) ? 'success' : ['PENDING', 'In review'].includes(value) ? 'warning' : 'neutral';
  return <span className={`reference-status reference-status-${tone}`}>{value}</span>;
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return <button type="button" className={`reference-toggle${enabled ? ' is-on' : ''}`} aria-pressed={enabled} onClick={onChange}><span /></button>;
}

function providerLabel(provider: ProviderRecord) {
  return provider.attributes.display_name || provider.attributes.provider_code || provider.id;
}

export function ProviderOverridesAdmin({ platformCapabilities = [], currentUserId = '' }: { platformCapabilities?: string[]; currentUserId?: string }) {
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [providerId, setProviderId] = useState(new URLSearchParams(window.location.hash.split('?')[1] || '').get('provider_id') || '');
  const [providerSearch, setProviderSearch] = useState('');
  const [providerName, setProviderName] = useState('Select a provider');
  const [configuration, setConfiguration] = useState<ProviderOverrideDraft>(defaultProviderOverride);
  const [providerRevision, setProviderRevision] = useState(0);
  const [draftRevision, setDraftRevision] = useState(0);
  const [reviewId, setReviewId] = useState('');
  const [reviewStatus, setReviewStatus] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const canReview = platformCapabilities.includes('PLATFORM_CONFIGURATION_REVIEW');
  const canRevokeReview = canReview && ['PENDING', 'APPROVED'].includes(reviewStatus);

  useEffect(() => {
    operationsData.platformProviders().then((result) => {
      const next = result.data.map((item) => ({ id: item.id, attributes: { display_name: item.attributes.display_name, provider_code: item.attributes.provider_code, business_name: item.attributes.business_name, status: item.attributes.status } }));
      setProviders(next);
      setProviderId((current) => current || next[0]?.id || '');
    }).catch((cause) => setError(errorText(cause, 'Provider directory could not be loaded.')));
  }, []);

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
    }).catch((cause) => { if (current) setError(errorText(cause, 'Provider override configuration could not be loaded.')); }).finally(() => { if (current) setBusy(''); });
    return () => { current = false; };
  }, [providerId]);

  const setSection = (section: ProviderOverrideSection, value: Record<string, unknown>) => setConfiguration((current) => ({ ...current, [section]: { ...current[section], ...value } }));
  const setInheritance = (section: ProviderOverrideSection, value: string) => setSection(section, { inheritance: inheritanceCode(value) });
  const sectionInheritance = (section: ProviderOverrideSection) => inheritanceLabel(String(configuration[section]?.inheritance || 'OVERRIDE'));
  const providerOptions = providers.map((provider) => ({ id: provider.id, label: providerLabel(provider), detail: [provider.attributes.provider_code, provider.attributes.business_name].filter(Boolean).join(' · ') || provider.attributes.status || 'Provider account' }));
  const selectedProvider = providers.find((provider) => provider.id === providerId);

  async function save() {
    if (!providerId) return;
    setBusy('save'); setError(''); setMessage('');
    try {
      const result = await operationsData.updatePlatformProviderConfigurationOverride(providerId, { expected_revision: providerRevision, configuration }, crypto.randomUUID());
      setProviderRevision(result.data.attributes.provider_revision); setDraftRevision(result.data.attributes.draft?.revision || 0); setReviewId(''); setReviewStatus(''); setMessage('Draft saved by the server.');
    } catch (cause) { setError(errorText(cause, 'Provider override draft could not be saved.')); } finally { setBusy(''); }
  }

  async function publish() {
    if (!providerId || !draftRevision || !reviewId) return;
    setBusy('publish'); setError(''); setMessage('');
    try {
      const result = await operationsData.publishPlatformProviderConfigurationOverride(providerId, { expected_revision: providerRevision, review_id: reviewId }, crypto.randomUUID());
      setProviderRevision(result.data.attributes.provider_revision); setDraftRevision(result.data.attributes.active?.revision || 0); setReviewStatus('CONSUMED'); setMessage('Approved provider configuration published.');
    } catch (cause) { setError(errorText(cause, 'Provider override could not be published.')); } finally { setBusy(''); }
  }

  async function submit() {
    if (!providerId || !draftRevision) { setError('Save the provider override before submitting it for review.'); return; }
    setBusy('submit'); setError(''); setMessage('');
    try {
      const result = await operationsData.submitPlatformProviderConfigurationOverrideReview(providerId, { expected_revision: draftRevision, reason: 'Provider override update from Platform Administration' }, crypto.randomUUID());
      setReviewId(result.id); setReviewStatus(result.attributes.status || 'PENDING'); setMessage('Submitted for review. The review actions are available below for authorized platform reviewers.');
    } catch (cause) { setError(errorText(cause, 'Provider override review submission was rejected.')); } finally { setBusy(''); }
  }

  async function approveReview() {
    if (!providerId || !reviewId || !canReview) return;
    setBusy('approve'); setError(''); setMessage('');
    try {
      const result = await operationsData.approvePlatformProviderConfigurationOverrideReview(providerId, reviewId, crypto.randomUUID());
      setReviewStatus(result.attributes.status || 'APPROVED'); setMessage('Provider override review approved. Publish it when the change is ready to take effect.');
    } catch (cause) { setError(errorText(cause, 'Provider override review approval was rejected.')); } finally { setBusy(''); }
  }

  async function revokeReview() {
    if (!providerId || !reviewId || !canReview) return;
    if (!window.confirm('Revoke this provider override review? The draft will remain available for correction and resubmission.')) return;
    setBusy('revoke'); setError(''); setMessage('');
    try {
      const result = await operationsData.revokePlatformProviderConfigurationOverrideReview(providerId, reviewId, 'Provider override review revoked by Platform Administration', crypto.randomUUID());
      setReviewStatus(result.attributes.status || 'REVOKED'); setMessage('Provider override review revoked. Update the draft and submit it again when ready.');
    } catch (cause) { setError(errorText(cause, 'Provider override review revocation was rejected.')); } finally { setBusy(''); }
  }

  const sections: Array<{ key: ProviderOverrideSection; title: string; description: string; icon: 'map-pin' | 'grid' | 'activity' | 'shield' | 'calendar' }> = [
    { key: 'coverage', title: 'Service coverage', description: 'Select the India states and cities where this provider can offer services.', icon: 'map-pin' },
    { key: 'modules', title: 'Enabled modules', description: 'Select platform modules to enable for this provider.', icon: 'grid' },
    { key: 'sla', title: 'SLA', description: 'Set the service level agreement for this provider.', icon: 'activity' },
    { key: 'approval', title: 'Approval required', description: 'Require internal approval for key actions for this provider.', icon: 'shield' },
    { key: 'effective_dates', title: 'Effective dates', description: 'Specify when these overrides should take effect.', icon: 'calendar' },
  ];

  return <section className="platform-reference-page platform-reference-overrides">
    <div className="reference-breadcrumb"><button type="button" onClick={() => { window.location.hash = 'platform/configuration'; }}>Configuration</button><SvgIcon name="chevron-right" size={14} /><strong>Provider overrides</strong></div>
    <div className="reference-page-heading"><div><span className="reference-eyebrow">Provider configuration</span><h1>Provider overrides</h1><p>Choose a provider, then manage only the settings that differ from platform or business defaults.</p></div><div className="provider-override-selector-panel"><SearchableSelect label="Select provider" searchLabel="Search provider name or code" search={providerSearch} onSearch={setProviderSearch} value={providerId} onChange={(value) => { setProviderId(value); setMessage(''); }} options={providerOptions} placeholder="Choose a provider" disabled={busy === 'load'} /><span>Search by provider name, code, or business.</span></div></div>
    <div className="reference-provider-banner"><span className="reference-summary-icon tone-purple"><SvgIcon name="building" size={21} /></span><div><strong>{providerName} <StatusPill value={selectedProvider?.attributes.status || 'Active'} /></strong><small>Provider · {selectedProvider?.attributes.business_name || 'Elevator &amp; Lift Services'}</small></div><dl><div><dt>Region</dt><dd>India</dd></div><div><dt>Timezone</dt><dd>Asia/Kolkata</dd></div><div><dt>Status</dt><dd>● {selectedProvider?.attributes.status || 'Active'}</dd></div></dl></div>
    <div className="reference-tabs"><button className="active" type="button">Configuration</button><button type="button" onClick={() => { window.location.hash = `platform/configuration/audit?provider_id=${encodeURIComponent(providerId)}`; }}>History</button></div>
    {reviewId && <section className="reference-review-panel"><div><span className="reference-eyebrow">Configuration review</span><h2>Provider override review <StatusPill value={reviewStatus || 'PENDING'} /></h2><p>{reviewStatus === 'PENDING' ? (canReview ? 'This draft is waiting for an authorized Global Administrator or platform reviewer.' : 'This draft is waiting for platform review.') : reviewStatus === 'APPROVED' ? 'This review is approved and ready to publish.' : reviewStatus === 'REVOKED' ? 'This review was revoked. Update the draft and submit it again.' : `Review status: ${reviewStatus}.`}</p>{currentUserId && reviewStatus === 'PENDING' && <small>{'The reviewer action is recorded in the platform audit trail, including self-approval when applicable.'}</small>}</div>{canReview && reviewStatus === 'PENDING' && <div className="reference-review-actions"><Button disabled={Boolean(busy)} title="Self-approval is recorded in the audit trail when the submitter approves their own review." onClick={() => void approveReview()}>{busy === 'approve' ? 'Approving…' : 'Approve review'}</Button>{canRevokeReview && <Button variant="danger" disabled={Boolean(busy)} onClick={() => void revokeReview()}>{busy === 'revoke' ? 'Revoking…' : 'Revoke review'}</Button>}</div>}{canRevokeReview && reviewStatus === 'APPROVED' && <div className="reference-review-actions"><Button variant="danger" disabled={Boolean(busy)} onClick={() => void revokeReview()}>{busy === 'revoke' ? 'Revoking…' : 'Revoke review'}</Button></div>}</section>}
    <div className="reference-override-layout"><main>{sections.map((section) => <section className="reference-override-card" key={section.key}><div className="reference-override-label"><SvgIcon name={section.icon} size={23} /><div><strong>{section.title}</strong><small>{section.description}</small></div></div><div className="reference-inheritance">{inheritanceOptions.map((value) => <label className={sectionInheritance(section.key) === value ? 'selected' : ''} key={value}><input type="radio" name={section.key} checked={sectionInheritance(section.key) === value} onChange={() => setInheritance(section.key, value)} /><strong>{value}</strong><small>{value === 'Override' ? 'Provider-specific value' : 'Inherited default'}</small></label>)}</div>{section.key === 'coverage' && <div className="reference-field-row"><label>India states<select value={configuration.coverage.state_codes[0] || ''} onChange={(event) => setSection('coverage', { state_codes: event.target.value ? [event.target.value] : [] })}><option value="">Select state</option><option value="MH">Maharashtra</option><option value="KA">Karnataka</option><option value="DL">Delhi</option><option value="TN">Tamil Nadu</option></select></label><label>Cities (within selected states)<select value={configuration.coverage.city_codes.join(',')} onChange={(event) => setSection('coverage', { city_codes: event.target.value ? event.target.value.split(',') : [] })}><option value="">Select cities</option><option value="MUMBAI,PUNE">Mumbai, Pune</option><option value="BENGALURU">Bengaluru</option><option value="DELHI">Delhi</option></select></label></div>}{section.key === 'modules' && <div className="reference-module-grid">{Object.entries(providerModuleLabels).map(([code, label]) => <label key={code}><input type="checkbox" checked={configuration.modules.enabled.includes(code)} onChange={() => setSection('modules', { enabled: configuration.modules.enabled.includes(code) ? configuration.modules.enabled.filter((item) => item !== code) : [...configuration.modules.enabled, code] })} />{label}<small>Enabled provider module</small></label>)}</div>}{section.key === 'sla' && <label className="reference-full-field">SLA<select value={configuration.sla.tier} onChange={(event) => setSection('sla', { tier: event.target.value })}><option value="PREMIUM_24H">Premium (24-hour response)</option><option value="STANDARD_48H">Standard (48-hour response)</option><option value="BASIC_72H">Basic (72-hour response)</option></select></label>}{section.key === 'approval' && <span className="reference-control-value"><Toggle enabled={configuration.approval.required} onChange={() => setSection('approval', { required: !configuration.approval.required })} />Approval required <small>Changes and service activations require admin approval.</small></span>}{section.key === 'effective_dates' && <div className="reference-field-row"><label>Effective from (India time)<input type="date" value={configuration.effective_dates.from} onChange={(event) => setSection('effective_dates', { from: event.target.value })} /></label><label>Effective to (optional, India time)<input type="date" value={configuration.effective_dates.to || ''} onChange={(event) => setSection('effective_dates', { to: event.target.value || null })} /></label><div className="reference-info-box"><strong>India time</strong><small>No timezone selection required. Dates are interpreted in India time (IST).</small></div></div>}</section>)}</main><aside className="reference-effective-rail"><h2>Effective configuration</h2><p>Summary of how settings will look for this provider.</p><section><h3>Provider <StatusPill value={selectedProvider?.attributes.status || 'Active'} /></h3><strong>{providerName}</strong><small>{selectedProvider?.attributes.business_name || 'Elevator &amp; Lift Services'} · India</small></section><section><h3>Service coverage <StatusPill value={sectionInheritance('coverage')} /></h3><p>States <strong>{configuration.coverage.state_codes.join(', ') || 'Inherited'}</strong></p><p>Cities <strong>{configuration.coverage.city_codes.join(', ') || 'Inherited'}</strong></p></section><section><h3>Enabled modules <StatusPill value={sectionInheritance('modules')} /></h3><p>{configuration.modules.enabled.map((item) => providerModuleLabels[item] || item).join(' · ') || 'Inherited'}</p></section><section><h3>SLA <StatusPill value={sectionInheritance('sla')} /></h3><p>{configuration.sla.tier || 'Inherited'}</p></section><div className="reference-warning"><strong>⚠ Configuration conflicts</strong><p>Selected cities are limited to the selected states. Services will not be available outside this coverage.</p></div><div className="reference-rail-actions"><Button variant="secondary" disabled={Boolean(busy) || !providerId} onClick={() => void save()}>Save draft</Button>{reviewStatus === 'APPROVED' ? <Button disabled={Boolean(busy) || !providerId} onClick={() => void publish()}>{busy === 'publish' ? 'Publishing…' : 'Publish approved'}</Button> : <Button disabled={Boolean(busy) || !providerId} onClick={() => void submit()}>{busy === 'submit' ? 'Submitting…' : 'Submit for review'}</Button>}</div>{error && <p className="error" role="alert">{error}</p>}{message && <p className="reference-inline-success" role="status">{message}</p>}{reviewId && <small>Review {reviewId.slice(0, 8)}… · {reviewStatus || 'draft'}</small>}</aside></div>
  </section>;
}

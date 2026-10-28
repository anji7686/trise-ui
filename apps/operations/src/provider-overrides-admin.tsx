import { useEffect, useRef, useState } from 'react';
import { Button, SortedSelect } from '@trise/ui';
import { operationsData, type PlatformProviderAttributes, type ProviderSetupAttributes } from './data';
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

const platformSetupKinds = new Set([
  'asset-families', 'asset-types', 'asset-definitions', 'service-types', 'checklist-templates',
  'notification-triggers', 'notification-policies', 'notification-templates', 'skills',
  'certification-types', 'holiday-calendars', 'asset-criticalities', 'service-priorities',
  'sla-policies', 'identifier-policies', 'maintenance-policies',
]);

export function setupActionPath(blocker: { code: string; label: string }, providerId: string) {
  const text = `${blocker.code} ${blocker.label}`.toLowerCase();
  const returnTo = `platform/configuration/provider-overrides?provider_id=${encodeURIComponent(providerId)}`;
  const withReturn = (path: string) => `${path}${path.includes('?') ? '&' : '?'}return_to=${encodeURIComponent(returnTo)}`;
  if (text.includes('subscription')) return withReturn(`platform/providers/${encodeURIComponent(providerId)}?tab=subscription`);
  if (text.includes('primary') || text.includes('operation')) return withReturn(`platform/providers/${encodeURIComponent(providerId)}?tab=operations`);
  if (text.includes('verification') || text.includes('business')) return withReturn(`platform/providers/${encodeURIComponent(providerId)}?tab=business`);
  if (text.includes('administration') || text.includes('provider_admin') || text.includes('provider admin')) {
    return withReturn(`platform/providers/${encodeURIComponent(providerId)}?tab=access`);
  }
  if (blocker.code.startsWith('SETUP_')) {
    const kind = blocker.code.replace(/^SETUP_/, '').toLowerCase().replaceAll('_', '-');
    // Provider-scoped catalogues require an active provider workspace. Keep a
    // platform administrator inside the authorized setup orchestrator instead
    // of sending them to a provider endpoint that would correctly return 403.
    if (!platformSetupKinds.has(kind)) return `platform/configuration/provider-overrides?provider_id=${encodeURIComponent(providerId)}&focus=${encodeURIComponent(kind)}`;
    return withReturn(`platform/configuration/${kind}`);
  }
  return withReturn(`platform/providers/${encodeURIComponent(providerId)}?tab=overview`);
}

function StatusPill({ value }: { value: string }) {
  const tone = ['ACTIVE', 'Enabled', 'Active'].includes(value) ? 'success' : ['PENDING', 'In review'].includes(value) ? 'warning' : 'neutral';
  return <span className={`reference-status reference-status-${tone}`}>{value}</span>;
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return <button type="button" className={`reference-toggle${enabled ? ' is-on' : ''}`} aria-pressed={enabled} onClick={onChange}><span /></button>;
}

function providerLabel(provider: ProviderRecord) {
  return provider.attributes?.display_name || provider.attributes?.provider_code || provider.id;
}

function SetupStepGuide({ setup }: { setup: ProviderSetupAttributes['setup'] }) {
  const state = String(setup.state || 'NOT_STARTED').toUpperCase();
  const steps = [
    { title: 'Select provider', detail: 'Provider selected above', done: true },
    { title: 'Run readiness check', detail: ['NOT_STARTED', ''].includes(state) ? 'Run dry run to identify coverage and blockers' : 'Readiness result recorded', done: !['NOT_STARTED', ''].includes(state) },
    { title: 'Prepare provider draft', detail: ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE'].includes(state) ? 'Provider-scoped draft prepared' : 'Apply defaults, then save the draft', done: ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE'].includes(state) },
    { title: 'Review setup', detail: state === 'DRAFT' ? 'Submit the setup for review' : state === 'UNDER_REVIEW' ? 'Waiting for an authorized reviewer' : ['APPROVED', 'ACTIVE'].includes(state) ? 'Review completed' : 'Complete the provider draft first', done: ['APPROVED', 'ACTIVE'].includes(state) },
    { title: 'Activate setup', detail: state === 'APPROVED' ? (setup.readiness?.ready ? 'Activate when ready' : 'Resolve readiness blockers first') : state === 'ACTIVE' ? 'Provider setup is active' : 'Available after approval', done: state === 'ACTIVE' },
  ];
  const currentIndex = steps.findIndex((step) => !step.done);
  const [activeStep, setActiveStep] = useState(Math.max(0, currentIndex));
  useEffect(() => { setActiveStep(Math.max(0, currentIndex)); }, [currentIndex]);
  const nextStep = currentIndex < 0 ? 'Setup is active. Continue managing provider overrides below.' : steps[currentIndex].detail;
  const guidance = [
    'Confirm the provider account above before changing any provider-specific setting.',
    'Run the dry run to calculate configuration coverage and identify blockers.',
    'Apply the platform defaults, correct any provider values, and save the draft.',
    'Submit the provider setup for review. An authorized reviewer must approve it.',
    'Activate only after approval and after all required readiness blockers are cleared.',
  ][activeStep];
  return <section className="reference-setup-guide" aria-label="Provider setup steps">
    <div className="reference-setup-guide-heading"><div><span className="reference-eyebrow">Guided setup</span><strong>Complete these steps in order</strong></div><span className="reference-setup-guide-next"><SvgIcon name="activity" size={14} /> Next: {nextStep}</span></div>
    <div className="reference-setup-step-tabs" role="tablist" aria-label="Provider setup guide steps">{steps.map((step, index) => { const isCurrent = index === currentIndex; const isActive = index === activeStep; return <button type="button" role="tab" aria-selected={isActive} className={`reference-setup-step-tab${step.done ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}${isActive ? ' is-active' : ''}`} onClick={() => setActiveStep(index)} key={step.title}><span className="reference-setup-step-number" aria-hidden="true">{step.done ? '✓' : index + 1}</span><span><strong>{step.title}</strong><small>{isCurrent ? 'Current step' : step.done ? 'Completed' : 'Upcoming'}</small></span></button>; })}</div>
    <div className="reference-setup-step-content" role="tabpanel"><strong>Step {activeStep + 1}: {steps[activeStep].title}</strong><p>{guidance}</p><small>{steps[activeStep].detail}</small></div>
    <div className="reference-setup-guide-actions"><Button variant="secondary" disabled={activeStep === 0} onClick={() => setActiveStep((step) => Math.max(0, step - 1))}>Previous step</Button><span>Step {activeStep + 1} of {steps.length}</span><Button variant="secondary" disabled={activeStep === steps.length - 1} onClick={() => setActiveStep((step) => Math.min(steps.length - 1, step + 1))}>Next step</Button></div>
  </section>;
}

const blockerExplanation = (blocker: { code: string; label: string }) => {
  const text = `${blocker.code} ${blocker.label}`.toLowerCase();
  if (text.includes('skill')) return 'Open Provider Configuration → Workforce & scheduling → Skills. Enable a provider value or keep a compatible platform default.';
  if (text.includes('certification')) return 'Open Provider Configuration → Workforce & scheduling → Certification Types. Enable the certification catalogue required for assigned work.';
  if (text.includes('assignment')) return 'This provider-scoped setting is supplied by the standard setup. Apply system defaults to create the standard assignment policy; no manual policy form is needed.';
  if (text.includes('holiday')) return 'Open Provider Configuration → Workforce & scheduling → Holiday Calendars. Enable the applicable India working-calendar defaults.';
  if (text.includes('critical')) return 'Open Platform Catalogue → Asset Criticalities. Enable the required severity levels for provider assets.';
  if (text.includes('priority')) return 'Open Platform Catalogue → Service Priorities. Enable priorities that match the provider service response model.';
  if (text.includes('sla')) return 'Open Platform Catalogue → Maintenance & SLA → SLA Policies. Enable the response and resolution targets used by this provider.';
  if (text.includes('emergency')) return 'The system supplies the standard elevator emergency rule using the published emergency priority, SLA and assignment policy. Apply or rerun system defaults to create it.';
  if (text.includes('administration')) return 'A real user must be assigned or invited as this provider’s administrator. Open the provider Access section and select the responsible person; the platform seed provides the default role template but cannot choose a person.';
  if (text.includes('subscription')) return 'Open the provider Subscription area and activate a TRISe subscription or the approved onboarding default.';
  if (text.includes('verification') || text.includes('business')) return 'Complete and approve the provider business verification before activation can proceed.';
  if (text.includes('primary') || text.includes('operation')) return 'Open Business Operations Catalogue and assign one active primary operation to this provider.';
  return 'Resolve this requirement in the appropriate provider or platform configuration area, then run the readiness check again.';
};

function ActionRequiredPopover({ blockers, providerId }: { blockers: Array<{ code: string; label: string }>; providerId: string }) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [openCode, setOpenCode] = useState('');
  const visible = pinned || hovered;
  return <div className="reference-action-required-popover" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
    <button type="button" className="reference-action-required-trigger" aria-label="Show action required details" aria-expanded={visible} title="Resolve these items before activation" onClick={() => setPinned((current) => !current)}><span>Action required</span><strong>{blockers.length}</strong><SvgIcon name="info" size={15} /></button>
    {visible && <div className="reference-action-required-panel" role="dialog" aria-label="Action required details"><div className="reference-action-required-panel-heading"><div><strong>Action required</strong><small>Resolve these items before activation</small></div><span>{blockers.length} blocker{blockers.length === 1 ? '' : 's'}</span></div><div className="reference-action-required-items">{blockers.map((blocker) => { const open = openCode === blocker.code; return <div className={`reference-action-required-item${open ? ' is-open' : ''}`} key={blocker.code}><div className="reference-action-required-row"><button type="button" className="reference-action-required-toggle" aria-expanded={open} onClick={() => setOpenCode(open ? '' : blocker.code)}><span className="reference-setup-blocker-mark" aria-hidden="true">!</span><span><strong>{blocker.label}</strong><small>Required · Needs setup</small></span><SvgIcon name="chevron-down" size={13} /></button><button type="button" className="reference-action-required-open" onClick={() => { window.location.hash = setupActionPath(blocker, providerId); }}>Open setup</button></div>{open && <div className="reference-action-required-detail"><strong>What this means</strong><p>{blockerExplanation(blocker)}</p><button type="button" className="reference-action-required-detail-link" onClick={() => { window.location.hash = setupActionPath(blocker, providerId); }}>Open the required setup area <SvgIcon name="arrow-right" size={13} /></button></div>}</div>; })}</div></div>}
  </div>;
}

function SetupTaskList({ setup, providerId }: { setup: ProviderSetupAttributes['setup']; providerId: string }) {
  const tasks = (setup.tasks || []).filter(Boolean);
  if (!tasks.length) return null;
  const missing = tasks.filter((task) => task.status === 'MISSING');
  const completed = tasks.length - missing.length;
  const required = tasks.filter((task) => task.required);
  const optional = tasks.filter((task) => !task.required);
  const statusLabel = (status: string) => status === 'ADOPTED' ? 'Provider ready' : status === 'INHERITED' ? 'Platform default' : status === 'MISSING' ? 'Needs setup' : 'Needs review';
  const statusClass = (status: string) => status.toLowerCase().replaceAll('_', '-');
  const renderTask = (task: (typeof tasks)[number]) => <div className={`reference-setup-task reference-setup-task-${statusClass(task.status)}${task.required ? ' is-required' : ' is-optional'}`} data-setup-kind={task.kind} key={task.kind} aria-label={`${task.label}: ${task.required ? 'Required' : 'Optional'} · ${statusLabel(task.status)}`}>
    <span className="reference-setup-task-mark" aria-hidden="true">{task.status === 'MISSING' ? '!' : '✓'}</span>
    <div className="reference-setup-task-copy"><div className="reference-setup-task-title"><strong>{task.label}</strong><span className={`reference-setup-task-badge ${task.required ? 'is-required' : 'is-optional'}`}>{task.required ? 'Required' : 'Optional'}</span></div><small>{statusLabel(task.status)}</small></div>
  </div>;
  const blockers = setup.readiness?.blockers || [];
  return <section className="reference-setup-checklist" aria-label="Provider setup checklist">
    <SetupStepGuide setup={setup} />
    <div className="reference-setup-checklist-heading"><div><span className="reference-eyebrow">Readiness checklist</span><strong>Configuration coverage</strong><small>What is ready, inherited, or still required before activation.</small></div><div className="reference-setup-checklist-score"><strong>{completed}</strong><span> of {tasks.length} ready</span></div></div>
    <div className="reference-setup-progress" role="progressbar" aria-label="Configuration readiness" aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={completed}><span style={{ width: `${Math.round((completed / tasks.length) * 100)}%` }} /></div>
    <div className="reference-setup-summary"><span className="is-ready"><strong>{completed}</strong> Ready</span><span className={missing.length ? 'is-missing' : 'is-ready'}><strong>{missing.length}</strong> Needs setup</span><span className="is-optional"><strong>{optional.length}</strong> Optional</span></div>
    <div className="reference-setup-task-groups">
      <div className="reference-setup-task-group"><div className="reference-setup-task-group-heading"><div><strong>Required configuration</strong><span>{required.length} items</span></div>{blockers.length > 0 && <ActionRequiredPopover blockers={blockers} providerId={providerId} />}</div><div className="reference-setup-task-grid">{required.map(renderTask)}</div></div>
      {optional.length > 0 && <div className="reference-setup-task-group"><div className="reference-setup-task-group-heading"><div><strong>Optional configuration</strong><span>{optional.length} items</span></div></div><div className="reference-setup-task-grid">{optional.map(renderTask)}</div></div>}
    </div>
  </section>;
}

export function ProviderOverridesAdmin({ platformCapabilities = [], currentUserId = '' }: { platformCapabilities?: string[]; currentUserId?: string }) {
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const routeParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const setupFocus = routeParams.get('focus') || '';
  const [providerId, setProviderId] = useState(routeParams.get('provider_id') || '');
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
  const [setup, setSetup] = useState<ProviderSetupAttributes['setup'] | null>(null);
  const [setupProfile, setSetupProfile] = useState('FULL_LIFECYCLE');
  const [setupReason, setSetupReason] = useState('Provider onboarding setup assistance');
  const [setupScope, setSetupScope] = useState('Provider configuration and subscription readiness');
  const [setupBusy, setSetupBusy] = useState('');
  const [setupMessage, setSetupMessage] = useState('');
  const providerSearchRequest = useRef(0);
  const canReview = platformCapabilities.includes('PLATFORM_CONFIGURATION_REVIEW');
  const canRevokeReview = canReview && ['PENDING', 'APPROVED'].includes(reviewStatus);

  useEffect(() => {
    const requestId = ++providerSearchRequest.current;
    const query = providerSearch.trim();
    const timer = window.setTimeout(() => {
      operationsData.platformProviders({ q: query || undefined, limit: query ? 100 : 25 }).then((result) => {
        if (requestId !== providerSearchRequest.current) return;
        const next = result.data.map((item) => { const attributes = item.attributes || {}; return { id: item.id, attributes: { display_name: attributes.display_name || '', provider_code: attributes.provider_code || '', business_name: attributes.business_name || '', status: attributes.status || '' } }; });
        setProviders(next);
        if (!query) setProviderId((current) => current || next[0]?.id || '');
      }).catch((cause) => {
        if (requestId === providerSearchRequest.current) setError(errorText(cause, 'Provider directory could not be loaded.'));
      });
    }, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [providerSearch]);

  useEffect(() => {
    if (!providerId) return;
    let current = true;
    setBusy('load'); setError('');
    Promise.all([operationsData.platformProvider(providerId), operationsData.platformProviderConfigurationOverride(providerId), operationsData.platformProviderSetup(providerId)]).then(([provider, result, setupResult]) => {
      if (!current) return;
      setProviderName(provider.attributes?.display_name || 'Selected provider');
      setProviderRevision(result.data.attributes.provider_revision);
      setDraftRevision(result.data.attributes.draft?.revision || result.data.attributes.active?.revision || 0);
      setReviewId(result.data.attributes.review_id || '');
      setReviewStatus(result.data.attributes.review_status || '');
      setConfiguration((result.data.attributes.configuration || defaultProviderOverride) as ProviderOverrideDraft);
      setSetup(setupResult.data.attributes.setup);
      setSetupProfile(setupResult.data.attributes.setup.profile_code || setupResult.data.attributes.setup.profiles?.[0]?.code || 'FULL_LIFECYCLE');
    }).catch((cause) => { if (current) setError(errorText(cause, 'Provider override configuration could not be loaded.')); }).finally(() => { if (current) setBusy(''); });
    return () => { current = false; };
  }, [providerId]);

  useEffect(() => {
    if (!setupFocus || !setup) return undefined;
    const timer = window.setTimeout(() => {
      const target = Array.from(document.querySelectorAll<HTMLElement>('[data-setup-kind]')).find((element) => element.dataset.setupKind === setupFocus);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [setupFocus, setup]);

  const setSection = (section: ProviderOverrideSection, value: Record<string, unknown>) => setConfiguration((current) => ({ ...current, [section]: { ...current[section], ...value } }));
  const setInheritance = (section: ProviderOverrideSection, value: string) => setSection(section, { inheritance: inheritanceCode(value) });
  const sectionInheritance = (section: ProviderOverrideSection) => inheritanceLabel(String(configuration[section]?.inheritance || 'OVERRIDE'));
  const providerOptions = providers.map((provider) => ({ id: provider.id, label: providerLabel(provider), detail: [provider.attributes?.provider_code, provider.attributes?.business_name].filter(Boolean).join(' · ') || provider.attributes?.status || 'Provider account' }));
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

  async function updateSetup(result: { data: { attributes: ProviderSetupAttributes } }) {
    setProviderRevision(result.data.attributes.provider_revision);
    setSetup(result.data.attributes.setup);
    setSetupProfile(result.data.attributes.setup.profile_code || setupProfile);
  }

  async function dryRunSetup() {
    if (!providerId) return;
    setSetupBusy('dry-run'); setError(''); setSetupMessage('');
    try {
      const result = await operationsData.dryRunPlatformProviderSetup(providerId, { profile_code: setupProfile, reason: setupReason, scope: setupScope }, crypto.randomUUID());
      await updateSetup(result); setSetupMessage('Dry run completed. Review inherited defaults and blockers before applying.');
    } catch (cause) { setError(errorText(cause, 'Provider setup dry run could not be completed.')); } finally { setSetupBusy(''); }
  }

  async function prepareDefaultSetup() {
    if (!providerId || !setup) return;
    setSetupBusy('prepare'); setError(''); setSetupMessage('');
    try {
      const dryRun = await operationsData.dryRunPlatformProviderSetup(providerId, { profile_code: setupProfile, reason: setupReason, scope: setupScope }, crypto.randomUUID());
      const result = await operationsData.applyPlatformProviderSetup(providerId, { profile_code: setupProfile, expected_revision: dryRun.data.attributes.provider_revision, reason: setupReason, scope: setupScope }, crypto.randomUUID());
      await updateSetup(result);
      setSetupMessage('Safe provider defaults were prepared automatically. Review only the remaining business, admin, operation, or subscription prerequisites before submitting for review.');
    } catch (cause) { setError(errorText(cause, 'Provider default setup could not be prepared.')); } finally { setSetupBusy(''); }
  }

  async function submitSetupReview() {
    if (!providerId || !setup?.revision) return;
    setSetupBusy('submit'); setError(''); setSetupMessage('');
    try {
      const result = await operationsData.submitPlatformProviderSetupReview(providerId, { expected_revision: setup.revision, reason: setupReason }, crypto.randomUUID());
      setSetup((current) => current ? { ...current, state: 'UNDER_REVIEW', review_id: result.data.id, review_status: result.data.attributes.status } : current); setSetupMessage('Provider setup submitted for independent review.');
    } catch (cause) { setError(errorText(cause, 'Provider setup review submission failed.')); } finally { setSetupBusy(''); }
  }

  async function approveSetup() {
    if (!providerId || !setup?.review_id) return;
    setSetupBusy('approve'); setError(''); setSetupMessage('');
    try {
      const result = await operationsData.approvePlatformProviderSetupReview(providerId, setup.review_id, crypto.randomUUID());
      setSetup((current) => current ? { ...current, state: 'APPROVED', review_status: result.data.attributes.status } : current); setSetupMessage('Provider setup approved. Activate it when the readiness gate is clear.');
    } catch (cause) { setError(errorText(cause, 'Provider setup review approval failed.')); } finally { setSetupBusy(''); }
  }

  async function rejectSetup() {
    if (!providerId || !setup?.review_id) return;
    setSetupBusy('reject'); setError(''); setSetupMessage('');
    try {
      const result = await operationsData.rejectPlatformProviderSetupReview(providerId, setup.review_id, { reason: 'Setup requires correction' }, crypto.randomUUID());
      setSetup((current) => current ? { ...current, state: 'NEEDS_ATTENTION', review_status: result.data.attributes.status } : current); setSetupMessage('Provider setup was returned for correction.');
    } catch (cause) { setError(errorText(cause, 'Provider setup review rejection failed.')); } finally { setSetupBusy(''); }
  }

  async function activateSetup() {
    if (!providerId || !setup?.review_id || !setup.revision) return;
    setSetupBusy('activate'); setError(''); setSetupMessage('');
    try {
      const result = await operationsData.activatePlatformProviderSetup(providerId, { expected_revision: setup.revision, review_id: setup.review_id }, crypto.randomUUID());
      await updateSetup(result); setSetupMessage('Provider setup activated. The provider can now operate within its entitlements.');
    } catch (cause) { setError(errorText(cause, 'Provider setup activation failed.')); } finally { setSetupBusy(''); }
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
    <div className="reference-page-heading"><div><span className="reference-eyebrow">Provider configuration</span><h1>Provider overrides</h1><p>Choose a provider, then manage only the settings that differ from platform or business defaults.</p></div></div><section className="provider-override-selector-card" aria-label="Provider selection"><div className="provider-override-selector-copy"><span className="provider-override-step">1</span><div><strong>Select a provider</strong><p>Search the full provider directory by provider name, provider code, or Business. The provider summary and configuration details remain visible below the selector.</p></div></div><div className="provider-override-selector-field"><SearchableSelect label="Provider account" searchLabel="Search provider name or code" search={providerSearch} onSearch={setProviderSearch} value={providerId} onChange={(value) => { setProviderId(value); setMessage(''); }} options={providerOptions} placeholder="Choose a provider" disabled={busy === 'load'} /></div></section>
    <div className="reference-provider-banner"><span className="reference-summary-icon tone-purple"><SvgIcon name="building" size={21} /></span><div><strong>{providerName} <StatusPill value={selectedProvider?.attributes?.status || 'Active'} /></strong><small>Provider · {selectedProvider?.attributes?.business_name || 'Elevator &amp; Lift Services'}</small></div><dl><div><dt>Region</dt><dd>India</dd></div><div><dt>Timezone</dt><dd>Asia/Kolkata</dd></div><div><dt>Status</dt><dd>● {selectedProvider?.attributes?.status || 'Active'}</dd></div></dl></div>
    <div className="reference-tabs" aria-label="Provider override sections"><button className="active" type="button">Configuration</button><button type="button" onClick={() => { window.location.hash = `platform/configuration/audit?provider_id=${encodeURIComponent(providerId)}`; }}>History</button></div>
    {setup && <section className="reference-setup-panel" aria-label="Provider setup orchestrator"><div className="reference-setup-heading"><div><span className="reference-eyebrow">Provider Setup Orchestrator</span><h2>{setup.profile_label || 'Provider setup'} <StatusPill value={setup.state} /></h2><p>Prepare platform defaults in a provider-scoped draft, resolve blockers, then hand off to an independent reviewer.</p></div><div className="reference-setup-score"><strong>{setup.readiness?.score ?? 0}%</strong><small>{setup.state === 'ACTIVE' ? 'Active and ready' : setup.readiness?.ready ? 'Ready for activation' : 'Readiness in progress'}</small></div></div>{setupFocus && <p className="reference-setup-focus-note"><strong>Setup focus:</strong> {setupFocus.replaceAll('-', ' ')}. This provider-level requirement is managed here so the platform administrator can prepare the standard policy and return to readiness without entering a manual configuration form.</p>}{['APPROVED', 'DRAFT'].includes(setup.state) && !setup.readiness?.ready && <p className="reference-setup-focus-note"><strong>Review required:</strong> Applying remaining defaults creates a fresh setup draft. Submit it for review and approval again before activation.</p>}<p className="reference-setup-automation-note"><strong>Automatic setup:</strong> TRISe provisions compatible platform defaults during onboarding or when a Global Administrator applies the standard setup. Manual catalogue entry is not required for standard operation.</p><div className="reference-setup-controls"><label>Setup profile<SortedSelect disabled={Boolean(setupBusy)} value={setupProfile} onChange={(event) => setSetupProfile(event.target.value)}>{(setup.profiles || []).map((profile) => <option value={profile.code} key={profile.code}>{profile.label}</option>)}</SortedSelect></label><label>Operating reason<input disabled={Boolean(setupBusy)} value={setupReason} onChange={(event) => setSetupReason(event.target.value)} /></label><label>Target scope<input disabled={Boolean(setupBusy)} value={setupScope} onChange={(event) => setSetupScope(event.target.value)} /></label></div><div className="reference-setup-actions"><Button variant="secondary" disabled={Boolean(setupBusy) || !providerId} onClick={() => void dryRunSetup()}>{setupBusy === 'dry-run' ? 'Running…' : 'Run dry run'}</Button>{!['UNDER_REVIEW', 'ACTIVE'].includes(setup.state) && !setup.readiness?.ready && <Button disabled={Boolean(setupBusy) || !providerId} onClick={() => void prepareDefaultSetup()}>{setupBusy === 'prepare' ? 'Preparing…' : setup.state === 'DRAFT' ? 'Apply remaining defaults' : 'Complete with system defaults'}</Button>}{setup.state === 'DRAFT' && <Button disabled={Boolean(setupBusy) || !setup.revision} onClick={() => void submitSetupReview()}>{setupBusy === 'submit' ? 'Submitting…' : 'Submit setup for review'}</Button>}{setup.state === 'UNDER_REVIEW' && canReview && setup.review_id && <><Button disabled={Boolean(setupBusy)} onClick={() => void approveSetup()}>{setupBusy === 'approve' ? 'Approving…' : 'Approve setup'}</Button><Button variant="danger" disabled={Boolean(setupBusy)} onClick={() => void rejectSetup()}>{setupBusy === 'reject' ? 'Returning…' : 'Return for correction'}</Button></>}{setup.state === 'APPROVED' && setup.review_id && platformCapabilities.includes('PLATFORM_CONFIGURATION_PUBLISH') && <Button disabled={Boolean(setupBusy) || !setup.readiness?.ready} title={setup.readiness?.ready ? 'Activate the approved provider setup' : 'Resolve the readiness blockers below before activating'} onClick={() => void activateSetup()}>{setupBusy === 'activate' ? 'Activating…' : 'Activate setup'}</Button>}{setup.state === 'APPROVED' && !setup.readiness?.ready && <Button type="button" variant="quiet" onClick={() => document.querySelector<HTMLElement>('.reference-action-required-trigger')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Resolve blockers</Button>}</div><SetupTaskList setup={setup} providerId={providerId} />{setup.readiness?.blockers?.length ? <ul className="reference-setup-blockers">{setup.readiness.blockers.map((blocker) => <li key={blocker.code}>{blocker.label}</li>)}</ul> : <p className="reference-inline-success">No readiness blockers returned.</p>}{setupMessage && <p className="reference-inline-success" role="status">{setupMessage}</p>}</section>}
    {reviewId && <section className="reference-review-panel"><div><span className="reference-eyebrow">Configuration review</span><h2>Provider override review <StatusPill value={reviewStatus || 'PENDING'} /></h2><p>{reviewStatus === 'PENDING' ? (canReview ? 'This draft is waiting for an authorized Global Administrator or platform reviewer.' : 'This draft is waiting for platform review.') : reviewStatus === 'APPROVED' ? 'This review is approved and ready to publish.' : reviewStatus === 'REVOKED' ? 'This review was revoked. Update the draft and submit it again.' : `Review status: ${reviewStatus}.`}</p>{currentUserId && reviewStatus === 'PENDING' && <small>{'The reviewer action is recorded in the platform audit trail, including self-approval when applicable.'}</small>}</div>{canReview && reviewStatus === 'PENDING' && <div className="reference-review-actions"><Button disabled={Boolean(busy)} title="Self-approval is recorded in the audit trail when the submitter approves their own review." onClick={() => void approveReview()}>{busy === 'approve' ? 'Approving…' : 'Approve review'}</Button>{canRevokeReview && <Button variant="danger" disabled={Boolean(busy)} onClick={() => void revokeReview()}>{busy === 'revoke' ? 'Revoking…' : 'Revoke review'}</Button>}</div>}{canRevokeReview && reviewStatus === 'APPROVED' && <div className="reference-review-actions"><Button variant="danger" disabled={Boolean(busy)} onClick={() => void revokeReview()}>{busy === 'revoke' ? 'Revoking…' : 'Revoke review'}</Button></div>}</section>}
    <div className="reference-override-layout"><main>{sections.map((section) => <section className="reference-override-card" key={section.key}><div className="reference-override-label"><SvgIcon name={section.icon} size={23} /><div><strong>{section.title}</strong><small>{section.description}</small></div></div><div className="reference-inheritance">{inheritanceOptions.map((value) => <label className={sectionInheritance(section.key) === value ? 'selected' : ''} key={value}><input type="radio" name={section.key} checked={sectionInheritance(section.key) === value} onChange={() => setInheritance(section.key, value)} /><strong>{value}</strong><small>{value === 'Override' ? 'Provider-specific value' : 'Inherited default'}</small></label>)}</div>{section.key === 'coverage' && <div className="reference-field-row"><label>India states<SortedSelect value={configuration.coverage.state_codes[0] || ''} onChange={(event) => setSection('coverage', { state_codes: event.target.value ? [event.target.value] : [] })}><option value="">Select state</option><option value="MH">Maharashtra</option><option value="KA">Karnataka</option><option value="DL">Delhi</option><option value="TN">Tamil Nadu</option></SortedSelect></label><label>Cities (within selected states)<SortedSelect value={configuration.coverage.city_codes.join(',')} onChange={(event) => setSection('coverage', { city_codes: event.target.value ? event.target.value.split(',') : [] })}><option value="">Select cities</option><option value="MUMBAI,PUNE">Mumbai, Pune</option><option value="BENGALURU">Bengaluru</option><option value="DELHI">Delhi</option></SortedSelect></label></div>}{section.key === 'modules' && <div className="reference-module-grid">{Object.entries(providerModuleLabels).map(([code, label]) => <label key={code}><input type="checkbox" checked={configuration.modules.enabled.includes(code)} onChange={() => setSection('modules', { enabled: configuration.modules.enabled.includes(code) ? configuration.modules.enabled.filter((item) => item !== code) : [...configuration.modules.enabled, code] })} />{label}<small>Enabled provider module</small></label>)}</div>}{section.key === 'sla' && <label className="reference-full-field">SLA<SortedSelect value={configuration.sla.tier} onChange={(event) => setSection('sla', { tier: event.target.value })}><option value="PREMIUM_24H">Premium (24-hour response)</option><option value="STANDARD_48H">Standard (48-hour response)</option><option value="BASIC_72H">Basic (72-hour response)</option></SortedSelect></label>}{section.key === 'approval' && <span className="reference-control-value"><Toggle enabled={configuration.approval.required} onChange={() => setSection('approval', { required: !configuration.approval.required })} />Approval required <small>Changes and service activations require admin approval.</small></span>}{section.key === 'effective_dates' && <div className="reference-field-row"><label>Effective from (India time)<input type="date" value={configuration.effective_dates.from} onChange={(event) => setSection('effective_dates', { from: event.target.value || '' })} /></label><label>Effective to (optional, India time)<input type="date" value={configuration.effective_dates.to || ''} onChange={(event) => setSection('effective_dates', { to: event.target.value || null })} /></label><div className="reference-info-box"><strong>India time</strong><small>No timezone selection required. Dates are interpreted in India time (IST).</small></div></div>}</section>)}</main><aside className="reference-effective-rail"><h2>Effective configuration</h2><p>Summary of how settings will look for this provider.</p><section><h3>Provider <StatusPill value={selectedProvider?.attributes?.status || 'Active'} /></h3><strong>{providerName}</strong><small>{selectedProvider?.attributes?.business_name || 'Elevator &amp; Lift Services'} · India</small></section><section><h3>Service coverage <StatusPill value={sectionInheritance('coverage')} /></h3><p>States <strong>{configuration.coverage.state_codes.join(', ') || 'Inherited'}</strong></p><p>Cities <strong>{configuration.coverage.city_codes.join(', ') || 'Inherited'}</strong></p></section><section><h3>Enabled modules <StatusPill value={sectionInheritance('modules')} /></h3><p>{configuration.modules.enabled.map((item) => providerModuleLabels[item] || item).join(' · ') || 'Inherited'}</p></section><section><h3>SLA <StatusPill value={sectionInheritance('sla')} /></h3><p>{configuration.sla.tier || 'Inherited'}</p></section><div className="reference-warning"><strong>⚠ Configuration conflicts</strong><p>Selected cities are limited to the selected states. Services will not be available outside this coverage.</p></div><div className="reference-rail-actions"><Button variant="secondary" disabled={Boolean(busy) || !providerId} onClick={() => void save()}>Save draft</Button>{reviewStatus === 'APPROVED' ? <Button disabled={Boolean(busy) || !providerId} onClick={() => void publish()}>{busy === 'publish' ? 'Publishing…' : 'Publish approved'}</Button> : <Button disabled={Boolean(busy) || !providerId} onClick={() => void submit()}>{busy === 'submit' ? 'Submitting…' : 'Submit for review'}</Button>}</div>{error && <p className="error" role="alert">{error}</p>}{message && <p className="reference-inline-success" role="status">{message}</p>}{reviewId && <small>Review {reviewId.slice(0, 8)}… · {reviewStatus || 'draft'}</small>}</aside></div>
  </section>;
}

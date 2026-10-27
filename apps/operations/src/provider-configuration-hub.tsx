import { useEffect, useMemo, useState } from 'react';
import { Button, PageHeader } from '@trise/ui';
import { CONFIGURATION_TYPE_GROUPS } from './configuration';
import { operationsData, type ProviderSetupAttributes, type ProviderSetupMastersAttributes } from './data';
import { SvgIcon } from './icons';

type Setup = ProviderSetupAttributes['setup'];
type SetupTask = NonNullable<Setup['tasks']>[number];
type SetupBlocker = NonNullable<NonNullable<Setup['readiness']>['blockers']>[number];

type HubGroup = {
  key: string;
  label: string;
  description: string;
  icon: Parameters<typeof SvgIcon>[0]['name'];
  kinds: string[];
};

const HUB_GROUPS: HubGroup[] = [
  {
    key: 'catalogue',
    label: 'Elevator & service catalogue',
    description: 'Families, equipment types, services and safety checklists.',
    icon: 'grid',
    kinds: ['asset-families', 'asset-types', 'asset-definitions', 'service-types', 'checklist-templates'],
  },
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'Triggers, channels, templates and mandatory delivery rules.',
    icon: 'bell',
    kinds: ['notification-triggers', 'notification-policies', 'notification-templates'],
  },
  {
    key: 'workforce',
    label: 'Workforce & scheduling',
    description: 'Skills, calendars, holidays, territories and assignments.',
    icon: 'users',
    kinds: ['skills', 'certification-types', 'working-calendars', 'holiday-calendars', 'service-territories', 'assignment-policies'],
  },
  {
    key: 'controls',
    label: 'Priority, emergency & SLA',
    description: 'Priorities, response targets, escalation and maintenance controls.',
    icon: 'activity',
    kinds: ['asset-criticalities', 'service-priorities', 'sla-policies', 'emergency-rules', 'maintenance-policies'],
  },
  {
    key: 'administration',
    label: 'Provider administration',
    description: 'Business profile, team access, compliance and provider readiness.',
    icon: 'settings',
    kinds: ['ADMINISTRATION'],
  },
  {
    key: 'subscription',
    label: 'TRISe subscription',
    description: 'Subscription status and the operational modules available to this provider.',
    icon: 'clipboard',
    kinds: ['SUBSCRIPTION'],
  },
];

const typeLabel = (kind: string) => {
  if (kind === 'ADMINISTRATION') return 'Provider administrator access';
  if (kind === 'SUBSCRIPTION') return 'TRISe subscription';
  const option = CONFIGURATION_TYPE_GROUPS.flatMap((group) => group.options).find((candidate) => candidate.value === kind);
  return option?.label || kind.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const go = (path: string) => { window.location.hash = path; };

function taskFor(tasks: SetupTask[], kind: string) {
  return tasks.find((task) => task.kind === kind);
}

function groupTasks(tasks: SetupTask[], group: HubGroup) {
  return group.kinds.map((kind) => taskFor(tasks, kind)).filter((task): task is SetupTask => Boolean(task));
}

function statusText(tasks: SetupTask[]) {
  if (!tasks.length) return 'Not started';
  if (tasks.some((task) => task.status === 'MISSING')) return 'Needs setup';
  if (tasks.some((task) => task.status === 'INHERITED')) return 'Inherited';
  return 'Ready';
}

function statusTone(value: string) {
  if (value === 'Ready') return 'success';
  if (value === 'Needs setup') return 'warning';
  if (value === 'Inherited') return 'info';
  return 'neutral';
}

function progress(tasks: SetupTask[]) {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((task) => task.status !== 'MISSING').length / tasks.length) * 100);
}

function taskStatusLabel(task: SetupTask) {
  if (task.status === 'INHERITED') return 'Platform default · available';
  if (task.status === 'ADOPTED') return 'Provider setting · configured';
  return 'Needs configuration';
}

function SetupGroupCard({ group, tasks, onOpen }: { group: HubGroup; tasks: SetupTask[]; onOpen: (kind: string) => void }) {
  const status = statusText(tasks);
  const nextKind = tasks.find((task) => task.status === 'MISSING')?.kind || tasks.find((task) => task.status === 'INHERITED' || task.status === 'ADOPTED')?.kind || group.kinds[0];
  const completed = tasks.filter((task) => task.status !== 'MISSING').length;
  return (
    <article className={`provider-configuration-group-card is-${statusTone(status)}`}>
      <div className="provider-configuration-group-icon" aria-hidden="true"><SvgIcon name={group.icon} size={18} /></div>
      <div className="provider-configuration-group-copy">
        <div className="provider-configuration-group-heading">
          <div><h2>{group.label}</h2><p>{group.description}</p></div>
          <span className={`status status-${statusTone(status)}`}>{status}</span>
        </div>
        <div className="provider-configuration-progress-line" aria-label={`${progress(tasks)} percent complete`}>
          <span style={{ width: `${progress(tasks)}%` }} />
        </div>
        {tasks.length > 0 && <ul className="provider-configuration-task-list" aria-label={`${group.label} setup items`}>
          {tasks.map((task) => <li key={task.kind} className={`is-${task.status.toLowerCase()}`}>
            <span className="provider-configuration-task-mark" aria-hidden="true">{task.status === 'MISSING' ? '!' : '✓'}</span>
            <span>{typeLabel(task.kind)}</span>
            <small>{taskStatusLabel(task)}</small>
          </li>)}
        </ul>}
        <div className="provider-configuration-group-meta">
          <span>{tasks.length ? `${completed} of ${tasks.length} ready` : 'Managed in provider administration'}</span>
          {nextKind && <Button variant="quiet" type="button" onClick={() => onOpen(nextKind)}>{status === 'Needs setup' ? 'Review missing setup' : 'View effective settings'}</Button>}
        </div>
      </div>
    </article>
  );
}

export function ProviderConfigurationHub({ providerId, providerName }: { providerId: string; providerName: string }) {
  const [projection, setProjection] = useState<ProviderSetupAttributes | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [masterCatalogue, setMasterCatalogue] = useState<ProviderSetupMastersAttributes | null>(null);
  const [masterKind, setMasterKind] = useState('asset-definitions');
  const [selectedMasters, setSelectedMasters] = useState<Record<string, string[]>>({});
  const [savingMasters, setSavingMasters] = useState(false);
  const [selectedBlocker, setSelectedBlocker] = useState<SetupBlocker | null>(null);
  const setup = projection?.setup || null;

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError('');
    setMessage('');
    operationsData.providerConfigurationSetup(providerId)
      .then((response) => { if (!disposed) setProjection(response.data.attributes); })
      .catch((cause) => { if (!disposed) setError((cause as { message?: string })?.message || 'Provider setup could not be loaded.'); })
      .finally(() => { if (!disposed) setLoading(false); });
    operationsData.providerConfigurationMasters(providerId).then((response) => {
      if (disposed) return;
      const attributes = response.data.attributes;
      setMasterCatalogue(attributes);
      setSelectedMasters(Object.fromEntries(Object.entries(attributes.selected_masters || {}).map(([kind, rows]) => [kind, rows.map((row) => row.id)])));
    }).catch(() => { /* The readiness projection remains usable if a role cannot manage master selections. */ });
    return () => { disposed = true; };
  }, [providerId]);

  async function applyRecommendedDefaults() {
    if (!projection || !setup || busy || ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE'].includes(setup.state)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = {
        profile_code: setup.profile_code || 'FULL_LIFECYCLE',
        groups: setup.groups,
        reason: 'Provider standard setup from the configuration hub',
        scope: `provider:${providerId}`,
      };
      let revision = projection.provider_revision;
      if (setup.state === 'NOT_STARTED') {
        const dryRun = await operationsData.dryRunProviderConfigurationSetup(providerId, body, crypto.randomUUID());
        setProjection(dryRun.data.attributes);
        revision = dryRun.data.attributes.provider_revision;
      }
      const result = await operationsData.applyProviderConfigurationSetup(providerId, { ...body, expected_revision: revision }, crypto.randomUUID());
      setProjection(result.data.attributes);
      setMessage('Recommended defaults prepared as a provider-scoped draft. Continue with the required settings below.');
    } catch (cause) {
      setError((cause as { message?: string })?.message || 'Recommended provider defaults could not be prepared.');
    } finally {
      setBusy(false);
    }
  }

  async function saveMasterSelection() {
    if (!projection || savingMasters) return;
    setSavingMasters(true);
    setError('');
    setMessage('');
    try {
      const result = await operationsData.saveProviderMasterSelections(providerId, {
        selected_masters: { ...selectedMasters, [masterKind]: selectedForKind },
        expected_revision: projection.provider_revision,
        reason: 'Provider selected published platform masters for its operating setup',
      }, crypto.randomUUID());
      setProjection(result.data.attributes);
      const refreshed = await operationsData.providerConfigurationMasters(providerId);
      setMasterCatalogue(refreshed.data.attributes);
      setMessage('Master selections saved and audited. Published platform records remain the source of truth.');
    } catch (cause) {
      setError((cause as { message?: string })?.message || 'Platform master selections could not be saved.');
    } finally {
      setSavingMasters(false);
    }
  }

  const tasks = setup?.tasks || [];
  const blockers = setup?.readiness?.blockers || [];
  const grouped = useMemo(() => new Map(HUB_GROUPS.map((group) => [group.key, groupTasks(tasks, group)])), [tasks]);
  const platformMasters = tasks.reduce((total, task) => total + Number(task.platform_count || 0), 0);
  const providerSettings = tasks.filter((task) => ['WORKFORCE', 'CALENDAR', 'SERVICE_CONTROL', 'ADMINISTRATION', 'SUBSCRIPTION'].includes(task.code.split('_')[0])).filter((task) => task.provider_count && task.provider_count > 0).length;
  const nextTask = tasks.find((task) => task.status === 'MISSING');
  const canApplyDefaults = Boolean(setup && !['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE'].includes(setup.state));
  const showSetupAction = canApplyDefaults || Boolean(nextTask);
  const nextSetupPath = nextTask?.kind && !['ADMINISTRATION', 'SUBSCRIPTION'].includes(nextTask.kind) ? `configuration/${nextTask.kind}` : 'business-profile';
  const blockerInstruction = (blocker: SetupBlocker) => blocker.code.startsWith('SETUP_')
    ? `Check ${typeLabel(blocker.code.replace(/^SETUP_/, '').toLowerCase().replaceAll('_', '-'))}. Use the published platform default when available; create a provider-specific value only when your operating policy requires it.`
    : 'Open the related provider administration area to resolve this requirement.';
  const masterKinds = HUB_GROUPS.flatMap((group) => group.kinds).filter((kind) => masterCatalogue?.masters[kind]?.length);
  const mastersForKind = masterCatalogue?.masters[masterKind] || [];
  const hasExplicitSelection = Object.prototype.hasOwnProperty.call(selectedMasters, masterKind);
  const selectedForKind = hasExplicitSelection ? selectedMasters[masterKind] : mastersForKind.map((record) => record.id);
  const masterName = (record: ProviderSetupMastersAttributes['masters'][string][number]) => {
    const attrs = record.attributes;
    const definition = attrs.definition && typeof attrs.definition === 'object' ? attrs.definition as Record<string, unknown> : {};
    return String(attrs.name || attrs.label || attrs.display_name || definition.name || attrs.code || record.id);
  };

  return (
    <section className="content feature-page provider-configuration-hub">
      <PageHeader
        title="Provider configuration"
        description="Published platform defaults apply automatically wherever available. Review the effective setup here; add a provider-specific change only when your operating policy requires it."
        action={showSetupAction && <Button type="button" busy={busy} disabled={busy} onClick={() => canApplyDefaults ? void applyRecommendedDefaults() : go(nextSetupPath)}>{canApplyDefaults ? 'Apply recommended defaults' : 'Continue setup'}</Button>}
      />
      <div className="provider-configuration-context">
        <div><span className="page-eyebrow">Provider configuration</span><strong>{providerName || 'Selected provider'}</strong><small>All setup data is limited to this provider workspace.</small></div>
        <span className={`status status-${setup?.readiness?.ready ? 'success' : 'warning'}`}>{setup?.readiness?.ready ? 'Ready for operations' : 'Setup in progress'}</span>
      </div>
      {error && <div className="feature-error" role="alert"><strong>{error}</strong><Button type="button" variant="secondary" onClick={() => window.location.reload()}>Retry</Button></div>}
      {loading ? <p className="notice">Loading provider setup readiness…</p> : setup && <>
        <nav className="provider-configuration-setup-steps" aria-label="Provider setup steps">
          {[
            ['Master data', 'configuration', 'Select published defaults'],
            ['Workforce', 'configuration/skills', 'Skills and schedules'],
            ['Customer messages', 'configuration/notification-templates', 'Notifications'],
            ['Lift catalogue', 'configuration/asset-definitions', 'Passenger and MRL lifts'],
            ['Holidays', 'configuration/holiday-calendars', 'Year calendar'],
            ['Operations', 'configuration/sla-policies', 'Priority and SLA'],
            ['Coverage', 'configuration/support-coverage', 'Allocate support'],
            ['CompOff', 'configuration/extra-day-credits', 'Review credits'],
          ].map(([title, path, hint], index) => <button type="button" key={path} onClick={() => path === 'configuration' ? document.getElementById('provider-master-selector')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : go(path)}><span>{index + 1}</span><strong>{title}</strong><small>{hint}</small></button>)}
        </nav>
        <div className="provider-configuration-summary-grid">
          <article><span>Setup readiness</span><strong>{setup.readiness?.score ?? 0}%</strong><div className="provider-configuration-summary-bar"><i style={{ width: `${setup.readiness?.score ?? 0}%` }} /></div><small>{setup.readiness?.ready ? 'Required configuration is ready' : `${blockers.length} item${blockers.length === 1 ? '' : 's'} need attention`}</small></article>
          <article><span>Published masters</span><strong>{platformMasters}</strong><small>Available from Platform Administration</small></article>
          <article><span>Provider settings</span><strong>{providerSettings}</strong><small>Provider-owned values configured</small></article>
          <article><span>Next action</span><strong>{nextTask ? typeLabel(nextTask.kind) : 'No blocker'}</strong><small>{nextTask ? 'Required before activation' : 'Continue operating normally'}</small></article>
        </div>
        <section id="provider-master-selector" className="provider-configuration-master-picker">
          <div className="provider-configuration-card-heading"><div><h2>Select platform masters</h2><p>Choose the published defaults this provider uses. No catalogue is copied; selections retain each source revision.</p></div><span className="provider-configuration-badge">Platform managed</span></div>
          {!masterCatalogue ? <p className="notice">Loading published masters…</p> : <>
            <div className="provider-configuration-master-toolbar"><label><span>Configuration group</span><select aria-label="Master configuration group" value={masterKind} onChange={(event) => setMasterKind(event.target.value)}>{masterKinds.map((kind) => <option key={kind} value={kind}>{typeLabel(kind)}</option>)}</select></label><span>{selectedForKind.length} selected{hasExplicitSelection ? ' · provider selection' : ' · platform default'}</span></div>
            <div className="provider-configuration-master-list">{mastersForKind.map((record) => <label key={record.id} className="provider-configuration-master-row"><input type="checkbox" checked={selectedForKind.includes(record.id)} onChange={(event) => setSelectedMasters((current) => ({ ...current, [masterKind]: event.target.checked ? [...selectedForKind, record.id] : selectedForKind.filter((id) => id !== record.id) }))} /><span><strong>{masterName(record)}</strong><small>Published platform default · {typeLabel(masterKind)}</small></span><span className="status status-success">Available</span></label>)}{!mastersForKind.length && <p className="notice">No published platform masters are available in this group.</p>}</div>
            <div className="provider-configuration-master-footer"><small>Published masters are enabled by default. Changes are provider scoped, revision checked and recorded in the audit log.</small><Button type="button" busy={savingMasters} disabled={savingMasters} onClick={() => void saveMasterSelection()}>Save master selections</Button></div>
          </>}
        </section>
        <div className="provider-configuration-hub-layout">
          <section className="provider-configuration-progress-card">
            <div className="provider-configuration-card-heading"><div><h2>Configuration setup progress</h2><p>{setup.readiness?.ready ? 'Required defaults and provider settings are in place for this workspace.' : 'Resolve missing items before provider activation.'}</p></div><span>{tasks.filter((task) => task.status !== 'MISSING').length} / {tasks.length} ready</span></div>
            <div className="provider-configuration-group-list">{HUB_GROUPS.map((group) => <SetupGroupCard key={group.key} group={group} tasks={grouped.get(group.key) || []} onOpen={(kind) => go(kind === 'ADMINISTRATION' ? 'business-profile' : kind === 'SUBSCRIPTION' ? 'subscriptions' : `configuration/${kind}`)} />)}</div>
          </section>
          <aside className="provider-configuration-recommendation">
            <div className="provider-configuration-card-heading"><div><h2>Recommended setup</h2><p>Standard published defaults apply automatically. Provider-specific changes are optional and versioned.</p></div><span className="provider-configuration-badge">TRISe standard</span></div>
            <ul>
              <li><span className="provider-configuration-check">✓</span><div><strong>Use published elevator masters</strong><small>Passenger, MRL, goods, hydraulic and platform lift definitions.</small></div><Button type="button" variant="quiet" onClick={() => go('configuration/asset-definitions')}>Review</Button></li>
              <li><span className="provider-configuration-check">✓</span><div><strong>Enable standard service types</strong><small>Installation, modernization, AMC, repair, inspection and emergency.</small></div><Button type="button" variant="quiet" onClick={() => go('configuration/service-types')}>Review</Button></li>
              <li><span className="provider-configuration-check">✓</span><div><strong>Confirm safety checklists</strong><small>Pre-dispatch, installation, commissioning and handover templates.</small></div><Button type="button" variant="quiet" onClick={() => go('configuration/checklist-templates')}>Review</Button></li>
            </ul>
            <div className="provider-configuration-safety-note"><strong>Safe configuration rule</strong><p>Published platform defaults stay read-only. A provider override starts with those default values, then creates a governed revision without rewriting historical work.</p></div>
            {message && <p className="provider-configuration-feedback" role="status">{message}</p>}
            {showSetupAction && <Button type="button" busy={busy} disabled={busy} onClick={() => canApplyDefaults ? void applyRecommendedDefaults() : go(nextSetupPath)}>{canApplyDefaults ? 'Apply recommended defaults' : 'Open next required setup'}</Button>}
          </aside>
        </div>
        {blockers.length > 0 && <section className="provider-configuration-blockers"><div><strong>Action required</strong><p>Resolve these items before provider activation. Each item keeps its server-authoritative readiness rule.</p></div><ul>{blockers.slice(0, 6).map((blocker) => <li key={blocker.code}><button type="button" className="provider-configuration-blocker-info" aria-label={`View details for ${blocker.label}`} onClick={() => setSelectedBlocker(blocker)}>!</button><div><strong>{blocker.label}</strong><small>{blockerInstruction(blocker)}</small></div><Button type="button" variant="quiet" onClick={() => go(`configuration/${blocker.code.replace(/^SETUP_/, '').toLowerCase().replaceAll('_', '-')}`)}>Open</Button></li>)}</ul></section>}
      </>}
      {selectedBlocker && <div className="provider-configuration-modal-backdrop" role="presentation" onClick={() => setSelectedBlocker(null)}><section className="provider-configuration-info-modal" role="dialog" aria-modal="true" aria-labelledby="provider-configuration-blocker-title" onClick={(event) => event.stopPropagation()}><div className="provider-configuration-modal-heading"><div><span className="page-eyebrow">Required configuration</span><h2 id="provider-configuration-blocker-title">{selectedBlocker.label}</h2></div><button type="button" className="provider-configuration-modal-close" aria-label="Close configuration details" onClick={() => setSelectedBlocker(null)}>×</button></div><p className="provider-configuration-modal-lead">This item is required before the provider can be activated.</p><p>{blockerInstruction(selectedBlocker)}</p><div className="provider-configuration-modal-actions"><Button type="button" variant="secondary" onClick={() => setSelectedBlocker(null)}>Close</Button><Button type="button" onClick={() => { setSelectedBlocker(null); go(`configuration/${selectedBlocker.code.replace(/^SETUP_/, '').toLowerCase().replaceAll('_', '-')}`); }}>Open setup</Button></div></section></div>}
    </section>
  );
}

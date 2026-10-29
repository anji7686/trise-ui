import type { InstallationProjectAttributes, Resource } from './data';
import { customerReadableName } from './coverage-list';

export type CustomerProjectRecord = {
  providerId: string;
  providerName?: string;
  resource: Resource<InstallationProjectAttributes>;
};

export type CustomerProjectHandoverEvent = NonNullable<InstallationProjectAttributes['handover_events']>[number];

export type CustomerProjectJourneyState = 'complete' | 'current' | 'upcoming' | 'not-shared';
export type CustomerProjectJourneyStep = { key: 'scope' | 'delivery' | 'installation' | 'quality' | 'handover'; label: string; state: CustomerProjectJourneyState };

function stageJourneyState(stages: NonNullable<InstallationProjectAttributes['stages']>, pattern: RegExp): CustomerProjectJourneyState {
  const matching = stages.filter((stage) => pattern.test(`${stage.code} ${stage.title}`));
  if (!matching.length) return 'upcoming';
  const statuses = matching.map((stage) => stage.status.toUpperCase());
  if (statuses.every((status) => ['COMPLETED', 'COMPLETE', 'DONE', 'ACCEPTED'].includes(status))) return 'complete';
  if (statuses.some((status) => ['IN_PROGRESS', 'IN PROGRESS', 'STARTED', 'ACTIVE'].includes(status))) return 'current';
  return 'upcoming';
}

/** Build customer-facing checkpoints only from project stages and handover events shared by the API. */
export function customerProjectJourney(attributes: InstallationProjectAttributes): CustomerProjectJourneyStep[] {
  const stages = attributes.stages || [];
  const hasDeliveryStage = stages.some((stage) => /deliver|dispatch/i.test(`${stage.code} ${stage.title}`));
  const events = attributes.handover_events || [];
  const acceptedAssets = new Set(events.filter((event) => event.event_kind.toUpperCase() === 'ACCEPTED').map((event) => event.asset_id || 'PROJECT'));
  const pendingHandover = events.some((event) => event.event_kind.toUpperCase() === 'REQUESTED' && !acceptedAssets.has(event.asset_id || 'PROJECT'));
  const projectAssets = attributes.project_assets || [];
  const allAssetsAccepted = acceptedAssets.has('PROJECT') || (projectAssets.length > 0 && projectAssets.every((asset) => acceptedAssets.has(asset.id)));
  const hasAcceptance = acceptedAssets.size > 0;
  const handoverState: CustomerProjectJourneyState = allAssetsAccepted ? 'complete' : pendingHandover || hasAcceptance ? 'current' : 'upcoming';
  return [
    { key: 'scope', label: 'Accepted scope', state: attributes.status.toUpperCase() === 'DRAFT' ? 'upcoming' : 'complete' },
    { key: 'delivery', label: 'Delivery', state: hasDeliveryStage ? stageJourneyState(stages, /deliver|dispatch/i) : 'not-shared' },
    { key: 'installation', label: 'Installation', state: stageJourneyState(stages, /install/i) },
    { key: 'quality', label: 'Quality checks', state: stageJourneyState(stages, /test|commission|inspection|quality/i) },
    { key: 'handover', label: 'Handover', state: handoverState },
  ];
}

export function handoverEvidenceIds(event: CustomerProjectHandoverEvent): string[] {
  return (event.evidence_documents || []).map((document) => document.id).filter(Boolean);
}

export function customerProjectsEmptyMessage(hasMore: boolean): string {
  return hasMore
    ? 'No projects were found in the latest records. Load more to check older projects.'
    : 'No installation projects are available across your linked providers.';
}

/** The overall percentage counts unit-level execution stages, not the five journey checkpoints. */
export function customerProjectProgressLabel(attributes: InstallationProjectAttributes): string {
  if (attributes.stage_count <= 0) return 'Execution progress not shared';
  return `${attributes.completed_stage_count} of ${attributes.stage_count} unit execution stages complete`;
}

/** Show the customer the next meaningful project state instead of an internal API enum. */
export function customerProjectListStatusLabel(attributes: InstallationProjectAttributes): string {
  const events = attributes.handover_events || [];
  const acceptedAssets = new Set(events.filter((event) => event.event_kind.toUpperCase() === 'ACCEPTED').map((event) => event.asset_id || 'PROJECT'));
  const pending = events.filter((event) => event.event_kind.toUpperCase() === 'REQUESTED' && !acceptedAssets.has(event.asset_id || 'PROJECT'));
  if (pending.some((event) => handoverEvidenceIds(event).length > 0)) return 'Ready for your handover review';
  if (pending.length) return 'Handover report pending';
  const projectAssets = attributes.project_assets || [];
  if (acceptedAssets.has('PROJECT') || (projectAssets.length > 0 && projectAssets.every((asset) => acceptedAssets.has(asset.id)))) return 'Handover accepted';
  const journey = customerProjectJourney(attributes);
  if (journey.find((step) => step.key === 'quality')?.state === 'current') return 'Quality checks in progress';
  if (journey.find((step) => step.key === 'installation')?.state === 'current') return 'Installation in progress';
  const status = attributes.status.trim().toUpperCase();
  if (['OPEN', 'IN_PROGRESS', 'ACTIVE', 'STARTED'].includes(status)) return 'In progress';
  if (['COMPLETED', 'COMPLETE', 'DONE', 'CLOSED'].includes(status)) return 'Completed';
  if (['CANCELLED', 'CANCELED'].includes(status)) return 'Cancelled';
  return status.toLocaleLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Project status not shared';
}

export function customerProjectDisplayName(title: string, serviceLocationName?: string | null): string {
  const rawTitle = title.trim();
  const location = serviceLocationName?.trim();
  const withoutLocation = location && rawTitle.toLocaleLowerCase().startsWith(`${location.toLocaleLowerCase()} ·`)
    ? rawTitle.slice(location.length + 1).trim().replace(/^·\s*/, '')
    : rawTitle;
  return customerReadableName(withoutLocation);
}

/** Hide provider-side drafts and empty execution shells from the customer project feed. */
export function visibleInstallationProjects(records: CustomerProjectRecord[]): CustomerProjectRecord[] {
  return records.filter(({ resource }) => {
    const attributes = resource.attributes;
    const hasCustomerVisibleProjectContent = Boolean(attributes.source_quotation_id)
      || (attributes.stage_count || 0) > 0
      || Boolean(attributes.stages?.length || attributes.handover_events?.length);
    return attributes.project_classification_key === 'ELEVATOR_INSTALLATION'
      && attributes.status.toUpperCase() !== 'DRAFT'
      && hasCustomerVisibleProjectContent;
  });
}

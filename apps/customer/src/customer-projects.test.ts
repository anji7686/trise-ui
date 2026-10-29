import { describe, expect, it } from 'vitest';
import { customerProjectDisplayName, customerProjectJourney, customerProjectListStatusLabel, customerProjectProgressLabel, customerProjectsEmptyMessage, handoverEvidenceIds, visibleInstallationProjects } from './customer-projects';
import type { InstallationProjectAttributes, Resource } from './data';

function project(id: string, attributes: Partial<InstallationProjectAttributes> = {}): Resource<InstallationProjectAttributes> {
  return {
    id,
    type: 'installation-projects',
    attributes: {
      title: `Project ${id}`,
      status: 'IN_PROGRESS',
      revision: 1,
      progress_percent: 0,
      stage_count: 0,
      completed_stage_count: 0,
      project_classification_key: 'ELEVATOR_INSTALLATION',
      ...attributes,
    },
    relationships: {},
  };
}

describe('customer installation project visibility', () => {
  it('shows a readable project title without repeated site names or import suffixes', () => {
    expect(customerProjectDisplayName('Green Heights 1792873891609 · Lift installation 1792873891610', 'Green Heights 1792873891609')).toBe('Lift installation');
    expect(customerProjectDisplayName('Passenger lift · A', 'Green Heights')).toBe('Passenger lift · A');
  });

  it('describes empty pages differently from an exhausted project feed', () => {
    expect(customerProjectsEmptyMessage(true)).toBe('No projects were found in the latest records. Load more to check older projects.');
    expect(customerProjectsEmptyMessage(false)).toBe('No installation projects are available across your linked providers.');
  });

  it('shows projects with a linked quotation, execution stage or handover event and hides unit-only shells', () => {
    const records = [
      { providerId: 'p', providerName: 'Provider', resource: project('unit-shell', { project_assets: [{ id: 'a', display_name: 'Lift A', role: 'PRIMARY', status: 'ACTIVE' }] }) },
      { providerId: 'p', providerName: 'Provider', resource: project('quoted-unit', { source_quotation_id: 'quote-1', project_assets: [{ id: 'b', display_name: 'Lift B', role: 'PRIMARY', status: 'ACTIVE' }] }) },
      { providerId: 'p', providerName: 'Provider', resource: project('stage', { stages: [{ id: 's', code: 'INSTALL', title: 'Installation', status: 'IN_PROGRESS', mandatory: true }] }) },
      { providerId: 'p', providerName: 'Provider', resource: project('handover', { handover_events: [{ id: 'h', event_kind: 'REQUESTED' }] }) },
      { providerId: 'p', providerName: 'Provider', resource: project('empty') },
    ];
    expect(visibleInstallationProjects(records).map(({ resource }) => resource.id)).toEqual(['quoted-unit', 'stage', 'handover']);
  });

  it('excludes drafts and unrelated project classes even if they have stages', () => {
    const records = [
      { providerId: 'p', providerName: 'Provider', resource: project('draft', { status: 'draft', project_assets: [{ id: 'a', display_name: 'Lift A', role: 'PRIMARY', status: 'ACTIVE' }] }) },
      { providerId: 'p', providerName: 'Provider', resource: project('other', { project_classification_key: 'OTHER', stages: [{ id: 's', code: 'S', title: 'Stage', status: 'DONE', mandatory: true }] }) },
    ];
    expect(visibleInstallationProjects(records)).toEqual([]);
  });
});

describe('customer project progress label', () => {
  it('distinguishes unit execution stage counts from the five journey checkpoints', () => {
    expect(customerProjectProgressLabel(project('progress', {
      progress_percent: 75,
      stage_count: 4,
      completed_stage_count: 3,
    }).attributes)).toBe('3 of 4 unit execution stages complete');
  });

  it('explains when the provider has not shared execution progress yet', () => {
    expect(customerProjectProgressLabel(project('empty').attributes)).toBe('Execution progress not shared');
  });
});

describe('customer project list status', () => {
  it('uses human next-step labels instead of raw API status enums', () => {
    expect(customerProjectListStatusLabel(project('open', { status: 'OPEN' }).attributes)).toBe('In progress');
    expect(customerProjectListStatusLabel(project('quality', {
      status: 'OPEN',
      stages: [{ id: 'q', code: 'TESTING', title: 'Quality checks', status: 'IN_PROGRESS', mandatory: true }],
    }).attributes)).toBe('Quality checks in progress');
    expect(customerProjectListStatusLabel(project('review', {
      status: 'OPEN',
      project_assets: [{ id: 'lift-a', display_name: 'Lift A', role: 'PRIMARY', status: 'ACTIVE' }],
      handover_events: [{ id: 'request', event_kind: 'REQUESTED', asset_id: 'lift-a', evidence_documents: [{ id: 'report', filename: 'report.pdf', media_type: 'application/pdf', classification: 'SERVICE_CASE_HANDOVER_REPORT' }] }],
    }).attributes)).toBe('Ready for your handover review');
    expect(customerProjectListStatusLabel(project('accepted', {
      status: 'OPEN',
      project_assets: [{ id: 'lift-a', display_name: 'Lift A', role: 'PRIMARY', status: 'ACTIVE' }],
      handover_events: [{ id: 'accepted', event_kind: 'ACCEPTED', asset_id: 'lift-a' }],
    }).attributes)).toBe('Handover accepted');
  });
});

describe('customer handover evidence', () => {
  it('requires report IDs from the requested event before acceptance', () => {
    expect(handoverEvidenceIds({ id: 'request-1', event_kind: 'REQUESTED' })).toEqual([]);
    expect(handoverEvidenceIds({
      id: 'request-2',
      event_kind: 'REQUESTED',
      evidence_documents: [
        { id: 'report-1', filename: 'commissioning.pdf', media_type: 'application/pdf', classification: 'SERVICE_CASE_HANDOVER_REPORT' },
        { id: '', filename: 'invalid.pdf', media_type: 'application/pdf', classification: 'SERVICE_CASE_HANDOVER_REPORT' },
      ],
    })).toEqual(['report-1']);
  });
});

describe('customer installation journey', () => {
  it('shows only stage progress and handover state shared by the project API', () => {
    expect(customerProjectJourney({
      title: 'Two-lift installation', status: 'OPEN', revision: 8, progress_percent: 75, stage_count: 4, completed_stage_count: 3,
      project_assets: [
        { id: 'lift-a', display_name: 'Lift A', role: 'PRIMARY', status: 'ACTIVE' },
        { id: 'lift-b', display_name: 'Lift B', role: 'PARTICIPATING', status: 'ACTIVE' },
      ],
      stages: [
        { id: 'install-a', code: 'INSTALLATION', title: 'Installation', status: 'COMPLETED', mandatory: true, asset_id: 'lift-a' },
        { id: 'quality-a', code: 'TESTING', title: 'Testing & commissioning', status: 'COMPLETED', mandatory: true, asset_id: 'lift-a' },
        { id: 'install-b', code: 'INSTALLATION', title: 'Installation', status: 'COMPLETED', mandatory: true, asset_id: 'lift-b' },
        { id: 'quality-b', code: 'TESTING', title: 'Testing & commissioning', status: 'IN_PROGRESS', mandatory: true, asset_id: 'lift-b' },
      ],
      handover_events: [{ id: 'accepted-a', event_kind: 'ACCEPTED', asset_id: 'lift-a' }],
    }).map(({ key, state }) => [key, state])).toEqual([
      ['scope', 'complete'], ['delivery', 'not-shared'], ['installation', 'complete'], ['quality', 'current'], ['handover', 'current'],
    ]);
  });

  it('does not report handover complete until every project lift is accepted', () => {
    const attributes: InstallationProjectAttributes = {
      title: 'Two-lift installation', status: 'OPEN', revision: 8, progress_percent: 100, stage_count: 2, completed_stage_count: 2,
      project_assets: [
        { id: 'lift-a', display_name: 'Lift A', role: 'PRIMARY', status: 'ACTIVE' },
        { id: 'lift-b', display_name: 'Lift B', role: 'PARTICIPATING', status: 'ACTIVE' },
      ],
      handover_events: [
        { id: 'accepted-a', event_kind: 'ACCEPTED', asset_id: 'lift-a' },
        { id: 'requested-b', event_kind: 'REQUESTED', asset_id: 'lift-b' },
      ],
    };
    expect(customerProjectJourney(attributes).at(-1)?.state).toBe('current');
    attributes.handover_events?.push({ id: 'accepted-b', event_kind: 'ACCEPTED', asset_id: 'lift-b' });
    expect(customerProjectJourney(attributes).at(-1)?.state).toBe('complete');
  });
});

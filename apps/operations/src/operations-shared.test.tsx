import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { displayLabel, EmptyState, ProviderActionMenu, WorkspaceTabs } from './operations-shared';

describe('Operations shared workspace primitives', () => {
  it('renders accessible workspace tabs with one selected tab', () => {
    const html = renderToStaticMarkup(<WorkspaceTabs label="Job workspace" activeId="jobs" onChange={() => undefined} tabs={[{ id: 'jobs', label: 'Jobs' }, { id: 'my-work', label: 'My Work' }]} />);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('My Work');
  });

  it('keeps empty states explicit and actionable', () => {
    const html = renderToStaticMarkup(<EmptyState title="No authorized work" description="There are no records in this provider context." />);
    expect(html).toContain('No authorized work');
    expect(html).toContain('provider context');
  });

  it('renders one row action directly and keeps multiple actions in a menu', () => {
    const single = renderToStaticMarkup(<ProviderActionMenu label="Single row action" actions={[{ id: 'view', label: 'View', onSelect: () => undefined }]} />);
    const multiple = renderToStaticMarkup(<ProviderActionMenu label="Multiple row actions" actions={[{ id: 'view', label: 'View', onSelect: () => undefined }, { id: 'archive', label: 'Archive', onSelect: () => undefined }]} />);
    expect(single).toContain('>View</button>');
    expect(single).not.toContain('provider-action-menu-trigger');
    expect(multiple).toContain('provider-action-menu-trigger');
    expect(multiple).toContain('>View</button>');
  });

  it('keeps server codes readable and hides UUID fallbacks from operators', () => {
    expect(displayLabel('ELEVATOR_INSTALLATION')).toBe('Elevator Installation');
    expect(displayLabel('PENDING_APPROVAL')).toBe('Pending Approval');
    expect(displayLabel('01a16d9f-5f67-776e-b10b-41923657e453', 'Project')).toBe('Project');
  });
});

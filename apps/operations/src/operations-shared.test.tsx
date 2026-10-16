import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EmptyState, WorkspaceTabs } from './operations-shared';

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
});

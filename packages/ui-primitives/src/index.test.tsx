import { describe, expect, it } from 'vitest';
import { Button, FilterToolbar, PageHeader } from './index';

describe('shared Button', () => {
  it('exposes a consistent variant and prevents duplicate work while busy', () => {
    const element = Button({ children: 'Confirm appointment', variant: 'primary', busy: true });
    expect(element.props.className).toContain('button-primary');
    expect(element.props.disabled).toBe(true);
    expect(element.props['aria-busy']).toBe(true);
  });
});

describe('provider dashboard primitives', () => {
  it('keeps route titles and primary actions in a compact page header', () => {
    const element = PageHeader({ title: 'Appointments', description: 'Review scheduled visits', action: Button({ children: 'Create appointment' }) });
    expect(element.props.className).toBe('page-header');
    expect(element.props.children[0].props.children[1].props.children).toBe('Appointments');
  });

  it('keeps filters and truthful loaded-record wording in one toolbar', () => {
    const element = FilterToolbar({ resultLabel: 'Showing 3 loaded records' });
    expect(element.props.className).toBe('filter-toolbar');
    expect(element.props.children[1].props.children).toBe('Showing 3 loaded records');
  });
});

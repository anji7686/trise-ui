import { describe, expect, it } from 'vitest';
import { SvgIcon } from './icons';

describe('operations SVG icons', () => {
  it('renders decorative icons without an accessibility announcement', () => {
    const icon = SvgIcon({ name: 'filter' });
    expect(icon.props['aria-hidden']).toBe(true);
    expect(icon.props['aria-label']).toBeUndefined();
  });

  it('supports a labelled icon for an icon-only control', () => {
    const icon = SvgIcon({ name: 'chevron-right', label: 'Open provider details' });
    expect(icon.props['aria-label']).toBe('Open provider details');
    expect(icon.props['aria-hidden']).toBeUndefined();
  });
});

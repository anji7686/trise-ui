import { describe, expect, it } from 'vitest';
import { Button } from './index';

describe('shared Button', () => {
  it('exposes a consistent variant and prevents duplicate work while busy', () => {
    const element = Button({ children: 'Confirm appointment', variant: 'primary', busy: true });
    expect(element.props.className).toContain('button-primary');
    expect(element.props.disabled).toBe(true);
    expect(element.props['aria-busy']).toBe(true);
  });
});

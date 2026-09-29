import { describe, expect, it } from 'vitest';
import { tokens } from './index';

describe('TRISE design foundation', () => {
  it('keeps the approved primary and semantic palette anchors', () => {
    expect(tokens.color.light.primary).toBe('#264673');
    expect(tokens.color.light.background).toBe('#F5F7FA');
    expect(tokens.color.dark.background).toBe('#0D1520');
  });
});

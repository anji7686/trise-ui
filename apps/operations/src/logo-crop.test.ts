import { describe, expect, it } from 'vitest';
import { containFrame, logoFileError, MAX_LOGO_INPUT_BYTES } from './logo-crop';

describe('provider logo crop rules', () => {
  it('accepts supported files and rejects unsafe formats, size, and dimensions', () => {
    expect(logoFileError({ type: 'image/png', size: 1024 }, { width: 1200, height: 400 })).toBe('');
    expect(logoFileError({ type: 'image/svg+xml', size: 1024 })).toContain('PNG');
    expect(logoFileError({ type: 'image/png', size: MAX_LOGO_INPUT_BYTES + 1 })).toContain('5 MB');
    expect(logoFileError({ type: 'image/png', size: 1024 }, { width: 10001, height: 100 })).toContain('too large');
  });

  it('contains a wide logo inside the square crop with padding', () => {
    const frame = containFrame(1600, 400, 280, 24);
    expect(frame.width).toBeLessThanOrEqual(232);
    expect(frame.height).toBeLessThanOrEqual(232);
    expect(frame.left).toBeGreaterThan(24);
    expect(frame.top).toBeGreaterThan(24);
  });
});

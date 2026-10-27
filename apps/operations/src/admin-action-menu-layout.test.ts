import { describe, expect, it } from 'vitest';
import { adminActionMenuPosition } from './admin-action-menu-layout';

describe('adminActionMenuPosition', () => {
  it('opens above a trigger near the bottom of the viewport', () => {
    expect(adminActionMenuPosition({ top: 840, right: 1310, bottom: 874 }, 240, { width: 1360, height: 900 })).toEqual({
      top: 594,
      right: 50,
      maxHeight: 352,
    });
  });

  it('opens below a trigger when there is room', () => {
    expect(adminActionMenuPosition({ top: 120, right: 500, bottom: 154 }, 240, { width: 1360, height: 900 })).toEqual({
      top: 160,
      right: 860,
      maxHeight: 352,
    });
  });

  it('caps menu height to the available space and keeps it inside the viewport', () => {
    const position = adminActionMenuPosition({ top: 60, right: 1358, bottom: 94 }, 500, { width: 1360, height: 100 });
    expect(position.right).toBe(8);
    expect(position.top).toBeGreaterThanOrEqual(8);
    expect(position.maxHeight).toBe(100);
  });
});

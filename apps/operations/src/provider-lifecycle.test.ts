import { describe, expect, it } from 'vitest';
import { activationBlocker, lifecycleActions } from './provider-lifecycle';

describe('provider lifecycle presentation', () => {
  it('offers only valid actions for each operational state', () => {
    expect(lifecycleActions('PENDING').map(({ action }) => action)).toEqual(['activate']);
    expect(lifecycleActions('ACTIVE').map(({ action }) => action)).toEqual(['hold', 'suspend', 'close']);
    expect(lifecycleActions('ON_HOLD').map(({ action }) => action)).toEqual(['reactivate', 'suspend', 'close']);
    expect(lifecycleActions('SUSPENDED').map(({ action }) => action)).toEqual(['reactivate', 'close']);
    expect(lifecycleActions('CLOSED')).toEqual([]);
  });

  it('requires exact business verification before activation', () => {
    expect(activationBlocker('VERIFIED')).toBe('');
    expect(activationBlocker('PENDING_REVIEW')).toContain('Verify');
  });
});

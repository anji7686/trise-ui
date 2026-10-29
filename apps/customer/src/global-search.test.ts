import { describe, expect, it } from 'vitest';
import { globalSearchRoute, matchesGlobalSearch } from './global-search';

describe('customer account global search', () => {
  it('matches service records case-insensitively across title, status, provider and location fields', () => {
    expect(matchesGlobalSearch('continuous', ['Preventive lift visit', 'Completed', 'Lift Rise Elevators', 'Continuous Tower'])).toBe(true);
    expect(matchesGlobalSearch('ELEVATORS', ['Routine maintenance', 'Requested', 'Lift Rise Elevators'])).toBe(true);
    expect(matchesGlobalSearch('no match', ['Routine maintenance', 'Requested', 'Lift Rise Elevators'])).toBe(false);
  });

  it('requires at least two trimmed characters', () => {
    expect(matchesGlobalSearch(' ', ['Anything'])).toBe(false);
    expect(matchesGlobalSearch('a', ['Asset A'])).toBe(false);
  });

  it.each([
    ['asset', '/asset/asset%2F1'],
    ['request', '/request/request%2F1'],
    ['booking', '/booking/booking%2F1'],
    ['service', '/service/job%2F1']
  ] as const)('routes a %s result through its customer detail page', (kind, expected) => {
    expect(globalSearchRoute(kind, `${kind === 'service' ? 'job' : kind}/1`)).toBe(expected);
  });
});

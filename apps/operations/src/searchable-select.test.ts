import { describe, expect, it } from 'vitest';
import { sortedSearchOptions } from './searchable-select';
import { statusTone } from './operations-status';

describe('Operations lookup policy', () => {
  const options = [
    { id: 'z', label: 'Provider 10', detail: 'INR' },
    { id: 'b', label: 'Provider 2', detail: 'INR' },
    { id: 'a', label: 'Provider 1', detail: 'USD' },
  ];
  it('shows every available record before three trimmed filter characters', () => {
    for (const search of ['', 'P', 'Pr', ' Pr ']) expect(sortedSearchOptions(options, search).map(option => option.id)).toEqual(['a', 'b', 'z']);
  });
  it('sorts matching labels naturally while retaining authoritative IDs', () => {
    expect(sortedSearchOptions(options, 'pRo')).toEqual([options[2], options[1], options[0]]);
    expect(sortedSearchOptions(options, '1 USD')).toEqual([options[2]]);
    expect(options.map(option => option.id)).toEqual(['z', 'b', 'a']);
  });
  it('matches details and reports no fabricated choices', () => {
    expect(sortedSearchOptions(options, ' USD ')).toEqual([options[2]]);
    expect(sortedSearchOptions(options, 'absent')).toEqual([]);
  });
});

describe('Operations semantic status presentation', () => {
  it('distinguishes positive, pending, failed and historical records', () => {
    expect(statusTone('VERIFIED')).toBe('success');
    expect(statusTone('pending_review')).toBe('warning');
    expect(statusTone('Corrections Requested')).toBe('warning');
    expect(statusTone('Suspended')).toBe('danger');
    expect(statusTone('Scheduled')).toBe('info');
    expect(statusTone('Ended')).toBe('neutral');
    expect(statusTone('Not Configured')).toBe('neutral');
  });
});

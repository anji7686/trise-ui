import { describe, expect, it } from 'vitest';
import { contextLabel, displayName, isOpaqueId } from './human-readable';

describe('human-readable display helpers', () => {
  it('prefers an authorized human name and never falls back to a UUID', () => {
    const id = '01a12c3e-1234-7123-8123-64187649b5a3';
    expect(isOpaqueId(id)).toBe(true);
    expect(displayName({ id, attributes: { id } })).toBe('Name unavailable');
    expect(displayName({ id, attributes: { display_name: 'Lift Rise Elevators' } })).toBe('Lift Rise Elevators');
  });

  it('adds context without changing the stable internal id', () => {
    const record = { id: 'internal-id', attributes: { name: 'Main Office', city: 'Bengaluru' } };
    expect(displayName(record)).toBe('Main Office');
    expect(contextLabel(record)).toBe('Bengaluru');
  });
});

import { describe, expect, it } from 'vitest';
import { customerPlaceProviderSummary, mergeCustomerPlaces, placeProvidersNeedingNextPage } from './customer-places';
import type { LocationAttributes, Resource } from './data';

function location(id: string, createdAt: string): Resource<LocationAttributes> {
  return { id, type: 'locations', attributes: { name: id, created_at: createdAt }, relationships: {} };
}

describe('customer-wide place feed', () => {
  it('summarizes duplicate provider accounts without repeating their full names', () => {
    expect(customerPlaceProviderSummary(['Lift Rise · Account 2', 'Lift Rise · Account 1'])).toBe('2 linked provider accounts');
    expect(customerPlaceProviderSummary(['Lift Rise · Account 2', 'Metro Lifts'])).toBe('2 service providers');
    expect(customerPlaceProviderSummary(['Lift Rise'])).toBe('Lift Rise');
  });

  it('merges authorized provider pages by the API created_at order', () => {
    const places = mergeCustomerPlaces([
      { providerId: 'provider-a', providerName: 'Lift Rise', data: [location('older', '2026-10-01T00:00:00Z'), location('newest', '2026-10-03T00:00:00Z')] },
      { providerId: 'provider-b', providerName: 'Other Lifts', data: [location('middle', '2026-10-02T00:00:00Z')] },
    ]);
    expect(places.map(place => place.resource.id)).toEqual(['newest', 'middle', 'older']);
  });

  it('deduplicates a shared location while retaining authorized provider context', () => {
    const resource = location('shared', '2026-10-01T00:00:00Z');
    const places = mergeCustomerPlaces([
      { providerId: 'provider-a', providerName: 'Lift Rise', data: [resource] },
      { providerId: 'provider-b', providerName: 'Other Lifts', data: [resource] },
    ]);
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ providerId: 'provider-a', providerName: 'Lift Rise · Other Lifts', providerNames: ['Lift Rise', 'Other Lifts'] });
  });

  it('fetches another page only when a provider buffer reaches the visible boundary', () => {
    const ids = ['provider-a', 'provider-b', 'provider-c'];
    const cursors = { 'provider-a': 'a-next', 'provider-b': 'b-next', 'provider-c': null };
    expect(placeProvidersNeedingNextPage(ids, { 'provider-a': 15, 'provider-b': 30, 'provider-c': 8 }, cursors, 15)).toEqual(['provider-a']);
    expect(placeProvidersNeedingNextPage(ids, { 'provider-a': 30, 'provider-b': 30, 'provider-c': 8 }, cursors, 15)).toEqual([]);
  });
});

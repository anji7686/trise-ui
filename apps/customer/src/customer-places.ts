import type { LocationAttributes, Resource } from './data';

export type CustomerPlace = {
  providerId: string;
  providerName: string;
  providerNames: string[];
  resource: Resource<LocationAttributes>;
};

export function customerPlaceProviderSummary(providerNames: readonly string[]): string {
  const names = [...new Set(providerNames.map(name => name.trim()).filter(Boolean))];
  if (names.length < 2) return names[0] || 'Service provider';
  const providerBrands = names.map(name => name.replace(/\s+·\s+Account\s+\d+$/i, ''));
  if (providerBrands.every(name => name === providerBrands[0])) return `${names.length} linked provider accounts`;
  return `${names.length} service providers`;
}

export function mergeCustomerPlaces(pages: Array<{ providerId: string; providerName: string; data: Resource<LocationAttributes>[] }>): CustomerPlace[] {
  const places = new Map<string, CustomerPlace>();
  for (const page of pages) {
    for (const resource of page.data) {
      const existing = places.get(resource.id);
      if (existing) {
        existing.providerNames = [...new Set([...existing.providerNames, page.providerName])];
        existing.providerName = existing.providerNames.join(' · ');
      } else {
        places.set(resource.id, { providerId: page.providerId, providerName: page.providerName, providerNames: [page.providerName], resource });
      }
    }
  }
  return [...places.values()].sort((a, b) => {
    const createdA = a.resource.attributes.created_at || '';
    const createdB = b.resource.attributes.created_at || '';
    return createdB.localeCompare(createdA) || a.resource.id.localeCompare(b.resource.id);
  });
}

export function placeProvidersNeedingNextPage(providerIds: string[], loadedCounts: Record<string, number>, cursors: Record<string, string | null>, visibleCount: number): string[] {
  return providerIds.filter(id => Boolean(cursors[id]) && (loadedCounts[id] || 0) <= visibleCount);
}

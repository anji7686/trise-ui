import { describe, expect, it } from 'vitest';
import { assetLocationOptions } from './asset-location-filter';
import type { AssetAttributes, ProviderAttributes, Resource } from './data';

const provider = (id: string, name: string): Resource<ProviderAttributes> => ({ id, type: 'service-providers', attributes: { display_name: name }, relationships: {} });
const asset = (id: string, providerId: string, locationId: string, locationName: string, address: string): Resource<AssetAttributes> => ({
  id, type: 'assets', attributes: {
    name: id, status: 'ACTIVE', provider_id: providerId, definition_version: 1, revision: 1, created_at: '2026-10-29T00:00:00Z',
    service_location_name: locationName, service_location_address: [address], service_location_code: `${id.toUpperCase()}CODE`,
  }, relationships: { location: { id: locationId, type: 'service-locations' } },
});

describe('customer asset place filter', () => {
  it('uses authorized asset locations, labels duplicate names clearly, and removes duplicate location references', () => {
    expect(assetLocationOptions([
      asset('asset-a', 'provider-a', 'place-1', 'Green Meadows', 'Bengaluru'),
      asset('asset-b', 'provider-a', 'place-1', 'Green Meadows', 'Bengaluru'),
      asset('asset-c', 'provider-b', 'place-2', 'Green Meadows', 'Mysuru'),
      asset('asset-d', 'provider-b', 'place-3', 'Orchard House', 'Mysuru'),
    ], [provider('provider-a', 'North Lift Co.'), provider('provider-b', 'South Lift Co.')])).toEqual([
      { id: 'place-1', name: 'Green Meadows', label: 'Green Meadows · Bengaluru' },
      { id: 'place-2', name: 'Green Meadows', label: 'Green Meadows · Mysuru' },
      { id: 'place-3', name: 'Orchard House', label: 'Orchard House' },
    ]);
  });

  it('omits assets without an authorized location relationship or readable location name', () => {
    const withoutLocation = asset('asset-no-place', 'provider-a', '', '', '');
    withoutLocation.relationships.location = null;
    const withoutName = asset('asset-no-name', 'provider-a', 'place-1', '', 'Bengaluru');
    expect(assetLocationOptions([withoutLocation, withoutName], [provider('provider-a', 'North Lift Co.')])).toEqual([]);
  });

  it('cleans imported numeric suffixes and uses the authorized site code for matching locations', () => {
    expect(assetLocationOptions([
      asset('asset-a', 'provider-a', 'place-a', 'Continuous elevator site 1792483052041', 'Continuous browser test address'),
      asset('asset-b', 'provider-a', 'place-b', 'Continuous elevator site 1792487072593', 'Continuous browser test address'),
    ], [provider('provider-a', 'North Lift Co.')])).toEqual([
      { id: 'place-a', name: 'Continuous elevator site', label: 'Continuous elevator site · ASSET-ACODE' },
      { id: 'place-b', name: 'Continuous elevator site', label: 'Continuous elevator site · ASSET-BCODE' },
    ]);
  });

  it('hides the internal verification label while retaining the location code', () => {
    expect(assetLocationOptions([
      asset('asset-a', 'provider-a', 'place-a', 'Codex Flow Verification 20261027 · Building A', 'Mundur B.O, Bengaluru'),
    ], [provider('provider-a', 'North Lift Co.')])).toEqual([
      { id: 'place-a', name: 'Service location', label: 'Service location' },
    ]);
  });
});

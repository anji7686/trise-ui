import { describe, expect, it } from 'vitest';
import { assetLocationFilterFromHash, customerAssetCoverageLabels, customerAssetCoverageSummary, customerAssetKey, customerAssetPlaceLabel, customerUpcomingBookingWindow, nextConfirmedAssetVisits, type ConfirmedAssetVisit, type CustomerAssetCoverageEntry } from './customer-assets';

const visit = (overrides: Partial<ConfirmedAssetVisit> = {}): ConfirmedAssetVisit => ({
  providerId: 'provider-a', assetId: 'asset-1', summary: 'Maintenance', startsAt: '2026-11-05T04:00:00Z', status: 'CONFIRMED', ...overrides
});

describe('customer asset visit summaries', () => {
  it('creates a 31-day booking window without exceeding the API boundary', () => {
    const now = Date.parse('2026-10-29T11:36:05.694Z');
    const window = customerUpcomingBookingWindow(now);
    expect(Date.parse(window.startsAtGte)).toBe(now);
    expect(Date.parse(window.startsAtLt) - Date.parse(window.startsAtGte)).toBe(31 * 86_400_000);
  });

  it('keeps the nearest future confirmed visit per provider and asset', () => {
    const result = nextConfirmedAssetVisits([
      visit({ startsAt: '2026-11-09T04:00:00Z', summary: 'Later maintenance' }),
      visit({ startsAt: '2026-11-02T04:00:00Z', summary: 'Past maintenance' }),
      visit({ providerId: 'provider-b', startsAt: '2026-11-06T04:00:00Z', summary: 'Other provider' }),
      visit({ startsAt: '2026-11-06T04:00:00Z', summary: 'Nearest maintenance' })
    ], Date.parse('2026-11-03T00:00:00Z'));

    expect(result.get(customerAssetKey('provider-a', 'asset-1'))?.summary).toBe('Nearest maintenance');
    expect(result.get(customerAssetKey('provider-b', 'asset-1'))?.summary).toBe('Other provider');
  });

  it('ignores requested, cancelled, past and invalid visit times', () => {
    const result = nextConfirmedAssetVisits([
      visit({ status: 'REQUESTED' }),
      visit({ status: 'CANCELLED' }),
      visit({ startsAt: '2026-11-02T04:00:00Z' }),
      visit({ startsAt: 'not-a-date' })
    ], Date.parse('2026-11-03T00:00:00Z'));
    expect(result.size).toBe(0);
  });
});

describe('customer asset coverage badges', () => {
  const coverage = (overrides: Partial<CustomerAssetCoverageEntry> = {}): CustomerAssetCoverageEntry => ({
    providerId: 'provider-a', assetId: 'asset-1', kind: 'AMC', status: 'ACTIVE',
    effectiveFrom: '2026-01-01T00:00:00Z', effectiveTo: '2026-12-31T23:59:59Z', ...overrides,
  });

  it('shows active coverage types only for the exact provider and asset', () => {
    expect(customerAssetCoverageLabels([
      coverage(), coverage({ kind: 'Warranty' }), coverage({ providerId: 'provider-b', kind: 'Warranty' }), coverage({ assetId: 'asset-2', kind: 'Warranty' }),
    ], 'provider-a', 'asset-1', Date.parse('2026-10-29T00:00:00Z'))).toEqual(['AMC active', 'Warranty active']);
  });

  it('does not show coverage that is pending, expired, or outside its effective dates', () => {
    expect(customerAssetCoverageLabels([
      coverage({ status: 'PENDING' }),
      coverage({ effectiveTo: '2026-10-28T23:59:59Z', kind: 'Warranty' }),
      coverage({ effectiveFrom: '2026-10-30T00:00:00Z', kind: 'Warranty' }),
    ], 'provider-a', 'asset-1', Date.parse('2026-10-29T00:00:00Z'))).toEqual([]);
  });

  it('distinguishes a definitive empty result from a paginated or failed lookup', () => {
    const now = Date.parse('2026-10-29T00:00:00Z');
    expect(customerAssetCoverageSummary([], 'provider-a', 'asset-1', { now })).toBe('Coverage not listed');
    expect(customerAssetCoverageSummary([], 'provider-a', 'asset-1', { hasMore: true, now })).toBe('Coverage status not confirmed');
    expect(customerAssetCoverageSummary([], 'provider-a', 'asset-1', { failed: true, hasMore: true, now })).toBe('Coverage unavailable');
    expect(customerAssetCoverageSummary([], 'provider-a', 'asset-1', { loading: true, now })).toBe('Loading coverage…');
  });

  it('keeps a confirmed coverage badge when another page is still available', () => {
    expect(customerAssetCoverageSummary([coverage()], 'provider-a', 'asset-1', {
      hasMore: true, now: Date.parse('2026-10-29T00:00:00Z'),
    })).toBe('AMC active');
  });
});

describe('customer asset place labels', () => {
  it('keeps a customer-visible site code beside its place name', () => {
    expect(customerAssetPlaceLabel('Continuous elevator site', 'TNKYJJ9')).toBe('Continuous elevator site · Site code TNKYJJ9');
    expect(customerAssetPlaceLabel('Continuous elevator site', null)).toBe('Continuous elevator site');
    expect(customerAssetPlaceLabel(null, null)).toBe('Not supplied');
  });

  it('restores an authorized place filter from a places-to-assets link', () => {
    expect(assetLocationFilterFromHash('#/assets?location_id=place-123')).toBe('place-123');
    expect(assetLocationFilterFromHash('#/assets?location_id=place%2F123')).toBe('place/123');
    expect(assetLocationFilterFromHash('#/assets')).toBe('');
  });
});

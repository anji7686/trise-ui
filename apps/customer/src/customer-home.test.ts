import { describe, expect, it } from 'vitest';
import type { AssetAttributes, BookingAttributes, ContractAttributes, QuotationAttributes, Resource, ServiceJobAttributes, WarrantyAttributes } from './data';
import { activeCoverageCount, activeServiceCount, customerAssetCoverageLabel, customerAssetCoverageStatus, customerDecisionQuotes, customerGreeting, customerHomeDate, customerHomeProviderName, homeAssetLocation, homeCountLabel, nextConfirmedBookingForAsset } from './customer-home';

function service(status: string): Resource<ServiceJobAttributes> {
  return { id: status, type: 'service_job', attributes: { status, revision: 1 }, relationships: {} };
}

function quote(id: string, overrides: Partial<QuotationAttributes> = {}): Resource<QuotationAttributes> {
  return {
    id,
    type: 'quotation',
    attributes: {
      status: 'issued', currency: 'INR', lines: [], total: '1000', revision: 1,
      provider_review: { decision: 'approved', quotation_revision: 1, decided_at: '2026-10-28T00:00:00Z' },
      customer_approval: { mode: 'ONLINE', status: 'AWAITING_CUSTOMER' },
      ...overrides,
    },
    relationships: {},
  };
}

function warranty(status: string, effective_to?: string): Resource<WarrantyAttributes> {
  return { id: status, type: 'warranty', attributes: { name: 'Lift warranty', status, effective_to, revision: 1 }, relationships: {} };
}

function contract(status: string, effective_to?: string): Resource<ContractAttributes> {
  return { id: status, type: 'contract', attributes: { name: 'AMC', status, effective_to, version: 1, revision: 1 }, relationships: {} };
}

function booking(id: string, assetId: string, status: string, startsAt: string): { booking: Resource<BookingAttributes>; providerId: string } {
  return { providerId: 'provider-a', booking: { id, type: 'booking', attributes: { summary: 'Preventive service', status, revision: 1, requested_window: { starts_at: startsAt, ends_at: startsAt, time_zone: 'Asia/Kolkata' } }, relationships: { asset: { id: assetId, type: 'assets' } } } };
}

describe('customer home live summary', () => {
  it('counts open service work and excludes completed or cancelled work', () => {
    expect(activeServiceCount([service('CREATED'), service('SCHEDULED'), service('IN_PROGRESS'), service('COMPLETED'), service('CANCELLED'), service('UNKNOWN')])).toBe(3);
  });

  it('counts only active coverage that has not expired', () => {
    const now = new Date('2026-10-29T00:00:00Z');
    expect(activeCoverageCount([
      warranty('ACTIVE'),
      warranty('ACTIVE', '2026-10-28T23:59:59Z'),
      warranty('EXPIRED'),
    ], [contract('CURRENT', '2026-11-01T00:00:00Z'), contract('CLOSED')], now)).toBe(2);
  });

  it('surfaces only customer-actionable quotations and puts the earliest expiry first', () => {
    const quotes = [
      { providerId: 'provider-a', quote: quote('later', { valid_until: '2026-11-15T00:00:00Z' }) },
      { providerId: 'provider-b', quote: quote('earlier', { valid_until: '2026-11-01T00:00:00Z' }) },
      { providerId: 'provider-a', quote: quote('provider-review', { provider_review: null }) },
      { providerId: 'provider-a', quote: quote('expired', { valid_until: '2020-01-01T00:00:00Z' }) },
    ];
    expect(customerDecisionQuotes(quotes).map(({ quote: item }) => item.id)).toEqual(['earlier', 'later']);
  });

  it('prefers the linked provider relationship name so duplicate accounts stay distinguishable', () => {
    expect(customerHomeProviderName('provider-2', [
      { id: 'provider-1', attributes: { display_name: 'Lift Rise · Account 1' } },
      { id: 'provider-2', attributes: { display_name: 'Lift Rise · Account 2' } },
    ], 'Lift Rise')).toBe('Lift Rise · Account 2');
    expect(customerHomeProviderName('missing', [], 'Lift Rise')).toBe('Lift Rise');
  });

  it('marks a summary as partial when additional pages remain', () => {
    expect(homeCountLabel(15, true)).toBe('15+');
    expect(homeCountLabel(2, false)).toBe('2');
  });

  it('shows only the nearest future confirmed booking linked to the selected asset', () => {
    const now = new Date('2026-10-29T00:00:00Z');
    const results = [
      booking('later', 'asset-a', 'CONFIRMED', '2026-11-15T00:00:00Z'),
      booking('earlier', 'asset-a', 'RESCHEDULED', '2026-11-01T00:00:00Z'),
      booking('other-asset', 'asset-b', 'CONFIRMED', '2026-10-30T00:00:00Z'),
      booking('past', 'asset-a', 'CONFIRMED', '2026-10-28T00:00:00Z'),
      booking('unconfirmed', 'asset-a', 'REQUESTED', '2026-10-30T00:00:00Z'),
    ];
    expect(nextConfirmedBookingForAsset('asset-a', results, now)?.booking.id).toBe('earlier');
  });

  it('uses shared location and current asset coverage for home cards', () => {
    const coveredContract = contract('ACTIVE');
    coveredContract.attributes.customer_safe_summary = { covered_elevator_count: 1, covered_assets: [{ asset_id: 'asset-a', display_name: 'Lift A', status: 'ACTIVE', effective_from: '2026-01-01T00:00:00Z' }] };
    const coveredWarranty = warranty('ACTIVE', '2027-01-01T00:00:00Z');
    coveredWarranty.relationships.asset = { id: 'asset-b', type: 'assets' };
    const now = new Date('2026-10-29T00:00:00Z');
    expect(customerAssetCoverageLabel('asset-a', [], [coveredContract], now)).toBe('AMC active');
    expect(customerAssetCoverageLabel('asset-b', [coveredWarranty], [], now)).toBe('Warranty active');
    expect(customerAssetCoverageLabel('asset-c', [], [], now)).toBeUndefined();
    expect(customerAssetCoverageStatus('asset-a', null, null, { loading: true }, now)).toBe('Checking coverage…');
    expect(customerAssetCoverageStatus('asset-a', null, null, { failed: true }, now)).toBe('Coverage unavailable');
    expect(customerAssetCoverageStatus('asset-a', [], [coveredContract], { failed: true }, now)).toBe('AMC active');
    expect(customerAssetCoverageStatus('asset-a', [], [], {}, now)).toBe('Coverage not listed');
    expect(customerAssetCoverageStatus('asset-a', [], [], { hasMore: true }, now)).toBe('Coverage status not confirmed');
    expect(customerAssetCoverageStatus('asset-a', [], [coveredContract], {}, now)).toBe('AMC active');
    expect(homeAssetLocation({ service_location_name: 'Maple Heights', service_location_code: 'MAP1234', service_location_address: ['Tower A', 'Ground floor'] } as AssetAttributes)).toBe('Maple Heights · Site code MAP1234 · Tower A · Ground floor');
    expect(homeAssetLocation({ service_location_name: 'Continuous elevator site 1793118999664', service_location_address: ['Continuous browser test address'] } as AssetAttributes)).toBe('Continuous elevator site');
    expect(homeAssetLocation({ service_location_name: 'Codex Flow Verification 20261027 · Building A', service_location_code: '2WPPG7B', service_location_address: ['Mundur B.O', 'Bengaluru'] } as AssetAttributes)).toBe('Service location · Site code 2WPPG7B · Mundur B.O · Bengaluru');
    expect(homeAssetLocation({ service_location_name: 'Green Heights', service_location_code: 'GRN1234', service_location_address: ['1 Demo Lane, Block 7', 'Bengaluru'] } as AssetAttributes)).toBe('Green Heights · Site code GRN1234 · Bengaluru');
  });

  it('greets the customer by first name using India local time', () => {
    expect(customerGreeting('Anjan Reddy', new Date('2026-10-29T06:00:00Z'))).toBe('Good morning, Anjan.');
    expect(customerGreeting('Anjan Reddy', new Date('2026-10-29T08:00:00Z'))).toBe('Good afternoon, Anjan.');
    expect(customerGreeting('Anjan Reddy', new Date('2026-10-29T15:00:00Z'))).toBe('Good evening, Anjan.');
    expect(customerGreeting('', new Date('2026-10-29T06:00:00Z'))).toBe('Good morning, there.');
  });

  it('formats the home date in the mock weekday and uppercase month style using India time', () => {
    expect(customerHomeDate(new Date('2026-10-29T00:00:00Z'))).toBe('THURSDAY, 29 OCTOBER 2026');
  });
});

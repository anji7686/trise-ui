import { describe, expect, it } from 'vitest';
import { coverageCountLabel, coverageEmptyMessage, coverageLiftDetailsFallback, coverageListRecords, coverageReferenceCode, coverageStatuses, customerCoverageStatus, customerPlanDisplayName, customerReadableName, filterCoverageRecords, visibleCoverageRecords, warrantyDisplayName } from './coverage-list';
import type { ContractAttributes, Resource, WarrantyAttributes } from './data';

const warranty = (id: string, status = 'active', effective_from = '2026-01-01'): Resource<WarrantyAttributes> => ({
  id, type: 'warranties', attributes: { name: `Warranty ${id}`, status, effective_from, revision: 1 }, relationships: {},
});
const contract = (id: string, status = 'active', plan_code = 'AMC-PLUS', effective_from = '2025-01-01'): Resource<ContractAttributes> => ({
  id, type: 'maintenance-contracts', attributes: { name: `Contract ${id}`, status, version: 1, effective_from, revision: 1, customer_safe_summary: { plan_name: `Plan ${id}`, plan_code } }, relationships: {},
});

describe('customer coverage list', () => {
  it('uses readable plan names and hides generated record IDs', () => {
    expect(customerPlanDisplayName(undefined, 'AMC-52bf01c826e2')).toBe('Maintenance agreement');
    expect(customerPlanDisplayName(undefined, 'FREE_AMC_12M')).toBe('Free AMC 12M');
    expect(customerPlanDisplayName('  Annual maintenance  ', 'AMC-52bf01c826e2')).toBe('Annual maintenance');
    expect(customerPlanDisplayName(undefined, 'Maintenance contract')).toBe('Maintenance contract');
  });

  it('shows a readable warranty label while retaining generated references as secondary details', () => {
    expect(warrantyDisplayName('DEMO-ELEV-WARRANTY')).toBe('Warranty coverage');
    expect(coverageReferenceCode('warranty', 'DEMO-ELEV-WARRANTY')).toBe('DEMO-ELEV-WARRANTY');
    expect(warrantyDisplayName('Lift motor warranty')).toBe('Lift motor warranty');
    expect(coverageReferenceCode('warranty', 'Lift motor warranty')).toBe('');
  });

  it('distinguishes an agreement with no covered lifts from undisclosed lift names', () => {
    expect(coverageLiftDetailsFallback(undefined, false)).toBe('Details not shared');
    expect(coverageLiftDetailsFallback(0, true)).toBe('No covered lifts listed');
    expect(coverageLiftDetailsFallback(1, true)).toBe('1 covered lift; names not shared');
    expect(coverageLiftDetailsFallback(4, true)).toBe('4 covered lifts; names not shared');
  });

  it('derives upcoming and expired labels from active coverage dates without changing other statuses', () => {
    const today = new Date(2026, 9, 29, 12);
    expect(customerCoverageStatus('active', '2030-01-01', '2030-12-31', today)).toBe('upcoming');
    expect(customerCoverageStatus('active', '2026-01-01', '2026-10-28', today)).toBe('expired');
    expect(customerCoverageStatus('active', '2026-01-01', '2026-10-29', today)).toBe('active');
    expect(customerCoverageStatus('suspended', '2030-01-01', undefined, today)).toBe('suspended');
  });

  it('hides appended numeric import identifiers from customer-facing asset and site names', () => {
    expect(customerReadableName('Continuous Elevator A 1792873891609')).toBe('Continuous Elevator A');
    expect(customerReadableName('Continuous elevator site 1792873822924')).toBe('Continuous elevator site');
    expect(customerReadableName('Codex Flow Verification 20261027 · Building A')).toBe('Service location');
    expect(customerReadableName('Passenger lift · A')).toBe('Passenger lift · A');
  });

  it('searches plan, status and provider without mixing the record detail routes', () => {
    const records = coverageListRecords(
      [{ providerId: 'p1', providerName: 'Lift Rise', resource: warranty('w1') }],
      [{ providerId: 'p2', providerName: 'Metro Lifts', resource: contract('c1', 'active', 'AMC-ANNUAL') }],
    );
    expect(filterCoverageRecords(records, 'metro', '')[0]?.kind).toBe('contract');
    expect(filterCoverageRecords(records, 'AMC-ANNUAL', '')[0]?.resource.id).toBe('c1');
    expect(filterCoverageRecords(records, '', 'active')).toHaveLength(2);
    expect(coverageStatuses(records)).toEqual(['active']);
  });

  it('searches using the customer-readable coverage names shown on cards', () => {
    const records = coverageListRecords(
      [{ providerId: 'p1', providerName: 'Lift Rise', resource: { ...warranty('w1'), attributes: { name: 'DEMO-ELEV-WARRANTY', status: 'active', revision: 1 } } }],
      [{ providerId: 'p1', providerName: 'Lift Rise', resource: { ...contract('c1'), attributes: { name: 'FREE_AMC_12M', status: 'active', version: 1, revision: 1, customer_safe_summary: undefined } } }],
    );
    expect(filterCoverageRecords(records, 'Warranty coverage', '')).toHaveLength(1);
    expect(filterCoverageRecords(records, 'Free AMC 12M', '')).toHaveLength(1);
  });

  it('searches covered asset names shown on warranty and maintenance agreement cards', () => {
    const linkedWarranty: Resource<WarrantyAttributes> = {
      ...warranty('w-linked'),
      relationships: { asset: { id: 'asset-1', type: 'assets' } },
    };
    const linkedContract: Resource<ContractAttributes> = {
      ...contract('c-linked'),
      attributes: {
        ...contract('c-linked').attributes,
        customer_safe_summary: {
          plan_name: 'Annual maintenance',
          covered_assets: [{ asset_id: 'asset-2', display_name: 'Passenger Lift 02', status: 'active', effective_from: '2026-01-01' }],
        },
      },
    };
    const records = coverageListRecords(
      [{ providerId: 'p1', providerName: 'Lift Rise', resource: linkedWarranty }],
      [{ providerId: 'p1', providerName: 'Lift Rise', resource: linkedContract }],
    );
    expect(filterCoverageRecords(records, 'Standalone Lift 01', '', { 'p1:asset-1': 'Standalone Lift 01' }).map(({ resource }) => resource.id)).toEqual(['w-linked']);
    expect(filterCoverageRecords(records, 'Passenger Lift 02', '').map(({ resource }) => resource.id)).toEqual(['c-linked']);
  });

  it('limits the first aggregate coverage page to 15 while preserving date order', () => {
    const warranties = Array.from({ length: 8 }, (_, index) => ({ providerId: 'p1', providerName: 'Lift Rise', resource: warranty(`w${index}`, 'active', `2026-${String(index + 1).padStart(2, '0')}-01`) }));
    const contracts = Array.from({ length: 12 }, (_, index) => ({ providerId: 'p1', providerName: 'Lift Rise', resource: contract(`c${index}`) }));
    const records = coverageListRecords(warranties, contracts);
    const firstPage = visibleCoverageRecords(records, 15);
    expect(firstPage).toHaveLength(15);
    expect(firstPage[0].resource.attributes.effective_from).toBe('2026-08-01');
    expect(firstPage.some((record) => record.kind === 'warranty')).toBe(true);
    expect(firstPage.some((record) => record.kind === 'contract')).toBe(true);
  });

  it('distinguishes loaded coverage from server pages that are still available', () => {
    expect(coverageCountLabel(15, 19, true)).toBe('15 of 19 loaded · more pages available');
    expect(coverageCountLabel(1, 1, true)).toBe('1 of 1 loaded · more pages available');
    expect(coverageCountLabel(2, 2, false)).toBe('2 of 2 loaded');
  });

  it('explains that an empty filter may still match an older coverage page', () => {
    expect(coverageEmptyMessage('Old plan', '', true)).toContain('Load more to check older records');
    expect(coverageEmptyMessage('', 'expired', true)).toContain('Load more to check older records');
    expect(coverageEmptyMessage('Old plan', '', false)).toBe('No coverage records match these filters.');
    expect(coverageEmptyMessage('', '', false)).toBe('No warranty or maintenance coverage is available yet.');
  });
});

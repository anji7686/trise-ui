import { describe, expect, it } from 'vitest';
import { customerAgreementVersionLabel, projectQuotationPanelHeading, relatedResourceId, technicianInitials } from './customer-details';

describe('customer detail relationship resolution', () => {
  it('resolves a single customer-authorized asset link', () => {
    expect(relatedResourceId({ asset: { id: 'asset-1', type: 'assets' } }, 'asset')).toBe('asset-1');
  });

  it('uses the first link when a relationship is represented as a collection', () => {
    expect(relatedResourceId({ asset: [{ id: 'asset-1', type: 'assets' }, { id: 'asset-2', type: 'assets' }] }, 'asset')).toBe('asset-1');
  });

  it('returns null for absent or empty relationships', () => {
    expect(relatedResourceId({}, 'asset')).toBeNull();
    expect(relatedResourceId({ asset: [] }, 'asset')).toBeNull();
  });
});

describe('customer technician presentation', () => {
  it('uses the first and last name initials for the avatar', () => {
    expect(technicianInitials('Kiran Nair')).toBe('KN');
    expect(technicianInitials('  Kiran   Nair  Kumar ')).toBe('KN');
  });

  it('uses a safe generic avatar when a display name is unavailable', () => {
    expect(technicianInitials()).toBe('T');
    expect(technicianInitials('  ')).toBe('T');
  });
});

describe('customer project quotation summary', () => {
  it('uses approval wording only for an accepted linked quotation', () => {
    expect(projectQuotationPanelHeading('ACCEPTED', true)).toBe('What you approved');
    expect(projectQuotationPanelHeading('APPROVED', true)).toBe('What you approved');
    expect(projectQuotationPanelHeading('ISSUED', true)).toBe('Quotation for this project');
    expect(projectQuotationPanelHeading(undefined, false)).toBe('Project scope');
  });
});

describe('customer maintenance agreement version', () => {
  it('uses the provider version when one is present and avoids presenting zero as a real version', () => {
    expect(customerAgreementVersionLabel(3, 2)).toBe('3');
    expect(customerAgreementVersionLabel(undefined, 2)).toBe('2');
    expect(customerAgreementVersionLabel(0, 2)).toBe('2');
    expect(customerAgreementVersionLabel(undefined, 0)).toBe('Not provided');
    expect(customerAgreementVersionLabel(null, null)).toBe('Not provided');
  });
});

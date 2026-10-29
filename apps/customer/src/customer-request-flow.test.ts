import { describe, expect, it } from 'vitest';
import { canSubmitCustomerRequest, customerRequestTypeLabel } from './customer-request-flow';

describe('customer request submit guard', () => {
  it('allows submission only from the final review step', () => {
    expect(canSubmitCustomerRequest(0, 3)).toBe(false);
    expect(canSubmitCustomerRequest(1, 3)).toBe(false);
    expect(canSubmitCustomerRequest(2, 3)).toBe(false);
    expect(canSubmitCustomerRequest(3, 3)).toBe(true);
  });
});

describe('customer request issue labels', () => {
  it('uses the labels shown to the customer rather than internal request codes', () => {
    expect(customerRequestTypeLabel('REPAIR')).toBe('Repair or not working');
    expect(customerRequestTypeLabel('PREVENTIVE')).toBe('Preventive service');
    expect(customerRequestTypeLabel('UNUSUAL_NOISE')).toBe('Unusual noise');
    expect(customerRequestTypeLabel('INSPECTION')).toBe('Inspection');
    expect(customerRequestTypeLabel('CALLBACK')).toBe('Callback');
    expect(customerRequestTypeLabel('OTHER')).toBe('Other');
  });
});

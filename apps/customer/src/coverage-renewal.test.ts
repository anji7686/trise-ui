import { describe, expect, it } from 'vitest';
import { renewalEnquiryMailto } from './coverage-renewal';

describe('renewal enquiry email handoff', () => {
  it('builds a correctly encoded message for the provider support email', () => {
    expect(renewalEnquiryMailto('support@example.in', 'AMC renewal · Green Heights', 'Please share the renewal terms.'))
      .toBe('mailto:support@example.in?subject=AMC%20renewal%20%C2%B7%20Green%20Heights&body=Please%20share%20the%20renewal%20terms.');
  });

  it('does not create an email handoff with missing or invalid fields', () => {
    expect(renewalEnquiryMailto(undefined, 'Renewal', 'Please contact me.')).toBeNull();
    expect(renewalEnquiryMailto('not-an-email', 'Renewal', 'Please contact me.')).toBeNull();
    expect(renewalEnquiryMailto('support@example.in', '   ', 'Please contact me.')).toBeNull();
    expect(renewalEnquiryMailto('support@example.in', 'Renewal', '   ')).toBeNull();
    expect(renewalEnquiryMailto('support@example.in', 's'.repeat(201), 'Please contact me.')).toBeNull();
    expect(renewalEnquiryMailto('support@example.in', 'Renewal', 'm'.repeat(4001))).toBeNull();
  });
});

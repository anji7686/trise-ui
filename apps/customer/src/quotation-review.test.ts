import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuotationListLoadFailure, quotationCommunicationFailure, quotationConversationOpen, quotationNeedsCustomerDecision, quotationScopeSummary, quotationShowsTaxDetails, quotationTaxComponents, quotationTaxPresentation, quotationTaxRules, quotationUnitAssignment } from './quotation-review';
import type { QuotationAttributes } from './data';

const quotation = (overrides: Partial<QuotationAttributes> = {}): QuotationAttributes => ({
  status: 'issued',
  currency: 'INR',
  lines: [],
  total: '1000.00',
  revision: 4,
  provider_review: { decision: 'approved', quotation_revision: 4, decided_at: '2026-10-27T10:00:00Z' },
  ...overrides,
});

describe('quotation customer decision eligibility', () => {
  it('shows a current issued revision after provider approval', () => {
    expect(quotationNeedsCustomerDecision(quotation())).toBe(true);
  });

  it('does not present provider-pending or already-decided quotes as needing customer action', () => {
    expect(quotationNeedsCustomerDecision(quotation({ provider_review: { decision: 'pending', quotation_revision: 4, decided_at: '2026-10-27T10:00:00Z' } }))).toBe(false);
    expect(quotationNeedsCustomerDecision(quotation({ status: 'approved' }))).toBe(false);
    expect(quotationNeedsCustomerDecision(quotation({ status: 'declined' }))).toBe(false);
  });

  it('does not offer online response for expired or offline-signature quotations', () => {
    expect(quotationNeedsCustomerDecision(quotation({ valid_until: '2026-01-01' }))).toBe(false);
    expect(quotationNeedsCustomerDecision(quotation({ customer_approval: { mode: 'OFFLINE_SIGNATURE' } }))).toBe(false);
  });
});

describe('quotation approvals summary', () => {
  it('uses the first live scope description as the approval card title', () => {
    expect(quotationScopeSummary(quotation({
      lines: [
        { description: ' Passenger lift installation ', quantity: '2', unit_price: '1000', amount: '2000' },
        { description: 'Testing', quantity: '1', unit_price: '200', amount: '200' },
      ],
    }))).toEqual({ title: 'Passenger lift installation', itemCount: 2, additionalCount: 1 });
  });

  it('falls back to quotation number when scope is empty', () => {
    expect(quotationScopeSummary(quotation({ quotation_number: 'Q-1042' }))).toEqual({ title: 'Q-1042', itemCount: 0, additionalCount: 0 });
  });
});

describe('quotation tax breakdown', () => {
  it('shows server-calculated tax components only when the summary is complete', () => {
    expect(quotationTaxComponents(quotation({ tax_summary: { status: 'CALCULATED', tax_total: '360.00', components: [{ code: 'CGST', name: 'Central GST', rate_percent: '9', amount: '180.00' }, { code: 'SGST', name: 'State GST', rate_percent: '9', amount: '180.00' }] } }))).toEqual([{ code: 'CGST', name: 'Central GST', rate_percent: '9', amount: '180.00' }, { code: 'SGST', name: 'State GST', rate_percent: '9', amount: '180.00' }]);
    expect(quotationTaxComponents(quotation({ tax_summary: { status: 'PARTIAL', tax_total: '180.00', components: [{ code: 'CGST', name: 'Central GST', rate_percent: '9', amount: '180.00' }] } }))).toEqual([]);
    expect(quotationTaxComponents(quotation({ tax_summary: { status: 'CALCULATED', tax_total: '360.00', components: [{ code: '', name: 'Missing', rate_percent: '9', amount: '180.00' }, { code: 'SGST', name: 'State GST', rate_percent: '9', amount: 'invalid' }] } }))).toEqual([]);
  });

  it('reads published rules and honors the saved customer tax visibility setting', () => {
    const quote = quotation({ tax_summary: { status: 'CALCULATED', tax_total: '360.00', rules: [{ rule_code: 'GST-18', rule_version: 2, total_rate_percent: '18', tax_treatment: 'TAXABLE' }], components: [] } });
    expect(quotationTaxRules(quote)).toEqual([{ rule_code: 'GST-18', rule_version: 2, total_rate_percent: '18', tax_treatment: 'TAXABLE' }]);
    expect(quotationShowsTaxDetails(quote)).toBe(true);
    expect(quotationShowsTaxDetails(quotation({ terms: { show_tax_details: false } }))).toBe(false);
    const hiddenQuote = quotation({ terms: { show_tax_details: false }, tax_summary: quote.tax_summary });
    expect(quotationTaxPresentation(hiddenQuote)).toEqual({ visible: false, rules: [], components: [] });
    expect(quotationTaxPresentation(quote).components).toHaveLength(0);
  });

  it('derives the rule and combined rate from immutable line tax snapshots for older quotations', () => {
    const quote = quotation({ lines: [{ description: 'Lift package', quantity: '1', unit_price: '125000', amount: '147500', tax_details: { rule_code: 'GST-18', components: [{ code: 'CGST', name: 'Central GST', rate_percent: '9', amount: '11250' }, { code: 'SGST', name: 'State GST', rate_percent: '9', amount: '11250' }] } }] });
    expect(quotationTaxRules(quote)).toEqual([{ rule_code: 'GST-18', total_rate_percent: '18' }]);
  });
});

describe('quotation lift assignments', () => {
  const liftCodes = Array.from({ length: 8 }, (_, index) => `LIFT-${String(index + 1).padStart(2, '0')}`);

  it('shows all eight lifts as a concise shared assignment', () => {
    expect(quotationUnitAssignment([...liftCodes, liftCodes[0]], liftCodes)).toEqual({ codes: liftCodes, label: 'all 8 lifts' });
  });

  it('orders a partial assignment by the quotation lift order and removes duplicates', () => {
    expect(quotationUnitAssignment(['LIFT-07', 'LIFT-02', 'LIFT-07'], liftCodes)).toEqual({ codes: ['LIFT-02', 'LIFT-07'], label: '2 of 8 lifts' });
  });

  it('treats an omitted assignment as shared across all quoted lifts', () => {
    expect(quotationUnitAssignment(undefined, liftCodes)).toEqual({ codes: liftCodes, label: 'all 8 lifts' });
    expect(quotationUnitAssignment(undefined)).toEqual({ codes: [], label: 'all quoted lifts' });
  });
});

describe('quotation conversation recovery', () => {
  it('offers a refresh after the quote revision changes or closes', () => {
    expect(quotationCommunicationFailure({ status: 409, code: 'conflict', message: 'revision is stale' })).toEqual({
      message: 'This quotation has changed or closed. Reload it to review the current revision before trying again.',
      canReload: true,
    });
  });

  it('explains when customer access is no longer available without exposing API errors', () => {
    expect(quotationCommunicationFailure({ status: 403, code: 'forbidden', message: 'The requested operation is not permitted' })).toEqual({
      message: 'Your account no longer has access to send messages on this quotation. Contact your service provider if you need help.',
      canReload: false,
    });
  });

  it('keeps messages open only while the quote is current and unexpired', () => {
    const now = Date.parse('2026-10-29T12:00:00Z');
    expect(quotationConversationOpen('ISSUED', '2026-10-30T00:00:00Z', now)).toBe(true);
    expect(quotationConversationOpen('ISSUED', '2026-10-28T00:00:00Z', now)).toBe(false);
    expect(quotationConversationOpen('APPROVED', '2026-10-30T00:00:00Z', now)).toBe(false);
  });
});

describe('quotation list recovery', () => {
  it('announces a failed load and exposes an explicit retry action', () => {
    const markup = renderToStaticMarkup(createElement(QuotationListLoadFailure, { message: 'The quotations could not be loaded.', onRetry: () => undefined }));
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('The quotations could not be loaded.');
    expect(markup).toContain('Retry loading quotations');
  });
});

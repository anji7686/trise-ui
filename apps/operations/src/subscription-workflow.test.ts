import { describe, expect, it } from 'vitest';
import type { PlatformSubscription, PlatformSubscriptionAddon, PlatformSubscriptionChange, PlatformSubscriptionRequest, Resource } from './data';
import { compatibleInvoiceAddons, dueSubscriptionChanges, invoiceAddonPayload, matchesSubscriptionHistory, subscriptionNextStep, transactionEvidencePayload } from './subscription-workflow';
import { validReviewReason } from './subscription-review';

const request = (status: string, states?: string[]): Resource<PlatformSubscriptionRequest> => ({ id: 'r', type: 'request', relationships: {}, attributes: { status, evidence: states?.map((review_state, index) => ({ id: String(index), type: 'evidence', relationships: {}, attributes: { evidence_kind: 'TRANSACTION_REFERENCE', review_state } })) } as PlatformSubscriptionRequest });

describe('next subscription action', () => {
  it('does not equate approval or submitted evidence with verified payment', () => {
    expect(subscriptionNextStep(null, request('APPROVED'))).toContain('inspect payment evidence');
    expect(subscriptionNextStep(null, request('APPROVED', []))).toContain('obtain verification');
    expect(subscriptionNextStep(null, request('APPROVED', ['EVIDENCE_SUBMITTED']))).toContain('Review the submitted');
    expect(subscriptionNextStep(null, request('APPROVED', ['CORRECTIONS_REQUESTED']))).toContain('address requested corrections');
    expect(subscriptionNextStep(null, request('APPROVED', ['VERIFIED']))).toContain('backend checks eligibility');
  });
  it('keeps active subscriptions and pending or rejected requests distinct', () => {
    const subscription = { attributes: { status: 'ACTIVE' } } as Resource<PlatformSubscription>;
    expect(subscriptionNextStep(subscription)).toContain('Monitor validity');
    expect(subscriptionNextStep(null)).toContain('Select a published plan');
    expect(subscriptionNextStep(null, request('PENDING_REVIEW'))).toContain('separate decisions');
    expect(subscriptionNextStep(null, request('REJECTED'))).toContain('recorded decision');
  });
  it('requires a substantive review reason within the documented UI limit', () => {
    expect(validReviewReason(' \n ')).toBe(false);
    expect(validReviewReason('Please supply a legible receipt.')).toBe(true);
    expect(validReviewReason('x'.repeat(1000))).toBe(true);
    expect(validReviewReason('x'.repeat(1001))).toBe(false);
  });
});


describe('invoice add-on eligibility', () => {
  const addons = [{ id: 'a', attributes: { name: 'Capacity', status: 'ACTIVE', versions: [
    { id: 'published', status: 'PUBLISHED', currency_code: 'USD' },
    { id: 'draft', status: 'DRAFT', currency_code: 'USD' },
    { id: 'other', status: 'PUBLISHED', currency_code: 'INR' }
  ] } }] as Resource<PlatformSubscriptionAddon>[];
  it('excludes drafts, mismatched currencies and unavailable subscription terms', () => {
    expect(compatibleInvoiceAddons(addons, 'USD').map(row => row.id)).toEqual(['published']);
    expect(compatibleInvoiceAddons(addons)).toEqual([]);
    expect(compatibleInvoiceAddons([{ ...addons[0], attributes: { ...addons[0].attributes, status: 'INACTIVE' } }], 'USD')).toEqual([]);
  });
  it('rejects stale versions, fractional, negative and unsafe quantities', () => {
    const versions = compatibleInvoiceAddons(addons, 'USD');
    for (const value of ['-1', '0.5', 'NaN', '9007199254740992']) expect(() => invoiceAddonPayload({ published: value }, versions)).toThrow();
    expect(() => invoiceAddonPayload({ draft: '1' }, versions)).toThrow();
    expect(invoiceAddonPayload({ published: '2', other: '0' }, versions)).toEqual([{ addon_version_id: 'published', quantity: 2 }]);
    expect(invoiceAddonPayload({ published: '' }, versions)).toEqual([]);
  });
});

describe('due-change queue', () => {
  it('includes only approved or scheduled changes whose requested time has arrived', () => {
    const now = Date.parse('2026-10-10T00:00:00Z');
    const rows = [ ['due', 'APPROVED', '2026-10-09T00:00:00Z'], ['boundary', 'SCHEDULED', '2026-10-10T00:00:00Z'], ['future', 'APPROVED', '2026-10-11T00:00:00Z'], ['pending', 'PENDING_REVIEW', '2026-10-09T00:00:00Z'], ['applied', 'APPLIED', '2026-10-09T00:00:00Z'], ['invalid', 'SCHEDULED', 'invalid'] ].map(([id, status, requested_effective_at]) => ({ id, attributes: { status, requested_effective_at } })) as Resource<PlatformSubscriptionChange>[];
    expect(dueSubscriptionChanges(rows, now).map(row => row.id)).toEqual(['due', 'boundary']);
  });
});


describe('loaded history filtering', () => {
  const row = { provider: 'Example Provider PR-1', status: 'APPROVED', date: '2026-10-10T00:01:00+05:30' };
  it('combines case-insensitive provider searches, exact statuses and inclusive API dates', () => {
    const filter = { query: ' pr-1 ', status: 'APPROVED', from: '2026-10-10', through: '2026-10-10' };
    expect(matchesSubscriptionHistory(row, filter)).toBe(true);
    expect(matchesSubscriptionHistory(row, { ...filter, status: 'PENDING_REVIEW' })).toBe(false);
    expect(matchesSubscriptionHistory(row, { ...filter, from: '2026-10-11' })).toBe(false);
    expect(matchesSubscriptionHistory(row, { ...filter, through: '2026-10-09' })).toBe(false);
    expect(matchesSubscriptionHistory(row, { ...filter, query: 'different provider' })).toBe(false);
  });
});


describe('transaction evidence currency', () => {
  it('retains the stated currency instead of silently replacing it with INR', () => {
    expect(transactionEvidencePayload(' USD-RECEIPT ', '25.5000', ' usd ')).toEqual({ evidence_kind: 'TRANSACTION_REFERENCE', external_reference: 'USD-RECEIPT', stated_amount: '25.5000', currency_code: 'USD' });
    expect(transactionEvidencePayload('REFERENCE', '', '')).toMatchObject({ stated_amount: undefined, currency_code: undefined });
  });
  it('rejects incomplete or invalid evidence before a mutation is attempted', () => {
    for (const [reference, amount, currency] of [[' ', '1', 'USD'], ['R', '1', ''], ['R', '-1', 'USD'], ['R', 'NaN', 'USD'], ['R', '1', 'US']]) expect(() => transactionEvidencePayload(reference, amount, currency)).toThrow();
  });
});

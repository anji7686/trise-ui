import { describe, expect, it } from 'vitest';
import { normalizePlatformHash, parsePlatformProviderRoute, providerOnboardingRoute } from './platform-provider-routing';

describe('platform provider routing', () => {
  it.each([
    ['#platform/overview', { kind: 'overview' }],
    ['#platform/businesses', { kind: 'businesses' }],
    ['#platform/providers', { kind: 'directory' }],
    ['#platform/providers/new', { kind: 'new' }],
    ['#platform/providers/new?business_id=business-1', { kind: 'new' }],
    ['#platform/providers/provider-1', { kind: 'detail', providerId: 'provider-1' }],
    ['#platform/providers/provider-1?tab=subscription', { kind: 'detail', providerId: 'provider-1' }],
    ['#platform/providers/provider-1/edit', { kind: 'edit', providerId: 'provider-1' }],
    ['#platform/providers/provider-1/business-profile/edit', { kind: 'business-profile', providerId: 'provider-1' }],
    ['#platform/providers/provider-1/onboarding', { kind: 'contacts', providerId: 'provider-1' }],
    ['#platform/providers/provider-1/onboarding/contacts', { kind: 'contacts', providerId: 'provider-1' }],
    ['#platform/providers/provider-1/onboarding/locations', { kind: 'locations', providerId: 'provider-1' }],
    ['#platform/providers/provider-1/onboarding/documents', { kind: 'documents', providerId: 'provider-1' }],
    ['#platform/providers/provider-1/onboarding/subscription', { kind: 'subscription', providerId: 'provider-1' }],
    ['#platform/providers/provider-1/onboarding/review', { kind: 'review', providerId: 'provider-1' }],
    ['#platform/providers/provider-1/lifecycle', { kind: 'lifecycle', providerId: 'provider-1' }]
  ])('parses %s exactly', (hash, expected) => {
    expect(parsePlatformProviderRoute(hash)).toEqual(expected);
    expect(parsePlatformProviderRoute(hash.replace(/^#/, '#/'))).toEqual(expected);
  });

  it.each([
    '#platform/providers/new/business-profile',
    '#platform/providers/provider-1/onboarding/contact',
    '#platform/providers/provider-1/onboarding/unknown',
    '#platform/providers/provider-1/edit/extra'
  ])('does not silently turn an unsupported path into provider detail: %s', (hash) => {
    expect(parsePlatformProviderRoute(hash)).toEqual({ kind: 'unknown' });
    expect(parsePlatformProviderRoute(hash.replace(/^#/, '#/'))).toEqual({ kind: 'unknown' });
  });

  it('does not expose later onboarding routes before a provider exists', () => {
    expect(providerOnboardingRoute('', 0, '#platform/providers/new')).toBe('platform/providers/new');
    expect(providerOnboardingRoute('', 1, '#platform/providers/new')).toBeUndefined();
  });

  it('retains the route provider when a page omits the explicit step prop', () => {
    expect(providerOnboardingRoute('', 2, '#platform/providers/provider-1/business-profile/edit')).toBe('platform/providers/provider-1/onboarding');
    expect(providerOnboardingRoute('', 2, '#/platform/providers/provider-1/business-profile/edit')).toBe('platform/providers/provider-1/onboarding');
  });

  it.each(['platform/plans', 'platform/plans/plan-1/edit', 'platform/subscriptions', 'platform/subscription-requests', 'platform/subscription-usage', 'platform/subscription-billing'])('preserves the destination when normalizing a bookmarked %s link', (path) => {
    expect(normalizePlatformHash(`#/${path}`)).toBe(`#${path}`);
    expect(normalizePlatformHash(`#${path}`)).toBe(`#${path}`);
  });

  it('builds every onboarding route with the exact provider id', () => {
    expect([0, 1, 2, 3, 4, 5].map((step) => providerOnboardingRoute('provider-1', step))).toEqual([
      'platform/providers/provider-1/edit',
      'platform/providers/provider-1/business-profile/edit',
      'platform/providers/provider-1/onboarding',
      'platform/providers/provider-1/onboarding/documents',
      'platform/providers/provider-1/onboarding/subscription',
      'platform/providers/provider-1/onboarding/review'
    ]);
  });
});

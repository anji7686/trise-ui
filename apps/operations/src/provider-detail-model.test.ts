import { describe, expect, it } from 'vitest';
import { administratorSetupLabel, providerDetailAccess, providerOnboardingStates, providerSetupSummary, usageLimitWarning, type ProviderOnboardingEvidence } from './provider-detail-model';

const evidence = (overrides: Partial<ProviderOnboardingEvidence> = {}): ProviderOnboardingEvidence => ({
  provider: { display_name: 'Example Provider', status: 'PENDING_ACTIVATION', representation_kind: 'ORGANIZATION' } as ProviderOnboardingEvidence['provider'],
  business: null,
  documents: [],
  contacts: [],
  locations: [],
  subscription: null,
  requests: [],
  ...overrides,
});

describe('provider detail onboarding evidence', () => {
  it('keeps registration review separate from active lifecycle status', () => {
    const item = evidence({ provider: { display_name: 'Example Provider', status: 'ACTIVE', representation_kind: 'ORGANIZATION' } as ProviderOnboardingEvidence['provider'] });
    const states = providerOnboardingStates(item);
    expect(states[5]).toBe('not_started');
    expect(states.slice(0, 5).every((state) => state === 'complete')).toBe(false);
    expect(providerSetupSummary(item.provider, states).complete).toBe(false);
  });

  it('marks registration review from verification evidence even while the provider is pending activation', () => {
    const item = evidence({
      provider: { display_name: 'Example Provider', status: 'PENDING_ACTIVATION', representation_kind: 'ORGANIZATION', business_verification_status: 'VERIFIED' } as ProviderOnboardingEvidence['provider'],
    });
    const states = providerOnboardingStates(item);
    expect(states[1]).toBe('complete');
    expect(states[5]).toBe('complete');
  });

  it('reports rejected verification and unavailable optional evidence explicitly', () => {
    const states = providerOnboardingStates(evidence({
      business: { verification_status: 'REJECTED' } as ProviderOnboardingEvidence['business'],
      contacts: null,
      locations: null,
      requests: null,
    }));
    expect(states[1]).toBe('rejected');
    expect(states[2]).toBe('not_available');
    expect(states[4]).toBe('not_available');
  });

  it('marks setup complete only when the active provider has evidence for every step', () => {
    const item = evidence({
      provider: { display_name: 'Complete Provider', status: 'ACTIVE', representation_kind: 'ORGANIZATION' } as ProviderOnboardingEvidence['provider'],
      business: { verification_status: 'VERIFIED' } as ProviderOnboardingEvidence['business'],
      documents: [{ attributes: { status: 'AVAILABLE' } } as ProviderOnboardingEvidence['documents'][number]],
      contacts: [{ status: 'ACTIVE' } as NonNullable<ProviderOnboardingEvidence['contacts']>[number]],
      locations: [{ status: 'ACTIVE' } as NonNullable<ProviderOnboardingEvidence['locations']>[number]],
      subscription: { id: 'subscription-1' } as unknown as NonNullable<ProviderOnboardingEvidence['subscription']>,
      requests: [],
    });
    const states = providerOnboardingStates(item);
    expect(states.every((state) => state === 'complete')).toBe(true);
    expect(providerSetupSummary(item.provider, states).complete).toBe(true);
  });

  it('keeps administrator setup independent and reflects actual configuration', () => {
    expect(administratorSetupLabel('not_configured')).toBe('Not configured');
    expect(administratorSetupLabel(undefined)).toBe('Not available');
    expect(administratorSetupLabel('configured')).toBe('Configured');
  });

  it('exposes only actions backed by the corresponding platform capabilities', () => {
    expect(providerDetailAccess([])).toEqual({ editProvider: false, editBusiness: false, reviewLifecycle: false, manageSubscription: false, transferDocuments: false, readUsage: false });
    expect(providerDetailAccess(['PLATFORM_PROVIDER_REGISTER', 'PLATFORM_PROVIDER_PROFILE_WRITE', 'PLATFORM_PROVIDER_DOCUMENTS', 'PLATFORM_SUBSCRIPTION_READ', 'PLATFORM_PLAN_READ', 'PLATFORM_SUBSCRIPTION_USAGE_READ', 'PLATFORM_PROVIDER_LIFECYCLE'])).toEqual({ editProvider: true, editBusiness: true, reviewLifecycle: true, manageSubscription: true, transferDocuments: true, readUsage: true });
    expect(providerDetailAccess(['PLATFORM_SUBSCRIPTION_READ']).manageSubscription).toBe(false);
  });

  it('shows usage warnings only when the authorized usage API reports an exceeded limit', () => {
    expect(usageLimitWarning(false)).toBeNull();
    expect(usageLimitWarning(undefined)).toBeNull();
    expect(usageLimitWarning(true)).toBe('Configured limit exceeded');
  });
});

import type { PlatformProviderAttributes, ProviderBusinessProfile, ProviderDocument, ProviderOnboardingContactAttributes, ProviderOfficeLocationAttributes, PlatformSubscription, PlatformSubscriptionRequest } from './data';

export type OnboardingState = 'not_started' | 'in_progress' | 'complete' | 'needs_attention' | 'rejected' | 'not_available';
export type ProviderOnboardingEvidence = {
  provider: PlatformProviderAttributes;
  business: ProviderBusinessProfile | null;
  businessUnavailable?: boolean;
  documents: ProviderDocument[];
  documentsUnavailable?: boolean;
  contacts: ProviderOnboardingContactAttributes[] | null;
  locations: ProviderOfficeLocationAttributes[] | null;
  subscription: PlatformSubscription | null;
  requests: Array<{ attributes: PlatformSubscriptionRequest }> | null;
};

export function providerDetailAccess(capabilities: string[]) {
  const has = (capability: string) => capabilities.includes(capability);
  return {
    editProvider: has('PLATFORM_PROVIDER_REGISTER'),
    editBusiness: has('PLATFORM_PROVIDER_PROFILE_WRITE') || has('PLATFORM_PROVIDER_BUSINESS_WRITE'),
    reviewLifecycle: has('PLATFORM_PROVIDER_LIFECYCLE') || has('PLATFORM_PROVIDER_LIFECYCLE_REQUEST'),
    manageSubscription: has('PLATFORM_SUBSCRIPTION_READ') && has('PLATFORM_PLAN_READ'),
    transferDocuments: has('PLATFORM_PROVIDER_DOCUMENTS'),
    readUsage: has('PLATFORM_SUBSCRIPTION_USAGE_READ'),
  };
}

export function administratorSetupLabel(value?: string): string {
  return value === 'configured' ? 'Configured' : value === 'not_configured' ? 'Not configured' : 'Not available';
}

export function usageLimitWarning(exceeded?: boolean): string | null {
  return exceeded ? 'Configured limit exceeded' : null;
}

const stateOf = (value?: string | null) => value?.toUpperCase().replaceAll('-', '_') || '';
const activeCount = (items: Array<{ status?: string }> | null) => items?.filter((item) => stateOf(item.status) === 'ACTIVE').length || 0;

export function providerOnboardingStates(evidence: ProviderOnboardingEvidence): OnboardingState[] {
  const { provider, business, businessUnavailable = false, documents, documentsUnavailable = false, contacts, locations, subscription, requests } = evidence;
  const verification = stateOf(business?.verification_status || provider.business_verification_status);
  const rejectedRequest = requests?.some((request) => ['REJECTED', 'DECLINED'].includes(stateOf(request.attributes.status))) || false;
  const pendingRequest = requests?.some((request) => ['PENDING_REVIEW', 'APPROVED', 'SCHEDULED'].includes(stateOf(request.attributes.status))) || false;
  const rejectedDocument = documents.some((document) => ['REJECTED', 'DECLINED'].includes(stateOf(document.attributes.status)));
  const availableDocument = documents.some((document) => stateOf(document.attributes.status) === 'AVAILABLE');

  const identity: OnboardingState = provider.display_name && provider.representation_kind ? 'complete' : provider.display_name ? 'in_progress' : 'not_started';
  const businessState: OnboardingState = businessUnavailable && !verification ? 'not_available'
    : ['VERIFIED', 'APPROVED'].includes(verification) ? 'complete'
    : ['REJECTED', 'DECLINED'].includes(verification) ? 'rejected'
      : ['NEEDS_ATTENTION', 'ACTION_REQUIRED', 'CORRECTION_REQUIRED'].includes(verification) ? 'needs_attention'
        : ['PENDING_REVIEW', 'IN_REVIEW', 'SUBMITTED'].includes(verification) ? 'in_progress'
          : business ? 'in_progress' : 'not_started';
  const contactCount = activeCount(contacts);
  const locationCount = activeCount(locations);
  const contactLocation: OnboardingState = contacts === null || locations === null ? 'not_available'
    : contactCount > 0 && locationCount > 0 ? 'complete'
      : (contacts.length + locations.length) > 0 ? 'in_progress' : 'not_started';
  const documentState: OnboardingState = documentsUnavailable ? 'not_available' : rejectedDocument ? 'rejected' : availableDocument ? 'complete' : documents.length ? 'in_progress' : 'not_started';
  const subscriptionState: OnboardingState = subscription ? 'complete'
    : rejectedRequest ? 'rejected'
      : pendingRequest ? 'in_progress'
        : requests === null ? 'not_available' : 'not_started';
  // Registration review represents the business-verification decision. Keep
  // it independent from operational lifecycle (ACTIVE/SUSPENDED/etc.).
  const review: OnboardingState = ['VERIFIED', 'APPROVED'].includes(verification) ? 'complete'
    : ['REJECTED', 'DECLINED'].includes(verification) ? 'rejected'
      : ['PENDING_REVIEW', 'IN_REVIEW', 'SUBMITTED'].includes(verification) ? 'in_progress' : 'not_started';
  return [identity, businessState, contactLocation, documentState, subscriptionState, review];
}

export function providerSetupSummary(provider: PlatformProviderAttributes, states: OnboardingState[]) {
  return {
    active: stateOf(provider.status) === 'ACTIVE',
    complete: stateOf(provider.status) === 'ACTIVE' && states.every((state) => state === 'complete'),
    firstIncomplete: Math.max(0, states.findIndex((state) => state !== 'complete' && state !== 'not_available')),
  };
}

export function onboardingStateLabel(state: OnboardingState): string {
  return ({ not_started: 'Not started', in_progress: 'In progress', complete: 'Complete', needs_attention: 'Needs attention', rejected: 'Rejected', not_available: 'Not available' })[state];
}

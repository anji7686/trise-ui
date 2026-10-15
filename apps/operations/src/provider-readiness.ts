import type { PlatformProviderAttributes, ProviderBusinessProfile, ProviderDocument, ProviderOnboardingContactAttributes, ProviderOfficeLocationAttributes, Resource } from './data';

export type ReadinessItem = { label: string; status: string; route: string };
export function providerReadiness(provider: Resource<PlatformProviderAttributes>, business: ProviderBusinessProfile | null, documents: ProviderDocument[], contacts: Resource<ProviderOnboardingContactAttributes>[] | null, locations: Resource<ProviderOfficeLocationAttributes>[] | null): ReadinessItem[] {
  const root = `platform/providers/${provider.id}`;
  return [
    { label: 'Provider profile', status: provider.attributes.display_name ? 'Recorded' : 'Not supplied', route: `${root}/edit` },
    { label: 'Business verification', status: business?.verification_status || provider.attributes.business_verification_status || 'Not available', route: `${root}/business-profile/edit` },
    { label: 'Contacts', status: contacts ? `${contacts.filter((item) => item.attributes.status === 'ACTIVE').length} active contacts loaded` : 'Not available', route: `${root}/onboarding/contacts` },
    { label: 'Office locations', status: locations ? `${locations.filter((item) => item.attributes.status === 'ACTIVE').length} active locations loaded` : 'Not available', route: `${root}/onboarding/locations` },
    { label: 'Documents', status: `${documents.length} documents loaded`, route: `${root}/onboarding/documents` },
    { label: 'Administrator setup', status: provider.attributes.provider_admin_setup === 'configured' ? 'Configured' : provider.attributes.provider_admin_setup === 'not_configured' ? 'Not configured' : 'Not available', route: root },
    { label: 'Plan, approval and payment', status: 'Review subscription records below', route: `${root}/onboarding/subscription` },
    { label: 'Operational activation', status: provider.attributes.status, route: `${root}/onboarding/review` }
  ];
}

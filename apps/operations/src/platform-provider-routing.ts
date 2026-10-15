export type PlatformProviderRoute =
  | { kind: 'overview' }
  | { kind: 'businesses' }
  | { kind: 'directory' }
  | { kind: 'new' }
  | { kind: 'detail'; providerId: string }
  | { kind: 'edit'; providerId: string }
  | { kind: 'business-profile'; providerId: string }
  | { kind: 'contacts'; providerId: string }
  | { kind: 'locations'; providerId: string }
  | { kind: 'documents'; providerId: string }
  | { kind: 'subscription'; providerId: string }
  | { kind: 'review'; providerId: string }
  | { kind: 'lifecycle'; providerId: string }
  | { kind: 'unknown' };

const providerRoute = /^#platform\/providers\/([^/]+)(?:\/(.*?))?\/?$/;

export function normalizePlatformHash(hash: string): string {
  return hash.replace(/^#\//, '#');
}

export function parsePlatformProviderRoute(hash: string): PlatformProviderRoute {
  hash = normalizePlatformHash(hash).split('?')[0];
  if (hash === '#platform/providers' || hash === '#platform/providers/') return { kind: 'directory' };
  if (hash === '#platform/businesses' || hash === '#platform/businesses/') return { kind: 'businesses' };
  if (hash === '#platform/providers/new' || hash === '#platform/providers/new/') return { kind: 'new' };
  if (hash === '#platform/overview' || hash === '#platform/overview/' || hash === '') return { kind: 'overview' };

  const match = hash.match(providerRoute);
  if (!match || match[1] === 'new') return { kind: 'unknown' };
  const providerId = match[1];
  switch (match[2] || '') {
    case '': return { kind: 'detail', providerId };
    case 'edit': return { kind: 'edit', providerId };
    case 'business-profile/edit': return { kind: 'business-profile', providerId };
    case 'onboarding':
    case 'onboarding/contacts': return { kind: 'contacts', providerId };
    case 'onboarding/locations': return { kind: 'locations', providerId };
    case 'onboarding/documents': return { kind: 'documents', providerId };
    case 'onboarding/subscription': return { kind: 'subscription', providerId };
    case 'onboarding/review': return { kind: 'review', providerId };
    case 'lifecycle': return { kind: 'lifecycle', providerId };
    default: return { kind: 'unknown' };
  }
}

export function providerOnboardingRoute(providerId: string, step: number, hash = typeof window === 'undefined' ? '' : window.location.hash): string | undefined {
  if (!providerId) {
    const current = parsePlatformProviderRoute(hash);
    providerId = 'providerId' in current ? current.providerId : '';
  }
  if (!providerId) return step === 0 ? 'platform/providers/new' : undefined;
  return [
    `platform/providers/${providerId}/edit`,
    `platform/providers/${providerId}/business-profile/edit`,
    `platform/providers/${providerId}/onboarding`,
    `platform/providers/${providerId}/onboarding/documents`,
    `platform/providers/${providerId}/onboarding/subscription`,
    `platform/providers/${providerId}/onboarding/review`
  ][step];
}

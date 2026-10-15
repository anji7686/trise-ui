import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProviderIdentityDomainsPanel } from './platform-admin';

describe('Business identity domains presentation', () => {
  it('shows the identity-domain policy and management action only with lifecycle authority', () => {
    const restricted = renderToStaticMarkup(<ProviderIdentityDomainsPanel businessId="business-1" capabilities={['PLATFORM_PROVIDER_READ']} />);
    expect(restricted).toContain('Identity domains');
    expect(restricted).toContain('never grant provider membership or roles');
    expect(restricted).not.toContain('Add identity domain');

    const globalAdmin = renderToStaticMarkup(<ProviderIdentityDomainsPanel businessId="business-1" capabilities={['PLATFORM_PROVIDER_LIFECYCLE']} />);
    expect(globalAdmin).toContain('Add identity domain');
    expect(globalAdmin).toContain('No Business identity domains configured.');
  });
});

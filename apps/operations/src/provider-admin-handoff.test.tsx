import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PlatformProviderAttributes, Resource } from './data';
import { ProviderAdminHandoff } from './provider-admin-handoff';

const provider = (setup?: string): Resource<PlatformProviderAttributes> => ({ id: 'p', type: 'provider', relationships: {}, attributes: { display_name: 'Test provider', status: 'PENDING', provider_admin_setup: setup } });
describe('provider administrator handoff', () => {
  it('keeps invitation authority explicit and hides assignment commands without the capability', () => {
    const html = renderToStaticMarkup(<ProviderAdminHandoff provider={provider()} capabilities={[]} />);
    expect(html).toContain('Not available');
    expect(html).toContain('Administrator invitation management requires a separate platform grant.');
    expect(html).not.toContain('Assign onboarding manager');
  });
  it('offers a time-bounded delegation and requires read permission for history', () => {
    const html = renderToStaticMarkup(<ProviderAdminHandoff provider={provider('not_configured')} capabilities={['PLATFORM_PROVIDER_LIFECYCLE']} />);
    expect(html).toContain('Not configured');
    expect(html).toContain('Assignment ends');
    expect(html).toContain('PLATFORM_PROVIDER_ONBOARD');
    expect(html).toContain('Assignment history requires provider read permission.');
    expect(html).not.toContain('End this assignment');
  });
});

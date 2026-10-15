import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemberRoleBadges } from './provider-members';
import { providerRouteAllowed, navigationForSession } from './navigation';
import { ProviderAccessPage } from './provider-access';

describe('member access presentation', () => {
  it('shows compact multiple-role badges with disabled role state', () => {
    const html = renderToStaticMarkup(<MemberRoleBadges roles={[{ id: 'dispatcher', name: 'Dispatcher', enabled: true, role_type: 'default' }, { id: 'technician', name: 'Technician', enabled: false, role_type: 'custom' }]} />);
    expect(html).toContain('Dispatcher'); expect(html).toContain('Technician'); expect(html).toContain('Disabled');
  });
  it('uses an honest empty access summary', () => {
    expect(renderToStaticMarkup(<MemberRoleBadges roles={[]} />)).toContain('No assigned roles');
  });
  it('shows legacy administrator access separately from optional role assignments', () => {
    const html = renderToStaticMarkup(<MemberRoleBadges roles={[]} administrator membershipContext="PROVIDER_ADMIN" />);
    expect(html).toContain('Provider Administrator · membership access');
    expect(html).not.toContain('No assigned roles');
  });
  it('puts Add Member and the three simple tabs on Team & Access', () => {
    const html = renderToStaticMarkup(<ProviderAccessPage providerId="provider-1" />);
    expect(html).toContain('Add Member');
    expect(html).toContain('Members');
    expect(html).toContain('Invitations');
    expect(html).toContain('Available Roles');
    expect(html).not.toContain('New Custom Role');
  });
  it('shows Team & Access only with the server capability for the selected provider', () => {
    const session = { platformAdmin: false, platformCapabilities: [], providerCapabilities: [{ providerId: 'p', displayName: 'Provider', capabilities: ['team_access'] }] };
    expect(providerRouteAllowed(session, 'p', 'team-access')).toBe(true);
    expect(providerRouteAllowed(session, 'other', 'team-access')).toBe(false);
    expect(navigationForSession(session, 'p').provider.map(item => item.label)).toEqual(['Team & Access']);
  });
});

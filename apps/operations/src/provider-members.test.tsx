import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemberRoleBadges } from './provider-members';
import { providerRouteAllowed, navigationForSession } from './navigation';

describe('member access presentation', () => {
  it('shows compact multiple-role badges with disabled role state', () => {
    const html = renderToStaticMarkup(<MemberRoleBadges roles={[{ id: 'dispatcher', name: 'Dispatcher', enabled: true, role_type: 'default' }, { id: 'technician', name: 'Technician', enabled: false, role_type: 'custom' }]} />);
    expect(html).toContain('Dispatcher'); expect(html).toContain('Technician'); expect(html).toContain('Disabled');
  });
  it('uses an honest empty access summary', () => {
    expect(renderToStaticMarkup(<MemberRoleBadges roles={[]} />)).toContain('No assigned roles');
  });
  it('shows Team & Access only with the server capability for the selected provider', () => {
    const session = { platformAdmin: false, platformCapabilities: [], providerCapabilities: [{ providerId: 'p', displayName: 'Provider', capabilities: ['team_access'] }] };
    expect(providerRouteAllowed(session, 'p', 'team-access')).toBe(true);
    expect(providerRouteAllowed(session, 'other', 'team-access')).toBe(false);
    expect(navigationForSession(session, 'p').provider.map(item => item.label)).toEqual(['Team & Access']);
  });
});

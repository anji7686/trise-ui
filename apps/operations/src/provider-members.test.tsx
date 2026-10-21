import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemberRoleBadges } from './provider-members';
import { groupedProviderNavigation, providerRouteAllowed, navigationForSession } from './navigation';
import { latestProviderRoles, ProviderAccessPage, ProviderRoles } from './provider-access';
import type { AccessRole } from './access-data';

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
  it('keeps member, roles, invitations and audit views in the approved order', () => {
    const html = renderToStaticMarkup(<ProviderAccessPage providerId="provider-1" capabilities={['team_access', 'team_invitation_manage', 'audit']} />);
    expect(html).toContain('Roles &amp; Permissions');
    expect(html).toContain('Audit Logs');
    expect(html.indexOf('Members')).toBeLessThan(html.indexOf('Roles &amp; Permissions'));
    expect(html.indexOf('Roles &amp; Permissions')).toBeLessThan(html.indexOf('Invitations'));
    expect(html.indexOf('Invitations')).toBeLessThan(html.indexOf('Audit Logs'));
    expect(html).not.toContain('New Custom Role');
  });
  it('hides invitation actions when the selected provider only grants role assignment', () => {
    const html = renderToStaticMarkup(<ProviderAccessPage providerId="provider-1" capabilities={['team_access']} />);
    expect(html).not.toContain('Add Member');
    expect(html).not.toContain('Invitations');
    expect(html).toContain('Roles &amp; Permissions');
  });
  it('shows Team & Access only with the server capability for the selected provider', () => {
    const session = { platformAdmin: false, platformCapabilities: [], providerCapabilities: [{ providerId: 'p', displayName: 'Provider', capabilities: ['team_access'] }] };
    expect(providerRouteAllowed(session, 'p', 'team-access')).toBe(true);
    expect(providerRouteAllowed(session, 'other', 'team-access')).toBe(false);
    const providerSettings = groupedProviderNavigation(navigationForSession(session, 'p').provider).find(group => group.group === 'Provider Settings');
    expect(providerSettings?.items.map(item => item.label)).toEqual(['Team & roles']);
  });
  it('exposes role search and enabled-state filters backed by the provider roles API', () => {
    const html = renderToStaticMarkup(<ProviderRoles providerId="provider-1" />);
    expect(html).toContain('Search provider roles');
    expect(html).toContain('Filter roles by enabled status');
    expect(html).toContain('Apply filters');
    expect(html).toContain('Role directory');
    expect(html).toContain('System templates');
    expect(html).toContain('Provider roles per page');
    expect(html).toContain('<option value="10" selected="">10</option>');
    expect(html).toContain('<option value="20">20</option>');
    expect(html).toContain('<option value="50">50</option>');
    expect(html).toContain('<option value="100">100</option>');
    expect(html).not.toContain('Load more roles');
    expect(html).toContain('Creating and editing Provider roles is currently disabled');
    expect(html).toContain('They are not Platform Administration team members');
    expect(html).not.toContain('<th>Responsibilities</th>');
    expect(html).toContain('<th>Updated</th>');
  });
  it('keeps one latest version per role identity and sorts names for display', () => {
    const role = (id: string, name: string, roleCode: string, version: number): AccessRole => ({
      id,
      type: 'roles',
      attributes: { name, role_code: roleCode, role_type: 'default', version, updated_at: `2026-10-0${version}T00:00:00Z` }
    } as AccessRole);
    const latest = latestProviderRoles([
      role('marketing-v1', 'Marketing Manager', 'MARKETING_MANAGER', 1),
      role('reviewer', 'Provider Reviewer', 'PROVIDER_REVIEWER', 1),
      role('marketing-v3', 'Marketing Manager', 'MARKETING_MANAGER', 3),
      role('marketing-v2', 'Marketing Manager', 'MARKETING_MANAGER', 2)
    ]);
    expect(latest.map(item => item.id)).toEqual(['marketing-v3', 'reviewer']);
  });
});

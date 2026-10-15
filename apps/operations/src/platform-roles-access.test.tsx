import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlatformRolesAccessDenied } from './platform-roles-access';
import { navigationForSession } from './navigation';

describe('platform role access presentation', () => {
  it('explains the access boundary without implying provider authority is enough', () => {
    const html = renderToStaticMarkup(<PlatformRolesAccessDenied />);
    expect(html).toContain('Your account cannot view platform role definitions.');
    expect(html).toContain('authorized Platform Access Administrator');
    expect(html).not.toContain('PLATFORM_ACCESS_READ');
  });

  it('shows navigation only when the server projects platform role read authority', () => {
    const base = { platformAdmin: true, providerCapabilities: [] };
    expect(navigationForSession({ ...base, platformCapabilities: [] }).platform.some(item => item.key === 'platform-roles')).toBe(false);
    expect(navigationForSession({ ...base, platformCapabilities: ['PLATFORM_ACCESS_READ'] }).platform.some(item => item.key === 'platform-roles')).toBe(true);
  });

  it('shows Platform Team only with the server-projected read capability', () => {
    const base = { platformAdmin: true, providerCapabilities: [] };
    expect(navigationForSession({ ...base, platformCapabilities: [] }).platform.some(item => item.key === 'platform-team')).toBe(false);
    expect(navigationForSession({ ...base, platformCapabilities: ['PLATFORM_TEAM_READ'] }).platform.some(item => item.key === 'platform-team')).toBe(true);
  });
});

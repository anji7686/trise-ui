import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlatformTeamPage } from './platform-team';

describe('Platform Team administration presentation', () => {
  it('does not present the page without server-projected read authority', () => {
    const html = renderToStaticMarkup(<PlatformTeamPage capabilities={[]} />);
    expect(html).toContain('Platform Team is restricted');
    expect(html).not.toContain('Invite Admin');
  });

  it('presents governed platform team controls only from granted capabilities', () => {
    const html = renderToStaticMarkup(<PlatformTeamPage capabilities={['PLATFORM_TEAM_READ', 'PLATFORM_TEAM_INVITATIONS_MANAGE']} />);
    expect(html).toContain('Platform Team');
    expect(html).toContain('Invite Admin');
    expect(html).not.toContain('Save role');
    expect(html).not.toContain('Suspend');
  });
});

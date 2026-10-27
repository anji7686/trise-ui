import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminActionMenu } from './platform-admin-ui';

describe('AdminActionMenu', () => {
  it('provides a visible, keyboard-focusable trigger for overflow actions', () => {
    const html = renderToStaticMarkup(<AdminActionMenu label="Provider actions"><button type="button">Open provider</button><button type="button">Business profile</button></AdminActionMenu>);
    expect(html).toContain('class="admin-action-menu-trigger"');
    expect(html).toContain('aria-label="Provider actions"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('class="admin-action-menu-popup"');
  });

  it('keeps a single action directly available without an overflow menu', () => {
    const html = renderToStaticMarkup(<AdminActionMenu><button type="button">Open provider</button></AdminActionMenu>);
    expect(html).toContain('Open provider');
    expect(html).not.toContain('admin-action-menu-trigger');
  });
});

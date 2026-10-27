import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlatformNotificationHistoryPage } from './platform-notifications';

describe('platform notification history', () => {
  it('renders a clear platform inbox shell while notifications load', () => {
    const markup = renderToStaticMarkup(<PlatformNotificationHistoryPage />);
    expect(markup).toContain('Platform notifications');
    expect(markup).toContain('System alerts and review updates');
    expect(markup).toContain('Loading platform notifications');
  });
});

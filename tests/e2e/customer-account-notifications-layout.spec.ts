import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('alerts and notification preferences share mock-aligned responsive layouts', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(90_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));

  const screens = [
    {
      route: '/#/alerts',
      heading: 'Updates across your account',
      screenshot: 'customer-alerts-layout',
      check: async () => {
        await expect(page.getByRole('button', { name: /Mark all read|All read/ })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Notification preferences', exact: true })).toBeVisible();
      },
    },
    {
      route: '/#/notification-preferences',
      heading: 'Updates, your way.',
      screenshot: 'customer-notification-preferences-layout',
      check: async () => {
        await expect(page.getByRole('switch').first()).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save preferences', exact: true })).toBeVisible();
      },
    },
  ];

  for (const screen of screens) {
    await page.goto(screen.route);
    await expect(page.getByRole('heading', { name: screen.heading, exact: true })).toBeVisible({ timeout: 15_000 });
    if (await page.evaluate(() => innerWidth >= 1200)) {
      const shellLayout = await page.locator('.customer-layout').evaluate((element) => {
        const sidebar = element.querySelector('.customer-sidebar');
        const workspace = element.querySelector('.customer-workspace');
        return {
          sidebarWidth: sidebar?.getBoundingClientRect().width,
          workspacePaddingLeft: Number.parseFloat(workspace ? getComputedStyle(workspace).paddingLeft : '0'),
        };
      });
      expect(shellLayout.sidebarWidth).toBe(228);
      expect(shellLayout.workspacePaddingLeft).toBeGreaterThanOrEqual(34);
      expect(shellLayout.workspacePaddingLeft).toBeLessThanOrEqual(35);
    }
    await screen.check();
    if (screen.route.endsWith('notification-preferences') && await page.getByRole('switch').first().isChecked()) {
      await expect.poll(() => page.getByRole('switch').first().evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(22, 134, 117)');
    }
    await page.screenshot({ path: info.outputPath(`${screen.screenshot}-light.png`), fullPage: true });
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      expect(dimensions.document, `${screen.heading} overflows at ${width}px in light theme`).toBeLessThanOrEqual(dimensions.viewport);
      expect(dimensions.body, `${screen.heading} body overflows at ${width}px in light theme`).toBeLessThanOrEqual(dimensions.viewport);
    }
    await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
    await page.screenshot({ path: info.outputPath(`${screen.screenshot}-dark.png`), fullPage: true });
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      expect(dimensions.document, `${screen.heading} overflows at ${width}px in dark theme`).toBeLessThanOrEqual(dimensions.viewport);
      expect(dimensions.body, `${screen.heading} body overflows at ${width}px in dark theme`).toBeLessThanOrEqual(dimensions.viewport);
    }
    await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click();
  }
});

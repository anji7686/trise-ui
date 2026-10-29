import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('customer can retry a failed provider contact lookup inside the dialog', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(90_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  if (info.project.name === 'customer-mobile') await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();

  const requestsByProvider = new Map<string, number>();
  let failedProviderId = '';
  await page.route('**/api/v1/providers/*/support-contact', async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') return route.continue();
    const url = new URL(request.url());
    const providerId = decodeURIComponent(url.pathname.split('/').at(-2) || '');
    const count = (requestsByProvider.get(providerId) || 0) + 1;
    requestsByProvider.set(providerId, count);
    if (!failedProviderId) failedProviderId = providerId;
    if (providerId === failedProviderId && count === 1) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'temporary_unavailable', message: 'Provider contact details are temporarily unavailable.' }) });
      return;
    }
    const data = providerId === failedProviderId ? {
      id: 'browser-help-contact',
      type: 'provider-support-contacts',
      attributes: { provider_id: providerId, provider_name: 'Synthetic support provider', display_name: 'Account Support', contact_methods: { email: 'support@example.test', mobile: '+919876543210' } },
    } : null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }) });
  });

  await page.goto('/#/help');
  await expect(page.getByRole('heading', { name: 'Let’s make it easier.', exact: true })).toBeVisible();
  const providers = page.locator('.customer-help-provider');
  await expect(providers).toHaveCount(2);
  const failedRow = providers.first();
  await expect(failedRow.getByText('Contact details could not be loaded.', { exact: true })).toBeVisible();
  await failedRow.getByRole('button', { name: 'View contact details', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Contact details', exact: true });
  await expect(dialog.getByRole('alert')).toContainText('Contact details could not be loaded.');
  await page.screenshot({ path: info.outputPath('customer-help-contact-error.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Retry contact details', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(failedRow.getByText('Contact details could not be loaded.', { exact: true })).toHaveCount(0);
  expect(requestsByProvider.get(failedProviderId)).toBe(2);

  await failedRow.getByRole('button', { name: 'View contact details', exact: true }).click();
  const recoveredDialog = page.getByRole('dialog', { name: 'Contact details', exact: true });
  await expect(recoveredDialog.getByText('Account Support', { exact: true })).toBeVisible();
  await expect(recoveredDialog.getByRole('link', { name: 'Email support@example.test', exact: true })).toHaveAttribute('href', 'mailto:support@example.test');
  await expect(recoveredDialog.getByRole('link', { name: 'Call +919876543210', exact: true })).toHaveAttribute('href', 'tel:+919876543210');
  await page.screenshot({ path: info.outputPath('customer-help-contact-recovered.png'), fullPage: true });
  await recoveredDialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(recoveredDialog).not.toBeVisible();
  if (info.project.name === 'customer-desktop') {
    for (const theme of ['light', 'dark'] as const) {
      const activeTheme = await page.locator('html').getAttribute('data-theme');
      if (activeTheme !== theme) {
        await page.getByRole('button', { name: theme === 'dark' ? 'Switch to dark theme' : 'Switch to light theme', exact: true }).click();
      }
      for (const width of [360, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
        const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
        expect(dimensions.viewport).toBe(width);
        expect(dimensions.document, `${theme} theme at ${width}px`).toBeLessThanOrEqual(width);
        expect(dimensions.body, `${theme} theme at ${width}px`).toBeLessThanOrEqual(width);
      }
    }
  }
});

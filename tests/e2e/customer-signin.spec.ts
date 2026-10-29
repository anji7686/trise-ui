import { test, expect } from './fixtures';

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('customer sign-in preserves the screen and explains a rejected Google account', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  await page.addInitScript(() => {
    type GoogleBridge = Window & {
      google?: { accounts: { id: {
        initialize: (options: { callback: (response: { credential: string }) => void }) => void;
        renderButton: (container: HTMLElement) => void;
      } } };
      triseGisCallback?: (response: { credential: string }) => void;
    };
    const bridge = window as GoogleBridge;
    bridge.google = { accounts: { id: {
      initialize: ({ callback }) => { bridge.triseGisCallback = callback; },
      renderButton: (container) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Continue with Google';
        button.setAttribute('aria-label', 'Sign in with Google');
        button.addEventListener('click', () => bridge.triseGisCallback?.({ credential: 'synthetic-invalid-identity-token' }));
        container.append(button);
      },
    } } };
  });
  let exchangeCount = 0;
  await page.route('**/api/v1/session/google', async (route) => {
    exchangeCount += 1;
    await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'customer_relationship_required', message: 'This Google account is not linked to a customer profile.' }) });
  });

  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Your everyday. Well cared for.', exact: false })).toBeVisible();
  await expect(page.getByText('Your assets and service records stay private until your identity and customer relationship are verified.', { exact: true })).toBeVisible();
  const localSignIn = page.locator('details.development-sign-in');
  await expect(localSignIn).toBeVisible();
  await expect(localSignIn).not.toHaveAttribute('open', '');

  await page.getByRole('button', { name: 'Sign in with Google', exact: true }).click();
  const error = page.getByRole('alert');
  await expect(error).toHaveText('This Google account is not linked to a customer profile.');
  await expect(page.getByRole('heading', { name: 'Your everyday. Well cared for.', exact: false })).toBeVisible();
  await expect(page.locator('.customer-login-shell')).toBeVisible();
  expect(exchangeCount).toBe(1);
  await page.screenshot({ path: info.outputPath('customer-signin-rejected-account.png'), fullPage: true });
});

test('customer can retry loading Google Identity Services after a network error', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  let scriptRequests = 0;
  await page.route('**/gsi/client', async (route) => {
    scriptRequests += 1;
    if (scriptRequests === 1) {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `window.google = { accounts: { id: {
        initialize: (options) => { window.__triseGisCallback = options.callback; },
        renderButton: (container) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Continue with Google'; button.setAttribute('aria-label', 'Sign in with Google'); container.append(button); }
      } } };`,
    });
  });

  await page.goto('/#/');
  await expect(page.getByRole('alert')).toHaveText('Google Identity Services could not load. Check network access and try again.');
  await page.getByRole('button', { name: 'Retry Google sign-in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign in with Google', exact: true })).toBeVisible();
  expect(scriptRequests).toBe(2);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

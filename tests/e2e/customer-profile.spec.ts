import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

const profile = {
  id: 'browser-profile-user',
  type: 'users',
  attributes: { display_name: 'Browser Profile Fixture', email: 'customer@example.test', email_verified: true, phone: '+919876543210', locale: 'en', revision: 7 },
  relationships: {},
};

test('customer profile renders the editable details, security and access sections', async ({ page }, info) => {
  test.skip(!['customer-desktop', 'customer-mobile'].includes(info.project.name), 'Profile visual references are captured on desktop and mobile');
  test.setTimeout(90_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  await page.route('**/api/v1/me', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profile) });
      return;
    }
    await route.continue();
  });
  await page.goto('/#/profile');
  await expect(page.getByRole('heading', { name: 'Your profile', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign-in & security', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your access', exact: true })).toBeVisible();
  await expect(page.getByLabel('Display name')).toHaveValue(profile.attributes.display_name);
  await expect(page.getByLabel('Language')).toHaveValue('en');
  await expect(page.getByText('customer@example.test', { exact: true })).toBeVisible();
  const factRows = await page.locator('.customer-profile-facts > div').evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().y));
  expect(factRows).toHaveLength(3);
  expect(factRows[1]).toBeGreaterThan(factRows[0]);
  expect(factRows[2]).toBeGreaterThan(factRows[1]);
  await page.screenshot({ path: info.outputPath('customer-profile-baseline.png'), fullPage: true });

  if (info.project.name === 'customer-mobile') {
    await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
    const mobileWidth = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    expect(mobileWidth.viewport).toBe(390);
    expect(mobileWidth.document).toBeLessThanOrEqual(mobileWidth.viewport);
    expect(mobileWidth.body).toBeLessThanOrEqual(mobileWidth.viewport);
    await page.screenshot({ path: info.outputPath('customer-profile-baseline-mobile-dark.png'), fullPage: true });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const bottomLayout = await page.evaluate(() => ({
      contentBottom: document.querySelector('.customer-profile-access')?.getBoundingClientRect().bottom ?? Infinity,
      navigationTop: document.querySelector('.customer-mobile-navigation')?.getBoundingClientRect().top ?? -Infinity,
    }));
    expect(bottomLayout.contentBottom).toBeLessThanOrEqual(bottomLayout.navigationTop);
  }

  if (info.project.name === 'customer-desktop') {
  for (const theme of ['light', 'dark'] as const) {
    const activeTheme = await page.locator('html').getAttribute('data-theme');
    if (activeTheme !== theme) {
      await page.getByRole('button', { name: theme === 'dark' ? 'Switch to dark theme' : 'Switch to light theme', exact: true }).click();
    }
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
      const dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      expect(dimensions.viewport).toBe(width);
      expect(dimensions.document, `${theme} theme at ${width}px`).toBeLessThanOrEqual(width);
      expect(dimensions.body, `${theme} theme at ${width}px`).toBeLessThanOrEqual(width);
    }
  }
  }
});

test('customer profile keeps edits visible when the server reports a stale revision', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(90_000);
  let profileLoads = 0;
  let attemptedBody: Record<string, unknown> | undefined;
  await localSignIn(page, configuredAccount('CUSTOMER'));
  if (info.project.name === 'customer-mobile') await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await page.route('**/api/v1/me', async (route) => {
    if (route.request().method() === 'GET') {
      profileLoads += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profile) });
      return;
    }
    if (route.request().method() === 'PATCH') {
      attemptedBody = route.request().postDataJSON();
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'conflict', message: 'This profile changed elsewhere. Reload the latest profile and try again.' }) });
      return;
    }
    await route.continue();
  });
  await page.goto('/#/profile');
  await expect(page.getByRole('heading', { name: 'Your profile', exact: true })).toBeVisible();
  const displayName = page.getByLabel('Display name');
  await expect(displayName).toHaveValue('Browser Profile Fixture');
  await displayName.fill('Customer edit kept for review');
  await page.getByLabel('Language').selectOption('hi');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();

  await expect(page.getByRole('status')).toContainText('changed elsewhere');
  await expect(displayName).toHaveValue('Customer edit kept for review');
  await expect(page.getByLabel('Language')).toHaveValue('hi');
  expect(profileLoads).toBeGreaterThan(0);
  expect(attemptedBody).toEqual({ display_name: 'Customer edit kept for review', locale: 'hi', expected_revision: 7 });
  await page.screenshot({ path: info.outputPath('customer-profile-stale-revision.png'), fullPage: true });
});

test('customer profile uses denied-state recovery instead of retrying access failures', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(90_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  if (info.project.name === 'customer-mobile') await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await page.route('**/api/v1/me', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'forbidden', message: 'Access denied to customer profile.' }) });
      return;
    }
    await route.continue();
  });

  await page.goto('/#/profile');
  await expect(page.getByRole('heading', { name: 'This record isn’t available.', exact: true })).toBeVisible();
  await expect(page.getByText('Your profile details aren’t available in this session.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to overview', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Retry profile details', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Display name')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('customer-profile-denied.png'), fullPage: true });
  await page.getByRole('button', { name: 'Back to overview', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
});

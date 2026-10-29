import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('customer Alerts can recover after a temporary notification feed failure', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(90_000);

  await localSignIn(page, configuredAccount('CUSTOMER'));
  if (info.project.name === 'customer-mobile') {
    await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  }
  let failedInitialFeedRequests = 0;
  let allowFeedRequests = false;
  await page.route('**/api/v1/notifications**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!allowFeedRequests && request.method() === 'GET' && url.pathname.endsWith('/notifications')) {
      failedInitialFeedRequests += 1;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'temporary_unavailable', message: 'Temporary notification feed failure' }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/#/alerts');
  await expect(page.getByRole('heading', { name: 'We couldn’t load this information.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
  expect(failedInitialFeedRequests).toBeGreaterThan(0);

  allowFeedRequests = true;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Updates across your account', exact: true })).toBeVisible();
  await expect(page.getByText(/\d+ updates?/)).toBeVisible();
  await page.screenshot({ path: info.outputPath('customer-alerts-retry-recovered.png'), fullPage: true });
});

test('customer notification preference keeps its draft after a revision conflict', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(90_000);

  await localSignIn(page, configuredAccount('CUSTOMER'));
  if (info.project.name === 'customer-mobile') {
    await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  }

  let interceptedPreferenceWrite = false;
  await page.route('**/api/v1/notification-preferences', async (route) => {
    if (route.request().method() === 'POST') {
      interceptedPreferenceWrite = true;
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'revision_conflict', message: 'The preference has a newer revision. Reload it before saving.' }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/#/notification-preferences');
  await expect(page.getByRole('heading', { name: 'Updates, your way.', exact: true })).toBeVisible();
  const preferenceSwitches = page.getByRole('switch');
  await expect(preferenceSwitches.first()).toBeVisible();
  const initialValue = await preferenceSwitches.first().isChecked();
  await preferenceSwitches.first().setChecked(!initialValue);
  await expect(page.getByRole('button', { name: 'Save preferences', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText('newer revision');
  await expect(preferenceSwitches.first()).toBeChecked({ checked: !initialValue });
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
  expect(interceptedPreferenceWrite).toBe(true);
  await page.screenshot({ path: info.outputPath('customer-notification-preference-conflict.png'), fullPage: true });
});

test('customer Alerts distinguishes a partial feed failure from a complete empty state', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(90_000);

  await localSignIn(page, configuredAccount('CUSTOMER'));
  if (info.project.name === 'customer-mobile') {
    await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  }

  let failedFirstListRequest = false;
  let successfulReads = 0;
  await page.route('**/api/v1/notifications**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname.endsWith('/notifications')) {
      if (!failedFirstListRequest) {
        failedFirstListRequest = true;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'temporary_unavailable', message: 'One provider feed is temporarily unavailable.' }),
        });
        return;
      }
      successfulReads += 1;
    }
    await route.continue();
  });

  await page.goto('/#/alerts');
  await expect(page.getByRole('heading', { name: 'Updates across your account', exact: true })).toBeVisible();
  const partialFailure = page.locator('.customer-feature-error');
  await expect(partialFailure).toContainText('Some service-provider alerts could not load');
  await expect(partialFailure.getByRole('button', { name: 'Retry alerts', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A clean slate.', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'All read', exact: true })).toHaveCount(0);
  const retryControlIsSeparated = await partialFailure.evaluate((element) => {
    const message = element.querySelector('span')?.getBoundingClientRect();
    const button = element.querySelector('button')?.getBoundingClientRect();
    return Boolean(message && button && (message.right <= button.left || message.bottom <= button.top || button.bottom <= message.top));
  });
  expect(retryControlIsSeparated).toBe(true);
  expect(failedFirstListRequest).toBe(true);
  expect(successfulReads).toBeGreaterThan(0);

  await page.screenshot({ path: info.outputPath('customer-alerts-partial-provider-feed.png'), fullPage: true });
  await partialFailure.getByRole('button', { name: 'Retry alerts', exact: true }).click();
  await expect(page.locator('.customer-feature-error')).toHaveCount(0);
  expect(successfulReads).toBeGreaterThan(1);
});

test('customer Alerts loads the next notification cursor within the same provider relationship', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(90_000);

  await localSignIn(page, configuredAccount('CUSTOMER'));
  if (info.project.name === 'customer-mobile') {
    await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  }

  const firstTitle = 'Pagination check · first alert';
  const secondTitle = 'Pagination check · next page alert';
  const createdAt = new Date().toISOString();
  const notification = (id: string, title: string) => ({
    id,
    type: 'notifications',
    attributes: { category: 'service', title, body: 'Temporary browser-only pagination test record.', read_at: null, created_at: createdAt },
    relationships: {},
  });
  let providerWithNextPage = '';
  let firstPageServed = false;
  let nextPageServed = false;
  await page.route('**/api/v1/notifications**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname.endsWith('/notifications')) {
      const providerId = request.headers()['x-trise-provider-id'] || '';
      if (!firstPageServed) {
        firstPageServed = true;
        providerWithNextPage = providerId;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [notification('pagination-alert-1', firstTitle)], page: { limit: 15, next: 'pagination-cursor-2', previous: null } }),
        });
        return;
      }
      if (providerId === providerWithNextPage && url.searchParams.get('page[after]') === 'pagination-cursor-2') {
        nextPageServed = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [notification('pagination-alert-2', secondTitle)], page: { limit: 15, next: null, previous: 'pagination-cursor-1' } }),
        });
        return;
      }
    }
    await route.continue();
  });

  await page.goto('/#/alerts');
  await expect(page.getByText(firstTitle, { exact: true })).toBeVisible();
  const loadMore = page.getByRole('button', { name: 'Load more', exact: true });
  await expect(loadMore).toBeEnabled();
  await loadMore.click();
  await expect(page.getByText(secondTitle, { exact: true })).toBeVisible();
  expect(firstPageServed).toBe(true);
  expect(nextPageServed).toBe(true);
  await page.screenshot({ path: info.outputPath('customer-alerts-cursor-pagination.png'), fullPage: true });
});

test('customer notification preferences shows an access-denied recovery action', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(90_000);

  await localSignIn(page, configuredAccount('CUSTOMER'));
  if (info.project.name === 'customer-mobile') {
    await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  }

  await page.route('**/api/v1/notification-preference-options**', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'forbidden', message: 'Access denied for customer notification preferences.' }),
    });
  });

  await page.goto('/#/notification-preferences');
  await expect(page.getByRole('heading', { name: 'This record isn’t available.', exact: true })).toBeVisible();
  await expect(page.getByText('Access denied for customer notification preferences.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to overview', exact: true })).toBeEnabled();
  await expect(page.getByRole('switch')).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('customer-notification-preferences-denied.png'), fullPage: true });

  await page.getByRole('button', { name: 'Back to overview', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
});

test('customer Alerts does not expose notification actions when the feed is denied', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(90_000);

  await localSignIn(page, configuredAccount('CUSTOMER'));
  if (info.project.name === 'customer-mobile') {
    await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  }

  await page.route('**/api/v1/notifications**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'forbidden', message: 'Access denied to customer notifications.' }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto('/#/alerts');
  await expect(page.getByRole('heading', { name: 'This record isn’t available.', exact: true })).toBeVisible();
  await expect(page.getByText('Access denied to customer notifications.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark all read', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mark read', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('customer-alerts-denied.png'), fullPage: true });

  await page.getByRole('button', { name: 'Back to overview', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
});

import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

const timelineEntry = (id: string, eventName: string, occurredAt: string, summary: string) => ({
  id,
  type: 'timeline-entries',
  attributes: {
    created_at: occurredAt,
    provider_id: 'browser-only-provider',
    event_name: eventName,
    occurred_at: occurredAt,
    summary,
  },
  relationships: { source: null, asset: null },
});

test('customer Service history keeps healthy provider events visible during partial failure and recovers', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(90_000);

  await localSignIn(page, configuredAccount('CUSTOMER'));
  if (info.project.name === 'customer-mobile') {
    await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  }

  const eventTime = new Date().toISOString();
  const fixtureTitle = 'Service request updated';
  let failedOneProvider = false;
  let returnedHealthyProviderEvent = false;
  let retryAllowed = false;
  await page.route('**/api/v1/timeline**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname.endsWith('/timeline') && !retryAllowed) {
      if (!failedOneProvider) {
        failedOneProvider = true;
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'temporary_unavailable', message: 'One provider history feed is temporarily unavailable.' }) });
        return;
      }
      if (!returnedHealthyProviderEvent) {
        returnedHealthyProviderEvent = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [timelineEntry('browser-history-event', 'SERVICE_REQUEST_UPDATED', eventTime, 'Browser-only event used to verify partial history rendering.')], page: { limit: 15, next: null, previous: null } }),
        });
        return;
      }
    }
    await route.continue();
  });

  await page.goto('/#/timeline');
  await expect(page.getByRole('heading', { name: 'Your service story', exact: true })).toBeVisible();
  await expect(page.locator('.customer-timeline-error')).toContainText('Some service-provider history could not load');
  await expect(page.getByText(fixtureTitle, { exact: true })).toBeVisible();
  await expect(page.getByText('Service request ·', { exact: false }).first()).toBeVisible();
  expect(failedOneProvider).toBe(true);
  expect(returnedHealthyProviderEvent).toBe(true);
  await page.screenshot({ path: info.outputPath('customer-timeline-partial-feed.png'), fullPage: true });

  retryAllowed = true;
  await page.locator('.customer-timeline-error').getByRole('button', { name: 'Retry history', exact: true }).click();
  await expect(page.locator('.customer-timeline-error')).toHaveCount(0);
});

test('customer Service history appends the next cursor from the same provider', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(90_000);

  await localSignIn(page, configuredAccount('CUSTOMER'));
  if (info.project.name === 'customer-mobile') {
    await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  }

  const eventTime = new Date().toISOString();
  const firstTitle = 'Service request updated';
  const secondSummary = 'Next browser-only timeline page fixture.';
  let pagingProviderId = '';
  let firstPageServed = false;
  let nextPageServed = false;
  await page.route('**/api/v1/timeline**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname.endsWith('/timeline')) {
      const providerId = request.headers()['x-trise-provider-id'] || '';
      if (!firstPageServed) {
        firstPageServed = true;
        pagingProviderId = providerId;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [timelineEntry('browser-history-page-1', 'SERVICE_REQUEST_UPDATED', eventTime, 'First browser-only timeline page.')], page: { limit: 15, next: 'history-cursor-2', previous: null } }),
        });
        return;
      }
      if (providerId === pagingProviderId && url.searchParams.get('page[after]') === 'history-cursor-2') {
        nextPageServed = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [timelineEntry('browser-history-page-2', 'SERVICE_REQUEST_CREATED', new Date(Date.now() - 60_000).toISOString(), secondSummary)], page: { limit: 15, next: null, previous: 'history-cursor-1' } }),
        });
        return;
      }
    }
    await route.continue();
  });

  await page.goto('/#/timeline');
  await expect(page.getByText(firstTitle, { exact: true }).first()).toBeVisible();
  const loadMore = page.getByRole('button', { name: 'Load more history', exact: true });
  await expect(loadMore).toBeEnabled();
  await loadMore.click();
  await expect(page.getByText(secondSummary, { exact: true })).toBeVisible();
  expect(firstPageServed).toBe(true);
  expect(nextPageServed).toBe(true);
  await page.screenshot({ path: info.outputPath('customer-timeline-cursor-pagination.png'), fullPage: true });
});

test('customer Service history offers overview recovery when every provider feed is denied', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(90_000);

  await localSignIn(page, configuredAccount('CUSTOMER'));
  if (info.project.name === 'customer-mobile') {
    await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  }

  await page.route('**/api/v1/timeline**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'forbidden', message: 'Access denied to customer service history.' }) });
      return;
    }
    await route.continue();
  });

  await page.goto('/#/timeline');
  await expect(page.getByRole('heading', { name: 'This record isn’t available.', exact: true })).toBeVisible();
  await expect(page.getByText('Access denied to customer service history.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to overview', exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('customer-timeline-denied.png'), fullPage: true });
  await page.getByRole('button', { name: 'Back to overview', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
});

test('customer Service history fits the reference viewport widths in light and dark themes', async ({ page }, info) => {
  test.skip(info.project.name !== 'customer-desktop', 'Viewport matrix is run once in the desktop browser engine');
  test.setTimeout(90_000);

  await localSignIn(page, configuredAccount('CUSTOMER'));
  await page.goto('/#/timeline');
  await expect(page.getByRole('heading', { name: 'Your service story', exact: true })).toBeVisible();

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
      expect(dimensions.document, `${theme} theme at ${width}px document width`).toBeLessThanOrEqual(width);
      expect(dimensions.body, `${theme} theme at ${width}px body width`).toBeLessThanOrEqual(width);
      expect(dimensions.viewport).toBe(width);
    }
  }
  await page.screenshot({ path: info.outputPath('customer-timeline-viewport-matrix.png'), fullPage: true });
});

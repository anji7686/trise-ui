import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';
import { e2eApiV1Base } from './e2e-config';

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';

test('customer can view the safe AMC coverage summary without provider internals', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(60_000);

  const customer = await localSignIn(page, configuredAccount('CUSTOMER'));
  const response = await page.request.get(`${e2eApiV1Base()}/maintenance-contracts?page[limit]=25&sort=-created_at,id`, {
    headers: { Authorization: `Bearer ${customer.accessToken}`, 'X-TRISE-Provider-Id': providerId },
  });
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  const rows = payload.data as Array<{ attributes: Record<string, unknown> }>;
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((row) => !('provider_id' in row.attributes))).toBeTruthy();
  expect(rows.every((row) => !('commercial_party_roles' in row.attributes))).toBeTruthy();
  expect(rows.some((row) => Boolean(row.attributes.customer_safe_summary))).toBeTruthy();
  const hasAgreementWithoutCoveredLifts = rows.some((row) => {
    const summary = row.attributes.customer_safe_summary as { covered_elevator_count?: number } | undefined;
    return summary?.covered_elevator_count === 0;
  });

  await page.goto('/#/coverage');
  await expect(page.getByRole('heading', { name: 'Care that goes further.', exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Your AMC agreements and warranties, in one place.', { exact: true })).toBeVisible();
  await expect(page.locator('.coverage-grid > button').first()).toBeVisible();
  await expect(page.locator('.coverage-card .customer-record-action').first()).toBeVisible();
  await expect(page.locator('.coverage-card .customer-record-action').first()).toHaveCSS('border-top-width', '1px');
  await expect(page.locator('.coverage-grid')).not.toContainText(/commercial_party_roles|provider_id|audit identifier/i);
  await expect(page.locator('.coverage-grid')).toContainText('Upcoming');
  if (hasAgreementWithoutCoveredLifts) await expect(page.locator('.coverage-card').filter({ hasText: 'No covered lifts listed' }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('customer-safe-amc-coverage.png') });
});

test('customer can leave a denied coverage detail from the recovery action', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(60_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  await page.route('**/api/v1/maintenance-contracts/denied-coverage-fixture', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'forbidden', message: 'This record is not available in your customer account.' }),
    });
  });
  await page.goto('/#/coverage/contract/denied-coverage-fixture');
  const recovery = page.getByRole('button', { name: 'Back to overview', exact: true });
  await expect(recovery).toBeVisible();
  await expect(recovery).toBeEnabled();
  await recovery.click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('heading', { name: /Your spaces\./ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Everything, connected', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/continuous browser test address/i)).toHaveCount(0);
});

test('customer can retry a temporarily unavailable agreement detail', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(60_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  await page.goto('/#/coverage');
  await expect(page.getByRole('heading', { name: 'Care that goes further.', exact: true })).toBeVisible({ timeout: 20_000 });
  await page.locator('.coverage-search summary').click();
  await page.getByRole('searchbox', { name: 'Search coverage' }).fill('Green Heights Two-Lift Annual Care');
  const agreement = page.locator('.coverage-grid .coverage-card').filter({ hasText: 'Green Heights Two-Lift Annual Care' });
  await expect(agreement).toBeVisible();

  let failOnce = true;
  await page.route('**/api/v1/maintenance-contracts/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (!/\/api\/v1\/maintenance-contracts\/[^/]+$/.test(pathname)) return route.continue();
    if (!failOnce) return route.continue();
    failOnce = false;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'service_unavailable', message: 'Agreement details could not be loaded. Try again.' }) });
  });
  await agreement.click();
  await expect(page.getByRole('heading', { name: 'We couldn’t load this information.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Green Heights Two-Lift Annual Care', exact: true })).toBeVisible({ timeout: 20_000 });
});

test('customer can review a multi-lift agreement and its unit-specific sites', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(60_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  await page.goto('/#/coverage');
  await expect(page.getByRole('heading', { name: 'Care that goes further.', exact: true })).toBeVisible({ timeout: 20_000 });
  await page.locator('.coverage-search summary').click();
  await page.getByRole('searchbox', { name: 'Search coverage' }).fill('Green Heights');
  const agreement = page.locator('.coverage-grid .coverage-card').filter({ hasText: 'Green Heights Two-Lift Annual Care' });
  await expect(agreement).toBeVisible();
  await agreement.click();

  await expect(page.getByRole('heading', { name: 'Your maintenance agreement', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Green Heights Two-Lift Annual Care', exact: true })).toBeVisible();
  await expect(page.locator('.customer-coverage-detail')).toContainText('2 covered lifts');
  await expect(page.locator('.customer-coverage-asset-grid button')).toHaveCount(2);
  for (const lift of ['ELP05 Browser Lift 1', 'ELP05 Browser Lift 2']) {
    await expect(page.locator('.customer-coverage-asset-grid button').filter({ hasText: lift })).toContainText('Green Heights Community');
  }
  await expect(page.locator('.customer-coverage-detail .status')).toContainText('Active');
  await expect(page.getByRole('heading', { name: 'What your agreement covers', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Upcoming care', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Agreement documents', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Thinking ahead?', exact: true })).toBeVisible();
  await expect(page.getByText('No documents have been shared for this agreement.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({ path: info.outputPath(`elevator-coverage-detail-${info.project.name}.png`) });
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  if (info.project.name === 'customer-mobile') {
    await page.screenshot({ path: info.outputPath('elevator-coverage-detail-customer-mobile-dark.png') });
    const renewal = page.locator('.customer-coverage-renewal');
    await renewal.scrollIntoViewIfNeeded();
    await expect(renewal).toBeVisible();
    const clearance = await page.evaluate(() => {
      const panel = document.querySelector('.customer-coverage-renewal')?.getBoundingClientRect();
      const navigation = document.querySelector('.customer-mobile-navigation')?.getBoundingClientRect();
      return panel && navigation ? navigation.top - panel.bottom : -1;
    });
    expect(clearance, 'final coverage details should clear mobile navigation').toBeGreaterThanOrEqual(0);
    await page.screenshot({ path: info.outputPath('elevator-coverage-detail-customer-mobile-dark-bottom.png') });
  }
});

test('customer sees future-dated maintenance agreement as upcoming in detail', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(60_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  await page.goto('/#/coverage');
  await expect(page.getByRole('heading', { name: 'Care that goes further.', exact: true })).toBeVisible({ timeout: 20_000 });
  const futureAgreement = page.locator('.coverage-grid .coverage-card').filter({ hasText: 'Maintenance agreement' }).first();
  await expect(futureAgreement).toContainText('Upcoming');
  await futureAgreement.click();
  await expect(page.getByRole('heading', { name: 'Your maintenance agreement', exact: true })).toBeVisible();
  await expect(page.locator('.customer-coverage-detail .status')).toContainText('Upcoming');
  await expect(page.locator('.customer-coverage-detail')).toContainText('No covered lifts are currently available');
});

test('customer can prepare a renewal enquiry for the authorized provider contact', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(60_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  await page.goto('/#/coverage');
  await expect(page.getByRole('heading', { name: 'Care that goes further.', exact: true })).toBeVisible({ timeout: 20_000 });
  await page.locator('.coverage-search summary').click();
  await page.getByRole('searchbox', { name: 'Search coverage' }).fill('Green Heights Two-Lift Annual Care');
  await page.locator('.coverage-grid .coverage-card').filter({ hasText: 'Green Heights Two-Lift Annual Care' }).click();
  await expect(page.getByRole('heading', { name: 'Green Heights Two-Lift Annual Care', exact: true })).toBeVisible();
  if (info.project.name === 'customer-mobile') {
    await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  }
  await page.getByRole('button', { name: 'Ask about renewal', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Ask about renewal' });
  await expect(dialog).toBeVisible();
  const subject = dialog.getByLabel('Subject');
  const message = dialog.getByLabel('Message');
  await expect(subject).toHaveValue(/AMC renewal enquiry/);
  await subject.fill('Renewal options for both lifts');
  await message.fill('Please share the next renewal period, pricing and included visit schedule.');
  const send = dialog.getByRole('link', { name: 'Send enquiry', exact: true });
  await expect(send).toBeVisible();
  const mailto = await send.getAttribute('href');
  expect(mailto).toMatch(/^mailto:[^?]+\?subject=/);
  expect(decodeURIComponent(mailto || '')).toContain('Renewal options for both lifts');
  expect(decodeURIComponent(mailto || '')).toContain('included visit schedule');
  await expect(dialog).toContainText('TRISE will not send it automatically.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({ path: info.outputPath(`elevator-renewal-enquiry-${info.project.name}.png`) });
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
});

test('customer can search, filter and open elevator coverage across provider accounts', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(60_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  await page.goto('/#/coverage');
  await expect(page.getByRole('heading', { name: 'Care that goes further.', exact: true })).toBeVisible({ timeout: 20_000 });

  await page.locator('.coverage-search summary').click();
  const search = page.getByRole('searchbox', { name: 'Search coverage' });
  await search.fill('Standalone Lift 01');
  const matchingCards = page.locator('.coverage-grid .coverage-card');
  await expect(matchingCards.first()).toContainText('Standalone Lift 01');
  await expect(matchingCards).toHaveCount(2);
  expect(await matchingCards.evaluateAll((cards) => cards.every((card) => card.textContent?.includes('Standalone Lift 01')))).toBeTruthy();

  const status = page.getByRole('combobox', { name: 'Filter coverage status' });
  await status.selectOption('active');
  await expect(matchingCards.first()).toBeVisible();
  expect(await matchingCards.count()).toBeGreaterThan(0);
  await expect(search).toHaveValue('Standalone Lift 01');
  await status.selectOption('');
  await expect(matchingCards).toHaveCount(2);

  await matchingCards.first().focus();
  await matchingCards.first().press('Enter');
  await expect(page).toHaveURL(/#\/coverage\/(?:warranty|contract)\//);
  await expect(page.getByRole('heading', { name: /Your (?:warranty|maintenance agreement)/ })).toBeVisible();
  await expect(page.locator('.customer-coverage-detail-back')).toBeVisible();

  await page.locator('.customer-coverage-detail-back').click();
  await expect(page.getByRole('heading', { name: 'Care that goes further.', exact: true })).toBeVisible({ timeout: 20_000 });
  await page.locator('.coverage-search summary').click();
  await page.getByRole('searchbox', { name: 'Search coverage' }).fill('elevator-record-not-found-2026');
  await expect(page.getByText('No matches in the coverage loaded so far. Load more to check older records.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Load older coverage', exact: true }).click();
  await expect(page.getByText('No matches in the coverage loaded so far. Load more to check older records.', { exact: true })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search coverage' })).toHaveValue('elevator-record-not-found-2026');
  await expect(page.getByRole('button', { name: 'Load older coverage', exact: true })).toBeEnabled();
});

test('customer sees coverage loading and can recover from a temporary list failure', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(60_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  let failOnce = true;
  await page.route('**/api/v1/maintenance-contracts**', async (route) => {
    if (!failOnce) return route.continue();
    failOnce = false;
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'service_unavailable', message: 'Coverage could not be loaded. Try again.' }),
    });
  });
  await page.goto('/#/coverage');
  await expect(page.getByRole('heading', { name: 'Loading your service…', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'We couldn’t load this information.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('.coverage-grid .coverage-card').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Care that goes further.', exact: true })).toBeVisible({ timeout: 20_000 });
});

test('customer gets the empty state when no coverage is shared', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(60_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  for (const endpoint of ['warranties', 'maintenance-contracts']) {
    await page.route(`**/api/v1/${endpoint}**`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });
  }
  await page.goto('/#/coverage');
  await expect(page.getByRole('heading', { name: 'Care that goes further.', exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'A clean slate.', exact: true })).toBeVisible();
  await expect(page.getByText('No warranty or maintenance coverage is available yet.', { exact: true })).toBeVisible();
  await expect(page.locator('.coverage-grid')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Load more', exact: true })).toHaveCount(0);
});

test('elevator coverage stays within the viewport in light and dark themes', async ({ page }, info) => {
  test.skip(info.project.name !== 'customer-desktop', 'Run the viewport matrix once; it includes phone and tablet widths');
  test.setTimeout(60_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  await page.goto('/#/coverage');
  await expect(page.locator('.coverage-grid .coverage-card').first()).toBeVisible();

  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'Care that goes further.', exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
  }

  const darkToggle = page.getByRole('button', { name: 'Switch to dark theme', exact: true });
  if (await darkToggle.count()) await darkToggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  const headingHeight = await page.locator('.coverage-page h1').evaluate((element) => element.getBoundingClientRect().height);
  const subtitleHeight = await page.locator('.coverage-page .section-heading p').evaluate((element) => element.getBoundingClientRect().height);
  expect(headingHeight, 'coverage title wraps at phone width').toBeLessThan(42);
  expect(subtitleHeight, 'coverage subtitle wraps at phone width').toBeLessThan(26);
  await page.screenshot({ path: info.outputPath('elevator-coverage-mobile-dark.png') });

  const lightToggle = page.getByRole('button', { name: 'Switch to light theme', exact: true });
  if (await lightToggle.count()) await lightToggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';
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

  const providerSelect = page.getByRole('combobox', { name: 'Provider', exact: true });
  await expect(providerSelect).toBeVisible();
  await providerSelect.selectOption(providerId);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('trise-customer-provider'))).toBe(providerId);
  await page.goto('/#/coverage');
  await expect(page.getByRole('heading', { name: 'Warranty and AMC', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Maintenance contracts', exact: true })).toBeVisible();
  await expect(page.getByText('provider pricing, internal rules and audit identifiers are not exposed.', { exact: false })).toBeVisible();
  await expect(page.locator('.record-card').filter({ hasText: /Version/ }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('customer-safe-amc-coverage.png'), fullPage: true });
  await localSignOut(page);
});

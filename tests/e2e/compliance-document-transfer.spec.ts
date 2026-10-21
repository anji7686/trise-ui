import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'retain-on-failure', video: 'off' });

test('provider can authorize preview and download of its private evidence version', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.goto('/#/compliance');
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const providerSelect = page.locator('#account-provider');
  const seededProviderOption = providerSelect.locator('option', { hasText: 'TRISE Demo Solar Water Heater Services' });
  await expect(seededProviderOption).toHaveCount(1);
  const seededProviderId = await seededProviderOption.getAttribute('value');
  await providerSelect.selectOption(seededProviderId!);
  await expect(providerSelect).toHaveValue(seededProviderId!);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const navigation = page.getByRole('complementary', { name: 'Operations navigation' });
  if (!(await navigation.isVisible())) await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await navigation.getByText('Provider Settings', { exact: true }).click();
  await navigation.getByRole('button', { name: 'Provider compliance', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Compliance Center', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Documents', exact: true }).click();

  const row = page.locator('tr').filter({ hasText: 'synthetic-asset-approval.pdf' }).first();
  if (await row.count() === 0) {
    throw new Error('No seeded private document is available for transfer verification; configure the approved local private-storage fixture and seed synthetic evidence before running this check.');
  }
  await expect(row).toBeVisible();

  for (const action of ['Preview', 'Download']) {
    const transfer = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/documents/') && response.url().endsWith('/download'));
    await row.getByRole('button', { name: action, exact: true }).click();
    const response = await transfer;
    expect(response.status()).toBe(200);
    const payload = await response.json() as { url?: string; object_key?: string; expires_in?: number };
    expect(payload.url).toBeTruthy();
    expect(payload.expires_in).toBeGreaterThan(0);
    expect(payload.object_key).toBeUndefined();
  }

  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter((response) => response.status >= 500)).toEqual([]);
});

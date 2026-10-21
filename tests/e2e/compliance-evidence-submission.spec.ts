import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'retain-on-failure', video: 'off' });

test('provider uploads private evidence and opens the asset approvals workspace', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.goto('/#/compliance');
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const providerSelect = page.locator('#account-provider');
  const providerOption = providerSelect.locator('option', { hasText: 'TRISE Demo Solar Water Heater Services' });
  await expect(providerOption).toHaveCount(1);
  const providerId = await providerOption.getAttribute('value');
  await providerSelect.selectOption(providerId!);
  await expect(providerSelect).toHaveValue(providerId!);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const navigation = page.getByRole('complementary', { name: 'Operations navigation' });
  if (!(await navigation.isVisible())) await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await navigation.getByText('Provider Settings', { exact: true }).click();
  await navigation.getByRole('button', { name: 'Provider compliance', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Compliance Center', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Documents', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Upload document', exact: true })).toBeVisible();
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles('tests/e2e/fixtures/synthetic-asset-approval.pdf');
  const uploadResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/documents'));
  await page.getByRole('button', { name: 'Upload document', exact: true }).click();
  const created = await uploadResponse;
  if (created.status() !== 201) {
    const payload = await created.json().catch(() => ({})) as { code?: string; message?: string };
    throw new Error(`Private evidence upload is blocked by the configured storage service (${created.status()}): ${payload.code || 'unknown'} ${payload.message || 'unknown'}`);
  }
  await expect(page.getByText('synthetic-asset-approval.pdf', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('available', { exact: true }).first()).toBeVisible();

  await page.goto('/#/compliance/assets');
  await expect(page.getByRole('heading', { name: 'Asset approvals', exact: true })).toBeVisible();
  await expect(page.getByText('Demo solar water heater evidence fresh 2', { exact: true })).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

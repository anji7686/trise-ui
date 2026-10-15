import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'retain-on-failure', video: 'off' });

test('provider user can open the seeded asset compliance workflow', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.goto('/#/compliance');

  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const providerSelect = page.locator('#account-provider');
  await expect(providerSelect).toBeVisible();
  const seededProviderOption = providerSelect.locator('option', { hasText: 'TRISE Demo Solar Water Heater Services' });
  await expect(seededProviderOption).toHaveCount(1);
  const seededProviderId = await seededProviderOption.getAttribute('value');
  await providerSelect.selectOption(seededProviderId!);
  await expect(page.getByRole('button', { name: 'Open account menu', exact: true })).toContainText(seededProviderId!, { timeout: 15000 });
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('button', { name: 'Compliance', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Compliance Center', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Asset approvals/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Asset approvals', exact: true })).toBeVisible();
  await expect(page.getByText(/No provider-scoped assets are available|Authorized record|Provider asset/i).first()).toBeVisible({ timeout: 15000 });
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

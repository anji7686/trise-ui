import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'retain-on-failure', video: 'off' });

test('provider uploads private evidence and opens the asset approvals workspace', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.goto('/#/compliance');
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.locator('#account-provider').selectOption({ label: 'TRISE Demo Solar Water Heater Services' });
  await expect(page.getByRole('heading', { name: 'My compliance requests', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Documents', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Upload document', exact: true })).toBeVisible();
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles('tests/e2e/fixtures/synthetic-asset-approval.pdf');
  await page.getByRole('button', { name: 'Upload document', exact: true }).click();
  await expect(page.getByText('synthetic-asset-approval.pdf', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('available', { exact: true }).first()).toBeVisible();

  await page.goto('/#/compliance/assets');
  await expect(page.getByRole('heading', { name: 'Asset approvals', exact: true })).toBeVisible();
  await expect(page.getByText('Demo solar water heater evidence fresh 2', { exact: true })).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

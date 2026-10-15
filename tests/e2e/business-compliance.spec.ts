import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'retain-on-failure', video: 'off' });

test('Platform reviewer can open the synthetic Business compliance workspace', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/businesses');
  await expect(page.getByRole('heading', { name: 'Business directory', exact: true })).toBeVisible();

  const firstBusiness = page.getByRole('row').nth(1);
  await expect(firstBusiness).toBeVisible();
  await firstBusiness.locator('summary').click();
  await page.getByRole('button', { name: 'Open Business details', exact: true }).click();

  await expect(page.getByText('Legal identity', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('GST registrations', { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Documents', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload supporting document', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Upload supporting document', exact: true }).click();
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles('tests/e2e/fixtures/synthetic-asset-approval.pdf');
  const createResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/platform/businesses/') && response.url().endsWith('/documents'));
  await page.getByRole('button', { name: 'Upload document', exact: true }).click();
  const created = await createResponse;
  if (created.status() !== 201) {
    const payload = await created.json().catch(() => ({})) as { code?: string; message?: string };
    throw new Error(`Business document create failed (${created.status()}): ${payload.code || 'unknown'} ${payload.message || 'unknown'}`);
  }
  await expect(page.getByText('synthetic-asset-approval.pdf', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('General Supporting Evidence', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Not Scanned', { exact: true }).first()).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter((response) => response.status >= 500)).toEqual([]);
});

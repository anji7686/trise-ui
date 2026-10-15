import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test('Global Admin can inspect GST templates, imported drafts and readiness blockers', async ({ page, evidence }, testInfo) => {
  const failures: string[] = [];
  page.on('requestfailed', request => failures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`));
  page.on('response', response => { if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`); });

  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/taxes');
  await expect(page.getByRole('heading', { name: 'Tax Management', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'GST Templates', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'GST Templates', exact: true }).click();
  await expect(page.getByText('GST_18', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('tax-templates.png'), fullPage: true });

  await page.getByRole('button', { name: 'Create Draft', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Create tax rule draft', exact: true })).toBeVisible();
  await expect(page.getByLabel('Selected template')).toHaveValue('GST_18');
  await expect(page.getByLabel('Total GST %')).toHaveValue('18.0');
  await page.screenshot({ path: testInfo.outputPath('tax-gst-18-editor.png'), fullPage: true });

  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await expect(page.getByRole('button', { name: 'SAC_9983_TRISE_REVIEW', exact: true }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('tax-drafts.png'), fullPage: true });

  await page.getByRole('button', { name: 'Imports & Validation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Import history', exact: true })).toBeVisible();
  await expect(page.locator('.platform-provider-table tbody tr')).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('tax-imports.png'), fullPage: true });

  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await page.getByRole('button', { name: 'Submit Review', exact: true }).first().click();
  await expect(page.getByText(/verified legal source is required/i)).toBeVisible();
  expect(failures).toEqual([]);
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.failures).toEqual([]);
});

import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test('Platform billing exposes the guided invoice route and inline PDF preview', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/subscription-billing');
  await expect(page.getByRole('heading', { name: 'Billing & Payments', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'New invoice', exact: true }).click();
  await expect(page).toHaveURL(/#platform\/subscription-billing\/new$/);
  await expect(page.locator('.invoice-wizard')).toBeVisible();
  await expect(page.locator('.invoice-wizard-steps button')).toHaveCount(4);
  await expect(page.getByPlaceholder('Search by provider, Business or plan name')).toBeVisible();
  await page.locator('.invoice-subscription-choice').first().click();
  await page.getByRole('button', { name: 'Continue to recipient details', exact: true }).click();
  const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const dueAtValue = dueAt.toISOString().slice(0, 16);
  await page.locator('input[type="datetime-local"]').fill(dueAtValue);
  await page.getByRole('button', { name: 'Continue to charges', exact: true }).click();
  await page.getByRole('button', { name: 'Calculate server tax preview', exact: true }).click();
  await expect(page.getByText('Ready', { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Review invoice', exact: true }).click();
  await page.getByRole('button', { name: 'Issue invoice', exact: true }).click();

  await page.goto('/#platform/subscription-billing');
  const invoiceLink = page.getByRole('button', { name: 'View invoice', exact: true }).first();
  await expect(invoiceLink).toBeVisible();
  await invoiceLink.click();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Payments & Delivery', exact: true }).click();
  await page.locator('.invoice-tabs-panel').getByLabel('Payment transaction reference').fill(`BROWSER-TXN-${Date.now()}`);
  await page.getByRole('button', { name: 'Submit payment evidence', exact: true }).click();
  await expect(page.locator('.invoice-tabs-panel').getByText(/Evidence Submitted/)).toBeVisible();
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await page.getByLabel('Review reason').fill('Browser acceptance payment evidence review');
  await page.getByRole('button', { name: 'Confirm decision', exact: true }).click();
  await expect(page.locator('.invoice-tabs-panel').getByText(/Verified/)).toBeVisible();
  page.once('dialog', dialog => void dialog.accept());
  await page.locator('.invoice-tabs-panel').getByRole('button', { name: 'Publish invoice', exact: true }).click();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.locator('.invoice-tabs-panel').getByText(/Issued/)).toBeVisible();
  await page.getByRole('button', { name: 'PDF Preview', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View PDF', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View PDF', exact: true }).click();
  await expect(page.locator('.invoice-tabs-panel iframe[title^="PDF preview for "]')).toBeVisible({ timeout: 15000 });
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter((response) => response.status >= 500)).toEqual([]);
});

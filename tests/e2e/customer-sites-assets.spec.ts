import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';
import type { Page, TestInfo } from 'playwright/test';

test.use({ screenshot: 'on', trace: 'retain-on-failure', video: 'retain-on-failure' });

async function selectProvider(page: Page) {
  const trigger = page.getByRole('button', { name: 'Open account menu', exact: true });
  await trigger.click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  const provider = menu.getByRole('combobox', { name: 'Provider', exact: true });
  await expect.poll(() => provider.locator('option').count(), { timeout: 20_000 }).toBeGreaterThan(1);
  if (!(await provider.inputValue())) await provider.selectOption({ index: 1 });
  await trigger.click();
}

async function capture(page: Page, testInfo: TestInfo) {
  const screenshot = await page.screenshot({ fullPage: true, path: testInfo.outputPath('customers-sites-assets.png') });
  await testInfo.attach('customers-sites-assets', { body: screenshot, contentType: 'image/png' });
}

async function captureDialog(page: Page, testInfo: TestInfo, name: string) {
  const screenshot = await page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
}

test('Provider Admin Customers, Sites and Assets workspace uses scoped search and authorized forms', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('operations'), 'Provider Operations workflow runs only in Operations projects.');
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await selectProvider(page);
  const failures: string[] = [];
  page.on('response', response => {
    if (response.url().includes('/api/v1/') && response.status() >= 400) failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await page.goto(`${page.url().split('#')[0]}#customers`);
  await expect(page.getByRole('heading', { name: 'Customers, sites & assets', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sites & service locations', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Assets', exact: true })).toBeVisible();
  await expect(page.getByText(/Loading authorized (customers|sites|assets)…/)).toHaveCount(0, { timeout: 20_000 });
  const customerPane = page.locator('.customer-record-list').first();
  if (await customerPane.count()) {
    await expect(customerPane).toBeVisible();
    await expect.poll(() => customerPane.evaluate(element => {
      const style = getComputedStyle(element);
      return style.overflowY === 'auto' && style.maxHeight !== 'none';
    })).toBe(true);
  }

  for (const label of ['Search customers', 'Search service locations', 'Search assets']) {
    const search = page.getByRole('textbox', { name: label, exact: true });
    await search.fill('TRISE-feature-verification');
    await expect(page.getByText(/Loading authorized (customers|sites|assets)…/)).toHaveCount(0, { timeout: 20_000 });
    await search.fill('');
    await expect(page.getByText(/Loading authorized (customers|sites|assets)…/)).toHaveCount(0, { timeout: 20_000 });
  }

  await page.getByRole('button', { name: 'Add customer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add customer', exact: true })).toBeVisible();
  await captureDialog(page, testInfo, 'add-customer-dialog');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  const addSite = page.getByRole('button', { name: 'Add service location', exact: true });
  if (await addSite.isEnabled()) {
    await addSite.click();
    await expect(page.getByRole('heading', { name: 'Add service location', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /Location name/ })).toBeVisible();
    await captureDialog(page, testInfo, 'add-service-location-dialog');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  }

  const addAsset = page.getByRole('button', { name: 'Register asset', exact: true });
  if (await addAsset.isEnabled()) {
    await addAsset.click();
    await expect(page.getByRole('heading', { name: 'Register asset', exact: true })).toBeVisible();
    const definition = page.getByRole('combobox', { name: /Asset family \/ definition/ });
    await expect(definition).toBeVisible();
    if (await definition.locator('option').count() > 1) await definition.selectOption({ index: 1 });
    await expect(definition.locator('option:checked')).not.toContainText(/[0-9a-f]{8}-[0-9a-f-]{27}/i);
    await expect(page.getByRole('textbox', { name: /Asset name/ })).toBeVisible();
    await expect(page.getByText('ELEVATOR_LIFT', { exact: true })).toHaveCount(0);
    await captureDialog(page, testInfo, 'register-asset-dialog');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  }

  expect(failures, `Unexpected provider API failures: ${failures.join(', ')}`).toEqual([]);
  await capture(page, testInfo);
  await localSignOut(page);
});

import { expect, test } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('customer asset list and detail show real addresses and suppress fixture addresses', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(60_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));

  await page.goto('/#/assets');
  await expect(page.getByRole('heading', { name: 'My assets', exact: true })).toBeVisible();
  await expect(page.getByText(/continuous browser test address/i)).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Filter assets by place' })).not.toContainText(/continuous browser test address/i);
  await expect(page.getByText(/Loading visit details/)).toHaveCount(0);
  await expect(page.getByText('Visit details unavailable', { exact: true })).toHaveCount(0);
  await expect(page.locator('.customer-asset-card-top .status')).toHaveCount(15);
  await expect(page.getByText(/Checking coverage/)).toHaveCount(0);
  const activeCoverage = page.locator('.customer-asset-card-top .status.customer-asset-coverage-active').first();
  await expect(activeCoverage).toBeAttached();
  if (info.project.name === 'customer-desktop') {
    await expect(activeCoverage).toHaveCSS('color', 'rgb(36, 109, 73)');
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(activeCoverage).toHaveCSS('color', 'rgb(184, 240, 217)');
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
  }
  await page.screenshot({ path: info.outputPath('customer-assets-list.png'), fullPage: true });
  const firstAsset = page.locator('.customer-asset-card').first();
  await expect(firstAsset).toBeVisible();
  await firstAsset.click();

  await expect(page.getByText('Installed at', { exact: true })).toBeVisible();
  await expect(page.getByText(/continuous browser test address/i)).toHaveCount(0);
  await expect(page.getByText(/Checking coverage/)).toHaveCount(0);
  await expect(page.getByText('Loading', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('customer-asset-detail-address.png'), fullPage: true });
});

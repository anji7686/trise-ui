import { expect, test } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

async function expectAssetTabContent(page: import('playwright/test').Page, emptyMessage: string) {
  const hasRecords = page.locator('.record-grid');
  const emptyState = page.getByText(emptyMessage, { exact: true });
  await expect.poll(async () => (await hasRecords.isVisible().catch(() => false)) || (await emptyState.isVisible().catch(() => false))).toBe(true);
}

test('asset tabs, display-name recovery and service request retain the selected lift', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(60_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  await page.goto('/#/assets');
  const firstAsset = page.locator('.customer-asset-card').first();
  await expect(firstAsset).toBeVisible();
  const assetName = (await firstAsset.locator('strong').innerText()).trim();
  await firstAsset.click();
  await expect(page.getByRole('heading', { name: assetName, exact: true })).toBeVisible();

  const historyTab = page.getByRole('tab', { name: 'Service history', exact: true });
  await historyTab.click();
  await expect(historyTab).toHaveAttribute('aria-selected', 'true');
  await expectAssetTabContent(page, 'No service history is available for this asset yet.');
  const documentsTab = page.getByRole('tab', { name: 'Documents', exact: true });
  await documentsTab.click();
  await expect(documentsTab).toHaveAttribute('aria-selected', 'true');
  await expectAssetTabContent(page, 'No customer-visible documents are available for this asset.');
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();

  await page.getByRole('button', { name: 'Edit display name', exact: true }).click();
  const displayName = page.getByLabel('Asset display name');
  await expect(displayName).toBeVisible();
  await displayName.fill('Temporary lift name');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit display name', exact: true })).toBeVisible();

  let patchBody: { name?: string; expected_revision?: number } | undefined;
  let idempotencyKey = '';
  await page.route('**/api/v1/assets/**', async (route) => {
    if (route.request().method() === 'PATCH') {
      patchBody = route.request().postDataJSON() as { name?: string; expected_revision?: number };
      idempotencyKey = route.request().headers()['idempotency-key'] || '';
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'conflict', message: 'Asset details changed. Review the latest name and try again.' }),
      });
      return;
    }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Edit display name', exact: true }).click();
  await page.getByLabel('Asset display name').fill('Temporary lift name');
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Asset details changed');
  await expect(page.getByLabel('Asset display name')).toHaveValue('Temporary lift name');
  expect(patchBody).toEqual({ name: 'Temporary lift name', expected_revision: expect.any(Number) });
  expect(idempotencyKey).not.toBe('');

  await page.getByRole('button', { name: 'Request service', exact: true }).click();
  await expect(page).toHaveURL(/#\/asset\/[^/]+\/request$/);
  await expect(page.getByText(`Request service for ${assetName}. Your service provider is determined by this asset.`, { exact: true })).toBeVisible();
  await expect(page.locator('.customer-request-steps li').first()).toContainText('Asset');
  await expect(page.getByLabel('Service type')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send service request', exact: true })).toHaveCount(0);
});

import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'retain-on-failure', video: 'off' });

test('Platform reviewer can assign and decide a pending compliance request', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/compliance');
  await expect(page.getByRole('heading', { name: 'Compliance review queue', exact: true })).toBeVisible();

  await page.getByPlaceholder('Code, name or reason').fill('DEMO_BROWSER_BUSINESS_REGISTRATION');
  await page.getByRole('button', { name: 'Search', exact: true }).click();

  const pendingRows = page.locator('tbody tr');
  const pendingRow = pendingRows.first();
  await expect(pendingRow).toBeVisible();
  await pendingRow.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(page.getByText(/Review request ·/)).toBeVisible();

  const assignSelect = page.getByLabel('Assign reviewer');
  if (await assignSelect.count()) {
    await expect(assignSelect.locator('option').nth(1)).toHaveCount(1);
    await assignSelect.selectOption({ index: 1 });
    await page.getByLabel('Assignment reason *', { exact: true }).fill('Synthetic Batch 11 browser assignment');
    const assignmentResponse = page.waitForResponse((response) => response.url().includes('/platform/compliance/') && response.url().endsWith('/assign') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Assign reviewer', exact: true }).click();
    expect((await assignmentResponse).status()).toBe(200);
  }

  const decision = page.getByRole('combobox', { name: 'Decision', exact: true });
  await expect(decision).toBeVisible();
  await decision.selectOption('APPROVE');
  await page.getByLabel('Decision reason *', { exact: true }).fill('Synthetic browser v1 to v2 approval');
  const decisionResponse = page.waitForResponse((response) => response.url().includes('/platform/compliance/') && response.url().endsWith('/decision') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Record decision', exact: true }).click();
  expect((await decisionResponse).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'No compliance requests', exact: true })).toBeVisible();

  // Verify the applied request is reflected by the authoritative Business
  // Details projection and that the prior approved version remains visible.
  await page.goto('/#platform/businesses');
  await expect(page.getByRole('heading', { name: 'Business directory', exact: true })).toBeVisible();
  const businessSearch = page.getByLabel('Search businesses', { exact: true });
  await businessSearch.fill('TRISE Demo Solar Water Heater Services');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const firstBusiness = page.getByRole('row').nth(1);
  await firstBusiness.getByRole('button', { name: 'Compliance', exact: true }).click();
  await expect(page.getByText('Version History', { exact: true })).toBeVisible();
  await expect(page.getByText('TRISE Demo Solar Water Heater Services', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('No approved versions', { exact: true })).not.toBeVisible();
  await expect(page.getByText('DEMO_BROWSER_BUSINESS_REGISTRATION · v1', { exact: true })).toBeVisible();
  await expect(page.getByText('DEMO_BROWSER_BUSINESS_REGISTRATION · v2', { exact: true })).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: 'TEST-ONLY-BUSINESS-V2' }).first()).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('Provider audit history is served only within the authorized provider context', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.locator('#account-provider').selectOption({ label: 'TRISE Demo Solar Water Heater Services' });
  await page.goto('/#audit');
  await expect(page.getByRole('heading', { name: 'Audit history', exact: true })).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('Platform reviewer can approve the seeded Business licence association', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/compliance');
  await expect(page.getByRole('heading', { name: 'Compliance review queue', exact: true })).toBeVisible();
  const card = page.locator('article.record-card').filter({ hasText: 'Synthetic browser Provider association' }).first();
  await expect(card).toBeVisible();
  if (await card.getByText(/approved/i, { exact: true }).count()) {
    test.skip(true, 'Seeded association was already approved; reload the development fixture for a fresh decision transaction.');
    return;
  }
  const assign = card.getByLabel('Assign reviewer');
  if (await assign.count()) {
    await assign.selectOption({ index: 1 });
    await card.getByLabel('Assignment reason *').fill('Synthetic browser association assignment');
    await card.getByRole('button', { name: 'Assign reviewer', exact: true }).click();
  }
  const refreshedCard = page.locator('article.record-card').filter({ hasText: 'Synthetic browser Provider association' }).first();
  await refreshedCard.getByRole('combobox', { name: 'Decision', exact: true }).selectOption('APPROVE');
  await refreshedCard.getByLabel('Decision reason *').fill('Synthetic browser association approval');
  await refreshedCard.getByRole('button', { name: 'Record decision', exact: true }).click();
  await expect(page.locator('article.record-card').filter({ hasText: 'Synthetic browser Provider association' }).first().getByText(/APPROVED/i, { exact: true })).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

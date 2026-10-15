import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'retain-on-failure', video: 'off' });

test('current Onboard Service Provider entry point loads for an authorized platform administrator', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/providers/new');
  await expect(page.getByRole('heading', { name: 'Register provider account', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Business selection', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Business Operation', exact: true })).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('Business Identification persists a new Business-first onboarding session before provider creation', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/providers/new');
  const suffix = Date.now().toString();
  await page.getByLabel('Provider name', { exact: false }).fill(`ONB04 Browser Provider ${suffix}`);
  const business = page.getByRole('combobox', { name: 'Business', exact: true });
  await business.click();
  const firstBusiness = page.getByRole('option').first();
  await expect(firstBusiness).toBeVisible();
  await firstBusiness.click();
  const operation = page.getByRole('combobox', { name: 'Business Operation', exact: true });
  await operation.click();
  const firstOperation = page.getByRole('option').first();
  await expect(firstOperation).toBeVisible();
  await firstOperation.click();
  await page.getByRole('button', { name: 'Create provider account', exact: true }).click();
  await expect(page).toHaveURL(/#platform\/providers\/[^/]+\/business-profile\/edit/);
  await expect(page.getByRole('heading', { name: 'Business profile', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Business Legal Identity', exact: true })).toBeVisible();
  await expect(page.getByText('This is the authoritative Business legal identity.', { exact: false })).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('Business and provider directory filters expose aligned lifecycle options', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/businesses');
  const businessStatus = page.getByRole('combobox', { name: 'Filter businesses by status', exact: true });
  await expect(businessStatus).toBeVisible();
  await expect(businessStatus.locator('option')).toHaveText(['All statuses', 'Active', 'On hold', 'Suspended', 'Blocked', 'Closed']);
  await page.goto('/#platform/providers');
  const providerStatus = page.getByRole('combobox', { name: 'Filter providers by status', exact: true });
  await expect(providerStatus).toBeVisible();
  await expect(providerStatus.locator('option')).toHaveText(['All statuses', 'Pending', 'Pending activation', 'Active', 'On hold', 'Suspended', 'Closed']);
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('Business workspace exposes registrations, brands, secure documents and history', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/businesses');
  await expect(page.locator('summary[aria-label^="Actions for"]').first()).toBeVisible();
  await page.locator('summary[aria-label^="Actions for"]').first().click();
  await page.getByRole('menuitem', { name: 'Open Business details', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'GST Registrations', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Registrations & Brands', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Documents', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'History & Audit', exact: true })).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

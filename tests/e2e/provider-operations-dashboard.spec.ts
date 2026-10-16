import { test, expect } from './fixtures';
import { localSignIn, localSignOut } from './local-auth';

test.use({ trace: 'on-first-retry', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('provider operations overview renders the provider-scoped elevator dashboard', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');

  await localSignIn(page, 'liftriseorg@gmail.com');
  const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await menu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('complementary', { name: 'Operations navigation' }).getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.getByText('Provider-scoped PostgreSQL dashboard', { exact: true })).toBeVisible();
  await expect(page.getByText('Leads', { exact: true })).toBeVisible();
  await expect(page.getByText('Installation projects', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Provider notifications', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Elevator event catalogue', exact: true })).toBeVisible();
  await expect(page.getByText('Platform subscription billing', { exact: true })).toHaveCount(0);
  await localSignOut(page);
});

import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';

test.use({ trace: 'off', video: 'off', screenshot: 'off', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('Provider Administrator receives all provider workspace access without Platform Administration', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  const session = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  expect(session.user.attributes.platform_admin).not.toBe(true);
  const provider = session.user.attributes.provider_capabilities.find((entry: { display_name: string; provider_id: string; capabilities: string[] }) =>
    entry.display_name === 'Lift Rise Elevators — Demo Operations');
  expect(provider).toBeTruthy();
  expect(provider!.capabilities).toEqual(expect.arrayContaining([
    'customers', 'onboarding', 'configuration', 'business_profile', 'subscriptions', 'requests',
    'bookings', 'jobs', 'workforce', 'audit', 'team_access', 'compliance', 'sales_marketing',
    'quotations', 'projects'
  ]));

  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  const providerSelect = menu.getByRole('combobox', { name: 'Provider', exact: true });
  await providerSelect.selectOption(provider!.provider_id);
  await expect(providerSelect).toHaveValue(provider!.provider_id);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('trise-operations-provider'))).toBe(provider!.provider_id);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();

  let navigation = page.getByRole('complementary', { name: 'Operations navigation' });
  if (!await navigation.getByRole('button', { name: 'Overview', exact: true }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    navigation = page.getByRole('complementary', { name: 'Operations navigation' });
  }
  for (const label of ['Overview', 'Leads & Surveys', 'Quotations', 'Projects & Installation', 'Customers, Sites & Assets']) {
    await expect(navigation.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
  const openSettingsNavigation = async () => {
    if (!await navigation.isVisible().catch(() => false)) await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await expect(navigation).toBeVisible();
    const settings = navigation.getByText('Administration', { exact: true });
    const expanded = await settings.evaluate((node) => node.closest('details')?.open ?? false);
    if (!expanded) await settings.click();
  };
  await openSettingsNavigation();
  for (const label of ['Business Profile', 'Team & Roles']) await expect(navigation.getByRole('button', { name: label, exact: true })).toBeVisible();
  await navigation.getByRole('button', { name: 'Business Profile', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Business profile', exact: true })).toBeVisible();
  await openSettingsNavigation();
  await navigation.getByRole('button', { name: 'Team & Roles', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Team & Access', exact: true })).toBeVisible();
  await page.goto('/#/platform/roles');
  await expect(page.getByRole('status').filter({ hasText: 'Platform administration is restricted' })).toBeVisible();
  await localSignOut(page);
});

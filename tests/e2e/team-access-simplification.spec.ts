import { test, expect } from './fixtures';
import { localSignIn, localSignOut, configuredAccount } from './local-auth';

test.use({ trace: 'off', video: 'off', screenshot: 'off', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('provider Team & Access is simple, truthful and responsive', async ({ page, evidence }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(60_000);
  const session = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const provider = session.user.attributes.provider_capabilities.find((entry: { display_name: string; capabilities: string[] }) =>
    entry.display_name.startsWith('Lift Rise Elevators') && entry.capabilities.includes('team_access'));
  expect(provider).toBeTruthy();
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const select = page.getByRole('dialog', { name: 'Account and workspace menu' }).getByRole('combobox', { name: 'Provider', exact: true });
  if (await select.inputValue() !== provider.provider_id) {
    const ready = page.waitForEvent('domcontentloaded');
    await select.selectOption(provider.provider_id);
    await ready;
  } else {
    await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  }
  await page.getByRole('complementary', { name: 'Operations navigation' }).getByRole('button', { name: 'Team & Access' }).click();
  await expect(page.getByRole('heading', { name: 'Team & Access' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Member' })).toBeVisible();
  await expect(page.getByText('Provider Administrator · membership access').first()).toBeVisible();
  await info.attach('members', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Available Roles' }).click();
  await expect(page.getByText('Loading roles…')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Platform Default Roles', exact: true })).toBeVisible();
  const defaultRolesSection = page.locator('section').filter({ hasText: 'Platform Default Roles' }).first();
  expect(await defaultRolesSection.getByRole('row').count()).toBeGreaterThan(1);
  await expect(page.getByText('No custom roles available.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New Custom Role' })).toHaveCount(0);
  await expect(page.getByText(/Browser verification default operations-/)).toHaveCount(0);
  await expect(page.getByText(/Browser verification support operations-/)).toHaveCount(0);
  await info.attach('available-roles', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Add Member' }).click();
  await expect(page.getByRole('dialog', { name: 'Add Member' })).toBeVisible();
  await expect(page.getByText('Loading available roles…')).toHaveCount(0);
  await expect(page.getByText('No assignable roles are available yet. Platform Administration must publish an eligible role first.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create Invitation' })).toBeDisabled();
  await info.attach('add-member', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.getByRole('dialog', { name: 'Add Member' }).getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Invitations', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Team invitations' })).toBeVisible();
  await info.attach('invitations', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await localSignOut(page);
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(row => row.status >= 500)).toEqual([]);
});

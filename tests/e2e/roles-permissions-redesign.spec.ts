import { test, expect } from './fixtures';
import { localSignIn, configuredAccount } from './local-auth';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

test.describe.configure({ mode: 'serial' });

test('redesigned platform roles directory is compact, responsive and server filtered', async ({ page, evidence }, testInfo) => {
  const evidenceDir = resolve('docs/evidence/roles-permissions-redesign-20261012');
  mkdirSync(evidenceDir, { recursive: true });
  async function capture(name: string, fullPage = true) { const path = resolve(evidenceDir, `${name}.png`); await page.screenshot({ path, fullPage }); await testInfo.attach(name, { path, contentType: 'image/png' }); }
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  const badResponses: Array<{ url: string; status: number }> = [];
  page.on('response', (response) => { if (response.status() >= 500) badResponses.push({ url: response.url(), status: response.status() }); });
  await page.goto('/#platform/roles');
  await expect(page.getByRole('heading', { name: 'Roles & Permissions', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Roles and permissions sections' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New Role', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Role', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Status' })).toHaveValue('');

  const viewports = [
    ['1600', 1600, 1000], ['1440', 1440, 900], ['1024', 1024, 900], ['768', 768, 1024], ['390', 390, 844]
  ] as const;
  for (const [name, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole('button', { name: 'Default Roles', exact: true })).toBeVisible();
    expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth + 1)).toBe(true);
    await capture(`default-roles-${name}`);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  const searchResponse = page.waitForResponse((response) => response.url().includes('/platform/access/roles?') && new URL(response.url()).searchParams.get('q') === 'Provider Administrator');
  await page.getByRole('searchbox', { name: 'Search Roles' }).fill('Provider Administrator');
  await page.getByRole('button', { name: 'Apply Filters', exact: true }).click();
  expect((await searchResponse).status()).toBe(200);
  await expect(page.getByText('PROVIDER_ADMIN', { exact: true })).toBeVisible();
  expect(page.url()).toContain('q=Provider+Administrator');

  await page.getByRole('button', { name: 'Provider Role Settings', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Custom Role Policy', exact: true })).toBeVisible();
  const policyRow = page.locator('.roles-tab-panel tbody tr').first();
  if (await policyRow.count()) {
    await policyRow.getByRole('button', { name: /custom roles/i }).click();
    const confirmation = page.getByRole('dialog', { name: /custom role policy/i });
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByRole('button', { name: /custom roles/i })).toBeVisible();
    await capture('provider-custom-role-policy-confirmation-1440', false);
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(confirmation).toHaveCount(0);
  }
  await capture('provider-role-settings-1440');

  await page.getByRole('button', { name: 'Permission Delegation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Provider Permission Delegation', exact: true })).toBeVisible();
  await expect(page.getByText('Service Operations', { exact: true })).toBeVisible();
  await expect(page.getByText('Protected', { exact: true }).first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth + 1)).toBe(true);
  await capture('permission-delegation-390');

  expect(badResponses).toEqual([]);
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.failures).toEqual([]);
});

test('role editor uses a responsive right drawer with persistent actions', async ({ page, evidence }) => {
  const evidenceDir = resolve('docs/evidence/roles-permissions-redesign-20261012');
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/roles');
  await expect(page.getByRole('heading', { name: 'Roles & Permissions', exact: true })).toBeVisible();
  const firstRole = page.locator('.roles-directory tbody tr').first();
  await firstRole.locator('.admin-action-menu summary').click();
  await page.getByRole('button', { name: 'Manage Permissions', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /role editor/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Permissions', exact: true })).toHaveClass(/active/);
  await expect(page.getByRole('button', { name: 'Save Draft', exact: true })).toBeVisible();
  await page.screenshot({ path: resolve(evidenceDir, 'edit-role-drawer-1440.png'), fullPage: true });
  await page.getByRole('button', { name: 'Details', exact: true }).click();
  await expect(page.getByLabel('Role Name', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close role editor', exact: true }).click();
  await page.getByRole('button', { name: 'New Role', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /New Role role editor/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Details', exact: true })).toHaveClass(/active/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: resolve(evidenceDir, 'new-role-drawer-390.png'), fullPage: true });
  await expect(page.getByRole('button', { name: 'Save Draft', exact: true })).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.failures).toEqual([]);
});

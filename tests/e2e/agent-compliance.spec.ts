import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'retain-on-failure', video: 'off' });

test.describe('Agent credential compliance', () => {

  test('provider user can open the real Agent credential compliance workspace', async ({ page, evidence }) => {
    await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
    await page.goto('/#/compliance');

    await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
    const providerSelect = page.locator('#account-provider');
    await expect(providerSelect).toBeVisible();
    await expect(providerSelect.locator('option')).not.toHaveCount(1);
    await providerSelect.selectOption({ index: 1 });
    await expect(page.getByRole('button', { name: 'Open account menu', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
    await page.getByRole('button', { name: 'Compliance', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Compliance Center', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Requirements', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'My Requests', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Documents', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agents', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Requirements', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Requirements', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Agent certifications/ }).first()).toBeVisible();
    await page.getByRole('button', { name: /Agent certifications/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Agent certifications', exact: true })).toBeVisible();
    expect(evidence.exceptions).toEqual([]);
    expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
  });
});

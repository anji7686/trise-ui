import { test, expect } from './fixtures';
import type { Page } from 'playwright/test';
import { approvedLocalAccounts, paceLocalSignIn } from './local-auth';

async function revealSignOut(page: Page, operations: boolean) {
  if (operations) await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
}

// Traces can contain request bodies; credential tests capture sanitized diagnostics
// and screenshots only after the credential fields are gone.
test.use({ trace: 'off', video: 'off', screenshot: 'off' });

test('local email selection authenticates a real user and logout restores the form', async ({ page, evidence }, testInfo) => {
  const account = approvedLocalAccounts()[0];
  if (!account) throw new Error('No approved local test identity is configured.');
  await page.goto('/');
  const emailField = page.getByRole('combobox', { name: 'Test email', exact: true });
  await expect(emailField).toBeVisible();
  const quickSignIn = await emailField.evaluate((element) => element.tagName === 'SELECT');
  const submit = page.getByRole('button', { name: quickSignIn ? 'Sign in as selected account' : 'Sign in locally', exact: true });
  await submit.click();
  expect(await emailField.evaluate((node: HTMLInputElement) => node.validity.valueMissing)).toBe(true);
  if (quickSignIn) {
    await emailField.selectOption((await page.locator('select[name="email"] option').nth(1).getAttribute('value')) || '');
  } else {
    await emailField.fill(account.email);
    await paceLocalSignIn();
    await page.getByLabel('Local secret', { exact: true }).fill(account.secret);
  }
  await submit.click();
  await revealSignOut(page, testInfo.project.name.startsWith('operations'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await testInfo.attach('authenticated-local-user', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.reload();
  await revealSignOut(page, testInfo.project.name.startsWith('operations'));
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Test email', exact: true })).toBeVisible();
  if (quickSignIn) await expect(page.getByRole('button', { name: 'Sign in as selected account', exact: true })).toBeVisible();
  else await expect(page.getByLabel('Local secret', { exact: true })).toHaveValue('');
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('password-based local sign-in remains available when quick sign-in is disabled', async ({ page }, testInfo) => {
  await page.goto('/');
  const emailField = page.getByRole('combobox', { name: 'Test email', exact: true });
  await expect(emailField).toBeVisible();
  test.skip(await emailField.evaluate((element) => element.tagName === 'SELECT'), 'Quick local account selection is enabled for this local environment.');
  const account = approvedLocalAccounts()[0];
  if (!account) throw new Error('No approved local test identity is configured.');
  await emailField.fill(account.email);
  await page.getByLabel('Automatically sign in when my email and local secret are ready', { exact: true }).check();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);
  await paceLocalSignIn();
  await page.getByLabel('Local secret', { exact: true }).fill(account.secret);
  await revealSignOut(page, testInfo.project.name.startsWith('operations'));
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Test email', exact: true })).toBeVisible();
});

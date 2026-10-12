import { readFileSync } from 'node:fs';
import { expect, type Page } from 'playwright/test';

export function approvedLocalAccounts() {
  return readFileSync(new URL('../../../trise-api/.env.development-sign-in-secrets.txt', import.meta.url), 'utf8').trim().split('\n').map(line => {
    const [email, secret] = line.split(': '); return { email, secret };
  });
}

export async function paceLocalSignIn() {
  // Sequential acceptance runs respect the server's 10 attempts/minute limit.
  // This delay deliberately paces authentication; it is not a rendering wait.
  await new Promise(resolve => setTimeout(resolve, 7000));
}

export async function localSignIn(page: Page, email: string) {
  const account = approvedLocalAccounts().find(item => item.email === email);
  if (!account) throw new Error('Account is not on the approved local list');
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Test email', exact: true }).selectOption(email);
  await paceLocalSignIn();
  await page.getByLabel('Local secret', { exact: true }).fill(account.secret);
  const signedIn = page.waitForResponse(response => response.url().endsWith('/session/development') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Sign in locally', exact: true }).click();
  const response = await signedIn;
  expect(response.status()).toBe(200);
  const { user, access_token: accessToken } = await response.json();
  await expect(page.getByRole('button', { name: 'Open account menu', exact: true })).toBeVisible();
  return { user, accessToken: accessToken as string };
}

export async function localSignOut(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  if (!await dialog.isVisible()) await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await dialog.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Test email', exact: true })).toBeVisible();
}

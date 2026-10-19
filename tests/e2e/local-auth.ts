import { readFileSync } from 'node:fs';
import { expect, type Page } from 'playwright/test';
import { e2eEnv } from './e2e-config';

export type E2EPersona = 'GLOBAL_ADMIN' | 'PLATFORM_REVIEWER' | 'PROVIDER_ADMIN' | 'PROVIDER_REVIEWER' | 'OPERATOR' | 'CUSTOMER' | 'AGENT' | 'MARKETING_EXECUTIVE' | 'MARKETING_MANAGER' | 'ASSET_ADMINISTRATOR';

export function configuredAccount(persona: E2EPersona) {
  const variable = `TRISE_E2E_${persona}_EMAIL`;
  const email = e2eEnv(variable);
  if (!email) throw new Error(`Missing ${variable}. Copy .env.e2e.example to .env.e2e.local and configure this approved local test identity before authenticated verification.`);
  return email;
}

export function approvedLocalAccounts() {
  const source = new URL('../../../trise-api/.env.development-sign-in-secrets.txt', import.meta.url);
  let contents: string;
  try { contents = readFileSync(source, 'utf8').trim(); } catch {
    throw new Error('Approved local sign-in secrets are unavailable. Provide the private trise-api/.env.development-sign-in-secrets.txt file; never add credentials to trise-ui.');
  }
  return contents.split('\n').filter(Boolean).map(line => {
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
  await page.locator('select[name="email"], input[name="email"]').first().waitFor({ state: 'visible' });
  const quickEmail = page.locator('select[name="email"]');
  const credentialEmail = page.locator('input[name="email"]');
  const quickMode = await quickEmail.isVisible().catch(() => false);
  if (quickMode) {
    await quickEmail.selectOption(email);
  } else {
    await credentialEmail.fill(email);
    await page.locator('input[name="secret"]').fill(account.secret);
  }
  await paceLocalSignIn();
  const signedIn = page.waitForResponse(response => response.url().includes('/session/development') && response.request().method() === 'POST');
  await page.getByRole('button', { name: quickMode ? 'Sign in as selected account' : 'Sign in locally', exact: true }).click();
  const response = await signedIn;
  expect(response.status()).toBe(200);
  const { user, access_token: accessToken } = await response.json();
  const accountMenu = page.getByRole('button', { name: 'Open account menu', exact: true });
  if (await accountMenu.isVisible().catch(() => false)) {
    await expect(accountMenu).toBeVisible();
  } else {
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  }
  return { user, accessToken: accessToken as string };
}

export async function localSignOut(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  const accountMenu = page.getByRole('button', { name: 'Open account menu', exact: true });
  if (await accountMenu.isVisible().catch(() => false)) {
    if (!await dialog.isVisible()) await accountMenu.click();
    await dialog.getByRole('button', { name: 'Sign out', exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  }
  await expect(page.getByRole('combobox', { name: 'Test email', exact: true })).toBeVisible();
}

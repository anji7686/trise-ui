import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
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
  const configuredPath = e2eEnv('TRISE_E2E_LOCAL_SECRETS_FILE');
  const source = configuredPath ? pathToFileURL(configuredPath) : new URL('../../../trise-api/.env.development-sign-in-secrets.txt', import.meta.url);
  let contents: string;
  try { contents = readFileSync(source, 'utf8').trim(); } catch {
    throw new Error('Approved local sign-in secrets are unavailable. Provide the private trise-api/.env.development-sign-in-secrets.txt file; never add credentials to trise-ui.');
  }
  return contents.split('\n').filter(Boolean).map(line => {
    const [email, secret] = line.split(': '); return { email, secret };
  });
}

export async function paceLocalSignIn() {
  // Keep parallel viewport projects below the development endpoint's
  // 10-attempts/minute limit. This is authentication pacing, not a rendering
  // wait, and keeps role-regression evidence deterministic.
  await new Promise(resolve => setTimeout(resolve, 15_000));
}

export async function localSignIn(page: Page, email: string) {
  const account = approvedLocalAccounts().find(item => item.email === email);
  if (!account) throw new Error('Account is not on the approved local list');
  await page.goto('/');
  const localSignInSummary = page.locator('details.development-sign-in > summary');
  await localSignInSummary.waitFor({ state: 'visible', timeout: 15_000 });
  const localSignInDetails = page.locator('details.development-sign-in');
  if (!await localSignInDetails.evaluate(element => (element as HTMLDetailsElement).open)) await localSignInSummary.click();
  await expect(localSignInDetails).toHaveAttribute('open', '');
  const quickEmail = page.locator('select[name="email"]');
  const credentialEmail = page.locator('input[name="email"]');
  await Promise.any([quickEmail.waitFor({ state: 'visible' }), credentialEmail.waitFor({ state: 'visible' })]);
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
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 15_000 });
  return { user, accessToken: accessToken as string };
}

export async function localSignOut(page: Page) {
  const closeMenu = page.getByRole('button', { name: 'Close menu', exact: true });
  if (await closeMenu.isVisible().catch(() => false)) await closeMenu.click();
  const dialog = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  const accountMenu = page.locator('[aria-label="Open account menu"], [aria-label="Open profile menu"]');
  if (await accountMenu.isVisible().catch(() => false) && !await dialog.isVisible()) await accountMenu.click();
  const menu = await dialog.isVisible().catch(() => false) ? dialog : page;
  const signOutAction = menu.getByRole('button', { name: /^(?:Sign out|Logout)$/ }).first();
  if (await signOutAction.isVisible().catch(() => false)) {
    await signOutAction.click();
  } else {
    // The customer mobile shell keeps account actions under Profile rather
    // than placing a profile menu in the compact header.
    await page.goto('/#/profile');
    await page.getByRole('button', { name: /^Sign out$/ }).click();
  }
  await expect(page.locator('details.development-sign-in > summary')).toBeVisible({ timeout: 15_000 });
}

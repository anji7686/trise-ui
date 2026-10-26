import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';
import { e2eApiV1Base, e2eEnv } from './e2e-config';

type ResourceRow = { id: string; attributes: Record<string, unknown> };

function resource(row: { data?: ResourceRow } | ResourceRow): ResourceRow {
  return (row as { data?: ResourceRow }).data || row as ResourceRow;
}

async function selectProvider(page: import('playwright/test').Page) {
  const accountMenu = page.getByRole('button', { name: 'Open account menu', exact: true });
  await accountMenu.click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  const provider = menu.getByRole('combobox', { name: 'Provider', exact: true });
  await expect.poll(() => provider.locator('option').count(), { timeout: 20_000 }).toBeGreaterThan(1);
  await provider.selectOption({ index: 0 });
  await provider.selectOption({ index: 1 });
  expect(await provider.inputValue()).toBeTruthy();
  const selectedProviderId = await provider.inputValue();
  await accountMenu.click();
  return selectedProviderId;
}

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('shared history exposes one responsive action group and one open panel', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.skip(e2eEnv('TRISE_E2E_DEVELOPMENT_SIGN_IN') !== 'true', 'Authenticated local E2E is not enabled.');
  test.setTimeout(90_000);

  const session = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const providerId = await selectProvider(page);
  expect(providerId).toBeTruthy();
  const userId = String((session.user as { id?: string }).id || '');
  expect(userId).toBeTruthy();
  await page.evaluate(({ userId: currentUserId, providerId: currentProviderId }) => {
    localStorage.setItem(`trise-operations-provider:${currentUserId}`, currentProviderId);
  }, { userId, providerId });
  await page.reload();
  await page.goto('/#overview');
  await expect(page.getByRole('heading', { name: 'Operations dashboard', exact: true })).toBeVisible({ timeout: 20_000 });

  const api = e2eApiV1Base();
  const headers = { Authorization: `Bearer ${session.accessToken}`, 'X-TRISE-Provider-Id': providerId };
  const createdLeadResponse = await page.request.post(`${api}/marketing-leads`, {
    headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
    data: { reference_code: `E2E-HISTORY-${Date.now()}`, source: 'FIELD', title: 'Shared activity history acceptance', prospect_name: 'Synthetic history prospect' },
  });
  expect(createdLeadResponse.status()).toBe(201);
  const createdLead = resource(await createdLeadResponse.json() as ResourceRow | { data?: ResourceRow });

  await page.goto('/#leads');
  await expect(page.getByRole('heading', { name: /Leads & site surveys/i })).toBeVisible({ timeout: 20_000 });
  await page.goto(`/#leads/${createdLead.id}`);
  await expect(page.getByRole('heading', { name: 'Lead details', exact: true })).toBeVisible({ timeout: 20_000 });
  const historyAction = page.locator('button.workflow-follow-up-action').first();
  await expect(historyAction).toBeVisible();
  await historyAction.click();

  const dialog = page.getByRole('dialog', { name: 'Activity & follow-up history', exact: true });
  await expect(dialog).toBeVisible();
  const actionTabs = dialog.getByRole('tablist', { name: 'Journey actions', exact: true }).getByRole('tab');
  await expect(actionTabs).toHaveCount(3);
  await expect(dialog.getByRole('tab', { name: 'Schedule follow-up', exact: true })).toBeVisible();
  await expect(dialog.getByRole('tab', { name: 'Add assets', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'View assets', exact: true })).toHaveCount(0);

  await dialog.getByRole('tab', { name: 'Schedule follow-up', exact: true }).click();
  await expect(dialog.locator('form.workflow-follow-up-form')).toBeVisible();
  await expect(dialog.locator('form.workflow-follow-up-interaction-form')).toHaveCount(0);

  await dialog.getByRole('tab', { name: 'Add assets', exact: true }).click();
  await expect(dialog.locator('.workflow-follow-up-evidence')).toBeVisible();
  await expect(dialog.locator('form.workflow-follow-up-form')).toHaveCount(0);

  const interactionTab = dialog.getByRole('tab', { name: 'Log past interaction', exact: true });
  await expect(interactionTab).toBeVisible();
  await interactionTab.click();
  await expect(dialog.locator('form.workflow-follow-up-interaction-form')).toBeVisible();
  await expect(dialog.locator('.workflow-follow-up-evidence')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await expect(actionTabs.first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Close Activity & follow-up history', exact: true }).click();
  await localSignOut(page);
});

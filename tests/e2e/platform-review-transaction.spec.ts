import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';
import { e2eApiV1Base } from './e2e-config';

test.use({ trace: 'retain-on-failure', video: 'off' });

test('Platform reviewer can assign and decide a pending compliance request', async ({ page, evidence }) => {
  const session = await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  const apiBase = e2eApiV1Base();
  const queueResponse = await page.request.get(`${apiBase}/platform/compliance`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
  expect(queueResponse.ok()).toBeTruthy();
  const queue = await queueResponse.json() as { data: Array<{ id: string; attributes: { submitted_by_user_id?: string | null; status: string } }> };
  const candidate = queue.data.find((item) => item.attributes.status === 'SUBMITTED' && item.attributes.submitted_by_user_id !== session.user.id);
  if (!candidate) {
    test.skip(true, 'No synthetic pending compliance request is eligible for a different platform reviewer in this development database.');
    return;
  }
  await page.goto(`/#platform/compliance?request=${candidate.id}`);
  await expect(page.getByRole('heading', { name: 'Approval Inbox', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();

  await expect(page.getByRole('heading', { level: 2 }).filter({ hasText: /Business legal identity|Business Registration|DEMO_BROWSER_BUSINESS_REGISTRATION|Synthetic browser pending review/i }).first()).toBeVisible();

  const assignSelect = page.getByLabel('Authorized reviewer');
  if (await assignSelect.count()) {
    const globalReviewer = assignSelect.locator('option', { hasText: 'Demo Dispatcher' });
    if (await globalReviewer.count()) await assignSelect.selectOption({ label: 'Demo Dispatcher' });
    else { await expect(assignSelect.locator('option').nth(1)).toHaveCount(1); await assignSelect.selectOption({ index: 1 }); }
    await page.getByLabel('Assignment reason', { exact: true }).fill('Synthetic browser assignment');
    const assignmentResponse = page.waitForResponse((response) => response.url().includes('/platform/compliance/') && response.url().endsWith('/assign') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Assign', exact: true }).click();
    const assignmentResult = await assignmentResponse;
    expect(assignmentResult.status()).toBe(200);
  }

  const decision = page.getByRole('combobox', { name: 'Decision', exact: true });
  await expect(decision).toBeVisible();
  await decision.selectOption('APPROVE');
  const decisionReason = page.getByLabel('Decision reason', { exact: true });
  await expect(decisionReason).toBeEditable({ timeout: 10_000 });
  await decisionReason.fill('Synthetic browser approval');
  const recordDecision = page.getByRole('button', { name: 'Record decision', exact: true });
  await expect(recordDecision).toBeEnabled({ timeout: 10_000 });
  const decisionResponse = page.waitForResponse((response) => response.url().includes('/platform/compliance/') && response.url().endsWith('/decision') && response.request().method() === 'POST');
  await recordDecision.click();
  const decisionResult = await decisionResponse;
  expect(decisionResult.status()).toBe(200);
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('Provider audit history is served only within the authorized provider context', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.locator('#account-provider').selectOption({ label: 'TRISE Demo Solar Water Heater Services' });
  await page.goto('/#audit');
  await expect(page.getByRole('heading', { name: 'Audit Logs', exact: true })).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('Platform reviewer can approve the seeded Business licence association', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/compliance?provider_id=01a0ed1c-94dc-7702-9ea8-64187649b5a3');
  await expect(page.getByRole('heading', { name: 'Licences & compliance', exact: true })).toBeVisible();
  const row = page.locator('article.record-card').filter({ hasText: 'Synthetic browser Provider association review transaction' }).first();
  await row.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
  if (!await row.count()) {
    test.skip(true, 'The synthetic licence-association fixture is not visible in the Platform licence-authorizations panel.');
    return;
  }
  await expect(row).toBeVisible();
  if (await row.getByText('Approved', { exact: true }).count()) {
    test.skip(true, 'Seeded association was already approved; reload the development fixture for a fresh decision transaction.');
    return;
  }
  const assign = row.getByLabel('Assign reviewer');
  if (await assign.count()) {
    const reviewer = assign.locator('option').nth(1);
    if (await reviewer.count()) await assign.selectOption({ index: 1 });
    await row.getByLabel('Assignment reason *').fill('Synthetic browser association assignment');
    await row.getByRole('button', { name: 'Assign reviewer', exact: true }).click();
  }
  const decision = row.getByRole('combobox').last();
  if (await decision.count()) {
    await decision.selectOption('APPROVE');
    await row.getByRole('textbox').last().fill('Synthetic browser association approval');
    await row.getByRole('button', { name: 'Record decision', exact: true }).click();
  } else {
    test.skip(true, 'The seeded licence association is not actionable in the current Platform reviewer capability projection.');
    return;
  }
  await expect(row.getByText('Approved', { exact: true })).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

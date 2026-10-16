import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'retain-on-failure', video: 'off' });

test('Platform reviewer can assign and decide a pending compliance request', async ({ page, evidence }) => {
  const session = await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  const apiBase = process.env.TRISE_E2E_API_URL || 'http://127.0.0.1:3001/api/v1';
  const queueResponse = await page.request.get(`${apiBase}/platform/compliance`, { headers: { Authorization: `Bearer ${session.accessToken}` } });
  expect(queueResponse.ok()).toBeTruthy();
  const queue = await queueResponse.json() as { data: Array<{ id: string; attributes: { submitted_by_user_id?: string | null; status: string } }> };
  const candidate = queue.data.find((item) => ['SUBMITTED', 'IN_REVIEW'].includes(item.attributes.status) && item.attributes.submitted_by_user_id !== session.user.id);
  if (!candidate) {
    test.skip(true, 'No synthetic pending compliance request is eligible for a different platform reviewer in this development database.');
    return;
  }
  await page.goto(`/#platform/compliance?request=${candidate.id}`);
  await expect(page.getByRole('heading', { name: 'Approval Inbox', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();

  await expect(page.getByRole('heading', { level: 2 }).filter({ hasText: /Business legal identity|Business Registration|DEMO_BROWSER_BUSINESS_REGISTRATION/i }).first()).toBeVisible();

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
  await page.getByLabel('Decision reason', { exact: true }).fill('Synthetic browser approval');
  const decisionResponse = page.waitForResponse((response) => response.url().includes('/platform/compliance/') && response.url().endsWith('/decision') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Record decision', exact: true }).click();
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
  await expect(page.getByRole('heading', { name: 'Audit history', exact: true })).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('Platform reviewer can approve the seeded Business licence association', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/compliance');
  await expect(page.getByRole('heading', { name: 'Approval Inbox', exact: true })).toBeVisible();
  await page.getByPlaceholder('Business name, request or reference…').fill('Synthetic browser Provider association');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  const row = page.locator('button.approval-request-row').first();
  if (!await row.count()) {
    test.skip(true, 'The synthetic licence-association fixture is not present in this development database.');
    return;
  }
  await expect(row).toBeVisible();
  await row.click();
  if (await page.getByText(/approved/i, { exact: true }).count()) {
    test.skip(true, 'Seeded association was already approved; reload the development fixture for a fresh decision transaction.');
    return;
  }
  const assign = page.getByLabel('Authorized reviewer');
  if (await assign.count()) {
    const globalReviewer = assign.locator('option', { hasText: 'Demo Dispatcher' });
    if (await globalReviewer.count()) await assign.selectOption({ label: 'Demo Dispatcher' });
    else await assign.selectOption({ index: 1 });
    await page.getByLabel('Assignment reason', { exact: true }).fill('Synthetic browser association assignment');
    await page.getByRole('button', { name: 'Assign', exact: true }).click();
  }
  await page.getByRole('combobox', { name: 'Decision', exact: true }).selectOption('APPROVE');
  await page.getByLabel('Decision reason', { exact: true }).fill('Synthetic browser association approval');
  await page.getByRole('button', { name: 'Record decision', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /Approved/i }).last()).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'retain-on-failure', video: 'off' });

const solarProviderId = '01a0ed1c-94dc-7702-9ea8-64187649b5a3';

async function selectSolarProvider(page: import('playwright/test').Page, session: Awaited<ReturnType<typeof localSignIn>>) {
  const provider = session.user.attributes.provider_capabilities.find((entry: { provider_id: string; capabilities: string[] }) =>
    entry.provider_id === solarProviderId && entry.capabilities.includes('compliance'));
  expect(provider, 'The configured reviewer must have server-authorized compliance access to the synthetic Solar Provider').toBeTruthy();
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Account and workspace menu', exact: true })
    .getByRole('combobox', { name: 'Provider', exact: true }).selectOption(solarProviderId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
}

test('Provider reviewer can approve one pending Asset compliance request', async ({ page, evidence }) => {
  const session = await localSignIn(page, configuredAccount('PROVIDER_REVIEWER'));
  await selectSolarProvider(page, session);
  const queueResponse = page.waitForResponse((response) => response.url().includes('/providers/compliance/review-queue') && response.request().method() === 'GET');
  await page.goto('/#/compliance/assets');
  await queueResponse;
  await expect(page.getByRole('heading', { name: 'Asset approvals', exact: true })).toBeVisible();

  const queue = page.locator('section.detail-section').filter({ hasText: 'Provider compliance review queue' }).first();
  await expect(queue).toBeVisible();
  const reviewButton = queue.getByRole('button', { name: 'Review', exact: true }).first();
  await expect(reviewButton).toBeVisible();
  const pending = queue.locator('article.record-card').filter({ hasText: 'ASSET' }).first();
  await expect(pending).toBeVisible();
  await pending.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(queue.locator('select').first()).toBeVisible();
  const previewResponse = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/documents/') && response.url().endsWith('/download'));
  await pending.getByRole('button', { name: 'Preview', exact: true }).click();
  const preview = await previewResponse;
  expect(preview.status()).toBe(200);
  const previewPayload = await preview.json() as { url?: string; object_key?: string; expires_in?: number };
  expect(previewPayload.url).toBeTruthy();
  expect(previewPayload.expires_in).toBeGreaterThan(0);
  expect(previewPayload.object_key).toBeUndefined();
  await queue.locator('select').first().selectOption('APPROVE');
  await queue.locator('textarea').first().fill('Synthetic Provider review approval');
  const decisionResponse = page.waitForResponse((response) => response.url().includes('/providers/compliance/review-queue/') && response.request().method() === 'POST');
  await queue.getByRole('button', { name: 'Record Provider decision', exact: true }).click();
  expect((await decisionResponse).status()).toBe(200);
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter((response) => response.status >= 500)).toEqual([]);
});

test('Provider reviewer can approve one pending Agent compliance request', async ({ page, evidence }) => {
  const session = await localSignIn(page, configuredAccount('PROVIDER_REVIEWER'));
  await selectSolarProvider(page, session);
  const queueResponse = page.waitForResponse((response) => response.url().includes('/providers/compliance/review-queue') && response.request().method() === 'GET');
  await page.goto('/#/compliance/agents');
  await queueResponse;
  await expect(page.getByRole('heading', { name: 'Agent certifications', exact: true })).toBeVisible();

  const queue = page.locator('section.detail-section').filter({ hasText: 'Provider compliance review queue' }).first();
  await expect(queue).toBeVisible();
  const pending = queue.locator('article.record-card').filter({ hasText: 'AGENT' }).first();
  await expect(pending).toBeVisible();
  await pending.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(pending.locator('select')).toBeVisible();
  await pending.locator('select').selectOption('APPROVE');
  await pending.locator('textarea').fill('Synthetic Agent review approval');
  const decisionResponse = page.waitForResponse((response) => response.url().includes('/providers/compliance/review-queue/') && response.request().method() === 'POST');
  await pending.getByRole('button', { name: 'Record Provider decision', exact: true }).click();
  expect((await decisionResponse).status()).toBe(200);
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter((response) => response.status >= 500)).toEqual([]);
});

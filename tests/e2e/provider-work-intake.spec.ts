import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';
import type { Page, TestInfo } from 'playwright/test';

test.use({ screenshot: 'on', trace: 'retain-on-failure', video: 'retain-on-failure' });

async function selectProvider(page: Page) {
  const trigger = page.getByRole('button', { name: 'Open account menu', exact: true });
  await trigger.click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  const provider = menu.getByRole('combobox', { name: 'Provider', exact: true });
  await expect.poll(() => provider.locator('option').count(), { timeout: 20_000 }).toBeGreaterThan(1);
  if (!(await provider.inputValue())) await provider.selectOption({ index: 1 });
  await trigger.click();
}

async function capture(page: Page, testInfo: TestInfo, label: string) {
  await testInfo.attach(label, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

test('Provider Work Intake captures responsive list, advisory matches and an unresolved assessment', async ({ page }, testInfo) => {
  // Local sign-in is intentionally rate-limited and paced before the workflow.
  test.setTimeout(60_000);
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await selectProvider(page);
  const failures: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/v1/') && response.status() >= 400) failures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await page.goto(`${page.url().split('#')[0]}#work-intake`);
  await expect(page.getByRole('heading', { name: 'Work Intake', exact: true })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible({ timeout: 20_000 }).catch(async () => {
    await expect(page.getByText(/No work intake records found/)).toBeVisible();
  });
  await capture(page, testInfo, `work-intake-list-${testInfo.project.name}`);

  await page.getByRole('button', { name: 'Create intake', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create Work Intake', exact: true });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(testInfo.project.use.viewport!.width + 1);
  await dialog.getByRole('combobox', { name: 'Work source *', exact: true }).selectOption('PROVIDER_DIRECT');
  await dialog.getByRole('combobox', { name: 'Work type *', exact: true }).selectOption('REPAIR');
  const title = `Visual verification repair ${testInfo.project.name} ${Date.now()}`;
  await dialog.getByRole('textbox', { name: 'Work title *', exact: true }).fill(title);
  await dialog.getByRole('button', { name: 'Check possible matches', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Provider-scoped suggestions', exact: true })).toBeVisible();
  await expect(dialog.getByText(/Searches are provider-scoped warnings only. Nothing is linked automatically./)).toBeVisible();
  await capture(page, testInfo, `work-intake-create-${testInfo.project.name}`);
  await dialog.getByRole('button', { name: 'Create intake', exact: true }).click();
  await expect(page.getByText(/was saved\. Possible matches are advisory/)).toBeVisible({ timeout: 20_000 });
  const row = page.getByRole('row').filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(page.getByText('No match was found. Intake was accepted and an assessment task is open.')).toBeVisible();
  await expect(page.getByText('Unresolved')).toBeVisible();
  await capture(page, testInfo, `work-intake-detail-${testInfo.project.name}`);
  expect(failures, `Unexpected provider API failures: ${failures.join(', ')}`).toEqual([]);
});

test('Modification and Takeover assessments require and persist all scope boundaries', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await selectProvider(page);
  await page.goto(`${page.url().split('#')[0]}#work-intake`);
  await expect(page.getByRole('heading', { name: 'Work Intake', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create intake', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create Work Intake', exact: true });
  await dialog.getByRole('combobox', { name: 'Work source *', exact: true }).selectOption('PROVIDER_DIRECT');
  await dialog.getByRole('combobox', { name: 'Work type *', exact: true }).selectOption('TAKEOVER');
  const title = `Takeover assessment ${testInfo.project.name} ${Date.now()}`;
  await dialog.getByRole('textbox', { name: 'Work title *', exact: true }).fill(title);
  await dialog.getByRole('button', { name: 'Create intake', exact: true }).click();
  await expect(page.getByText(/was saved\. Possible matches are advisory/)).toBeVisible({ timeout: 20_000 });
  const row = page.getByRole('row').filter({ hasText: title });
  await row.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Complete assessment', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/Complete current state, remaining scope, and responsibility boundary/);
  await page.getByRole('textbox', { name: 'Current condition and inherited work *', exact: true }).fill('Existing controller is operational but obsolete; document all inherited defects.');
  await page.getByRole('textbox', { name: 'Remaining scope *', exact: true }).fill('Inspect and test safety circuits, then quote approved corrective work.');
  await page.getByRole('textbox', { name: 'Provider responsibility boundary *', exact: true }).fill('Provider responsibility begins only after signed condition survey and customer acceptance.');
  await page.getByRole('button', { name: 'Complete assessment', exact: true }).click();
  await expect(page.getByText('Completed', { exact: true })).toBeVisible();
  await expect(page.getByText(/Assessment completed · /)).toBeVisible();
  const box = await page.getByRole('textbox', { name: 'Remaining scope *', exact: true }).boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(testInfo.project.use.viewport!.width + 1);
});

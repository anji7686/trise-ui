import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';

test.use({ trace: 'retain-on-failure', video: 'retain-on-failure', screenshot: 'on' });

test('Provider Admin can search the AMC register and inspect contract coverage and maintenance tabs', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'AMC workspace is available in Operations projects.');
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  const provider = menu.getByRole('combobox', { name: 'Provider', exact: true });
  await expect.poll(() => provider.locator('option').count(), { timeout: 20_000 }).toBeGreaterThan(1);
  if (!(await provider.inputValue())) await provider.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const maintenanceApiFailures: string[] = [];
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.pathname.includes('/maintenance-contracts') && response.status() >= 400) maintenanceApiFailures.push(`${response.status()} ${url.pathname}`);
  });
  await page.goto(`${page.url().split('#')[0]}#/amc`);

  await expect(page.getByRole('heading', { name: 'AMC & preventive maintenance', exact: true })).toBeVisible();
  await expect(page.getByText('Active AMC contracts', { exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: /AMC/i })).toBeVisible();
  const search = page.getByRole('textbox', { name: 'Search AMC contracts', exact: true });
  await search.fill('TRISE-AMC-visual-audit-no-match');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.amc-register-panel')).toContainText('No contracts match these server-side filters.');
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.locator('.amc-contract-table tbody tr').first()).toBeVisible({ timeout: 20_000 });
  const pageSize = page.getByRole('combobox', { name: 'Rows per page', exact: true });
  await expect(pageSize).toHaveValue('10');
  const pageSizeRequest = page.waitForRequest(request => request.url().includes('/maintenance-contracts?') && request.url().includes('page%5Blimit%5D=20'));
  await pageSize.selectOption('20');
  await pageSizeRequest;
  await expect(page.locator('.amc-detail-panel h2')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Coverage', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Covered assets', exact: true })).toBeVisible();
  for (const tabName of ['Schedule', 'Visits', 'Renewals', 'Billing']) {
    await page.getByRole('tab', { name: tabName, exact: true }).click();
  }
  await page.getByRole('tab', { name: 'Coverage', exact: true }).click();
  await page.getByRole('button', { name: 'Renew contract', exact: true }).click();
  const renewalDialog = page.getByRole('dialog', { name: 'Renew AMC contract', exact: true });
  await expect(renewalDialog.getByLabel('Effective from *')).toBeVisible();
  await expect(renewalDialog.getByLabel('Effective to *')).toBeVisible();
  await expect(renewalDialog.getByLabel('Reason *')).toBeVisible();
  await page.screenshot({ path: info.outputPath('amc-renewal-dialog.png') });
  await renewalDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Create amendment', exact: true }).click();
  const amendmentDialog = page.getByRole('dialog', { name: 'Create AMC amendment', exact: true });
  await expect(amendmentDialog.getByLabel('Effective at *')).toBeVisible();
  await expect(amendmentDialog.getByLabel('Reason *')).toBeVisible();
  await amendmentDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  const configureAction = page.getByRole('button', { name: 'Configure preventive maintenance', exact: true });
  if (await configureAction.count()) {
    await configureAction.click();
    await expect(page).toHaveURL(/#configuration\/maintenance-policies$/);
    await expect(page.getByRole('combobox', { name: 'Configuration type', exact: true })).toHaveValue('maintenance-policies');
    await expect(page.getByLabel('Policy source')).toBeVisible();
    await expect(page.getByLabel('IANA time zone')).toBeVisible();
    await expect(page.getByLabel('Recurrence policy')).toBeVisible();
    await expect(page.getByLabel(/Rules: sequence/)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('maintenance-policy-configuration.png'), fullPage: true });
  }
  expect(maintenanceApiFailures).toEqual([]);
  await page.screenshot({ path: info.outputPath('amc-preventive-maintenance.png'), fullPage: true });
  await localSignOut(page);
});

import { test, expect } from './fixtures';
import { localSignIn, localSignOut } from './local-auth';

test.use({ trace: 'off', video: 'off', screenshot: 'off', actionTimeout: 10_000, navigationTimeout: 15_000 });

async function selectLiftRiseProvider(page: import('playwright/test').Page, providerId: string) {
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  const select = dialog.getByRole('combobox', { name: 'Provider', exact: true });
  if (await select.inputValue() !== providerId) {
    await select.selectOption(providerId);
    await page.waitForTimeout(250);
  }
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
}

test('Field Marketing Executive captures a lead and Marketing Manager reviews it', async ({ page, evidence }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);
  const reference = `BROWSER-${Date.now()}`;

  const executiveSession = await localSignIn(page, 'marketingexecutive@demotrise.in');
  const provider = executiveSession.user.attributes.provider_capabilities.find((entry: { provider_id: string; display_name: string; capabilities: string[] }) =>
    entry.display_name === 'Lift Rise Elevators — Demo Operations' && entry.capabilities.includes('sales_marketing'));
  expect(provider).toBeTruthy();
  await selectLiftRiseProvider(page, provider!.provider_id);
  await page.getByRole('complementary', { name: 'Operations navigation' }).getByRole('button', { name: 'Leads & Surveys', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Leads & site surveys', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'New lead', exact: true }).click();
  await page.getByLabel('Reference code', { exact: true }).fill(reference);
  await page.getByLabel('Source', { exact: true }).fill('FIELD');
  await page.getByLabel('Prospect name', { exact: true }).fill('Synthetic Demo Prospect');
  await page.getByLabel('Opportunity title', { exact: true }).fill('Synthetic Lift Modernization');
  await page.getByLabel('Primary contact reference', { exact: true }).fill('demo-contact@demotrise.in');
  await page.getByRole('button', { name: 'Create lead', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Lead created by the server.');
  await expect(page.getByRole('heading', { name: 'Synthetic Lift Modernization', exact: true })).toBeVisible();

  await page.getByText('Follow-up activity', { exact: true }).click();
  await page.getByLabel('Activity type', { exact: true }).fill('CALL');
  await page.getByLabel('Notes', { exact: true }).fill('Synthetic browser follow-up');
  await page.getByRole('button', { name: 'Log follow-up', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Follow-up recorded by the server.');

  await page.getByText('Site survey', { exact: true }).click();
  await page.getByLabel('Survey date', { exact: true }).fill(new Date().toISOString().slice(0, 10));
  await page.getByLabel('Elevators', { exact: true }).fill('2');
  await page.getByLabel('Floors', { exact: true }).fill('8');
  await page.getByLabel('Building type', { exact: true }).fill('Residential');
  await page.getByLabel('Shaft width (mm)', { exact: true }).fill('1800');
  await page.getByRole('button', { name: 'Submit survey', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Site survey submitted by the server.');

  await page.getByText('Requirements revision', { exact: true }).click();
  await page.getByLabel('Capacity (kg)', { exact: true }).fill('680');
  await page.getByLabel('Stops', { exact: true }).fill('8');
  await page.getByLabel('Lift type', { exact: true }).fill('Passenger');
  await page.getByRole('button', { name: 'Capture requirements', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Requirement revision captured by the server.');
  await page.getByText('Survey evidence', { exact: true }).click();
  const evidenceInput = page.getByLabel('PDF, PNG, JPEG, XLS or XLSX', { exact: true });
  await expect(evidenceInput).toBeVisible();
  if (process.env.TRISE_E2E_STORAGE === 'true') {
    await evidenceInput.setInputFiles({ name: 'survey-evidence.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic survey evidence') });
    await page.getByRole('button', { name: 'Upload evidence', exact: true }).click();
    await expect(page.getByText('Survey evidence finalized and associated with this lead.', { exact: true })).toBeVisible();
    await expect(page.getByText('survey-evidence.pdf · available · not_scanned', { exact: true })).toBeVisible();
    const evidenceAuthorization = page.waitForResponse((response) => response.url().includes('/documents/') && response.url().endsWith('/download') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Download evidence', exact: true }).click();
    const authorizedResponse = await evidenceAuthorization;
    expect(authorizedResponse.status()).toBe(200);
    await expect((await authorizedResponse.json()).url).toContain('127.0.0.1:5001');
  }
  await page.screenshot({ path: `/tmp/trise-marketing-lead-${reference}-executive.png`, fullPage: true });

  await localSignOut(page);
  const managerSession = await localSignIn(page, 'marketingmanager@demotrise.in');
  const managerProvider = managerSession.user.attributes.provider_capabilities.find((entry: { provider_id: string; display_name: string; capabilities: string[] }) =>
    entry.display_name === 'Lift Rise Elevators — Demo Operations' && entry.capabilities.includes('sales_marketing'));
  expect(managerProvider).toBeTruthy();
  await selectLiftRiseProvider(page, managerProvider!.provider_id);
  await page.getByRole('complementary', { name: 'Operations navigation' }).getByRole('button', { name: 'Leads & Surveys', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Leads & site surveys', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`Synthetic Lift Modernization.*${reference}`) })).toBeVisible();
  await page.screenshot({ path: `/tmp/trise-marketing-lead-${reference}-manager.png`, fullPage: true });
  await localSignOut(page);

  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter((response) => response.status >= 500)).toEqual([]);
});

import { expect, test } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';
import { e2eApiV1Base } from './e2e-config';

async function selectProvider(page: import('playwright/test').Page) {
  const trigger = page.getByRole('button', { name: 'Open account menu', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  const provider = dialog.getByRole('combobox', { name: 'Provider', exact: true });
  await expect.poll(() => provider.locator('option').count()).toBeGreaterThan(1);
  if (!await provider.inputValue()) await provider.selectOption({ index: 1 });
  const providerId = await provider.inputValue();
  await trigger.click();
  return providerId;
}

test('Provider marketing survey draft resumes and submits as a versioned survey', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const { accessToken } = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const providerId = await selectProvider(page);
  const api = e2eApiV1Base();
  const reference = `E2E-SURVEY-${Date.now()}`;
  const createdLead = await page.request.post(`${api}/marketing-leads`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Idempotency-Key': crypto.randomUUID() },
    data: { reference_code: reference, source: 'FIELD', title: 'Mobile survey verification', prospect_name: 'Synthetic survey prospect' },
  });
  expect(createdLead.status()).toBe(201);

  await page.goto('/#leads');
  await expect(page.getByRole('heading', { name: /Leads & site surveys/i })).toBeVisible();
  const leadRow = page.getByRole('row').filter({ hasText: reference });
  await expect(leadRow).toBeVisible();
  await leadRow.getByRole('button', { name: 'Mobile survey verification', exact: true }).click();
  await page.getByRole('tab', { name: 'Site Survey', exact: true }).click();
  await page.getByRole('button', { name: 'Start survey', exact: true }).click();
  const wizard = page.locator('.site-survey-wizard');
  const date = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await wizard.getByLabel('Site visit date', { exact: true }).fill(date);
  await wizard.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('Draft saved securely. You can resume it from this lead later.')).toBeVisible();

  await wizard.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume draft', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume draft', exact: true }).click();
  await expect(wizard.getByLabel('Site visit date', { exact: true })).toHaveValue(date);

  await wizard.getByLabel('Site address').fill('Synthetic site address, Pune');
  await wizard.getByLabel('Latitude').fill('18.5204');
  await wizard.getByLabel('Longitude').fill('73.8567');
  await wizard.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('Draft saved securely. You can resume it from this lead later.')).toBeVisible();

  await wizard.getByLabel('Name', { exact: true }).fill('Synthetic Site Contact');
  await wizard.getByLabel('Site role').fill('Facilities');
  await wizard.getByLabel('Referrer name').fill('Synthetic referral');
  await wizard.getByLabel('Unit label').first().fill('Lift A');
  await wizard.getByLabel('Stops').first().fill('8');
  await wizard.getByLabel('Capacity (kg)').first().fill('680');
  await wizard.getByRole('button', { name: 'Add another unit', exact: true }).click();
  await expect(wizard.getByLabel('Unit label')).toHaveCount(2);
  await wizard.getByRole('button', { name: 'Continue', exact: true }).click();
  await wizard.getByLabel('Shaft width (mm)').fill('1800');
  await wizard.getByLabel('Shaft depth (mm)').fill('1900');
  await expect(page.getByText('Evidence upload is unavailable', { exact: true })).toBeVisible();
  await wizard.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('Unavailable until an approved scanner is configured')).toBeVisible();
  await testInfo.attach(`survey-summary-${testInfo.project.name}`, { body: await page.screenshot({ path: testInfo.outputPath(`survey-summary-${testInfo.project.name}.png`), fullPage: true }), contentType: 'image/png' });
  await wizard.getByRole('button', { name: 'Submit survey', exact: true }).click();
  await expect(page.getByText('Site survey submitted. The captured revision is now read-only.')).toBeVisible();
  await expect(page.getByText(/SUBMITTED ·/)).toBeVisible();
  await page.getByRole('tab', { name: 'Requirements', exact: true }).click();
  await page.getByLabel('Capacity (kg)', { exact: true }).fill('1000');
  await page.getByLabel('Stops', { exact: true }).fill('8');
  await page.getByLabel('Lift type', { exact: true }).fill('Passenger');
  await page.getByRole('button', { name: 'Capture requirements', exact: true }).click();
  await expect(page.getByText('Requirement revision captured by the server.')).toBeVisible();
  await testInfo.attach(`requirements-revision-${testInfo.project.name}`, { body: await page.screenshot({ path: testInfo.outputPath(`requirements-revision-${testInfo.project.name}.png`), fullPage: true }), contentType: 'image/png' });
});

test('Provider lead create, update and follow-up dialogs persist supported fields', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const { accessToken } = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const providerId = await selectProvider(page);
  const api = e2eApiV1Base();

  await page.goto('/#leads');
  await page.getByRole('button', { name: 'New lead', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'Create lead', exact: true });
  await testInfo.attach(`lead-create-${testInfo.project.name}`, { body: await page.screenshot({ path: testInfo.outputPath(`lead-create-${testInfo.project.name}.png`), fullPage: true }), contentType: 'image/png' });
  const reference = `E2E-LEAD-${Date.now()}`;
  await create.getByLabel('Reference code').fill(reference);
  await create.getByLabel('Source').fill('FIELD');
  await create.getByLabel('Prospect name').fill('Synthetic provider prospect');
  await create.getByLabel('Opportunity title').fill('Elevator modernization assessment');
  await create.getByLabel('Primary contact reference').fill('synthetic-contact-ref');
  await create.getByRole('button', { name: 'Create lead', exact: true }).click();
  await expect(page.getByText('Lead created by the server.')).toBeVisible();

  const row = page.getByRole('row').filter({ hasText: reference });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Elevator modernization assessment', exact: true }).click();
  await page.getByRole('button', { name: 'Edit lead', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Update lead', exact: true });
  await testInfo.attach(`lead-update-${testInfo.project.name}`, { body: await page.screenshot({ path: testInfo.outputPath(`lead-update-${testInfo.project.name}.png`), fullPage: true }), contentType: 'image/png' });
  await edit.getByLabel('Opportunity title').fill('Modernization and site assessment');
  await edit.getByLabel('Lead stage').selectOption('CONTACTED');
  await edit.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Lead updated by the server.')).toBeVisible();

  await page.getByRole('tab', { name: 'Activity', exact: true }).click();
  await page.getByRole('button', { name: 'Record follow-up', exact: true }).click();
  const followUp = page.getByRole('dialog', { name: 'Record follow-up', exact: true });
  await testInfo.attach(`lead-follow-up-${testInfo.project.name}`, { body: await page.screenshot({ path: testInfo.outputPath(`lead-follow-up-${testInfo.project.name}.png`), fullPage: true }), contentType: 'image/png' });
  await followUp.getByLabel('Activity type').selectOption('CALL');
  await followUp.getByLabel('Outcome').fill('Customer requested a site visit');
  await followUp.getByLabel('Next action').fill('Coordinate site access');
  await followUp.getByLabel('Summary / notes').fill('Discussed modernization scope and tentative visit date.');
  await followUp.getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(page.getByText('Follow-up recorded by the server.')).toBeVisible();

  const fetched = await page.request.get(`${api}/marketing-leads?filter%5Bq%5D=${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Idempotency-Key': crypto.randomUUID() },
  });
  expect(fetched.ok()).toBeTruthy();
  const leadPayload = await fetched.json() as { data: Array<{ id: string; attributes: { reference_code: string; title: string; status: string } }> };
  const savedLead = leadPayload.data.find(item => item.attributes.reference_code === reference);
  expect(savedLead?.attributes).toMatchObject({ title: 'Modernization and site assessment', status: 'CONTACTED' });
});

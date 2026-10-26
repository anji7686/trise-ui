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
  await page.getByRole('button', { name: 'Record first interaction', exact: true }).click();
  const firstInteraction = page.getByRole('dialog', { name: 'Activity & follow-up history', exact: true });
  await firstInteraction.getByRole('tab', { name: 'Log past interaction', exact: true }).click();
  await firstInteraction.getByLabel('Notes', { exact: true }).fill('Initial qualification call completed.');
  await firstInteraction.getByRole('button', { name: 'Save past interaction', exact: true }).click();
  await expect(page.locator('.action-notification').filter({ hasText: 'Interaction recorded. It is now part of this shared journey.' })).toBeVisible();
  await firstInteraction.getByRole('button', { name: 'Close Activity & follow-up history', exact: true }).click();
  await page.getByRole('button', { name: 'Review qualification', exact: true }).click();
  const qualification = page.getByRole('dialog', { name: 'Qualification decision', exact: true });
  await qualification.getByRole('button', { name: 'Accept & qualify', exact: true }).click();
  await expect(page.locator('.action-notification').filter({ hasText: 'Lead accepted and qualified.' })).toBeVisible();
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
  await wizard.getByLabel('Stops').nth(1).fill('8');
  await wizard.getByLabel('Capacity (kg)').nth(1).fill('680');
  await wizard.getByRole('button', { name: 'Continue', exact: true }).click();
  await wizard.getByLabel('Shaft width (mm)').fill('1800');
  await wizard.getByLabel('Shaft depth (mm)').fill('1900');
  const requirementSelects = wizard.locator('select');
  for (let index = 0; index < await requirementSelects.count(); index += 1) {
    await requirementSelects.nth(index).selectOption({ index: 1 });
  }
  await wizard.locator('input[name="safety_features"]').first().check();
  await wizard.locator('input[name="standards_references"]').first().check();
  await wizard.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(wizard.getByText('Manage files in the shared Lead documents and photos section.', { exact: true })).toBeVisible();
  await testInfo.attach(`survey-summary-${testInfo.project.name}`, { body: await page.screenshot({ path: testInfo.outputPath(`survey-summary-${testInfo.project.name}.png`), fullPage: true }), contentType: 'image/png' });
  await wizard.getByRole('button', { name: 'Submit survey', exact: true }).click();
  await expect(page.getByText('Site survey submitted. A provider-only draft quotation was created; customer delivery remains unavailable until it is reviewed and published.')).toBeVisible();
  await expect(page.getByText(/SUBMITTED ·/)).toBeVisible();
  await expect(page.getByText('Final survey & requirements', { exact: true })).toBeVisible();
  await testInfo.attach(`survey-final-${testInfo.project.name}`, { body: await page.screenshot({ path: testInfo.outputPath(`survey-final-${testInfo.project.name}.png`), fullPage: true }), contentType: 'image/png' });
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
  await expect(page.getByRole('heading', { name: 'Lead details', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit lead', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Update lead', exact: true });
  await testInfo.attach(`lead-update-${testInfo.project.name}`, { body: await page.screenshot({ path: testInfo.outputPath(`lead-update-${testInfo.project.name}.png`), fullPage: true }), contentType: 'image/png' });
  await edit.getByLabel('Opportunity title').fill('Modernization and site assessment');
  await edit.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Lead updated by the server.')).toBeVisible();

  await page.getByRole('button', { name: 'Open follow-up history', exact: true }).click();
  const followUp = page.getByRole('dialog', { name: 'Activity & follow-up history', exact: true });
  await testInfo.attach(`lead-follow-up-${testInfo.project.name}`, { body: await page.screenshot({ path: testInfo.outputPath(`lead-follow-up-${testInfo.project.name}.png`), fullPage: true }), contentType: 'image/png' });
  await followUp.getByRole('tab', { name: 'Log past interaction', exact: true }).click();
  await followUp.getByLabel('Interaction type').selectOption('CALL');
  await followUp.getByLabel('Outcome').fill('Customer requested a site visit');
  await followUp.getByLabel('Next action').fill('Coordinate site access');
  await followUp.getByLabel('Notes').fill('Discussed modernization scope and tentative visit date.');
  await followUp.getByRole('button', { name: 'Save past interaction', exact: true }).click();
  await expect(page.getByText('Interaction recorded. It is now part of this shared journey.')).toBeVisible();
  await followUp.getByRole('button', { name: 'Close Activity & follow-up history', exact: true }).click();

  await page.getByRole('button', { name: 'Review qualification', exact: true }).click();
  const qualification = page.getByRole('dialog', { name: 'Qualification decision', exact: true });
  await expect(qualification.getByRole('button', { name: 'Accept & qualify', exact: true })).toBeEnabled();
  await qualification.getByRole('button', { name: 'Accept & qualify', exact: true }).click();
  await expect(page.getByText('Lead accepted and qualified.')).toBeVisible();

  const fetched = await page.request.get(`${api}/marketing-leads?filter%5Bq%5D=${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Idempotency-Key': crypto.randomUUID() },
  });
  expect(fetched.ok()).toBeTruthy();
  const leadPayload = await fetched.json() as { data: Array<{ id: string; attributes: { reference_code: string; title: string; status: string } }> };
  const savedLead = leadPayload.data.find(item => item.attributes.reference_code === reference);
  expect(savedLead?.attributes).toMatchObject({ title: 'Modernization and site assessment', status: 'QUALIFIED' });
});

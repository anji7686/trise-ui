import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';
import { e2eApiV1Base } from './e2e-config';
import type { Locator, Page, TestInfo } from 'playwright/test';

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

async function navigateProvider(page: Page, label: string) {
  const navigation = page.getByRole('complementary', { name: 'Operations navigation' });
  const item = navigation.getByRole('button', { name: label, exact: true });
  if (!await item.isVisible().catch(() => false)) {
    const section = label === 'Quotations' ? 'Commercial' : 'Intake';
    const expand = navigation.getByRole('button', { name: `Expand ${section}`, exact: true });
    if (await expand.isVisible().catch(() => false)) await expand.click();
  }
  await item.click();
}

async function capture(page: Page, testInfo: TestInfo, label: string) {
  await testInfo.attach(label, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

async function completeIntakeWizard(
  dialog: Locator,
  workType: string,
  title: string,
  source = 'PROVIDER_DIRECT',
  siteMode: 'EXISTING' | 'NEW' = 'EXISTING',
) {
  await dialog.getByRole('combobox', { name: 'Work source *', exact: true }).selectOption(source);
  await dialog.getByRole('combobox', { name: 'Work type *', exact: true }).selectOption(workType);
  await dialog.getByRole('textbox', { name: 'Work title *', exact: true }).fill(title);
  await expect(dialog.getByLabel('Site or project name', { exact: true })).toHaveCount(0);
  await expect(dialog.getByText('Step 1 of 4')).toBeVisible();
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(dialog.getByText('Step 2 of 4')).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Requester name', exact: true }).fill('Lifecycle verification requester');
  await dialog.getByRole('textbox', { name: 'Contact reference', exact: true }).fill(`verification-${Date.now()}`);
  await dialog.getByRole('textbox', { name: 'Request notes', exact: true }).fill('Created by authenticated lifecycle verification.');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(dialog.getByText('Step 3 of 4')).toBeVisible();
  if (siteMode === 'NEW') {
    await dialog.getByRole('combobox', { name: 'Site selection', exact: true }).selectOption('NEW');
    await dialog.getByLabel('Site or project name', { exact: true }).fill('Lifecycle verification site');
  }
  await dialog.getByRole('textbox', { name: 'Latitude', exact: true }).fill('12.9716');
  await dialog.getByRole('textbox', { name: 'Longitude', exact: true }).fill('77.5946');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(dialog.getByText('Step 4 of 4')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Check possible matches', exact: true })).toBeEnabled();
  await expect(dialog.getByRole('button', { name: 'Create intake', exact: true })).toBeEnabled();
  await expect(dialog.getByText(title, { exact: true })).toBeVisible();
  await expect(dialog.getByText('Lifecycle verification requester', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Coordinates captured', { exact: true })).toBeVisible();
}

test('Provider Work Intake captures responsive list, advisory matches, owner acceptance and assessment completion', async ({ page }, testInfo) => {
  // Local sign-in is intentionally rate-limited and paced before the workflow.
  test.setTimeout(120_000);
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
  const title = `Visual verification repair ${testInfo.project.name} ${Date.now()}`;
  await completeIntakeWizard(dialog, 'REPAIR', title);
  const matchesResponse = page.waitForResponse(response =>
    response.url().includes('/provider-work-intakes/matches') && response.status() === 200,
  );
  await dialog.getByRole('button', { name: 'Check possible matches', exact: true }).click();
  await matchesResponse;
  await expect(dialog.getByRole('heading', { name: 'Provider-scoped suggestions', exact: true })).toBeVisible();
  await expect(dialog.getByText('Searches are provider-scoped warnings only.', { exact: true })).toBeVisible();
  await capture(page, testInfo, `work-intake-create-${testInfo.project.name}`);
  await dialog.getByRole('button', { name: 'Create intake', exact: true }).click();
  await expect(page.getByText(/was saved\. Possible matches are advisory/)).toBeVisible({ timeout: 20_000 });
  const row = page.getByRole('row').filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Open intake', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Accept & start work', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Accept & start work', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('You accepted this intake and the assessment is now in progress.');
  await page.getByRole('button', { name: 'Complete assessment', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Assessment task marked Completed.');
  await expect(page.getByRole('heading', { name: 'Choose the next workflow', exact: true })).toBeVisible();
  await capture(page, testInfo, `work-intake-detail-${testInfo.project.name}`);
  expect(failures, `Unexpected provider API failures: ${failures.join(', ')}`).toEqual([]);
});

test('AMC Work Intake can be confirmed against an Asset and handed to Service Programs', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const signIn = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await selectProvider(page);
  const providerId = signIn.user.attributes.provider_capabilities.find((entry: { provider_id: string; display_name: string }) =>
    entry.display_name === 'Lift Rise Elevators — Demo Operations',
  )?.provider_id;
  expect(providerId).toBeTruthy();
  const assetsResponse = await page.request.get(`${e2eApiV1Base()}/assets?page[limit]=1`, {
    headers: { Authorization: `Bearer ${signIn.accessToken}`, 'X-TRISE-Provider-Id': providerId! },
  });
  expect(assetsResponse.ok()).toBeTruthy();
  const assetsPayload = await assetsResponse.json();
  const asset = (assetsPayload.data?.[0]?.data || assetsPayload.data?.[0]) as { id: string; attributes?: { name?: string; asset_number?: string } } | undefined;
  expect(asset?.id).toBeTruthy();
  const assetSearch = asset?.attributes?.asset_number || asset?.attributes?.name;
  expect(assetSearch).toBeTruthy();

  await page.goto(`${page.url().split('#')[0]}#work-intake`);
  await expect(page.getByRole('heading', { name: 'Work Intake', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create intake', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create Work Intake', exact: true });
  const title = `AMC intake route ${testInfo.project.name} ${Date.now()}`;
  await completeIntakeWizard(dialog, 'AMC', title, 'AMC_RENEWAL');
  await dialog.getByLabel('Optional existing Asset or Project lookup').fill(assetSearch!);
  await dialog.getByRole('button', { name: 'Check possible matches', exact: true }).click();
  const assetMatch = page.locator('.provider-work-intake-candidates article').filter({ hasText: assetSearch! }).first();
  await expect(assetMatch).toBeVisible({ timeout: 20_000 });
  await assetMatch.getByRole('button', { name: 'Select relationship', exact: true }).click();
  await dialog.getByLabel('Reason for selecting this asset *').fill('Confirmed existing asset for AMC scope review.');
  await dialog.getByRole('button', { name: 'Create intake', exact: true }).click();
  await expect(page.getByText(/was saved\. Possible matches are advisory/)).toBeVisible({ timeout: 20_000 });
  const row = page.getByRole('row').filter({ hasText: title });
  await row.getByRole('button', { name: 'Open intake', exact: true }).click();
  await page.getByRole('button', { name: 'Accept & start work', exact: true }).click();
  await page.getByRole('button', { name: 'Complete assessment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose the next workflow', exact: true })).toBeVisible();
  const routeSelect = page.getByRole('combobox', { name: 'Next workflow', exact: true });
  await expect(routeSelect.locator('option').filter({ hasText: 'AMC' })).toHaveCount(1);
  await routeSelect.selectOption('AMC');
  await page.getByLabel('Decision reason', { exact: true }).fill('AMC assessment is ready for Service Programs review.');
  const routeResponsePromise = page.waitForResponse(response =>
    response.url().includes('/route-decisions') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Save route & hand off', exact: true }).click();
  const routeResponse = await routeResponsePromise;
  expect(routeResponse.status()).toBe(200);
  const routedPayload = await routeResponse.json();
  const routedIntake = routedPayload.data?.data || routedPayload.data || routedPayload;
  expect(routedIntake.attributes.workflow_route).toBe('AMC');
  expect(routedIntake.attributes.downstream_team).toBe('Service Programs');
  expect(routedIntake.attributes.status).toBe('CLOSED');
  await expect(page.locator('.action-feedback-success')).toContainText(/Downstream route set to AMC\./i);
});

test('New Installation Work Intake flows through lead, survey and Sales quotation draft', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const admin = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await selectProvider(page);
  await page.goto(`${page.url().split('#')[0]}#work-intake`);
  await expect(page.getByRole('heading', { name: 'Work Intake', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create intake', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create Work Intake', exact: true });
  const title = `New installation intake ${testInfo.project.name} ${Date.now()}`;
  await completeIntakeWizard(dialog, 'NEW_INSTALLATION', title, 'PROVIDER_DIRECT', 'NEW');
  await dialog.getByRole('button', { name: 'Create intake', exact: true }).click();
  await expect(page.getByText(/was saved\. Possible matches are advisory/)).toBeVisible({ timeout: 20_000 });

  const row = page.getByRole('row').filter({ hasText: title });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Open intake', exact: true }).click();
  const routeResponsePromise = page.waitForResponse(response =>
    response.url().includes('/route-decisions') && response.request().method() === 'POST',
  );
  await expect(page.getByRole('heading', { name: 'Skip assignment and assessment', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Send to Lead & Survey', exact: true }).click();
  const routeResponse = await routeResponsePromise;
  expect(routeResponse.status()).toBe(200);
  const routePayload = await routeResponse.json();
  const routedIntake = routePayload.data?.data || routePayload.data || routePayload;
  expect(routedIntake.attributes.workflow_route).toBe('LEAD');
  expect(routedIntake.relationships.marketing_lead?.id).toBeTruthy();
  expect(routedIntake.attributes.status).toBe('CLOSED');
  await expect(page.getByText('Work Intake sent to the Lead & Survey workflow.', { exact: true })).toBeVisible();
  await expect(page.getByText('Workflow concluded — read-only', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open Lead details', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Record first interaction', exact: true }).click();
  const interaction = page.getByRole('dialog', { name: 'Activity & follow-up history', exact: true });
  await interaction.getByRole('tab', { name: 'Log past interaction', exact: true }).click();
  await interaction.getByLabel('Notes', { exact: true }).fill('Verified new installation opportunity and planned a site survey.');
  await interaction.getByRole('button', { name: 'Save past interaction', exact: true }).click();
  await expect(page.locator('.action-notification').filter({ hasText: 'Interaction recorded. It is now part of this shared journey.' })).toBeVisible();
  await interaction.getByRole('button', { name: 'Close Activity & follow-up history', exact: true }).click();
  await page.getByRole('button', { name: 'Review qualification', exact: true }).click();
  const qualification = page.getByRole('dialog', { name: 'Qualification decision', exact: true });
  await qualification.getByRole('button', { name: 'Accept & qualify', exact: true }).click();
  await expect(page.locator('.action-notification').filter({ hasText: 'Lead accepted and qualified.' })).toBeVisible();
  await page.getByRole('button', { name: 'Start survey', exact: true }).click();
  const survey = page.locator('.site-survey-wizard');
  await survey.getByLabel('Site visit date', { exact: true }).fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  await survey.getByLabel('Site address').fill('Synthetic new installation site, Bengaluru');
  await survey.getByLabel('Latitude').fill('12.9716');
  await survey.getByLabel('Longitude').fill('77.5946');
  await survey.getByLabel('Name', { exact: true }).fill('Synthetic Site Contact');
  await survey.getByLabel('Site role').fill('Facilities');
  await survey.getByLabel('Unit label').first().fill('Lift A');
  await survey.getByLabel('Stops').first().fill('8');
  await survey.getByLabel('Capacity (kg)').first().fill('1000');
  await survey.getByRole('button', { name: 'Continue', exact: true }).click();
  await survey.getByLabel('Shaft width (mm)').fill('2000');
  await survey.getByLabel('Shaft depth (mm)').fill('2200');
  const requirementSelects = survey.locator('select');
  for (let index = 0; index < await requirementSelects.count(); index += 1) {
    await requirementSelects.nth(index).selectOption({ index: 1 });
  }
  await survey.locator('input[name="safety_features"]').first().check();
  await survey.locator('input[name="standards_references"]').first().check();
  await survey.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(survey.getByText('Manage files in the shared Lead documents and photos section.', { exact: true })).toBeVisible();
  const surveyResponsePromise = page.waitForResponse(response =>
    response.url().includes('/site-surveys') && response.request().method() === 'POST',
  );
  await survey.getByRole('button', { name: 'Submit survey', exact: true }).click();
  const surveyResponse = await surveyResponsePromise;
  expect(surveyResponse.status()).toBe(201);
  await expect(page.getByText(/Site survey submitted\./)).toBeVisible();
  await expect(page.getByText('Final survey & requirements', { exact: true })).toBeVisible();
  const leadId = decodeURIComponent(page.url().split('#leads/')[1] || '');
  expect(leadId).toBeTruthy();
  const providerId = admin.user.attributes.provider_capabilities.find((entry: { provider_id: string; display_name: string }) =>
    entry.display_name === 'Lift Rise Elevators — Demo Operations',
  )?.provider_id;
  expect(providerId).toBeTruthy();
  await localSignOut(page);
  const salesManager = await localSignIn(page, configuredAccount('MARKETING_MANAGER'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Account and workspace menu', exact: true }).getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId!);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Quotations');
  const quotationRowsResponse = await page.request.get(`${e2eApiV1Base()}/quotations?page[limit]=100`, {
    headers: { Authorization: `Bearer ${salesManager.accessToken}`, 'X-TRISE-Provider-Id': providerId! },
  });
  expect(quotationRowsResponse.ok()).toBeTruthy();
  const quotationRows = (await quotationRowsResponse.json()).data.map((item: { data?: unknown }) => item.data || item);
  const quotation = quotationRows.find((item: { relationships?: { marketing_lead?: { id: string } } }) => item.relationships?.marketing_lead?.id === leadId) as { id: string; attributes: { quotation_number?: string; status?: string } } | undefined;
  expect(quotation?.id).toBeTruthy();
  expect(quotation?.attributes.status).toBe('draft');
  await page.goto(`${page.url().split('#')[0]}#quotations/${quotation!.id}`);
  await expect(page.getByRole('heading', { name: 'Quotation details', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: quotation!.attributes.quotation_number, exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Review & actions', exact: true }).click();
  await page.getByRole('button', { name: 'Edit draft', exact: true }).click();
  await page.locator('input[name="description"]').first().fill('New installation elevator supply and installation');
  await page.locator('input[name="amount"]').last().fill('450000');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.locator('.action-notification').filter({ hasText: 'Quotation draft updated.' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('new-installation-work-intake-lead-handoff.png'), fullPage: true });
});

test('Modification and Takeover assessments require and persist all scope boundaries', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await selectProvider(page);
  await page.goto(`${page.url().split('#')[0]}#work-intake`);
  await expect(page.getByRole('heading', { name: 'Work Intake', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create intake', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create Work Intake', exact: true });
  const title = `Takeover assessment ${testInfo.project.name} ${Date.now()}`;
  await completeIntakeWizard(dialog, 'TAKEOVER', title);
  await dialog.getByRole('button', { name: 'Create intake', exact: true }).click();
  await expect(page.getByText(/was saved\. Possible matches are advisory/)).toBeVisible({ timeout: 20_000 });
  const row = page.getByRole('row').filter({ hasText: title });
  await row.getByRole('button', { name: 'Open intake', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Accept & start work', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('You accepted this intake and the assessment is now in progress.');
  await page.getByRole('button', { name: 'Complete assessment', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/Complete current state, remaining scope, and responsibility boundary/);
  await page.getByRole('textbox', { name: 'Current condition and inherited work *', exact: true }).fill('Existing controller is operational but obsolete; document all inherited defects.');
  await page.getByRole('textbox', { name: 'Remaining scope *', exact: true }).fill('Inspect and test safety circuits, then quote approved corrective work.');
  await page.getByRole('textbox', { name: 'Provider responsibility boundary *', exact: true }).fill('Provider responsibility begins only after signed condition survey and customer acceptance.');
  await page.getByRole('button', { name: 'Complete assessment', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose the next workflow', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Next step/ }).click();
  await expect(page.getByText(/Assessment completed · /)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Current condition and inherited work *', exact: true })).toHaveValue('Existing controller is operational but obsolete; document all inherited defects.');
  await expect(page.getByRole('textbox', { name: 'Remaining scope *', exact: true })).toHaveValue('Inspect and test safety circuits, then quote approved corrective work.');
  await expect(page.getByRole('textbox', { name: 'Provider responsibility boundary *', exact: true })).toHaveValue('Provider responsibility begins only after signed condition survey and customer acceptance.');
  await page.getByRole('button', { name: /Handoff/ }).click();
  await page.getByRole('textbox', { name: 'Decision reason', exact: true }).fill('Transfer the completed takeover assessment to the authorized service request workflow.');
  await page.getByRole('button', { name: 'Save route & hand off', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Downstream route set to Service Request.');
});

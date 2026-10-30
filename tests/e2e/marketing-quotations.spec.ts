import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';
import { e2eApiV1Base } from './e2e-config';

function providerIdFor(user: { attributes: { provider_capabilities: Array<{ provider_id: string; display_name: string; capabilities: string[] }> } }, capability = 'quotations') {
  const provider = user.attributes.provider_capabilities.find((entry) => entry.display_name === 'Lift Rise Elevators — Demo Operations' && entry.capabilities.includes(capability));
  if (!provider) throw new Error(`The configured local identity has no authorized Provider capability: ${capability}`);
  return provider.provider_id;
}

function actionMessage(page: import('playwright/test').Page, message: string) {
  return page.locator('.action-notification').filter({ hasText: message });
}

async function navigateProvider(page: import('playwright/test').Page, label: string) {
  const navigation = page.getByRole('complementary', { name: 'Operations navigation' });
  const item = navigation.getByRole('button', { name: label, exact: true });
  if (!await item.isVisible().catch(() => false)) {
    const section = ({
      'Leads & Surveys': 'Intake',
      Quotations: 'Commercial',
      'Projects & Installation': 'Delivery',
    } as Record<string, string>)[label];
    const expand = section && navigation.getByRole('button', { name: `Expand ${section}`, exact: true });
    if (expand && await expand.isVisible().catch(() => false)) await expand.click();
    else {
      const menu = page.getByRole('button', { name: 'Menu', exact: true });
      if (await menu.isVisible().catch(() => false)) await menu.click();
    }
  }
  await item.click();
}

async function chooseSearchableOption(
  page: import('playwright/test').Page,
  label: string,
  search: string,
  optionName: RegExp,
) {
  const input = page.getByRole('combobox', { name: label, exact: true });
  await input.fill(search);
  const option = page.getByRole('option', { name: optionName });
  await expect(option).toBeVisible();
  await option.click();
}

async function submitInstallationSurvey(
  page: import('playwright/test').Page,
  api: string,
  headers: Record<string, string>,
  leadId: string,
) {
  const response = await page.request.post(`${api}/marketing-leads/${leadId}/site-surveys`, {
    headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
    data: {
      status: 'SUBMITTED',
      survey_date: new Date().toISOString().slice(0, 10),
      proposed_elevator_count: 2,
      floor_count: 8,
      building_details: { building_type: 'Commercial' },
      technical_measurements: { shaft_width_mm: 2000 },
      requirements: {
        industry_segment: 'COMMERCIAL_OFFICE',
        application: 'PASSENGER_TRANSPORT',
        profile_mode: 'PER_UNIT',
        unit_requirement_mode: 'PER_UNIT',
        technology: 'ELECTRIC_TRACTION',
        drive_type: 'GEARLESS_TRACTION',
        speed_band: 'MPS_100',
        door_configuration: 'SINGLE_SIDE',
        door_type: 'CENTRE_OPENING',
        machine_room: 'MRL',
        control_system: 'SIMPLEX_COLLECTIVE',
        finish: 'TO_BE_CONFIRMED',
        safety_features: ['OVERLOAD_PROTECTION'],
        standards_references: [
          'IS_17900_PART_4_2025', 'IS_17900_PART_6_2022', 'IS_17900_PART_7_SEC_6_2025',
          'IS_4591_2020', 'IS_14671_1999', 'IS_17900_PART_1_2022', 'IS_17900_PART_2_2022',
          'IS_17900_PART_3_SEC_1_2023', 'IS_17900_PART_5_2026', 'IS_17900_PART_3_SEC_2_2025',
          'IS_17900_PART_7_SEC_4_2025', 'IS_17900_PART_20_2024', 'IS_15785_2007',
          'NBC_INDIA_PART_8_SECTION_5',
        ],
        units: [
          {
            unit_key: 'UNIT-A', label: 'Passenger lift', equipment_type_code: 'PASSENGER_TRACTION', stops: 8, capacity_kg: 1000,
            requirements: { application: 'PASSENGER_TRANSPORT', shaft_width_mm: 2000, safety_features: ['OVERLOAD_PROTECTION'] },
          },
          {
            unit_key: 'UNIT-B', label: 'Service lift', equipment_type_code: 'INDUSTRIAL_FREIGHT_LIFT', stops: 5, capacity_kg: 1500,
            requirements: { application: 'STAFF_SERVICE_GOODS', shaft_width_mm: 2400, safety_features: ['OVERLOAD_PROTECTION', 'EARTHQUAKE_OPERATION'] },
          },
        ],
      },
    },
  });
  if (response.status() !== 201) throw new Error(`survey setup failed: ${response.status()} ${await response.text()}`);
}

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('Marketing Manager prepares, issues and records negotiation for a Lead-linked quotation', async ({ page, evidence }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);
  const reference = `QUOTE-BROWSER-${Date.now()}`;
  const session = await localSignIn(page, configuredAccount('MARKETING_MANAGER'));
  const api = e2eApiV1Base();
  const provider = session.user.attributes.provider_capabilities.find((entry: { provider_id: string; display_name: string; capabilities: string[] }) =>
    entry.display_name === 'Lift Rise Elevators — Demo Operations' && entry.capabilities.includes('quotations'));
  expect(provider).toBeTruthy();
  const providerId = provider!.provider_id;

  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  const providerSelect = menu.getByRole('combobox', { name: 'Provider', exact: true });
  await providerSelect.selectOption(provider!.provider_id);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();

  await navigateProvider(page, 'Leads & Surveys');
  await page.getByRole('button', { name: 'New lead', exact: true }).click();
  await page.getByLabel('Lead reference code', { exact: true }).fill(reference);
  await page.getByRole('combobox', { name: 'Work source', exact: true }).selectOption({ label: 'Marketing' });
  await page.getByLabel('Requester name', { exact: true }).fill('Quotation Browser Prospect');
  await page.getByLabel('Work title', { exact: true }).fill('Browser quotation opportunity');
  await page.getByRole('button', { name: 'Create lead', exact: true }).click();
  await expect(actionMessage(page, 'Lead created by the server.')).toBeVisible();
  const createdLeadId = decodeURIComponent(page.url().split('#leads/')[1] || '');
  expect(createdLeadId).toBeTruthy();
  await submitInstallationSurvey(page, api, { Authorization: `Bearer ${session.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' }, createdLeadId);

  await navigateProvider(page, 'Quotations');
  await expect(page.getByRole('heading', { name: 'Quotations & Orders', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: '+ New quotation', exact: true }).click();
  await page.getByRole('button', { name: /New installation/ }).click();
  await chooseSearchableOption(page, 'Lead', 'Browser quotation opportunity', new RegExp(`Browser quotation opportunity.*${reference}`));
  await chooseSearchableOption(page, 'Customer relationship', 'Browser quotation opportunity', new RegExp(`Quotation Browser Prospect.*Browser quotation opportunity.*${reference}`));
  const requirementUnitOptions = page.getByRole('group', { name: 'Units from latest submitted requirements', exact: true });
  if (await requirementUnitOptions.isVisible().catch(() => false)) {
    await expect(requirementUnitOptions.locator('input[type="checkbox"]')).toHaveCount(1);
  }
  await page.getByLabel('Lift unit codes (comma separated)', { exact: true }).fill('Passenger lift, Service lift');
  await page.getByRole('button', { name: '+ Add material line', exact: true }).click();
  const liftScopedMaterial = page.locator('.quotation-material-editor-row').first();
  await liftScopedMaterial.locator('textarea').nth(0).fill('UNIT-B controller package');
  await liftScopedMaterial.locator('input[type="number"]').nth(0).fill('1');
  await liftScopedMaterial.locator('input[type="number"]').nth(1).fill('85000');
  await liftScopedMaterial.locator('textarea').nth(1).fill('Controller model: MPS150\nStandards: IS 17900 PART 4 2025, IS 17900 PART 6 2022, NBC INDIA PART 8 SECTION 5');
  await liftScopedMaterial.getByRole('checkbox', { name: 'Apply UNIT-B controller package to Service lift', exact: true }).check();
  const secondMaterial = page.locator('.quotation-material-editor-row').nth(1);
  await page.getByRole('button', { name: '+ Add material line', exact: true }).click();
  await secondMaterial.locator('textarea').nth(0).fill('UNIT-A drive package');
  await secondMaterial.locator('input[type="number"]').nth(0).fill('1');
  await secondMaterial.locator('input[type="number"]').nth(1).fill('155000');
  await secondMaterial.locator('textarea').nth(1).fill('Drive: Gearless traction\nCapacity: 1000 kg');
  await secondMaterial.getByRole('checkbox', { name: 'Apply UNIT-A drive package to Passenger lift', exact: true }).check();
  const materialTemplateName = `Quotation E2E ${Date.now()}`;
  await page.getByLabel('Save these lines as a provider material scope template', { exact: true }).fill(materialTemplateName);
  await page.getByRole('button', { name: 'Save as template', exact: true }).click();
  const templateScope = page.getByRole('combobox', { name: 'Template source', exact: true });
  await expect(templateScope).toHaveValue('PROVIDER');
  const materialTemplatePicker = page.getByRole('combobox', { name: 'Material scope template', exact: true });
  await expect(materialTemplatePicker.getByRole('option', { name: materialTemplateName, exact: true })).toHaveCount(1, { timeout: 15_000 });
  await expect(page.getByRole('region', { name: 'Material scope templates', exact: true }).getByText('Material template saved for this provider.', { exact: true })).toBeVisible();
  await materialTemplatePicker.selectOption({ label: materialTemplateName });
  await page.getByRole('button', { name: 'Add selected template lines', exact: true }).click();
  await expect(page.locator('.quotation-material-editor-row')).toHaveCount(4);
  const templateCopyB = page.locator('.quotation-material-editor-row').nth(2);
  await expect(templateCopyB.locator('textarea').nth(0)).toHaveValue('UNIT-B controller package');
  await templateCopyB.getByRole('checkbox', { name: 'Apply UNIT-B controller package to Service lift', exact: true }).check();
  const templateCopyA = page.locator('.quotation-material-editor-row').nth(3);
  await expect(templateCopyA.locator('textarea').nth(0)).toHaveValue('UNIT-A drive package');
  await templateCopyA.locator('summary').click();
  await templateCopyA.getByRole('checkbox', { name: 'Apply UNIT-A drive package to Passenger lift', exact: true }).check();
  for (const row of await page.locator('.quotation-material-editor-row').all()) {
    if (!(await row.evaluate((element) => (element as HTMLDetailsElement).open))) await row.locator('summary').click();
    await row.locator('label').filter({ hasText: 'Tax rule' }).locator('select').selectOption({ index: 1 });
  }
  await expect(liftScopedMaterial.locator('textarea').nth(0)).toHaveValue('UNIT-B controller package');
  await expect(liftScopedMaterial.locator('textarea').nth(1)).toHaveValue(/IS 17900 PART 4 2025/);
  await expect(secondMaterial.locator('textarea').nth(0)).toHaveValue('UNIT-A drive package');
  const materialTemplatesResponse = await page.request.get(`${api}/provider-material-scope-templates`, {
    headers: { Authorization: `Bearer ${session.accessToken}`, 'X-TRISE-Provider-Id': providerId },
  });
  expect(materialTemplatesResponse.ok()).toBeTruthy();
  const materialTemplatesPayload = await materialTemplatesResponse.json();
  const createdMaterialTemplate = materialTemplatesPayload.data.find((template: { attributes: { name: string } }) =>
    template.attributes.name === materialTemplateName);
  expect(createdMaterialTemplate).toBeTruthy();
  const archiveMaterialTemplate = await page.request.patch(
    `${api}/provider-material-scope-templates/${createdMaterialTemplate.id}`,
    {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'X-TRISE-Provider-Id': providerId,
        'Idempotency-Key': crypto.randomUUID(),
      },
      data: { status: 'ARCHIVED', expected_revision: createdMaterialTemplate.attributes.revision },
    },
  );
  expect(archiveMaterialTemplate.ok()).toBeTruthy();
  await page.locator('input[name="amount"]').first().fill('480000');
  await page.screenshot({ path: info.outputPath('quotation-create-draft.png') });
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(actionMessage(page, 'Quotation draft saved.')).toBeVisible();
  const specificationOverview = page.getByRole('region', { name: 'Latest lift specifications', exact: true });
  await expect(specificationOverview).toBeVisible();
  await expect(specificationOverview).toContainText('Standards');
  await expect(specificationOverview).toContainText('Passenger lift');
  await expect(specificationOverview).toContainText('Service lift');
  await expect(specificationOverview).toContainText('1000 kg');
  await expect(specificationOverview).toContainText('1500 kg');
  await specificationOverview.getByText('View full value', { exact: true }).click();
  await expect(specificationOverview).toContainText('IS 17900 PART 4 2025');
  await page.locator('summary[aria-label="More actions"]').click();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const customerPreview = page.getByRole('dialog', { name: 'Customer quotation preview', exact: true });
  await expect(customerPreview).toContainText('Applies to lifts');
  await expect(customerPreview).toContainText('Service lift');
  await expect(customerPreview).toContainText('IS 17900 PART 4 2025');
  await customerPreview.getByRole('button', { name: 'Close preview', exact: true }).click();
  const quotationNumber = (await page.locator('.quotation-detail-record-header h2').textContent())?.trim();
  expect(quotationNumber).toBeTruthy();
  const quotationRowsResponse = await page.request.get(`${api}/quotations?page[limit]=100`, { headers: { Authorization: `Bearer ${session.accessToken}`, 'X-TRISE-Provider-Id': providerId } });
  expect(quotationRowsResponse.ok()).toBeTruthy();
  const quotationRowsPayload = await quotationRowsResponse.json();
  const createdQuote = quotationRowsPayload.data.map((row: { data?: unknown }) => row.data || row)
    .find((row: { attributes: { quotation_number: string } }) => row.attributes.quotation_number === quotationNumber);
  expect(createdQuote.attributes.terms.elevator_units).toEqual([{ unit_code: 'Passenger lift' }, { unit_code: 'Service lift' }]);
  expect(createdQuote.attributes.terms.materials).toEqual(expect.arrayContaining([
    expect.objectContaining({ description: 'UNIT-B controller package', unit_codes: ['Service lift'] }),
    expect.objectContaining({ description: 'UNIT-A drive package', unit_codes: ['Passenger lift'] }),
  ]));
  expect(createdQuote.attributes.lines).toEqual(expect.arrayContaining([
    expect.objectContaining({ description: 'UNIT-B controller package', unit_codes: ['Service lift'] }),
    expect.objectContaining({ description: 'UNIT-A drive package', unit_codes: ['Passenger lift'] }),
  ]));
  expect(createdQuote.attributes.terms).not.toHaveProperty('payment_milestones');
  expect(createdQuote.attributes.terms).toHaveProperty('included_free_amc');
  await page.getByRole('tab', { name: 'Review & actions', exact: true }).click();
  await page.getByRole('button', { name: 'Edit draft', exact: true }).click();
  await page.screenshot({ path: info.outputPath('quotation-edit-draft.png') });
  await page.locator('input[name="description"]').first().fill('Revised browser quotation scope');
  await page.locator('input[name="amount"]').last().fill('485000');
  for (const row of await page.locator('.quotation-material-editor-row').all()) {
    if (!(await row.evaluate((element) => (element as HTMLDetailsElement).open))) await row.locator('summary').click();
    await row.locator('label').filter({ hasText: 'Tax rule' }).locator('select').selectOption({ index: 1 });
  }
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(actionMessage(page, 'Quotation draft updated.')).toBeVisible();
  await page.getByRole('button', { name: 'Issue quotation', exact: true }).click();
  await expect(actionMessage(page, 'Quotation issued; awaiting Provider review before customer acceptance.')).toBeVisible();
  await page.getByRole('button', { name: 'Record negotiation', exact: true }).click();
  await page.getByLabel('Notes', { exact: true }).fill('Customer requested a revised commercial offer.');
  await page.getByRole('dialog', { name: 'Record negotiation', exact: true }).getByRole('button', { name: 'Record negotiation', exact: true }).click();
  await expect(actionMessage(page, 'Negotiation event recorded in immutable history.')).toBeVisible();
  await page.screenshot({ path: info.outputPath('quotation-issued-negotiation.png') });
  await localSignOut(page);

  const reviewer = await localSignIn(page, configuredAccount('PROVIDER_REVIEWER'));
  expect(providerIdFor(reviewer.user)).toBe(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Account and workspace menu', exact: true }).getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Quotations');
  await expect(page.getByRole('heading', { name: 'Quotations & Orders', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: quotationNumber!, exact: true }).click();
  await page.getByRole('tab', { name: 'Review & actions', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Provider quotation review', exact: true })).toContainText('Approval is required before this quotation can move to the customer.');
  await page.getByRole('button', { name: 'Approve revision', exact: true }).click();
  await page.screenshot({ path: info.outputPath('quotation-provider-review.png') });
  await page.getByRole('dialog', { name: 'Approve quotation revision', exact: true }).getByRole('button', { name: 'Approve revision', exact: true }).click();
  await expect(actionMessage(page, 'Provider review approved for this exact quotation revision')).toBeVisible();
  await localSignOut(page);
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter((response) => response.status >= 500)).toEqual([]);
});

test('approved quotation converts to an installation project from the Manager workspace', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(240_000);
  const api = e2eApiV1Base();
  const relationshipReader = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const providerId = providerIdFor(relationshipReader.user);
  const providerHeaders = { Authorization: `Bearer ${relationshipReader.accessToken}`, 'X-TRISE-Provider-Id': providerId };
  const contractsResponse = await page.request.get(`${api}/maintenance-contracts?page[limit]=100`, { headers: providerHeaders });
  expect(contractsResponse.ok()).toBeTruthy();
  const contractsPayload = await contractsResponse.json();
  const contractRows = contractsPayload.data.map((row: { data?: unknown }) => row.data || row) as Array<{ attributes: { contract_number?: string; status?: string }; relationships?: { customer_relationship?: { id: string } } }>;
  const canonicalContract = contractRows.find((row) => row.attributes.contract_number === 'DEMO-ELEV-AMC-001' && ['active', 'approved'].includes(String(row.attributes.status || '').toLowerCase()));
  expect(canonicalContract?.relationships?.customer_relationship?.id).toBeTruthy();
  const customerRelationshipResponse = await page.request.get(`${api}/customer-relationships/${canonicalContract!.relationships!.customer_relationship!.id}`, { headers: providerHeaders });
  expect(customerRelationshipResponse.ok()).toBeTruthy();
  const customerRelationshipPayload = await customerRelationshipResponse.json();
  const customerRelationship = customerRelationshipPayload.data || customerRelationshipPayload;
  expect(customerRelationship.attributes.status).toBe('ACTIVE');
  await localSignOut(page);
  const manager = await localSignIn(page, configuredAccount('MARKETING_MANAGER'));
  const managerHeaders = { Authorization: `Bearer ${manager.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const relationship = customerRelationship;
  const leadResponse = await page.request.post(`${api}/marketing-leads`, {
    headers: { ...managerHeaders, 'Idempotency-Key': crypto.randomUUID() },
    data: { reference_code: `BROWSER-CONVERT-${Date.now()}`, source: 'BROWSER', title: 'Team-scoped conversion lead', prospect_name: 'Browser conversion prospect', customer_relationship_id: relationship.id }
  });
  if (leadResponse.status() !== 201) throw new Error(`conversion lead setup failed: ${await leadResponse.text()}`);
  const leadPayload = await leadResponse.json();
  const lead = leadPayload.data?.data || leadPayload.data || leadPayload;
  await submitInstallationSurvey(page, api, managerHeaders, lead.id);
  const taxRulesResponse = await page.request.get(`${api}/quotation-tax-rules`, { headers: providerHeaders });
  if (!taxRulesResponse.ok()) throw new Error(`tax rule setup failed: ${await taxRulesResponse.text()}`);
  const taxRulesPayload = await taxRulesResponse.json();
  const taxRule = taxRulesPayload.data?.[0];
  if (!taxRule?.id) throw new Error('No published quotation tax rule is available for the conversion journey.');
  const quotationResponse = await page.request.post(`${api}/quotations`, {
    headers: { ...managerHeaders, 'Idempotency-Key': crypto.randomUUID() },
    data: { customer_relationship_id: relationship.id, lead_id: lead.id, purpose: 'INSTALLATION', currency: 'INR', lines: [{ description: 'Browser conversion lift', quantity: 1, unit_price: 125000, amount: 125000, tax_rule_id: taxRule.id, tax_pricing_mode: 'EXCLUSIVE' }] }
  });
  if (quotationResponse.status() !== 201) throw new Error(`quotation setup failed: ${await quotationResponse.text()}`);
  const quotationPayload = await quotationResponse.json();
  const quotation = quotationPayload.data?.data || quotationPayload.data || quotationPayload;
  const quotationLabel = String(quotation.attributes.quotation_number || quotation.id);
  const issueResponse = await page.request.post(`${api}/quotations/${quotation.id}/transitions`, {
    headers: { ...managerHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { action: 'issue', expected_revision: quotation.attributes.revision }
  });
  if (!issueResponse.ok()) throw new Error(`quotation issue setup failed: ${issueResponse.status()} ${await issueResponse.text()}`);
  const issuedPayload = await issueResponse.json();
  const issued = issuedPayload.data?.data || issuedPayload.data || issuedPayload;

  await localSignOut(page);
  const reviewer = await localSignIn(page, configuredAccount('PROVIDER_REVIEWER'));
  const reviewerProvider = reviewer.user.attributes.provider_capabilities.find((entry: { provider_id: string; capabilities: string[] }) => entry.provider_id === providerId);
  expect(reviewerProvider?.capabilities).toContain('quotations');
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Account and workspace menu', exact: true }).getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Quotations');
  await page.getByRole('button', { name: quotationLabel, exact: true }).click();
  await page.getByRole('tab', { name: 'Review & actions', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Provider quotation review', exact: true })).toContainText('Approval is required before this quotation can move to the customer.');
  await page.getByRole('button', { name: 'Approve revision', exact: true }).click();
  await page.getByRole('dialog', { name: 'Approve quotation revision', exact: true }).getByRole('button', { name: 'Approve revision', exact: true }).click();
  await expect(actionMessage(page, 'Provider review approved for this exact quotation revision')).toBeVisible();
  await localSignOut(page);

  const customerPage = await page.context().newPage();
  await localSignIn(customerPage, configuredAccount('CUSTOMER'), 'http://127.0.0.1:4173/');
  await customerPage.goto(`http://127.0.0.1:4173/#/quotation/${quotation.id}`);
  await expect(customerPage.getByRole('heading', { name: 'Review the exact offer', exact: true })).toBeVisible({ timeout: 20_000 });
  await customerPage.getByRole('button', { name: 'Accept quotation', exact: true }).click();
  const confirmation = customerPage.getByRole('dialog', { name: new RegExp(`Accept revision ${issued.attributes.revision}\\?`) });
  await expect(confirmation).toBeVisible();
  await confirmation.getByLabel('Your full name').fill('E2E Installation Customer');
  await confirmation.getByLabel('Your role or title').fill('Authorized customer reviewer');
  await confirmation.getByRole('checkbox', { name: /I confirm I am authorised/ }).check();
  await confirmation.getByRole('button', { name: 'Confirm acceptance', exact: true }).click();
  await expect(customerPage.locator('.quote-success')).toContainText('Your acceptance has been recorded.');
  await localSignOut(customerPage);
  await customerPage.close();

  const managerSession = await localSignIn(page, configuredAccount('MARKETING_MANAGER'));
  const managerProvider = managerSession.user.attributes.provider_capabilities.find((entry: { provider_id: string; capabilities: string[] }) => entry.provider_id === providerId);
  expect(managerProvider?.capabilities).toContain('projects');
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await menu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Quotations');
  await expect(page.getByRole('heading', { name: 'Quotations & Orders', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: quotationLabel, exact: true }).click();
  await page.getByRole('tab', { name: 'Review & actions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open project draft', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('quotation-converted-project-success.png'), fullPage: true });
  await localSignOut(page);
  const verifier = await localSignIn(page, configuredAccount('PROVIDER_REVIEWER'));
  const projectsResponse = await page.request.get(`${api}/service-cases?page[limit]=25`, { headers: { Authorization: `Bearer ${verifier.accessToken}`, 'X-TRISE-Provider-Id': providerId } });
  if (!projectsResponse.ok()) throw new Error(`project list response: ${projectsResponse.status()} ${await projectsResponse.text()}`);
  const projectsPayload = await projectsResponse.json();
  expect(projectsPayload.data.length).toBeGreaterThan(0);
  const projectRows = projectsPayload.data.map((row: { data?: { attributes: { source_quotation_id?: string } }; attributes?: { source_quotation_id?: string } }) => row.data || row);
  const convertedProject = projectRows.find((row: { id?: string; attributes: { title?: string; source_quotation_id?: string } }) => row.attributes.source_quotation_id === quotation.id);
  expect(convertedProject).toBeTruthy();
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Account and workspace menu', exact: true }).getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const accessResponse = await page.request.get(`${api}/provider/access/self/effective-permissions`, { headers: { Authorization: `Bearer ${verifier.accessToken}`, 'X-TRISE-Provider-Id': providerId } });
  expect(accessResponse.ok()).toBeTruthy();
  const accessPayload = await accessResponse.json();
  const reviewerPermissions = new Set((accessPayload.data.attributes.permissions as Array<{ code: string; grant_effective: boolean }>).filter((item) => item.grant_effective).map((item) => item.code));
  await navigateProvider(page, 'Projects & Installation');
  await expect(page.getByRole('heading', { name: 'Installation Projects', exact: true })).toBeVisible();
  const convertedProjectRow = page.getByRole('row').filter({ hasText: String(convertedProject.attributes.title) });
  await expect(convertedProjectRow).toBeVisible();
  const openProjectButton = convertedProjectRow.getByRole('button', { name: 'Open project', exact: true });
  const rowBounds = await convertedProjectRow.boundingBox();
  const buttonBounds = await openProjectButton.boundingBox();
  expect(rowBounds && buttonBounds && buttonBounds.x >= rowBounds.x && buttonBounds.x + buttonBounds.width <= rowBounds.x + rowBounds.width).toBe(true);
  await openProjectButton.click();
  await expect(page.getByRole('heading', { name: String(convertedProject.attributes.title), exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add material requirement', exact: true })).toHaveCount(reviewerPermissions.has('SERVICE_JOB_EDIT') ? 1 : 0);
  await expect(page.getByRole('button', { name: 'Edit project', exact: true })).toHaveCount(reviewerPermissions.has('SERVICE_JOB_EDIT') ? 1 : 0);
  await page.getByRole('tab', { name: 'Stages & execution', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Create installation job', exact: true })).toHaveCount(reviewerPermissions.has('SERVICE_JOB_EDIT') ? 1 : 0);
  await expect(page.getByRole('button', { name: 'Add milestone', exact: true })).toHaveCount(reviewerPermissions.has('SERVICE_JOB_EDIT') ? 1 : 0);
  await page.getByRole('tab', { name: 'QA & handover', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Report defect', exact: true })).toHaveCount(reviewerPermissions.has('SERVICE_JOB_EDIT') ? 1 : 0);
  await expect(page.getByRole('button', { name: 'Request handover', exact: true })).toHaveCount(reviewerPermissions.has('SERVICE_JOB_EDIT') ? 1 : 0);
  await page.getByRole('tab', { name: 'Commercial', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Submit for approval', exact: true })).toHaveCount(reviewerPermissions.has('SERVICE_JOB_EDIT') ? 1 : 0);
  await expect(page.getByRole('button', { name: 'Add change order', exact: true })).toHaveCount(reviewerPermissions.has('SERVICE_JOB_EDIT') ? 1 : 0);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Installation Projects', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('quotation-converted-installation-project.png'), fullPage: true });
  await localSignOut(page);
});

test('Provider Administrator creates and converts an accepted paid AMC renewal quotation', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(240_000);
  const api = e2eApiV1Base();
  const manager = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const providerId = providerIdFor(manager.user);
  const managerHeaders = { Authorization: `Bearer ${manager.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Account and workspace menu', exact: true }).getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Quotations');
  await expect(page.getByRole('heading', { name: 'Quotations & Orders', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: '+ New quotation', exact: true }).click();
  await page.getByRole('button', { name: /Renew existing AMC/ }).click();
  const predecessor = page.locator('select[name="predecessor_contract_id"]');
  const activeContractsResponse = await page.request.get(`${api}/maintenance-contracts?page[limit]=100`, { headers: managerHeaders });
  expect(activeContractsResponse.ok()).toBeTruthy();
  const activeContractsPayload = await activeContractsResponse.json();
  const activeContracts = activeContractsPayload.data.map((row: { data?: unknown }) => row.data || row) as Array<{ id: string; attributes: Record<string, unknown> }>;
  let predecessorWithLift: { id: string; attributes: Record<string, unknown> } | undefined;
  for (const contract of activeContracts.filter((item) => ['active', 'approved'].includes(String(item.attributes.status).toLowerCase()))) {
    const scopesResponse = await page.request.get(`${api}/maintenance-contracts/${contract.id}/asset-scopes?page[limit]=100`, { headers: managerHeaders });
    if (!scopesResponse.ok()) continue;
    const scopes = await scopesResponse.json();
    if ((scopes.data || []).some((scope: { attributes?: { status?: string } }) => !scope.attributes?.status || scope.attributes.status.toUpperCase() === 'ACTIVE')) {
      predecessorWithLift = contract;
      break;
    }
  }
  expect(predecessorWithLift, 'renewal requires an active predecessor with an active linked elevator').toBeTruthy();
  await predecessor.selectOption(predecessorWithLift!.id);
  const predecessorContractId = await predecessor.inputValue();
  await expect(page.getByRole('heading', { name: 'Create paid AMC renewal quotation', exact: true })).toBeVisible();
  const coveredAsset = page.locator('select[name="asset_id"]');
  await expect.poll(() => coveredAsset.locator('option').count(), { timeout: 20_000 }).toBeGreaterThan(1);
  await coveredAsset.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const plan = page.locator('select[name="provider_service_plan_id"]');
  await expect.poll(() => plan.locator('option').count(), { timeout: 20_000 }).toBeGreaterThan(1);
  await plan.selectOption({ index: 1 });
  await page.getByLabel('Passenger capacity', { exact: true }).fill('6');
  await page.getByLabel('Floors above ground', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Effective from', { exact: true }).fill('2030-01-01');
  await page.getByLabel('Effective to', { exact: true }).fill('2031-01-01');
  await page.getByRole('button', { name: 'Create renewal draft quotation', exact: true }).click();
  await expect(actionMessage(page, 'Paid AMC renewal quotation draft created.')).toBeVisible();
  await page.getByRole('tab', { name: 'Review & actions', exact: true }).click();
  await page.getByRole('button', { name: 'Issue quotation', exact: true }).click();
  await expect(actionMessage(page, 'Quotation issued; awaiting Provider review before customer acceptance.')).toBeVisible();

  const quotationsResponse = await page.request.get(`${api}/quotations?page[limit]=100`, { headers: managerHeaders });
  expect(quotationsResponse.ok()).toBeTruthy();
  const quotations = await quotationsResponse.json();
  const renewal = quotations.data.map((row: { data?: { id: string; attributes: Record<string, unknown> }; id?: string; attributes?: Record<string, unknown> }) => row.data || row)
    .filter((row: { id: string; attributes: Record<string, unknown> }) => row.attributes.purpose === 'CONTRACT_RENEWAL')
    .sort((left: { attributes: Record<string, unknown> }, right: { attributes: Record<string, unknown> }) => Date.parse(String(right.attributes.created_at || '')) - Date.parse(String(left.attributes.created_at || '')))[0];
  expect(renewal).toBeTruthy();
  const renewalLabel = String(renewal.attributes.quotation_number || renewal.id);
  const revision = Number(renewal.attributes.revision);
  await localSignOut(page);

  const reviewer = await localSignIn(page, configuredAccount('PROVIDER_REVIEWER'));
  const reviewerHeaders = { Authorization: `Bearer ${reviewer.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const providerReview = await page.request.post(`${api}/quotations/${renewal.id}/provider-reviews`, { headers: { ...reviewerHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { decision: 'APPROVED', expected_revision: revision } });
  if (providerReview.status() !== 201) throw new Error(`paid renewal provider review failed: ${providerReview.status()} ${await providerReview.text()}`);
  await localSignOut(page);

  const customerPage = await page.context().newPage();
  await localSignIn(customerPage, configuredAccount('CUSTOMER'), 'http://127.0.0.1:4173/');
  await customerPage.goto(`http://127.0.0.1:4173/#/quotation/${renewal.id}`);
  await expect(customerPage.getByRole('heading', { name: 'Review the exact offer', exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(customerPage.getByRole('heading', { name: 'Scope and specifications', exact: true })).toBeVisible();
  const customerSections = customerPage.getByRole('tablist', { name: 'Quotation sections', exact: true });
  for (const label of ['Scope & pricing', 'Payment & terms', 'Revisions & activity', 'Messages']) {
    const tab = customerSections.getByRole('tab', { name: label, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(customerPage.getByRole('tabpanel')).toHaveCount(1);
  }
  await customerSections.getByRole('tab', { name: 'Scope & pricing', exact: true }).click();
  await customerPage.getByRole('button', { name: 'Accept quotation', exact: true }).click();
  const acceptDialog = customerPage.getByRole('dialog', { name: new RegExp(`Accept revision ${revision}\\?`) });
  await expect(acceptDialog).toBeVisible();
  await acceptDialog.getByLabel('Your full name').fill('E2E Demo Customer');
  await acceptDialog.getByLabel('Your role or title').fill('Authorized customer reviewer');
  await acceptDialog.getByRole('checkbox', { name: /I confirm I am authorised/ }).check();
  await acceptDialog.getByRole('button', { name: 'Confirm acceptance', exact: true }).click();
  await expect(customerPage.locator('.quote-success')).toContainText('Your acceptance has been recorded.');
  await expect(customerPage.getByRole('heading', { name: 'Acceptance recorded', exact: true })).toBeVisible();
  await localSignOut(customerPage);
  await customerPage.close();

  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Account and workspace menu', exact: true }).getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Quotations');
  await page.getByRole('button', { name: renewalLabel, exact: true }).click();
  await page.getByRole('tab', { name: 'Review & actions', exact: true }).click();
  await page.getByRole('button', { name: 'Create renewal contract draft', exact: true }).click();
  await expect(actionMessage(page, 'Renewal draft contract')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Activate paid AMC renewal', exact: true }).click();
  await expect(actionMessage(page, 'Paid AMC renewal contract')).toBeVisible();
  await expect(page.getByRole('region', { name: 'AMC renewal history', exact: true })).toContainText('Successor');
  await expect(page.getByRole('region', { name: 'AMC renewal history', exact: true })).toContainText('active');
  const contractsResponse = await page.request.get(`${api}/maintenance-contracts?page[limit]=100`, { headers: managerHeaders });
  if (!contractsResponse.ok()) throw new Error(`renewal contract history response: ${contractsResponse.status()} ${await contractsResponse.text()}`);
  const contracts = await contractsResponse.json();
  const successor = contracts.data.map((row: { data?: { id: string; attributes: Record<string, unknown>; relationships?: Record<string, { id: string }> }; id?: string; attributes?: Record<string, unknown>; relationships?: Record<string, { id: string }> }) => row.data || row)
    .find((row: { id: string; attributes: Record<string, unknown>; relationships?: Record<string, { id: string }> }) => row.attributes.paid_renewal === true && row.attributes.predecessor_contract_id === predecessorContractId);
  expect(successor).toBeTruthy();
  expect(successor.attributes.status).toBe('active');
  expect(successor.relationships?.predecessor?.id).toBe(predecessorContractId);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Quotations & Orders', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Quotations & Orders', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: '+ New quotation', exact: true }).click();
  await page.getByRole('button', { name: /Renew existing AMC/ }).click();
  const successorLabel = String(successor.attributes.name || successor.attributes.contract_number || successor.id);
  await expect(page.locator('select[name="predecessor_contract_id"] option').filter({ hasText: successorLabel })).toHaveCount(1);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await localSignOut(page);
});

test('Marketing Manager creates a new immutable quotation revision from the workspace', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);
  const api = e2eApiV1Base();
  const manager = await localSignIn(page, configuredAccount('MARKETING_MANAGER'));
  const providerId = providerIdFor(manager.user);
  const headers = { Authorization: `Bearer ${manager.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Account and workspace menu', exact: true }).getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const reference = `BROWSER-REVISION-${Date.now()}`;
  await navigateProvider(page, 'Leads & Surveys');
  await page.getByRole('button', { name: 'New lead', exact: true }).click();
  await page.getByLabel('Lead reference code', { exact: true }).fill(reference);
  await page.getByRole('combobox', { name: 'Work source', exact: true }).selectOption({ label: 'Marketing' });
  await page.getByLabel('Requester name', { exact: true }).fill('Quotation revision prospect');
  await page.getByLabel('Work title', { exact: true }).fill('Browser immutable revision opportunity');
  await page.getByRole('button', { name: 'Create lead', exact: true }).click();
  await expect(actionMessage(page, 'Lead created by the server.')).toBeVisible();
  const createdLeadId = decodeURIComponent(page.url().split('#leads/')[1] || '');
  expect(createdLeadId).toBeTruthy();
  await submitInstallationSurvey(page, api, headers, createdLeadId);
  await navigateProvider(page, 'Quotations');
  await expect(page.getByRole('heading', { name: 'Quotations & Orders', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '+ New quotation', exact: true }).click();
  await page.getByRole('button', { name: /New installation/ }).click();
  await chooseSearchableOption(page, 'Lead', 'Browser immutable revision opportunity', new RegExp(`Browser immutable revision opportunity.*${reference}`));
  await chooseSearchableOption(page, 'Customer relationship', 'Browser immutable revision opportunity', new RegExp(`Quotation revision prospect.*Browser immutable revision opportunity.*${reference}`));
  await page.locator('input[name="amount"]').first().fill('100000');
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(actionMessage(page, 'Quotation draft saved.')).toBeVisible();
  const createdLabel = (await page.locator('.quotation-detail-record-header h2').textContent())?.trim();
  expect(createdLabel).toBeTruthy();
  const quotesResponse = await page.request.get(`${api}/quotations?page[limit]=100`, { headers });
  expect(quotesResponse.ok()).toBeTruthy();
  const quotePayload = await quotesResponse.json();
  const quoteRows = quotePayload.data.map((row: { data?: unknown }) => row.data || row) as Array<{ id: string; attributes: { quotation_number?: string } }>;
  const created = quoteRows.find((row) => row.attributes.quotation_number === createdLabel);
  expect(created).toBeTruthy();
  await page.getByRole('tab', { name: 'Review & actions', exact: true }).click();
  await page.getByRole('button', { name: 'Issue quotation', exact: true }).click();
  await expect(actionMessage(page, 'Quotation issued; awaiting Provider review before customer acceptance.')).toBeVisible();
  await page.getByText('Create revision', { exact: true }).click();
  await page.screenshot({ path: info.outputPath('quotation-create-revision.png') });
  await page.locator('input[name="amount"]').last().fill('125000');
  await page.getByRole('button', { name: 'Create revision', exact: true }).click();
  await expect(actionMessage(page, 'New quotation revision created')).toBeVisible();
  await expect(page.locator('.quotation-detail-current-step')).toContainText('draft');
  const source = await page.request.get(`${api}/quotations/${created!.id}`, { headers });
  expect(source.ok()).toBeTruthy();
  const sourcePayload = await source.json();
  const sourceRow = sourcePayload.data?.data || sourcePayload.data || sourcePayload;
  expect(sourceRow.attributes.status).toBe('superseded');
  expect(Number(sourceRow.attributes.revision)).toBeGreaterThan(1);
  await localSignOut(page);
});

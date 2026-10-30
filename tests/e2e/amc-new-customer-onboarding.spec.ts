import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';
import { e2eApiV1Base } from './e2e-config';

type ApiResource = { id: string; attributes: Record<string, unknown>; relationships?: Record<string, { id: string }> };
const resourceFrom = (payload: { data?: unknown }) => {
  const direct = payload as unknown as ApiResource;
  if (direct?.id && direct?.attributes) return direct;
  const data = payload.data as { data?: ApiResource } | ApiResource | undefined;
  return (data && 'data' in data ? data.data : data) as ApiResource;
};

test.use({ screenshot: 'on', trace: 'retain-on-failure', video: 'retain-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('new customer and elevator can be onboarded into a paid AMC quotation', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(180_000);
  const session = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const provider = session.user.attributes.provider_capabilities.find((entry: { provider_id: string; display_name: string }) =>
    entry.display_name === 'Lift Rise Elevators — Demo Operations',
  );
  expect(provider).toBeTruthy();
  const providerId = provider!.provider_id;
  const headers = { Authorization: `Bearer ${session.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const accountMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  const providerSelect = accountMenu.getByRole('combobox', { name: 'Provider', exact: true });
  if (await providerSelect.locator(`option[value="${providerId}"]`).count()) await providerSelect.selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();

  await page.goto(`${page.url().split('#')[0]}#customers`);
  await expect(page.getByRole('heading', { name: 'Customers', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add customer', exact: true }).click();
  const customerName = process.env.TRISE_E2E_AMC_CUSTOMER_NAME || `AMC onboarding ${Date.now()}`;
  const phone = `9${Date.now().toString().slice(-9)}`;
  const email = process.env.TRISE_E2E_AMC_CUSTOMER_EMAIL || `amc.e2e.${Date.now()}@demotrise.in`;
  const customerResponsePromise = page.waitForResponse(response => response.url().endsWith('/api/v1/customers') && response.request().method() === 'POST');
  const customerDialog = page.getByRole('dialog', { name: 'Add customer', exact: true });
  await customerDialog.getByLabel('Display name *', { exact: true }).fill(customerName);
  await customerDialog.getByPlaceholder('e.g. 8892576065', { exact: true }).fill(phone);
  await customerDialog.getByPlaceholder('name@example.com', { exact: true }).fill(email);
  await customerDialog.getByRole('button', { name: 'Save', exact: true }).click();
  const customerResponse = await customerResponsePromise;
  expect(customerResponse.status()).toBe(201);
  const customer = resourceFrom(await customerResponse.json());
  const relationshipId = customer.relationships?.customer_relationship?.id;
  expect(relationshipId).toBeTruthy();
  expect(customer.attributes.display_name).toBe(customerName);
  console.log(`New AMC demo customer created: party=${customer.id} relationship=${relationshipId}`);

  const locationResponse = await page.request.post(`${e2eApiV1Base()}/locations`, {
    headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
    data: {
      customer_relationship_id: relationshipId,
      classification: 'BUILDING',
      name: `${customerName} service location`,
      address_lines: ['1 Elevator Verification Road', 'Bengaluru', 'Karnataka', '560001'],
    },
  });
  expect(locationResponse.status()).toBe(201);
  const location = resourceFrom(await locationResponse.json());
  const serviceLocationId = location.relationships?.service_location?.id;
  expect(serviceLocationId).toBeTruthy();

  const definitionsResponse = await page.request.get(`${e2eApiV1Base()}/asset-definitions?page[limit]=100`, { headers });
  expect(definitionsResponse.ok()).toBeTruthy();
  const definitionsPayload = await definitionsResponse.json();
  const definitions = (definitionsPayload.data || []).map((row: { data?: ApiResource } | ApiResource) => ('data' in row ? row.data : row) as ApiResource);
  const definition = definitions.find((row: ApiResource) => {
    const code = String(row.attributes.code || '').toUpperCase();
    const name = String(row.attributes.name || row.attributes.display_name || '').toLowerCase();
    return /ELEVATOR|LIFT/.test(code) || /elevator|lift/.test(name);
  });
  expect(definition, 'The provider needs an active elevator/lift asset definition.').toBeTruthy();
  const identifierInputs = String(definition!.attributes.primary_identifier_strategy || '').toUpperCase() === 'REQUIRED'
    ? [{ identifier_type_id: String(definition!.attributes.primary_identifier_type_id || definition!.attributes.identifier_policy_id || ''), value: `AMC${Date.now().toString().slice(-8)}` }]
    : [];
  expect(identifierInputs.every(item => Boolean(item.identifier_type_id))).toBe(true);
  const assetResponse = await page.request.post(`${e2eApiV1Base()}/assets`, {
    headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
    data: {
      name: `${customerName} Passenger Lift`,
      asset_definition_id: definition!.id,
      definition_version: definition!.attributes.version,
      customer_relationship_id: relationshipId,
      owner_party_id: customer.id,
      location_id: serviceLocationId,
      values: [],
      identifier_inputs: identifierInputs,
    },
  });
  expect(assetResponse.status()).toBe(201);
  const asset = resourceFrom(await assetResponse.json());
  expect(asset.relationships?.location?.id).toBe(serviceLocationId);
  expect(asset.attributes.display_name || asset.attributes.name).toContain(customerName);

  await page.goto(`${page.url().split('#')[0]}#quotations/new/MAINTENANCE_CONTRACT?relationship_id=${encodeURIComponent(relationshipId!)}&relationship_label=${encodeURIComponent(customerName)}&return_to=customers`);
  await expect(page.getByRole('heading', { name: 'New AMC quotation', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Customer & lifts', exact: true })).toBeVisible();
  await expect(page.getByText(`${customerName} Passenger Lift`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Catalog per lift', exact: true })).toBeVisible();
  const catalogSelect = page.locator('.amc-plan-bulk-apply select');
  await expect.poll(() => catalogSelect.locator('option').count(), { timeout: 20_000 }).toBeGreaterThan(1);
  await catalogSelect.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Apply to all selected lifts', exact: true }).click();
  const liftCatalog = page.getByRole('combobox', { name: 'AMC catalog for this lift *', exact: true });
  await expect(liftCatalog).toHaveValue(await catalogSelect.inputValue());
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Term & lift details', exact: true })).toBeVisible();
  await page.getByLabel('Passenger capacity *', { exact: true }).fill('6');
  await page.getByLabel('Floors above ground *', { exact: true }).fill('4');
  await page.getByRole('combobox', { name: 'Lift type', exact: true }).selectOption({ label: 'Passenger traction lift' });
  const usageClass = page.getByLabel('Usage class *', { exact: true });
  if (await usageClass.count()) await usageClass.fill('PASSENGER');
  const quotationResponsePromise = page.waitForResponse(response => response.url().endsWith('/api/v1/quotations') && response.request().method() === 'POST', { timeout: 45_000 });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Quotation tax settings', exact: true })).toBeVisible();
  const taxRule = page.getByRole('region', { name: 'Quotation tax settings', exact: true }).getByRole('combobox', { name: 'Published tax rule' });
  await expect.poll(() => taxRule.locator('option').count(), { timeout: 20_000 }).toBeGreaterThan(1);
  const taxRuleId = await taxRule.locator('option').evaluateAll(options => options.map(option => (option as HTMLOptionElement).value).find(value => Boolean(value)) || '');
  expect(taxRuleId, 'The provider must have a published tax rule for this test.').toBeTruthy();
  await taxRule.selectOption(taxRuleId);
  await expect(taxRule).toHaveValue(taxRuleId);
  await page.getByRole('combobox', { name: 'Price treatment', exact: true }).selectOption('EXCLUSIVE');
  const createButton = page.getByRole('button', { name: 'Create draft quotation', exact: true });
  const alreadyCreated = await Promise.race([quotationResponsePromise.then(() => true), page.waitForTimeout(750).then(() => false)]);
  if (!alreadyCreated) {
    await expect(createButton).toBeEnabled();
    await createButton.click();
  }
  const quotationResponse = await quotationResponsePromise;
  expect(quotationResponse.status()).toBe(201);
  const createPayload = quotationResponse.request().postDataJSON() as { lines?: Array<{ tax_rule_id?: string; tax_pricing_mode?: string }> };
  expect(createPayload.lines?.[0]?.tax_rule_id).toBe(taxRuleId);
  expect(createPayload.lines?.[0]?.tax_pricing_mode).toBe('EXCLUSIVE');
  const quotation = resourceFrom(await quotationResponse.json());
  console.log(`New AMC demo customer quotation created: quotation=${quotation.id}`);
  expect(quotation.attributes.purpose).toBe('MAINTENANCE_CONTRACT');
  expect(quotation.attributes.status).toBe('draft');
  const lines = quotation.attributes.lines as Array<{ asset_id?: string; amount?: string; tax_amount?: string; tax?: { rule_id?: string; components?: Array<{ code: string }> } }>;
  expect(lines.some(line => line.asset_id === asset.id)).toBe(true);
  expect(lines[0].tax?.rule_id).toBe(taxRuleId);
  expect(lines[0].tax?.components?.map(component => component.code)).toContain('CGST');
  expect(Number(quotation.attributes.tax_total)).toBeGreaterThan(0);
  expect(Number(quotation.attributes.total)).toBeGreaterThan(Number(quotation.attributes.subtotal));
  await expect(page.getByRole('heading', { name: 'Quotation details', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Quotation agreement status', exact: true })).toContainText('Draft — not sent');
  await page.screenshot({ path: info.outputPath('new-customer-paid-amc-draft.png'), fullPage: true });

  // A provider-created contact record does not create a customer portal login.
  // The customer must be linked through the supported identity onboarding path
  // before a Customer persona can review or accept this new party's quotation.
  const customerAccess = await page.request.get(`${e2eApiV1Base()}/customer-relationships/${relationshipId}`, { headers });
  expect(customerAccess.ok()).toBeTruthy();
  await localSignOut(page);
});

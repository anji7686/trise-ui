import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';
import { e2eApiV1Base } from './e2e-config';

function providerIdFor(user: { attributes: { provider_capabilities: Array<{ provider_id: string; display_name: string; capabilities: string[] }> } }, capability = 'quotations') {
  const provider = user.attributes.provider_capabilities.find((entry) => entry.display_name === 'Lift Rise Elevators — Demo Operations' && entry.capabilities.includes(capability));
  if (!provider) throw new Error(`The configured local identity has no authorized Provider capability: ${capability}`);
  return provider.provider_id;
}

async function navigateProvider(page: import('playwright/test').Page, label: string) {
  const navigation = page.getByRole('complementary', { name: 'Operations navigation' });
  const item = navigation.getByRole('button', { name: label, exact: true });
  if (!await item.isVisible().catch(() => false)) await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await item.click();
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

  await navigateProvider(page, 'Marketing Leads & Surveys');
  await page.getByRole('button', { name: 'New lead', exact: true }).click();
  await page.getByLabel('Reference code', { exact: true }).fill(reference);
  await page.getByLabel('Source', { exact: true }).fill('MANAGER');
  await page.getByLabel('Prospect name', { exact: true }).fill('Quotation Browser Prospect');
  await page.getByLabel('Opportunity title', { exact: true }).fill('Browser quotation opportunity');
  await page.getByRole('button', { name: 'Create lead', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Lead created by the server.');

  await navigateProvider(page, 'Sales & Quotations');
  await expect(page.getByRole('heading', { name: 'Quotations & Orders', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '+ New quotation', exact: true }).click();
  const leadSelect = page.locator('select[name="lead_id"]');
  const leadOption = leadSelect.locator('option').filter({ hasText: new RegExp(`Browser quotation opportunity · ${reference}`) });
  await leadSelect.selectOption((await leadOption.getAttribute('value'))!);
  const relationshipSelect = page.locator('select[name="customer_relationship_id"]');
  const relationshipOption = relationshipSelect.locator('option').filter({ hasText: new RegExp(`Browser quotation opportunity · ${reference} · prospect`) });
  await relationshipSelect.selectOption((await relationshipOption.getAttribute('value'))!);
  await page.getByLabel('Lift unit codes (comma separated)', { exact: true }).fill('Lift-A, Lift-B');
  await page.getByLabel('Total (INR)', { exact: true }).fill('450000');
  await page.screenshot({ path: info.outputPath('quotation-create-draft.png') });
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Quotation draft created by the server.');
  const quotationNumber = (await page.locator('.quotation-detail-dialog h2').textContent())?.trim();
  expect(quotationNumber).toBeTruthy();
  const quotationRowsResponse = await page.request.get(`${api}/quotations?page[limit]=100`, { headers: { Authorization: `Bearer ${session.accessToken}`, 'X-TRISE-Provider-Id': providerId } });
  expect(quotationRowsResponse.ok()).toBeTruthy();
  const quotationRowsPayload = await quotationRowsResponse.json();
  const createdQuote = quotationRowsPayload.data.map((row: { data?: unknown }) => row.data || row)
    .find((row: { attributes: { quotation_number: string } }) => row.attributes.quotation_number === quotationNumber);
  expect(createdQuote.attributes.terms.elevator_units).toEqual([{ unit_code: 'Lift-A' }, { unit_code: 'Lift-B' }]);
  expect(createdQuote.attributes.terms).not.toHaveProperty('payment_milestones');
  expect(createdQuote.attributes.terms).not.toHaveProperty('included_free_amc');
  await page.getByRole('button', { name: 'Edit draft', exact: true }).click();
  await page.screenshot({ path: info.outputPath('quotation-edit-draft.png') });
  await page.getByLabel('Description', { exact: true }).fill('Revised browser quotation scope');
  await page.getByLabel('Total (INR)', { exact: true }).fill('455000');
  await page.getByRole('dialog', { name: 'Edit draft quotation', exact: true }).getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Draft quotation updated by the server.');
  await page.getByRole('button', { name: 'Issue quotation', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Quotation issued; awaiting Provider review before customer acceptance.');
  await page.getByRole('button', { name: 'Record negotiation', exact: true }).click();
  await page.getByLabel('Notes', { exact: true }).fill('Customer requested a revised commercial offer.');
  await page.getByRole('dialog', { name: 'Record negotiation', exact: true }).getByRole('button', { name: 'Record negotiation', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Negotiation event recorded in immutable history.');
  await page.screenshot({ path: info.outputPath('quotation-issued-negotiation.png') });
  await localSignOut(page);

  const reviewer = await localSignIn(page, configuredAccount('PROVIDER_REVIEWER'));
  expect(providerIdFor(reviewer.user)).toBe(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Account and workspace menu', exact: true }).getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Sales & Quotations');
  await expect(page.getByRole('heading', { name: 'Quotations & Orders', exact: true })).toBeVisible();
  await page.getByRole('button', { name: quotationNumber!, exact: true }).click();
  await expect(page.getByRole('region', { name: 'Provider quotation review', exact: true })).toContainText('Internal approval is required');
  await page.getByRole('button', { name: 'Approve revision', exact: true }).click();
  await page.screenshot({ path: info.outputPath('quotation-provider-review.png') });
  await page.getByRole('dialog', { name: 'Approve quotation revision', exact: true }).getByRole('button', { name: 'Approve revision', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Provider review approved for this exact quotation revision');
  await localSignOut(page);
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter((response) => response.status >= 500)).toEqual([]);
});

test('approved quotation converts to an installation project from the Manager workspace', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);
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
  const quotationResponse = await page.request.post(`${api}/quotations`, {
    headers: { ...managerHeaders, 'Idempotency-Key': crypto.randomUUID() },
    data: { customer_relationship_id: relationship.id, lead_id: lead.id, purpose: 'INSTALLATION', currency: 'INR', lines: [{ description: 'Browser conversion lift', quantity: 1, unit_price: 125000, amount: 125000 }] }
  });
  if (quotationResponse.status() !== 201) throw new Error(`quotation setup failed: ${await quotationResponse.text()}`);
  const quotationPayload = await quotationResponse.json();
  const quotation = quotationPayload.data?.data || quotationPayload.data || quotationPayload;
  const quotationLabel = String(quotation.attributes.quotation_number || quotation.id);
  const issueResponse = await page.request.post(`${api}/quotations/${quotation.id}/transitions`, {
    headers: { ...managerHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { action: 'issue', expected_revision: quotation.attributes.revision }
  });
  expect(issueResponse.ok()).toBeTruthy();
  const issuedPayload = await issueResponse.json();
  const issued = issuedPayload.data?.data || issuedPayload.data || issuedPayload;

  await localSignOut(page);
  const reviewer = await localSignIn(page, configuredAccount('PROVIDER_REVIEWER'));
  const reviewerProvider = reviewer.user.attributes.provider_capabilities.find((entry: { provider_id: string; capabilities: string[] }) => entry.provider_id === providerId);
  expect(reviewerProvider?.capabilities).toContain('quotations');
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Account and workspace menu', exact: true }).getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Sales & Quotations');
  await page.getByRole('button', { name: quotationLabel, exact: true }).click();
  await expect(page.getByRole('region', { name: 'Provider quotation review', exact: true })).toContainText('Internal approval is required');
  await page.getByRole('button', { name: 'Approve revision', exact: true }).click();
  await page.getByRole('dialog', { name: 'Approve quotation revision', exact: true }).getByRole('button', { name: 'Approve revision', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Provider review approved for this exact quotation revision');
  await localSignOut(page);

  const acceptedCustomer = await localSignIn(page, configuredAccount('CUSTOMER'));
  const acceptedCustomerHeaders = { Authorization: `Bearer ${acceptedCustomer.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const approvalResponse = await page.request.post(`${api}/quotations/${quotation.id}/approve`, {
    headers: { ...acceptedCustomerHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { expected_revision: issued.attributes.revision }
  });
  if (!approvalResponse.ok()) throw new Error(`quotation approval setup failed: ${await approvalResponse.text()}`);
  await localSignOut(page);

  const managerSession = await localSignIn(page, configuredAccount('MARKETING_MANAGER'));
  const managerProvider = managerSession.user.attributes.provider_capabilities.find((entry: { provider_id: string; capabilities: string[] }) => entry.provider_id === providerId);
  expect(managerProvider?.capabilities).toContain('projects');
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await menu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Sales & Quotations');
  await expect(page.getByRole('heading', { name: 'Quotations & Orders', exact: true })).toBeVisible();
  await page.getByRole('button', { name: quotationLabel, exact: true }).click();
  await page.getByRole('button', { name: 'Convert to installation project', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Quotation converted to installation project');
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
  await navigateProvider(page, 'Projects & Delivery');
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
  await page.getByRole('button', { name: '← Projects', exact: true }).click();
  await expect(convertedProjectRow).toBeVisible();
  await page.screenshot({ path: info.outputPath('quotation-converted-installation-project.png'), fullPage: true });
  await localSignOut(page);
});

test('Provider Administrator creates and converts an accepted paid AMC renewal quotation', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);
  const api = e2eApiV1Base();
  const manager = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const providerId = providerIdFor(manager.user);
  const managerHeaders = { Authorization: `Bearer ${manager.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Account and workspace menu', exact: true }).getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Sales & Quotations');
  await expect(page.getByRole('heading', { name: 'Quotations & Orders', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create paid AMC renewal', exact: true }).click();
  const predecessor = page.locator('select[name="predecessor_contract_id"]');
  await expect(predecessor.locator('option').filter({ hasText: 'DEMO-ELEV-AMC-001' })).toHaveCount(1);
  await predecessor.selectOption((await predecessor.locator('option').filter({ hasText: 'DEMO-ELEV-AMC-001' }).getAttribute('value'))!);
  const predecessorContractId = await predecessor.inputValue();
  await page.getByLabel('Amount (INR)', { exact: true }).fill('24000');
  await page.getByLabel('Effective from', { exact: true }).fill('2030-01-01');
  await page.getByLabel('Effective to', { exact: true }).fill('2031-01-01');
  await page.getByRole('button', { name: 'Create renewal quotation', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Paid AMC renewal quotation draft created.');
  await page.getByRole('button', { name: 'Issue quotation', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Quotation issued; awaiting Provider review before customer acceptance.');

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

  const customer = await localSignIn(page, configuredAccount('CUSTOMER'));
  const customerHeaders = { Authorization: `Bearer ${customer.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const acceptance = await page.request.post(`${api}/quotations/${renewal.id}/approve`, { headers: { ...customerHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { expected_revision: revision } });
  if (!acceptance.ok()) throw new Error(`paid renewal acceptance failed: ${await acceptance.text()}`);
  await localSignOut(page);

  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Account and workspace menu', exact: true }).getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Sales & Quotations');
  await page.getByRole('button', { name: renewalLabel, exact: true }).click();
  await page.getByRole('button', { name: 'Create renewal contract draft', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Renewal draft contract', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Activate paid AMC renewal', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Paid AMC renewal contract');
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
  await page.reload();
  await page.getByRole('button', { name: 'Create paid AMC renewal', exact: true }).click();
  await expect(page.locator('select[name="predecessor_contract_id"] option').filter({ hasText: String(successor.attributes.name) })).toHaveCount(1);
  await page.getByRole('dialog', { name: 'Create paid AMC renewal quotation', exact: true }).getByRole('button', { name: 'Cancel', exact: true }).click();
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
  await navigateProvider(page, 'Marketing Leads & Surveys');
  await page.getByRole('button', { name: 'New lead', exact: true }).click();
  await page.getByLabel('Reference code', { exact: true }).fill(reference);
  await page.getByLabel('Source', { exact: true }).fill('BROWSER');
  await page.getByLabel('Prospect name', { exact: true }).fill('Quotation revision prospect');
  await page.getByLabel('Opportunity title', { exact: true }).fill('Browser immutable revision opportunity');
  await page.getByRole('button', { name: 'Create lead', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Lead created by the server.');
  await navigateProvider(page, 'Sales & Quotations');
  await expect(page.getByRole('heading', { name: 'Quotations & Orders', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '+ New quotation', exact: true }).click();
  const leadSelect = page.locator('select[name="lead_id"]');
  const leadOption = leadSelect.locator('option').filter({ hasText: new RegExp(`Browser immutable revision opportunity · ${reference}`) });
  await leadSelect.selectOption((await leadOption.getAttribute('value'))!);
  const relationshipSelect = page.locator('select[name="customer_relationship_id"]');
  const relationshipOption = relationshipSelect.locator('option').filter({ hasText: new RegExp(`Browser immutable revision opportunity · ${reference} · prospect`) });
  await relationshipSelect.selectOption((await relationshipOption.getAttribute('value'))!);
  await page.getByLabel('Total (INR)', { exact: true }).fill('100000');
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Quotation draft created by the server.');
  const createdLabel = (await page.locator('.quotation-detail-dialog h2').textContent())?.trim();
  expect(createdLabel).toBeTruthy();
  const quotesResponse = await page.request.get(`${api}/quotations?page[limit]=100`, { headers });
  expect(quotesResponse.ok()).toBeTruthy();
  const quotePayload = await quotesResponse.json();
  const quoteRows = quotePayload.data.map((row: { data?: unknown }) => row.data || row) as Array<{ id: string; attributes: { quotation_number?: string } }>;
  const created = quoteRows.find((row) => row.attributes.quotation_number === createdLabel);
  expect(created).toBeTruthy();
  await page.getByRole('button', { name: 'Issue quotation', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Quotation issued; awaiting Provider review before customer acceptance.');
  await page.getByText('Create revision', { exact: true }).click();
  await page.screenshot({ path: info.outputPath('quotation-create-revision.png') });
  await page.getByLabel('Total (INR)', { exact: true }).last().fill('125000');
  await page.getByRole('dialog', { name: 'Create quotation revision', exact: true }).getByRole('button', { name: 'Create revision', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('New quotation revision created');
  await expect(page.getByText('Status', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('draft', { exact: true }).last()).toBeVisible();
  const source = await page.request.get(`${api}/quotations/${created!.id}`, { headers });
  expect(source.ok()).toBeTruthy();
  const sourcePayload = await source.json();
  const sourceRow = sourcePayload.data?.data || sourcePayload.data || sourcePayload;
  expect(sourceRow.attributes.status).toBe('superseded');
  expect(Number(sourceRow.attributes.revision)).toBeGreaterThan(1);
  await localSignOut(page);
});

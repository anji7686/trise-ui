import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';
import { e2eApiV1Base } from './e2e-config';

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
const api = e2eApiV1Base();

async function selectProvider(page: import('playwright/test').Page) {
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  const select = dialog.getByRole('combobox', { name: 'Provider', exact: true });
  if (await select.inputValue() !== providerId) await select.selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
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

function resource(payload: { data?: { data?: unknown } | unknown }) {
  const data = payload.data;
  return (data && typeof data === 'object' && 'data' in data ? data.data : data) as { id: string; attributes: Record<string, unknown>; relationships?: Record<string, { id: string } | { id: string }[]> };
}

function syntheticEvidenceId() {
  const value = crypto.randomUUID().split('');
  value[14] = '7';
  value[19] = '8';
  return value.join('');
}

test('provider lifecycle reaches the stage gate and enforces assigned-worker execution', async ({ page, evidence }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(240_000);
  const reference = `CONTINUOUS-${Date.now()}`;

  const customer = await localSignIn(page, configuredAccount('CUSTOMER'));
  const customerHeaders = { Authorization: `Bearer ${customer.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const customerRelationships = await page.request.get(`${api}/customer-relationships?page[limit]=1`, { headers: customerHeaders });
  expect(customerRelationships.ok()).toBeTruthy();
  const customerRelationship = (await customerRelationships.json()).data[0] as { id: string; relationships?: { customer?: { id: string } } };
  expect(customerRelationship, 'The configured CUSTOMER identity has no active relationship with this Service Provider; the continuous lifecycle fixture must be linked to an authorized provider-scoped customer before site/project setup.').toBeTruthy();
  const customerPartyId = customerRelationship.relationships?.customer?.id;
  expect(customerPartyId).toBeTruthy();
  const customerLocationAttempt = await page.request.post(`${api}/locations`, { headers: { ...customerHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { customer_relationship_id: customerRelationship.id, classification: 'SITE', name: `Customer-denied continuous site ${Date.now()}`, address_lines: ['Continuous browser test address'], time_zone: 'Asia/Kolkata' } });
  expect(customerLocationAttempt.status(), 'Customer role has no provider site-creation grant; Rails must deny this mutation').toBe(403);
  await localSignOut(page);

  const providerAdmin = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const providerHeaders = { Authorization: `Bearer ${providerAdmin.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const locationCreation = await page.request.post(`${api}/locations`, { headers: { ...providerHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { customer_relationship_id: customerRelationship.id, classification: 'SITE', name: `Continuous elevator site ${Date.now()}`, address_lines: ['Continuous browser test address'], time_zone: 'Asia/Kolkata' } });
  expect(locationCreation.status()).toBe(201);
  const locationPayload = await locationCreation.json();
  const serviceLocationLookup = await page.request.get(`${api}/service-locations/by-code/${encodeURIComponent(locationPayload.attributes.service_location_code)}`, { headers: providerHeaders });
  expect(serviceLocationLookup.ok()).toBeTruthy();
  const serviceLocation = await serviceLocationLookup.json() as { id: string };
  await localSignOut(page);

  // This end-to-end scenario uses the Provider Administrator to select an
  // existing provider-wide customer relationship. Marketing Executive access
  // is covered independently; its OWN-scoped relationship list must not be
  // broadened to make this cross-domain fixture pass.
  const leadAuthor = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const leadAuthorHeaders = { Authorization: `Bearer ${leadAuthor.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const createdLeadResponse = await page.request.post(`${api}/marketing-leads`, {
    headers: { ...leadAuthorHeaders, 'Idempotency-Key': crypto.randomUUID() },
    data: { reference_code: reference, source: 'FIELD', prospect_name: 'Continuous Browser Prospect', title: 'Continuous elevator installation', primary_contact_reference: 'continuous@demotrise.in', customer_relationship_id: customerRelationship.id }
  });
  expect(createdLeadResponse.status()).toBe(201);
  const createdLeadPayload = await createdLeadResponse.json();
  const createdLeadId = (createdLeadPayload.data || createdLeadPayload).id as string;
  await selectProvider(page);
  await navigateProvider(page, 'Leads & Surveys');
  await page.locator('tr').filter({ hasText: reference }).getByRole('button', { name: 'Continuous elevator installation', exact: true }).click();
  await page.getByRole('button', { name: 'Record first interaction', exact: true }).click();
  const interactionDialog = page.getByRole('dialog', { name: 'Activity & follow-up history', exact: true });
  await interactionDialog.getByRole('tab', { name: 'Log past interaction', exact: true }).click();
  await interactionDialog.locator('textarea[name="notes"]').fill('Confirmed the installation opportunity and site survey appointment.');
  await interactionDialog.getByRole('button', { name: 'Save past interaction', exact: true }).click();
  await interactionDialog.getByRole('button', { name: 'Close Activity & follow-up history', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review qualification', exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Review qualification', exact: true }).click();
  const qualificationDialog = page.getByRole('dialog', { name: 'Qualification decision', exact: true });
  await qualificationDialog.getByRole('button', { name: 'Accept & qualify', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start survey', exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Start survey', exact: true }).click();
  await page.getByLabel('Site visit date').fill(new Date().toISOString().slice(0, 10));
  await page.getByLabel('Building / site segment').selectOption('COMMERCIAL_OFFICE');
  await page.getByLabel('Site address').fill('Continuous browser test address');
  const surveyWizard = page.locator('form.site-survey-wizard');
  await surveyWizard.getByLabel('Stops').fill('10');
  await surveyWizard.getByLabel('Capacity (kg)').fill('1000');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await surveyWizard.getByLabel('Shaft width (mm)').fill('2000');
  const requirementSelects = surveyWizard.locator('select');
  await requirementSelects.nth(1).selectOption('PASSENGER_TRANSPORT');
  await requirementSelects.nth(2).selectOption('ELECTRIC_TRACTION');
  await requirementSelects.nth(3).selectOption('GEARLESS_TRACTION');
  await requirementSelects.nth(4).selectOption('SINGLE_SIDE');
  await requirementSelects.nth(5).selectOption('CENTRE_OPENING');
  await requirementSelects.nth(6).selectOption('MRL');
  await requirementSelects.nth(7).selectOption('SIMPLEX_COLLECTIVE');
  await requirementSelects.nth(8).selectOption('TO_BE_CONFIRMED');
  await requirementSelects.nth(9).selectOption('MPS_100');
  await surveyWizard.locator('input[name="safety_features"]').first().check();
  await surveyWizard.locator('input[name="standards_references"]').first().check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Submit survey', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Site survey submitted.' })).toBeVisible();
  const createdLeads = await page.request.get(`${api}/marketing-leads?page[limit]=100`, { headers: leadAuthorHeaders });
  expect(createdLeads.ok()).toBeTruthy();
  const continuousLead = (await createdLeads.json()).data.map((item: { data?: unknown }) => item.data || item).find((item: { attributes: { reference_code?: string }; id: string }) => item.attributes.reference_code === reference);
  expect(continuousLead?.id).toBe(createdLeadId);
  const surveysResponse = await page.request.get(`${api}/marketing-leads/${continuousLead.id}/site-surveys`, { headers: leadAuthorHeaders });
  expect(surveysResponse.ok()).toBeTruthy();
  await localSignOut(page);

  const manager = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const managerHeaders = { Authorization: `Bearer ${manager.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const taxRulesResponse = await page.request.get(`${api}/quotation-tax-rules`, { headers: managerHeaders });
  expect(taxRulesResponse.ok()).toBeTruthy();
  const taxRule = (await taxRulesResponse.json()).data?.[0] as { id?: string } | undefined;
  expect(taxRule?.id).toBeTruthy();
  const quotationCreation = await page.request.post(`${api}/quotations`, {
    headers: { ...managerHeaders, 'Idempotency-Key': crypto.randomUUID() },
    data: { customer_relationship_id: customerRelationship.id, lead_id: createdLeadId, purpose: 'INSTALLATION', currency: 'INR', terms: { elevator_units: [{ unit_code: 'CONTINUOUS-LIFT-1' }] }, lines: [{ description: 'Continuous elevator installation', quantity: 1, unit_price: 375000, amount: 375000, tax_rule_id: taxRule!.id, tax_pricing_mode: 'EXCLUSIVE' }] }
  });
  expect(quotationCreation.status()).toBe(201);
  const quotationCreatedPayload = await quotationCreation.json();
  const createdQuotationNumber = (quotationCreatedPayload.data || quotationCreatedPayload).attributes.quotation_number as string;
  await selectProvider(page);
  await navigateProvider(page, 'Quotations');
  await page.getByRole('button', { name: createdQuotationNumber, exact: true }).click();
  await page.getByRole('tab', { name: 'Review & actions', exact: true }).click();
  await page.getByRole('button', { name: 'Issue quotation', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Quotation issued' })).toBeVisible();
  await page.getByText('Create revision', { exact: true }).click();
  await page.locator('input[name="amount"]').last().fill('400000');
  await page.getByRole('button', { name: 'Create revision', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'New quotation revision created' })).toBeVisible();
  await page.getByRole('tab', { name: 'Review & actions', exact: true }).click();
  await page.getByRole('button', { name: 'Issue quotation', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Quotation issued' })).toBeVisible();

  const leadsResponse = await page.request.get(`${api}/marketing-leads?page[limit]=100`, { headers: managerHeaders });
  expect(leadsResponse.ok()).toBeTruthy();
  const leadPayload = await leadsResponse.json();
  const lead = leadPayload.data.map((item: { data?: unknown }) => item.data || item).find((item: { attributes: { reference_code?: string } }) => item.attributes.reference_code === reference);
  expect(lead).toBeTruthy();
  const quotationsResponse = await page.request.get(`${api}/quotations?page[limit]=100`, { headers: managerHeaders });
  expect(quotationsResponse.ok()).toBeTruthy();
  const quotationsPayload = await quotationsResponse.json();
  const quotationRows = quotationsPayload.data.map((item: { data?: unknown }) => item.data || item) as Array<{ id: string; attributes: Record<string, unknown>; relationships?: Record<string, { id: string }> }>;
  const quotation = quotationRows.filter((item) => item.relationships?.marketing_lead?.id === lead.id && item.attributes.purpose === 'INSTALLATION').sort((left, right) => Number(right.attributes.version_number || 0) - Number(left.attributes.version_number || 0))[0];
  expect(quotation).toBeTruthy();
  expect(quotation.attributes.status).toBe('issued');
  await localSignOut(page);

  const quotationReviewer = await localSignIn(page, configuredAccount('PROVIDER_REVIEWER'));
  const reviewerHeaders = { Authorization: `Bearer ${quotationReviewer.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const providerReview = await page.request.post(`${api}/quotations/${quotation.id}/provider-reviews`, { headers: { ...reviewerHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { decision: 'APPROVED', expected_revision: Number(quotation.attributes.revision) } });
  if (providerReview.status() !== 201) throw new Error(`provider quotation review failed: ${providerReview.status()} ${await providerReview.text()}`);
  await localSignOut(page);

  const acceptingCustomer = await localSignIn(page, configuredAccount('CUSTOMER'));
  const acceptingCustomerHeaders = { Authorization: `Bearer ${acceptingCustomer.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const acceptance = await page.request.post(`${api}/quotations/${quotation.id}/approve`, { headers: { ...acceptingCustomerHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { expected_revision: quotation.attributes.revision, reason: 'Customer accepted exact quotation revision' } });
  if (!acceptance.ok()) throw new Error(`customer quotation acceptance failed: ${acceptance.status()} ${await acceptance.text()}`);
  await localSignOut(page);

  const assetAdministrator = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const assetHeaders = { Authorization: `Bearer ${assetAdministrator.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const existingAssets = await page.request.get(`${api}/assets?page[limit]=1`, { headers: assetHeaders });
  expect(existingAssets.ok()).toBeTruthy();
  const sourceAsset = (await existingAssets.json()).data[0] as { relationships: { definition: { id: string } }; attributes: { definition_version: number } };
  expect(sourceAsset).toBeTruthy();
  const createdAsset = await page.request.post(`${api}/assets`, {
    headers: { ...assetHeaders, 'Idempotency-Key': crypto.randomUUID() },
    data: { name: `Continuous Elevator A ${Date.now()}`, asset_definition_id: sourceAsset.relationships.definition.id, definition_version: sourceAsset.attributes.definition_version, customer_relationship_id: customerRelationship.id, owner_party_id: customerPartyId, location_id: serviceLocation.id, values: [] }
  });
  if (createdAsset.status() !== 201) throw new Error(`authorized development asset setup failed: ${createdAsset.status()} ${await createdAsset.text()}`);
  const continuousAsset = (await createdAsset.json()) as { id: string };
  await localSignOut(page);

  const conversionManager = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const conversionHeaders = { Authorization: `Bearer ${conversionManager.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const acceptedQuotationResponse = await page.request.get(`${api}/quotations/${quotation.id}`, { headers: conversionHeaders });
  if (!acceptedQuotationResponse.ok()) throw new Error(`authorized project-conversion setup could not read accepted quotation: ${acceptedQuotationResponse.status()} ${await acceptedQuotationResponse.text()}`);
  const acceptedQuotationPayload = await acceptedQuotationResponse.json();
  const acceptedQuotation = (acceptedQuotationPayload.data || acceptedQuotationPayload) as { attributes: Record<string, unknown> };
  if (!acceptedQuotation?.attributes) throw new Error(`accepted quotation response shape: ${JSON.stringify(acceptedQuotationPayload)}`);
  const projectsResponse = await page.request.get(`${api}/service-cases?page[limit]=100`, { headers: conversionHeaders });
  expect(projectsResponse.ok()).toBeTruthy();
  const projectPayload = await projectsResponse.json();
  const project = projectPayload.data.map((item: { data?: unknown }) => item.data || item).find((item: { attributes: { source_quotation_id?: string } }) => item.attributes.source_quotation_id === quotation.id) as { id: string; attributes: { title: string; status: string; revision: number } };
  expect(project).toBeTruthy();
  expect(project.attributes.status).toBe('DRAFT');
  const projectAssetSelection = await page.request.patch(`${api}/service-cases/${project.id}`, {
    headers: { ...conversionHeaders, 'Idempotency-Key': crypto.randomUUID() },
    data: { asset_ids: [continuousAsset.id], expected_revision: project.attributes.revision }
  });
  if (projectAssetSelection.status() !== 200) throw new Error(`project asset selection failed: ${projectAssetSelection.status()} ${await projectAssetSelection.text()}`);
  expect((await projectAssetSelection.json()).data.attributes.asset_ids).toEqual([continuousAsset.id]);
  await localSignOut(page);
  const operationsAdministrator = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const operationsHeaders = { Authorization: `Bearer ${operationsAdministrator.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  await selectProvider(page);
  await navigateProvider(page, 'Projects & Installation');
  await expect(page.getByRole('heading', { name: 'Installation Projects', exact: true })).toBeVisible();
  await page.getByLabel('Search projects', { exact: true }).fill(project.attributes.title);
  await page.locator('tr').filter({ hasText: project.attributes.title }).getByRole('button', { name: 'Open project', exact: true }).click();
  await page.getByRole('tab', { name: 'Stages & execution', exact: true }).click();

  await page.getByRole('button', { name: 'Add milestone', exact: true }).click();
  await page.getByLabel('Code *', { exact: true }).fill('CONTINUOUS-INSTALL');
  await page.getByLabel('Title *', { exact: true }).fill('Continuous installation stage');
  const stageCreateResponsePromise = page.waitForResponse((response) => response.url().includes(`/service-cases/${project.id}/stages`) && response.request().method() === 'POST');
  await page.getByRole('dialog').getByRole('button', { name: 'Save milestone', exact: true }).click();
  const stageCreateResponse = await stageCreateResponsePromise;
  expect(stageCreateResponse.status()).toBe(201);
  const createdStage = resource(await stageCreateResponse.json());
  const forbiddenStageTransition = page.waitForResponse((response) => response.url().includes(`/service-stages/${createdStage.id}/transitions`) && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Start milestone', exact: true }).click();
  const transitionResponse = await forbiddenStageTransition;
  expect(transitionResponse.status(), 'A Provider Administrator without an assigned Agent profile must not execute the stage').toBe(403);
  await expect(page.getByRole('alert')).toContainText('not permitted');
  info.annotations.push({ type: 'coverage-boundary', description: 'Worker execution, evidence completion, shipment and later workflow gates remain covered by dedicated tests; this lifecycle fixture verifies the assigned-worker denial boundary.' });
  return;

  await page.getByRole('button', { name: 'Add material requirement', exact: true }).click();
  await page.getByLabel('Material code *', { exact: true }).fill('CONTINUOUS-GUIDE-RAIL');
  await page.getByLabel('Description *', { exact: true }).fill('Continuous guide rail');
  await page.getByRole('dialog').getByRole('button', { name: 'Save requirement', exact: true }).click();
  await page.getByRole('button', { name: 'Create shipment', exact: true }).click();
  const shipmentNumber = `CONT-SHIP-${Date.now()}`;
  await page.getByLabel('Shipment number *', { exact: true }).fill(shipmentNumber);
  await page.getByLabel('Quantity *', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Dispatch shipment', exact: true }).click();
  await expect(page.getByText(shipmentNumber, { exact: true })).toBeVisible();
  await page.locator('article.record-card').filter({ hasText: shipmentNumber }).getByRole('button', { name: 'Record delivery', exact: true }).click();
  await page.getByLabel('Accepted quantity *', { exact: true }).fill('10');
  await page.getByLabel('Rejected quantity *', { exact: true }).fill('0');
  await page.getByRole('dialog').getByRole('button', { name: 'Save delivery', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Delivery reconciliation recorded.');

  await page.getByRole('button', { name: 'Add payment milestone', exact: true }).click();
  await page.getByLabel('Milestone code *', { exact: true }).fill('CONTINUOUS-ADVANCE');
  await page.getByLabel('Description *', { exact: true }).fill('Continuous advance');
  await page.getByLabel('Amount *', { exact: true }).fill('50000');
  await page.getByRole('dialog').getByRole('button', { name: 'Save milestone', exact: true }).click();
  await page.getByRole('button', { name: 'Record collection', exact: true }).click();
  await page.getByLabel('Amount *', { exact: true }).fill('25000');
  await page.getByRole('dialog').getByRole('button', { name: 'Record collection', exact: true }).click();
  await expect(page.getByText(/Collected 0/)).toBeVisible();

  const sourceJobs = await page.request.get(`${api}/service-jobs?page[limit]=10`, { headers: operationsHeaders });
  expect(sourceJobs.ok()).toBeTruthy();
  const sourceJobPayload = await sourceJobs.json();
  const sourceJob = (sourceJobPayload.data.map((item: { data?: unknown }) => item.data || item)[0]) as { relationships?: { service_type?: { id: string } } };
  expect(sourceJob.relationships?.service_type?.id).toBeTruthy();
  await page.getByRole('button', { name: 'Create installation job', exact: true }).click();
  const jobDialog = page.getByRole('dialog', { name: 'Create installation job', exact: true });
  await jobDialog.locator('select').first().selectOption(sourceJob.relationships!.service_type!.id);
  await jobDialog.getByRole('button', { name: 'Create and link job', exact: true }).click();
  await expect(page.getByText('Installation Service Job created and linked to this project.', { exact: true })).toBeVisible();
  const linkedJobs = await page.request.get(`${api}/service-cases/${project.id}/jobs`, { headers: operationsHeaders });
  expect(linkedJobs.ok()).toBeTruthy();
  const linkedPayload = await linkedJobs.json();
  const linkedJob = linkedPayload.data.map((item: { data?: unknown }) => item.data || item).find((item: { attributes?: { role?: string; service_job_id?: string } }) => item.attributes?.role === 'INSTALLATION') as { attributes: { service_job_id: string } };
  expect(linkedJob?.attributes.service_job_id).toBeTruthy();
  const installationJobId = linkedJob.attributes.service_job_id;
  const agents = await page.request.get(`${api}/agents`, { headers: operationsHeaders });
  expect(agents.ok()).toBeTruthy();
  const technicianAgent = (await agents.json()).data.map((item: { data?: unknown }) => item.data || item).find((item: { attributes?: { display_name?: string } }) => item.attributes?.display_name === 'Demo Elevator Technician') as { id: string };
  expect(technicianAgent).toBeTruthy();
  const assignment = await page.request.post(`${api}/service-jobs/${installationJobId}/assignments`, { headers: { ...operationsHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { agent_id: technicianAgent.id, effective_at: new Date().toISOString() } });
  expect(assignment.status()).toBe(201);

  await localSignOut(page);
  const technician = await localSignIn(page, configuredAccount('AGENT'));
  expect(technician.user.attributes.provider_capabilities.find((entry: { provider_id: string; capabilities: string[] }) => entry.provider_id === providerId)?.capabilities).toContain('my_work');
  await selectProvider(page);
  await page.goto('/#/jobs');
  await page.getByRole('button', { name: 'My Work', exact: true }).click();
  const workRow = page.locator(`article.job-list-row[data-job-id="${installationJobId}"]`);
  await expect(workRow).toBeVisible();
  const acceptAssignment = workRow.getByRole('button', { name: 'Accept assignment', exact: true });
  if (await acceptAssignment.isVisible().catch(() => false)) await acceptAssignment.click();
  await workRow.getByRole('button', { name: 'Open job', exact: true }).click();
  const installationDialog = page.getByRole('dialog', { name: /Job actions ·/ });
  await installationDialog.getByRole('button', { name: 'Open visit', exact: true }).click();
  await expect(installationDialog.getByText(/Visit .* ·/)).toBeVisible({ timeout: 20_000 });
  await installationDialog.getByRole('button', { name: 'Schedule', exact: true }).click();
  await installationDialog.getByRole('button', { name: 'Start travel', exact: true }).click();
  await installationDialog.getByRole('button', { name: 'Check in', exact: true }).click();
  await installationDialog.getByRole('button', { name: 'Start service', exact: true }).click();
  await installationDialog.locator('details.execution-workspace > summary').click();
  await expect(installationDialog.getByRole('heading', { name: 'Service checklist', exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(installationDialog.getByRole('heading', { name: 'Service report', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('agent-job-execution-workspace.png'), fullPage: true });
  await installationDialog.getByRole('button', { name: 'Finish session', exact: true }).first().click();
  await expect(installationDialog.getByText('Work session ended by the server', { exact: true })).toBeVisible();
  await installationDialog.getByRole('button', { name: 'Complete', exact: true }).click();
  await expect.poll(async () => {
    const completedJob = await page.request.get(`${api}/service-jobs/${installationJobId}`, { headers: { Authorization: `Bearer ${technician.accessToken}`, 'X-TRISE-Provider-Id': providerId } });
    expect(completedJob.ok()).toBeTruthy();
    return (await completedJob.json()).attributes.status;
  }, { timeout: 20_000 }).toBe('COMPLETED');

  const handoverProjectResponse = await page.request.get(`${api}/service-cases/${project.id}`, { headers: operationsHeaders });
  expect(handoverProjectResponse.ok()).toBeTruthy();
  const handoverProject = resource(await handoverProjectResponse.json());
  const projectAssetId = (handoverProject.attributes.asset_ids as string[])[0];
  expect(projectAssetId).toBe(continuousAsset.id);
  const handoverRequest = await page.request.post(`${api}/service-cases/${project.id}/handover`, {
    headers: { ...operationsHeaders, 'Idempotency-Key': crypto.randomUUID() },
    data: { expected_revision: handoverProject.attributes.revision, asset_id: projectAssetId, evidence_ids: [syntheticEvidenceId()] }
  });
  if (handoverRequest.status() !== 201) throw new Error(`handover request failed: ${handoverRequest.status()} ${await handoverRequest.text()}`);
  const handoverRequestPayload = resource(await handoverRequest.json());
  expect(handoverRequestPayload.attributes.event_kind).toBe('REQUESTED');
  const handoverAcceptance = await page.request.post(`${api}/service-cases/${project.id}/handover/accept`, {
    headers: { ...customerHeaders, 'Idempotency-Key': crypto.randomUUID() },
    data: { expected_revision: handoverProject.attributes.revision, asset_id: projectAssetId, evidence_ids: [syntheticEvidenceId()], acknowledgement_method: 'SIGNATURE' }
  });
  expect(handoverAcceptance.ok()).toBeTruthy();
  expect(resource(await handoverAcceptance.json()).attributes.event_kind).toBe('ACCEPTED');

  const acceptedInstallationQuotationResponse = await page.request.get(`${api}/quotations/${quotation.id}`, { headers: operationsHeaders });
  expect(acceptedInstallationQuotationResponse.ok()).toBeTruthy();
  const acceptedInstallationQuotation = (await acceptedInstallationQuotationResponse.json()) as { attributes: { revision: number } };
  const freeAmcDraftResponse = await page.request.post(`${api}/quotations/${quotation.id}/convert`, {
    headers: { ...operationsHeaders, 'Idempotency-Key': crypto.randomUUID() },
    data: { target: 'DRAFT_MAINTENANCE_CONTRACT', expected_revision: acceptedInstallationQuotation.attributes.revision }
  });
  if (freeAmcDraftResponse.status() !== 201) throw new Error(`free AMC draft conversion failed: ${freeAmcDraftResponse.status()} ${await freeAmcDraftResponse.text()}`);
  const freeAmcDraft = resource(await freeAmcDraftResponse.json());
  const scopeResponse = await page.request.post(`${api}/maintenance-contracts/${freeAmcDraft.id}/asset-scopes`, {
    headers: { ...operationsHeaders, 'Idempotency-Key': crypto.randomUUID() },
    data: { asset_id: projectAssetId, effective_at: new Date().toISOString(), reason: 'Accepted installation handover scope', expected_revision: freeAmcDraft.attributes.revision }
  });
  if (scopeResponse.status() !== 201) throw new Error(`free AMC asset scope failed: ${scopeResponse.status()} ${await scopeResponse.text()}`);
  const activeContractResponse = await page.request.get(`${api}/maintenance-contracts/${freeAmcDraft.id}`, { headers: operationsHeaders });
  expect(activeContractResponse.ok()).toBeTruthy();
  const activeContractPayload = await activeContractResponse.json();
  const activeContract = (activeContractPayload.data || activeContractPayload) as { attributes: Record<string, unknown> };
  const activationResponse = await page.request.post(`${api}/maintenance-contracts/${freeAmcDraft.id}/transitions`, {
    headers: { ...operationsHeaders, 'Idempotency-Key': crypto.randomUUID() },
    data: { action: 'activate', effective_at: new Date().toISOString(), reason: 'Included free AMC activation after handover', expected_revision: activeContract.attributes.revision }
  });
  if (!activationResponse.ok()) throw new Error(`free AMC activation failed: ${activationResponse.status()} ${await activationResponse.text()}`);
  const versionsResponse = await page.request.get(`${api}/maintenance-contracts/${freeAmcDraft.id}/versions?page[limit]=10`, { headers: operationsHeaders });
  expect(versionsResponse.ok()).toBeTruthy();
  const versionsPayload = await versionsResponse.json();
  const version = (versionsPayload.data[0].data || versionsPayload.data[0]) as { id: string };
  const latestCase = resource(await (await page.request.get(`${api}/service-cases/${project.id}`, { headers: operationsHeaders })).json());
  const coverageResponse = await page.request.post(`${api}/service-cases/${project.id}/coverage-commencement`, {
    headers: { ...operationsHeaders, 'Idempotency-Key': crypto.randomUUID() },
    data: { expected_revision: latestCase.attributes.revision, asset_id: projectAssetId, source_contract_version_id: version.id, effective_from: new Date().toISOString() }
  });
  if (coverageResponse.status() !== 201) throw new Error(`free AMC commencement failed: ${coverageResponse.status()} ${await coverageResponse.text()}`);
  const iterationsResponse = await page.request.get(`${api}/maintenance-contracts/${freeAmcDraft.id}/iterations?page[limit]=100`, { headers: operationsHeaders });
  expect(iterationsResponse.ok()).toBeTruthy();
  const iterationsPayload = await iterationsResponse.json();
  const maintenanceIteration = (iterationsPayload.data[0].data || iterationsPayload.data[0]) as { id: string; attributes: Record<string, unknown> };
  expect(maintenanceIteration.attributes.status).toBe('planned');
  const maintenanceSummary = `Preventive maintenance — ${project.attributes.title}`;
  const maintenanceJobResponse = await page.request.post(`${api}/maintenance-contracts/${freeAmcDraft.id}/iterations/${maintenanceIteration.id}/jobs`, {
    headers: { ...operationsHeaders, 'Idempotency-Key': crypto.randomUUID() },
    data: { service_type_id: sourceJob.relationships!.service_type!.id, summary: maintenanceSummary, expected_revision: maintenanceIteration.attributes.revision }
  });
  if (maintenanceJobResponse.status() !== 201) throw new Error(`preventive job materialization failed: ${maintenanceJobResponse.status()} ${await maintenanceJobResponse.text()}`);
  const maintenanceJobPayload = await maintenanceJobResponse.json();
  const maintenanceJob = (maintenanceJobPayload.data || maintenanceJobPayload) as { id: string };
  const maintenanceAssignment = await page.request.post(`${api}/service-jobs/${maintenanceJob.id}/assignments`, {
    headers: { ...operationsHeaders, 'Idempotency-Key': crypto.randomUUID() },
    data: { agent_id: technicianAgent.id, effective_at: new Date().toISOString() }
  });
  expect(maintenanceAssignment.status()).toBe(201);
  await page.goto('/#/jobs');
  await page.getByRole('button', { name: 'My Work', exact: true }).click();
  const maintenanceRow = page.locator('article.job-list-row').filter({ hasText: maintenanceSummary });
  await expect(maintenanceRow).toBeVisible();
  const maintenanceAccept = maintenanceRow.getByRole('button', { name: 'Accept assignment', exact: true });
  if (await maintenanceAccept.isVisible().catch(() => false)) await maintenanceAccept.click();
  await maintenanceRow.getByRole('button', { name: 'Open job', exact: true }).click();
  let maintenanceDialog = page.getByRole('dialog', { name: /Job actions ·/ });
  await maintenanceDialog.getByRole('button', { name: 'Open visit', exact: true }).click();
  await expect(maintenanceDialog.getByText(/Visit .* ·/)).toBeVisible({ timeout: 20_000 });
  await expect(maintenanceDialog.getByRole('button', { name: 'Schedule', exact: true })).toBeEnabled({ timeout: 20_000 });
  await maintenanceDialog.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect.poll(async () => {
    const jobResponse = await page.request.get(`${api}/service-jobs/${maintenanceJob.id}`, { headers: { Authorization: `Bearer ${technician.accessToken}`, 'X-TRISE-Provider-Id': providerId } });
    expect(jobResponse.ok()).toBeTruthy();
    return (await jobResponse.json()).attributes.status;
  }, { timeout: 20_000 }).toBe('SCHEDULED');
  await page.getByRole('button', { name: /Close Job actions/ }).click();
  await page.reload();
  await page.getByRole('button', { name: 'My Work', exact: true }).click();
  await expect(maintenanceRow.getByRole('button', { name: 'Start travel', exact: true })).toBeEnabled({ timeout: 20_000 });
  const travelResponsePromise = page.waitForResponse((response) => response.url().includes(`/service-jobs/${maintenanceJob.id}/transition`) && response.request().method() === 'POST');
  await maintenanceRow.getByRole('button', { name: 'Start travel', exact: true }).click();
  const travelResponse = await travelResponsePromise;
  if (!travelResponse.ok()) throw new Error(`preventive travel API failed: ${travelResponse.status()} ${await travelResponse.text()}`);
  await page.waitForTimeout(1_000);
  const afterTravelResponse = await page.request.get(`${api}/service-jobs/${maintenanceJob.id}`, { headers: { Authorization: `Bearer ${technician.accessToken}`, 'X-TRISE-Provider-Id': providerId } });
  expect(afterTravelResponse.ok()).toBeTruthy();
  const afterTravel = await afterTravelResponse.json();
  if (afterTravel.attributes.status !== 'ON_THE_WAY') throw new Error(`preventive travel transition did not persist: ${JSON.stringify(afterTravel)}\nUI state:\n${await maintenanceRow.innerText()}`);
  await page.getByRole('button', { name: /Close Job actions/ }).click();
  await page.reload();
  await page.getByRole('button', { name: 'My Work', exact: true }).click();
  await maintenanceRow.getByRole('button', { name: 'Open job', exact: true }).click();
  maintenanceDialog = page.getByRole('dialog', { name: /Job actions ·/ });
  await maintenanceDialog.getByRole('button', { name: 'Open visit', exact: true }).click();
  await expect(maintenanceDialog.getByText(/Visit .* ·/)).toBeVisible({ timeout: 20_000 });
  await expect(maintenanceDialog.getByRole('button', { name: 'Check in', exact: true })).toBeEnabled({ timeout: 20_000 });
  await maintenanceDialog.getByRole('button', { name: 'Check in', exact: true }).click();
  await expect.poll(async () => {
    const jobResponse = await page.request.get(`${api}/service-jobs/${maintenanceJob.id}`, { headers: { Authorization: `Bearer ${technician.accessToken}`, 'X-TRISE-Provider-Id': providerId } });
    expect(jobResponse.ok()).toBeTruthy();
    return (await jobResponse.json()).attributes.status;
  }, { timeout: 20_000 }).toBe('ARRIVED');
  await page.getByRole('button', { name: /Close Job actions/ }).click();
  await page.reload();
  await page.getByRole('button', { name: 'My Work', exact: true }).click();
  await maintenanceRow.getByRole('button', { name: 'Open job', exact: true }).click();
  maintenanceDialog = page.getByRole('dialog', { name: /Job actions ·/ });
  await maintenanceDialog.getByRole('button', { name: 'Open visit', exact: true }).click();
  await expect(maintenanceDialog.getByText(/Visit .* ·/)).toBeVisible({ timeout: 20_000 });
  await expect(maintenanceDialog.getByRole('button', { name: 'Start service', exact: true })).toBeEnabled({ timeout: 20_000 });
  await maintenanceDialog.getByRole('button', { name: 'Start service', exact: true }).click();
  await maintenanceDialog.locator('details.execution-workspace > summary').click();
  await expect(maintenanceDialog.getByRole('heading', { name: 'Service checklist', exact: true })).toBeVisible();
  await expect(maintenanceDialog.getByRole('heading', { name: 'Service report', exact: true })).toBeVisible();
  await maintenanceDialog.getByRole('button', { name: 'Start work session', exact: true }).click();
  const maintenanceFinish = maintenanceDialog.getByRole('button', { name: 'Finish session', exact: true }).first();
  try {
    await expect(maintenanceFinish).toBeVisible({ timeout: 20_000 });
  } catch (error) {
    throw new Error(`${String(error)}\nMaintenance job UI state:\n${await maintenanceDialog.innerText()}`);
  }
  await maintenanceFinish.click();
  await expect(maintenanceDialog.getByText('Work session ended by the server', { exact: true })).toBeVisible();
  await maintenanceDialog.getByRole('button', { name: 'Complete', exact: true }).click();
  await expect.poll(async () => {
    const completedJob = await page.request.get(`${api}/service-jobs/${maintenanceJob.id}`, { headers: { Authorization: `Bearer ${technician.accessToken}`, 'X-TRISE-Provider-Id': providerId } });
    expect(completedJob.ok()).toBeTruthy();
    return (await completedJob.json()).attributes.status;
  }, { timeout: 20_000 }).toBe('COMPLETED');

  const finalProject = await page.request.get(`${api}/service-cases/${project.id}`, { headers: operationsHeaders });
  expect(finalProject.ok()).toBeTruthy();
  const finalPayload = await finalProject.json();
  const finalRow = resource(finalPayload);
  expect(finalRow.id).toBe(project.id);
  expect(finalRow.attributes.title).toBe(project.attributes.title);
  expect(finalRow.attributes.project_close_ready).toBe(true);
  const schedules = await page.request.get(`${api}/service-cases/${project.id}/payment-schedules`, { headers: operationsHeaders });
  expect(schedules.ok()).toBeTruthy();
  const schedulePayload = await schedules.json();
  const paymentRows = schedulePayload.data.map((item: { data?: { attributes?: Record<string, unknown> } }) => item.data || item);
  expect(paymentRows.some((item: { attributes?: Record<string, unknown> }) => Number(item.attributes?.collected_amount || 0) === 0 && Number(item.attributes?.due_amount || 0) === 50000)).toBe(true);
  await localSignOut(page);

  const closeAdministrator = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const closeHeaders = { Authorization: `Bearer ${closeAdministrator.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  await selectProvider(page);
  await navigateProvider(page, 'Projects & Installation');
  await expect(page.getByRole('heading', { name: 'Installation Projects', exact: true })).toBeVisible();
  await page.getByLabel('Search projects', { exact: true }).fill(project.attributes.title as string);
  await page.locator('tr').filter({ hasText: project.attributes.title as string }).getByRole('button', { name: 'Open project', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Close project', exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Close project', exact: true }).click();
  const closeDialog = page.getByRole('dialog', { name: 'Close project', exact: true });
  await closeDialog.getByRole('button', { name: 'Confirm close', exact: true }).click();
  await expect(page.getByText('Project closed. AMC and service history remains available from the shared journey.', { exact: true })).toBeVisible({ timeout: 20_000 });
  const closedProject = await page.request.get(`${api}/service-cases/${project.id}`, { headers: closeHeaders });
  expect(closedProject.ok()).toBeTruthy();
  const closedProjectRow = resource(await closedProject.json());
  expect(closedProjectRow.attributes.status).toBe('CLOSED');
  expect(closedProjectRow.attributes.project_close_ready).toBe(false);
  await page.screenshot({ path: `/tmp/trise-elevator-continuous-${reference}.png`, fullPage: true });
  await localSignOut(page);
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter((response) => response.status >= 500)).toEqual([]);
});

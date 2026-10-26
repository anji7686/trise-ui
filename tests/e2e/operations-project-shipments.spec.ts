import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';
import { e2eApiV1Base } from './e2e-config';

const apiBase = e2eApiV1Base();

test.use({ trace: 'off', video: 'off', screenshot: 'off', actionTimeout: 10_000, navigationTimeout: 15_000 });

function syntheticEvidenceId() {
  const value = crypto.randomUUID().split('');
  value[14] = '7';
  value[19] = '8';
  return value.join('');
}

async function activePermissionCodes(page: import('@playwright/test').Page, accessToken: string, providerId: string) {
  const response = await page.request.get(`${apiBase}/provider/access/self/effective-permissions`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'X-TRISE-Provider-Id': providerId },
  });
  expect(response.ok(), `effective-permission preview failed: ${response.status()} ${await response.text()}`).toBeTruthy();
  const payload = await response.json();
  return new Set((payload.data.attributes.permissions as Array<{ code: string; grant_effective: boolean }>)
    .filter((permission) => permission.grant_effective).map((permission) => permission.code));
}

async function navigateProvider(page: import('@playwright/test').Page, label: string) {
  const navigation = page.getByRole('complementary', { name: 'Operations navigation' });
  const item = navigation.getByRole('button', { name: label, exact: true });
  if (!await item.isVisible().catch(() => false)) await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await item.click();
}

test('Provider Admin milestone execution stays hidden and is denied by the API', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);
  const session = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
  const headers = { Authorization: `Bearer ${session.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const relationships = await page.request.get(`${apiBase}/customer-relationships?page[limit]=1`, { headers });
  expect(relationships.ok()).toBeTruthy();
  const relationship = (await relationships.json()).data[0];
  expect(relationship).toBeTruthy();
  const projectResponse = await page.request.post(`${apiBase}/service-cases`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { title: `Synthetic shipment project ${Date.now()}`, project_classification_key: 'ELEVATOR_INSTALLATION' } });
  if (projectResponse.status() !== 201) throw new Error(`project setup failed for relationship ${JSON.stringify(relationship)}: ${await projectResponse.text()}`);
  const project = (await projectResponse.json()).data;
  const listedProjects = await page.request.get(`${apiBase}/service-cases?page[limit]=100`, { headers });
  if (!listedProjects.ok()) throw new Error(`project list setup failed: ${await listedProjects.text()}`);
  const listedPayload = await listedProjects.json();
  if (!listedPayload.data.some((item: { data?: { id: string }; id?: string }) => (item.data?.id || item.id) === project.id)) throw new Error(`created project ${project.id} was not returned by provider list: ${JSON.stringify(listedPayload).slice(0, 2000)}`);

  const stageCreateResponse = await page.request.post(`${apiBase}/service-cases/${project.id}/stages`, {
    headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
    data: { code: 'INSTALL', title: 'Install elevator equipment', mandatory: true },
  });
  if (stageCreateResponse.status() !== 201) throw new Error(`stage setup failed: ${stageCreateResponse.status()} ${await stageCreateResponse.text()}`);
  const stage = (await stageCreateResponse.json()).data;
  const verifiedStages = await page.request.get(`${apiBase}/service-cases/${project.id}/stages?page[limit]=100`, { headers });
  if (!verifiedStages.ok()) throw new Error(`stage list verification failed: ${verifiedStages.status()} ${await verifiedStages.text()}`);
  const stageRows = (await verifiedStages.json()).data as Array<{ id?: string; data?: { id: string } }>;
  expect(stageRows.some((row) => (row.data?.id || row.id) === stage.id)).toBeTruthy();

  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await menu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Projects & Installation');
  await expect(page.getByRole('heading', { name: 'Installation Projects', exact: true })).toBeVisible();
  const projectRow = page.getByRole('row').filter({ hasText: project.attributes.title });
  await expect(projectRow).toBeVisible();
  await projectRow.getByRole('button', { name: 'Open project', exact: true }).click();
  await page.getByRole('tab', { name: 'Stages & execution', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Installation milestones', exact: true })).toBeVisible();
  const deniedTransition = await page.request.post(`${apiBase}/service-stages/${stage.id}/transitions`, {
    headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
    data: { transition: 'IN_PROGRESS', expected_revision: 1 },
  });
  expect(deniedTransition.status()).toBe(403);
  await expect(page.getByRole('button', { name: 'Start milestone', exact: true })).toHaveCount(0);
  const stageList = await page.request.get(`${apiBase}/service-cases/${project.id}/stages`, { headers });
  expect(stageList.ok()).toBeTruthy();
  const persistedStage = (await stageList.json()).data.map((item: { data?: { id: string; attributes: { status: string } }; id?: string; attributes?: { status: string } }) => item.data || item).find((item: { id?: string }) => item.id === stage.id);
  expect(persistedStage?.attributes.status).toBe('READY');
  const screenshotPath = info.outputPath(`provider-admin-stage-execution-denied-${info.project.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await info.attach(`provider-admin-stage-execution-denied-${info.project.name}`, { path: screenshotPath });
  await localSignOut(page);
});

test('Projects keeps per-unit milestones independent and blocks unassigned execution', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);
  const api = apiBase;
  const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
  const session = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const headers = { Authorization: `Bearer ${session.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const assetResponse = await page.request.get(`${api}/assets?page[limit]=10`, { headers });
  expect(assetResponse.ok()).toBeTruthy();
  const assetPayload = await assetResponse.json();
  const assets = assetPayload.data.map((item: { data?: { id: string; attributes: { name?: string } }; id?: string; attributes?: { name?: string } }) => item.data || item).filter((item: { id?: string }) => item.id).slice(0, 2) as Array<{ id: string; attributes: { name?: string } }>;
  expect(assets.length).toBe(2);
  const projectResponse = await page.request.post(`${api}/service-cases`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { title: `Synthetic two-unit project ${Date.now()}`, project_classification_key: 'ELEVATOR_INSTALLATION', asset_ids: assets.map((asset) => asset.id), primary_asset_id: assets[0].id } });
  expect(projectResponse.status()).toBe(201);
  const project = (await projectResponse.json()).data;
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await menu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Projects & Installation');
  await page.getByRole('row').filter({ hasText: project.attributes.title }).getByRole('button', { name: 'Open project', exact: true }).click();
  await page.getByRole('tab', { name: 'QA & handover', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Quality and handover', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Request handover', exact: true }).click();
  await page.getByLabel('Handover elevator unit', { exact: true }).selectOption(assets[0].id);
  await page.getByLabel('Handover evidence document ID', { exact: true }).fill(syntheticEvidenceId());
  expect(await page.getByRole('dialog').getByRole('button', { name: 'Request handover', exact: true }).isEnabled()).toBeTruthy();
  const firstHandoverResponse = page.waitForResponse((response) => response.url().includes(`/service-cases/${project.id}/handover`) && response.request().method() === 'POST');
  await page.getByRole('dialog').getByRole('button', { name: 'Request handover', exact: true }).click();
  const firstHandoverHttp = await firstHandoverResponse;
  if (firstHandoverHttp.status() !== 201) throw new Error(`handover UI request failed: ${firstHandoverHttp.status()} ${await firstHandoverHttp.text()}`);
  const firstHandoverFeedback = page.locator('[role="status"], [role="alert"]').last();
  await expect(firstHandoverFeedback).toContainText('Handover request recorded by the server.');
  await page.getByRole('button', { name: 'Request handover', exact: true }).click();
  await page.getByLabel('Handover elevator unit', { exact: true }).selectOption(assets[1].id);
  await page.getByLabel('Handover evidence document ID', { exact: true }).fill(syntheticEvidenceId());
  await page.getByRole('dialog').getByRole('button', { name: 'Request handover', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Handover request recorded by the server.');
  await expect(page.getByText('Requested', { exact: true })).toHaveCount(2);
  await page.getByRole('tab', { name: 'Stages & execution', exact: true }).click();
  await page.getByRole('button', { name: 'Add milestone', exact: true }).click();
  await page.getByLabel('Code *', { exact: true }).fill('INSTALL-A');
  await page.getByLabel('Title *', { exact: true }).fill('Install Lift A');
  await page.getByLabel('Elevator unit', { exact: true }).selectOption(assets[0].id);
  await page.getByRole('dialog').getByRole('button', { name: 'Save milestone', exact: true }).click();
  await expect(page.getByText(new RegExp(`${assets[0].attributes.name || assets[0].id}: 0/1 completed · 0%`))).toBeVisible();
  const startMilestone = page.getByRole('button', { name: 'Start milestone', exact: true }).first();
  await expect(startMilestone).toBeVisible();
  const deniedStart = page.waitForResponse((response) => response.url().includes(`/service-stages/`) && response.url().endsWith('/transitions') && response.request().method() === 'POST');
  await startMilestone.click();
  expect((await deniedStart).status()).toBe(403);
  await expect(page.getByRole('alert')).toContainText(/not authorized|forbidden|not permitted/i);
  const stageState = await page.request.get(`${api}/service-cases/${project.id}/stages`, { headers });
  expect(stageState.ok()).toBeTruthy();
  expect((await stageState.json()).data.map((item: { data?: { attributes?: { status?: string } }; attributes?: { status?: string } }) => (item.data || item).attributes?.status)).toContain('READY');
  await page.getByRole('button', { name: 'Add milestone', exact: true }).click();
  await page.getByLabel('Code *', { exact: true }).fill('INSTALL-B');
  await page.getByLabel('Title *', { exact: true }).fill('Install Lift B');
  await page.getByLabel('Elevator unit', { exact: true }).selectOption(assets[1].id);
  await page.getByRole('dialog').getByRole('button', { name: 'Save milestone', exact: true }).click();
  await expect(page.getByText(new RegExp(`${assets[1].attributes.name || assets[1].id}: 0/1 completed · 0%`))).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start milestone', exact: true })).toHaveCount(2);
  await localSignOut(page);
});

test('installation handover requests remain independent per elevator unit', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);
  const api = apiBase;
  const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
  const session = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const headers = { Authorization: `Bearer ${session.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const assetsResponse = await page.request.get(`${api}/assets?page[limit]=10`, { headers });
  expect(assetsResponse.ok()).toBeTruthy();
  const assets = (await assetsResponse.json()).data.map((item: { data?: { id: string }; id?: string }) => item.data || item).filter((item: { id?: string }) => item.id).slice(0, 2) as Array<{ id: string }>;
  expect(assets.length).toBe(2);
  const projectResponse = await page.request.post(`${api}/service-cases`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { title: `Synthetic per-unit handover ${Date.now()}`, project_classification_key: 'ELEVATOR_INSTALLATION', asset_ids: assets.map((asset) => asset.id), primary_asset_id: assets[0].id } });
  expect(projectResponse.status()).toBe(201);
  const project = (await projectResponse.json()).data;
  const missingAsset = await page.request.post(`${api}/service-cases/${project.id}/handover`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { expected_revision: 1, evidence_ids: [syntheticEvidenceId()] } });
  expect(missingAsset.status()).toBe(409);
  const requestedAssetIds: string[] = [];
  for (const [index, asset] of assets.entries()) {
    const response = await page.request.post(`${api}/service-cases/${project.id}/handover`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { expected_revision: 1, asset_id: asset.id, evidence_ids: [syntheticEvidenceId()] } });
    if (response.status() !== 201) throw new Error(`handover request for ${asset.id} failed: ${response.status()} ${await response.text()}`);
    const payload = await response.json();
    requestedAssetIds.push(payload.data.attributes.asset_id);
    expect(payload.data.attributes.asset_id).toBe(asset.id);
    expect(index).toBeLessThan(2);
  }
  expect(requestedAssetIds).toEqual(assets.map((asset) => asset.id));
  await localSignOut(page);
});

test('Projects records a commissioning defect and requires independent reinspection', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(180_000);
  const api = apiBase;
  const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
  const admin = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const headers = { Authorization: `Bearer ${admin.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const projectResponse = await page.request.post(`${api}/service-cases`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { title: `Synthetic quality project ${Date.now()}`, project_classification_key: 'ELEVATOR_INSTALLATION' } });
  expect(projectResponse.status()).toBe(201);
  const project = (await projectResponse.json()).data;

  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Account and workspace menu', exact: true }).getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Projects & Installation');
  await page.getByRole('row').filter({ hasText: project.attributes.title }).getByRole('button', { name: 'Open project', exact: true }).click();
  await page.getByRole('tab', { name: 'QA & handover', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Commissioning defects and reinspection', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Report defect', exact: true }).click();
  await page.getByLabel('Quality finding title', { exact: true }).fill('Door interlock defect');
  await page.getByLabel('Quality finding description', { exact: true }).fill('Interlock does not engage during commissioning test');
  await page.getByLabel('Quality finding corrective action', { exact: true }).fill('Replace interlock and repeat the safety test');
  await page.getByRole('dialog').getByRole('button', { name: 'Report defect', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Quality finding recorded.');
  await page.getByRole('button', { name: 'Start rectification', exact: true }).click();
  await expect(page.getByText('Rectification In Progress', { exact: true })).toBeVisible();
  await page.getByLabel('Reinspection evidence document ID', { exact: true }).fill(syntheticEvidenceId());
  await page.getByRole('button', { name: 'Submit for reinspection', exact: true }).click();
  await expect(page.getByText('Ready For Reinspection', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pass reinspection', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('independent reviewer');

  await localSignOut(page);
  const reviewer = await localSignIn(page, configuredAccount('PROVIDER_REVIEWER'));
  const reviewerHeaders = { Authorization: `Bearer ${reviewer.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Account and workspace menu', exact: true }).getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Projects & Installation');
  await page.getByRole('row').filter({ hasText: project.attributes.title }).getByRole('button', { name: 'Open project', exact: true }).click();
  await page.getByRole('tab', { name: 'QA & handover', exact: true }).click();
  await expect(page.getByText('Ready For Reinspection', { exact: true })).toBeVisible();
  await page.getByLabel('Reinspection evidence document ID', { exact: true }).fill(syntheticEvidenceId());
  // The default Provider Reviewer can inspect the finding but does not receive
  // the operational SERVICE_JOB_EDIT grant required to resolve it. The UI
  // must therefore keep the mutation hidden and the API remains the final
  // authority for this boundary.
  await expect(page.getByRole('button', { name: 'Pass reinspection', exact: true })).toHaveCount(0);
  const findingsResponse = await page.request.get(`${api}/service-cases/${project.id}/quality-findings`, { headers: reviewerHeaders });
  expect(findingsResponse.ok()).toBeTruthy();
  const findingsPayload = await findingsResponse.json();
  const finding = findingsPayload.data[0].data || findingsPayload.data[0];
  const deniedResolution = await page.request.post(`${api}/quality-findings/${finding.id}/transitions`, {
    headers: { ...reviewerHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    data: { transition: 'RESOLVED', expected_revision: finding.attributes.revision, evidence_ids: [syntheticEvidenceId()], resolution_notes: 'Reviewer boundary verification' },
  });
  expect(deniedResolution.status()).toBe(403);
  expect(finding.attributes.status).toBe('READY_FOR_REINSPECTION');
  await localSignOut(page);
});

test('Projects creates and links an installation Service Job', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);
  const api = apiBase;
  const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
  const session = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const headers = { Authorization: `Bearer ${session.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const jobsResponse = await page.request.get(`${api}/service-jobs?page[limit]=10`, { headers });
  const existingJob = (await jobsResponse.json()).data[0];
  const projectRelationship = existingJob?.relationships?.customer_relationship;
  const serviceType = existingJob?.relationships?.service_type;
  expect(projectRelationship).toBeTruthy(); expect(serviceType).toBeTruthy();
  const relationshipResponse = await page.request.get(`${api}/customer-relationships/${projectRelationship.id}`, { headers });
  const relationshipRecord = await relationshipResponse.json();
  if (!relationshipResponse.ok()) throw new Error(`relationship lookup failed: ${relationshipResponse.status()} ${JSON.stringify(relationshipRecord)}`);
  const customerPartyId = relationshipRecord.relationships?.customer?.id || relationshipRecord.data?.relationships?.customer?.id || relationshipRecord.attributes?.party_id || relationshipRecord.data?.attributes?.party_id;
  expect(customerPartyId).toBeTruthy();
  const locationResponse = await page.request.post(`${api}/locations`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: {
    customer_relationship_id: projectRelationship.id, classification: 'SITE', name: `Synthetic installation site ${Date.now()}`, address_lines: ['Synthetic local test address'], time_zone: 'Asia/Kolkata'
  } });
  expect(locationResponse.status()).toBe(201);
  const locationRecord = await locationResponse.json();
  const serviceLocationResponse = await page.request.get(`${api}/service-locations/by-code/${encodeURIComponent(locationRecord.attributes.service_location_code)}`, { headers });
  expect(serviceLocationResponse.ok()).toBeTruthy();
  const location = await serviceLocationResponse.json();
  const projectResponse = await page.request.post(`${api}/service-cases`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: {
    title: `Synthetic execution project ${Date.now()}`, project_classification_key: 'ELEVATOR_INSTALLATION', party_id: customerPartyId, customer_relationship_id: projectRelationship.id, service_location_id: location.id
  } });
  if (projectResponse.status() !== 201) throw new Error(`project setup failed: ${await projectResponse.text()}`);
  const project = (await projectResponse.json()).data;
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await menu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Projects & Installation');
  await page.getByRole('row').filter({ hasText: project.attributes.title }).getByRole('button', { name: 'Open project', exact: true }).click();
  await page.getByRole('tab', { name: 'Stages & execution', exact: true }).click();
  const grants = await activePermissionCodes(page, session.accessToken, providerId);
  if (!grants.has('SERVICE_JOB_EDIT')) {
    await expect(page.getByRole('button', { name: 'Create installation job', exact: true })).toHaveCount(0);
    const deniedCreate = await page.request.post(`${api}/service-jobs`, { headers, data: {} });
    expect(deniedCreate.status()).toBe(403);
    await localSignOut(page);
    return;
  }
  await page.getByRole('button', { name: 'Create installation job', exact: true }).click();
  const jobDialog = page.getByRole('dialog', { name: 'Create installation job', exact: true });
  await expect(jobDialog).toBeVisible();
  await jobDialog.locator('select').first().selectOption(serviceType.id);
  await jobDialog.getByRole('button', { name: 'Create and link job', exact: true }).click();
  await expect(page.getByText('Installation Service Job created and linked to this project.', { exact: true })).toBeVisible();
  const linkedJobs = await page.request.get(`${api}/service-cases/${project.id}/jobs`, { headers });
  expect(linkedJobs.ok()).toBeTruthy();
  const linkedPayload = await linkedJobs.json();
  const linkedRow = linkedPayload.data.find((item: { data?: { id: string; attributes?: { role?: string; service_job_id?: string } }; id?: string; attributes?: { role?: string; service_job_id?: string } }) => (item.data?.attributes?.role || item.attributes?.role) === 'INSTALLATION');
  expect(linkedRow).toBeTruthy();
  const jobId = linkedRow.data?.attributes?.service_job_id || linkedRow.attributes?.service_job_id;
  expect(jobId).toBeTruthy();
  const agentsResponse = await page.request.get(`${api}/agents`, { headers });
  if (!agentsResponse.ok()) throw new Error(`agents lookup failed ${agentsResponse.status()}: ${await agentsResponse.text()}`);
  const agentPayload = await agentsResponse.json();
  const agent = agentPayload.data.map((item: { data?: { id: string; attributes?: { display_name?: string } }; id?: string; attributes?: { display_name?: string } }) => item.data || item)
    .find((item: { id?: string; attributes?: { display_name?: string } }) => item.attributes?.display_name === 'Demo Elevator Technician');
  expect(agent).toBeTruthy();
  await page.goto(`${process.env.TRISE_E2E_OPERATIONS_URL || 'http://127.0.0.1:4174'}/#jobs/${jobId}`);
  await page.getByRole('button', { name: 'Assign or reassign technician', exact: true }).click();
  const assignmentDrawer = page.getByRole('dialog', { name: 'Assign or reassign technician', exact: true });
  const technicianSelect = page.getByRole('combobox', { name: 'Technician', exact: true });
  await technicianSelect.selectOption(agent.id);
  const assignmentScreenshot = info.outputPath(`provider-workspace-job-assignment-drawer-${info.project.name}.png`);
  await page.screenshot({ path: assignmentScreenshot, fullPage: true });
  await info.attach(`provider-workspace-job-assignment-drawer-${info.project.name}`, { path: assignmentScreenshot });
  const assignmentResponse = page.waitForResponse((response) => response.url().includes('/assign') && response.request().method() === 'POST');
  await assignmentDrawer.getByRole('button', { name: 'Confirm assignment', exact: true }).click();
  const assignmentHttp = await assignmentResponse;
  if (assignmentHttp.status() !== 200 && assignmentHttp.status() !== 201) throw new Error(`assignment failed: ${assignmentHttp.status()} ${await assignmentHttp.text()}`);
  await expect(page.getByText('Assignment accepted by the server.', { exact: true })).toBeVisible();
  await localSignOut(page);
});

test('independent provider administrator approves a submitted change order', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);
  const api = apiBase;
  const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
  const requester = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const requesterHeaders = { Authorization: `Bearer ${requester.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const projectResponse = await page.request.post(`${api}/service-cases`, { headers: { ...requesterHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { title: `Synthetic approval project ${Date.now()}`, project_classification_key: 'ELEVATOR_INSTALLATION' } });
  expect(projectResponse.status()).toBe(201);
  const project = (await projectResponse.json()).data;
  const scheduleResponse = await page.request.post(`${api}/service-cases/${project.id}/payment-schedules`, { headers: { ...requesterHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { milestone_code: 'ADVANCE', description: 'Synthetic baseline', due_amount: 1000, currency_code: 'INR' } });
  expect(scheduleResponse.status()).toBe(201);
  const orderResponse = await page.request.post(`${api}/service-cases/${project.id}/change-orders`, { headers: { ...requesterHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { change_type: 'COMMERCIAL', description: 'Synthetic independent approval', changes: { reason: 'Browser verification' }, commercial_delta: 250, currency_code: 'INR', schedule_delta_days: 2 } });
  expect(orderResponse.status()).toBe(201);
  const order = (await orderResponse.json()).data;
  const submitResponse = await page.request.post(`${api}/change-orders/${order.id}/transitions`, { headers: { ...requesterHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { expected_revision: 1, transition: 'SUBMITTED' } });
  expect(submitResponse.status()).toBe(200);
  const selfApproval = await page.request.post(`${api}/change-orders/${order.id}/transitions`, { headers: { ...requesterHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { expected_revision: 2, transition: 'APPROVED', reason: 'Requester must not self-approve' } });
  expect(selfApproval.status()).toBe(409);
  await localSignOut(page);

  const approver = await localSignIn(page, configuredAccount('PROVIDER_REVIEWER'));
  const approverHeaders = { Authorization: `Bearer ${approver.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const listedProjects = await page.request.get(`${api}/service-cases`, { headers: approverHeaders });
  expect(listedProjects.ok()).toBeTruthy();
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await menu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Projects & Installation');
  await page.getByRole('row').filter({ hasText: project.attributes.title }).getByRole('button', { name: 'Open project', exact: true }).click();
  await page.getByRole('tab', { name: 'Commercial', exact: true }).click();
  await expect(page.getByText(/Synthetic independent approval/)).toBeVisible();
  await page.getByRole('button', { name: 'Approve change order', exact: true }).click();
  await expect(page.getByText('Approved', { exact: true })).toBeVisible();
  await expect(page.getByText('Approved project adjustments', { exact: true })).toBeVisible();
  await expect(page.getByText('Adjusted project total: 1250.00 INR', { exact: true })).toBeVisible();
  await expect(page.getByText('Approved schedule extension: 2 days', { exact: true })).toBeVisible();
  const approval = await page.request.get(`${api}/service-cases/${project.id}/change-orders`, { headers: approverHeaders });
  expect(approval.ok()).toBeTruthy();
  expect((await approval.json()).data.some((item: { data?: { attributes?: { status?: string } } }) => item.data?.attributes?.status === 'APPROVED')).toBeTruthy();
  await localSignOut(page);
});

test('provider payment evidence is recorded and settlement remains finance-authorized in Projects', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);
  const api = apiBase;
  const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
  const requester = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const requesterHeaders = { Authorization: `Bearer ${requester.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const projectResponse = await page.request.post(`${api}/service-cases`, { headers: { ...requesterHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { title: `Synthetic payment approval project ${Date.now()}`, project_classification_key: 'ELEVATOR_INSTALLATION' } });
  expect(projectResponse.status()).toBe(201);
  const project = (await projectResponse.json()).data;
  const scheduleResponse = await page.request.post(`${api}/service-cases/${project.id}/payment-schedules`, { headers: { ...requesterHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { milestone_code: 'ADVANCE', description: 'Synthetic advance', due_amount: 1000, currency_code: 'INR' } });
  expect(scheduleResponse.status()).toBe(201);
  const schedule = (await scheduleResponse.json()).data;
  const requesterGrants = await activePermissionCodes(page, requester.accessToken, providerId);
  if (!requesterGrants.has('PAYMENT_RECORD')) {
    const deniedPayment = await page.request.post(`${api}/service-cases/${project.id}/payments`, { headers: { ...requesterHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { payment_schedule_id: schedule.id, payment_reference: `UNAUTHORIZED-${Date.now()}`, method: 'ONLINE', amount: 500, currency_code: 'INR' } });
    expect(deniedPayment.status()).toBe(403);
    await localSignOut(page);
    return;
  }
  const paymentResponse = await page.request.post(`${api}/service-cases/${project.id}/payments`, { headers: { ...requesterHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { payment_schedule_id: schedule.id, payment_reference: `ONLINE-${Date.now()}`, method: 'ONLINE', amount: 500, currency_code: 'INR' } });
  expect(paymentResponse.status()).toBe(201);
  await localSignOut(page);

  const approver = await localSignIn(page, configuredAccount('PROVIDER_REVIEWER'));
  const approverHeaders = { Authorization: `Bearer ${approver.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await menu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Projects & Installation');
  await page.getByRole('row').filter({ hasText: project.attributes.title }).getByRole('button', { name: 'Open project', exact: true }).click();
  await page.getByRole('tab', { name: 'Commercial', exact: true }).click();
  await expect(page.getByText(/ONLINE ·/)).toBeVisible();
  const recordedPayments = await page.request.get(`${api}/service-cases/${project.id}/payments`, { headers: approverHeaders });
  expect(recordedPayments.ok()).toBeTruthy();
  const recordedRows = (await recordedPayments.json()).data as Array<{ data?: { id: string; attributes?: { status?: string } }; id?: string; attributes?: { status?: string } }>;
  const onlinePayment = recordedRows.map((item) => item.data || item).find((item) => item.attributes?.status === 'PENDING_VERIFICATION');
  expect(onlinePayment).toBeTruthy();
  const settlementAction = page.getByRole('button', { name: 'Settle payment', exact: true });
  if (!(await settlementAction.count())) {
    const deniedSettlement = await page.request.post(`${api}/payments/${onlinePayment!.id}/transitions`, {
      headers: { ...approverHeaders, 'Idempotency-Key': crypto.randomUUID() },
      data: { expected_revision: 1, transition: 'SETTLED', reason: 'Unauthorized role denial verification' },
    });
    expect(deniedSettlement.status()).toBe(403);
    await localSignOut(page);
    return;
  }
  await settlementAction.click();
  await expect(page.getByText('Settled', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reverse settlement', exact: true }).click();
  await expect(page.getByText('Reversed', { exact: true })).toBeVisible();
  const payments = await page.request.get(`${api}/service-cases/${project.id}/payments`, { headers: approverHeaders });
  expect(payments.ok()).toBeTruthy();
  expect((await payments.json()).data.some((item: { data?: { attributes?: { status?: string } } }) => item.data?.attributes?.status === 'REVERSED')).toBeTruthy();
  await localSignOut(page);
});

test('concurrent customer payment allocations cannot exceed the configured obligation', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);
  const api = apiBase;
  const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
  const session = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const headers = { Authorization: `Bearer ${session.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const projectResponse = await page.request.post(`${api}/service-cases`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { title: `Synthetic concurrent payment project ${Date.now()}`, project_classification_key: 'ELEVATOR_INSTALLATION' } });
  expect(projectResponse.status()).toBe(201);
  const project = (await projectResponse.json()).data;
  const scheduleResponse = await page.request.post(`${api}/service-cases/${project.id}/payment-schedules`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { milestone_code: 'CONCURRENT', description: 'Synthetic concurrent allocation', due_amount: 1000, currency_code: 'INR' } });
  expect(scheduleResponse.status()).toBe(201);
  const schedule = (await scheduleResponse.json()).data;
  const payload = { payment_schedule_id: schedule.id, method: 'CASH', amount: 700, currency_code: 'INR' };
  const grants = await activePermissionCodes(page, session.accessToken, providerId);
  const [first, second] = await Promise.all([
    page.request.post(`${api}/service-cases/${project.id}/payments`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { ...payload, payment_reference: `CONCURRENT-A-${Date.now()}` } }),
    page.request.post(`${api}/service-cases/${project.id}/payments`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { ...payload, payment_reference: `CONCURRENT-B-${Date.now()}` } })
  ]);
  const statuses = [first.status(), second.status()].sort((a, b) => a - b);
  if (!grants.has('PAYMENT_RECORD')) {
    expect(statuses).toEqual([403, 403]);
    const emptyPayments = await page.request.get(`${api}/service-cases/${project.id}/payments`, { headers });
    expect(emptyPayments.ok()).toBeTruthy();
    expect((await emptyPayments.json()).data).toHaveLength(0);
    await localSignOut(page);
    return;
  }
  expect(statuses[0]).toBe(201);
  expect([409, 422]).toContain(statuses[1]);
  const paymentsResponse = await page.request.get(`${api}/service-cases/${project.id}/payments`, { headers });
  expect(paymentsResponse.ok()).toBeTruthy();
  const payments = (await paymentsResponse.json()).data as Array<{ data?: { attributes?: { amount?: string | number } }; attributes?: { amount?: string | number } }>;
  const allocated = payments.reduce((sum, payment) => sum + Number(payment.data?.attributes?.amount || payment.attributes?.amount || 0), 0);
  expect(allocated).toBe(700);
  await localSignOut(page);
});

test('Projects preserves cheque and online payment state transitions', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);
  const api = apiBase;
  const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
  const session = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const headers = { Authorization: `Bearer ${session.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const projectResponse = await page.request.post(`${api}/service-cases`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { title: `Synthetic payment states ${Date.now()}`, project_classification_key: 'ELEVATOR_INSTALLATION' } });
  expect(projectResponse.status()).toBe(201);
  const project = (await projectResponse.json()).data;
  const scheduleResponse = await page.request.post(`${api}/service-cases/${project.id}/payment-schedules`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { milestone_code: 'PAYMENT-STATES', description: 'Cheque and online state transitions', due_amount: 1000, currency_code: 'INR' } });
  expect(scheduleResponse.status()).toBe(201);

  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await menu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Projects & Installation');
  await page.getByRole('row').filter({ hasText: project.attributes.title }).getByRole('button', { name: 'Open project', exact: true }).click();

  const grants = await activePermissionCodes(page, session.accessToken, providerId);
  if (!grants.has('PAYMENT_RECORD')) {
    await expect(page.getByRole('button', { name: 'Record collection', exact: true })).toHaveCount(0);
    const deniedPayment = await page.request.post(`${api}/service-cases/${project.id}/payments`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { payment_schedule_id: (await (await page.request.get(`${api}/service-cases/${project.id}/payment-schedules`, { headers })).json()).data[0].id, payment_reference: `UNAUTHORIZED-${Date.now()}`, method: 'CHEQUE', amount: 300, currency_code: 'INR' } });
    expect(deniedPayment.status()).toBe(403);
    await localSignOut(page);
    return;
  }

  const chequeReference = `CHEQUE-BROWSER-${Date.now()}`;
  await page.getByRole('tab', { name: 'Commercial', exact: true }).click();
  await page.getByRole('button', { name: 'Record collection', exact: true }).click();
  const chequeDialog = page.getByRole('dialog', { name: 'Record collection — Payment States', exact: true });
  await chequeDialog.getByLabel('Payment reference *', { exact: true }).fill(chequeReference);
  await chequeDialog.locator('select').selectOption('CHEQUE');
  await chequeDialog.getByLabel('Amount *', { exact: true }).fill('300');
  await chequeDialog.getByLabel('Instrument/reference', { exact: true }).fill('CHQ-BROWSER-001');
  const chequeCreate = page.waitForResponse((response) => response.url().includes(`/service-cases/${project.id}/payments`) && response.request().method() === 'POST');
  await chequeDialog.getByRole('button', { name: 'Record collection', exact: true }).click();
  const chequeCreateResponse = await chequeCreate;
  expect(chequeCreateResponse.status()).toBe(201);
  const chequePayments = await page.request.get(`${api}/service-cases/${project.id}/payments`, { headers });
  expect(chequePayments.ok()).toBeTruthy();
  expect((await chequePayments.json()).data.some((item: { data?: { attributes?: { payment_reference?: string; status?: string } } }) => (item.data?.attributes?.payment_reference === chequeReference && item.data.attributes.status === 'RECEIVED'))).toBeTruthy();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Commercial', exact: true }).click();
  const chequeCard = page.locator('article.record-card').filter({ hasText: chequeReference });
  await expect(chequeCard).toContainText('Received');
  const chequeRows = (await (await page.request.get(`${api}/service-cases/${project.id}/payments`, { headers })).json()).data as Array<{ data?: { id: string }; id?: string }>;
  const chequePayment = chequeRows.map((item) => item.data || item).find((item) => item.id);
  const bounceAction = chequeCard.getByRole('button', { name: 'Record bounce', exact: true });
  if (await bounceAction.count()) {
    await bounceAction.click();
    await expect(chequeCard).toContainText('Bounced');
  } else {
    const deniedBounce = await page.request.post(`${api}/payments/${chequePayment!.id}/transitions`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { expected_revision: 1, transition: 'BOUNCED', reason: 'Unauthorized role denial verification' } });
    expect(deniedBounce.status()).toBe(403);
  }

  // Collection entry is part of the project Overview; Commercial is the
  // read-only payment-history workspace.
  await page.getByRole('tab', { name: 'Commercial', exact: true }).click();
  await page.getByRole('button', { name: 'Record collection', exact: true }).click();
  const onlineDialog = page.getByRole('dialog', { name: 'Record collection — Payment States', exact: true });
  const onlineReference = `ONLINE-BROWSER-${Date.now()}`;
  await onlineDialog.getByLabel('Payment reference *', { exact: true }).fill(onlineReference);
  await onlineDialog.locator('select').selectOption('ONLINE');
  await onlineDialog.getByLabel('Amount *', { exact: true }).fill('500');
  const onlineCreate = page.waitForResponse((response) => response.url().includes(`/service-cases/${project.id}/payments`) && response.request().method() === 'POST');
  await onlineDialog.getByRole('button', { name: 'Record collection', exact: true }).click();
  const onlineCreateResponse = await onlineCreate;
  expect(onlineCreateResponse.status()).toBe(201);
  const onlinePayments = await page.request.get(`${api}/service-cases/${project.id}/payments`, { headers });
  expect(onlinePayments.ok()).toBeTruthy();
  const onlinePaymentRows = await onlinePayments.json();
  expect(onlinePaymentRows.data.some((item: { data?: { attributes?: { payment_reference?: string; status?: string } } }) => (item.data?.attributes?.payment_reference === onlineReference && item.data.attributes.status === 'PENDING_VERIFICATION'))).toBeTruthy();
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Commercial', exact: true }).click();
  const onlineCard = page.locator('article.record-card').filter({ hasText: onlineReference });
  await expect(onlineCard).toContainText('Pending Verification');
  const onlineSettleAction = onlineCard.getByRole('button', { name: 'Settle payment', exact: true });
  if (!(await onlineSettleAction.count())) {
    const onlineRows = (await (await page.request.get(`${api}/service-cases/${project.id}/payments`, { headers })).json()).data as Array<{ data?: { id: string; attributes?: { payment_reference?: string } }; id?: string; attributes?: { payment_reference?: string } }>;
    const pendingPayment = onlineRows.map((item) => item.data || item).find((item) => item.attributes?.payment_reference === onlineReference);
    expect(pendingPayment).toBeTruthy();
    const deniedSettlement = await page.request.post(`${api}/payments/${pendingPayment!.id}/transitions`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { expected_revision: 1, transition: 'SETTLED', reason: 'Unauthorized role denial verification' } });
    expect(deniedSettlement.status()).toBe(403);
    await localSignOut(page);
    return;
  }
  await localSignOut(page);

  const approver = await localSignIn(page, configuredAccount('PROVIDER_REVIEWER'));
  const approverHeaders = { Authorization: `Bearer ${approver.accessToken}`, 'X-TRISE-Provider-Id': providerId };
  const paymentsResponse = await page.request.get(`${api}/service-cases/${project.id}/payments`, { headers: approverHeaders });
  expect(paymentsResponse.ok()).toBeTruthy();
  const paymentRows = (await paymentsResponse.json()).data as Array<{ data?: { id: string; attributes?: { payment_reference?: string; status?: string } }; id?: string; attributes?: { payment_reference?: string; status?: string } }>;
  const online = paymentRows.map((item) => item.data || item).find((item) => item.attributes?.payment_reference === onlineReference);
  expect(online?.attributes?.status).toBe('PENDING_VERIFICATION');
  const settle = await page.request.post(`${api}/payments/${online!.id}/transitions`, { headers: { ...approverHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, data: { expected_revision: 1, transition: 'SETTLED', reason: 'Independent online settlement verification' } });
  expect(settle.status()).toBe(200);
  expect((await settle.json()).data.attributes.status).toBe('SETTLED');
  await localSignOut(page);
});

test('Projects opens a linked Service Job in the execution workspace', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);
  const api = apiBase;
  const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
  const session = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const headers = { Authorization: `Bearer ${session.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const jobsResponse = await page.request.get(`${api}/service-jobs?page[limit]=10`, { headers });
  expect(jobsResponse.ok()).toBeTruthy();
  const sourceJob = (await jobsResponse.json()).data[0];
  expect(sourceJob).toBeTruthy();
  const projectRelationship = sourceJob.relationships?.customer_relationship;
  const serviceType = sourceJob.relationships?.service_type;
  expect(projectRelationship).toBeTruthy(); expect(serviceType).toBeTruthy();
  const relationshipResponse = await page.request.get(`${api}/customer-relationships/${projectRelationship.id}`, { headers });
  const relationshipRecord = await relationshipResponse.json();
  if (!relationshipResponse.ok()) throw new Error(`relationship lookup failed: ${relationshipResponse.status()} ${JSON.stringify(relationshipRecord)}`);
  const customerPartyId = relationshipRecord.relationships?.customer?.id || relationshipRecord.data?.relationships?.customer?.id || relationshipRecord.attributes?.party_id || relationshipRecord.data?.attributes?.party_id;
  expect(customerPartyId).toBeTruthy();
  const locationResponse = await page.request.post(`${api}/locations`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: {
    customer_relationship_id: projectRelationship.id, classification: 'SITE', name: `Synthetic linked execution site ${Date.now()}`, address_lines: ['Synthetic local test address'], time_zone: 'Asia/Kolkata'
  } });
  expect(locationResponse.status()).toBe(201);
  const locationRecord = await locationResponse.json();
  const serviceLocationResponse = await page.request.get(`${api}/service-locations/by-code/${encodeURIComponent(locationRecord.attributes.service_location_code)}`, { headers });
  expect(serviceLocationResponse.ok()).toBeTruthy();
  const location = await serviceLocationResponse.json();
  const projectResponse = await page.request.post(`${api}/service-cases`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { title: `Synthetic linked execution project ${Date.now()}`, project_classification_key: 'ELEVATOR_INSTALLATION', party_id: customerPartyId, customer_relationship_id: projectRelationship.id, service_location_id: location.id } });
  expect(projectResponse.status()).toBe(201);
  const project = (await projectResponse.json()).data;
  const jobResponse = await page.request.post(`${api}/service-cases/${project.id}/jobs/create`, { headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() }, data: { service_type_id: serviceType.id, summary: `Synthetic linked execution job ${Date.now()}`, role: 'INSTALLATION' } });
  expect(jobResponse.status()).toBe(201);
  expect((await jobResponse.json()).data).toBeTruthy();
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await menu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Projects & Installation');
  await page.getByRole('row').filter({ hasText: project.attributes.title }).getByRole('button', { name: 'Open project', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open execution job', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open execution job', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Job details', exact: true })).toBeVisible();
  await localSignOut(page);
});

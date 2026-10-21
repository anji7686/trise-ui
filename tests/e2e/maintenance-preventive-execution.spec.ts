import { test, expect } from './fixtures';
import { approvedLocalAccounts, configuredAccount, localSignIn } from './local-auth';
import { e2eApiV1Base } from './e2e-config';

test.use({ trace: 'on-first-retry', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
test('technician completes a preventive maintenance ServiceJob from My Work', async ({ page, evidence }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);

  const apiBase = e2eApiV1Base();
  const adminAccount = approvedLocalAccounts().find((account) => account.email === configuredAccount('PROVIDER_ADMIN'));
  if (!adminAccount) throw new Error('Provider Administrator fixture is not on the approved local list');
  const adminSignIn = await page.request.post(`${apiBase}/session/development`, {
    headers: { Origin: 'http://127.0.0.1:4174', Accept: 'application/json' },
    data: { email: adminAccount.email, secret: adminAccount.secret, client_type: 'web' }
  });
  expect(adminSignIn.status()).toBe(200);
  const adminSession = await adminSignIn.json() as { access_token: string };
  const apiHeaders = { Authorization: `Bearer ${adminSession.access_token}`, 'X-TRISE-Provider-Id': providerId, Accept: 'application/json' };
  const sourceJobResponse = await page.request.get(`${apiBase}/service-jobs/01a144ab-36a3-70db-83e3-9d83ac3744f1`, { headers: apiHeaders });
  expect(sourceJobResponse.status()).toBe(200);
  const sourceJob = await sourceJobResponse.json() as { relationships: Record<string, { id?: string } | null> };
  const jobSummary = `Preventive AMC browser verification ${Date.now()}`;
  const createJobResponse = await page.request.post(`${apiBase}/service-jobs`, {
    headers: { ...apiHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': `preventive-browser-${Date.now()}` },
    data: {
      summary: jobSummary,
      customer_relationship_id: sourceJob.relationships.customer_relationship?.id,
      location_id: sourceJob.relationships.service_location?.id,
      service_type_id: sourceJob.relationships.service_type?.id
    }
  });
  expect(createJobResponse.status()).toBe(201);
  const job = await createJobResponse.json() as { id: string };
  const agentsResponse = await page.request.get(`${apiBase}/agents`, { headers: apiHeaders });
  expect(agentsResponse.status()).toBe(200);
  const agents = await agentsResponse.json() as { data: Array<{ id: string; attributes: { display_name?: string } }> };
  const technicianProfile = agents.data.find((agent) => agent.attributes.display_name === 'Demo Elevator Technician');
  expect(technicianProfile).toBeTruthy();
  const assignmentResponse = await page.request.post(`${apiBase}/service-jobs/${job.id}/assignments`, {
    headers: { ...apiHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': `preventive-browser-assignment-${job.id}` },
    data: { agent_id: technicianProfile?.id, effective_at: new Date().toISOString() }
  });
  expect(assignmentResponse.status()).toBe(201);

  await page.context().clearCookies();
  const technician = await localSignIn(page, configuredAccount('AGENT'));
  const capability = technician.user.attributes.provider_capabilities.find((entry: { provider_id: string; capabilities: string[] }) => entry.provider_id === providerId);
  expect(capability?.capabilities, 'TRISE_E2E_AGENT_EMAIL must identify an authorized Provider Agent with the server-projected My Work capability').toContain('my_work');
  const technicianHeaders = { Authorization: `Bearer ${technician.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const existingVisits = await page.request.get(`${apiBase}/service-jobs/${job.id}/visits`, { headers: technicianHeaders });
  expect(existingVisits.ok(), `assigned technician visit read returned ${existingVisits.status()}: ${await existingVisits.text()}`).toBeTruthy();
  if ((await existingVisits.json()).data.length === 0) {
    const visitResponse = await page.request.post(`${apiBase}/service-jobs/${job.id}/visits`, {
      headers: { ...technicianHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { notes: 'Preventive browser visit' }
    });
    expect(visitResponse.status()).toBe(201);
  }
  const currentJobResponse = await page.request.get(`${apiBase}/service-jobs/${job.id}`, { headers: technicianHeaders });
  expect(currentJobResponse.ok()).toBeTruthy();
  let currentJob = await currentJobResponse.json() as { attributes: { revision: number } };
  for (const status of ['SCHEDULED', 'ON_THE_WAY']) {
    const transition = await page.request.post(`${apiBase}/service-jobs/${job.id}/transitions`, {
      headers: { ...technicianHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { status, effective_at: new Date().toISOString() }
    });
    expect(transition.status()).toBe(200);
    currentJob = await transition.json();
  }
  const visitList = await page.request.get(`${apiBase}/service-jobs/${job.id}/visits`, { headers: technicianHeaders });
  const visitId = (await visitList.json()).data[0].id as string;
  const checkIn = await page.request.post(`${apiBase}/service-jobs/${job.id}/check-in`, {
    headers: { ...technicianHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { visit_id: visitId, effective_at: new Date().toISOString(), expected_revision: currentJob.attributes.revision }
  });
  expect(checkIn.status()).toBe(200);
  currentJob = await checkIn.json();
  const start = await page.request.post(`${apiBase}/service-jobs/${job.id}/start`, {
    headers: { ...technicianHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { visit_id: visitId, effective_at: new Date().toISOString(), expected_revision: currentJob.attributes.revision }
  });
  expect(start.status()).toBe(200);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await menu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();

  await page.goto('/#/jobs');
  await page.getByRole('tab', { name: 'My Work', exact: true }).click();
  const preventiveWork = page.locator('article.job-list-row').filter({ hasText: jobSummary });
  await expect(preventiveWork).toBeVisible();
  await preventiveWork.getByRole('button', { name: 'Open visit', exact: true }).click();
  await expect(preventiveWork.getByText(/Visit .* ·/)).toBeVisible({ timeout: 20_000 });
  await expect(preventiveWork.getByRole('button', { name: 'Complete', exact: true })).toBeVisible();
  await expect(preventiveWork.getByRole('heading', { name: 'Service checklist', exact: true })).toBeVisible();
  await expect(preventiveWork.getByRole('heading', { name: 'Service report', exact: true })).toBeVisible();
  await preventiveWork.getByLabel('Report summary', { exact: true }).fill('Preventive inspection completed');
  await preventiveWork.getByLabel('Report work performed', { exact: true }).fill('Inspected lift controls, safety circuit and door operation.');
  const createReportButton = preventiveWork.getByRole('button', { name: 'Create service report', exact: true });
  await expect(createReportButton).toBeEnabled({ timeout: 20_000 });
  const reportCreateRequestPromise = page.waitForRequest((request) => request.url().endsWith(`/service-jobs/${job.id}/reports`) && request.method() === 'POST');
  await createReportButton.click();
  const reportCreateRequest = await reportCreateRequestPromise;
  const reportCreateResponse = await reportCreateRequest.response();
  if (!reportCreateResponse) throw new Error(`browser report creation request failed: ${reportCreateRequest.failure()?.errorText || 'no response'}`);
  if (reportCreateResponse.status() !== 201) throw new Error(`browser report creation failed: ${reportCreateResponse.status()} ${await reportCreateResponse.text()}`);
  const reportRow = preventiveWork.locator('.session-row').filter({ hasText: 'Preventive inspection completed' });
  await expect(reportRow).toBeVisible();
  const submitReportButton = reportRow.getByRole('button', { name: 'Submit report', exact: true });
  await expect(submitReportButton).toBeEnabled({ timeout: 20_000 });
  const [reportSubmitResponse] = await Promise.all([
    page.waitForResponse((response) => /\/service-jobs\/[^/]+\/reports\/[^/]+\/submit$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST'),
    submitReportButton.click()
  ]);
  if (reportSubmitResponse.status() !== 200) throw new Error(`browser report submission failed: ${reportSubmitResponse.status()} ${await reportSubmitResponse.text()}`);
  await expect(reportRow.getByText('submitted', { exact: true })).toBeVisible();
  const persistedReports = await page.request.get(`${apiBase}/service-jobs/${job.id}/reports`, { headers: technicianHeaders });
  expect(persistedReports.ok()).toBeTruthy();
  const persistedReport = (await persistedReports.json()).data.find((item: { attributes: { summary?: string } }) => item.attributes.summary === 'Preventive inspection completed');
  expect(persistedReport?.attributes.status).toBe('submitted');
  await page.screenshot({ path: info.outputPath('technician-job-execution-workspace.png'), fullPage: true });
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter((response) => response.status >= 500)).toEqual([]);
});

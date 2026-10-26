import { test, expect } from './fixtures';
import { approvedLocalAccounts, configuredAccount, localSignIn, localSignOut } from './local-auth';
import { e2eApiV1Base } from './e2e-config';

test.use({ trace: 'on-first-retry', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';

test('qualified inspector assignment and report execution are enforced in Chromium', async ({ page, evidence: browserEvidence }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);

  const api = e2eApiV1Base();
  const admin = approvedLocalAccounts().find((account) => account.email === configuredAccount('PROVIDER_ADMIN'));
  if (!admin) throw new Error('Provider Administrator fixture is not on the approved local list');
  const signIn = await page.request.post(`${api}/session/development`, {
    headers: { Origin: 'http://127.0.0.1:4174', Accept: 'application/json' },
    data: { email: admin.email, secret: admin.secret, client_type: 'web' }
  });
  expect(signIn.status()).toBe(200);
  const session = await signIn.json() as { access_token: string };
  const adminHeaders = { Authorization: `Bearer ${session.access_token}`, 'X-TRISE-Provider-Id': providerId, Accept: 'application/json' };

  const source = await page.request.get(`${api}/service-jobs/01a144ab-36a3-70db-83e3-9d83ac3744f1`, { headers: adminHeaders });
  expect(source.status()).toBe(200);
  const sourceJob = await source.json() as { relationships: Record<string, { id?: string } | null> };
  const summary = `Independent elevator inspection browser ${Date.now()}`;
  const created = await page.request.post(`${api}/service-jobs`, {
    headers: { ...adminHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': `inspection-browser-${Date.now()}` },
    data: { summary, customer_relationship_id: sourceJob.relationships.customer_relationship?.id, location_id: sourceJob.relationships.service_location?.id, service_type_id: sourceJob.relationships.service_type?.id }
  });
  expect(created.status()).toBe(201);
  const job = await created.json() as { id: string };

  const agents = await page.request.get(`${api}/agents`, { headers: adminHeaders });
  expect(agents.status()).toBe(200);
  const agentList = await agents.json() as { data: Array<{ data?: { id: string; attributes: { display_name?: string } }; id?: string; attributes?: { display_name?: string } }> };
  const normalizedAgents = agentList.data.map((item) => item.data || item as { id: string; attributes: { display_name?: string } });
  const qualified = normalizedAgents.find((agent) => agent.attributes.display_name === 'Demo Elevator Technician');
  const unqualified = normalizedAgents.find((agent) => agent.attributes.display_name === 'Demo Backup Technician');
  expect(qualified).toBeTruthy();
  expect(unqualified).toBeTruthy();

  const rejected = await page.request.post(`${api}/service-jobs/${job.id}/assignments`, {
    headers: { ...adminHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': `inspection-browser-reject-${job.id}` },
    data: { agent_id: unqualified?.id, effective_at: new Date().toISOString() }
  });
  expect(rejected.status()).toBe(422);
  expect((await rejected.text())).toContain('MISSING_CERTIFICATION');

  const assignment = await page.request.post(`${api}/service-jobs/${job.id}/assignments`, {
    headers: { ...adminHeaders, 'Content-Type': 'application/json', 'Idempotency-Key': `inspection-browser-assign-${job.id}` },
    data: { agent_id: qualified?.id, effective_at: new Date().toISOString() }
  });
  expect(assignment.status(), `qualified assignment failed: ${assignment.status()} ${await assignment.text()}`).toBe(201);
  const qualifications = await page.request.get(`${api}/agents/${qualified?.id}/certifications`, { headers: adminHeaders });
  expect(qualifications.status()).toBe(200);
  const qualificationRows = await qualifications.json() as { data: Array<{ attributes?: { verification?: string } }> };
  expect(qualificationRows.data.some((row) => row.attributes?.verification === 'verified')).toBeTruthy();

  await page.context().clearCookies();
  const technician = await localSignIn(page, configuredAccount('AGENT'));
  const technicianHeaders = { Authorization: `Bearer ${technician.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  const visits = await page.request.get(`${api}/service-jobs/${job.id}/visits`, { headers: technicianHeaders });
  expect(visits.ok(), `assigned technician visit read returned ${visits.status()}: ${await visits.text()}`).toBeTruthy();
  let visitId = ((await visits.json()).data as Array<{ id: string }>)[0]?.id;
  if (!visitId) {
    const visit = await page.request.post(`${api}/service-jobs/${job.id}/visits`, { headers: { ...technicianHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { notes: 'Independent inspection browser visit' } });
    expect(visit.status(), `assigned visit creation failed: ${visit.status()} ${await visit.text()}`).toBe(201);
    visitId = (await visit.json()).id;
  }
  const current = await page.request.get(`${api}/service-jobs/${job.id}`, { headers: technicianHeaders });
  let currentJob = await current.json() as { attributes: { revision: number } };
  for (const status of ['SCHEDULED', 'ON_THE_WAY']) {
    const transition = await page.request.post(`${api}/service-jobs/${job.id}/transitions`, { headers: { ...technicianHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { status, effective_at: new Date().toISOString() } });
    expect(transition.status()).toBe(200);
    currentJob = await transition.json();
  }
  const checkIn = await page.request.post(`${api}/service-jobs/${job.id}/check-in`, { headers: { ...technicianHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { visit_id: visitId, effective_at: new Date().toISOString(), expected_revision: currentJob.attributes.revision } });
  expect(checkIn.status()).toBe(200);
  currentJob = await checkIn.json();
  const start = await page.request.post(`${api}/service-jobs/${job.id}/start`, { headers: { ...technicianHeaders, 'Idempotency-Key': crypto.randomUUID() }, data: { visit_id: visitId, effective_at: new Date().toISOString(), expected_revision: currentJob.attributes.revision } });
  expect(start.status()).toBe(200);

  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await menu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.goto('/#/jobs');
  await page.getByRole('tab', { name: 'My Work', exact: true }).click();
  const work = page.locator('article.job-list-row').filter({ hasText: summary });
  await expect(work).toBeVisible();
  await work.getByRole('button', { name: 'Open visit', exact: true }).click();
  await expect(work.getByText(/Visit .* ·/)).toBeVisible({ timeout: 20_000 });
  await expect(work.getByRole('heading', { name: 'Service checklist', exact: true })).toBeVisible();
  await expect(work.getByRole('heading', { name: 'Service report', exact: true })).toBeVisible();
  await work.getByLabel('Report summary', { exact: true }).fill('Independent inspection completed');
  await work.getByLabel('Report work performed', { exact: true }).fill('Verified safety circuit, door interlocks and leveling operation.');
  const create = work.getByRole('button', { name: 'Create service report', exact: true });
  await expect(create).toBeEnabled();
  const createRequest = page.waitForRequest((request) => request.url().endsWith(`/service-jobs/${job.id}/reports`) && request.method() === 'POST');
  await create.click();
  const reportRequest = await createRequest;
  const reportResponse = await reportRequest.response();
  expect(reportResponse?.status()).toBe(201);
  const row = work.locator('.session-row').filter({ hasText: 'Independent inspection completed' });
  await expect(row).toBeVisible();
  const submit = row.getByRole('button', { name: 'Submit report', exact: true });
  await expect(submit).toBeEnabled({ timeout: 20_000 });
  const [submitResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes(`/service-jobs/${job.id}/reports/`) && response.url().endsWith('/submit') && response.request().method() === 'POST'),
    submit.click()
  ]);
  expect((await submitResponse).status()).toBe(200);
  await expect(row.getByText('submitted', { exact: true })).toBeVisible();
  const persisted = await page.request.get(`${api}/service-jobs/${job.id}/reports`, { headers: technicianHeaders });
  expect(persisted.ok()).toBeTruthy();
  expect((await persisted.json()).data.some((item: { attributes: { summary?: string; status?: string } }) => item.attributes.summary === 'Independent inspection completed' && item.attributes.status === 'submitted')).toBeTruthy();

  // A submitted service report closes material evidence entry. Verify the
  // provider-facing read-only state with an Operations Administrator session.
  await localSignOut(page);
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const adminMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await adminMenu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.goto(`/#jobs/${job.id}`);
  const adminDetail = page.locator('.job-detail');
  await expect(adminDetail).toBeVisible({ timeout: 20_000 });
  await adminDetail.getByRole('tab', { name: 'Evidence', exact: true }).click();
  await expect(adminDetail.getByText('Service report submitted. Parts & materials used are read-only for this job.', { exact: true })).toBeVisible();
  await expect(adminDetail.getByRole('button', { name: 'Record part usage', exact: true })).toBeDisabled();
  await page.screenshot({ path: `/tmp/trise-inspection-qualification-${job.id}.png`, fullPage: true });
  expect(browserEvidence.exceptions).toEqual([]);
  expect(browserEvidence.responses.filter((response) => response.status >= 500)).toEqual([]);
});

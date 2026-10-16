import { test, expect } from './fixtures';
import { approvedLocalAccounts, localSignIn } from './local-auth';

test.use({ trace: 'on-first-retry', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
test('technician completes a preventive maintenance ServiceJob from My Work', async ({ page, evidence }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(120_000);

  const apiBase = process.env.TRISE_E2E_API_URL || 'http://127.0.0.1:3000/api/v1';
  const adminAccount = approvedLocalAccounts().find((account) => account.email === 'liftriseorg@gmail.com');
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
  const technician = await localSignIn(page, 'demo.elevator.agent1@trise.local');
  const capability = technician.user.attributes.provider_capabilities.find((entry: { provider_id: string; capabilities: string[] }) => entry.provider_id === providerId);
  expect(capability?.capabilities).toContain('my_work');
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await menu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();

  await page.goto('/#/jobs');
  await page.getByRole('button', { name: 'My Work', exact: true }).click();
  const preventiveWork = page.locator('article.job-list-row').filter({ hasText: jobSummary });
  await expect(preventiveWork).toBeVisible();
  await preventiveWork.getByRole('button', { name: 'Open visit', exact: true }).click();
  await expect(preventiveWork.getByText(/Visit .* · OPEN/)).toBeVisible();
  await preventiveWork.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expect(preventiveWork.getByRole('status')).toContainText('Job scheduled.');
  await preventiveWork.getByRole('button', { name: 'Start travel', exact: true }).click();
  await expect(preventiveWork.getByRole('status')).toContainText('Travel started.');
  await preventiveWork.getByRole('button', { name: 'Check in', exact: true }).click();
  await expect(preventiveWork.getByRole('status')).toContainText('Check-in accepted.');
  await preventiveWork.getByRole('button', { name: 'Start service', exact: true }).click();
  await expect(preventiveWork.getByRole('status')).toContainText('Service started accepted.');
  await preventiveWork.getByText('Checklist and work session', { exact: true }).click();
  await preventiveWork.getByRole('button', { name: 'Finish session', exact: true }).first().click();
  await expect(preventiveWork.getByText('Work session ended by the server', { exact: true })).toBeVisible();
  const completeButton = preventiveWork.getByRole('button', { name: 'Complete', exact: true });
  const completionRequest = page.waitForRequest((request) => request.url().includes(`/service-jobs/${job.id}/complete`) && request.method() === 'POST');
  await completeButton.click();
  expect((await completionRequest).method()).toBe('POST');
  await expect(completeButton).toBeDisabled();
  await page.screenshot({ path: `/tmp/trise-preventive-maintenance-${job.id}.png`, fullPage: true });
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter((response) => response.status >= 500)).toEqual([]);
});

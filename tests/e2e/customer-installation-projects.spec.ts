import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
const api = process.env.TRISE_E2E_API_URL || 'http://127.0.0.1:3000/api/v1';

test('customer can view only authorized elevator installation project progress', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(90_000);

  const customer = await localSignIn(page, configuredAccount('CUSTOMER'));
  const customerHeaders = {
    Authorization: `Bearer ${customer.accessToken}`,
    'X-TRISE-Provider-Id': providerId
  };
  const customerRelationshipsResponse = await page.request.get(`${api}/customer-relationships?page[limit]=25`, { headers: customerHeaders });
  expect(customerRelationshipsResponse.ok()).toBeTruthy();
  const customerRelationshipPayload = await customerRelationshipsResponse.json();
  const relationship = customerRelationshipPayload.data[0] as { id: string; relationships?: { customer?: { id: string } } };
  expect(relationship?.id).toBeTruthy();
  const customerPartyId = relationship.relationships?.customer?.id;
  expect(customerPartyId).toBeTruthy();
  await localSignOut(page);

  const providerAdmin = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const providerHeaders = {
    Authorization: `Bearer ${providerAdmin.accessToken}`,
    'X-TRISE-Provider-Id': providerId,
    'Content-Type': 'application/json'
  };

  const title = `Customer tracking browser project ${Date.now()}`;
  const projectResponse = await page.request.post(`${api}/service-cases`, {
    headers: { ...providerHeaders, 'Idempotency-Key': crypto.randomUUID() },
    data: {
      title,
      party_id: customerPartyId,
      customer_relationship_id: relationship.id,
      project_classification_key: 'ELEVATOR_INSTALLATION'
    }
  });
  expect(projectResponse.status()).toBe(201);
  const projectPayload = await projectResponse.json();
  const project = projectPayload.data as { id: string; attributes: { status: string; progress_percent: number; project_classification_key: string } };
  expect(project.attributes.project_classification_key).toBe('ELEVATOR_INSTALLATION');
  await localSignOut(page);

  const authenticatedCustomer = await localSignIn(page, configuredAccount('CUSTOMER'));
  const authenticatedCustomerHeaders = { Authorization: `Bearer ${authenticatedCustomer.accessToken}`, 'X-TRISE-Provider-Id': providerId };
  const customerProjectsResponse = await page.request.get(`${api}/service-cases?page[limit]=25&sort=-created_at,id`, { headers: authenticatedCustomerHeaders });
  expect(customerProjectsResponse.ok()).toBeTruthy();
  const customerProjects = await customerProjectsResponse.json();
  const customerRows = customerProjects.data.map((item: { data?: unknown }) => item.data || item) as Array<{ id: string; attributes: { project_classification_key?: string } }>;
  const visibleProject = customerRows.find((item) => item.id === project.id);
  expect(visibleProject).toBeTruthy();
  expect(customerRows.every((item) => item.attributes.project_classification_key === 'ELEVATOR_INSTALLATION')).toBeTruthy();

  const providerSelect = page.getByRole('combobox', { name: 'Provider', exact: true });
  await expect(providerSelect).toBeVisible();
  await providerSelect.selectOption(providerId);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('trise-customer-provider'))).toBe(providerId);
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await expect(page).toHaveURL(/#\/projects$/);
  await expect(page.getByRole('heading', { name: 'Installation projects', exact: true })).toBeVisible();
  const projectCard = page.locator('article.record-card').filter({ hasText: title });
  await expect(projectCard).toBeVisible();
  await expect(projectCard).toContainText('OPEN');
  await expect(projectCard).toContainText('0% complete');
  await expect(page.getByText('Progress is read from the authorized provider project record.', { exact: false })).toBeVisible();
  await page.screenshot({ path: `/tmp/trise-customer-installation-projects-${Date.now()}.png`, fullPage: true });
});

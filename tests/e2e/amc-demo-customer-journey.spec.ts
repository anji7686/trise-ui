import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';
import { e2eApiV1Base } from './e2e-config';

type Resource = { id: string; attributes: Record<string, unknown>; relationships?: Record<string, { id: string }> };
const unwrap = (value: unknown): Resource => {
  const item = value as { data?: unknown };
  const resource = (item?.data || item) as { data?: Resource } | Resource;
  return (resource && 'data' in resource ? resource.data : resource) as Resource;
};

function providerIdFor(user: { attributes: { provider_capabilities: Array<{ provider_id: string; display_name: string; capabilities: string[] }> } }, capability = 'quotations') {
  const provider = user.attributes.provider_capabilities.find((entry) => entry.display_name === 'Lift Rise Elevators — Demo Operations' && entry.capabilities.includes(capability));
  if (!provider) throw new Error(`The local identity has no authorized Provider capability: ${capability}`);
  return provider.provider_id;
}

async function selectProvider(page: import('playwright/test').Page, providerId: string) {
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  const provider = menu.getByRole('combobox', { name: 'Provider', exact: true });
  if (await provider.locator(`option[value="${providerId}"]`).count()) await provider.selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
}

test.use({ screenshot: 'only-on-failure', trace: 'retain-on-failure', video: 'retain-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('second demo customer quick login reviews and accepts a new paid AMC, then provider activates its contract', async ({ page }) => {
  test.skip(!test.info().project.name.startsWith('operations'), 'Operations application workflow with a separate Customer portal session');
  test.setTimeout(300_000);
  const api = e2eApiV1Base();
  const email = configuredAccount('CUSTOMER_2');
  const providerAdmin = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const providerId = providerIdFor(providerAdmin.user);
  const adminHeaders = { Authorization: `Bearer ${providerAdmin.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
  await selectProvider(page, providerId);

  const customerResponse = await page.request.get(`${api}/customers?filter[email]=${encodeURIComponent(email)}&page[limit]=20`, { headers: adminHeaders });
  expect(customerResponse.ok()).toBeTruthy();
  const customerPayload = await customerResponse.json();
  const customer = (customerPayload.data || []).map(unwrap).find((item: Resource) =>
    String((item.attributes.contact as Record<string, unknown> | undefined)?.email || '').toLowerCase() === email.toLowerCase(),
  ) as Resource | undefined;
  expect(customer, 'A second, separately linked demo customer must exist.').toBeTruthy();
  const relationshipId = customer!.relationships?.customer_relationship?.id;
  expect(relationshipId).toBeTruthy();

  const quotationResponse = await page.request.get(`${api}/quotations?page[limit]=100`, { headers: adminHeaders });
  expect(quotationResponse.ok()).toBeTruthy();
  const quotationsPayload = await quotationResponse.json();
  const quotation = (quotationsPayload.data || []).map(unwrap)
    .filter((item: Resource) => item.relationships?.customer_relationship?.id === relationshipId && item.attributes.purpose === 'MAINTENANCE_CONTRACT')
    .sort((left: Resource, right: Resource) => Date.parse(String(right.attributes.created_at || '')) - Date.parse(String(left.attributes.created_at || '')))[0] as Resource | undefined;
  expect(quotation, 'The demo customer must have a new paid AMC quotation.').toBeTruthy();
  const quotationId = quotation!.id;
  let revision = Number(quotation!.attributes.revision);

  await page.goto(`${page.url().split('#')[0]}#quotations/${quotationId}`);
  await expect(page.getByRole('heading', { name: 'Quotation details', exact: true })).toBeVisible();
  if (String(quotation!.attributes.status).toLowerCase() === 'draft') {
    await page.getByRole('tab', { name: 'Review & actions', exact: true }).click();
    const issueResponse = page.waitForResponse(response => response.url().endsWith(`/quotations/${quotationId}/transitions`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Issue quotation', exact: true }).click();
    const issuedResponse = await issueResponse;
    expect(issuedResponse.status()).toBe(200);
    revision = Number(unwrap(await issuedResponse.json()).attributes.revision || revision);
  }
  const currentQuotationResponse = await page.request.get(`${api}/quotations/${quotationId}`, { headers: adminHeaders });
  expect(currentQuotationResponse.ok()).toBeTruthy();
  const currentQuotation = unwrap(await currentQuotationResponse.json());
  revision = Number(currentQuotation.attributes.revision || revision);
  const existingReview = currentQuotation.attributes.provider_review as { decision?: string } | undefined;
  if (String(existingReview?.decision || '').toLowerCase() !== 'approved') {
    await localSignOut(page);
    const reviewer = await localSignIn(page, configuredAccount('PROVIDER_REVIEWER'));
    const reviewerHeaders = { Authorization: `Bearer ${reviewer.accessToken}`, 'X-TRISE-Provider-Id': providerId, 'Content-Type': 'application/json' };
    const reviewResponse = await page.request.post(`${api}/quotations/${quotationId}/provider-reviews`, {
      headers: { ...reviewerHeaders, 'Idempotency-Key': crypto.randomUUID() },
      data: { decision: 'APPROVED', expected_revision: revision },
    });
    expect(reviewResponse.status()).toBe(201);
    await localSignOut(page);
  } else {
    await localSignOut(page);
  }

  const customerPage = await page.context().newPage();
  await localSignIn(customerPage, email, 'http://127.0.0.1:4173/');
  await customerPage.goto(`http://127.0.0.1:4173/#/quotation/${quotationId}`);
  const acceptanceRecorded = customerPage.getByRole('heading', { name: 'Acceptance recorded', exact: true });
  const decisionPrompt = customerPage.getByRole('heading', { name: 'Ready to respond?', exact: true });
  await expect(acceptanceRecorded.or(decisionPrompt)).toBeVisible({ timeout: 20_000 });
  const alreadyAccepted = await acceptanceRecorded.isVisible();
  if (!alreadyAccepted) await expect(customerPage.getByRole('heading', { name: 'Review the exact offer', exact: true })).toBeVisible();
  await expect(customerPage.getByRole('heading', { name: 'Scope and specifications', exact: true })).toBeVisible();
  if (alreadyAccepted) {
    await expect(customerPage.getByRole('heading', { name: 'Acceptance recorded', exact: true })).toBeVisible();
  } else {
    const sections = customerPage.getByRole('tablist', { name: 'Quotation sections', exact: true });
    for (const label of ['Scope & pricing', 'Payment & terms', 'Revisions & activity', 'Messages']) {
      const tab = sections.getByRole('tab', { name: label, exact: true });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(customerPage.getByRole('tabpanel')).toHaveCount(1);
    }
    await sections.getByRole('tab', { name: 'Scope & pricing', exact: true }).click();
    await customerPage.getByRole('button', { name: 'Accept quotation', exact: true }).click();
    const acceptanceDialog = customerPage.getByRole('dialog', { name: new RegExp(`Accept revision ${revision}\\?`) });
    await expect(acceptanceDialog).toBeVisible();
    await acceptanceDialog.getByLabel('Your full name').fill('Demo AMC Customer Two');
    await acceptanceDialog.getByLabel('Your role or title').fill('Authorized customer contact');
    await acceptanceDialog.getByRole('checkbox', { name: /I confirm I am authorised/ }).check();
    await acceptanceDialog.getByRole('button', { name: 'Confirm acceptance', exact: true }).click();
    await expect(customerPage.locator('.quote-success')).toContainText('Your acceptance has been recorded.');
    await expect(customerPage.getByRole('heading', { name: 'Acceptance recorded', exact: true })).toBeVisible();
  }
  await localSignOut(customerPage);
  await customerPage.close();

  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await selectProvider(page, providerId);
  await page.goto(`${page.url().split('#')[0]}#quotations/${quotationId}`);
  await expect(page.getByRole('heading', { name: 'Quotation details', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Review & actions', exact: true }).click();
  const existingContractsResponse = await page.request.get(`${api}/maintenance-contracts?page[limit]=100`, { headers: adminHeaders });
  expect(existingContractsResponse.ok()).toBeTruthy();
  const existingContractsPayload = await existingContractsResponse.json();
  const existingContract = (existingContractsPayload.data || []).map(unwrap).find((item: Resource) => item.attributes.source_quotation_id === quotationId) as Resource | undefined;
  let converted = existingContract;
  if (!converted) {
    const conversionResponse = page.waitForResponse(response => response.url().endsWith(`/quotations/${quotationId}/convert`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Create paid AMC contract draft', exact: true }).click();
    converted = unwrap(await (await conversionResponse).json());
    expect(converted.id).toBeTruthy();
    await expect(page.locator('.action-notification')).toContainText('Paid AMC draft contract');
  }
  if (String(converted!.attributes.status).toLowerCase() === 'draft') {
    const activationResponse = page.waitForResponse(response => response.url().endsWith(`/maintenance-contracts/${converted.id}/transitions`) && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Activate paid AMC contract', exact: true }).click();
    expect((await activationResponse).status()).toBe(200);
  } else {
    expect(String(converted!.attributes.status).toLowerCase()).toBe('active');
  }
  const contractResponse = await page.request.get(`${api}/maintenance-contracts/${converted!.id}`, { headers: adminHeaders });
  expect(contractResponse.ok()).toBeTruthy();
  const contract = unwrap(await contractResponse.json());
  expect(String(contract.attributes.status).toLowerCase()).toBe('active');
  const assetScopesResponse = await page.request.get(`${api}/maintenance-contracts/${converted!.id}/asset-scopes?page[limit]=100`, { headers: adminHeaders });
  expect(assetScopesResponse.ok()).toBeTruthy();
  const assetScopes = await assetScopesResponse.json();
  const quoteLines = quotation!.attributes.lines as Array<{ asset_id?: string }>;
  expect((assetScopes.data || []).map(unwrap).some((scope: Resource) => quoteLines.some(line => line.asset_id === scope.attributes.asset_id))).toBe(true);
});

import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';

test.use({ trace: 'retain-on-failure', video: 'off' });

test('current Onboard Service Provider entry point loads for an authorized platform administrator', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/providers/new');
  await expect(page.getByRole('heading', { name: 'Register provider account', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Business selection', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Business Operation', exact: true })).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('Business Identification persists a new Business-first onboarding session before provider creation', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/providers/new');
  const suffix = Date.now().toString();
  await page.getByLabel('Provider name', { exact: false }).fill(`ONB04 Browser Provider ${suffix}`);
  const business = page.getByRole('combobox', { name: 'Business', exact: true });
  await business.click();
  const firstBusiness = page.getByRole('option').first();
  await expect(firstBusiness).toBeVisible();
  await firstBusiness.click();
  const operation = page.getByRole('combobox', { name: 'Business Operation', exact: true });
  await operation.click();
  const firstOperation = page.getByRole('option').first();
  await expect(firstOperation).toBeVisible();
  await firstOperation.click();
  await page.getByRole('button', { name: 'Create provider account', exact: true }).click();
  await expect(page).toHaveURL(/#platform\/providers\/[^/]+\/business-profile\/edit/);
  await expect(page.getByRole('heading', { name: 'Business profile', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Business Legal Identity', exact: true })).toBeVisible();
  await expect(page.getByText('This is the authoritative Business legal identity.', { exact: false })).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('new Business onboarding submits a profile for Platform review', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/providers/new');
  await page.getByLabel('Provider name', { exact: false }).fill(`ONB15 New Business ${Date.now()}`);
  const newBusiness = page.getByRole('radio', { name: 'New Business', exact: true });
  await newBusiness.check();
  await page.getByLabel('New Business name', { exact: false }).fill(`ONB15 Legal Business ${Date.now()}`);
  const operation = page.getByRole('combobox', { name: 'Business Operation', exact: true });
  await operation.click();
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: 'Create provider account', exact: true }).click();
  await expect(page).toHaveURL(/#platform\/providers\/[^/]+\/business-profile\/edit/);
  await page.locator('label').filter({ hasText: 'Legal name' }).last().locator('input').fill(`ONB15 Legal Business ${Date.now()}`);
  await page.getByLabel('Address line').fill('1 Synthetic Review Road');
  await page.getByLabel('City').fill('Bengaluru');
  await page.getByLabel('State').selectOption({ label: 'Karnataka' });
  await page.getByLabel('PIN code').fill('560001');
  await page.getByLabel('Business constitution').selectOption('LLP');
  await page.getByRole('button', { name: 'Submit legal identity for review', exact: true }).click();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Business profile', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit for review', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
  await expect(page.getByText('Submitted on behalf of the provider for platform review.', { exact: true })).toBeVisible();
  const providerId = page.url().match(/#platform\/providers\/([^/]+)/)?.[1];
  expect(providerId).toBeTruthy();
  await page.goto(`/#platform/providers/${providerId}?tab=reviews`);
  await expect(page.getByRole('heading', { name: 'Review history', exact: true })).toBeVisible();
  await page.getByPlaceholder(/Reason for/).fill('Synthetic correction required for review evidence');
  await page.getByRole('button', { name: 'Request corrections', exact: true }).click();
  await expect(page.getByText(/Corrections requested/i).last()).toBeVisible();
  await page.goto(`/#platform/providers/${providerId}/business-profile/edit`);
  await expect(page.getByRole('heading', { name: 'Business profile', exact: true })).toBeVisible();
  await page.locator('label').filter({ hasText: 'Registration number' }).last().locator('input').fill('SYNTHETIC-RESUBMITTED');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByText('Business profile draft saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Submit for review', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Submit for review', exact: true }).click();
  await expect(page.getByText('Submitted on behalf of the provider for platform review.', { exact: true })).toBeVisible();
  await page.goto(`/#platform/providers/${providerId}?tab=reviews`);
  await expect(page.getByRole('heading', { name: 'Review history', exact: true })).toBeVisible();
  const latestReason = page.getByPlaceholder(/Reason for/).last();
  await latestReason.fill('Synthetic corrected profile approved');
  await page.getByRole('button', { name: 'Verify', exact: true }).last().click();
  await expect(page.getByText(/Verified/i).last()).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('Business detail Change Request publishes v2 and preserves approved v1', async ({ page, evidence }) => {
  const businessId = process.env.TRISE_E2E_CHANGE_REQUEST_BUSINESS_ID?.trim();
  test.skip(!businessId, 'A synthetic approved Business v1 fixture is required.');
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto(`/#platform/businesses/${businessId}?tab=registrations`);
  await expect(page.getByRole('tab', { name: 'Registrations & Brands', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New business request', exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: 'New business compliance request' })).toBeVisible();
  const dialog = page.getByRole('dialog', { name: 'New business compliance request' });
  await dialog.getByLabel('Business area').selectOption({ label: 'Business trade name' });
  await dialog.getByLabel('Legal or registered name').fill('TRISE Demo Solar Water Heater Services');
  await dialog.getByLabel('Trade or brand name').fill(`TRISE v2 Synthetic Brand ${Date.now()}`);
  await dialog.getByLabel('Reason').fill('Synthetic Business v1 to v2 Change Request browser gate');
  const createResponsePromise = page.waitForResponse(response =>
    response.url().includes('/platform/compliance') && response.request().method() === 'POST'
  );
  await dialog.getByRole('button', { name: 'Create request', exact: true }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.status(), await createResponse.text()).toBe(201);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Requests & Reviews', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.locator('summary[aria-label^="Actions for request"]').first().click();
  await page.getByRole('button', { name: 'View details', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Request details' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Request details' }).getByRole('button', { name: 'Submit for review', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Request details' })).toHaveCount(0);

  await localSignOut(page);
  await localSignIn(page, configuredAccount('PLATFORM_REVIEWER'));
  await page.goto('/#platform/compliance');
  await expect(page.getByRole('heading', { name: 'Approval Inbox', exact: true })).toBeVisible();
  await page.getByPlaceholder('Business name, request or reference…').fill('Synthetic Business v1 to v2 Change Request browser gate');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  const row = page.locator('button.approval-request-row').filter({ hasText: /Business trade name/i }).first();
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.click();
  const assign = page.getByLabel('Authorized reviewer');
  if (await assign.count()) {
    await assign.selectOption({ label: 'Demo Dispatcher' });
    await page.getByLabel('Assignment reason', { exact: true }).fill('Synthetic v2 browser review assignment');
    await page.getByRole('button', { name: 'Assign', exact: true }).click();
  }
  await page.getByRole('combobox', { name: 'Decision', exact: true }).selectOption('APPROVE');
  await page.getByLabel('Decision reason', { exact: true }).fill('Synthetic v2 browser approval');
  await page.getByRole('button', { name: 'Record decision', exact: true }).click();
  await expect(page.getByText('Applied', { exact: true }).last()).toBeVisible();

  await page.goto(`/#platform/businesses/${businessId}?tab=history`);
  await expect(page.getByRole('button', { name: 'Approved versions', exact: true })).toBeVisible();
  const approvedVersionRows: string[] = [];
  for (let pageNumber = 1; pageNumber <= 10; pageNumber += 1) {
    const rows = await page.locator('table tbody tr').allInnerTexts();
    approvedVersionRows.push(...rows.filter(row => /Business Trade Name/i.test(row)));
    const next = page.getByRole('button', { name: 'Next', exact: true });
    if (await next.isDisabled()) break;
    await Promise.all([
      page.waitForResponse(response => response.url().includes('/platform/businesses/') && response.url().includes('/compliance-history?kind=versions')),
      next.click()
    ]);
  }
  expect(approvedVersionRows.some(row => /\bv1\b/.test(row))).toBe(true);
  expect(approvedVersionRows.some(row => /\bv2\b/.test(row))).toBe(true);
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('Business and provider directory filters expose aligned lifecycle options', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/businesses');
  const businessStatus = page.getByRole('combobox', { name: 'Filter businesses by status', exact: true });
  await expect(businessStatus).toBeVisible();
  await expect(businessStatus.locator('option')).toHaveText(['All statuses', 'Active', 'On hold', 'Suspended', 'Blocked', 'Closed']);
  await page.goto('/#platform/providers');
  const providerStatus = page.getByRole('combobox', { name: 'Filter providers by status', exact: true });
  await expect(providerStatus).toBeVisible();
  await expect(providerStatus.locator('option')).toHaveText(['All statuses', 'Pending', 'Pending activation', 'Active', 'On hold', 'Suspended', 'Closed']);
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('Business workspace exposes registrations, brands, secure documents and history', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/businesses');
  await expect(page.locator('summary[aria-label^="Actions for"]').first()).toBeVisible();
  await page.locator('summary[aria-label^="Actions for"]').first().click();
  await page.getByRole('button', { name: 'Open Business details', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'GST Registrations', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Registrations & Brands', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Documents', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'History & Audit', exact: true })).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('Platform provider compliance workspace scopes licences and territories to the selected provider', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/providers');
  await page.locator('summary[aria-label^="Actions for"]').first().click();
  await page.getByRole('button', { name: 'View details', exact: true }).click();
  await expect(page).toHaveURL(/#platform\/providers\/[^/?]+/);
  const providerId = page.url().match(/#platform\/providers\/([^/?]+)/)?.[1];
  expect(providerId).toBeTruthy();
  await page.goto(`/#platform/compliance?provider_id=${providerId}`);
  await expect(page.getByRole('heading', { name: 'Licences & compliance', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Licence authorizations', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operating territories', exact: true })).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('Provider detail keeps administrator access and subscription as separate controls', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/providers');
  await page.locator('summary[aria-label^="Actions for"]').first().click();
  await page.getByRole('button', { name: 'View details', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Team & Access', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Subscription & Billing', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Team & Access', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Administrators & access/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Subscription & Billing', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Subscription/ }).first()).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('Provider lifecycle controls expose the activation gate and audited action form', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/providers');
  const activeFilter = page.getByRole('combobox', { name: 'Filter providers by status', exact: true });
  await activeFilter.selectOption('ACTIVE');
  await expect(page.locator('summary[aria-label^="Actions for"]').first()).toBeVisible();
  await page.locator('summary[aria-label^="Actions for"]').first().click();
  await page.getByRole('button', { name: 'View details', exact: true }).click();
  await expect(page).toHaveURL(/#platform\/providers\/[^/?]+/);
  const providerId = page.url().match(/#platform\/providers\/([^/?]+)/)?.[1];
  expect(providerId).toBeTruthy();
  await page.goto(`/#platform/providers/${providerId}/lifecycle`);
  await expect(page.getByRole('heading', { name: 'Operational lifecycle', exact: true })).toBeVisible();
  await expect(page.locator('select').filter({ has: page.locator('option') }).first()).toHaveCount(1);
  await expect(page.getByPlaceholder('COMPLIANCE_REVIEW')).toBeVisible();
  await expect(page.getByLabel(/Reason/).last()).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

test('approved Business provider can activate through the audited lifecycle control', async ({ page, evidence }) => {
  const providerId = process.env.TRISE_E2E_ACTIVATION_PROVIDER_ID?.trim();
  test.skip(!providerId, 'A synthetic approved-Business activation fixture is required.');
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto(`/#platform/providers/${providerId}/lifecycle`);
  await expect(page.getByRole('heading', { name: 'Operational lifecycle', exact: true })).toBeVisible();
  const action = page.getByRole('combobox').last();
  await action.selectOption({ label: 'Activate provider' });
  await page.getByPlaceholder('COMPLIANCE_REVIEW').fill('ONBOARDING_APPROVED');
  await page.getByLabel(/Reason/).last().fill('Approved synthetic Business onboarding gate');
  await page.getByRole('button', { name: 'Activate provider', exact: true }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Activate provider', exact: true }).click();
  await expect(page.locator('dl').getByText('Active', { exact: true })).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

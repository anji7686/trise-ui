import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';
import { e2eApiV1Base } from './e2e-config';

async function navigateProvider(page: import('playwright/test').Page, label: string) {
  const navigation = page.getByRole('complementary', { name: 'Operations navigation' });
  const item = navigation.getByRole('button', { name: label, exact: true });
  if (!await item.isVisible().catch(() => false)) await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await item.click();
}

test.use({ trace: 'on-first-retry', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('provider operations overview renders the provider-scoped elevator dashboard', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');

  const { accessToken } = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await menu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Overview');
  await expect(page.getByRole('heading', { name: 'Operations dashboard', exact: true })).toBeVisible();
  for (const label of ['Open requests', "Today's appointments", 'Active jobs', 'AMC renewals due', 'Payment follow-ups', 'Escalations']) await expect(page.getByText(label, { exact: true })).toBeVisible();
  for (const heading of ["Today's operations", 'Urgent complaints', 'Project stage billing', 'Technician availability', 'AMC renewal pipeline', 'Recent activity']) await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  const appointmentRows = page.locator('.dashboard-table button.dashboard-table-row');
  if (await appointmentRows.count()) {
    const firstAppointment = appointmentRows.first();
    for (const column of [1, 2, 3]) {
      await expect.poll(() => firstAppointment.locator(':scope > span').nth(column).evaluate(element => getComputedStyle(element).whiteSpace)).toBe('normal');
    }
    await expect.poll(() => firstAppointment.locator(':scope > .dashboard-appointment-status').evaluate(element => getComputedStyle(element).whiteSpace)).toBe('normal');
    await expect.poll(() => firstAppointment.locator('.dashboard-appointment-status .status').evaluate(element => getComputedStyle(element).whiteSpace)).toBe('normal');
    if ((page.viewportSize()?.width || 1440) <= 700) {
      await expect.poll(() => page.locator('.dashboard-panel-wide .dashboard-table').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      for (const label of ['Customer / site', 'Service type', 'Technician', 'Status']) await expect(firstAppointment.locator(`[data-label="${label}"]`)).toBeVisible();
    }
  }
  await expect.poll(() => page.locator('.dashboard-renewal-table').evaluate(element => getComputedStyle(element).tableLayout)).toBe('auto');
  await page.screenshot({ path: info.outputPath('provider-admin-dashboard.png'), fullPage: true });
  const search = page.getByLabel('Search customers, jobs, assets and requests');
  await search.fill('App');
  await expect(page.getByRole('listbox', { name: '' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Open Appointments' })).toBeVisible();
  await page.getByRole('option', { name: 'Open Appointments' }).click();
  await expect(page).toHaveURL(/#bookings$/);
  await page.goto(`${page.url().split('#')[0]}#overview`);
  await search.fill('Appointments');
  await search.press('Enter');
  await expect(page).toHaveURL(/#bookings$/);
  await page.goto(`${page.url().split('#')[0]}#overview`);
  await expect(page.getByRole('heading', { name: 'Operations dashboard', exact: true })).toBeVisible();
  const metricRoutes: Array<[string, string]> = [['Open requests', 'requests'], ["Today's appointments", 'bookings'], ['Active jobs', 'jobs'], ['AMC renewals due', 'amc'], ['Payment follow-ups', 'projects'], ['Escalations', 'requests']];
  for (const [label, hash] of metricRoutes) {
    await page.getByRole('button', { name: new RegExp(label, 'i') }).click();
    await expect(page).toHaveURL(new RegExp(`#${hash}$`));
    await page.goto(`${page.url().split('#')[0]}#overview`);
    await expect(page.getByRole('heading', { name: 'Operations dashboard', exact: true })).toBeVisible();
  }
  await page.locator('.dashboard-panel-wide').getByRole('button', { name: 'View all', exact: true }).click();
  await expect(page).toHaveURL(/#bookings$/);
  await page.goto(`${page.url().split('#')[0]}#overview`);
  await page.getByRole('button', { name: 'View requests', exact: true }).click();
  await expect(page).toHaveURL(/#requests$/);
  await page.goto(`${page.url().split('#')[0]}#overview`);
  const dashboardResponse = await page.request.get(`${e2eApiV1Base()}/providers/operations/dashboard`, { headers: { Authorization: `Bearer ${accessToken}`, 'X-TRISE-Provider-Id': providerId } });
  expect(dashboardResponse.ok()).toBeTruthy();
  const dashboard = await dashboardResponse.json();
  expect(dashboard.data.attributes.counts).toMatchObject({ open_requests: expect.any(Number), todays_appointments: expect.any(Number), active_jobs: expect.any(Number), amc_renewals_due: expect.any(Number), open_payment_schedules: expect.any(Number), escalations: expect.any(Number) });
  await expect(page.getByText('Platform subscription billing', { exact: true })).toHaveCount(0);
  await localSignOut(page);
});

test('provider leads register is populated, selectable and responsive', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const accountMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await accountMenu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Marketing Leads & Surveys');
  await expect(page.getByRole('heading', { name: 'Leads & site surveys', exact: true })).toBeVisible();
  await expect(page.locator('.lead-register')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Rows per page', exact: true })).toHaveValue('10');
  const leadRows = page.locator('.lead-register tbody tr');
  await expect(leadRows).not.toHaveCount(0);
  const firstLead = page.locator('.lead-register-select').first();
  await firstLead.click();
  await expect(page.getByRole('dialog').filter({ hasText: 'Lead details' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
  if ((page.viewportSize()?.width || 1440) <= 700) {
    await expect.poll(() => page.locator('.lead-register-scroll').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await page.screenshot({ path: info.outputPath('provider-admin-leads-register.png'), fullPage: true });
  await localSignOut(page);
});

test('provider quotations register and detail are populated and responsive', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const accountMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await accountMenu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Sales & Quotations');
  await expect(page.getByRole('heading', { name: 'Quotations & Orders', exact: true })).toBeVisible();
  const quotationRows = page.locator('.quotation-register tbody tr');
  await expect(quotationRows.first()).toBeVisible({ timeout: 15_000 });
  const baselineRowCount = await quotationRows.count();
  for (const column of ['Quote No.', 'Prospect / Customer', 'Scope', 'Rev.', 'Status', 'Value (₹)', 'Last updated']) await expect(page.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
  await expect(quotationRows.first().locator('[data-label="Quote No."]')).not.toHaveText(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i);
  await expect(quotationRows.first().locator('td').nth(1)).not.toHaveText(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i);
  await quotationRows.first().locator('.quotation-row-select').click();
  await expect(page.getByRole('dialog').filter({ hasText: 'Quotation detail' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Quotation rows per page', exact: true })).toHaveValue('10');
  if ((page.viewportSize()?.width || 1440) <= 700) {
    await expect.poll(() => page.locator('.quotations-workspace').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    for (const label of ['Prospect / Customer', 'Scope', 'Revision', 'Status', 'Value', 'Last updated']) await expect(quotationRows.first().locator(`[data-label="${label}"]`)).toBeVisible();
  } else {
    await expect.poll(() => page.locator('.quotation-register-scroll').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await page.screenshot({ path: info.outputPath('provider-admin-quotations-orders.png'), fullPage: true });
  const quotationNumber = (await quotationRows.first().locator('td').first().innerText()).trim();
  const search = page.locator('input[aria-label="Search quotations"]');
  const searchResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/quotations') && url.searchParams.has('filter[q]');
  });
  await search.fill(quotationNumber);
  const filteredResponse = await searchResponse;
  expect(filteredResponse.ok()).toBeTruthy();
  const filteredRows = (await filteredResponse.json()).data as Array<{ attributes: { quotation_number: string } }>;
  expect(filteredRows.length).toBeGreaterThan(0);
  expect(filteredRows.every((row) => row.attributes.quotation_number === quotationNumber)).toBe(true);
  await expect(quotationRows).toHaveCount(filteredRows.length);
  await expect(quotationRows.first().locator('td').first()).toContainText(quotationNumber);
  await search.fill('');
  await expect(quotationRows).toHaveCount(baselineRowCount);
  const customerFilter = page.getByRole('combobox', { name: 'Filter quotations by customer', exact: true });
  const firstCustomer = await customerFilter.locator('option').nth(1).getAttribute('value');
  if (firstCustomer) {
    const customerResults = page.waitForResponse(response => response.url().includes('/quotations?') && response.url().includes('customer_relationship_id'));
    await customerFilter.selectOption(firstCustomer);
    expect((await customerResults).ok()).toBeTruthy();
    await customerFilter.selectOption('');
    await expect(quotationRows).toHaveCount(baselineRowCount);
  }
  const pageSize = page.getByRole('combobox', { name: 'Quotation rows per page', exact: true });
  const nextPageSize = page.waitForResponse(response => response.url().includes('/quotations?') && response.url().includes('limit') && response.url().includes('20'));
  await pageSize.selectOption('20');
  expect((await nextPageSize).ok()).toBeTruthy();
  await expect(pageSize).toHaveValue('20');
  await expect.poll(() => quotationRows.count()).toBeLessThanOrEqual(20);
  await localSignOut(page);
});

test('provider service request register and selected detail render responsively', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const accountMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await accountMenu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption('01a10a91-fc7f-70bb-b4a1-ddeefdded2f7');
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Service Requests');
  await expect(page.getByRole('heading', { name: 'Service Requests', exact: true })).toBeVisible();
  const requestRows = page.locator('.service-request-row');
  await expect(requestRows.first()).toBeVisible({ timeout: 15_000 });
  for (const column of ['Request ID', 'Request summary', 'Type', 'Created', 'Status']) await expect(page.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
  await requestRows.first().click();
  await expect(page.getByRole('complementary', { name: 'Selected service request details' })).toBeVisible();
  if ((page.viewportSize()?.width || 1440) <= 700) {
    await expect.poll(() => page.locator('.service-request-workspace').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    for (const label of ['Request ID', 'Type', 'Created', 'Status']) await expect(page.locator('.service-request-table tbody tr').first().locator(`[data-label="${label}"]`)).toBeVisible();
  } else {
    await expect.poll(() => page.locator('.service-request-table-scroll').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await page.screenshot({ path: info.outputPath('provider-admin-service-requests.png'), fullPage: true });
  await localSignOut(page);
});

test('provider appointments render on a time-aligned weekly calendar and list', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const accountMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await accountMenu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption('01a10a91-fc7f-70bb-b4a1-ddeefdded2f7');
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Appointments & Dispatch');
  await expect(page.getByRole('heading', { name: 'Appointments & dispatch', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous week' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next week' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Appointment view' }).getByRole('button', { name: 'Calendar' })).toBeVisible();
  const grid = page.locator('.booking-week-grid');
  await expect(grid).toBeVisible({ timeout: 15_000 });
  await expect(grid.locator('.booking-week-day')).toHaveCount(7);
  await expect(grid.getByText('08:00 am', { exact: false })).toBeVisible();
  await expect(grid.getByText('05:00 pm', { exact: false })).toBeVisible();
  if ((page.viewportSize()?.width || 1440) <= 700) {
    await expect.poll(() => page.locator('.booking-week-scroll').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'List', exact: true })).toBeVisible();
  }
  await page.screenshot({ path: info.outputPath('provider-admin-appointments-dispatch.png'), fullPage: true });
  await page.getByRole('button', { name: 'List', exact: true }).click();
  if (await page.locator('.feature-row').count()) await expect(page.locator('.feature-row').first().getByRole('button', { name: 'View booking' })).toBeVisible();
  else await expect(page.getByText('No appointments this week', { exact: true })).toBeVisible();
  await localSignOut(page);
});

test('provider jobs register opens selected job in a responsive authorized detail drawer', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const accountMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await accountMenu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption('01a10a91-fc7f-70bb-b4a1-ddeefdded2f7');
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Jobs & Execution');
  await expect(page.getByRole('heading', { name: 'Jobs & assignments', exact: true })).toBeVisible();
  const table = page.getByRole('table');
  await expect(table).toBeVisible({ timeout: 15_000 });
  const firstRow = table.locator('tbody tr').first();
  await expect(firstRow).toBeVisible();
  await firstRow.getByRole('button', { name: 'Open job', exact: true }).click();
  const detail = page.getByRole('dialog', { name: /^Job / });
  await expect(detail.locator('.job-detail')).toBeVisible();
  await expect(detail.getByRole('tab', { name: 'Overview', exact: true })).toBeVisible();
  if ((page.viewportSize()?.width || 1440) <= 700) {
    for (const label of ['Job No.', 'Title / service', 'Scheduled time', 'Technician', 'Status']) await expect(firstRow.locator(`[data-label="${label}"]`)).toBeVisible();
    await expect.poll(() => page.locator('.job-register-scroll').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  }
  await page.screenshot({ path: info.outputPath('provider-admin-jobs-selected-drawer.png') });
  await page.keyboard.press('Escape');
  await expect(detail).toHaveCount(0);
  await localSignOut(page);
});

test('provider job execution and evidence forms remain permission-gated and responsive', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const accountMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await accountMenu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption('01a10a91-fc7f-70bb-b4a1-ddeefdded2f7');
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await navigateProvider(page, 'Jobs & Execution');
  const firstRow = page.getByRole('table').locator('tbody tr').first();
  await expect(firstRow).toBeVisible({ timeout: 15_000 });
  const jobId = await firstRow.getAttribute('data-job-id');
  expect(jobId).toBeTruthy();
  await firstRow.getByRole('button', { name: 'Open job', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /^Job / })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /^Job / })).toHaveCount(0);
  const root = page.url().split('#')[0];
  await page.goto(`${root}#jobs/${jobId}`);
  const detail = page.locator('.job-detail');
  await expect(detail).toBeVisible({ timeout: 15_000 });
  await detail.getByRole('tab', { name: 'Execution', exact: true }).click();
  await expect(detail.getByRole('heading', { name: 'Execution', exact: true })).toBeVisible();
  const visitGate = detail.getByRole('heading', { name: 'Execution visit required', exact: true });
  if (await visitGate.count()) await expect(detail.getByRole('button', { name: 'Create visit', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('provider-admin-job-execution-state.png') });
  await detail.getByRole('tab', { name: 'Evidence', exact: true }).click();
  await expect.poll(() => detail.locator('.evidence-list').locator('> *').count()).toBeGreaterThan(0);
  await detail.getByRole('button', { name: 'Add work note', exact: true }).click();
  const noteDialog = page.getByRole('dialog', { name: 'Add internal work note', exact: true });
  await expect(noteDialog.getByRole('textbox', { name: 'Note', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('provider-admin-job-work-note-dialog.png') });
  await page.keyboard.press('Escape');
  await expect(noteDialog).toHaveCount(0);
  await detail.getByRole('button', { name: 'Record part usage', exact: true }).click();
  const partDialog = page.getByRole('dialog', { name: 'Record part usage', exact: true });
  await expect(partDialog.getByRole('spinbutton', { name: 'Quantity', exact: true })).toHaveAttribute('min', '0.001');
  await expect(partDialog.getByRole('textbox', { name: 'Unit', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('provider-admin-job-part-usage-dialog.png') });
  await page.keyboard.press('Escape');
  await expect(partDialog).toHaveCount(0);
  await localSignOut(page);
});

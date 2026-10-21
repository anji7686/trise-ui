import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';
import { e2eApiV1Base } from './e2e-config';
import type { Page, TestInfo } from 'playwright/test';

// This suite is intentionally authenticated and only runs when the existing
// development-sign-in projects are enabled. Credentials remain in the private
// API secrets file; no token, cookie, or password is stored in the repository.
test.use({ screenshot: 'on', trace: 'retain-on-failure', video: 'retain-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

async function capture(page: Page, testInfo: TestInfo, name: string, fullPage = true) {
  const screenshot = await page.screenshot({ fullPage, path: testInfo.outputPath(`${name}.png`) });
  await testInfo.attach(name, { body: screenshot, contentType: 'image/png' });
}

async function navigateHash(page: Page, hash: string) {
  const root = page.url().split('#')[0];
  await page.goto(`${root}#${hash}`);
}

async function requireProviderContext(page: Page) {
  const menuButton = page.getByRole('button', { name: 'Open account menu', exact: true });
  await menuButton.click();
  const menu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  const provider = menu.getByRole('combobox', { name: 'Provider', exact: true });
  const options = provider.locator('option');
  await expect.poll(() => options.count(), { timeout: 20_000 }).toBeGreaterThan(1);
  if (await options.count() < 2) throw new Error('Provider visual verification requires an authorized provider option; none was returned for this account.');
  if (!(await provider.inputValue())) await provider.selectOption({ index: 1 });
  expect(await provider.inputValue()).toBeTruthy();
  const providerId = await provider.inputValue();
  await menuButton.click();
  return providerId;
}

test('authenticated Customer critical views render at the configured viewport', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('customer'), 'Customer visual workflow runs in Customer projects only.');
  await localSignIn(page, configuredAccount('CUSTOMER'));
  await expect(page.getByRole('button', { name: 'Projects', exact: true })).toBeVisible();
  await capture(page, testInfo, 'customer-home');
  await page.getByRole('button', { name: 'Assets', exact: true }).click();
  await expect(page).toHaveURL(/#\/assets$/);
  await capture(page, testInfo, 'customer-assets');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await expect(page).toHaveURL(/#\/projects$/);
  await capture(page, testInfo, 'customer-installation-projects');
  await localSignOut(page);
});

test('authenticated Global Admin Operations workflows render at the configured viewport', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('operations'), 'Operations visual workflow runs in Operations projects only.');
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await navigateHash(page, 'platform/overview');
  await expect(page).toHaveURL(/#platform\/overview$/);
  await capture(page, testInfo, 'global-admin-platform-overview');
  await navigateHash(page, 'platform/roles');
  await expect(page).toHaveURL(/#platform\/roles(?:\?.*)?$/);
  await capture(page, testInfo, 'global-admin-roles');
  await localSignOut(page);
});

test('authenticated Provider Admin Operations workflows render at the configured viewport', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('operations'), 'Operations visual workflow runs in Operations projects only.');
  const providerAdmin = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const providerId = await requireProviderContext(page);
  const permissionResponse = await page.request.get(`${e2eApiV1Base()}/provider/access/self/effective-permissions`, { headers: { Authorization: `Bearer ${providerAdmin.accessToken}`, 'X-TRISE-Provider-Id': providerId } });
  expect(permissionResponse.ok()).toBeTruthy();
  const permissionPayload = await permissionResponse.json();
  const activePermissions = new Set((permissionPayload.data.attributes.permissions as Array<{ code: string; grant_effective: boolean }>).filter((item) => item.grant_effective).map((item) => item.code));
  await navigateHash(page, 'overview');
  await expect(page).toHaveURL(/#overview$/);
  await expect(page.getByRole('heading', { name: 'Operations dashboard', exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: "Today's operations" })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Urgent complaints' })).toBeVisible();
  await expect(page.locator('.dashboard-complaint-row')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: 'Technician availability' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Days left' })).toBeVisible();
  await expect(page.locator('.dashboard-renewal-table tbody tr')).toHaveCount(5);
  if ((page.viewportSize()?.width || 1440) <= 900) {
    const menu = page.getByRole('button', { name: 'Menu', exact: true });
    const navigation = page.getByRole('complementary', { name: 'Operations navigation' });
    await expect(menu).toBeVisible();
    await expect(navigation).toBeHidden();
    await menu.click();
    await expect(navigation).toBeVisible();
    await navigation.getByRole('button', { name: 'Overview', exact: true }).click();
    await expect(navigation).toBeHidden();
  }
  await capture(page, testInfo, 'provider-admin-overview');
  const providerScreens = [
    ['leads', 'leads-site-surveys'],
    ['quotations', 'quotations-orders'],
    ['projects', 'projects-stages-payments-materials'],
    ['requests', 'service-requests'],
    ['bookings', 'appointments-dispatch'],
    ['jobs', 'jobs-assignments-execution-qa-handover'],
    ['customers', 'customers-sites-assets'],
    ['amc', 'amc-preventive-maintenance'],
    ['workforce', 'workforce-management'],
    ['reports', 'reports-analytics-exports'],
    ['administration', 'provider-administration'],
    ['business-profile', 'provider-business-profile'],
    ['compliance', 'provider-compliance'],
    ['team-access', 'provider-teams-roles'],
    ['audit', 'provider-audit-logs'],
    ['onboarding', 'property-onboarding'],
    ['configuration', 'provider-configuration'],
    ['configuration/notification-policies', 'provider-notification-policies'],
    ['subscriptions', 'provider-subscription']
  ] as const;
  const apiFailures: string[] = [];
  const recordApiFailure = (response: import('playwright/test').Response) => {
    if (response.url().includes('/api/v1/') && response.status() >= 400) {
      apiFailures.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  };
  page.on('response', recordApiFailure);
  for (const [hash, name] of providerScreens) {
    apiFailures.length = 0;
    await navigateHash(page, hash);
    await expect(page).toHaveURL(new RegExp(`#${hash.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`));
    await expect(page.locator('.operations-main')).toBeVisible();
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await expect.poll(async () => page.locator('.operations-main').innerText(), { timeout: 20_000 }).not.toMatch(/\bLoading\b/i);
    const expectedPrivateLogoStorageUnavailable: string[] = apiFailures.filter((failure) => failure === '503 /api/v1/providers/logo');
    expect(apiFailures.filter((failure) => !expectedPrivateLogoStorageUnavailable.includes(failure)), `Unexpected API failures on ${hash}: ${apiFailures.join(', ')}`).toEqual([]);
    if (hash === 'business-profile' && expectedPrivateLogoStorageUnavailable.length) {
      await expect(page.locator('.operations-main')).toContainText('Private logo storage is temporarily unavailable.');
    }
    await expect(page.locator('.operations-main .feature-error')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('.operations-main .state-error')).toHaveCount(0);
    await expect(page.locator('.operations-main .state-forbidden')).toHaveCount(0);
    if (hash === 'leads') {
      await expect(page.getByRole('heading', { name: 'Select a lead' })).toHaveCount(0);
      await page.locator('.lead-register tbody tr').first().getByRole('button', { name: 'View', exact: true }).click();
      await expect(page.getByRole('dialog').filter({ hasText: 'Lead details' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
      await page.getByRole('tab', { name: 'Site Survey' }).click();
      await page.getByRole('button', { name: 'Start survey', exact: true }).click();
      const surveyWizard = page.locator('.site-survey-wizard');
      await expect(surveyWizard.getByLabel('Site visit date', { exact: true })).toBeVisible();
      await surveyWizard.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('tab', { name: 'Overview' }).click();
    }
    if (hash === 'quotations') {
      await page.locator('.quotation-register tbody tr').first().locator('.quotation-row-select').click();
      await expect(page.getByRole('dialog').filter({ hasText: 'Quotation detail' })).toBeVisible();
      await page.getByRole('button', { name: /New quotation/i }).click();
      const quotationDialog = page.getByRole('dialog', { name: 'Create quotation' });
      await expect(quotationDialog).toBeVisible();
      await quotationDialog.getByRole('button', { name: 'Close', exact: true }).click();
      const paidAmcAction = page.getByRole('button', { name: 'Create paid AMC renewal', exact: true });
      if (await paidAmcAction.isEnabled()) {
        await paidAmcAction.click();
        const renewalDialog = page.getByRole('dialog', { name: 'Create paid AMC renewal quotation', exact: true });
        await expect(renewalDialog.getByLabel('Predecessor contract')).toBeVisible();
        await expect(renewalDialog.getByLabel('Amount (INR)')).toBeVisible();
        await expect(renewalDialog.getByRole('button', { name: 'Create renewal quotation', exact: true })).toBeVisible();
        await capture(page, testInfo, 'provider-admin-paid-amc-renewal-dialog');
        await renewalDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      }
      const revisionAction = page.getByRole('button', { name: 'Create revision', exact: true });
      if (await revisionAction.count()) {
        await revisionAction.click();
        const revisionDialog = page.getByRole('dialog', { name: 'Create quotation revision' });
        await expect(revisionDialog.getByLabel('Description')).toBeVisible();
        await expect(revisionDialog.getByLabel('Total (INR)')).toBeVisible();
        await capture(page, testInfo, 'provider-admin-quotation-revision-dialog');
        await revisionDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Record negotiation', exact: true }).click();
      const negotiationDialog = page.getByRole('dialog', { name: 'Record negotiation' });
      await expect(negotiationDialog.getByLabel('Notes')).toBeVisible();
      await capture(page, testInfo, 'provider-admin-quotation-negotiation-dialog');
      await negotiationDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
    if (hash === 'projects') {
      const projectTable = page.getByRole('table');
      await expect(projectTable).toBeVisible();
      await expect(projectTable.locator('tbody tr').first()).toBeVisible();
      await expect(page.getByLabel('Project rows per page')).toHaveValue('10');
      await page.getByRole('button', { name: 'Open project' }).first().click();
      await expect(page.getByRole('button', { name: '← Projects' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add material requirement', exact: true })).toHaveCount(activePermissions.has('SERVICE_JOB_EDIT') ? 1 : 0);
      const editProject = page.getByRole('button', { name: 'Edit project', exact: true });
      if (await editProject.count()) {
        await editProject.click();
        const editDialog = page.getByRole('dialog', { name: 'Edit project draft' });
        await expect(editDialog.getByLabel('Project name *')).toBeVisible();
        await capture(page, testInfo, 'provider-admin-project-edit-dialog');
        await editDialog.getByRole('button', { name: 'Close Edit project draft' }).click();
      }
      await page.getByRole('button', { name: 'Add material requirement', exact: true }).click();
      const materialDialog = page.getByRole('dialog', { name: 'Add material requirement' });
      await expect(materialDialog.getByLabel('Material code *')).toBeVisible();
      await expect(materialDialog.getByLabel('Required quantity *')).toBeVisible();
      await expect(materialDialog.getByLabel('Required quantity *')).toHaveValue('');
      await expect(materialDialog.getByRole('button', { name: 'Save requirement', exact: true })).toBeVisible();
      await capture(page, testInfo, 'provider-admin-material-requirement-dialog');
      await materialDialog.getByRole('button', { name: 'Close Add material requirement' }).click();
      const shipmentAction = page.getByRole('button', { name: 'Create shipment', exact: true });
      await expect(shipmentAction).toHaveCount(activePermissions.has('MATERIAL_SHIPMENT_RELEASE') ? 1 : 0);
      if (await shipmentAction.count() && await shipmentAction.isDisabled()) {
        await expect(page.getByText('No requirements recorded.')).toBeVisible();
      } else if (await shipmentAction.count()) {
        await shipmentAction.click();
        const shipmentDialog = page.getByRole('dialog', { name: 'Dispatch shipment' });
        await expect(shipmentDialog.getByLabel('Shipment number *')).toBeVisible();
        await capture(page, testInfo, 'provider-admin-shipment-dispatch-dialog');
        await shipmentDialog.getByRole('button', { name: 'Close Dispatch shipment' }).click();
      }
      await page.getByRole('button', { name: 'Add payment milestone', exact: true }).click();
      const paymentDialog = page.getByRole('dialog', { name: 'Configure payment stages' });
      await expect(paymentDialog.getByLabel('Payment basis')).toBeVisible();
      await paymentDialog.getByLabel('Payment basis').fill('1000000');
      const stageOne = paymentDialog.getByRole('group', { name: 'Stage 1' });
      const stageTwo = paymentDialog.getByRole('group', { name: 'Stage 2' });
      await expect(stageOne.getByLabel('Calculated amount')).toHaveValue('200000.00 INR');
      await expect(stageTwo.getByLabel('Calculated amount')).toHaveValue('800000.00 INR');
      await paymentDialog.getByRole('button', { name: 'Add stage', exact: true }).click();
      await stageTwo.getByLabel('Percentage *').fill('70');
      const stageThree = paymentDialog.getByRole('group', { name: 'Stage 3' });
      await stageThree.getByLabel('Percentage *').fill('10');
      await expect(paymentDialog.getByRole('status')).toContainText('100.00%');
      await expect(stageThree.getByLabel('Calculated amount')).toHaveValue('100000.00 INR');
      const paymentEditor = paymentDialog.locator('.payment-stage-editor');
      await paymentEditor.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      await capture(page, testInfo, 'provider-admin-configure-payment-stages-allocation-summary');
      await paymentEditor.evaluate((element) => { element.scrollTop = 0; });
      await capture(page, testInfo, 'provider-admin-configure-payment-stages-dialog');
      await paymentDialog.getByRole('button', { name: 'Close Configure payment stages' }).click();
      const projectTabs = page.getByRole('tablist', { name: 'Project work areas' });
      await expect(projectTabs.getByRole('tab')).toHaveCount(4);
      await projectTabs.getByRole('tab', { name: 'Stages & execution' }).click();
      await expect(page.getByRole('heading', { name: 'Installation milestones' })).toBeVisible();
      const createInstallationJob = page.getByRole('button', { name: 'Create installation job', exact: true });
      if (await createInstallationJob.count()) {
        await createInstallationJob.click();
        const createJobDialog = page.getByRole('dialog', { name: 'Create installation job' });
        await expect(createJobDialog.getByLabel('Service type *')).toBeVisible();
        await expect(createJobDialog.getByLabel('Summary *')).toBeVisible();
        await capture(page, testInfo, 'provider-admin-create-installation-job-dialog', false);
        await createJobDialog.getByRole('button', { name: 'Close Create installation job' }).click();
      }
      await projectTabs.getByRole('tab', { name: 'QA & handover' }).click();
      await expect(page.getByRole('heading', { name: 'Commissioning defects and reinspection' })).toBeVisible();
      await page.getByRole('button', { name: 'Report defect', exact: true }).click();
      const defectDialog = page.getByRole('dialog', { name: 'Report commissioning defect' });
      await expect(defectDialog.getByLabel('Quality finding title')).toBeVisible();
      await capture(page, testInfo, 'provider-admin-report-defect-dialog');
      await defectDialog.getByRole('button', { name: 'Close Report commissioning defect' }).click();
      const handoverAction = page.getByRole('button', { name: 'Request handover', exact: true });
      if (await handoverAction.isDisabled()) {
        await expect(page.getByText(/Per-unit handover is unavailable until an authorized elevator unit is linked/)).toBeVisible();
        await expect(page.getByRole('dialog', { name: 'Request per-unit handover' })).toHaveCount(0);
      } else {
        await handoverAction.click();
        const handoverDialog = page.getByRole('dialog', { name: 'Request per-unit handover' });
        await expect(handoverDialog.getByLabel('Handover evidence document ID')).toBeVisible();
        await capture(page, testInfo, 'provider-admin-request-handover-dialog');
        await handoverDialog.getByRole('button', { name: 'Close Request per-unit handover' }).click();
      }
      await projectTabs.getByRole('tab', { name: 'Commercial' }).click();
      await expect(page.getByRole('heading', { name: 'Payment history' })).toBeVisible();
      await projectTabs.getByRole('tab', { name: 'Overview' }).click();
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
      expect(apiFailures, `API failures after opening project: ${apiFailures.join(', ')}`).toEqual([]);
    }
    if (hash === 'requests') {
      const registerRows = page.locator('.service-request-row');
      await expect(registerRows.first()).toBeVisible();
      await expect(registerRows.first()).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('complementary', { name: 'Selected service request details' })).toBeVisible();
      await expect(page.locator('.service-request-facts')).toBeVisible();
      const createRequestButton = page.getByRole('button', { name: 'Create request', exact: true });
      if (await createRequestButton.count()) {
        await createRequestButton.click();
        const requestDialog = page.getByRole('dialog', { name: 'Create service request' });
        await expect(requestDialog.getByLabel('Issue title *')).toBeVisible();
        await expect(requestDialog.getByLabel('Customer relationship *')).toBeVisible();
        await expect(requestDialog.getByLabel('Service type *')).toBeVisible();
        await expect(requestDialog.getByLabel('Request type *')).toBeVisible();
        await capture(page, testInfo, 'provider-admin-create-service-request-dialog', false);
        await requestDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      }
      if (await page.getByRole('button', { name: 'Update status', exact: true }).count()) {
        await page.getByRole('button', { name: 'Update status', exact: true }).click();
        const transitions = page.getByRole('dialog', { name: 'Update request status' });
        await expect(transitions).toBeVisible();
        await expect(transitions.locator('.request-transition-list .button').first()).toBeVisible();
        await capture(page, testInfo, 'provider-admin-request-status-dialog');
        await transitions.getByRole('button', { name: 'Close Update request status' }).click();
      }
      if (await registerRows.count() > 1) {
        await registerRows.nth(1).click();
        await expect(registerRows.nth(1)).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.service-request-facts')).toBeVisible();
      }
    }
    if (hash === 'reports') {
      await capture(page, testInfo, 'provider-admin-reports-overview');
      await page.getByRole('button', { name: 'Custom report builder', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Custom report builder', exact: true })).toBeVisible();
      await capture(page, testInfo, 'provider-admin-reports-builder');
      await page.getByRole('button', { name: 'Create report', exact: true }).click();
      const reportDialog = page.getByRole('dialog', { name: 'Create report definition' });
      await expect(reportDialog).toBeVisible();
      await expect(reportDialog.getByLabel('Report name *')).toBeVisible();
      await expect(reportDialog.getByLabel('Category *')).toBeVisible();
      await capture(page, testInfo, 'provider-admin-reports-builder-dialog');
      await reportDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.getByRole('button', { name: 'Scheduled reports', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Scheduled reports', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Export history', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Export history', exact: true })).toBeVisible();
    }
    if (hash === 'administration') {
      await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Administration sections' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Team & Access/ })).toBeVisible();
      await page.getByRole('button', { name: /Team & Access/ }).click();
      await expect(page).toHaveURL(/#team-access$/);
      await navigateHash(page, 'administration');
      await expect(page.getByRole('heading', { name: 'Administration', exact: true })).toBeVisible();
    }
    if (hash === 'workforce') {
      await expect(page.getByRole('navigation', { name: 'Workforce sections' })).toBeVisible();
      await expect(page.getByLabel('Workforce rows per page')).toHaveValue('10');
      await expect(page.locator('.workforce-agent-row').first()).toBeVisible();
      await page.getByRole('button', { name: 'Availability & Dispatch' }).click();
      await expect(page.getByRole('heading', { name: 'Availability & Dispatch', exact: true })).toBeVisible();
      if (await page.getByRole('button', { name: 'Set availability', exact: true }).isEnabled()) {
        await page.getByRole('button', { name: 'Set availability', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Set availability' })).toBeVisible();
        await page.getByRole('button', { name: 'Close Set availability' }).click();
      }
      await page.getByRole('button', { name: 'Skills & Certifications' }).click();
      await expect(page.getByRole('heading', { name: 'Skills & Certifications', exact: true })).toBeVisible();
      if (await page.getByRole('button', { name: 'Add skill', exact: true }).isEnabled()) {
        await page.getByRole('button', { name: 'Add skill', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Add skill attainment' })).toBeVisible();
        await page.getByRole('button', { name: 'Close Add skill attainment' }).click();
      }
      await page.getByRole('button', { name: 'Leave & Holidays' }).click();
      await expect(page.getByRole('heading', { name: 'Leave requests', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Team', exact: true }).click();
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
      const manageProviderAccess = page.getByRole('button', { name: 'Manage provider access', exact: true });
      if (await manageProviderAccess.count()) {
        await manageProviderAccess.click();
        await expect(page).toHaveURL(/#team-access$/);
        await expect(page.getByRole('heading', { name: 'Team & Access', exact: true })).toBeVisible();
        await navigateHash(page, 'workforce');
        await page.getByRole('button', { name: 'Team', exact: true }).click();
        await expect(page.getByText(/Role grants and membership permissions are managed in Team & Access/)).toBeVisible();
      }
      expect(apiFailures, `Late API failures on workforce: ${apiFailures.join(', ')}`).toEqual([]);
      await expect(page.getByRole('alert')).toHaveCount(0);
    }
    if (hash === 'bookings') {
      await expect(page.locator('.booking-week-day')).toHaveCount(7);
      await page.getByRole('button', { name: 'Create booking', exact: true }).click();
      const createAppointmentDialog = page.getByRole('dialog', { name: 'Create appointment' });
      await expect(createAppointmentDialog.getByRole('heading', { name: 'Appointment details' })).toBeVisible();
      await expect(createAppointmentDialog.getByRole('heading', { name: 'Requested window' })).toBeVisible();
      await expect(createAppointmentDialog.getByLabel('Summary *')).toBeVisible();
      await expect(createAppointmentDialog.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
      await expect(createAppointmentDialog.getByRole('button', { name: 'Create appointment', exact: true })).toBeVisible();
      await capture(page, testInfo, 'provider-admin-create-appointment-dialog', false);
      await createAppointmentDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      const calendarEvent = page.locator('.booking-week-event').first();
      if (await calendarEvent.count()) {
        await expect(calendarEvent).toBeVisible();
        const appointmentSummary = (await calendarEvent.locator('strong').textContent())?.trim();
        await calendarEvent.click();
        await expect(page.getByRole('heading', { name: appointmentSummary, exact: true })).toBeVisible();
        const rescheduleButton = page.getByRole('button', { name: 'Reschedule', exact: true });
        if (await rescheduleButton.isVisible()) {
          await rescheduleButton.click();
          const rescheduleDialog = page.getByRole('dialog', { name: 'Reschedule appointment' });
          await expect(rescheduleDialog.getByRole('heading', { name: 'Current appointment' })).toBeVisible();
          await expect(rescheduleDialog.getByRole('heading', { name: 'Alternative timing' })).toBeVisible();
          await capture(page, testInfo, 'provider-admin-reschedule-appointment-dialog', false);
          await rescheduleDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        }
      } else {
        await expect(page.getByRole('heading', { name: 'No appointments this week', exact: true })).toBeVisible();
        await capture(page, testInfo, 'provider-admin-empty-appointments-calendar');
      }
      await expect(page.locator('.booking-week-day')).toHaveCount(7);
    }
    if (hash === 'customers') {
      const addCustomer = page.getByRole('button', { name: 'Add customer', exact: true });
      if (await addCustomer.isVisible()) {
        await addCustomer.click();
        const customerDialog = page.getByRole('dialog', { name: 'Add customer' });
        await expect(customerDialog.getByLabel('Display name *')).toBeVisible();
        await expect(customerDialog.getByLabel('Customer type')).toBeVisible();
        await expect(customerDialog.getByText(/creates the customer identity and this provider's relationship/i)).toBeVisible();
        await expect(customerDialog.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
        await expect(customerDialog.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
        await capture(page, testInfo, 'provider-admin-create-customer-dialog', false);
        await customerDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      }
      const registerAsset = page.getByRole('button', { name: 'Register asset', exact: true });
      if (await registerAsset.isEnabled()) {
        await registerAsset.click();
        const assetDialog = page.getByRole('dialog', { name: 'Register asset' });
        await expect(assetDialog.getByLabel('Customer relationship *')).toBeVisible();
        await expect(assetDialog.getByLabel('Service location *')).toBeVisible();
        await expect(assetDialog.getByLabel('Asset family / definition *')).toBeVisible();
        await expect(assetDialog.getByLabel('Asset name *')).toBeVisible();
        const definitionSelect = assetDialog.getByLabel('Asset family / definition *');
        if (await definitionSelect.locator('option').count() > 1) await definitionSelect.selectOption({ index: 1 });
        await expect(assetDialog.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
        await expect(assetDialog.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
        await capture(page, testInfo, 'provider-admin-register-asset-dialog', false);
        await assetDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      }
      const addLocation = page.getByRole('button', { name: 'Add service location', exact: true });
      if (await addLocation.isEnabled()) {
        await addLocation.click();
        const locationDialog = page.getByRole('dialog', { name: 'Add service location' });
        await expect(locationDialog.getByLabel('Customer relationship *')).toBeVisible();
        await expect(locationDialog.getByLabel('Location name *')).toBeVisible();
        await expect(locationDialog.getByLabel('Address *')).toBeVisible();
        await expect(locationDialog.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
        await expect(locationDialog.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
        await capture(page, testInfo, 'provider-admin-create-service-location-dialog', false);
        await locationDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      }
    }
    if (hash === 'jobs') {
      await expect(page.getByRole('table')).toBeVisible();
      const firstJob = page.getByRole('table').locator('tbody tr').first();
      await expect(firstJob).toBeVisible();
      const jobId = await firstJob.getAttribute('data-job-id');
      expect(jobId).toBeTruthy();
      await navigateHash(page, `jobs/${jobId}`);
      const jobDetail = page.locator('.job-detail');
      await expect(jobDetail).toBeVisible();
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
      await jobDetail.getByRole('button', { name: 'Assign or reassign technician', exact: true }).click();
      const assignmentDialog = page.getByRole('dialog', { name: 'Assign or reassign technician' });
      await expect(assignmentDialog.locator('select')).toBeVisible();
      await expect(assignmentDialog.locator('input[type="datetime-local"]')).toBeVisible();
      await capture(page, testInfo, 'provider-admin-technician-assignment-dialog', false);
      await assignmentDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      const executionTab = jobDetail.getByRole('tab', { name: 'Execution', exact: true });
      await expect(executionTab).toBeVisible();
      await executionTab.focus();
      await executionTab.press('Enter');
      const visitGate = jobDetail.locator('.execution-visit-gate');
      if (await visitGate.count()) {
        await expect(visitGate.locator('strong')).toHaveText('Execution visit required');
        await expect(visitGate).toContainText('An authorized technician must open a visit before checklist, work-session, and evidence actions become available.');
      } else {
        await expect(jobDetail.getByText(/^Visit status:/)).toBeVisible();
      }
      await expect(page.locator('.job-detail').getByRole('button', { name: 'Create visit', exact: true })).toHaveCount(0);
      await capture(page, testInfo, 'provider-admin-job-execution-authorization-gate');
      await jobDetail.getByRole('tab', { name: 'Evidence', exact: true }).click();
      await jobDetail.getByRole('button', { name: 'Add work note', exact: true }).click();
      const noteDialog = page.getByRole('dialog', { name: 'Add internal work note' });
      await expect(noteDialog.getByRole('textbox', { name: 'Note', exact: true })).toBeVisible();
      await capture(page, testInfo, 'provider-admin-job-work-note-dialog', false);
      await noteDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await jobDetail.getByRole('button', { name: 'Record part usage', exact: true }).click();
      const partDialog = page.getByRole('dialog', { name: 'Record part usage' });
      await expect(partDialog.getByLabel('Part description')).toBeVisible();
      await expect(partDialog.getByLabel('Quantity')).toBeVisible();
      await capture(page, testInfo, 'provider-admin-job-part-usage-dialog', false);
      await partDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    }
    await capture(page, testInfo, `provider-admin-${name}`);
  }
  page.off('response', recordApiFailure);
  await localSignOut(page);
});

test('authorized Provider Administrator can inspect a member effective-access preview', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('operations'), 'Authorized RBAC preview is an Operations-only workflow.');
  test.setTimeout(90_000);
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await requireProviderContext(page);
  await navigateHash(page, 'team-access');
  await expect(page.getByRole('heading', { name: 'Team & Access', exact: true })).toBeVisible();
  await expect(page.getByText('Loading members…', { exact: true })).toHaveCount(0);
  const memberRows = page.locator('.platform-provider-table tbody tr');
  await expect(memberRows.first()).toBeVisible();
  const actions = memberRows.first().locator('details.provider-member-action-menu');
  await actions.locator('summary').click();
  const previewRequest = page.waitForResponse(response => /\/api\/v1\/provider\/access\/members\/[^/]+\/effective-permissions$/.test(new URL(response.url()).pathname) && response.request().method() === 'GET');
  await actions.getByRole('menuitem', { name: 'Preview effective access', exact: true }).click();
  const response = await previewRequest;
  expect(response.status(), 'Provider Administrator must be authorized for the selected Provider membership preview').toBe(200);
  const body = await response.json();
  expect(body.data.attributes.provider_id).toBeTruthy();
  const previewWorkspace = page.getByRole('region', { name: 'Effective Access & Provider Isolation', exact: true });
  await expect(previewWorkspace).toBeVisible();
  await expect(page.getByText('Loading effective grants…', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(previewWorkspace.locator('td[data-label="Policy check"]').first()).toBeVisible();
  await capture(page, testInfo, 'provider-admin-effective-access-preview');
  await previewWorkspace.getByRole('button', { name: 'Back to members', exact: true }).click();
  await localSignOut(page);
});

test('Provider Admin subscription usage and change request follow the provider-scoped API contract', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('operations'), 'Provider subscription visual workflow runs in Operations projects only.');
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await requireProviderContext(page);
  await navigateHash(page, 'subscriptions');
  await expect(page.getByRole('heading', { name: 'Review subscription / usage', exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Current subscription', { exact: true })).toBeVisible();
  await expect(page.getByText('Capacity / action', { exact: true })).toBeVisible();
  await capture(page, testInfo, 'provider-subscription-usage');
  const openRequest = page.getByRole('button', { name: /Request (subscription change|a subscription)/ });
  await expect(openRequest).toBeVisible();
  await openRequest.click();
  const dialog = page.getByRole('dialog', { name: /Request subscription/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Reason')).toBeVisible();
  if (await dialog.getByLabel('Requested change').count()) await expect(dialog.getByLabel('Requested change')).toBeVisible();
  await capture(page, testInfo, 'provider-subscription-change-dialog');
  await dialog.locator('.provider-subscription-dialog-footer').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
  await localSignOut(page);
});

test('Provider Admin workforce permissions and qualifications stay in their authorized workflows', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('operations'), 'Workforce visual workflow runs in Operations projects only.');
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await requireProviderContext(page);
  const apiFailures: string[] = [];
  page.on('response', response => {
    if (response.url().includes('/api/v1/') && response.status() >= 400) apiFailures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await navigateHash(page, 'workforce');
  await expect(page.locator('.workforce-agent-row').first()).toBeVisible();
  await page.getByRole('button', { name: 'Skills & Certifications', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Skills & Certifications', exact: true })).toBeVisible();
  await capture(page, testInfo, 'provider-admin-workforce-qualifications');
  const addSkill = page.getByRole('button', { name: 'Add skill', exact: true });
  if (await addSkill.isEnabled()) {
    await addSkill.click();
    const dialog = page.getByRole('dialog', { name: 'Add skill attainment', exact: true });
    await expect(dialog.getByLabel('Effective from *')).toBeVisible();
    await expect(dialog.getByLabel('Skill *')).toBeVisible();
    await expect(dialog.getByLabel('Proficiency *')).toBeVisible();
    await expect(dialog.getByLabel('Valid through')).toBeVisible();
    await expect(dialog.getByLabel('Ends *')).toHaveCount(0);
    await capture(page, testInfo, 'provider-admin-workforce-add-skill-dialog');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Team', exact: true }).click();
  await expect(page.getByText(/Role grants and membership permissions are managed in Team & Access/)).toBeVisible();
  const accessLink = page.getByRole('button', { name: 'Manage provider access', exact: true });
  await expect(accessLink).toBeVisible();
  await accessLink.click();
  await expect(page).toHaveURL(/#team-access$/);
  await expect(page.getByRole('heading', { name: 'Team & Access', exact: true })).toBeVisible();
  await navigateHash(page, 'workforce');
  await page.getByRole('button', { name: 'Leave & Holidays', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Leave requests', exact: true })).toBeVisible();
  await capture(page, testInfo, 'provider-admin-workforce-leave');
  const requestedLeave = page.locator('.workforce-leave-panel .workforce-team-row').filter({ hasText: 'REQUESTED' }).first();
  if (await requestedLeave.count()) {
    await requestedLeave.getByRole('button', { name: 'Review', exact: true }).click();
    const reviewDialog = page.getByRole('dialog', { name: 'Review leave request', exact: true });
    await expect(reviewDialog.getByLabel('Decision *')).toBeVisible();
    await expect(reviewDialog.getByLabel('Reason *')).toBeVisible();
    await capture(page, testInfo, 'provider-admin-workforce-leave-review-dialog');
    await reviewDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  await expect.poll(() => apiFailures).toEqual([]);
  await localSignOut(page);
});

test('Provider Admin report builder only offers server-allowlisted dimensions and measures', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('operations'), 'Reports visual workflow runs in Operations projects only.');
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await requireProviderContext(page);
  const apiFailures: string[] = [];
  page.on('response', response => {
    if (response.url().includes('/api/v1/') && response.status() >= 400) apiFailures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await navigateHash(page, 'reports');
  await expect(page.getByRole('heading', { name: 'Reports & analytics', exact: true })).toBeVisible();
  await expect(page.locator('.reports-kpi-grid')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.reports-kpi-card')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await capture(page, testInfo, 'provider-admin-reports-settled-overview');
  await page.getByRole('button', { name: 'Custom report builder', exact: true }).click();
  await page.getByRole('button', { name: 'Create report', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create report definition', exact: true });
  await expect(dialog.getByLabel('Report name *')).toBeVisible();
  await expect(dialog.getByRole('group', { name: 'Dimensions' }).getByLabel('Status')).toBeChecked();
  await expect(dialog.getByRole('group', { name: 'Dimensions' }).getByLabel('Project')).toBeChecked();
  await expect(dialog.getByRole('group', { name: 'Measures' }).getByLabel('Record count')).toBeChecked();
  await dialog.getByRole('group', { name: 'Dimensions' }).getByLabel('Stage').check();
  await dialog.getByRole('group', { name: 'Measures' }).getByLabel('Amount').check();
  await capture(page, testInfo, 'provider-admin-report-allowlisted-builder');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Scheduled reports', exact: true }).click();
  const newSchedule = page.getByRole('button', { name: 'New schedule', exact: true });
  if (await newSchedule.isEnabled()) {
    await newSchedule.click();
    const scheduleDialog = page.getByRole('dialog', { name: /Schedule ·/ });
    await expect(scheduleDialog.getByLabel('Saved report *')).toBeVisible();
    await expect(scheduleDialog.getByLabel('Frequency')).toBeVisible();
    await expect(scheduleDialog.getByLabel('Authorized recipients *')).toBeVisible();
    await capture(page, testInfo, 'provider-admin-report-schedule-dialog');
    await scheduleDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  expect(apiFailures).toEqual([]);
  await localSignOut(page);
});

test('Provider Admin business profile exposes the governed editable fields without changing review state', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('operations'), 'Provider profile workflow runs in Operations projects only.');
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await requireProviderContext(page);
  const apiFailures: string[] = [];
  page.on('response', response => {
    if (response.url().includes('/api/v1/') && response.status() >= 400) apiFailures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await navigateHash(page, 'business-profile');
  await expect(page.getByRole('heading', { name: 'Business profile', exact: true })).toBeVisible();
  await expect(page.getByLabel(/Legal name/)).toBeVisible();
  await expect(page.getByLabel(/GSTIN/)).toBeVisible();
  await expect(page.getByLabel('PIN code')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Verification status', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save business profile', exact: true })).toBeVisible();
  await capture(page, testInfo, 'provider-admin-business-profile');
  const logoStorageUnavailable = apiFailures.filter(failure => failure === '503 /api/v1/providers/logo');
  expect(apiFailures.filter(failure => failure !== '503 /api/v1/providers/logo')).toEqual([]);
  if (logoStorageUnavailable.length) testInfo.annotations.push({ type: 'environment-blocker', description: 'Private provider-logo storage returned HTTP 503; business profile API and form rendered, but logo retrieval remains blocked by local object-storage availability.' });
  await localSignOut(page);
});

test('Provider Admin notification policy uses the authorized typed configuration contract', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('operations'), 'Provider notification policy workflow runs in Operations projects only.');
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await requireProviderContext(page);
  const apiFailures: string[] = [];
  page.on('response', response => {
    if (response.url().includes('/api/v1/') && response.status() >= 400) apiFailures.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  await navigateHash(page, 'configuration/notification-policies');
  await expect(page.getByRole('combobox', { name: 'Configuration type', exact: true })).toHaveValue('notification-policies');
  await expect(page.getByLabel('Event type')).toBeVisible();
  await expect(page.getByLabel('Category')).toBeVisible();
  await expect(page.getByLabel('Mandatory')).toBeVisible();
  await expect(page.getByLabel('Channels (one per line)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create draft', exact: true })).toBeVisible();
  await capture(page, testInfo, 'provider-admin-notification-policy');
  expect(apiFailures).toEqual([]);
  await localSignOut(page);
});

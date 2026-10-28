import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';

const providerId = '01a10a91-fc7f-70bb-b4a1-ddeefdded2f7';

test.use({ trace: 'on-first-retry', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('Provider Administrator can open every capability-backed provider deep link', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.setItem('trise-theme', 'dark'));
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const accountMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await accountMenu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();

  await page.goto(`${page.url().split('#')[0]}#configuration`);
  await expect(page.getByRole('heading', { name: 'Provider configuration', exact: true })).toBeVisible();
  const mobileMenu = page.getByRole('button', { name: 'Menu', exact: true });
  if (await mobileMenu.count()) await mobileMenu.click();
  const providerNavigation = page.locator('#provider-navigation');
  await expect(providerNavigation.getByRole('button', { name: 'Provider Configuration', exact: true })).toHaveCount(1);
  await expect(providerNavigation.getByRole('button', { name: 'Services & assets', exact: true })).toHaveCount(0);
  await expect(page.getByText('Platform default · available').first()).toBeVisible();
  await test.info().attach('provider-configuration-hub', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.goto(`${page.url().split('#')[0]}#configuration/skills`);
  await expect(page.locator('.configuration-scope-chip.is-platform').first()).toBeVisible();
  await test.info().attach('provider-configuration-defaults', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

  const routes = [
    'overview', 'work-intake', 'leads', 'requests', 'quotations', 'billing',
    'projects', 'bookings', 'jobs', 'customers', 'sites', 'assets', 'onboarding',
    'amc', 'amc/plans', 'workforce', 'attendance', 'my-leave', 'configuration/support-coverage',
    'configuration/extra-day-credits', 'compliance', 'audit',
    'reports', 'configuration', 'configuration/quotation-terms-templates',
    'business-profile', 'subscriptions', 'team-access', 'notifications'
  ];
  for (const route of routes) {
    await page.goto(`${page.url().split('#')[0]}#${route}`);
    await expect(page.getByText(/is not available in this session\./, { exact: false })).toHaveCount(0);
    if (route === 'configuration/quotation-terms-templates') {
      const navigation = page.locator('#provider-navigation');
      await expect(page.getByRole('heading', { name: 'Quotation terms templates', exact: true })).toBeVisible();
      await expect(navigation.locator('[data-nav-key="quotation-terms-templates"]')).toHaveClass(/active/);
      await expect(navigation.locator('[data-nav-key="configuration"]')).not.toHaveClass(/active/);
      const scopeFilter = page.getByLabel('Filter quotation terms templates by scope');
      await expect(scopeFilter).toBeVisible({ timeout: 30_000 });
      await scopeFilter.selectOption('PROVIDER');
      const providerTemplateRows = page.locator('.provider-terms-table tbody tr');
      if (await providerTemplateRows.count()) {
        const providerTemplate = providerTemplateRows.first();
        await providerTemplate.getByRole('button', { name: /Actions for/ }).click();
        await page.getByRole('menuitem', { name: 'Edit terms template', exact: true }).click();
        const editDialog = page.getByRole('dialog', { name: 'Edit quotation terms template', exact: true });
        await expect(editDialog).toBeVisible();
        await editDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await providerTemplate.getByRole('button', { name: 'View terms template', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Edit terms', exact: true })).toBeVisible();
      }
    }
  }
  await localSignOut(page);
});

test('Customer, Sites and Assets workspaces keep the journey clear', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const accountMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await accountMenu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();

  const checks = [
    ['customers', 'Customers', 'Add customer'],
    ['sites', 'Sites & locations', 'Add site'],
    ['assets', 'Assets', 'Register asset'],
  ] as const;
  for (const [route, heading, action] of checks) {
    await page.goto(`${page.url().split('#')[0]}#${route}`);
    await expect(page.locator('.feature-page > .page-header').getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: action, exact: true })).toBeVisible();
    await expect(page.getByText(/is not available in this session\./, { exact: false })).toHaveCount(0);
  }
  await localSignOut(page);
});

test('Provider Reviewer cannot open customer master data without a projected capability', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  await localSignIn(page, configuredAccount('PROVIDER_REVIEWER'));
  await expect(page.getByRole('button', { name: 'Customers', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sites & Locations', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Assets', exact: true })).toHaveCount(0);
  await localSignOut(page);
});

test('My Work defers execution detail requests until a visit workspace is opened', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  await localSignIn(page, configuredAccount('AGENT'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const accountMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await accountMenu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();

  const executionRequests: string[] = [];
  const jobDetailRequests: string[] = [];
  const assignmentRequests: URL[] = [];
  const nearbyRequests: URL[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === '/api/v1/assignments') assignmentRequests.push(url);
    if (path === '/api/v1/assignments/nearby') nearbyRequests.push(url);
    if (/\/api\/v1\/service-jobs\/[^/]+$/.test(path)) jobDetailRequests.push(path);
    if (/(work-sessions|checklists|reports|proofs|checklist-templates)/.test(path)) executionRequests.push(path);
  });
  await page.goto(`${page.url().split('#')[0]}#jobs/my-work`);
  await expect(page.getByRole('heading', { name: 'My work', exact: true })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1_500);
  const capturedAssignmentRequest = assignmentRequests[0];
  if (!capturedAssignmentRequest) throw new Error('The My Work assignment request was not observed.');
  expect(capturedAssignmentRequest.searchParams.get('page[limit]')).toBe('15');
  expect(capturedAssignmentRequest.searchParams.getAll('filter[status][]')).toEqual(['PROPOSED', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'WORKING']);
  expect(jobDetailRequests).toEqual([]);
  expect(executionRequests).toEqual([]);
  await expect(page.getByRole('button', { name: 'Open job', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Open job', exact: true }).first().click();
  await expect(page.getByRole('dialog', { name: /Job actions/ })).toBeVisible();
  expect(jobDetailRequests.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: /Close Job actions/ }).click();
  await page.context().grantPermissions(['geolocation'], { origin: new URL(page.url()).origin });
  await page.context().setGeolocation({ latitude: 12.9716, longitude: 77.5946, accuracy: 20 });
  await page.getByRole('combobox', { name: 'Filter my work by location', exact: true }).selectOption('nearby');
  await expect.poll(() => nearbyRequests.length).toBe(1);
  expect(nearbyRequests[0].searchParams.get('page[limit]')).toBe('15');
  expect(nearbyRequests[0].searchParams.get('radius_m')).toBe('10000');
  expect(nearbyRequests[0].searchParams.get('accuracy_m')).toBe('20');
  expect(nearbyRequests[0].searchParams.get('latitude')).toBe('12.9716');
  expect(nearbyRequests[0].searchParams.get('longitude')).toBe('77.5946');
  await page.getByRole('combobox', { name: 'Nearby work radius', exact: true }).selectOption('5000');
  await expect.poll(() => nearbyRequests.length).toBe(2);
  expect(nearbyRequests.at(-1)?.searchParams.get('radius_m')).toBe('5000');
  await page.getByRole('combobox', { name: 'Filter my work by location', exact: true }).selectOption('all');
  await page.getByRole('combobox', { name: 'Filter my work by status', exact: true }).selectOption('PROPOSED');
  await expect.poll(() => assignmentRequests.at(-1)?.searchParams.getAll('filter[status][]')).toEqual(['PROPOSED']);
  expect(assignmentRequests.at(-1)?.searchParams.get('page[limit]')).toBe('15');
  await localSignOut(page);
});

test('Jobs and My Work are separated by role capability', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const accountMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await accountMenu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();

  const jobsNav = page.getByRole('button', { name: 'Jobs & Execution', exact: true });
  const myWorkNav = page.getByRole('button', { name: 'My Work', exact: true });
  await page.goto(`${page.url().split('#')[0]}#jobs`);
  const mobileMenu = page.getByRole('button', { name: 'Menu', exact: true });
  if (await mobileMenu.count()) await mobileMenu.click();
  await expect(jobsNav).toHaveClass(/active/);
  await expect(myWorkNav).toHaveCount(0);
  await localSignOut(page);
});

test('Technician is routed to My Work and not the provider-wide Jobs register', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  await localSignIn(page, configuredAccount('AGENT'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const accountMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await accountMenu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(providerId);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.goto(`${page.url().split('#')[0]}#jobs`);
  await expect(page).toHaveURL(/#jobs\/my-work$/);
  await expect(page.getByRole('heading', { name: 'My work', exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('tab', { name: 'My Work', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Jobs', exact: true })).toHaveAttribute('aria-selected', 'false');
  await localSignOut(page);
});

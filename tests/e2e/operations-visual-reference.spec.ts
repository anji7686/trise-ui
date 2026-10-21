import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';

test.use({ trace: 'retain-on-failure', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('authorized Operations routes match the approved structural UI contract', async ({ page, evidence }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const accountMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await accountMenu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption('01a10a91-fc7f-70bb-b4a1-ddeefdded2f7');
  // Provider switching is in-page; explicitly close the still-open workspace menu.
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await expect(accountMenu).toBeHidden();

  const routes = [
    { name: 'overview', hash: '#overview', heading: 'Operations dashboard' },
    { name: 'requests', hash: '#requests', heading: 'Service Requests' },
    { name: 'bookings', hash: '#bookings', heading: 'Appointments & dispatch' },
    { name: 'leads', hash: '#leads', heading: 'Leads & site surveys' },
    { name: 'quotations', hash: '#quotations', heading: 'Quotations & Orders' },
    { name: 'projects', hash: '#projects', heading: 'Installation Projects' },
    { name: 'jobs', hash: '#jobs', heading: 'Jobs & assignments' }
  ];

  for (const route of routes) {
    await page.goto(route.hash);
    await expect(page.getByRole('heading', { name: route.heading, exact: true })).toBeVisible();
    await expect(page.getByText(/^Loading/)).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText('[object Object]', { exact: true })).toHaveCount(0);
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(horizontalOverflow, `${route.name} has horizontal overflow`).toBeFalsy();
    await page.screenshot({ path: `/tmp/trise-operations-visual-${route.name}.png`, fullPage: true });
    if (route.name === 'requests') {
      const register = page.getByRole('region', { name: 'Service request register' });
      const firstRequestRow = register.locator('tbody tr').first();
      const requestId = await firstRequestRow.locator('[data-label="Request ID"] span').getAttribute('title');
      expect(requestId).toBeTruthy();
      await firstRequestRow.getByRole('button', { name: 'View', exact: true }).click();
      const detailPanel = page.getByRole('dialog').filter({ hasText: 'Selected request' });
      await expect(detailPanel.getByRole('heading').first()).toBeVisible();
      await detailPanel.getByRole('button', { name: 'Open full details', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`#requests/${requestId}$`));
      await expect(page.getByRole('heading', { name: 'Request detail', exact: true })).toBeVisible();
      await expect(page.getByRole('alert')).toHaveCount(0);
      await page.screenshot({ path: '/tmp/trise-operations-visual-requests-detail.png', fullPage: true });
      await page.goto('#requests');
      await expect(page.getByText(/^Loading/)).toHaveCount(0, { timeout: 20_000 });
    }
    if (route.name === 'bookings') {
      const appointmentView = page.getByRole('group', { name: 'Appointment view', exact: true });
      await expect(appointmentView.getByRole('button', { name: 'List', exact: true })).toBeVisible();
      await expect(appointmentView.getByRole('button', { name: 'Calendar', exact: true })).toBeVisible();
      await appointmentView.getByRole('button', { name: 'List', exact: true }).click();
      if (await page.getByRole('button', { name: 'View booking', exact: true }).count()) {
        await page.getByRole('button', { name: 'View booking', exact: true }).first().click();
        await expect(page).toHaveURL(/#bookings\/.+/);
        await expect(page.getByRole('button', { name: 'Bookings', exact: true })).toBeVisible();
        await page.screenshot({ path: '/tmp/trise-operations-visual-bookings-detail.png', fullPage: true });
        await page.goto('#bookings');
        await expect(page.getByText(/^Loading/)).toHaveCount(0, { timeout: 20_000 });
      } else {
        await expect(page.getByRole('heading', { name: 'No appointments this week', exact: true })).toBeVisible();
      }
      await appointmentView.getByRole('button', { name: 'Calendar', exact: true }).click();
      await page.screenshot({ path: '/tmp/trise-operations-visual-bookings-calendar.png', fullPage: true });
    }
  }

  await localSignOut(page);
  await localSignIn(page, configuredAccount('AGENT'));
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const technicianMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await technicianMenu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption('01a10a91-fc7f-70bb-b4a1-ddeefdded2f7');
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await expect(technicianMenu).toBeHidden();
  const navigation = page.getByRole('complementary', { name: 'Operations navigation' });
  if (!(await navigation.isVisible())) await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.goto('#jobs/my-work');
  await expect(page.getByRole('heading', { name: 'My work', exact: true })).toBeVisible();
  await expect(page.getByText(/Showing \d+ of \d+ authorized assignments|No assignments are visible for this context\./)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), 'my-work has horizontal overflow').toBeFalsy();
  await page.screenshot({ path: '/tmp/trise-operations-visual-my-work-denied.png', fullPage: true });

  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter((response) => response.status >= 500)).toEqual([]);
  await localSignOut(page);
});


import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut, type E2EPersona } from './local-auth';
import { navigationForSession } from '../../apps/operations/src/navigation';

type ProviderCapability = {
  provider_id: string;
  display_name: string;
  role_context?: string;
  operations_access?: boolean;
  capabilities: string[];
};

type LiveSession = {
  user: {
    attributes: {
      platform_admin?: boolean;
      platform_capabilities?: string[];
      provider_capabilities?: ProviderCapability[];
    };
  };
};

const personas: E2EPersona[] = [
  'GLOBAL_ADMIN', 'PLATFORM_REVIEWER', 'PROVIDER_ADMIN', 'PROVIDER_REVIEWER',
  'OPERATOR', 'CUSTOMER', 'AGENT', 'MARKETING_EXECUTIVE', 'MARKETING_MANAGER',
  'ASSET_ADMINISTRATOR'
];

test.use({ trace: 'retain-on-failure', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

async function expandProviderGroups(page: import('playwright/test').Page) {
  const navigation = page.getByRole('complementary', { name: 'Operations navigation' });
  if (!await navigation.isVisible()) {
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await expect(navigation).toBeVisible();
  }
  const toggles = navigation.locator('button.nav-group-toggle');
  for (let index = 0; index < await toggles.count(); index += 1) {
    const toggle = toggles.nth(index);
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  }
  return navigation;
}

async function chooseProvider(page: import('playwright/test').Page, session: LiveSession) {
  const providers = session.user.attributes.provider_capabilities || [];
  const provider = providers.find((entry) => entry.display_name.includes('Lift Rise Elevators') && entry.operations_access !== false)
    || providers.find((entry) => entry.operations_access !== false);
  expect(provider, 'Every provider operations role must have an active provider context for live navigation verification.').toBeTruthy();
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const accountMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  const providerSelect = accountMenu.getByRole('combobox', { name: 'Provider', exact: true });
  await providerSelect.selectOption(provider!.provider_id);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  if (!await page.getByRole('complementary', { name: 'Operations navigation' }).isVisible()) {
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
  }
  await expect(page.getByRole('complementary', { name: 'Operations navigation' })).toBeVisible();
  return provider!;
}

async function renderedMenuKeys(navigation: import('playwright/test').Locator) {
  return navigation.locator('[data-nav-key]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-nav-key')).filter((value): value is string => Boolean(value)));
}

async function verifyNotificationInbox(page: import('playwright/test').Page, path: string) {
  const before = page.url();
  const bell = page.getByRole('button', { name: /View .*notifications/i }).first();
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page.getByRole('dialog', { name: /notifications/i })).toBeVisible();
  await page.waitForTimeout(500);
  const notificationResponses = await page.evaluate((expectedPath) => (window as Window & { __triseNotificationResponses?: Array<{ path: string; status: number }> }).__triseNotificationResponses?.filter((response) => response.path === expectedPath) || [], path);
  expect(notificationResponses.length, `Expected a successful ${path} notification poll.`).toBeGreaterThan(0);
  expect(notificationResponses.at(-1)?.status).toBe(200);
  expect(page.url()).toBe(before);
}

test('live role matrix exposes only authorized menus and notification inboxes', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(600_000);
  await page.addInitScript(() => localStorage.setItem('trise-theme', 'dark'));

  await page.addInitScript(() => {
    const responses: Array<{ path: string; status: number }> = [];
    (window as Window & { __triseNotificationResponses?: Array<{ path: string; status: number }> }).__triseNotificationResponses = responses;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...arguments_) => {
      const response = await originalFetch(...arguments_);
      const path = new URL(response.url).pathname;
      if (path === '/api/v1/notifications' || path === '/api/v1/platform/notifications') responses.push({ path, status: response.status });
      return response;
    };
  });

  for (const persona of personas) {
    const session = await localSignIn(page, configuredAccount(persona)) as LiveSession;
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const platformAdmin = session.user.attributes.platform_admin === true;

    if (platformAdmin) {
      const navigation = page.getByRole('complementary', { name: 'Platform administration navigation' });
      if (!await navigation.isVisible()) {
        await page.getByRole('button', { name: 'Menu', exact: true }).click();
        await expect(navigation).toBeVisible();
      }
      await expect(navigation).toBeVisible();
      const actualKeys = await renderedMenuKeys(navigation);
      const expectedKeys = navigationForSession({ platformAdmin: true, platformCapabilities: session.user.attributes.platform_capabilities || [], providerCapabilities: [] }).platform.map((item) => item.key);
      expect(new Set(actualKeys).size, `${persona} must not render duplicate platform destinations`).toBe(actualKeys.length);
      expect(actualKeys.sort(), `${persona} platform menu must match the returned platform capabilities`).toEqual(expectedKeys.sort());
      await expect(navigation.locator('[data-nav-key="platform-overview"]')).toHaveClass(/active/);
      await verifyNotificationInbox(page, '/api/v1/platform/notifications');
    } else if (persona === 'CUSTOMER') {
      await expect(page.getByRole('complementary', { name: 'Operations navigation' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /View .*notifications/i })).toHaveCount(0);
    } else {
      const provider = await chooseProvider(page, session);
      const navigation = await expandProviderGroups(page);
      const actualKeys = await renderedMenuKeys(navigation);
      const providerContexts = (session.user.attributes.provider_capabilities || []).map((entry) => ({ providerId: entry.provider_id, displayName: entry.display_name, roleContext: entry.role_context, operationsAccess: entry.operations_access, capabilities: entry.capabilities }));
      const expectedKeys = navigationForSession({ platformAdmin: false, providerCapabilities: providerContexts }, provider.provider_id).provider.map((item) => item.key);
      // The UI adds one stable parent destination for the Administration group
      // so users can enter the group even when only child capabilities exist.
      if (expectedKeys.some((key) => ['configuration', 'quotation-terms-templates', 'business-profile', 'subscriptions', 'team-access', 'notifications'].includes(key))) expectedKeys.push('administration');
      expect(new Set(actualKeys).size, `${persona} must not render duplicate provider destinations`).toBe(actualKeys.length);
      expect(actualKeys.sort(), `${persona} provider menu must match the selected server capability context`).toEqual(expectedKeys.sort());
      await expect(navigation.locator('[data-nav-key="overview"]')).toHaveClass(/active/);
      if (provider.capabilities.includes('notifications')) {
        await verifyNotificationInbox(page, '/api/v1/notifications');
      } else {
        await expect(page.getByRole('button', { name: /View .*notifications/i })).toHaveCount(0);
      }
    }

    await localSignOut(page);
  }
});

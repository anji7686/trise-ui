import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'retain-on-failure', video: 'off' });

test.describe('Agent credential compliance', () => {

  test('provider user can open the real Agent credential compliance workspace', async ({ page, evidence }) => {
    const session = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
    const provider = session.user.attributes.provider_capabilities.find((entry: { provider_id: string; capabilities: string[] }) => entry.capabilities.includes('workforce'));
    expect(provider).toBeTruthy();

    await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
    const providerSelect = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true }).getByRole('combobox', { name: 'Provider', exact: true });
    await expect(providerSelect.locator(`option[value="${provider!.provider_id}"]`)).toHaveCount(1);
    if (await providerSelect.inputValue() !== provider!.provider_id) await providerSelect.selectOption(provider!.provider_id);
    await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
    const navigation = page.getByRole('complementary', { name: 'Operations navigation' });
    const workforceNavigation = navigation.getByRole('button', { name: 'Workforce', exact: true });
    if (!await workforceNavigation.isVisible().catch(() => false)) await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await workforceNavigation.click();
    await expect(page.getByRole('heading', { name: 'Workforce management', exact: true })).toBeVisible();
    const agent = page.locator('.workforce-agent-row').first();
    await expect(agent).toBeVisible();
    const agentName = (await agent.locator('strong').innerText()).trim();
    await agent.click();
    await page.getByRole('button', { name: 'Skills & Certifications', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Skills & Certifications', exact: true })).toBeVisible();
    await expect(page.getByText(`Selected member: ${agentName}`, { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Certifications', exact: true })).toBeVisible();
    expect(evidence.exceptions).toEqual([]);
    expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
  });
});

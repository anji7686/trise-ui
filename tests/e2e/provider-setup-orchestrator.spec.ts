import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';

test.use({ trace: 'retain-on-failure', video: 'off' });

test('Platform provider setup exposes the governed setup lifecycle and readiness gate', async ({ page, evidence }, testInfo) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/configuration/provider-overrides');

  await expect(page.getByRole('heading', { name: 'Provider overrides', exact: true })).toBeVisible();
  const orchestrator = page.getByRole('region', { name: 'Provider setup orchestrator', exact: true });
  await expect(orchestrator).toBeVisible();
  await expect(orchestrator.getByText('Provider Setup Orchestrator', { exact: true })).toBeVisible();
  await expect(orchestrator.locator('label').filter({ hasText: 'Setup profile' }).locator('select')).toBeVisible();
  await expect(orchestrator.getByRole('region', { name: 'Provider setup checklist', exact: true })).toBeVisible();
  await expect(orchestrator.getByText(/\d+ of \d+ ready/)).toBeVisible();
  await expect(orchestrator.getByRole('button', { name: 'Run dry run', exact: true })).toBeEnabled();
  await expect(orchestrator.getByRole('button', { name: 'Complete with system defaults', exact: true })).toBeVisible();
  await expect(orchestrator.getByText(/Readiness in progress|Ready for activation/)).toBeVisible();
  const actionRequired = orchestrator.getByRole('button', { name: 'Show action required details' });
  if (await actionRequired.count()) {
    await actionRequired.click();
    const blockerPanel = page.getByRole('dialog', { name: 'Action required details' });
    await expect(blockerPanel).toBeVisible();
    await expect(blockerPanel.getByRole('button', { name: 'Open setup', exact: true }).first()).toBeVisible();
    await blockerPanel.getByRole('button', { name: 'Open setup', exact: true }).first().click();
    const setupUrl = page.url();
    if (setupUrl.includes('return_to=platform%2Fconfiguration') || setupUrl.includes('return_to=platform%252Fconfiguration')) {
      await expect(page.getByRole('button', { name: 'Back to provider setup', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Back to provider setup', exact: true }).click();
      await expect(page).toHaveURL(/#platform\/configuration\/provider-overrides\?provider_id=/);
    } else {
      // Provider-owned blockers (for example assignment policies) stay in the
      // orchestrator and focus the missing task instead of opening a second
      // configuration screen.
      expect(setupUrl).toMatch(/#platform\/configuration\/provider-overrides\?provider_id=.*&focus=/);
      await expect(page.getByRole('region', { name: 'Provider setup orchestrator', exact: true })).toBeVisible();
    }
  }
  await testInfo.attach('provider-setup-orchestrator', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter((response) => response.status >= 500)).toEqual([]);

  await localSignOut(page);
});

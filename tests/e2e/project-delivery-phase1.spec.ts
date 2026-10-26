import { test, expect } from './fixtures';
import { configuredAccount, localSignIn, localSignOut } from './local-auth';
import { e2eApiV1Base } from './e2e-config';

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('provider admin can inspect the Phase 1 project delivery journey and role-gated readiness actions', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(90_000);

  const providerAdmin = await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  const accountMenuButton = page.getByRole('button', { name: 'Open account menu', exact: true });
  await accountMenuButton.click();
  const accountMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  const providerSelect = accountMenu.getByRole('combobox', { name: 'Provider', exact: true });
  await expect.poll(() => providerSelect.locator('option').count(), { timeout: 20_000 }).toBeGreaterThan(1);
  await providerSelect.selectOption({ index: 1 });
  const providerId = await providerSelect.inputValue();
  await accountMenuButton.click();
  await expect(accountMenu).toBeHidden();

  const providerHeaders = {
    Authorization: `Bearer ${providerAdmin.accessToken}`,
    'X-TRISE-Provider-Id': providerId,
    'Content-Type': 'application/json'
  };
  const relationshipResponse = await page.request.get(`${e2eApiV1Base()}/customer-relationships?page[limit]=25`, { headers: providerHeaders });
  expect(relationshipResponse.ok()).toBeTruthy();
  const relationshipPayload = await relationshipResponse.json();
  const relationship = relationshipPayload.data[0] as { id: string; relationships?: { customer?: { id: string } } };
  expect(relationship?.id, 'Project verification requires an authorized customer relationship').toBeTruthy();
  const partyId = relationship.relationships?.customer?.id;
  expect(partyId, 'Project verification requires a customer party on the relationship').toBeTruthy();
  const projectResponse = await page.request.post(`${e2eApiV1Base()}/service-cases`, {
    headers: { ...providerHeaders, 'Idempotency-Key': `phase1-project-${Date.now()}` },
    data: {
      title: `Phase 1 project browser verification ${Date.now()}`,
      party_id: partyId,
      customer_relationship_id: relationship.id,
      project_classification_key: 'ELEVATOR_INSTALLATION'
    }
  });
  expect(projectResponse.status()).toBe(201);

  await page.goto('#projects');
  await expect(page.getByRole('heading', { name: 'Installation Projects', exact: true })).toBeVisible();
  await expect(page.getByText(/^Loading/)).toHaveCount(0, { timeout: 20_000 });
  const openProject = page.getByRole('button', { name: 'Open project', exact: true }).first();
  await expect(openProject, 'Phase 1 browser verification requires an authorized seeded project').toBeVisible();
  await openProject.click();

  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible();
  const tabs = page.getByRole('tablist', { name: 'Project work areas' });
  await expect(tabs.getByRole('tab')).toHaveCount(5);
  await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0, { timeout: 20_000 });
  await page.screenshot({ path: '/Users/anjanreddy/wrk/trise/trise-architecture/docs/design/service-providers/PNG_Designs/Phase1_Project_Delivery/12-live-overview-command-center.png', fullPage: true });

  await tabs.getByRole('tab', { name: 'Readiness & blockers' }).click();
  await expect(page.getByRole('heading', { name: 'Site readiness & blockers', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Readiness checklist guidance', exact: true })).toBeVisible();
  const addBlocker = page.getByRole('button', { name: 'Add blocker', exact: true });
  await expect(addBlocker).toBeVisible({ timeout: 15_000 });
  await addBlocker.click();
  const blockerDialog = page.getByRole('dialog', { name: 'Add project blocker', exact: true });
  await expect(blockerDialog.getByLabel('Category *')).toBeVisible();
  await expect(blockerDialog.getByLabel('Severity *')).toBeVisible();
  await expect(blockerDialog.getByLabel('Title *')).toBeVisible();
  await blockerDialog.getByRole('button', { name: 'Close Add project blocker', exact: true }).click();
  await page.screenshot({ path: '/Users/anjanreddy/wrk/trise/trise-architecture/docs/design/service-providers/PNG_Designs/Phase1_Project_Delivery/13-live-readiness-blockers.png', fullPage: true });

  await tabs.getByRole('tab', { name: 'Stages & execution' }).click();
  await expect(page.getByRole('heading', { name: 'Installation milestones', exact: true })).toBeVisible();
  await page.screenshot({ path: '/Users/anjanreddy/wrk/trise/trise-architecture/docs/design/service-providers/PNG_Designs/Phase1_Project_Delivery/14-live-execution-board.png', fullPage: true });
  await tabs.getByRole('tab', { name: 'QA & handover' }).click();
  await expect(page.getByRole('heading', { name: 'Commissioning defects and reinspection', exact: true })).toBeVisible();
  await page.screenshot({ path: '/Users/anjanreddy/wrk/trise/trise-architecture/docs/design/service-providers/PNG_Designs/Phase1_Project_Delivery/15-live-qa-handover.png', fullPage: true });
  await tabs.getByRole('tab', { name: 'Commercial' }).click();
  await expect(page.getByRole('heading', { name: 'Payment history', exact: true })).toBeVisible();
  await expect(page.getByText('Loading payment stages…', { exact: true })).toHaveCount(0, { timeout: 20_000 });
  await page.screenshot({ path: '/Users/anjanreddy/wrk/trise/trise-architecture/docs/design/service-providers/PNG_Designs/Phase1_Project_Delivery/16-live-commercial-payment.png', fullPage: true });
  await expect(page.getByRole('alert')).toHaveCount(0);

  await localSignOut(page);
});

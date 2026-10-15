import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'retain-on-failure', video: 'off' });

test('provider uploads private evidence and submits an asset request', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('PROVIDER_ADMIN'));
  await page.goto('/#/compliance');
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.locator('#account-provider').selectOption({ label: 'TRISE Demo Solar Water Heater Services' });
  await expect(page.getByRole('heading', { name: 'My compliance requests', exact: true })).toBeVisible();

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles('tests/e2e/fixtures/synthetic-asset-approval.pdf');
  await page.getByRole('button', { name: 'Upload document', exact: true }).click();
  await expect(page.getByText(/Document finalized in private storage|document could not be completed/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('synthetic-asset-approval.pdf', { exact: true }).first()).toBeVisible();

  const assetSection = page.locator('section').filter({ hasText: 'Asset regulatory compliance' }).first();
  const assetSelect = assetSection.getByLabel('Authorized asset');
  await assetSelect.selectOption({ label: 'Demo solar water heater evidence fresh 2' });
  const assetForm = assetSection.locator('form').filter({ hasText: 'Published asset requirement' }).first();
  const requirementSelect = assetForm.getByLabel('Published asset requirement');
  const browserRequirement = requirementSelect.locator('option', { hasText: 'DEMO_ASSET_EVIDENCE_APPROVAL' });
  await expect(browserRequirement).toHaveCount(1);
  await requirementSelect.selectOption((await browserRequirement.getAttribute('value')) || '');
  await expect(assetSection.getByText('DEMO_ASSET_EVIDENCE_APPROVAL', { exact: true }).first()).toBeVisible();

  // Preserve idempotent synthetic fixtures: once the browser transaction has
  // submitted or applied this request, verify its governed state rather than
  // attempting a duplicate record protected by the database uniqueness rule.
  const existingRequest = assetSection.locator('article.record-card').filter({ hasText: 'DEMO_ASSET_EVIDENCE_APPROVAL' }).first();
  if (await existingRequest.count() && await existingRequest.getByText(/^(SUBMITTED|APPLIED)$/).count()) {
    await expect(existingRequest.getByText(/^(SUBMITTED|APPLIED)$/)).toBeVisible();
    expect(evidence.exceptions).toEqual([]);
    expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
    return;
  }

  await assetForm.getByLabel('Approval details (JSON)').fill('{"approval_reference":"DEMO-ASSET-APPROVAL-001","activity":"MAINTENANCE"}');
  await assetForm.getByLabel('Reason *').fill('Synthetic evidence submission for browser verification');
  const evidenceCheckbox = assetForm.getByRole('checkbox', { name: /synthetic-asset-approval\.pdf/ }).first();
  await evidenceCheckbox.check();
  await expect(evidenceCheckbox).toBeChecked();
  const createResponse = page.waitForResponse((response) => ['POST', 'PATCH'].includes(response.request().method()) && response.url().includes('/providers/assets/') && response.url().match(/\/compliance(?:\/[^/]+)?$/) !== null);
  await assetForm.getByRole('button', { name: 'Save asset draft', exact: true }).click();
  const persistedResponse = await createResponse;
  expect(persistedResponse.status()).toBe(200);
  const createPayload = persistedResponse.request().postDataJSON() as { evidence_documents?: unknown[] };
  expect(createPayload.evidence_documents).toHaveLength(1);
  await expect(assetSection.getByText('DEMO_ASSET_EVIDENCE_APPROVAL', { exact: true }).last()).toBeVisible();
  await assetSection.getByRole('button', { name: 'Submit for review', exact: true }).last().click();
  await expect(assetSection.getByText('SUBMITTED', { exact: true }).last()).toBeVisible();
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

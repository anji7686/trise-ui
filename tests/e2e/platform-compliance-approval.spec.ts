import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'retain-on-failure', video: 'off' });

test('Platform compliance queue excludes Provider-owned synthetic asset evidence', async ({ page, evidence }) => {
  await localSignIn(page, configuredAccount('GLOBAL_ADMIN'));
  await page.goto('/#platform/compliance');
  await expect(page.getByRole('heading', { name: 'Approval Inbox', exact: true })).toBeVisible();

  const search = page.getByPlaceholder('Business name, request or reference…');
  await search.fill('DEMO_ASSET_EVIDENCE_APPROVAL');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'DEMO_ASSET_EVIDENCE_APPROVAL' }).first();
  await expect(row).toHaveCount(0);
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(response => response.status >= 500)).toEqual([]);
});

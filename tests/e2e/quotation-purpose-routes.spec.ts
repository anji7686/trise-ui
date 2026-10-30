import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test('all supported quotation purposes route to their own form without cross-purpose payment fields', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('operations'), 'Operations application only');
  test.setTimeout(90_000);
  const session = await localSignIn(page, configuredAccount('MARKETING_MANAGER'));
  const provider = session.user.attributes.provider_capabilities.find((entry: { display_name: string; capabilities: string[] }) =>
    entry.display_name === 'Lift Rise Elevators — Demo Operations' && entry.capabilities.includes('quotations'));
  expect(provider).toBeTruthy();

  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const accountMenu = page.getByRole('dialog', { name: 'Account and workspace menu', exact: true });
  await accountMenu.getByRole('combobox', { name: 'Provider', exact: true }).selectOption(provider!.provider_id);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();

  const purposes = [
    { code: 'INSTALLATION', card: 'New installation', heading: 'New installation quotation', stagePayments: true },
    { code: 'MODIFICATION', card: 'Modification', heading: 'Modification quotation', stagePayments: true },
    { code: 'TAKEOVER', card: 'Takeover', heading: 'Takeover quotation', stagePayments: true },
    { code: 'SERVICE', card: 'Service quotation', heading: 'Service quotation', stagePayments: false },
    { code: 'MAINTENANCE_CONTRACT', card: 'New AMC quotation', heading: 'New AMC quotation', stagePayments: false },
    { code: 'CONTRACT_RENEWAL', card: 'Renew existing AMC', heading: 'Create paid AMC renewal quotation', stagePayments: false },
    { code: 'REPAIR', card: 'Repair quotation', heading: 'Repair quotation', stagePayments: false },
    { code: 'PARTS', card: 'Parts supply', heading: 'Parts supply quotation', stagePayments: false },
    { code: 'PROCUREMENT', card: 'Procurement', heading: 'Procurement quotation', stagePayments: false },
    { code: 'NEW_ASSET', card: 'New asset', heading: 'New asset quotation', stagePayments: false },
    { code: 'OTHER_CONTROLLED', card: 'Other controlled work', heading: 'Other controlled work quotation', stagePayments: false },
  ];

  await page.goto('/#quotations/new');
  await expect(page.getByRole('heading', { name: 'Choose quotation type', exact: true })).toBeVisible();
  for (const purpose of purposes) {
    await page.getByRole('button', { name: new RegExp(purpose.card) }).click();
    await expect(page).toHaveURL(new RegExp(`#quotations/new/${purpose.code}$`));
    await expect(page.getByRole('heading', { name: purpose.heading, exact: true })).toBeVisible();
    const stagePaymentHeading = page.getByText('Payment stages', { exact: true });
    if (purpose.stagePayments) await expect(stagePaymentHeading).toBeVisible();
    else await expect(stagePaymentHeading).toHaveCount(0);
    if (['REPAIR', 'PARTS', 'SERVICE'].includes(purpose.code)) {
      await expect(page.getByRole('group', { name: 'Customer’s associated lifts' })).toBeVisible();
    }
    const backToTypes = page.getByRole('button', { name: '← Back to quotation types', exact: true });
    if (await backToTypes.isVisible().catch(() => false)) await backToTypes.click();
    else await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'Choose quotation type', exact: true })).toBeVisible();
  }
});

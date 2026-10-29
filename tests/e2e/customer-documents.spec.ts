import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('customer documents list, search and upload guard are usable across viewports', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(60_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  await page.goto('/#/documents');

  await expect(page.getByRole('heading', { name: 'All the details, kept together.', exact: true })).toBeVisible();
  await expect(page.getByText('Your permitted reports, agreements and service evidence.', { exact: true })).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Search documents' });
  await expect(search).toBeVisible();
  const uploadButton = page.getByRole('button', { name: 'Upload document', exact: true });
  await expect(uploadButton).toBeVisible();
  await expect(uploadButton).toHaveClass(/button-secondary/);
  const rows = page.locator('.customer-document-row');
  await expect(rows.first()).toBeVisible();
  await expect(rows.first().locator('.customer-document-open')).toHaveText(/→\s+Preview/);
  const initialRows = await rows.count();
  expect(initialRows).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath('customer-documents-list.png'), fullPage: true });

  const firstDocumentTitle = (await rows.first().locator('.customer-document-copy strong').innerText()).trim();
  await rows.first().click();
  await expect(page).toHaveURL(/#\/documents\/[^/]+$/);
  await expect(page.locator('.customer-document-detail h2')).toHaveText(firstDocumentTitle);
  await expect(page.getByRole('heading', { name: 'Document details', exact: true })).toBeVisible();
  await expect(page.locator('.customer-document-metadata')).toContainText(/Service case handover report/i);
  await page.screenshot({ path: info.outputPath('customer-document-authorized-preview.png'), fullPage: true });
  await page.getByRole('button', { name: /Back/ }).click();
  await expect(page).toHaveURL(/#\/documents$/);
  await expect(rows).toHaveCount(initialRows);

  await search.fill('no-document-should-match-this');
  await expect(page.getByRole('heading', { name: 'No documents match your search.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(rows).toHaveCount(initialRows);

  await page.getByRole('button', { name: 'Upload document', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a document' });
  await expect(dialog).toBeVisible();
  const submit = dialog.getByRole('button', { name: 'Upload document', exact: true });
  await expect(submit).toBeDisabled();
  await expect(dialog.getByLabel('Service provider *')).toBeEnabled();
  await expect(dialog.getByLabel('Document title *')).toBeEnabled();
  await expect(dialog.getByLabel('Related record *')).toBeEnabled();
  await expect(dialog.getByLabel('File *')).toBeEnabled();
  await page.screenshot({ path: info.outputPath('customer-documents-upload-guard.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible();

  for (const theme of ['light', 'dark'] as const) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      expect(dimensions.document, `documents list overflow at ${width}px in ${theme} theme`).toBeLessThanOrEqual(dimensions.viewport);
      expect(dimensions.body, `documents list body overflow at ${width}px in ${theme} theme`).toBeLessThanOrEqual(dimensions.viewport);
    }
  }
});

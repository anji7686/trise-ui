import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('document preview lists only versions older than the active report', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(60_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));

  let selectedProviderId = '';
  let previewRequests = 0;
  let authorizationBody: Record<string, unknown> | null = null;
  let authorizationAttempts = 0;
  let transferRequests = 0;
  let releaseFirstPreview!: () => void;
  const firstPreviewGate = new Promise<void>((resolve) => { releaseFirstPreview = resolve; });
  const documentId = 'browser-document-preview-fixture';
  await page.context().route('**/private-downloads/synthetic-report-token', async (route) => {
    transferRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      headers: { 'Content-Disposition': 'attachment; filename="commissioning-report.pdf"' },
      body: '%PDF-1.7\nSynthetic report fixture\n%%EOF',
    });
  });
  await page.route(`**/api/v1/documents/${documentId}**`, async (route) => {
    const requestUrl = new URL(route.request().url());
    const requestProvider = route.request().headers()['x-trise-provider-id'] || '';
    if (!selectedProviderId) selectedProviderId = requestProvider;
    if (requestProvider !== selectedProviderId) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'not_found', message: 'Resource not found.' }) });
      return;
    }
    if (route.request().method() === 'POST' && requestUrl.pathname.endsWith('/download')) {
      authorizationAttempts += 1;
      authorizationBody = route.request().postDataJSON() as Record<string, unknown>;
      if (authorizationAttempts > 1) {
        await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'forbidden', message: 'This document version is no longer available for transfer.' }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'http://127.0.0.1:3000/api/v1/private-downloads/synthetic-report-token', expires_at: '2026-10-29T10:30:00Z', expires_in: 60 }) });
      return;
    }
    if (requestUrl.pathname.endsWith('/versions')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [
        { id: 'version-current', type: 'document-versions', attributes: { version: 2, filename: 'service-report-v2.pdf', media_type: 'application/pdf', size_bytes: 2048, checksum: 'current-checksum', scan_state: 'clean' } },
        { id: 'version-previous', type: 'document-versions', attributes: { version: 1, filename: 'service-report-v1.pdf', media_type: 'application/pdf', size_bytes: 1024, checksum: 'previous-checksum', scan_state: 'clean' } },
      ], meta: { page: { limit: 25, next: null } } }) });
      return;
    }
    if (requestUrl.pathname.endsWith('/customer-preview')) {
      previewRequests += 1;
      if (previewRequests === 1) {
        await firstPreviewGate;
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'temporarily_unavailable', message: 'The report projection is temporarily unavailable.' }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {
        id: 'service-report-preview', type: 'customer-service-report-previews', attributes: {
          provider_name: 'Synthetic provider', title: 'Commissioning service report', summary: 'Commissioning completed and checked.', work_performed: 'Door operation and safety circuits verified.', observations: 'Door sensor wear observed. A separate replacement quotation was prepared for customer review.',
          asset_name: 'Passenger Lift 01', site_name: 'Green Heights', technician_name: 'Service Technician', service_date: '2026-10-28', submitted_at: '2026-10-28T10:00:00Z', version: 2,
        }, relationships: {},
      } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: documentId, type: 'documents', attributes: {
        filename: 'development-sample-commissioning-report.pdf', media_type: 'application/pdf', size_bytes: 2048, checksum: 'current-checksum',
        classification: 'SERVICE_REPORT', status: 'available', scan_state: 'clean', revision: 2, visibility: 'customer', created_at: '2026-10-28T10:00:00Z',
      }, relationships: {
        current_version: { id: 'version-current', type: 'document-versions' },
        source: { id: 'service-report-1', type: 'service-reports' },
      },
    }) });
  });

  await page.goto(`/#/documents/${documentId}`);
  await expect(page.getByText('Loading service report…', { exact: true })).toBeVisible();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    expect(dimensions.document, `loading state overflow at ${width}px in light theme`).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.body, `loading body overflow at ${width}px in light theme`).toBeLessThanOrEqual(dimensions.viewport);
  }
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    expect(dimensions.document, `loading state overflow at ${width}px in dark theme`).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.body, `loading body overflow at ${width}px in dark theme`).toBeLessThanOrEqual(dimensions.viewport);
    if (width === 390) await page.screenshot({ path: info.outputPath('customer-document-loading-dark.png'), fullPage: true });
  }
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click();
  await page.setViewportSize({ width: info.project.name === 'customer-mobile' ? 390 : 1440, height: 900 });
  releaseFirstPreview();
  await expect(page.getByRole('alert')).toContainText('Submitted service report details could not be loaded.');
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    expect(dimensions.document, `503 state overflow at ${width}px in light theme`).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.body, `503 body overflow at ${width}px in light theme`).toBeLessThanOrEqual(dimensions.viewport);
  }
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    expect(dimensions.document, `503 state overflow at ${width}px in dark theme`).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.body, `503 body overflow at ${width}px in dark theme`).toBeLessThanOrEqual(dimensions.viewport);
    if (width === 390) await page.screenshot({ path: info.outputPath('customer-document-report-error-dark.png'), fullPage: true });
  }
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click();
  await page.setViewportSize({ width: info.project.name === 'customer-mobile' ? 390 : 1440, height: 900 });
  await expect(page.locator('.section-heading h2')).toHaveText('Service report');
  await expect(page.getByRole('button', { name: 'Download report', exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('customer-document-report-retry.png'), fullPage: true });
  await page.getByRole('button', { name: 'Retry report details', exact: true }).click();
  await expect(page.locator('.section-heading h2')).toHaveText('Service report');
  await expect(page.locator('.customer-service-report-preview h3')).toHaveText('Commissioning service report');
  await expect(page.getByText('Observations', { exact: true })).toBeVisible();
  await expect(page.getByText('Report submitted', { exact: true })).toBeVisible();
  const factRow = page.locator('.customer-service-report-preview dl > div').first();
  const rowStyle = await factRow.evaluate((element) => {
    const style = getComputedStyle(element);
    return { display: style.display, columns: style.gridTemplateColumns.split(' ').length, separator: style.borderBottomStyle };
  });
  expect(rowStyle).toEqual({ display: 'grid', columns: 2, separator: 'solid' });
  const factListColumns = await page.locator('.customer-service-report-preview dl').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  expect(factListColumns).toBe(1);
  const headingActionOffset = await page.locator('.section-heading h2').evaluate((element) => {
    const action = element.closest('.section-heading')?.querySelector('button');
    return action ? Math.abs(element.getBoundingClientRect().top - action.getBoundingClientRect().top) : Number.POSITIVE_INFINITY;
  });
  expect(headingActionOffset).toBeLessThanOrEqual(8);
  if (await page.evaluate(() => innerWidth > 700)) {
    const reportPanelGap = await page.locator('.customer-document-preview-grid').evaluate((element) => {
      const [reportPanel, detailsPanel] = Array.from(element.children) as HTMLElement[];
      return detailsPanel.getBoundingClientRect().left - reportPanel.getBoundingClientRect().right;
    });
    expect(reportPanelGap).toBeGreaterThanOrEqual(12);
    expect(reportPanelGap).toBeLessThanOrEqual(24);
  }
  expect(previewRequests).toBe(2);
  const previousVersions = page.locator('.customer-document-versions');
  await expect(previousVersions.getByText('Version 1', { exact: true })).toBeVisible();
  await expect(previousVersions.getByText('Version 2', { exact: true })).toHaveCount(0);
  await expect(page.getByText('2 · Submitted report', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('customer-document-versions.png'), fullPage: true });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download report', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('commissioning-report.pdf');
  expect(authorizationBody).toEqual({ version_id: 'version-current', disposition: 'attachment' });
  expect(transferRequests).toBe(1);
  await expect(page.getByRole('status')).toContainText('Download authorized for version 2');
  await page.getByRole('button', { name: 'Download report', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('The download was not authorized.');
  await expect(page.getByRole('alert')).toContainText('This document version is no longer available for transfer.');
  expect(authorizationAttempts).toBe(2);
  expect(transferRequests).toBe(1);
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    expect(dimensions.document, `light theme overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.body, `light theme body overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
  }
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    expect(dimensions.document, `dark theme overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.body, `dark theme body overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
    if (width === 390) await page.screenshot({ path: info.outputPath('customer-document-versions-dark.png'), fullPage: true });
  }
});

test('a denied document preview returns the customer to overview', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(60_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));

  const documentId = 'browser-document-denied-fixture';
  await page.route(`**/api/v1/documents/${documentId}**`, async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'forbidden', message: 'This record is not available in your customer account.' }),
    });
  });

  await page.goto(`/#/documents/${documentId}`);
  await expect(page.getByRole('alert')).toContainText('This record isn’t available.');
  const backToOverview = page.getByRole('button', { name: 'Back to overview', exact: true });
  await expect(backToOverview).toBeVisible();
  for (const theme of ['light', 'dark'] as const) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
    for (const width of [360, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
      expect(dimensions.document, `denied state overflow at ${width}px in ${theme} theme`).toBeLessThanOrEqual(dimensions.viewport);
      expect(dimensions.body, `denied body overflow at ${width}px in ${theme} theme`).toBeLessThanOrEqual(dimensions.viewport);
      await expect(backToOverview).toBeVisible();
      if (theme === 'dark' && width === 390) await page.screenshot({ path: info.outputPath('customer-document-denied-dark.png'), fullPage: true });
    }
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click();
  }
  await page.setViewportSize({ width: info.project.name === 'customer-mobile' ? 390 : 1440, height: 900 });
  await backToOverview.click();
  await expect(page).toHaveURL(/#\/?$/);
  await expect(page.getByRole('heading', { name: 'Your spaces. In good hands.', exact: true })).toBeVisible();
});

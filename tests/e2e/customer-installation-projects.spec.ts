import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';
import { e2eApiV1Base } from './e2e-config';

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

type CustomerProject = {
  id: string;
  attributes: {
    title: string;
    status: string;
    project_classification_key?: string;
    service_location_name?: string | null;
    progress_percent: number;
    stage_count: number;
    completed_stage_count: number;
    project_assets?: Array<{ id: string; display_name: string }>;
    unit_progress?: Array<{ asset_id: string; progress_percent: number; completed_stage_count: number; stage_count: number }>;
    handover_events?: Array<{ id: string; event_kind: string; asset_id?: string | null; evidence_documents?: Array<{ id: string; filename: string; media_type?: string; classification?: string }> }>;
  };
};

const readableName = (value: string) => value.trim().replace(/\s+\d{10,}$/, '').trim();
const displayTitle = (project: CustomerProject) => {
  const location = project.attributes.service_location_name?.trim();
  const title = project.attributes.title.trim();
  const withoutLocation = location && title.toLocaleLowerCase().startsWith(`${location.toLocaleLowerCase()} ·`)
    ? title.slice(location.length + 1).trim().replace(/^·\s*/, '')
    : title;
  return readableName(withoutLocation);
};
test('customer can review independently progressing elevator units across linked providers', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(90_000);

  const customer = await localSignIn(page, configuredAccount('CUSTOMER'));
  const headers = { Authorization: `Bearer ${customer.accessToken}` };
  const providersResponse = await page.request.get(`${e2eApiV1Base()}/providers`, { headers });
  expect(providersResponse.ok()).toBeTruthy();
  const providersPayload = await providersResponse.json();
  const providers = (providersPayload.data as Array<{ data?: { id: string }; id?: string }>).map((item) => item.data || item).filter((item): item is { id: string } => Boolean(item.id));

  let fixture: { providerId: string; project: CustomerProject } | undefined;
  for (const provider of providers) {
    const response = await page.request.get(`${e2eApiV1Base()}/service-cases?page[limit]=100&sort=-created_at,id`, {
      headers: { ...headers, 'X-TRISE-Provider-Id': provider.id },
    });
    expect(response.ok(), 'The customer-scoped project feed should be readable for each linked provider.').toBeTruthy();
    const payload = await response.json();
    const projects = (payload.data as Array<{ data?: CustomerProject } | CustomerProject>).map((item): CustomerProject => 'data' in item && item.data ? item.data : item as CustomerProject);
    const project = projects.find((item) => item.attributes.project_classification_key === 'ELEVATOR_INSTALLATION'
      && item.attributes.status.toUpperCase() !== 'DRAFT'
      && (item.attributes.project_assets?.length || 0) >= 2
      && (item.attributes.unit_progress?.length || 0) >= 2);
    if (project) {
      fixture = { providerId: provider.id, project };
      break;
    }
  }

  expect(fixture, 'Seed an authorized two-lift Elevator Services project with separate unit progress before running populated project verification.').toBeTruthy();
  const selected = fixture!;
  const project = selected.project;
  const assets = project.attributes.project_assets || [];
  const title = displayTitle(project);
  const unitProgress = project.attributes.unit_progress || [];
  const handoverEvents = project.attributes.handover_events || [];
  expect(handoverEvents.some((event) => event.event_kind.toUpperCase() === 'ACCEPTED'), 'The live two-lift example should show at least one recorded per-unit customer handover.').toBeTruthy();

  await page.goto('/#/projects');
  await expect(page).toHaveURL(/#\/projects$/);
  await expect(page.getByRole('heading', { name: 'Installation projects', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Provider', exact: true })).toHaveCount(0);
  const projectCard = page.locator('article.customer-installation-project-card').filter({ hasText: title });
  await expect(projectCard).toBeVisible();
  await expect(projectCard).toContainText(`${assets.length} ${assets.length === 1 ? 'lift' : 'lifts'}`);
  const customerStatus = await projectCard.locator('.status').first().innerText();
  expect(customerStatus).not.toBe(project.attributes.status);
  expect(customerStatus).toMatch(/in progress|handover|completed|cancelled/i);
  await expect(projectCard.getByRole('progressbar', { name: 'Installation progress' })).toHaveAttribute('aria-valuenow', String(project.attributes.progress_percent));
  await expect(projectCard).toContainText(`${project.attributes.progress_percent}% complete`);
  await page.screenshot({ path: info.outputPath('customer-elevator-project-list.png') });
  await projectCard.getByRole('button', { name: 'View project', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#\\/projects\\/${project.id}$`));
  await expect(page.getByRole('heading', { name: 'A new chapter for your space.', exact: true })).toBeVisible();
  await expect(page.locator('.customer-project-heading')).toContainText(title);
  await expect(page.locator('.customer-project-heading')).not.toContainText(/\d{10,}/);
  await expect(page.getByRole('heading', { name: 'Your installed units', exact: true })).toBeVisible();
  await expect(page.locator('.customer-project-unit')).toHaveCount(assets.length);

  for (const asset of assets) {
    const unit = page.locator('.customer-project-unit').filter({ hasText: readableName(asset.display_name) });
    await expect(unit).toBeVisible();
    const progress = unitProgress.find((item) => item.asset_id === asset.id);
    if (progress) await expect(unit).toContainText(`${progress.progress_percent}% complete`);
    const unitEvents = handoverEvents.filter((event) => !event.asset_id || event.asset_id === asset.id);
    const accepted = unitEvents.some((event) => event.event_kind.toUpperCase() === 'ACCEPTED');
    const requested = unitEvents.find((event) => event.event_kind.toUpperCase() === 'REQUESTED');
    if (accepted) {
      await expect(unit.locator('.customer-project-unit-heading .status')).toHaveText('Handed over');
      await expect(unit).toContainText('Coverage commencement remains a separate provider action.');
    } else if (requested) {
      await expect(unit.locator('.customer-project-unit-heading .status')).toHaveText('Ready for your review');
      const review = unit.getByRole('button', { name: `Review & accept ${readableName(asset.display_name)}`, exact: true });
      await expect(review).toBeVisible();
      await review.click();
      const dialog = page.getByRole('dialog', { name: `Accept handover for ${readableName(asset.display_name)}?` });
      await expect(dialog).toBeVisible();
      const accept = dialog.getByRole('button', { name: `Accept ${readableName(asset.display_name)}`, exact: true });
      if (requested.evidence_documents?.length) {
        await expect(accept).toBeEnabled();
        for (const evidence of requested.evidence_documents) await expect(dialog.getByRole('button', { name: `Review ${evidence.filename}`, exact: true })).toBeVisible();
      } else {
        await expect(dialog).toContainText('The provider has not shared the handover quality report yet.');
        await expect(accept).toBeDisabled();
      }
      await dialog.getByRole('button', { name: 'Review details', exact: true }).click();
      await expect(dialog).not.toBeVisible();
    } else {
      await expect(unit.getByRole('button', { name: /^Review & accept/ })).toHaveCount(0);
    }
  }

  await expect(page.getByRole('heading', { name: 'Installation journey', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Project scope|What you approved/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'After handover', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project documents', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', await page.locator('html').evaluate((element) => element.clientWidth));
  await page.screenshot({ path: info.outputPath('customer-elevator-project-detail-top.png') });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  if (info.project.name === 'customer-mobile') {
    const mobileClearance = await page.evaluate(() => {
      const navigation = document.querySelector('.customer-mobile-navigation');
      const documents = document.querySelector('.customer-project-aside > section:nth-child(3)');
      return navigation && documents ? navigation.getBoundingClientRect().top - documents.getBoundingClientRect().bottom : null;
    });
    if (mobileClearance === null) throw new Error('The last project panel or fixed mobile navigation was not rendered.');
    expect(mobileClearance).toBeGreaterThanOrEqual(0);
    expect(mobileClearance).toBeLessThanOrEqual(28);
  }
  await page.screenshot({ path: info.outputPath('customer-elevator-project-detail-bottom.png') });

  const unacceptedAsset = assets.find((asset) => !handoverEvents.some((event) => event.event_kind.toUpperCase() === 'ACCEPTED' && (!event.asset_id || event.asset_id === asset.id)));
  expect(unacceptedAsset, 'The live two-lift example should retain one unit available for handover review.').toBeTruthy();
  const simulatedHandoverRequests: string[] = [];
  let simulatedEvidenceAvailable = false;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes(`/service-cases/${project.id}/handover/accept`)) simulatedHandoverRequests.push(request.url());
  });
  await page.route(`**/api/v1/service-cases/${project.id}*`, async (route) => {
    const response = await route.fetch();
    const payload = await response.json() as { data?: { id?: string; attributes?: CustomerProject['attributes'] } };
    const resource = payload.data;
    if (!resource?.attributes) throw new Error('Project detail response did not include the expected resource attributes.');
    resource.attributes.handover_events = [...(resource.attributes.handover_events || []), {
      id: 'browser-only-handover-request-without-evidence',
      event_kind: 'REQUESTED',
      asset_id: unacceptedAsset!.id,
      evidence_documents: simulatedEvidenceAvailable ? [{ id: 'browser-only-handover-report', filename: 'commissioning-report.pdf', media_type: 'application/pdf', classification: 'SERVICE_CASE_HANDOVER_REPORT' }] : [],
    }];
    await route.fulfill({ response, json: payload });
  });
  await page.evaluate(() => { window.location.hash = '#/projects'; });
  await expect(page).toHaveURL(/#\/projects$/);
  const projectCardAgain = page.locator('article.customer-installation-project-card').filter({ hasText: title });
  await expect(projectCardAgain).toBeVisible();
  await projectCardAgain.getByRole('button', { name: 'View project', exact: true }).click();
  const pendingUnit = page.locator('.customer-project-unit').filter({ hasText: readableName(unacceptedAsset!.display_name) });
  await expect(pendingUnit.locator('.customer-project-unit-heading .status')).toHaveText('Ready for your review');
  await pendingUnit.getByRole('button', { name: `Review & accept ${readableName(unacceptedAsset!.display_name)}`, exact: true }).click();
  const evidenceDialog = page.getByRole('dialog', { name: `Accept handover for ${readableName(unacceptedAsset!.display_name)}?` });
  await expect(evidenceDialog).toBeVisible();
  await expect(evidenceDialog).toContainText('The provider has not shared the handover quality report yet.');
  await expect(evidenceDialog.getByRole('button', { name: `Accept ${readableName(unacceptedAsset!.display_name)}`, exact: true })).toBeDisabled();
  await page.screenshot({ path: info.outputPath('customer-elevator-handover-evidence-required.png') });
  await evidenceDialog.getByRole('button', { name: 'Review details', exact: true }).click();
  await expect(evidenceDialog).not.toBeVisible();
  expect(simulatedHandoverRequests).toEqual([]);

  simulatedEvidenceAvailable = true;
  await page.evaluate(() => { window.location.hash = '#/projects'; });
  await expect(page).toHaveURL(/#\/projects$/);
  const projectCardWithEvidence = page.locator('article.customer-installation-project-card').filter({ hasText: title });
  await expect(projectCardWithEvidence).toBeVisible();
  await projectCardWithEvidence.getByRole('button', { name: 'View project', exact: true }).click();
  const pendingUnitWithEvidence = page.locator('.customer-project-unit').filter({ hasText: readableName(unacceptedAsset!.display_name) });
  await pendingUnitWithEvidence.getByRole('button', { name: `Review & accept ${readableName(unacceptedAsset!.display_name)}`, exact: true }).click();
  const evidenceReadyDialog = page.getByRole('dialog', { name: `Accept handover for ${readableName(unacceptedAsset!.display_name)}?` });
  await expect(evidenceReadyDialog.getByRole('button', { name: 'Review commissioning-report.pdf', exact: true })).toBeVisible();
  await expect(evidenceReadyDialog.getByRole('button', { name: `Accept ${readableName(unacceptedAsset!.display_name)}`, exact: true })).toBeEnabled();
  await page.screenshot({ path: info.outputPath('customer-elevator-handover-evidence-ready.png') });
  await evidenceReadyDialog.getByRole('button', { name: 'Review details', exact: true }).click();
  await expect(evidenceReadyDialog).not.toBeVisible();
  expect(simulatedHandoverRequests).toEqual([]);
});

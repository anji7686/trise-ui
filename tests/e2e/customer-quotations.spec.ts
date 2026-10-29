import { expect, test } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

test('customer reviews the current elevator quotation without submitting a decision or message', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(75_000);
  const mutationRequests: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' && /\/api\/v1\/quotations(?:\/|\?)/.test(request.url())) mutationRequests.push(request.method());
  });

  await localSignIn(page, configuredAccount('CUSTOMER'));
  await page.goto('/#/quotations');
  await expect(page).toHaveURL(/#\/quotations$/);
  await expect(page.getByRole('heading', { name: 'Your approvals', exact: true })).toBeVisible();
  const pending = page.locator('.quote-list-card');
  await expect(pending.first(), 'An authorized provider-approved current quotation is required for this review scenario.').toBeVisible();
  await expect(pending.first()).toContainText('Needs your decision');
  await page.screenshot({ path: info.outputPath('customer-quotation-list.png') });
  await pending.first().getByRole('button', { name: 'Review details', exact: true }).click();

  await expect(page).toHaveURL(/#\/quotation\//);
  await expect(page.getByRole('heading', { name: 'A clear plan. Your call.', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Scope and specifications', exact: true })).toBeVisible();
  await expect(page.locator('.quote-line').first()).toBeVisible();
  await expect(page.locator('.quote-review-title .quote-total')).toContainText('Quotation total');
  await expect(page.getByRole('heading', { name: 'Price and payment schedule', exact: true })).toBeVisible();
  await expect(page.locator('.quote-payment-list > div').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Warranty, AMC and conditions', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Review record', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Conversation with your provider', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ready to respond?', exact: true })).toBeVisible();

  const accept = page.getByRole('button', { name: 'Accept quotation', exact: true });
  const checks = page.locator('.quote-checklist input[type="checkbox"]');
  await expect(checks).toHaveCount(3);
  await expect(accept).toBeDisabled();
  await checks.nth(0).check();
  await checks.nth(1).check();
  await checks.nth(2).check();
  await expect(accept).toBeEnabled();
  await checks.nth(1).uncheck();
  await expect(accept).toBeDisabled();
  await checks.nth(1).check();
  await accept.click();

  const confirmation = page.getByRole('dialog', { name: /Accept revision/ });
  await expect(confirmation).toBeVisible();
  const confirm = confirmation.getByRole('button', { name: 'Confirm acceptance', exact: true });
  await expect(confirm).toBeDisabled();
  await confirmation.getByLabel('Your full name').fill('E2E Review Only');
  await confirmation.getByLabel('Your role or title').fill('Authorized customer reviewer');
  await confirmation.getByRole('checkbox', { name: /I confirm I am authorised/ }).check();
  await expect(confirm).toBeEnabled();
  await confirmation.getByRole('button', { name: 'Go back', exact: true }).click();

  const message = page.getByLabel('Your message');
  await message.fill('E2E review only; this draft must not be sent.');
  await expect(page.getByRole('button', { name: 'Send securely', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath('customer-quotation-review-top-dark.png') });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  if (info.project.name === 'customer-mobile') {
    const mobileClearance = await page.evaluate(() => {
      const navigation = document.querySelector('.customer-mobile-navigation');
      const conversation = document.querySelector('.quote-conversation');
      return navigation && conversation ? navigation.getBoundingClientRect().top - conversation.getBoundingClientRect().bottom : null;
    });
    if (mobileClearance === null) throw new Error('The conversation panel or fixed mobile navigation was not rendered.');
    expect(mobileClearance).toBeGreaterThanOrEqual(0);
    expect(mobileClearance).toBeLessThanOrEqual(36);
  }
  await page.screenshot({ path: info.outputPath('customer-quotation-review-bottom-dark.png') });
  expect(mutationRequests).toEqual([]);
});

test('customer can compare an eight-lift quotation and inspect each material allocation', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(75_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  await page.goto('/#/quotations');
  await expect(page.getByRole('heading', { name: 'Your approvals', exact: true })).toBeVisible();
  const pending = page.locator('.quote-list-card').first();
  await expect(pending).toBeVisible();

  let fixtureApplied = false;
  await page.route(/\/api\/v1\/quotations\/[^/?]+$/, async (route) => {
    const response = await route.fetch();
    const payload = await response.json() as Record<string, unknown>;
    const resource = (payload.data && typeof payload.data === 'object' ? payload.data : payload) as Record<string, unknown>;
    const attributes = (resource.attributes && typeof resource.attributes === 'object' ? resource.attributes : resource) as Record<string, unknown>;
    const liftCodes = Array.from({ length: 8 }, (_, index) => `TOWER-A-LIFT-${String(index + 1).padStart(2, '0')}`);
    attributes.lines = liftCodes.map((code, index) => ({
      description: `Lift ${index + 1} — ${['Passenger traction', 'Hospital bed lift', 'Service lift', 'Passenger traction', 'Fire lift', 'Passenger traction', 'Goods lift', 'Passenger traction'][index]}`,
      quantity: '1', unit_price: String(100000 + index * 5000), amount: String(100000 + index * 5000), unit_codes: [code],
    }));
    const terms = (attributes.terms && typeof attributes.terms === 'object' ? attributes.terms : {}) as Record<string, unknown>;
    terms.materials = liftCodes.map((code, index) => ({
      description: `Lift ${index + 1} controller package`, quantity: '1', unit_code: 'set', unit_codes: [code],
      specifications: [{ name: 'Control mode', value: ['Simplex', 'Duplex', 'Group supervisory', 'Simplex', 'Fire service', 'Duplex', 'Goods priority', 'Group supervisory'][index] }],
    }));
    attributes.terms = terms;
    fixtureApplied = true;
    await route.fulfill({ response, body: JSON.stringify(payload) });
  });

  await pending.getByRole('button', { name: 'Review details', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Scope and specifications', exact: true })).toBeVisible();
  expect(fixtureApplied, 'The controlled eight-lift quotation response should be applied.').toBe(true);
  const lines = page.locator('.quote-line');
  await expect(lines).toHaveCount(8);
  await expect(lines.nth(0).locator('.quote-unit-scope summary')).toContainText('1 of 8 lifts');
  await expect(lines.nth(7)).toContainText('Lift 8 — Passenger traction');
  await lines.nth(7).locator('.quote-unit-scope summary').click();
  await expect(lines.nth(7).locator('.quote-unit-scope')).toContainText('TOWER-A-LIFT-08');

  const materials = page.locator('.quote-materials article');
  await expect(materials).toHaveCount(8);
  await expect(materials.nth(1)).toContainText('Control mode: Duplex');
  await expect(materials.nth(6).locator('.quote-unit-scope summary')).toContainText('1 of 8 lifts');
  await materials.nth(6).locator('.quote-unit-scope summary').click();
  await expect(materials.nth(6).locator('.quote-unit-scope')).toContainText('TOWER-A-LIFT-07');
  const layout = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, viewportWidth: document.documentElement.clientWidth }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
  const comparisonColumns = await page.locator('.quote-line-list').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  expect(comparisonColumns).toBe(info.project.name === 'customer-mobile' ? 1 : 2);
  if (info.project.name === 'customer-mobile') {
    await page.screenshot({ path: info.outputPath('customer-quotation-eight-lifts-mobile.png'), fullPage: true });
  } else {
    await page.screenshot({ path: info.outputPath('customer-quotation-eight-lifts-desktop.png'), fullPage: true });
  }
});

test('customer conversation shows both authors and handles sent, stale and denied messages', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(75_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  await page.goto('/#/quotations');
  await expect(page.getByRole('heading', { name: 'Your approvals', exact: true })).toBeVisible();
  const pending = page.locator('.quote-list-card').first();
  await expect(pending).toBeVisible();
  const submittedPayloads: Record<string, unknown>[] = [];
  let communicationReads = 0;
  let responseMode: 'success' | 'conflict' | 'denied' = 'success';
  await page.route(/\/api\/v1\/quotations\/[^/?]+\/communications(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      communicationReads += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [
        { id: 'customer-message-fixture', type: 'quotation-communications', attributes: { quotation_revision: 1, author_side: 'customer', message_type: 'question', body: 'Does the controller include remote monitoring?', created_at: '2026-10-28T10:00:00Z', author_name: 'Demo Customer' } },
        { id: 'provider-message-fixture', type: 'quotation-communications', attributes: { quotation_revision: 1, author_side: 'provider', message_type: 'reply', body: 'Yes, remote monitoring is included for each lift.', created_at: '2026-10-28T10:30:00Z', author_name: 'Lift Rise Elevators' } },
      ] }) });
      return;
    }
    const requestBody = route.request().postDataJSON() as Record<string, unknown>;
    submittedPayloads.push(requestBody);
    if (responseMode === 'conflict') {
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'conflict', message: 'revision is stale' }) });
      return;
    }
    if (responseMode === 'denied') {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'forbidden', message: 'The requested operation is not permitted' }) });
      return;
    }
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
      id: 'created-message-fixture', type: 'quotation-communications', relationships: {},
      attributes: { quotation_revision: Number(requestBody.expected_revision), author_side: 'customer', message_type: String(requestBody.message_type).toLowerCase(), body: String(requestBody.body), created_at: '2026-10-29T10:00:00Z', author_name: 'Demo Customer' },
    }) });
  });

  await pending.getByRole('button', { name: 'Review details', exact: true }).click();
  const conversation = page.locator('.quote-conversation');
  await expect(conversation.locator('.quote-message-customer')).toContainText('Does the controller include remote monitoring?');
  await expect(conversation.locator('.quote-message-provider')).toContainText('remote monitoring is included');
  await conversation.getByLabel('Message type').selectOption('CHANGE_REQUEST');
  await conversation.getByLabel('Your message').fill('Please include the monitoring setup for Lift 2.');
  await conversation.getByRole('button', { name: 'Send securely', exact: true }).click();
  await expect(conversation.getByRole('status')).toContainText('Your message was sent securely to the provider.');
  await expect(conversation.locator('.quote-message-customer').last()).toContainText('Please include the monitoring setup for Lift 2.');
  expect(communicationReads).toBe(1);
  expect(submittedPayloads[0]).toMatchObject({ expected_revision: 1, message_type: 'CHANGE_REQUEST', body: 'Please include the monitoring setup for Lift 2.' });

  responseMode = 'conflict';
  await conversation.getByLabel('Your message').fill('Can we update the delivery timeline?');
  await conversation.getByRole('button', { name: 'Send securely', exact: true }).click();
  await expect(conversation.getByRole('alert')).toContainText('This quotation has changed or closed.');
  await expect(conversation.getByRole('button', { name: 'Reload quotation', exact: true })).toBeVisible();
  await expect(conversation.getByLabel('Your message')).toHaveValue('Can we update the delivery timeline?');

  responseMode = 'denied';
  await conversation.getByLabel('Your message').fill('Can your team confirm the next step?');
  await conversation.getByRole('button', { name: 'Send securely', exact: true }).click();
  await expect(conversation.getByRole('alert')).toContainText('Your account no longer has access');
  await expect(conversation.getByRole('button', { name: 'Reload quotation', exact: true })).toHaveCount(0);
  await expect(conversation.getByLabel('Your message')).toHaveValue('Can your team confirm the next step?');
  expect(submittedPayloads).toHaveLength(3);
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  const customerMessageColors = await conversation.locator('.quote-message-customer').first().evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    foreground: getComputedStyle(element).color,
  }));
  expect(customerMessageColors.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(customerMessageColors.foreground).not.toBe('rgb(0, 0, 0)');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  if (info.project.name === 'customer-mobile') {
    const clearance = await page.evaluate(() => {
      const navigation = document.querySelector('.customer-mobile-navigation');
      const conversationPanel = document.querySelector('.quote-conversation');
      return navigation && conversationPanel ? navigation.getBoundingClientRect().top - conversationPanel.getBoundingClientRect().bottom : null;
    });
    if (clearance === null) throw new Error('The conversation panel or fixed mobile navigation was not rendered.');
    expect(clearance).toBeGreaterThanOrEqual(0);
    expect(clearance).toBeLessThanOrEqual(36);
  }
  await page.screenshot({ path: info.outputPath(`customer-quotation-messages-${info.project.name}.png`) });
});

test('expired and terminal quotations keep conversation history read-only', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(75_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  await page.goto('/#/quotations');
  await expect(page.getByRole('heading', { name: 'Your approvals', exact: true })).toBeVisible();
  const pending = page.locator('.quote-list-card').first();
  await expect(pending).toBeVisible();
  let state: 'expired' | 'approved' = 'expired';
  await page.route(/\/api\/v1\/quotations\/[^/?]+$/, async (route) => {
    const response = await route.fetch();
    const payload = await response.json() as Record<string, unknown>;
    const resource = (payload.data && typeof payload.data === 'object' ? payload.data : payload) as Record<string, unknown>;
    const attributes = (resource.attributes && typeof resource.attributes === 'object' ? resource.attributes : resource) as Record<string, unknown>;
    if (state === 'expired') attributes.valid_until = '2026-10-01T00:00:00Z';
    else attributes.status = 'APPROVED';
    await route.fulfill({ response, body: JSON.stringify(payload) });
  });

  await pending.getByRole('button', { name: 'Review details', exact: true }).click();
  const conversation = page.locator('.quote-conversation');
  await expect(conversation.locator('.quote-message-form')).toHaveCount(0);
  await expect(conversation.locator('.quote-conversation-closed')).toContainText('expired or closed');
  await expect(conversation).toBeVisible();

  state = 'approved';
  await page.reload();
  await expect(page.locator('.quote-review-title')).toContainText('Revision');
  await expect(page.locator('.quote-conversation .quote-message-form')).toHaveCount(0);
  await expect(page.locator('.quote-conversation-closed')).toContainText('conversation history remains available');
});

test('customer can decline an exact quotation revision only after final confirmation', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(75_000);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  await page.goto('/#/quotations');
  await expect(page.getByRole('heading', { name: 'Your approvals', exact: true })).toBeVisible();
  const pending = page.locator('.quote-list-card').first();
  await expect(pending).toBeVisible();

  let quotationPayload: Record<string, unknown> | undefined;
  let rejectionPayload: Record<string, unknown> | undefined;
  await page.route(/\/api\/v1\/quotations\/[^/?]+$/, async (route) => {
    const response = await route.fetch();
    quotationPayload = await response.json() as Record<string, unknown>;
    await route.fulfill({ response, body: JSON.stringify(quotationPayload) });
  });
  await page.route(/\/api\/v1\/quotations\/[^/?]+\/reject$/, async (route) => {
    rejectionPayload = route.request().postDataJSON() as Record<string, unknown>;
    if (!quotationPayload) throw new Error('The authorized quotation detail response was not captured.');
    const payload = JSON.parse(JSON.stringify(quotationPayload)) as Record<string, unknown>;
    const resource = (payload.data && typeof payload.data === 'object' ? payload.data : payload) as Record<string, unknown>;
    const attributes = (resource.attributes && typeof resource.attributes === 'object' ? resource.attributes : resource) as Record<string, unknown>;
    attributes.status = 'rejected';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });

  await pending.getByRole('button', { name: 'Review details', exact: true }).click();
  const decline = page.getByRole('button', { name: 'Decline quotation', exact: true });
  await expect(decline).toBeVisible();
  await decline.click();
  const dialog = page.getByRole('dialog', { name: /Decline revision/ });
  await expect(dialog).toContainText('It cannot be accepted after you decline it.');
  await dialog.getByRole('button', { name: 'Keep reviewing', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(rejectionPayload).toBeUndefined();

  await decline.click();
  await dialog.getByLabel('Reason (optional)').fill('The lift configuration needs a different specification.');
  await dialog.getByRole('button', { name: 'Confirm decline', exact: true }).click();
  await expect(page.locator('.quote-success')).toContainText('Your decision to decline this quotation has been recorded.');
  const capturedResource = (quotationPayload?.data && typeof quotationPayload.data === 'object' ? quotationPayload.data : quotationPayload) as Record<string, unknown>;
  const capturedAttributes = (capturedResource.attributes && typeof capturedResource.attributes === 'object' ? capturedResource.attributes : capturedResource) as Record<string, unknown>;
  expect(rejectionPayload).toMatchObject({ expected_revision: Number(capturedAttributes.revision), reason: 'The lift configuration needs a different specification.' });
  await expect(page.getByRole('button', { name: 'Accept quotation', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Decline quotation', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Response closed', exact: true })).toBeVisible();
  await expect(page.locator('.quote-help')).toHaveCount(0);
  await expect(page.locator('.quote-conversation-closed')).toContainText('conversation history remains available');
  await page.screenshot({ path: info.outputPath(`customer-quotation-declined-${info.project.name}.png`) });
});

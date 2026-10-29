import { test, expect } from './fixtures';
import { configuredAccount, localSignIn } from './local-auth';
import type { Page } from 'playwright/test';

test.use({ trace: 'on', video: 'off', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000 });

const eligibleJobId = 'browser-feedback-eligible';
const job = (id: string, status: string) => ({
  id,
  type: 'service-jobs',
  attributes: { summary: 'Preventive maintenance visit', status, revision: 1, completed_at: '2026-10-28T10:00:00Z', assigned_technician: { display_name: 'Kiran Nair' } },
  relationships: {},
});
const feedback = (id: string, jobId: string) => ({
  id,
  type: 'service-feedback',
  attributes: { rating: 5, comment: 'Already reviewed.', submitted_at: '2026-10-28T11:00:00Z' },
  relationships: { job: { id: jobId } },
});

async function installFeedbackFixtures(page: Page, options: { status?: string; submitted?: boolean; submitStatus?: number } = {}) {
  let fixtureProviderId = '';
  let submitCount = 0;
  const status = options.status ?? 'COMPLETED';
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const providerId = request.headers()['x-trise-provider-id'] || '';
    if (url.pathname.endsWith('/service-jobs') && request.method() === 'GET') {
      fixtureProviderId ||= providerId;
      const selected = providerId === fixtureProviderId && url.searchParams.get('filter[status]') === status;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: selected ? [job(eligibleJobId, status)] : [], page: { limit: 100, next: null, previous: null } }),
      });
      return;
    }
    if (url.pathname.endsWith('/feedback') && request.method() === 'GET') {
      const data = options.submitted && providerId === fixtureProviderId ? [feedback('browser-feedback-submitted', eligibleJobId)] : [];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data, page: { limit: 50, next: null, previous: null } }) });
      return;
    }
    if (url.pathname.endsWith(`/service-jobs/${eligibleJobId}/feedback`) && request.method() === 'POST') {
      submitCount += 1;
      await route.fulfill({
        status: options.submitStatus ?? 201,
        contentType: 'application/json',
        body: JSON.stringify(options.submitStatus && options.submitStatus >= 400
          ? { code: 'feedback_rejected', message: 'Feedback could not be saved. Please try again.' }
          : { data: feedback('browser-feedback-created', eligibleJobId) }),
      });
      return;
    }
    await route.continue();
  });
  return { get submitCount() { return submitCount; } };
}

test('customer can submit feedback only after choosing a rating and sees a success confirmation', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(90_000);
  const requests = await installFeedbackFixtures(page);
  await localSignIn(page, configuredAccount('CUSTOMER'));
  if (info.project.name === 'customer-mobile') await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();

  await page.goto(`/#/feedback/${eligibleJobId}`);
  await expect(page.getByRole('heading', { name: 'How did we do?', exact: true })).toBeVisible();
  await expect(page.getByText(/Kiran Nair · /)).toBeVisible();
  await expect(page.getByText(/Completed Preventive maintenance visit/)).toBeVisible();
  const send = page.getByRole('button', { name: 'Send feedback', exact: true });
  await expect(send).toBeDisabled();
  expect(requests.submitCount).toBe(0);
  await page.screenshot({ path: info.outputPath('customer-feedback-form-baseline.png'), fullPage: true });
  if (info.project.name === 'customer-desktop') {
    for (const theme of ['light', 'dark'] as const) {
      const activeTheme = await page.locator('html').getAttribute('data-theme');
      if (activeTheme !== theme) {
        await page.getByRole('button', { name: theme === 'dark' ? 'Switch to dark theme' : 'Switch to light theme', exact: true }).click();
      }
      for (const width of [360, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: width < 700 ? 844 : 900 });
        const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
        expect(dimensions.viewport).toBe(width);
        expect(dimensions.document, `${theme} theme at ${width}px`).toBeLessThanOrEqual(width);
        expect(dimensions.body, `${theme} theme at ${width}px`).toBeLessThanOrEqual(width);
      }
    }
    await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await page.getByRole('radio', { name: '5 stars', exact: true }).check();
  await page.getByLabel('Anything you’d like to share?').fill('The visit was on time and the technician explained the repair.');
  await expect(send).toBeEnabled();
  const submitted = page.waitForRequest(request => request.method() === 'POST' && request.url().includes(`/service-jobs/${eligibleJobId}/feedback`));
  await send.click();
  const request = await submitted;
  expect(request.postDataJSON()).toMatchObject({ rating: 5, comment: 'The visit was on time and the technician explained the repair.' });
  expect(request.headers()['idempotency-key']).toBeTruthy();
  await expect(page.getByText('Thank you for sharing feedback. It has been recorded for this visit.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Thanks for sharing.', exact: true })).toBeVisible();
  expect(requests.submitCount).toBe(1);
  await page.screenshot({ path: info.outputPath('customer-feedback-submitted.png'), fullPage: true });
});

test('customer can correct and retry feedback when the server rejects a submission', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('customer'), 'Customer application only');
  test.setTimeout(90_000);
  let rejectFirst = true;
  let fixtureProviderId = '';
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const providerId = request.headers()['x-trise-provider-id'] || '';
    if (url.pathname.endsWith('/service-jobs') && request.method() === 'GET') {
      fixtureProviderId ||= providerId;
      const selected = providerId === fixtureProviderId && url.searchParams.get('filter[status]') === 'COMPLETED';
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: selected ? [job(eligibleJobId, 'COMPLETED')] : [], page: { limit: 100, next: null, previous: null } }) });
      return;
    }
    if (url.pathname.endsWith('/feedback') && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], page: { limit: 50, next: null, previous: null } }) });
      return;
    }
    if (url.pathname.endsWith(`/service-jobs/${eligibleJobId}/feedback`) && request.method() === 'POST') {
      if (rejectFirst) {
        rejectFirst = false;
        await route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ code: 'feedback_rejected', message: 'Feedback could not be saved. Please try again.' }) });
      } else {
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: feedback('browser-feedback-created', eligibleJobId) }) });
      }
      return;
    }
    await route.continue();
  });

  await localSignIn(page, configuredAccount('CUSTOMER'));
  if (info.project.name === 'customer-mobile') await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click();
  await page.goto(`/#/feedback/${eligibleJobId}`);
  await page.getByRole('radio', { name: '4 stars', exact: true }).check();
  const comment = page.getByLabel('Anything you’d like to share?');
  await comment.fill('Please review the visit notes.');
  await page.getByRole('button', { name: 'Send feedback', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Feedback could not be saved. Please try again.');
  await expect(page.getByRole('radio', { name: '4 stars', exact: true })).toBeChecked();
  await expect(comment).toHaveValue('Please review the visit notes.');
  await page.getByRole('button', { name: 'Send feedback', exact: true }).click();
  await expect(page.getByText('Thank you for sharing feedback. It has been recorded for this visit.', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath('customer-feedback-retry-success.png'), fullPage: true });
});

test('customer cannot submit feedback for an in-progress visit or one already reviewed', async ({ page }, info) => {
  test.skip(info.project.name !== 'customer-desktop', 'State coverage is run once in the desktop browser engine');
  test.setTimeout(90_000);
  await installFeedbackFixtures(page, { status: 'IN_PROGRESS' });
  await localSignIn(page, configuredAccount('CUSTOMER'));
  await page.goto(`/#/feedback/${eligibleJobId}`);
  await expect(page.getByText('This service visit is unavailable or not eligible for feedback.', { exact: true })).toBeVisible();

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const providerId = request.headers()['x-trise-provider-id'] || '';
    if (url.pathname.endsWith('/service-jobs') && request.method() === 'GET') {
      const selected = providerId && url.searchParams.get('filter[status]') === 'COMPLETED';
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: selected ? [job(eligibleJobId, 'COMPLETED')] : [], page: { limit: 100, next: null, previous: null } }) });
      return;
    }
    if (url.pathname.endsWith('/feedback') && request.method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [feedback('browser-feedback-submitted', eligibleJobId)], page: { limit: 50, next: null, previous: null } }) });
      return;
    }
    await route.continue();
  });
  await page.reload();
  await expect(page.getByText('Thank you for sharing feedback. It has been recorded for this visit.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send feedback', exact: true })).toHaveCount(0);
});

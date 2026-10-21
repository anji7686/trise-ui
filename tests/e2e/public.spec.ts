import { test, expect } from './fixtures';

test('signed-out screen protects private workflows and fits the viewport', async ({ page, evidence }, testInfo) => {
  const operations = testInfo.project.name.startsWith('operations');
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  await testInfo.attach('initial-page', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await expect(page.getByRole('heading', { name: operations ? 'Sign in to Operations' : 'Service care that follows your asset.' })).toBeVisible();
  await expect(page.getByText(operations ? 'Secure operations workspace' : 'Sign-in required for private data', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.goto(operations ? '/#/platform/subscriptions' : '/#/documents');
  await expect(page.getByRole('heading', { name: operations ? 'Sign in to Operations' : 'Service care that follows your asset.' })).toBeVisible();
  await testInfo.attach('protected-route', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await page.reload();
  await expect(page.getByText(operations ? 'Secure operations workspace' : 'Sign-in required for private data', { exact: true })).toBeVisible();
  await testInfo.attach('public-accessible-dom', { body: await page.locator('main').first().ariaSnapshot(), contentType: 'text/plain' });
  expect(evidence.exceptions).toEqual([]);
  expect(evidence.responses.filter(item => item.status >= 400 && !(item.status === 401 && ['/api/v1/me', '/api/v1/session/refresh'].includes(item.path)))).toEqual([]);
});

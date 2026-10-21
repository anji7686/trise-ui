import { test, expect } from 'playwright/test';

test('Rails boots and rejects anonymous private reads', async ({ request, baseURL }, testInfo) => {
  if (!baseURL) throw new Error('Missing API base URL');
  const health = await request.get(new URL('/up', baseURL).href);
  expect(health.status()).toBe(200);
  const apiBase = new URL('/api/v1/', baseURL).toString().replace(/\/$/, '');
  const statuses = [];
  for (const path of ['/me', '/platform/subscriptions', '/providers/subscription']) {
    const response = await request.get(`${apiBase}${path}`);
    statuses.push({ method: 'GET', path, status: response.status() });
  }
  await testInfo.attach('anonymous-authorization-statuses', { body: JSON.stringify(statuses), contentType: 'application/json' });
  for (const result of statuses) expect(result.status, result.path).toBe(401);
});

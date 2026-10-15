import { test as base, expect } from 'playwright/test';

type Evidence = { console: unknown[]; exceptions: unknown[]; requests: unknown[]; responses: { method: string; path: string; status: number }[]; failures: unknown[] };
function safePath(raw: string) {
  try { return new URL(raw).pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id'); }
  catch { return '[unparseable URL]'; }
}
function safeMessage(value: string) {
  return value.replace(/https?:\/\/[^\s)]+/g, raw => {
    try { const url = new URL(raw); return `${url.origin}${safePath(raw)}`; } catch { return '[URL]'; }
  }).replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email redacted]')
    .replace(/(bearer\s+)[^\s]+/gi, '$1[redacted]')
    .replace(/((?:token|password|authorization|cookie|secret)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').slice(0, 4000);
}
export const test = base.extend<{ evidence: Evidence }>({
  evidence: [async ({ page }, use, testInfo) => {
    const evidence: Evidence = { console: [], exceptions: [], requests: [], responses: [], failures: [] };
    page.on('console', event => {
      if (['error', 'warning'].includes(event.type())) evidence.console.push({ type: event.type(), path: safePath(event.location().url), line: event.location().lineNumber, message: safeMessage(event.text()) });
    });
    page.on('pageerror', error => evidence.exceptions.push({ name: error.name, message: safeMessage(error.message), stack: safeMessage(error.stack || '') }));
    page.on('request', request => {
      let payloadKeys: string[] = [];
      try { const body = request.postDataJSON(); if (body && typeof body === 'object') payloadKeys = Object.keys(body); } catch { /* Non-JSON payloads have no JSON field names. */ }
      evidence.requests.push({ method: request.method(), path: safePath(request.url()), resourceType: request.resourceType(), recordedAt: Date.now(), payloadKeys });
    });
    page.on('response', response => evidence.responses.push({ method: response.request().method(), path: safePath(response.url()), status: response.status() }));
    page.on('requestfailed', request => evidence.failures.push({ method: request.method(), path: safePath(request.url()), error: safeMessage(request.failure()?.errorText || 'Unknown failure') }));
    try { await use(evidence); } finally {
      await testInfo.attach('browser-diagnostics', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
    }
  }, { auto: true }]
});
export { expect };

import { afterEach, describe, expect, it, vi } from 'vitest';
import { operationsData } from './data';

afterEach(() => vi.restoreAllMocks());

describe('operations execution contracts', () => {
  it('keeps work-note and parts mutations idempotent and provider scoped', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ data: { id: 'record-1' } }), { status: 200 })
    );

    await operationsData.createNote('provider-1', 'job-1', { text: 'Arrived', visibility: 'INTERNAL' }, 'note-retry-1');
    await operationsData.recordPart('provider-1', 'job-1', { description: 'Valve', quantity: 1, unit: 'EA', usage_kind: 'USED' }, 'part-retry-1');

    expect(fetchMock.mock.calls[0][0]).toContain('/service-jobs/job-1/notes');
    expect(fetchMock.mock.calls[1][0]).toContain('/service-jobs/job-1/parts-used');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Idempotency-Key')).toBe('note-retry-1');
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('Idempotency-Key')).toBe('part-retry-1');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-1');
  });

  it('uses bounded reads for configuration and audit previews', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    );

    await operationsData.configuration('provider-1', 'asset-families');
    await operationsData.timeline('provider-1');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/configuration/asset-families?page[limit]=25');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/timeline?page[limit]=25');
  });

  it('uses the reviewed configuration lifecycle endpoints with revision and idempotency', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ data: { id: 'configuration-1', attributes: { revision: 2 } } }), { status: 200 })
    );

    await operationsData.createConfiguration('provider-1', 'service-types', { name: 'Demo service', definition: { code: 'DEMO', name: 'Demo', effective_from: '2026-09-30T00:00:00Z' } }, 'config-create-1');
    await operationsData.updateConfiguration('provider-1', 'service-types', 'configuration-1', { definition: { code: 'DEMO', name: 'Updated' }, expected_revision: 2 }, 'config-update-1');
    await operationsData.submitConfigurationReview('provider-1', 'service-types', 'configuration-1', { expected_revision: 3 }, 'config-review-1');
    await operationsData.activateConfiguration('provider-1', 'service-types', 'configuration-1', { expected_revision: 3, review_reference: 'review-1' }, 'config-activate-1');

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('/configuration/service-types'),
      expect.stringContaining('/configuration/service-types/configuration-1'),
      expect.stringContaining('/configuration/service-types/configuration-1/reviews'),
      expect.stringContaining('/configuration/service-types/configuration-1/activate')
    ]);
    expect(new Headers(fetchMock.mock.calls[3][1]?.headers).get('Idempotency-Key')).toBe('config-activate-1');
  });
});

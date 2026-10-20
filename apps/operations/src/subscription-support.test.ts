import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@trise/api-client';
import { operationsData, type Collection, type PlatformPlan, type ProviderOperation, type ProviderSubscriptionSelfService, type Resource } from './data';
import { applicablePlanChoices, collectPages, formatIndiaDateTime, formatIndiaTime, indiaDateTimeToIso, localDateTime, mergeProviderHistory, RequestGeneration, SubscriptionCommands } from './subscription-support';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); apiClient.clearSession(); });
const row = (id: string) => ({ id, type: 'test', attributes: {}, relationships: {} });

describe('provider operation plan matching', () => {
  const operation = (id: string, name: string) => ({ id: `provider-op-${id}`, type: 'provider-operations', attributes: { status: 'ACTIVE', is_primary: false, revision: 1, business_operation: { id, code: id, name } }, relationships: {} }) as ProviderOperation;
  const plan = (id: string, operationIds: string[], status = 'PUBLISHED') => ({ id, type: 'saas-plans', attributes: { code: id, name: id, status: 'ACTIVE', revision: 1, versions: [{ id: `version-${id}`, type: 'saas-plan-versions', attributes: { version_number: 1, status, revision: 1, price_amount: '0', currency_code: 'INR', billing_interval: 'FOURTEEN_DAYS', tax_treatment: 'GST_EXTRA', industry_keys: [], business_operation_type_ids: operationIds, limits: [], included_features: [] }, relationships: {} }] }, relationships: {} }) as Resource<PlatformPlan>;

  it('shows only published plans matching any active provider operation and identifies each match', () => {
    const choices = applicablePlanChoices([
      plan('elevator', ['lift']), plan('solar', ['pv']), plan('combined', ['lift', 'pv']),
      plan('other', ['water']), plan('draft', ['lift'], 'DRAFT')
    ], [operation('lift', 'Elevator & Lift Services'), operation('pv', 'Solar PV Services')]);
    expect(choices.map((choice) => choice.plan.id)).toEqual(['elevator', 'solar', 'combined']);
    expect(choices[2].matchingOperations).toEqual(['Elevator & Lift Services', 'Solar PV Services']);
  });

  it('returns no plans when the provider has no enabled Business Operations', () => {
    expect(applicablePlanChoices([plan('elevator', ['lift'])], [])).toEqual([]);
  });
});

describe('subscription collection completeness', () => {
  it('finds a provider subscription on later pages with provider scoping retained', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const next = String(url).includes('page%5Bafter%5D');
      return new Response(JSON.stringify({ data: next ? [row('subscription-26')] : Array.from({ length: 25 }, (_, i) => row(`subscription-${i}`)), page: { next: next ? null : 'opaque+cursor/==' } }));
    });
    const result = await collectPages((after) => operationsData.platformSubscriptions({ providerId: 'provider-26', after }));
    expect(result.some((item) => item.id === 'subscription-26')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(new URL(String(url)).searchParams.get('providerId')).toBe('provider-26');
      expect(new Headers(init?.headers).get('X-TRISE-Provider-Id')).toBeNull();
    }
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('page[after]')).toBe('opaque+cursor/==');
  });
  it('does not report an incomplete catalogue as success on repeated cursors or page failure', async () => {
    const repeated = vi.fn(async () => ({ data: [row('1')], page: { next: 'same' } }));
    await expect(collectPages(repeated)).rejects.toThrow('cursor repeated');
    const read = vi.fn<() => Promise<Collection<object>>>().mockResolvedValueOnce({ data: [row('1')], page: { next: 'next' } }).mockRejectedValueOnce(new Error('Offline'));
    await expect(collectPages(read)).rejects.toThrow('Offline');
  });
  it('stops cursor traversal after a scope change', async () => {
    const generation = new RequestGeneration(); const valid = generation.next();
    const read = vi.fn(async () => { generation.invalidate(); return { data: [row('old-provider')], page: { next: 'next' } }; });
    expect(await collectPages(read, valid)).toEqual([]);
    expect(read).toHaveBeenCalledTimes(1);
    const newRead = generation.next(); expect(newRead()).toBe(true); expect(valid()).toBe(false);
  });
  it('preserves request provider filters and invoice provider query names', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: [] })));
    await operationsData.platformSubscriptionRequests({ providerId: 'provider-2', after: 'cursor' });
    await operationsData.platformSubscriptionInvoices({ providerId: 'provider-2' });
    await operationsData.platformSubscriptionChanges({ providerId: 'provider-2', after: 'change-cursor' });
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('providerId')).toBe('provider-2');
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('page[after]')).toBe('cursor');
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('provider_id')).toBe('provider-2');
    expect(new URL(String(fetchMock.mock.calls[2][0])).searchParams.get('providerId')).toBe('provider-2');
    expect(new URL(String(fetchMock.mock.calls[2][0])).searchParams.get('page[after]')).toBe('change-cursor');
  });
  it('traverses invoice history beyond the old 100-record ceiling', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const query = new URL(String(url)).searchParams;
      const offset = Number(query.get('page[after]') || 0);
      return new Response(JSON.stringify({ data: Array.from({ length: Math.min(25, 105 - offset) }, (_, index) => row(`invoice-${offset + index}`)), page: { next: offset + 25 < 105 ? String(offset + 25) : null } }));
    });
    const result = await collectPages((after) => operationsData.platformSubscriptionInvoices({ providerId: 'provider-1', after }));
    expect(result).toHaveLength(105);
    expect(new Set(result.map((item) => item.id)).size).toBe(105);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls.every(([url]) => new URL(String(url)).searchParams.get('provider_id') === 'provider-1')).toBe(true);
  });
  it('pages provider histories without clearing other loaded collections or cursors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: {} })));
    await operationsData.providerSubscription('provider-1', { invoices: 'opaque+invoice/==' });
    const [url, init] = fetchMock.mock.calls[0]; const query = new URL(String(url)).searchParams;
    expect(query.get('history[invoices][after]')).toBe('opaque+invoice/==');
    expect(query.get('history[changes][limit]')).toBe('25');
    expect(query.get('history[changes][after]')).toBeNull();
    expect(new Headers(init?.headers).get('X-TRISE-Provider-Id')).toBe('provider-1');
    const current = { requests: [{ id: 'request-1' }], changes: [{ id: 'change-1' }], invoices: [{ id: 'invoice-1' }], history_page: { requests: { next: 'r' }, changes: { next: 'c' }, invoices: { next: 'i' } } } as ProviderSubscriptionSelfService;
    const next = { requests: [], changes: [], invoices: [{ id: 'invoice-1' }, { id: 'invoice-2' }], history_page: { requests: {}, changes: {}, invoices: { next: null } } } as unknown as ProviderSubscriptionSelfService;
    const merged = mergeProviderHistory(current, next, 'invoices');
    expect(merged.requests).toEqual(current.requests); expect(merged.changes).toEqual(current.changes);
    expect(merged.invoices.map((item) => item.id)).toEqual(['invoice-1', 'invoice-2']);
    expect(merged.history_page?.changes.next).toBe('c'); expect(merged.history_page?.invoices.next).toBeNull();
  });
});

describe('subscription action reliability', () => {
  it('prevents concurrent commands and reuses keys after an uncertain failure', async () => {
    const commands = new SubscriptionCommands(); let reject!: (error: Error) => void;
    const keys: string[] = [];
    const first = commands.run('invoice-1', (key) => { keys.push(key); return new Promise((_, fail) => { reject = fail; }); });
    const duplicate = vi.fn();
    expect(await commands.run('invoice-1', duplicate)).toBe(false); expect(duplicate).not.toHaveBeenCalled();
    reject(new Error('Connection lost')); await expect(first).rejects.toThrow('Connection lost');
    await commands.run('invoice-1', async (key) => { keys.push(key); });
    expect(keys[1]).toBe(keys[0]);
    await commands.run('invoice-1', async (key) => { keys.push(key); });
    expect(keys[2]).not.toBe(keys[1]);
  });
  it('uses a new key after a definite validation rejection', async () => {
    const commands = new SubscriptionCommands(); const keys: string[] = [];
    await expect(commands.run('request', async (key) => { keys.push(key); throw { status: 422 }; })).rejects.toEqual({ status: 422 });
    await commands.run('request', async (key) => { keys.push(key); });
    expect(keys[0]).not.toBe(keys[1]);
  });
  it('formats and parses business dates in India regardless of browser timezone', () => {
    const date = new Date('2026-10-10T18:15:00.000Z');
    expect(localDateTime(date)).toBe('2026-10-10T23:45');
    expect(indiaDateTimeToIso('2026-10-10T23:45')).toBe('2026-10-10T18:15:00.000Z');
    expect(formatIndiaDateTime(date)).toContain('10 Oct 2026');
    expect(formatIndiaTime(date)).toBe('23:45');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { accessData } from './access-data';

afterEach(() => vi.restoreAllMocks());

describe('platform roles directory contracts', () => {
  it('sends role search, filters, stable sorting and cursor pagination to Rails', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [], page: { next: null, previous: null } }), { status: 200 }));
    await accessData.platformRoles({ q: 'Dispatcher', status: 'published', businessOperationId: 'operation-id', version: '2', sort: '-updated_date', limit: 25, after: 'cursor+/=' });
    const query = new URL(String(fetchMock.mock.calls[0][0])).searchParams;
    expect(query.get('q')).toBe('Dispatcher');
    expect(query.get('filter[status]')).toBe('published');
    expect(query.get('filter[business_operation_type_id]')).toBe('operation-id');
    expect(query.get('filter[version]')).toBe('2');
    expect(query.get('sort')).toBe('-updated_date');
    expect(query.get('page[limit]')).toBe('25');
    expect(query.get('page[after]')).toBe('cursor+/=');
  });

  it('sends provider policy filters to the authorized full dataset', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [], page: { next: null, previous: null } }), { status: 200 }));
    await accessData.customRolePolicies({ q: 'Lift', enabled: 'false', status: 'ACTIVE', businessOperationId: 'operation-id', sort: 'provider_name', before: 'previous' });
    const query = new URL(String(fetchMock.mock.calls[0][0])).searchParams;
    expect(query.get('q')).toBe('Lift');
    expect(query.get('filter[enabled]')).toBe('false');
    expect(query.get('filter[status]')).toBe('ACTIVE');
    expect(query.get('filter[business_operation_type_id]')).toBe('operation-id');
    expect(query.get('page[before]')).toBe('previous');
  });
});

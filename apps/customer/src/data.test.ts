import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildBookingPayload, customerData } from './data';

afterEach(() => vi.restoreAllMocks());

describe('customer booking contract', () => {
  it('builds a booking request from authorized records without internal request-type identifiers', () => {
    const payload = buildBookingPayload({ summary: 'Annual service', customerRelationshipId: 'relationship-1', assetId: 'asset-1', locationId: 'location-1', serviceTypeId: 'service-1', startsAt: '2026-09-29T09:00:00.000Z', endsAt: '2026-09-29T10:00:00.000Z' });
    expect(payload).toMatchObject({ asset_id: 'asset-1', location_id: 'location-1', service_type_id: 'service-1' });
    expect(payload).not.toHaveProperty('request_type_id');
    expect(payload.requested_window).not.toHaveProperty('time_zone');
  });
});

describe('customer mutation contracts', () => {
  it('sends the expected profile revision and preserves a server conflict', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ code: 'conflict', message: 'stale resource' }), { status: 409 }));
    await expect(customerData.updateMe({ display_name: 'Updated', locale: 'hi', expected_revision: 7 })).rejects.toMatchObject({ status: 409, code: 'conflict' });
    expect(fetchMock.mock.calls[0][0]).toContain('/me');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ display_name: 'Updated', locale: 'hi', expected_revision: 7 });
  });

  it('uses stable command headers for quotation decisions and notification reads', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: { id: 'q-1' } }), { status: 200 }));
    await customerData.approveQuotation('provider-1', 'quotation-1', 3, 'retry-key', { approver_name: 'Asha Rao', approver_role: 'Facilities Manager', authority_attested: true });
    await customerData.markNotificationRead('provider-1', 'notification-1', 'read-key');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Idempotency-Key')).toBe('retry-key');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ expected_revision: 3, approver_name: 'Asha Rao', approver_role: 'Facilities Manager', authority_attested: true });
    expect(fetchMock.mock.calls[1][0]).toContain('/notifications/notification-1/read');
  });

  it('loads quotation conversations and posts a revision-bound idempotent customer message', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await customerData.quotationCommunications('provider-1', 'quotation-1');
    await customerData.createQuotationCommunication('provider-1', 'quotation-1', {
      expected_revision: 4,
      message_type: 'CHANGE_REQUEST',
      body: 'Please clarify the handover date.',
    }, 'message-retry-key');
    await customerData.quotationProviderLogo('provider-1', 'quotation-1');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/quotations/quotation-1/communications');
    expect(String(fetchMock.mock.calls[0][0])).toContain('sort=created_at,id');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST' });
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('Idempotency-Key')).toBe('message-retry-key');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      expected_revision: 4,
      message_type: 'CHANGE_REQUEST',
      body: 'Please clarify the handover date.',
    });
    expect(String(fetchMock.mock.calls[2][0])).toContain('/quotations/quotation-1/provider-logo');
  });

  it('reuses short-lived notification reads and refreshes when requested', async () => {
    const providerId = `notification-cache-${crypto.randomUUID()}`;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));

    await Promise.all([customerData.notifications(providerId), customerData.notifications(providerId)]);
    await customerData.notifications(providerId);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await customerData.markNotificationRead(providerId, 'notification-1', 'read-key');
    await customerData.notifications(providerId);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await customerData.notifications(providerId, true);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe('customer installation project reads', () => {
  it('normalizes wrapped JSON:API collection resources', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      data: [
        { data: { type: 'service-cases', id: 'case-1', attributes: { title: 'Lift A', status: 'OPEN' } } },
        { type: 'service-cases', id: 'case-2', attributes: { title: 'Lift B', status: 'OPEN' } }
      ]
    }), { status: 200 }));

    const result = await customerData.installationProjects('provider-1');
    expect(result.data.map((item) => item.id)).toEqual(['case-1', 'case-2']);
    expect(result.data[0].attributes.title).toBe('Lift A');
  });
});

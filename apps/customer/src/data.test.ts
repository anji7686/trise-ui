import { afterEach, describe, expect, it, vi } from 'vitest';
import { assetDisplaySubtitle, buildBookingPayload, buildPreferredWindow, customerData } from './data';

afterEach(() => vi.restoreAllMocks());

describe('customer asset presentation', () => {
  it('shows a supplied asset code and hides internal definition version details', () => {
    expect(assetDisplaySubtitle('AST-0084')).toBe('AST-0084');
    expect(assetDisplaySubtitle('  ')).toBe('Asset code not supplied');
  });
});

describe('customer booking contract', () => {
  it('builds a booking request from authorized records without internal request-type identifiers', () => {
    const payload = buildBookingPayload({ summary: 'Annual service', customerRelationshipId: 'relationship-1', assetId: 'asset-1', locationId: 'location-1', serviceTypeId: 'service-1', startsAt: '2026-09-29T09:00:00.000Z', endsAt: '2026-09-29T10:00:00.000Z' });
    expect(payload).toMatchObject({ asset_id: 'asset-1', location_id: 'location-1', service_type_id: 'service-1' });
    expect(payload).not.toHaveProperty('request_type_id');
    expect(payload.requested_window).not.toHaveProperty('time_zone');
  });

  it('converts preferred India visit windows to explicit RFC3339 instants and omits ASAP bookings', () => {
    expect(buildPreferredWindow('2026-11-02', '09:00-12:00')).toEqual({
      starts_at: '2026-11-02T03:30:00.000Z',
      ends_at: '2026-11-02T06:30:00.000Z',
    });
    expect(buildPreferredWindow('2026-11-02', 'ASAP')).toBeUndefined();
  });

  it('loads an appointment detail in the linked provider context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ id: 'booking-1', type: 'service-bookings', attributes: {} }), { status: 200 }));
    const booking = await customerData.booking('provider-booking', 'booking-1');
    expect(booking.id).toBe('booking-1');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/service-bookings/booking-1');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-booking');
  });

  it('sends revision-safe appointment changes in the selected provider context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ id: 'booking-1', type: 'service-bookings', attributes: { status: 'RESCHEDULED', revision: 3 } }), { status: 200 }));
    await customerData.rescheduleAppointment('provider-booking', 'booking-1', { expected_revision: 2, starts_at: '2026-10-31T05:30:00.000Z', ends_at: '2026-10-31T06:30:00.000Z' }, 'reschedule-key');
    await customerData.cancelAppointment('provider-booking', 'booking-1', { expected_revision: 3, reason: 'Customer request' }, 'cancel-key');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/appointments/booking-1/reschedule');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/appointments/booking-1/cancel');
    expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual(['POST', 'POST']);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ expected_revision: 2, starts_at: '2026-10-31T05:30:00.000Z', ends_at: '2026-10-31T06:30:00.000Z' });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ expected_revision: 3, reason: 'Customer request' });
    expect(fetchMock.mock.calls.map(([, init]) => new Headers(init?.headers).get('Idempotency-Key'))).toEqual(['reschedule-key', 'cancel-key']);
    for (const [, init] of fetchMock.mock.calls) expect(new Headers(init?.headers).get('X-TRISE-Provider-Id')).toBe('provider-booking');
  });

  it('loads upcoming confirmed bookings in the supported bounded provider scope', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await customerData.upcomingBookings('provider-upcoming', { limit: 100, after: 'next-page' }, '2026-10-29T00:00:00.000Z', '2026-11-29T00:00:00.000Z');
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toContain('/service-bookings');
    expect(url.searchParams.get('page[after]')).toBe('next-page');
    expect(url.searchParams.getAll('filter[status][]')).toEqual(['CONFIRMED', 'RESCHEDULED']);
    expect(url.searchParams.get('filter[starts_at_gte]')).toBe('2026-10-29T00:00:00.000Z');
    expect(url.searchParams.get('filter[starts_at_lt]')).toBe('2026-11-29T00:00:00.000Z');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-upcoming');
  });

  it('updates an asset display name with its expected revision and provider context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ id: 'asset-1', type: 'assets', attributes: { name: 'Updated Lift' }, relationships: {} }), { status: 200 }));
    const updated = await customerData.updateAsset('provider-asset', 'asset-1', { name: 'Updated Lift', expected_revision: 7 }, 'asset-name-change-1');
    const request = fetchMock.mock.calls[0];
    expect(updated.attributes.name).toBe('Updated Lift');
    expect(String(request[0])).toContain('/assets/asset-1');
    expect(request[1]?.method).toBe('PATCH');
    expect(new Headers(request[1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-asset');
    expect(new Headers(request[1]?.headers).get('Idempotency-Key')).toBe('asset-name-change-1');
    expect(JSON.parse(String(request[1]?.body))).toEqual({ name: 'Updated Lift', expected_revision: 7 });
  });

  it('resolves an asset code with the required idempotency and provider context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ status: 'RESOLVED', resource_type: 'assets', resource: { id: 'asset-code-1', type: 'assets', attributes: { name: 'Passenger Lift' }, relationships: {} } }), { status: 200 }));
    const resolved = await customerData.resolveIdentifier('provider-code', 'AST-0084', 'identifier-lookup-1');
    const request = fetchMock.mock.calls[0];
    expect(resolved.resource?.id).toBe('asset-code-1');
    expect(String(request[0])).toContain('/identifier-resolutions');
    expect(request[1]?.method).toBe('POST');
    expect(new Headers(request[1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-code');
    expect(new Headers(request[1]?.headers).get('Idempotency-Key')).toBe('identifier-lookup-1');
    expect(JSON.parse(String(request[1]?.body))).toEqual({ identifier: 'AST-0084', resource_hint: 'auto', provider_context_id: 'provider-code' });
  });
});

describe('customer service request safety signal', () => {
  it('persists the customer-reported concern in the selected provider context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ id: 'request-1', type: 'service-requests', attributes: { customer_emergency_signal: true }, relationships: {} }), { status: 201 }));
    const request = await customerData.createRequest('provider-request', {
      summary: 'Lift door issue', customer_relationship_id: 'relationship-1', asset_id: 'asset-1',
      location_id: 'location-1', service_type_id: 'service-1', request_type_id: 'REPAIR',
      customer_emergency_signal: true,
    }, 'request-key');
    const [url, init] = fetchMock.mock.calls[0];
    expect(request.attributes.customer_emergency_signal).toBe(true);
    expect(String(url)).toContain('/service-requests');
    expect(JSON.parse(String(init?.body))).toMatchObject({ customer_emergency_signal: true });
    expect(new Headers(init?.headers).get('X-TRISE-Provider-Id')).toBe('provider-request');
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('request-key');
  });
});

describe('customer cursor pagination', () => {
  it('defaults paged asset collections to 10 and forwards opaque cursors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: [], page: { limit: 10, next: 'opaque-next', previous: null } }), { status: 200 }));

    await customerData.assets('provider-page-default');
    const firstPage = new URL(String(fetchMock.mock.calls[0][0]));
    expect(firstPage.searchParams.get('page[limit]')).toBe('10');

    await customerData.assets('provider-page-next', { after: 'opaque cursor/value' });
    const nextPage = new URL(String(fetchMock.mock.calls[1][0]));
    expect(nextPage.searchParams.get('page[limit]')).toBe('10');
    expect(nextPage.searchParams.get('page[after]')).toBe('opaque cursor/value');
  });

  it('can scope customer documents to one asset for the asset detail tab', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await customerData.documents('provider-docs', { limit: 15 }, 'asset-docs');
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toContain('/documents');
    expect(url.searchParams.get('filter[source_id]')).toBe('asset-docs');
    expect(url.searchParams.get('page[limit]')).toBe('15');
  });

  it('filters customer visible documents by a linked service report', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await customerData.documents('provider-report', { limit: 15 }, 'report-42');
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toContain('/documents');
    expect(url.searchParams.get('filter[source_id]')).toBe('report-42');
  });

  it('loads only the customer-safe preview for a visible service report document', async () => {
    const preview = { id: 'report-42', type: 'customer-service-report-previews', attributes: { provider_name: 'Lift Rise', title: 'Preventive visit', summary: 'Preventive visit', work_performed: 'Checked doors.', observations: null, asset_name: null, site_name: 'Maple Heights', technician_name: null, service_date: '2026-10-29T10:00:00Z', submitted_at: '2026-10-29T10:30:00Z', version: 1 } };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: preview }), { status: 200 }));
    const result = await customerData.customerDocumentPreview('provider-report', 'document-42');
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toContain('/documents/document-42/customer-preview');
    expect(result.data?.attributes.work_performed).toBe('Checked doors.');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-report');
  });
});

describe('customer mutation contracts', () => {
  it('revokes other account sessions without a provider context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    await customerData.revokeOtherSessions();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/sessions/revoke');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ scope: 'others' });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBeNull();
  });

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

    await customerData.notifications(providerId, true, { limit: 100 }, true);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const unreadUrl = new URL(String(fetchMock.mock.calls[4][0]));
    expect(unreadUrl.searchParams.get('page[limit]')).toBe('100');
    expect(unreadUrl.searchParams.get('filter[unread]')).toBe('true');
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

  it('loads authorized project and coverage detail records in the provider context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: { id: 'record-1', type: 'record', attributes: {} } }), { status: 200 }));
    const project = await customerData.installationProject('provider-detail', 'case-detail');
    await customerData.job('provider-detail', 'job-detail');
    await customerData.warranty('provider-detail', 'warranty-detail');
    await customerData.contract('provider-detail', 'contract-detail');
    expect(project.id).toBe('record-1');
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('/service-cases/case-detail'),
      expect.stringContaining('/service-jobs/job-detail'),
      expect.stringContaining('/warranties/warranty-detail'),
      expect.stringContaining('/maintenance-contracts/contract-detail'),
    ]);
    for (const [, init] of fetchMock.mock.calls) expect(new Headers(init?.headers).get('X-TRISE-Provider-Id')).toBe('provider-detail');
  });
});

describe('customer service feedback', () => {
  it('loads completed customer jobs with the authorized status filter', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await customerData.jobs('provider-feedback', { limit: 100 }, 'COMPLETED');
    const request = new URL(String(fetchMock.mock.calls[0][0]));
    expect(request.pathname).toContain('/service-jobs');
    expect(request.searchParams.get('filter[status]')).toBe('COMPLETED');
    expect(request.searchParams.get('page[limit]')).toBe('100');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-feedback');
  });

  it('reads feedback and submits a job-bound idempotent rating', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await customerData.feedback('provider-feedback', { limit: 50 });
    await customerData.submitFeedback('provider-feedback', 'job-feedback', { rating: 5, comment: 'On time and helpful.' }, 'feedback-retry-key');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/feedback?page%5Blimit%5D=50');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/service-jobs/job-feedback/feedback');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST' });
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('Idempotency-Key')).toBe('feedback-retry-key');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ rating: 5, comment: 'On time and helpful.' });
    for (const [, init] of fetchMock.mock.calls) expect(new Headers(init?.headers).get('X-TRISE-Provider-Id')).toBe('provider-feedback');
  });
});

describe('customer account experience reads and preferences', () => {
  it('loads scoped membership invitations and accepts only through the selected provider context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await customerData.membershipInvitations('provider-members');
    await customerData.serviceLocation('provider-members', 'place-1');
    await customerData.acceptMembershipInvitation('provider-members', 'invite-1');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/resource-membership-invitations');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/service-locations/place-1');
    expect(String(fetchMock.mock.calls[2][0])).toContain('/resource-membership-invitations/invite-1/accept');
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: 'POST', body: '{}' });
    for (const [, init] of fetchMock.mock.calls) expect(new Headers(init?.headers).get('X-TRISE-Provider-Id')).toBe('provider-members');
  });

  it('loads places, memberships, timeline and preferences only in the supplied provider context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await customerData.locations('provider-account-1', { limit: 25 });
    await customerData.locations('provider-account-1', { limit: 15 }, { query: 'Maple Heights', classification: 'BUILDING' });
    await customerData.resourceMemberships('provider-account-1', { limit: 25 });
    await customerData.timeline('provider-account-1', { limit: 25 });
    await customerData.timelineForSource('provider-account-1', 'job-account-1');
    await customerData.notificationPreferences('provider-account-1');

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(expect.arrayContaining([
      expect.stringContaining('/locations?page%5Blimit%5D=25'),
      expect.stringContaining('filter%5Bq%5D=Maple+Heights'),
      expect.stringContaining('filter%5Bclassification%5D=BUILDING'),
      expect.stringContaining('/resource-memberships?page%5Blimit%5D=25'),
      expect.stringContaining('/timeline?page%5Blimit%5D=25'),
      expect.stringContaining('/timeline?page%5Blimit%5D=25&filter%5Bsource_id%5D=job-account-1'),
      expect.stringContaining('/notification-preferences?page[limit]=100'),
    ]));
    for (const [, init] of fetchMock.mock.calls) expect(new Headers(init?.headers).get('X-TRISE-Provider-Id')).toBe('provider-account-1');
  });

  it('loads only the designated support contact for the supplied customer provider relationship', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: null }), { status: 200 }));
    await customerData.supportContact('provider/account-1');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/providers/provider%2Faccount-1/support-contact');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider/account-1');
  });

  it('filters assets to the authorized service location for place details', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await customerData.assets('provider-account-3', { limit: 15 }, { locationId: 'service-location-1', query: 'Passenger Lift' });
    expect(String(fetchMock.mock.calls[0][0])).toContain('filter%5Blocation_id%5D=service-location-1');
    expect(String(fetchMock.mock.calls[0][0])).toContain('filter%5Bq%5D=Passenger+Lift');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-account-3');
  });

  it('filters quotations by exact quotation number and repeats status values', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await customerData.quotations('provider-quotes', { limit: 15 }, { quotationId: 'Q-2026-001', status: ['ISSUED', 'VIEWED'] });
    const request = new URL(String(fetchMock.mock.calls[0][0]));
    expect(request.searchParams.get('page[limit]')).toBe('15');
    expect(request.searchParams.get('filter[quotation_id]')).toBe('Q-2026-001');
    expect(request.searchParams.getAll('filter[status][]')).toEqual(['ISSUED', 'VIEWED']);
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-quotes');
  });

  it('updates only the selected preference revision', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { id: 'preference-1' } }), { status: 200 }));
    await customerData.updateNotificationPreference('provider-account-2', 'preference-1', { enabled: false, expected_revision: 1793203232 });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/notification-preferences/preference-1');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PATCH' });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ enabled: false, expected_revision: 1793203232 });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-account-2');
  });

  it('reads only available customer preference options in the selected provider context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    await customerData.notificationPreferenceOptions('provider-account-3');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/notification-preference-options');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-account-3');
  });

  it('sets an available customer preference and sends the expected revision', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { id: 'preference-2' } }), { status: 200 }));
    await customerData.setNotificationPreference('provider-account-4', { category: 'SERVICE', channel: 'EMAIL', enabled: false, expected_revision: null }, 'notification-pref-save-1');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/notification-preferences');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Idempotency-Key')).toBe('notification-pref-save-1');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ category: 'SERVICE', channel: 'EMAIL', enabled: false, expected_revision: null });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-account-4');
  });
});

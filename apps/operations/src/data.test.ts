import { afterEach, describe, expect, it, vi } from 'vitest';
import { operationsData } from './data';

afterEach(() => vi.restoreAllMocks());

describe('operations execution contracts', () => {
  it('keeps subscription evidence review platform-scoped and idempotent', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: { id: 'request-1', attributes: {} } }), { status: 200 }));

    await operationsData.platformSubscriptionRequest('request-1');
    await operationsData.reviewPlatformSubscriptionEvidence('request-1', 'evidence-1', { decision: 'VERIFIED' }, 'evidence-review-1');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/platform/subscription-requests/request-1');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/evidence/evidence-1/review');
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('Idempotency-Key')).toBe('evidence-review-1');
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('X-TRISE-Provider-Id')).toBeNull();
  });

  it('keeps provider business-profile reads and mutations provider-scoped and idempotent', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: { provider_id: 'provider-1', revision: 2, profile: { legal_name: 'Lift Rise' }, verification_status: 'NOT_SUBMITTED' } }), { status: 200 }));

    await operationsData.providerBusinessProfile('provider-1');
    await operationsData.updateProviderBusinessProfile('provider-1', { business_profile: { legal_name: 'Lift Rise', address: {}, contact_point_ids: [] }, expected_revision: 2 }, 'business-profile-save-1');
    await operationsData.submitProviderBusinessProfile('provider-1', 3, 'business-profile-submit-1');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/providers/business-profile');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-1');
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('Idempotency-Key')).toBe('business-profile-save-1');
    expect(new Headers(fetchMock.mock.calls[2][1]?.headers).get('Idempotency-Key')).toBe('business-profile-submit-1');
  });

  it('keeps provider document metadata and exact-version review provider-scoped', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: [], page: { next: null, previous: null } }), { status: 200 }));
    await operationsData.providerDocuments('provider-1');
    await operationsData.submitProviderDocumentReview('provider-1', 'document-1', 'version-1', 'document-review-1');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/documents?page[limit]=25');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-1');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/documents/document-1/versions/version-1/reviews');
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('Idempotency-Key')).toBe('document-review-1');
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-1');
  });

  it('uses only supported platform directory filters and bounded cursors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: [], page: { next: 'cursor-2', previous: null } }), { status: 200 }));

    await operationsData.platformProviders({ q: 'Lift Rise', status: 'ACTIVE', after: 'cursor-1' });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('page%5Blimit%5D=25');
    expect(url).toContain('q=Lift+Rise');
    expect(url).toContain('filter%5Bstatus%5D=ACTIVE');
    expect(url).toContain('page%5Bafter%5D=cursor-1');
  });

  it('keeps platform overview and detail reads separate from provider context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: { id: 'provider-1', attributes: { status: 'ACTIVE' } } }), { status: 200 }));

    await operationsData.platformOverview();
    await operationsData.platformProvider('provider-1');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/platform/overview');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/platform/providers/provider-1');
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('X-TRISE-Provider-Id')).toBeNull();
  });

  it('uses platform-scoped business-profile actions without a provider header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: { provider_id: 'provider-1', revision: 3, profile: {}, verification_status: 'NOT_SUBMITTED' } }), { status: 200 }));
    await operationsData.updatePlatformBusinessProfile('provider-1', { business_profile: { legal_name: 'Lift Rise', address: {}, contact_point_ids: [] }, expected_revision: 2 }, 'platform-profile-1');
    await operationsData.submitPlatformBusinessProfile('provider-1', 3, 'platform-profile-submit-1');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/platform/providers/provider-1/business-profile');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBeNull();
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Idempotency-Key')).toBe('platform-profile-1');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/platform/providers/provider-1/business-profile/submit');
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('X-TRISE-Provider-Id')).toBeNull();
  });

  it('keeps provider-logo metadata and activation scoped to the intended authority', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: null }), { status: 200 }));
    await operationsData.platformLogo('provider-1');
    await operationsData.activatePlatformLogo('provider-1', { document_id: 'document-1', version_id: 'version-1' }, 'logo-activate-1');
    await operationsData.providerLogo('provider-1');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/platform/providers/provider-1/logo');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBeNull();
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('Idempotency-Key')).toBe('logo-activate-1');
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('X-TRISE-Provider-Id')).toBeNull();
    expect(String(fetchMock.mock.calls[2][0])).toContain('/providers/logo');
    expect(new Headers(fetchMock.mock.calls[2][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-1');
  });

  it('uses platform provider mutations without a provider context and with idempotency', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: { id: 'provider-1', attributes: { revision: 22 } } }), { status: 201 }));

    await operationsData.createPlatformProvider({ name: 'Lift Rise Demo', representation_kind: 'ORGANIZATION', provider_code: 'LIFT-RISE' }, 'provider-create-1');
    await operationsData.updatePlatformProvider('provider-1', { name: 'Lift Rise Updated', expected_revision: 22 }, 'provider-update-1');

    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBeNull();
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Idempotency-Key')).toBe('provider-create-1');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ name: 'Lift Rise Demo', representation_kind: 'ORGANIZATION' });
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('Idempotency-Key')).toBe('provider-update-1');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/platform/providers/provider-1');
  });

  it('keeps platform document initiation and exact-version finalization provider-scoped and idempotent', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ document: { id: 'document-1' }, version: { id: 'version-1' }, transfer: { url: 'https://private.invalid', method: 'PUT', headers: {}, expires_at: '2026-10-05T00:05:00Z' } }), { status: 201 }));

    await operationsData.createPlatformDocument('provider-1', { filename: 'evidence.pdf', media_type: 'application/pdf' }, 'document-create-1');
    await operationsData.finalizePlatformDocument('provider-1', 'document-1', { version_id: 'version-1', checksum: 'a'.repeat(64), size_bytes: 10 }, 'document-finalize-1');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/platform/providers/provider-1/documents');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/platform/providers/provider-1/documents/document-1/upload-finalization');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Idempotency-Key')).toBe('document-create-1');
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('Idempotency-Key')).toBe('document-finalize-1');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBeNull();
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('X-TRISE-Provider-Id')).toBeNull();
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({ version_id: 'version-1', size_bytes: 10 });
  });

  it('keeps provider onboarding contacts and offices platform-scoped with bounded reads and retries', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: { id: 'record-1', attributes: {} }, page: { next: null, previous: null } }), { status: 201 }));

    await operationsData.platformOnboardingContacts('provider-1');
    await operationsData.createPlatformOnboardingContact('provider-1', { display_name: 'Primary', designation: 'PRIMARY', responsibility_type: 'BUSINESS_CONTACT' }, 'contact-create-1');
    await operationsData.platformOnboardingLocations('provider-1');
    await operationsData.createPlatformOnboardingLocation('provider-1', { name: 'Registered office', location_kind: 'REGISTERED_OFFICE', address: { city: 'Bengaluru' } }, 'location-create-1');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/platform/providers/provider-1/onboarding/contacts?page[limit]=25');
    expect(String(fetchMock.mock.calls[2][0])).toContain('/platform/providers/provider-1/onboarding/locations?page[limit]=25');
    for (const [, init] of fetchMock.mock.calls.slice(1).filter(([, init]) => init?.method === 'POST')) {
      expect(new Headers(init?.headers).get('X-TRISE-Provider-Id')).toBeNull();
      expect(new Headers(init?.headers).get('Idempotency-Key')).toBeTruthy();
    }
  });

  it('uses the authenticated India PIN reference lookup without provider context', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: { pincode: '560001', found: true, ambiguous: false, state: 'Karnataka', district: 'Bengaluru Urban', post_offices: [] }, dataset: { retrieved_at: '2026-10-05T00:00:00Z' } }), { status: 200 }));
    await operationsData.indiaPincode('560001');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/reference-data/india/pincodes/560001');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBeNull();
  });

  it('uses persisted work-session pause and resume commands with revisions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ data: { id: 'session-1', attributes: { revision: 4 } } }), { status: 200 }));
    await operationsData.pauseWorkSession('provider-1', 'agent-1', 'session-1', { paused_at: '2026-10-02T10:00:00Z', expected_revision: 3 }, 'pause-1');
    await operationsData.resumeWorkSession('provider-1', 'agent-1', 'session-1', { resumed_at: '2026-10-02T10:05:00Z', expected_revision: 4 }, 'resume-1');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/work-sessions/session-1/pause');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/work-sessions/session-1/resume');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ expected_revision: 3 });
  });
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

  it('keeps property onboarding staged, provider-scoped, and idempotent', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ data: { id: 'location-1', attributes: { name: 'Green Meadows Walkthrough' } } }), { status: 201 })
    );

    await operationsData.createLocation('provider-1', {
      customer_relationship_id: 'relationship-1', classification: 'COMMUNITY', name: 'Green Meadows Walkthrough',
      address_lines: ['Green Meadows Demo District'], time_zone: 'Asia/Kolkata'
    }, '00000000-0000-4000-8000-000000000001');
    await operationsData.createAsset('provider-1', {
      name: 'Building A · Passenger Lift 01', asset_definition_id: 'definition-1', definition_version: 1,
      customer_relationship_id: 'relationship-1', owner_party_id: 'party-1', location_id: 'location-2', values: [], identifier_inputs: []
    }, '00000000-0000-4000-8000-000000000002');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/locations');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/assets');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ classification: 'COMMUNITY', name: 'Green Meadows Walkthrough' });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({ values: [], identifier_inputs: [] });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Idempotency-Key')).toBe('00000000-0000-4000-8000-000000000001');
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-1');
  });

  it('keeps direct audit detail reads provider-scoped', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ data: { id: 'event-1', attributes: { event_type: 'JOB_COMPLETED' } } }), { status: 200 })
    );

    await operationsData.timelineEntry('provider-2', 'event-1');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/timeline/event-1');
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('X-TRISE-Provider-Id')).toBe('provider-2');
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

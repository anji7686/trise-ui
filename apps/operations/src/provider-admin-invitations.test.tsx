import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { validInvitationExpiry, MyProviderAdminInvitations } from './provider-admin-invitations';
import { EvidenceReviewFeedback } from './subscription-review';
import { operationsData } from './data';

afterEach(() => vi.restoreAllMocks());
describe('approved administrator invitation and review contracts', () => {
  it('enforces future expiry and seven-day boundary', () => {
    const now = Date.parse('2026-10-11T00:00:00Z');
    expect(validInvitationExpiry('invalid', now)).toBe(false);
    expect(validInvitationExpiry('2026-10-11T00:00:00Z', now)).toBe(false);
    expect(validInvitationExpiry('2026-10-18T00:00:00Z', now)).toBe(true);
    expect(validInvitationExpiry('2026-10-18T00:00:01Z', now)).toBe(false);
  });
  it('uses identity-scoped acceptance with an idempotency key and revision', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    await operationsData.acceptProviderAdminInvitation('invite-1', { expected_revision: 3 }, 'accept-key');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/me/provider-admin-invitations/invite-1/accept');
    expect(new Headers(init?.headers).get('X-TRISE-Provider-Id')).toBeNull();
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('accept-key');
    expect(JSON.parse(String(init?.body))).toEqual({ expected_revision: 3 });
  });
  it('renders identity guidance and escaped review reasons with recorded time', () => {
    expect(renderToStaticMarkup(<MyProviderAdminInvitations onAccepted={async () => {}} />)).toContain('signed-in identity');
    const html = renderToStaticMarkup(<EvidenceReviewFeedback reviews={[{ id: 'review', decision: 'CORRECTIONS_REQUESTED', reason: '<script>bad</script>', reviewed_at: '2026-10-11T00:00:00Z' }]} />);
    expect(html).toContain('CORRECTIONS REQUESTED');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('dateTime="2026-10-11T00:00:00Z"');
    expect(html).not.toContain('<script>');
  });
});

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PlatformProviderAttributes, PlatformSubscription, PlatformSubscriptionChange, PlatformSubscriptionInvoice, PlatformSubscriptionRequest, PlatformUsage, Resource, SubscriptionValidity } from './data';
import { SubscriptionAlerts, SubscriptionHistory, subscriptionAlerts, subscriptionMilestones } from './subscription-insights';
import { providerReadiness } from './provider-readiness';

const resource = <T,>(id: string, attributes: T): Resource<T> => ({ id, type: 'test', attributes, relationships: {} });
const validity = (state: string, days: number) => ({ state, remaining_days: days } as SubscriptionValidity);
const usage: PlatformUsage = { provider_id: 'p', observed_at: '2026-10-10T00:00:00Z', calculation_policy_version: '1', metrics: {
  AGENT_COUNT: { value: 8, components: {}, limit: { value: 10, unlimited: false }, remaining: 2, exceeded: false },
  MANAGED_ASSET_COUNT: { value: 250, components: {}, limit: { value: null, unlimited: true }, exceeded: false }
} };

describe('subscription attention', () => {
  it('uses API validity and excludes unlimited capacity from warnings', () => {
    expect(subscriptionAlerts(validity('VALID', 15), usage)).toEqual([
      'Subscription expires in 15 days. Review renewal options.',
      'Agent Count is approaching the included limit (8 / 10).'
    ]);
    expect(subscriptionAlerts(validity('SCHEDULED', 0))).toEqual([]);
    expect(subscriptionAlerts(validity('EXPIRED', 0))[0]).toContain('expired');
    expect(subscriptionAlerts(validity('VALID', 60))).toEqual([]);
  });
  it('shows reached and exceeded zero limits without division artifacts', () => {
    const data = { ...usage, metrics: { AGENT_COUNT: { ...usage.metrics.AGENT_COUNT, value: 0, limit: { value: 0, unlimited: false } } } };
    expect(subscriptionAlerts(undefined, data)[0]).toContain('has reached');
    data.metrics.AGENT_COUNT.value = 1; data.metrics.AGENT_COUNT.exceeded = true;
    expect(subscriptionAlerts(undefined, data)[0]).toContain('exceeds');
  });
  it('renders a clear on-screen warning with its observation time', () => {
    const html = renderToStaticMarkup(<SubscriptionAlerts validity={validity('EXPIRED', 0)} usage={usage} />);
    expect(html).toContain('Subscription attention'); expect(html).toContain('on-screen reminders'); expect(html).toContain('Usage observed');
    expect(renderToStaticMarkup(<SubscriptionAlerts />)).toBe('');
  });
});

describe('subscription timeline truthfulness', () => {
  const subscription = resource('s', { effective_from: '2026-09-01T00:00:00Z', status: 'ACTIVE' } as PlatformSubscription);
  const request = resource('r', { requested_effective_from: '2026-09-01T00:00:00Z', status: 'APPROVED', decisions: [{ decision: 'APPROVED', decided_at: '2026-08-31T00:00:00Z' }], evidence: [resource('e', { review_state: 'VERIFIED', evidence_kind: 'TRANSACTION_REFERENCE' })] } as PlatformSubscriptionRequest);
  const change = resource('c', { change_kind: 'RENEWAL', status: 'SCHEDULED', requested_effective_at: '2026-10-01T00:00:00Z' } as PlatformSubscriptionChange);
  const invoice = resource('i', { invoice_number: 'INV-1', status: 'ISSUED', issued_at: '2026-09-01T00:00:00Z', due_at: '2026-09-07T00:00:00Z' } as PlatformSubscriptionInvoice);
  it('keeps requested dates separate from actual decisions and does not invent payment dates', () => {
    const events = subscriptionMilestones(subscription, [request], [change], [invoice]);
    expect(events[0].label).toBe('Renewal requested effective');
    expect(events.find((event) => event.label === 'Subscription review decision')?.at).toBe('2026-08-31T00:00:00Z');
    expect(events.some((event) => event.label.endsWith('paid'))).toBe(false);
    expect(events.some((event) => event.label === 'Payment evidence submitted')).toBe(false);
    expect(subscriptionMilestones(null, [], [], [resource('broken', { ...invoice.attributes, issued_at: 'invalid' })])).toEqual([]);
  });
  it('renders history limitations and current-state semantics', () => {
    const html = renderToStaticMarkup(<SubscriptionHistory subscription={subscription} requests={[request]} changes={[change]} invoices={[invoice]} />);
    expect(html).toContain('loaded provider pages'); expect(html).not.toContain('all available provider pages'); expect(html).toContain('not submission times'); expect(html).toContain('dateTime=');
  });
});

describe('provider checklist evidence', () => {
  it('does not infer administrator setup or activation from a verified business', () => {
    const provider = resource('p', { display_name: 'Provider', status: 'PENDING', business_verification_status: 'VERIFIED' } as PlatformProviderAttributes);
    const checklist = providerReadiness(provider, null, [], null, null);
    expect(checklist.find((item) => item.label === 'Administrator setup')?.status).toBe('Not available');
    expect(checklist.find((item) => item.label === 'Operational activation')?.status).toBe('PENDING');
    expect(checklist.find((item) => item.label === 'Contacts')?.status).toBe('Not available');
    expect(checklist.find((item) => item.label === 'Business verification')?.route).toBe('platform/providers/p/business-profile/edit');
  });
});

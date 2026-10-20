import { DetailSection } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import type { PlatformSubscription, PlatformSubscriptionChange, PlatformSubscriptionInvoice, PlatformSubscriptionRequest, PlatformUsage, ProviderSubscriptionSelfService, Resource, SubscriptionValidity } from './data';
import { formatIndiaDateTime } from './subscription-support';

const human = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
export type SubscriptionMilestone = { id: string; label: string; at: string; status: string; reason?: string | null };

export function subscriptionMilestones(subscription: Resource<PlatformSubscription> | null, requests: Resource<PlatformSubscriptionRequest>[], changes: Resource<PlatformSubscriptionChange>[], invoices: Resource<PlatformSubscriptionInvoice>[]): SubscriptionMilestone[] {
  const events: SubscriptionMilestone[] = [];
  if (subscription) events.push({ id: `subscription-${subscription.id}`, label: 'Subscription effective from', at: subscription.attributes.effective_from, status: subscription.attributes.status });
  for (const request of requests) {
    events.push({ id: `request-${request.id}`, label: 'Requested subscription start', at: request.attributes.requested_effective_from, status: request.attributes.status });
    request.attributes.decisions?.forEach((decision, index) => events.push({ id: `decision-${request.id}-${index}`, label: 'Subscription review decision', at: decision.decided_at, status: decision.decision }));
    request.attributes.evidence?.forEach((evidence) => { if (evidence.attributes.created_at) events.push({ id: `evidence-${evidence.id}`, label: 'Payment evidence submitted', at: evidence.attributes.created_at, status: evidence.attributes.review_state }); evidence.attributes.reviews?.forEach(review => events.push({ id: `evidence-review-${review.id}`, label: 'Payment evidence review', at: review.reviewed_at, status: review.decision, reason: review.reason })); });
  }
  for (const change of changes) events.push({ id: `change-${change.id}`, label: `${human(change.attributes.change_kind)} ${change.attributes.effective_at ? 'effective' : 'requested effective'}`, at: change.attributes.effective_at || change.attributes.requested_effective_at, status: change.attributes.status });
  for (const invoice of invoices) {
    events.push({ id: `invoice-${invoice.id}`, label: `Invoice ${invoice.attributes.invoice_number} issued`, at: invoice.attributes.issued_at, status: invoice.attributes.status });
    if (invoice.attributes.paid_at) events.push({ id: `paid-${invoice.id}`, label: `Invoice ${invoice.attributes.invoice_number} paid`, at: invoice.attributes.paid_at, status: 'PAID' });
  }
  return events.filter((event) => Number.isFinite(Date.parse(event.at))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id));
}

export function subscriptionAlerts(validity?: SubscriptionValidity, usage?: PlatformUsage | null): string[] {
  const alerts: string[] = [];
  if (validity?.state === 'EXPIRED') alerts.push('Subscription validity has expired. Review renewal options.');
  else if (validity?.state === 'VALID' && validity.remaining_days <= 30) alerts.push(`Subscription expires in ${validity.remaining_days} days. Review renewal options.`);
  for (const [key, metric] of Object.entries(usage?.metrics || {})) {
    if (!metric.limit || metric.limit.unlimited || metric.limit.value === null) continue;
    if (metric.exceeded) alerts.push(`${human(key)} exceeds the included limit (${metric.value} / ${metric.limit.value}).`);
    else if (metric.value >= metric.limit.value) alerts.push(`${human(key)} has reached the included limit (${metric.value} / ${metric.limit.value}).`);
    else if (metric.limit.value > 0 && metric.value / metric.limit.value >= 0.8) alerts.push(`${human(key)} is approaching the included limit (${metric.value} / ${metric.limit.value}).`);
  }
  return alerts;
}

export function SubscriptionAlerts({ validity, usage }: { validity?: SubscriptionValidity; usage?: PlatformUsage | null }) {
  const alerts = subscriptionAlerts(validity, usage);
  if (!alerts.length) return null;
  return <DetailSection title="Subscription attention" description="Capacity warnings start at 80% of the included limit; expiry warnings cover the next 30 days. These are on-screen reminders."><ul>{alerts.map((alert) => <li key={alert}>{alert}</li>)}</ul>{usage && <p className="platform-muted">Usage observed {formatIndiaDateTime(usage.observed_at)}.</p>}</DetailSection>;
}

export function SubscriptionHistory({ subscription, requests, changes, invoices }: { subscription: Resource<PlatformSubscription> | null; requests: Resource<PlatformSubscriptionRequest>[]; changes: Resource<PlatformSubscriptionChange>[]; invoices: Resource<PlatformSubscriptionInvoice>[] }) {
  const milestones = subscriptionMilestones(subscription, requests, changes, invoices);
  return <DetailSection title="Subscription timeline" description="Effective dates, available review decisions, payment evidence, and invoices. Status badges show current record state; effective dates are not submission times. Change and invoice history reflects loaded provider pages; use the separate loading controls for remaining history.">{milestones.length ? <ul className="platform-audit-list">{milestones.map((event) => <li key={event.id}><div><strong>{event.label}</strong><Status>{human(event.status)}</Status></div>{event.reason && <p>{event.reason}</p>}<time dateTime={event.at}>{formatIndiaDateTime(event.at)}</time></li>)}</ul> : <p className="platform-muted">No dated subscription records are available.</p>}</DetailSection>;
}

export function SubscriptionTimeline({ subscription, requests, changes, invoices }: { subscription: Resource<PlatformSubscription> | null; requests: Resource<PlatformSubscriptionRequest>[]; changes: Resource<PlatformSubscriptionChange>[]; invoices: Resource<PlatformSubscriptionInvoice>[] }) {
  const milestones = subscriptionMilestones(subscription, requests, changes, invoices);
  return <div className="subscription-timeline-dialog-content">
    <p className="platform-muted">Subscription events returned for this provider, ordered by their effective or recorded API date.</p>
    {milestones.length ? <ol className="subscription-timeline">{milestones.map((event) => <li key={event.id}>
      <time dateTime={event.at}>{formatIndiaDateTime(event.at)}</time>
      <span className="subscription-timeline-marker" aria-hidden="true" />
      <div className="subscription-timeline-event"><div><strong>{event.label}</strong><Status>{human(event.status)}</Status></div>{event.reason && <p>{event.reason}</p>}</div>
    </li>)}</ol> : <p className="platform-muted">No dated subscription records were returned.</p>}
  </div>;
}

export function ProviderSubscriptionHistory({ summary }: { summary: ProviderSubscriptionSelfService }) {
  const events: SubscriptionMilestone[] = [
    ...summary.requests.map((row) => ({ id: `request-${row.id}`, label: 'Requested subscription start', at: row.requested_effective_from, status: row.status })),
    ...summary.changes.map((row) => ({ id: `change-${row.id}`, label: `${human(row.change_kind)} requested effective`, at: row.requested_effective_at, status: row.status })),
    ...summary.invoices.map((row) => ({ id: `invoice-${row.id}`, label: `Invoice ${row.invoice_number} due`, at: row.due_at, status: row.collection_state }))
  ];
  if (summary.subscription) events.push({ id: summary.subscription.id, label: 'Subscription effective from', at: summary.subscription.effective_from, status: summary.subscription.status });
  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return <DetailSection title="Subscription timeline" description="Effective and invoice due dates from the provider summary. Badges show current states; these dates do not imply payment or approval occurred at that time. History is limited to the records returned by the API.">{events.length ? <ul className="platform-audit-list">{events.map((event) => <li key={event.id}><div><strong>{event.label}</strong><Status>{human(event.status)}</Status></div>{event.reason && <p>{event.reason}</p>}<time dateTime={event.at}>{formatIndiaDateTime(event.at)}</time></li>)}</ul> : <p>No dated records are available.</p>}</DetailSection>;
}

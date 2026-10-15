import type { PlatformSubscription, PlatformSubscriptionAddon, PlatformSubscriptionChange, PlatformSubscriptionRequest, Resource } from './data';

export function matchesSubscriptionHistory(row: { provider: string; status: string; date: string }, filter: { query: string; status: string; from: string; through: string }) {
  const date = row.date.slice(0, 10);
  return (!filter.status || row.status === filter.status) && row.provider.toLowerCase().includes(filter.query.trim().toLowerCase()) && (!filter.from || date >= filter.from) && (!filter.through || date <= filter.through);
}

export function transactionEvidencePayload(reference: string, amount: string, currency: string) {
  const external_reference = reference.trim();
  const stated_amount = amount.trim();
  const currency_code = currency.trim().toUpperCase();
  if (!external_reference || external_reference.length > 200) throw new Error('Enter a transaction reference of at most 200 characters.');
  if (stated_amount && (!Number.isFinite(Number(stated_amount)) || Number(stated_amount) < 0 || !/^[A-Z]{3}$/.test(currency_code))) throw new Error('Enter a nonnegative stated amount and its three-letter currency code.');
  return { evidence_kind: 'TRANSACTION_REFERENCE', external_reference, stated_amount: stated_amount || undefined, currency_code: stated_amount ? currency_code : undefined };
}

export function dueSubscriptionChanges(changes: Resource<PlatformSubscriptionChange>[], now = Date.now()) {
  return changes.filter(change => ['APPROVED', 'SCHEDULED'].includes(change.attributes.status) && Date.parse(change.attributes.requested_effective_at) <= now);
}

export function compatibleInvoiceAddons(addons: Resource<PlatformSubscriptionAddon>[], currency?: string) {
  if (!currency) return [];
  return addons.filter(addon => addon.attributes.status === 'ACTIVE').flatMap(addon => addon.attributes.versions.filter(version => version.status === 'PUBLISHED' && version.currency_code === currency).map(version => ({ ...version, name: addon.attributes.name })));
}

export function invoiceAddonPayload(quantities: Record<string, string>, versions: Array<{ id: string }>) {
  return Object.entries(quantities).filter(([, quantity]) => quantity !== '' && quantity !== '0').map(([addon_version_id, value]) => {
    const quantity = Number(value);
    if (!versions.some(version => version.id === addon_version_id) || !Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('Select published currency-compatible add-ons with positive integer quantities.');
    return { addon_version_id, quantity };
  });
}

export function subscriptionNextStep(subscription: Resource<PlatformSubscription> | null, request?: Resource<PlatformSubscriptionRequest>): string {
  if (subscription?.attributes.status === 'ACTIVE') return 'Monitor validity, usage and invoices. Request renewal or a plan change through the subscription manager.';
  if (!request) return 'Select a published plan and submit a subscription request for review.';
  if (request.attributes.status === 'PENDING_REVIEW') return 'Review the subscription request. Commercial approval and payment verification are separate decisions.';
  if (request.attributes.status === 'APPROVED') {
    const evidence = request.attributes.evidence;
    if (!evidence) return 'Open the approved request to inspect payment evidence before attempting activation.';
    if (evidence.some(item => item.attributes.review_state === 'VERIFIED')) return 'Request subscription activation. The backend checks eligibility; provider operational activation is a separate action.';
    if (evidence.some(item => item.attributes.review_state === 'EVIDENCE_SUBMITTED')) return 'Review the submitted payment evidence before attempting subscription activation.';
    return 'Append payment evidence or address requested corrections, then obtain verification before activation.';
  }
  return 'Review the recorded decision and submit a new request when appropriate.';
}

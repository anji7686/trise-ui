import { Button } from '@trise/ui';

export function requestConfirmationRoute(requestId: string): string {
  return `/request-success/${encodeURIComponent(requestId)}`;
}

export function isCustomerRequestId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function requestConfirmationBookingStatus(bookingCount: number): string {
  return bookingCount > 0 ? 'Awaiting provider confirmation' : 'A visit will be arranged after provider review';
}

export type CustomerRequestConfirmationProps = {
  reference: string;
  providerName: string;
  summary: string;
  bookingStatus: string;
  onViewServices: () => void;
  onHome: () => void;
};

export function CustomerRequestConfirmation({ reference, providerName, summary, bookingStatus, onViewServices, onHome }: CustomerRequestConfirmationProps) {
  return <section className="content customer-request-confirmation-page"><article className="detail-card customer-request-confirmation">
    <span className="customer-request-confirmation-check" aria-hidden="true">✓</span>
    <span className="customer-request-confirmation-eyebrow">Request received</span>
    <h1>You’re in good hands.</h1>
    <p>Your provider will review your request and confirm the next step.</p>
    <dl>
      <dt>Reference</dt><dd>{reference}</dd>
      <dt>Provider</dt><dd>{providerName}</dd>
      <dt>Request</dt><dd>{summary}</dd>
      <dt>Booking</dt><dd>{bookingStatus}</dd>
    </dl>
    <div className="inline-actions">
      <Button onClick={onViewServices}>→ View my services</Button>
      <Button variant="secondary" onClick={onHome}>Back home</Button>
    </div>
  </article></section>;
}

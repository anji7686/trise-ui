import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CustomerRequestConfirmation, isCustomerRequestId, requestConfirmationBookingStatus, requestConfirmationRoute } from './customer-request-confirmation';

describe('customer request confirmation', () => {
  it('creates a reloadable receipt route without exposing reserved URL characters', () => {
    expect(requestConfirmationRoute('request/with spaces')).toBe('/request-success/request%2Fwith%20spaces');
  });

  it('accepts server UUIDs and rejects malformed receipt identifiers', () => {
    expect(isCustomerRequestId('01a1855d-5806-71d0-895c-95ba78c180ff')).toBe(true);
    expect(isCustomerRequestId('not-a-customer-request')).toBe(false);
  });

  it('keeps the booking message honest when no appointment record was created', () => {
    expect(requestConfirmationBookingStatus(1)).toBe('Awaiting provider confirmation');
    expect(requestConfirmationBookingStatus(0)).toBe('A visit will be arranged after provider review');
  });

  it('shows the submitted request, provider review state and next destinations', () => {
    const html = renderToStaticMarkup(<CustomerRequestConfirmation
      reference="SR-261029-7F3A91BC2D604E8A"
      providerName="Lift Rise Elevators"
      summary="Routine service check"
      bookingStatus="Awaiting provider confirmation"
      onViewServices={vi.fn()}
      onHome={vi.fn()}
    />);

    expect(html).toContain('You’re in good hands.');
    expect(html).toContain('Your provider will review your request and confirm the next step.');
    expect(html).toContain('SR-261029-7F3A91BC2D604E8A');
    expect(html).toContain('Routine service check');
    expect(html).toContain('Awaiting provider confirmation');
    expect(html).not.toContain('<dt>Visit</dt>');
    expect(html).toContain('View my services');
    expect(html).toContain('Back home');
  });

  it('keeps booking status truthful for ASAP requests', () => {
    const html = renderToStaticMarkup(<CustomerRequestConfirmation
      reference="request-456"
      providerName="Service provider"
      summary="Passenger lift stopped"
      bookingStatus="A visit will be arranged after provider review"
      onViewServices={() => undefined}
      onHome={() => undefined}
    />);

    expect(html).toContain('A visit will be arranged after provider review');
    expect(html).not.toContain('Visit confirmed');
  });
});

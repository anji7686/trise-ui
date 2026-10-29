import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CustomerRequestContext } from './customer-request-context';

describe('customer request context', () => {
  it('shows the resolved provider, signed-in customer and truthful update channel', () => {
    const markup = renderToStaticMarkup(<CustomerRequestContext providerName="Lift Rise Elevators" customerName="Demo Community Customer" />);
    expect(markup).toContain('Service provider</dt><dd>Lift Rise Elevators');
    expect(markup).toContain('Your profile</dt><dd>Demo Community Customer');
    expect(markup).toContain('Updates</dt><dd>In-app');
    expect(markup).toContain('Requests, visits, reports and coverage stay linked to the same asset.');
    expect(markup).not.toContain('email');
  });

  it('uses an account fallback when the display name is unavailable', () => {
    expect(renderToStaticMarkup(<CustomerRequestContext providerName="Service provider" customerName="" />)).toContain('Your customer account');
  });
});

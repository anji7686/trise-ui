import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CustomerRequestReview } from './customer-request-review';

const props = {
  assetName: 'Passenger lift A', serviceType: 'Lift breakdown repair', issue: 'Unusual noise', description: 'Door makes a grinding sound',
  details: 'The sound is strongest on level 3.', preferredDate: '2026-10-30', preferredWindow: '09:00–12:00',
  safetyConcern: true, providerName: 'Lift Rise Elevators', formatDate: () => '30 Oct 2026',
};

describe('customer request review', () => {
  it('uses the prototype review hierarchy and preserves all entered request details', () => {
    const markup = renderToStaticMarkup(<CustomerRequestReview {...props} />);
    for (const value of [
      'A quick check before sending.', 'Your request goes to Lift Rise Elevators.', 'Asset', 'Passenger lift A',
      'Service type', 'Lift breakdown repair', 'Issue', 'Unusual noise', 'Description', 'Door makes a grinding sound', 'More details',
      'The sound is strongest on level 3.', 'Preferred date', '30 Oct 2026', 'Preferred window',
      '09:00–12:00', 'Safety concern', 'Reported for assessment',
      'Your provider will review coverage, priority and the requested window before confirming the next step.',
    ]) expect(markup).toContain(value);
  });

  it('does not imply a date preference when the customer selected ASAP', () => {
    const markup = renderToStaticMarkup(<CustomerRequestReview {...props} preferredDate="" preferredWindow="As soon as possible" />);
    expect(markup).toContain('No date preference');
    expect(markup).toContain('As soon as possible');
    expect(markup).not.toContain('30 Oct 2026');
  });

  it('states when no safety concern was reported and omits blank details', () => {
    const markup = renderToStaticMarkup(<CustomerRequestReview {...props} details="" safetyConcern={false} />);
    expect(markup).toContain('Not reported');
    expect(markup).not.toContain('<dt>More details</dt>');
  });
});

import type { ReactNode } from 'react';

export type CustomerRequestReviewProps = {
  assetName: string;
  serviceType: string;
  issue: string;
  description: string;
  details: string;
  preferredDate: string;
  preferredWindow: string;
  safetyConcern: boolean;
  providerName: string;
  formatDate: (value: string) => string;
};

export function CustomerRequestReview({ assetName, serviceType, issue, description, details, preferredDate, preferredWindow, safetyConcern, providerName, formatDate }: CustomerRequestReviewProps): ReactNode {
  return <div className="customer-request-step">
    <h3>A quick check before sending.</h3>
    <p className="muted small">Your request goes to {providerName}.</p>
    <dl>
      <dt>Asset</dt><dd>{assetName}</dd>
      <dt>Service type</dt><dd>{serviceType}</dd>
      <dt>Issue</dt><dd>{issue}</dd>
      <dt>Description</dt><dd>{description}</dd>
      {details && <><dt>More details</dt><dd>{details}</dd></>}
      <dt>Preferred date</dt><dd>{preferredDate ? formatDate(preferredDate) : 'No date preference'}</dd>
      <dt>Preferred window</dt><dd>{preferredWindow}</dd>
      <dt>Safety concern</dt><dd>{safetyConcern ? 'Reported for assessment' : 'Not reported'}</dd>
    </dl>
    <p className="notice">Your provider will review coverage, priority and the requested window before confirming the next step.</p>
  </div>;
}

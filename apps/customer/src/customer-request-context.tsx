import type { ReactNode } from 'react';

export function CustomerRequestContext({ providerName, customerName }: { providerName: string; customerName: string }): ReactNode {
  return <>
    <h3>Your service, connected</h3>
    <dl>
      <dt>Service provider</dt><dd>{providerName}</dd>
      <dt>Your profile</dt><dd>{customerName || 'Your customer account'}</dd>
      <dt>Updates</dt><dd>In-app</dd>
    </dl>
    <div className="divider" />
    <p>Requests, visits, reports and coverage stay linked to the same asset.</p>
  </>;
}

import { useEffect, useState } from 'react';
import { Button } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { OnboardingEmptyState, OnboardingReviewSection } from './provider-onboarding-ui';
import { activationBlocker, lifecycleActions } from './provider-lifecycle';
import { collectPages, formatIndiaDateTime } from './subscription-support';
import { formatBusinessProviderReferenceCode, operationsData, type PlatformPlan, type PlatformProviderAttributes, type PlatformSubscription, type PlatformSubscriptionRequest, type ProviderAdminInvitation, type ProviderBusinessProfile, type ProviderDocument, type ProviderOfficeLocationAttributes, type ProviderOnboardingContactAttributes, type ProviderVerificationReview, type Resource } from './data';

const human = (value?: string | null) => value ? value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : 'Not available';
const date = (value?: string | null) => value ? formatIndiaDateTime(value) : 'Not recorded';
const open = (route: string) => { window.location.hash = route; };

type ReviewReadiness = {
  contacts: Resource<ProviderOnboardingContactAttributes>[] | null;
  locations: Resource<ProviderOfficeLocationAttributes>[] | null;
  subscription: Resource<PlatformSubscription> | null;
  requests: Resource<PlatformSubscriptionRequest>[] | null;
  plans: Resource<PlatformPlan>[];
  invitations: ProviderAdminInvitation[] | null;
  loading: boolean;
  errors: Record<string, string>;
};

export function ProviderOnboardingReviewDashboard({ provider, business, documents, reviews, capabilities, onIssueCodes, onRegenerateSuggestions }: { provider: Resource<PlatformProviderAttributes>; business: ProviderBusinessProfile | null; documents: ProviderDocument[]; reviews: ProviderVerificationReview[]; capabilities: string[]; onIssueCodes: () => Promise<void>; onRegenerateSuggestions: (reason: string) => Promise<void> }) {
  const [data, setData] = useState<ReviewReadiness>({ contacts: null, locations: null, subscription: null, requests: null, plans: [], invitations: null, loading: true, errors: {} });
  const [reloadToken, setReloadToken] = useState(0);
  const [issuingCodes, setIssuingCodes] = useState(false);
  const [issueCodeError, setIssueCodeError] = useState('');
  const [regeneratingCodes, setRegeneratingCodes] = useState(false);
  const [regenerationReason, setRegenerationReason] = useState('');
  const [regenerationError, setRegenerationError] = useState('');
  const canReadContacts = capabilities.some(capability => ['PLATFORM_PROVIDER_REGISTER', 'PLATFORM_PROVIDER_PROFILE_WRITE', 'PLATFORM_PROVIDER_BUSINESS_WRITE', 'PLATFORM_PROVIDER_ONBOARD'].includes(capability));
  const canReadSubscriptions = capabilities.includes('PLATFORM_SUBSCRIPTION_READ');
  const canReadPlans = capabilities.includes('PLATFORM_PLAN_READ');
  const canReadInvitations = capabilities.includes('PLATFORM_PROVIDER_ADMIN_INVITE');

  useEffect(() => {
    let cancelled = false;
    setData(previous => ({ ...previous, loading: true, errors: {} }));
    const reads = Promise.allSettled([
      canReadContacts ? collectPages(after => operationsData.platformOnboardingContacts(provider.id, after)) : Promise.resolve(null),
      canReadContacts ? collectPages(after => operationsData.platformOnboardingLocations(provider.id, after)) : Promise.resolve(null),
      canReadSubscriptions ? collectPages(after => operationsData.platformSubscriptions({ providerId: provider.id, after })) : Promise.resolve(null),
      canReadSubscriptions ? collectPages(after => operationsData.platformSubscriptionRequests({ providerId: provider.id, after })) : Promise.resolve(null),
      canReadPlans ? collectPages(after => operationsData.platformPlans({ status: 'ACTIVE', after })) : Promise.resolve(null),
      canReadInvitations ? operationsData.platformProviderAdminInvitations(provider.id) : Promise.resolve(null),
    ] as const);
    void reads.then(([contacts, locations, subscriptions, requests, plans, invitations]) => {
      if (cancelled) return;
      const errors: Record<string, string> = {};
      if (contacts.status === 'rejected') errors.contacts = 'Provider contacts could not be loaded.';
      if (locations.status === 'rejected') errors.locations = 'Office locations could not be loaded.';
      if (subscriptions.status === 'rejected') errors.subscription = 'Subscription records could not be loaded.';
      if (requests.status === 'rejected') errors.requests = 'Subscription requests could not be loaded.';
      if (plans.status === 'rejected') errors.plans = 'Published plan details could not be loaded.';
      if (invitations.status === 'rejected') errors.invitations = 'Administrator invitations could not be loaded.';
      const subscriptionRows = subscriptions.status === 'fulfilled' ? subscriptions.value : null;
      setData({
        contacts: contacts.status === 'fulfilled' ? contacts.value : null,
        locations: locations.status === 'fulfilled' ? locations.value : null,
        subscription: subscriptionRows?.find(row => row.attributes.status === 'ACTIVE') || subscriptionRows?.[0] || null,
        requests: requests.status === 'fulfilled' ? requests.value : null,
        plans: plans.status === 'fulfilled' ? plans.value || [] : [],
        invitations: invitations.status === 'fulfilled' ? invitations.value?.data || [] : null,
        loading: false,
        errors,
      });
    });
    return () => { cancelled = true; };
  }, [provider.id, canReadContacts, canReadSubscriptions, canReadPlans, canReadInvitations, reloadToken]);

  const attributes = provider.attributes;
  const verification = business?.verification_status || attributes.business_verification_status;
  const canIssueCodes = capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE') && attributes.business_verification_status === 'VERIFIED' && (!attributes.business_reference_code || !attributes.service_provider_reference_code);
  const hasSuggestions = attributes.business_reference_code_status === 'SUGGESTED' || attributes.service_provider_reference_code_status === 'SUGGESTED';
  const canRegenerateSuggestions = capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE') && attributes.business_verification_status !== 'VERIFIED' && hasSuggestions;
  const blocker = activationBlocker(attributes.business_verification_status);
  const isActive = attributes.status === 'ACTIVE';
  const contacts = data.contacts?.filter(row => row.attributes.status === 'ACTIVE') || [];
  const locations = data.locations?.filter(row => row.attributes.status === 'ACTIVE') || [];
  const pendingReviews = reviews.filter(row => row.attributes.status === 'PENDING_REVIEW').length;
  const warningNotes = [
    !data.errors.contacts && data.contacts && contacts.length === 0 ? 'No active provider contact is recorded.' : '',
    !data.errors.locations && data.locations && locations.length === 0 ? 'No active office location is recorded.' : '',
    documents.length === 0 ? 'No provider verification documents are recorded.' : documents.some(row => row.attributes.scan_state === 'NOT_SCANNED') ? 'Some document versions are NOT_SCANNED under current platform policy.' : '',
    attributes.provider_admin_setup === 'not_configured' ? 'Provider administrator membership is not configured.' : '',
    pendingReviews ? `${pendingReviews} verification review item${pendingReviews === 1 ? '' : 's'} pending.` : '',
  ].filter(Boolean);
  const planVersion = (versionId: string) => data.plans.flatMap(plan => (plan.attributes.versions || (plan.attributes.latest_version ? [plan.attributes.latest_version] : [])).map(version => ({ plan, version }))).find(item => item.version.id === versionId);
  const openRequest = data.requests?.find(row => ['PENDING_REVIEW', 'APPROVED', 'PAYMENT_PENDING', 'EVIDENCE_SUBMITTED'].includes(row.attributes.status));
  const currentSubscription = data.subscription;
  const currentPlan = currentSubscription ? planVersion(currentSubscription.attributes.plan_version_id) : undefined;
  const requestedPlan = openRequest ? planVersion(openRequest.attributes.plan_version_id) : undefined;
  const defaultPlan = data.plans.find(plan => plan.attributes.onboarding_default === true);
  const canActivate = lifecycleActions(attributes.status).some(action => action.action === 'activate' && capabilities.includes(action.capability));
  const contactsState = data.loading ? 'Loading' : data.errors.contacts || data.errors.locations ? 'Unavailable' : data.contacts === null || data.locations === null ? 'Not available' : contacts.length && locations.length ? 'Recorded' : 'Needs attention';

  return <div className="provider-onboarding-review">
    <section className={`onboarding-readiness-summary${blocker && !isActive ? ' has-blocker' : ' is-ready'}`} aria-labelledby="provider-onboarding-readiness">
      <div className="onboarding-readiness-heading"><div><p className="platform-eyebrow">Activation readiness</p><h2 id="provider-onboarding-readiness">{isActive ? 'Provider is active' : blocker ? 'Business verification is required' : 'Business verification is complete'}</h2><p>Registration verification and provider operational lifecycle are separate decisions.</p></div><Status>{human(attributes.status)} lifecycle</Status></div>
      {blocker && !isActive ? <div className="onboarding-blocking-issues"><strong>Blocking issue</strong><p>{blocker}</p><Button variant="quiet" onClick={() => open(`platform/providers/${provider.id}/business-profile/edit`)}>Review business profile</Button></div> : <p className="onboarding-readiness-note">{isActive ? 'This provider is already active. Later lifecycle changes use separate controls.' : 'The business verification gate is satisfied. The API performs final activation checks and records the audited decision.'}</p>}
      {warningNotes.length > 0 && <div className="onboarding-warning-list"><strong>Additional review notes</strong><ul>{warningNotes.map(note => <li key={note}>{note}</li>)}</ul></div>}
      {Object.keys(data.errors).length > 0 && <Button variant="quiet" disabled={data.loading} onClick={() => setReloadToken(token => token + 1)}>Retry unavailable records</Button>}
      <div className="onboarding-final-actions">{canActivate && !isActive ? <Button onClick={() => open(`platform/providers/${provider.id}/lifecycle`)}>Open activation controls</Button> : <span>{isActive ? 'Activation already recorded' : 'Separate provider activation capability is required.'}</span>}</div>
    </section>

    <div className="onboarding-review-grid">
      <OnboardingReviewSection id="onboarding-business-review" title="Business and identity review" status={human(verification || 'NOT_SUBMITTED')} summary={`${attributes.display_name} · ${business?.profile.legal_name || 'Legal name not supplied'}`} href={`platform/providers/${provider.id}/business-profile/edit`} canOpen={capabilities.some(capability => ['PLATFORM_PROVIDER_PROFILE_WRITE', 'PLATFORM_PROVIDER_BUSINESS_WRITE'].includes(capability))}>
        {canIssueCodes && <div className="platform-form-actions"><p>This verified Business profile is missing reference codes. Generate them now; issuance is audited and does not change the provider lifecycle.</p><Button variant="secondary" disabled={issuingCodes} onClick={() => { setIssuingCodes(true); setIssueCodeError(''); void onIssueCodes().catch(error => setIssueCodeError(error instanceof Error ? error.message : 'Reference codes could not be generated.')).finally(() => setIssuingCodes(false)); }}>{issuingCodes ? 'Generating…' : 'Generate missing B-CODE and SP-CODE'}</Button></div>}
        {issueCodeError && <p className="platform-error" role="alert">{issueCodeError}</p>}
        <dl className="provider-information-grid"><dt>B-CODE</dt><dd><strong>{formatBusinessProviderReferenceCode(attributes.business_reference_code) || 'Not generated'}</strong> · {human(attributes.business_reference_code_status)}</dd><dt>SP-CODE</dt><dd><strong>{formatBusinessProviderReferenceCode(attributes.service_provider_reference_code) || 'Not generated'}</strong> · {human(attributes.service_provider_reference_code_status)}</dd><dt>Provider name</dt><dd>{attributes.display_name}</dd><dt>Existing provider code</dt><dd>{attributes.provider_code || 'Not supplied'}</dd><dt>Provider lifecycle</dt><dd>{human(attributes.status)}</dd><dt>Business verification</dt><dd>{human(verification)}</dd><dt>Legal name</dt><dd>{business?.profile.legal_name || 'Not supplied'}</dd><dt>Registration number</dt><dd>{business?.profile.registration_number || 'Not supplied'}</dd><dt>Tax identifiers</dt><dd>{[business?.profile.gstin && `GSTIN ${business.profile.gstin}`, business?.profile.pan_number && `PAN ${business.profile.pan_number}`, business?.profile.tax_identifier && `Tax ID ${business.profile.tax_identifier}`].filter(Boolean).join(' · ') || 'Not supplied'}</dd><dt>Registered address</dt><dd>{Object.values(business?.profile.address || {}).filter(Boolean).join(', ') || 'Not supplied'}</dd><dt>Profile revision</dt><dd>{business?.revision ?? 'Not available'}</dd></dl>
        {canRegenerateSuggestions && <div className="platform-form-actions"><label>Reason for regenerating the suggested codes<input value={regenerationReason} onChange={event => setRegenerationReason(event.target.value)} placeholder="For example, requested by the customer" maxLength={500} /></label><p className="platform-muted">Only unissued suggestions change. Existing issued codes remain fixed.</p><Button variant="secondary" disabled={regeneratingCodes || regenerationReason.trim().length < 3} onClick={() => { setRegeneratingCodes(true); setRegenerationError(''); void onRegenerateSuggestions(regenerationReason.trim()).then(() => setRegenerationReason('')).catch(error => setRegenerationError(error instanceof Error ? error.message : 'Code suggestions could not be regenerated.')).finally(() => setRegeneratingCodes(false)); }}>{regeneratingCodes ? 'Regenerating…' : 'Regenerate available suggestions'}</Button></div>}
        {regenerationError && <p className="platform-error" role="alert">{regenerationError}</p>}
        <p className="onboarding-review-note">Business classification is not supplied by the current business-profile API.</p>
      </OnboardingReviewSection>

      <OnboardingReviewSection id="onboarding-contacts-review" title="Contacts and locations review" status={contactsState} summary={data.loading ? 'Loading contact and office records…' : `${data.contacts === null ? 'Contacts unavailable' : `${contacts.length} active contacts`} · ${data.locations === null ? 'offices unavailable' : `${locations.length} active offices`}`} href={`platform/providers/${provider.id}/onboarding/contacts`} canOpen={canReadContacts}>
        {data.errors.contacts || data.errors.locations ? <p role="alert">{data.errors.contacts || data.errors.locations}</p> : data.contacts === null || data.locations === null ? <p>Contact and office records are not available under the current platform access.</p> : <><h4>Provider contacts</h4>{contacts.length ? <ul>{contacts.map(row => <li key={row.id}>{row.attributes.display_name} · {human(row.attributes.responsibility_type)}</li>)}</ul> : <OnboardingEmptyState title="No active provider contacts" description="Add a coordination contact. Contact records do not create authenticated members." action={<Button variant="quiet" onClick={() => open(`platform/providers/${provider.id}/onboarding/contacts`)}>Add contact</Button>} />}<h4>Office locations</h4>{locations.length ? <ul>{locations.map(row => <li key={row.id}>{row.attributes.name} · {human(row.attributes.location_kind)} · {Object.values(row.attributes.address).filter(Boolean).join(', ')}</li>)}</ul> : <OnboardingEmptyState title="No active offices" description="Add an India office address. Coordinates remain optional office coordinates." action={<Button variant="quiet" onClick={() => open(`platform/providers/${provider.id}/onboarding/locations`)}>Add office</Button>} />}<Button variant="quiet" onClick={() => open(`platform/providers/${provider.id}/onboarding/locations`)}>Review offices</Button></>}
      </OnboardingReviewSection>

      <OnboardingReviewSection id="onboarding-documents-review" title="Document verification review" status={documents.length ? human(documents.some(row => row.attributes.scan_state === 'NOT_SCANNED') ? 'NOT_SCANNED' : documents.some(row => row.attributes.status === 'AVAILABLE') ? 'AVAILABLE' : 'PENDING') : 'No documents'} summary={documents.length ? `${documents.length} provider document records` : 'No provider verification documents'} href={`platform/providers/${provider.id}/onboarding/documents`} canOpen={capabilities.includes('PLATFORM_PROVIDER_DOCUMENTS')}>
        {documents.length ? <ul className="onboarding-document-list">{documents.map(row => <li key={row.id}><span><strong>{row.attributes.filename}</strong><small>{human(row.attributes.classification)} · version {row.attributes.current_version ?? 'Not available'}</small></span><Status>{human(row.attributes.scan_state)}</Status></li>)}</ul> : <OnboardingEmptyState title="No verification documents yet" description="Upload evidence through the private, versioned document workflow." action={<Button variant="quiet" onClick={() => open(`platform/providers/${provider.id}/onboarding/documents`)}>Open documents</Button>} />}
        {documents.some(row => row.attributes.scan_state === 'NOT_SCANNED') && <p className="onboarding-review-note">Malware scanning is disabled by platform policy. NOT_SCANNED does not mean clean or verified.</p>}
      </OnboardingReviewSection>

      <OnboardingReviewSection id="onboarding-administrator-review" title="Administrator setup review" status={human(attributes.provider_admin_setup)} summary={data.invitations === null ? 'Invitation history unavailable or not authorized' : `${data.invitations.length} invitation records`} href={`platform/providers/${provider.id}`} canOpen={capabilities.includes('PLATFORM_PROVIDER_READ')}>
        <p>Provider administrator membership is independent of provider lifecycle activation.</p>
        {data.errors.invitations && <p role="alert">{data.errors.invitations}</p>}
        {data.invitations?.length ? <ul className="onboarding-invitation-list">{data.invitations.map(row => <li key={row.id}><span><strong>{human(row.attributes.status === 'PENDING' && row.attributes.expired ? 'EXPIRED' : row.attributes.status)}</strong><small>Expires {date(row.attributes.expires_at)}</small></span></li>)}</ul> : data.invitations && <p>No administrator invitations were returned.</p>}
        {!canReadInvitations && <p>Invitation records are not available under this account's platform capabilities.</p>}
        <p>Setup: <Status>{human(attributes.provider_admin_setup)}</Status></p>
      </OnboardingReviewSection>

      <OnboardingReviewSection id="onboarding-subscription-review" title="Subscription review" status={data.loading ? 'Loading' : data.errors.subscription || data.errors.requests ? 'Unavailable' : currentSubscription ? human(currentSubscription.attributes.status) : openRequest ? 'Request in progress' : 'No subscription'} summary={data.loading ? 'Loading subscription records…' : currentSubscription ? `${currentPlan?.plan.attributes.name || 'Plan name unavailable'} · ${human(currentSubscription.attributes.approval_state)} · ${human(currentSubscription.attributes.payment_state)}` : openRequest ? `${requestedPlan?.plan.attributes.name || 'Requested plan'} · ${human(openRequest.attributes.status)}` : 'No accepted subscription record'} href={`platform/providers/${provider.id}/onboarding/subscription`} canOpen={canReadSubscriptions && canReadPlans}>
        {(data.errors.subscription || data.errors.requests || data.errors.plans) && <p role="alert">{data.errors.subscription || data.errors.requests || data.errors.plans}</p>}
        {currentSubscription ? <dl className="provider-information-grid"><dt>Plan</dt><dd>{currentPlan?.plan.attributes.name || 'Plan name unavailable'}</dd><dt>Lifecycle</dt><dd>{human(currentSubscription.attributes.status)}</dd><dt>Approval</dt><dd>{human(currentSubscription.attributes.approval_state)}</dd><dt>Payment evidence</dt><dd>{human(currentSubscription.attributes.payment_state)}</dd><dt>Valid from</dt><dd>{date(currentSubscription.attributes.effective_from)}</dd><dt>Valid until</dt><dd>{date(currentSubscription.attributes.effective_to)}</dd></dl> : openRequest ? <dl className="provider-information-grid"><dt>Requested plan</dt><dd>{requestedPlan?.plan.attributes.name || 'Plan name unavailable'}</dd><dt>Request status</dt><dd>{human(openRequest.attributes.status)}</dd><dt>Requested effective</dt><dd>{date(openRequest.attributes.requested_effective_from)}</dd></dl> : canReadSubscriptions && defaultPlan ? <p>The published default demonstration plan ({defaultPlan.attributes.name}) is assigned by the API during first activation when no explicit plan request is pending or accepted. Its 14-day validity starts from business verification; it is not a paid request.</p> : canReadSubscriptions ? <p>No current subscription or pending plan request was returned by the API.</p> : <p>Subscription status is unavailable to this account.</p>}
        {data.requests?.length ? <p>{data.requests.length} subscription request records are available on Plan & Approval.</p> : null}
      </OnboardingReviewSection>

      <OnboardingReviewSection id="onboarding-review-history" title="Review status history" status={pendingReviews ? `${pendingReviews} pending` : reviews.length ? 'Reviewed' : 'No review history'} summary={`${reviews.length} verification review records`} href={`platform/providers/${provider.id}?tab=reviews`} canOpen={capabilities.includes('PLATFORM_PROVIDER_READ')}>
        {reviews.length ? <div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Review</th><th>Status</th><th>B-CODE</th><th>SP-CODE</th><th>Submitted</th><th>Reviewed</th></tr></thead><tbody>{reviews.map(row => <tr key={row.id}><td>{human(row.attributes.review_kind)}</td><td><Status>{human(row.attributes.status)}</Status></td><td>{formatBusinessProviderReferenceCode(row.attributes.business_reference_code) || 'Not issued'}</td><td>{formatBusinessProviderReferenceCode(row.attributes.service_provider_reference_code) || 'Not issued'}</td><td>{date(row.attributes.submitted_at)}</td><td>{date(row.attributes.reviewed_at)}</td></tr>)}</tbody></table></div> : <p>No verification reviews were returned.</p>}
        <Button variant="quiet" onClick={() => open(`platform/providers/${provider.id}?tab=reviews`)}>Open review actions</Button>
      </OnboardingReviewSection>
    </div>
  </div>;
}

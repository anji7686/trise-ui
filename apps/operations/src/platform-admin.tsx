import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, DetailSection, FilterToolbar, PageHeader, StatePanel, Status } from '@trise/ui';
import { operationsData, type PlatformOverview, type PlatformProviderAttributes, type ProviderBusinessProfile, type ProviderDocument, type ProviderOnboardingContactAttributes, type ProviderOfficeLocationAttributes, type ProviderVerificationReview, type Resource } from './data';
import { SvgIcon } from './icons';
import { parsePlatformProviderRoute, providerOnboardingRoute } from './platform-provider-routing';
import { stableSubmissionKey, validateOnboardingContact, validateOnboardingLocation, type FieldErrors } from './provider-onboarding-validation';
import { ProviderLogoEditor } from './provider-business-profile';
import { ProviderDocumentsStep } from './provider-documents';
import { activationBlocker, lifecycleActions, type ProviderLifecycleAction } from './provider-lifecycle';
import { PlatformPlansPage } from './platform-plans';
import { PlatformSubscriptionsPage } from './platform-subscriptions';
import { PlatformProviderSubscription } from './platform-provider-subscription';

const errorText = (error: unknown) => (error as { message?: string })?.message || 'The platform request could not be completed.';
const go = (hash: string) => { window.location.hash = hash; };
const formatDate = (value?: string) => value ? new Date(value).toLocaleString() : 'Not available';
const humanStatus = (value?: string) => value ? value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not submitted';
const auditLabel = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const FieldError = ({ message }: { message?: string }) => message ? <small className="platform-field-error" role="alert">{message}</small> : null;

function Forbidden() {
  return <StatePanel title="Platform administration is restricted">
    <span>Your authenticated account is not an explicit platform administrator.</span>
    <Button variant="secondary" onClick={() => go('overview')}>Back to overview</Button>
  </StatePanel>;
}

function ProviderSummaryCards({ overview }: { overview: PlatformOverview }) {
  const cards = [['grid', 'Total providers', overview.data.total_providers, 'Authoritative platform summary'], ...Object.entries(overview.data.provider_counts).map(([status, count]) => ['activity', humanStatus(status), count, 'Providers in this lifecycle state'] as const)];
  return <div className="platform-summary-grid">
    {cards.map(([icon, label, count, note]) => <article className="platform-summary-card" key={label}><span className="platform-summary-icon"><SvgIcon name={icon as 'grid' | 'activity'} size={18} /></span><div><span>{label}</span><strong>{count}</strong></div><small>{note}</small></article>)}
  </div>;
}

function ProviderTable({ providers }: { providers: Resource<PlatformProviderAttributes>[] }) {
  if (!providers.length) return <StatePanel title="No providers found">Try a different search or status filter.</StatePanel>;
  return <div className="platform-provider-table-wrap"><table className="platform-provider-table"><caption className="sr-only">Provider directory. Showing loaded records only.</caption><thead><tr><th scope="col">Provider</th><th scope="col">Status</th><th scope="col">Admin setup</th><th scope="col">Registered</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead><tbody>{providers.map((item) => <tr key={item.id}><td><div className="platform-record-name"><span className="platform-record-icon" aria-hidden="true"><SvgIcon name="building" size={17} /></span><span><strong>{item.attributes.display_name}</strong><small>{item.attributes.provider_code || 'Provider code not supplied'}</small></span></div></td><td><Status>{humanStatus(item.attributes.status)}</Status></td><td>{item.attributes.provider_admin_setup === 'configured' ? 'Configured' : 'Not configured'}</td><td>{formatDate(item.attributes.effective_from)}</td><td><Button variant="quiet" onClick={() => go(`platform/providers/${item.id}`)}><SvgIcon name="eye" size={15} /> View details</Button></td></tr>)}</tbody></table></div>;
}

function PlatformBreadcrumb({ current }: { current: string }) {
  return <div className="platform-breadcrumb"><span>Platform administration</span><SvgIcon name="chevron-right" size={14} /><strong>{current}</strong></div>;
}

const onboardingSteps = ['Provider identity', 'Business profile', 'Contacts & locations', 'Documents', 'Plan & approval', 'Review & activate'];
function ProviderOnboardingSteps({ current, providerId = '', completed = [] }: { current: number; providerId?: string; completed?: number[] }) {
  return <nav className="platform-onboarding-steps" aria-label="Provider onboarding progress">{onboardingSteps.map((label, index) => { const route = providerOnboardingRoute(providerId, index); return <button type="button" className={index === current ? 'current' : completed.includes(index) ? 'complete' : ''} aria-current={index === current ? 'step' : undefined} key={label} disabled={!route} onClick={() => { if (route) window.location.hash = route; }}><span>{index + 1}</span><strong>{label}</strong><small>{index === current ? 'Current step' : completed.includes(index) ? 'Saved' : route ? 'Available' : 'Save provider first'}</small></button>; })}</nav>;
}

function ProviderContactsLocationsStep({ providerId, providerName, tab }: { providerId: string; providerName: string; tab: 'contacts' | 'locations' }) {
  const [contacts, setContacts] = useState<Resource<ProviderOnboardingContactAttributes>[]>([]);
  const [locations, setLocations] = useState<Resource<ProviderOfficeLocationAttributes>[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [contactErrors, setContactErrors] = useState<FieldErrors>({});
  const [locationErrors, setLocationErrors] = useState<FieldErrors>({});
  const [contact, setContact] = useState({ display_name: '', email: '', mobile: '', landline: '', phone: '', designation: 'PRIMARY', responsibility_type: 'BUSINESS_CONTACT' });
  const [location, setLocation] = useState({ name: '', location_kind: 'REGISTERED_OFFICE', country: 'India', address_line: '', locality: '', city: '', district: '', state: '', pin_code: '', landmark: '', latitude: '', longitude: '' });
  const contactKey = useRef<string | null>(null);
  const locationKey = useRef<string | null>(null);
  const contactInFlight = useRef(false);
  const locationInFlight = useRef(false);

  async function load() {
    setError('');
    try {
      const [contactPage, locationPage] = await Promise.all([operationsData.platformOnboardingContacts(providerId), operationsData.platformOnboardingLocations(providerId)]);
      setContacts(contactPage.data); setLocations(locationPage.data);
    } catch (cause) { setError((cause as { message?: string })?.message || 'Onboarding details could not be loaded.'); }
  }
  useEffect(() => { void load(); }, [providerId]);
  function changeContact(key: keyof typeof contact, value: string) {
    contactKey.current = null;
    setContactErrors((current) => ({ ...current, [key]: '' }));
    setContact((current) => ({ ...current, [key]: value }));
  }
  function changeLocation(key: keyof typeof location, value: string) {
    locationKey.current = null;
    setLocationErrors((current) => ({ ...current, [key]: '', coordinates: '' }));
    setLocation((current) => ({ ...current, [key]: value }));
  }
  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (contactInFlight.current) return;
    const validation = validateOnboardingContact(contact);
    setContactErrors(validation);
    if (Object.keys(validation).length) { setError('Correct the highlighted contact fields.'); return; }
    contactInFlight.current = true; setBusy('contact'); setError('');
    const key = stableSubmissionKey(contactKey.current, () => crypto.randomUUID());
    contactKey.current = key;
    try {
      const saved = await operationsData.createPlatformOnboardingContact(providerId, { ...contact, display_name: contact.display_name.trim(), email: contact.email.trim(), mobile: contact.mobile.trim(), landline: contact.landline.trim() }, key);
      setContacts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      contactKey.current = null;
      setContact({ display_name: '', email: '', mobile: '', landline: '', phone: '', designation: 'PRIMARY', responsibility_type: 'BUSINESS_CONTACT' });
      setContactErrors({});
      await load();
    } catch (cause) { setError((cause as { message?: string })?.message || 'Contact could not be saved. Retry will reuse the same request key.'); } finally { contactInFlight.current = false; setBusy(''); }
  }
  async function addLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locationInFlight.current) return;
    const validation = validateOnboardingLocation(location);
    setLocationErrors(validation);
    if (Object.keys(validation).length) { setError('Correct the highlighted office fields.'); return; }
    locationInFlight.current = true; setBusy('location'); setError('');
    const latitude = location.latitude.trim() ? Number(location.latitude) : undefined;
    const longitude = location.longitude.trim() ? Number(location.longitude) : undefined;
    const key = stableSubmissionKey(locationKey.current, () => crypto.randomUUID());
    locationKey.current = key;
    try {
      const saved = await operationsData.createPlatformOnboardingLocation(providerId, { name: location.name.trim(), location_kind: location.location_kind, address: { country: 'India', address_line: location.address_line.trim(), locality: location.locality.trim(), city: location.city.trim(), district: location.district.trim(), state: location.state.trim(), pin_code: location.pin_code.trim(), landmark: location.landmark.trim() }, latitude, longitude }, key);
      setLocations((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      locationKey.current = null;
      setLocation({ name: '', location_kind: 'REGISTERED_OFFICE', country: 'India', address_line: '', locality: '', city: '', district: '', state: '', pin_code: '', landmark: '', latitude: '', longitude: '' });
      setLocationErrors({});
      await load();
    } catch (cause) { setError((cause as { message?: string })?.message || 'Office location could not be saved. Retry will reuse the same request key.'); } finally { locationInFlight.current = false; setBusy(''); }
  }
  function captureLocation() {
    if (!navigator.geolocation) { setError('This browser does not provide location capture. Enter coordinates manually.'); return; }
    setError(''); navigator.geolocation.getCurrentPosition(({ coords }) => { locationKey.current = null; setLocationErrors((current) => ({ ...current, latitude: '', longitude: '', coordinates: '' })); setLocation((current) => ({ ...current, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) })); }, () => setError('Location permission was not granted. Enter coordinates manually.'));
  }
  return <section className="platform-page">
    <PlatformBreadcrumb current={`Contacts & locations · ${providerName}`} />
    <ProviderOnboardingSteps current={2} providerId={providerId} />
    <PageHeader eyebrow="Provider onboarding" title="Contacts and office locations" description="Save provider-level contacts and India-only office addresses. These records do not create logins, memberships, service coverage, or customer access." />
    <div className="platform-onboarding-tabs" role="tablist" aria-label="Onboarding details">
      <button type="button" role="tab" aria-selected={tab === 'contacts'} className={tab === 'contacts' ? 'active' : ''} onClick={() => go(`platform/providers/${providerId}/onboarding/contacts`)}>Contact details</button>
      <button type="button" role="tab" aria-selected={tab === 'locations'} className={tab === 'locations' ? 'active' : ''} onClick={() => go(`platform/providers/${providerId}/onboarding/locations`)}>Office location details</button>
    </div>
    {tab === 'contacts' ? <DetailSection title="Primary and secondary contacts" description="A contact can be used for provider coordination without creating a login or membership.">
      <form className="platform-form-grid" onSubmit={addContact}>
        <label>Name <span aria-hidden="true">*</span><input required aria-invalid={Boolean(contactErrors.display_name)} value={contact.display_name} onChange={(event) => changeContact('display_name', event.target.value)} /><FieldError message={contactErrors.display_name} /></label>
        <label>Email <span aria-hidden="true">*</span><input required type="email" aria-invalid={Boolean(contactErrors.email)} value={contact.email} onChange={(event) => changeContact('email', event.target.value)} /><FieldError message={contactErrors.email} /></label>
        <label>Mobile <span aria-hidden="true">*</span><input required inputMode="tel" placeholder="+919876543210" aria-invalid={Boolean(contactErrors.mobile)} value={contact.mobile} onChange={(event) => changeContact('mobile', event.target.value)} /><FieldError message={contactErrors.mobile} /></label>
        <label>Landline <span className="platform-muted">(optional)</span><input inputMode="tel" aria-invalid={Boolean(contactErrors.landline)} value={contact.landline} onChange={(event) => changeContact('landline', event.target.value)} /><FieldError message={contactErrors.landline} /></label>
        <label>Responsibility<select value={contact.responsibility_type} onChange={(event) => changeContact('responsibility_type', event.target.value)}><option value="BUSINESS_CONTACT">Business contact</option><option value="CUSTOMER_SUPPORT">Customer support</option></select></label>
        <label>Designation<select value={contact.designation} onChange={(event) => changeContact('designation', event.target.value)}><option value="PRIMARY">Primary</option><option value="SECONDARY">Secondary</option></select></label>
        <div className="platform-form-actions"><Button type="submit" busy={busy === 'contact'} disabled={busy === 'contact'}><SvgIcon name="plus" size={16} /> Add contact</Button></div>
      </form>
      <div className="platform-provider-table-wrap"><table className="platform-provider-table"><caption className="sr-only">Saved provider onboarding contacts</caption><thead><tr><th scope="col">Name</th><th scope="col">Responsibility</th><th scope="col">Designation</th><th scope="col">Contact</th><th scope="col">Status</th></tr></thead><tbody>{contacts.map((item) => <tr key={item.id}><td><strong>{item.attributes.display_name}</strong></td><td>{item.attributes.responsibility_type.replaceAll('_', ' ')}</td><td>{item.attributes.designation}</td><td>{item.attributes.contact_methods.email || item.attributes.contact_methods.phone}</td><td><Status>{item.attributes.status}</Status></td></tr>)}</tbody></table>{!contacts.length && <p className="platform-empty-inline">No onboarding contacts saved yet.</p>}</div>
    </DetailSection> : <DetailSection title="Registered and operating offices" description="Enter every address manually. State, District, City and PIN are not populated from a PIN lookup; the PIN is only validated as six digits.">
      <form className="platform-form-grid" onSubmit={addLocation}>
        <label>Office name <span aria-hidden="true">*</span><input required aria-invalid={Boolean(locationErrors.name)} value={location.name} onChange={(event) => changeLocation('name', event.target.value)} /><FieldError message={locationErrors.name} /></label>
        <label>Office type<select value={location.location_kind} onChange={(event) => changeLocation('location_kind', event.target.value)}><option value="REGISTERED_OFFICE">Registered office</option><option value="OPERATING_OFFICE">Operating office</option></select></label>
        <label>Country<input value="India" readOnly /></label>
        {([['address_line', 'Address line', false], ['locality', 'Locality / area', false], ['city', 'City', true], ['district', 'District', true], ['state', 'State', true], ['pin_code', 'PIN code', true], ['landmark', 'Landmark', false]] as const).map(([key, label, required]) => <label key={key}>{label}{required && <span aria-hidden="true"> *</span>}<input required={required} aria-invalid={Boolean(locationErrors[key])} value={location[key]} onChange={(event) => changeLocation(key, event.target.value)} inputMode={key === 'pin_code' ? 'numeric' : undefined} pattern={key === 'pin_code' ? '[1-9][0-9]{5}' : undefined} maxLength={key === 'pin_code' ? 6 : 200} /><FieldError message={locationErrors[key]} /></label>)}
        <label>Latitude <span className="platform-muted">(optional)</span><input inputMode="decimal" aria-invalid={Boolean(locationErrors.latitude || locationErrors.coordinates)} value={location.latitude} onChange={(event) => changeLocation('latitude', event.target.value)} /><FieldError message={locationErrors.latitude} /></label>
        <label>Longitude <span className="platform-muted">(optional)</span><input inputMode="decimal" aria-invalid={Boolean(locationErrors.longitude || locationErrors.coordinates)} value={location.longitude} onChange={(event) => changeLocation('longitude', event.target.value)} /><FieldError message={locationErrors.longitude} /></label>
        <div className="platform-form-note">Coordinates are kept as office coordinates. They are not replaced with post-office or PIN coordinates.<FieldError message={locationErrors.coordinates} /></div>
        <div className="platform-form-actions"><Button type="button" variant="secondary" onClick={captureLocation}>Use current location</Button><Button type="submit" busy={busy === 'location'} disabled={busy === 'location'}><SvgIcon name="save" size={16} /> Save office</Button></div>
      </form>
      <div className="platform-provider-table-wrap"><table className="platform-provider-table"><caption className="sr-only">Saved provider office locations</caption><thead><tr><th scope="col">Office</th><th scope="col">Type</th><th scope="col">Address</th><th scope="col">Coordinates</th><th scope="col">Status</th></tr></thead><tbody>{locations.map((item) => <tr key={item.id}><td><strong>{item.attributes.name}</strong></td><td>{item.attributes.location_kind.replaceAll('_', ' ')}</td><td>{Object.values(item.attributes.address).filter(Boolean).join(', ')}</td><td>{item.attributes.latitude != null && item.attributes.longitude != null ? `${item.attributes.latitude}, ${item.attributes.longitude}` : 'Not captured'}</td><td><Status>{item.attributes.status}</Status></td></tr>)}</tbody></table>{!locations.length && <p className="platform-empty-inline">No provider offices saved yet.</p>}</div>
    </DetailSection>}
    {error && <StatePanel title="Onboarding change needs attention"><span>{error}</span></StatePanel>}
    <div className="platform-form-actions"><Button type="button" variant="secondary" onClick={() => go(tab === 'locations' ? `platform/providers/${providerId}/onboarding/contacts` : `platform/providers/${providerId}/business-profile/edit`)}><SvgIcon name="arrow-left" size={16} /> Back</Button><Button type="button" onClick={() => go(tab === 'contacts' ? `platform/providers/${providerId}/onboarding/locations` : `platform/providers/${providerId}/onboarding/documents`)}>Continue <SvgIcon name="chevron-right" size={16} /></Button></div>
  </section>;
}

function ProviderDirectory({ initialProviders, initialError }: { initialProviders: Resource<PlatformProviderAttributes>[]; initialError?: string }) {
  const [providers, setProviders] = useState(initialProviders);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [cursor, setCursor] = useState<{ after: string | null; before: string | null }>({ after: null, before: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || '');

  async function load(next: { after?: string | null; before?: string | null } = {}) {
    setLoading(true); setError('');
    try {
      const result = await operationsData.platformProviders({ q: query, status, after: next.after ?? null, before: next.before ?? null });
      setProviders(result.data);
      setCursor({ after: result.page?.next || null, before: result.page?.previous || null });
    } catch (cause) { setError(errorText(cause)); } finally { setLoading(false); }
  }

  function resetFilters() { setCursor({ after: null, before: null }); void load({ after: null, before: null }); }
  const resultLabel = loading ? 'Loading providers…' : `Showing ${providers.length} loaded providers`;
  return <>
    <PlatformBreadcrumb current="Providers" /><PageHeader eyebrow="Platform" title="Provider directory" description="Search and inspect provider metadata without entering provider business data." action={<Button onClick={() => go('platform/providers/new')}><SvgIcon name="plus" size={16} /> Register provider</Button>} />
    <FilterToolbar resultLabel={resultLabel}>
      <label>Search providers<input aria-label="Search providers" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load({ after: null, before: null }); }} placeholder="Name or provider code" /></label>
      <label>Status<select aria-label="Filter providers by status" value={status} onChange={(event) => { setStatus(event.target.value); setCursor({ after: null, before: null }); }}><option value="">All statuses</option><option value="PENDING">Pending</option><option value="PENDING_ACTIVATION">Pending activation</option><option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option><option value="SUSPENDED">Suspended</option><option value="CLOSED">Closed</option></select></label>
      <Button variant="secondary" onClick={() => void load({ after: null, before: null })}><SvgIcon name="filter" size={16} /> Apply filters</Button>
      <Button variant="quiet" onClick={resetFilters}><SvgIcon name="x" size={16} /> Clear</Button>
    </FilterToolbar>
    {error && <StatePanel title="Provider directory unavailable"><span>{error}</span><Button onClick={() => void load()}>Retry</Button></StatePanel>}
    {!error && <><ProviderTable providers={providers} /><div className="platform-pagination"><Button variant="secondary" disabled={!cursor.before || loading} onClick={() => { if (cursor.before) void load({ before: cursor.before }); }}><SvgIcon name="chevron-left" size={16} /> Previous</Button><span>{resultLabel}</span><Button variant="secondary" disabled={!cursor.after || loading} onClick={() => { if (cursor.after) void load({ after: cursor.after }); }}>Next <SvgIcon name="chevron-right" size={16} /></Button></div></>}
  </>;
}

function ProviderForm({ record }: { record?: Resource<PlatformProviderAttributes> }) {
  const editing = Boolean(record);
  const [name, setName] = useState(record?.attributes.display_name || '');
  const [code, setCode] = useState(record?.attributes.provider_code || '');
  const representation = 'ORGANIZATION';
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const trimmedName = name.trim(); const trimmedCode = code.trim();
    if (!trimmedName) { setError('Enter a provider name.'); return; }
    if (trimmedCode && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(trimmedCode)) { setError('Use up to 100 letters, numbers, dots, underscores, or hyphens for the provider code.'); return; }
    setSaving(true);
    try {
      const key = `platform-provider-${editing ? record?.id : 'new'}-${Date.now()}`;
      const result = editing
        ? await operationsData.updatePlatformProvider(record!.id, { name: trimmedName, representation_kind: representation, provider_code: trimmedCode || null, expected_revision: record!.attributes.revision || 0 }, key)
        : await operationsData.createPlatformProvider({ name: trimmedName, representation_kind: representation, ...(trimmedCode ? { provider_code: trimmedCode } : {}) }, key);
      go(`platform/providers/${result.id}/business-profile/edit`);
    } catch (cause) { setError(errorText(cause)); } finally { setSaving(false); }
  }

  return <section className="platform-form-card">
    <PlatformBreadcrumb current={editing ? 'Edit provider' : 'New provider'} /><ProviderOnboardingSteps current={0} providerId={record?.id || ''} /><PageHeader eyebrow="Platform" title={editing ? 'Edit provider profile' : 'Register provider'} description="Create or update the pending provider profile only. Verification, activation, memberships, and subscriptions are separate workflows." />
    <form onSubmit={submit} className="platform-form">
      <div className="platform-form-section"><h2>Provider profile</h2><p className="platform-muted">Use the legal or operating name that platform staff will recognize.</p>
        <label>Provider name <span aria-hidden="true">*</span><input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="organization" /></label>
        <label>Representation kind <span aria-hidden="true">*</span><input value="Organization" readOnly aria-describedby="representation-help" /><span id="representation-help" className="platform-muted">The current provider contract supports organization records.</span></label>
        <label>Provider code <span className="platform-muted">(optional)</span><input value={code} onChange={(event) => setCode(event.target.value)} maxLength={100} placeholder="Example: LIFT-RISE" /></label>
      </div>
      {editing && <p className="platform-form-note">Current lifecycle: <Status>{record?.attributes.status}</Status> Changes here do not activate or suspend the provider.</p>}
      {error && <StatePanel title="Provider profile could not be saved"><span>{error}</span></StatePanel>}
      <div className="platform-form-actions"><Button type="button" variant="secondary" onClick={() => go(editing ? `platform/providers/${record!.id}` : 'platform/providers')}><SvgIcon name="arrow-left" size={16} /> Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? <><SvgIcon name="save" size={16} /> Save provider profile</> : <><SvgIcon name="plus" size={16} /> Create pending provider</>}</Button></div>
    </form>
  </section>;
}

function PlatformBusinessProfileForm({ providerId, providerName, profile, onSaved }: { providerId: string; providerName: string; profile: ProviderBusinessProfile; onSaved: () => void | Promise<void> }) {
  const [fields, setFields] = useState({ ...profile.profile, address: { ...(profile.profile.address || {}) } });
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const change = (key: string, value: string) => setFields((current) => ({ ...current, [key]: value }));
  const changeAddress = (key: string, value: string) => setFields((current) => ({ ...current, address: { ...(current.address || {}), [key]: value } }));
  const validate = () => !fields.legal_name?.trim() ? 'Legal name is required.' : !fields.address?.city?.trim() ? 'City is required.' : !fields.address?.state?.trim() ? 'State is required.' : !fields.address?.pin_code?.trim() ? 'PIN code is required.' : '';
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(''); setMessage(''); const invalid = validate(); if (invalid) { setError(invalid); return; } setSaving(true); try { const result = await operationsData.updatePlatformBusinessProfile(providerId, { business_profile: fields, expected_revision: profile.revision }, `platform-business-profile-${providerId}-${profile.revision}`); setMessage(result.data.verification_status === 'NOT_SUBMITTED' && profile.verification_status === 'VERIFIED' ? 'Saved. This material change requires a new review.' : 'Business profile saved.'); await onSaved(); go(`platform/providers/${providerId}/onboarding/contacts`); } catch (cause) { setError(errorText(cause)); } finally { setSaving(false); } }
  async function submit() { setError(''); setMessage(''); const invalid = validate(); if (invalid) { setError(invalid); return; } setSubmitting(true); try { await operationsData.submitPlatformBusinessProfile(providerId, profile.revision, `platform-business-profile-submit-${providerId}-${profile.revision}`); setMessage('Submitted on behalf of the provider for platform review.'); onSaved(); } catch (cause) { setError(errorText(cause)); } finally { setSubmitting(false); } }
  return <section className="platform-page"><PlatformBreadcrumb current={`Business profile · ${providerName}`} /><ProviderOnboardingSteps current={1} providerId={providerId} /><PageHeader eyebrow="Platform provider administration" title="Business profile" description={`Provider: ${providerName}. Changes are recorded as platform-admin actions and do not require provider membership.`} action={<Button onClick={() => void submit()} disabled={saving || submitting || profile.verification_status === 'PENDING_REVIEW'}>{submitting ? 'Submitting…' : profile.verification_status === 'PENDING_REVIEW' ? 'Awaiting review' : <><SvgIcon name="send" size={16} /> Submit for review</>}</Button>} /><div className="platform-onboarding-note"><SvgIcon name="activity" size={18} /><span>Save this revision before submitting. Contacts, locations, document transfer and review decisions use their own authorized operations and are not silently created here.</span></div><form className="platform-form" onSubmit={save}><div className="platform-form-section"><h2>Business identity</h2><label>Legal name <span aria-hidden="true">*</span><input value={fields.legal_name || ''} onChange={(event) => change('legal_name', event.target.value)} disabled={profile.verification_status === 'PENDING_REVIEW'} /></label><label>Registration number <span className="field-hint">(optional)</span><input value={fields.registration_number || ''} onChange={(event) => change('registration_number', event.target.value)} disabled={profile.verification_status === 'PENDING_REVIEW'} /></label><label>Tax identifier <span className="field-hint">(optional)</span><input value={fields.tax_identifier || ''} onChange={(event) => change('tax_identifier', event.target.value)} disabled={profile.verification_status === 'PENDING_REVIEW'} /></label></div><div className="platform-form-section"><h2>Business address</h2><div className="platform-form-grid">{[['address_line', 'Address line'], ['locality', 'Locality / area'], ['city', 'City'], ['district', 'District'], ['state', 'State'], ['pin_code', 'PIN code'], ['landmark', 'Landmark']].map(([key, label]) => <label key={key}>{label}{['city', 'state', 'pin_code'].includes(key) && <span aria-hidden="true"> *</span>}<input value={String(fields.address?.[key] || '')} onChange={(event) => changeAddress(key, event.target.value)} disabled={profile.verification_status === 'PENDING_REVIEW'} /></label>)}</div></div>{error && <StatePanel title="Business profile action needs attention"><span>{error}</span></StatePanel>}{message && <p className="platform-form-note" role="status">{message}</p>}<div className="platform-form-actions"><Button type="button" variant="secondary" onClick={() => go(`platform/providers/${providerId}`)} disabled={saving || submitting}><SvgIcon name="arrow-left" size={16} /> Cancel</Button><Button type="submit" disabled={saving || submitting || profile.verification_status === 'PENDING_REVIEW'}>{saving ? 'Saving…' : <><SvgIcon name="save" size={16} /> Save business profile</>}</Button></div></form><ProviderLogoEditor providerId={providerId} platform onChanged={onSaved} /></section>;
}

function VerificationReviewList({ reviews, canDecide, onDecision }: { reviews: ProviderVerificationReview[]; canDecide: boolean; onDecision: (review: ProviderVerificationReview, decision: string, reason: string) => Promise<void> }) {
  const [reason, setReason] = useState<Record<string, string>>({});
  const pending = reviews.filter((review) => review.attributes.status === 'PENDING_REVIEW');
  return <DetailSection title="Review history" description="Each decision applies to the exact submitted profile or document version.">
    {!reviews.length ? <p className="platform-muted">No verification reviews have been submitted.</p> : <ul className="platform-audit-list">{reviews.map((review) => <li key={review.id}><div><strong>{review.attributes.review_kind === 'BUSINESS_PROFILE' ? 'Business profile' : 'Document version'}</strong><span><Status>{humanStatus(review.attributes.status)}</Status></span>{review.attributes.reason && <small>{review.attributes.reason}</small>}</div><span>{formatDate(review.attributes.reviewed_at || review.attributes.submitted_at)}</span>{canDecide && review.attributes.status === 'PENDING_REVIEW' && <div className="platform-review-actions"><input aria-label={`Reason for ${review.id}`} value={reason[review.id] || ''} onChange={(event) => setReason((current) => ({ ...current, [review.id]: event.target.value }))} placeholder="Reason for correction or rejection" /><Button variant="secondary" onClick={() => void onDecision(review, 'VERIFY', reason[review.id] || '')}>Verify</Button><Button variant="secondary" onClick={() => void onDecision(review, 'REQUEST_CORRECTIONS', reason[review.id] || '')}>Request corrections</Button><Button variant="danger" onClick={() => void onDecision(review, 'REJECT', reason[review.id] || '')}>Reject</Button></div>}</li>)}</ul>}
    {pending.length > 0 && !canDecide && <p className="platform-muted">A platform reviewer must decide the pending evidence.</p>}
  </DetailSection>;
}

function PlatformDocumentList({ providerId, documents }: { providerId: string; documents: ProviderDocument[] }) {
  const [selected, setSelected] = useState<ProviderDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewing, setPreviewing] = useState(false);
  useEffect(() => {
    if (!selected?.attributes.current_version_id || selected.attributes.status.toLowerCase() !== 'available') { setPreviewUrl(''); return undefined; }
    let cancelled = false; let objectUrl = '';
    setPreviewing(true); setError('');
    operationsData.authorizePlatformDocumentDownload(providerId, selected.id, selected.attributes.current_version_id, crypto.randomUUID(), 'inline')
      .then((transfer) => fetch(transfer.url, { method: transfer.method, headers: transfer.headers, credentials: 'omit' }))
      .then((response) => { if (!response.ok) throw new Error(`Private storage rejected the preview (HTTP ${response.status}).`); return response.blob(); })
      .then((blob) => { if (!cancelled) { objectUrl = URL.createObjectURL(blob); setPreviewUrl(objectUrl); } })
      .catch((cause) => { if (!cancelled) setError(errorText(cause)); })
      .finally(() => { if (!cancelled) setPreviewing(false); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [providerId, selected]);
  async function download() {
    if (!selected?.attributes.current_version_id) return;
    setBusy(true); setError('');
    try {
      const transfer = await operationsData.authorizePlatformDocumentDownload(providerId, selected.id, selected.attributes.current_version_id, crypto.randomUUID(), 'attachment');
      const response = await fetch(transfer.url, { method: transfer.method, headers: transfer.headers, credentials: 'omit' });
      if (!response.ok) throw new Error(`Private storage rejected the download (HTTP ${response.status}).`);
      const url = URL.createObjectURL(await response.blob());
      const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = selected.attributes.filename; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }
  if (!documents.length) return <p className="platform-muted">No provider documents are visible.</p>;
  return <><div className="platform-provider-table-wrap"><table className="platform-provider-table"><caption className="sr-only">Provider documents</caption><thead><tr><th scope="col">Document</th><th scope="col">Status</th><th scope="col">Scan</th><th scope="col">Version</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead><tbody>{documents.map((document) => <tr key={document.id}><td><strong>{document.attributes.filename}</strong><small>{document.attributes.classification}</small></td><td><Status>{humanStatus(document.attributes.status)}</Status></td><td>{humanStatus(document.attributes.scan_state)}</td><td>{document.attributes.current_version || 'Not available'}</td><td><Button variant="quiet" onClick={() => { setError(''); setSelected(document); }}><SvgIcon name="eye" size={15} /> Preview</Button></td></tr>)}</tbody></table></div>{selected && <div className="platform-modal-backdrop" role="presentation"><section className="platform-document-modal" role="dialog" aria-modal="true" aria-labelledby="provider-document-title"><div className="platform-modal-header"><div><p className="platform-eyebrow">Private provider document</p><h2 id="provider-document-title">{selected.attributes.filename}</h2></div><button type="button" className="logo-crop-close" aria-label="Close document preview" onClick={() => setSelected(null)}><SvgIcon name="x" size={18} /></button></div>{previewing && <p className="platform-muted">Loading secure preview…</p>}{previewUrl && selected.attributes.media_type.startsWith('image/') && <img className="platform-document-image-preview" src={previewUrl} alt={`Preview of ${selected.attributes.filename}`} />}{previewUrl && selected.attributes.media_type === 'application/pdf' && <object className="platform-document-pdf-preview" data={previewUrl} type="application/pdf" aria-label={`Preview of ${selected.attributes.filename}`}><p>PDF preview is unavailable in this browser. Use Download to open the authorized attachment.</p></object>}<dl className="platform-definition-list"><dt>Classification</dt><dd>{humanStatus(selected.attributes.classification)}</dd><dt>Media type</dt><dd>{selected.attributes.media_type}</dd><dt>Size</dt><dd>{Math.ceil(selected.attributes.size_bytes / 1024)} KB</dd><dt>Lifecycle</dt><dd>{humanStatus(selected.attributes.status)}</dd><dt>Scan policy</dt><dd>{humanStatus(selected.attributes.scan_state)}{selected.attributes.scan_reason ? ` — ${selected.attributes.scan_reason}` : ''}</dd><dt>Version</dt><dd>{selected.attributes.current_version || 'Not available'}</dd></dl><p className="platform-form-note">Preview is limited to PDF, PNG, JPEG, and WebP after fresh authorization. Download remains a separately authorized attachment.</p>{error && <p className="error" role="alert">{error}</p>}<div className="platform-form-actions"><Button variant="secondary" onClick={() => setSelected(null)}>Close</Button><Button busy={busy} disabled={busy || !selected.attributes.current_version_id || selected.attributes.status.toLowerCase() !== 'available'} onClick={() => void download()}><SvgIcon name="download" size={16} /> Download</Button></div></section></div>}</>;
}

function ProviderBusinessSections({ business, documents, reviews, canDecide, onDecision }: { business: ProviderBusinessProfile | null; documents: ProviderDocument[]; reviews: ProviderVerificationReview[]; canDecide: boolean; onDecision: (review: ProviderVerificationReview, decision: string, reason: string) => Promise<void> }) {
  return <>
    <DetailSection title="Business details" description="Review the submitted provider information. Verification does not activate the provider or grant access.">{!business ? <p className="platform-muted">Business profile is not available.</p> : <dl className="platform-definition-list"><dt>Verification status</dt><dd><Status>{humanStatus(business.verification_status)}</Status></dd><dt>Legal name</dt><dd>{business.profile.legal_name || 'Not supplied'}</dd><dt>Registration number</dt><dd>{business.profile.registration_number || 'Not supplied'}</dd><dt>Tax identifier</dt><dd>{business.profile.tax_identifier || 'Not supplied'}</dd><dt>Address</dt><dd>{Object.values(business.profile.address || {}).filter(Boolean).join(', ') || 'Not supplied'}</dd><dt>Profile revision</dt><dd>{business.revision}</dd></dl>}</DetailSection>
    <DetailSection title="Provider documents" description="Preview authoritative metadata and request a freshly authorized attachment download."><PlatformDocumentList providerId={business?.provider_id || ''} documents={documents} /></DetailSection>
    <VerificationReviewList reviews={reviews} canDecide={canDecide} onDecision={onDecision} />
  </>;
}

function ProviderLifecyclePanel({ provider, capabilities, busy, onTransition }: { provider: Resource<PlatformProviderAttributes>; capabilities: string[]; busy: boolean; onTransition: (action: ProviderLifecycleAction, reasonCode: string, reason: string) => Promise<void> }) {
  const [selectedAction, setSelectedAction] = useState<ProviderLifecycleAction | ''>('');
  const [reasonCode, setReasonCode] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const available = lifecycleActions(provider.attributes.status).filter((option) => capabilities.includes(option.capability));
  const option = available.find((item) => item.action === selectedAction);
  const blocker = selectedAction === 'activate' || selectedAction === 'reactivate' ? activationBlocker(provider.attributes.business_verification_status) : '';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!option) { setError('Select an available lifecycle action.'); return; }
    const normalizedCode = reasonCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(normalizedCode)) { setError('Enter a reason code using letters, numbers, and underscores.'); return; }
    if (blocker) { setError(blocker); return; }
    const confirmed = window.confirm(`${option.label}? This changes provider operational access immediately.`);
    if (!confirmed) return;
    try {
      await onTransition(option.action, normalizedCode, reason.trim());
      setSelectedAction(''); setReasonCode(''); setReason('');
    } catch {
      // The parent exposes the authoritative API error without losing the entered reason.
    }
  }
  return <DetailSection title="Operational lifecycle" description="Review approval and provider activation are separate. Lifecycle changes take effect immediately and are audited.">
    <dl className="platform-definition-list"><dt>Current status</dt><dd><Status>{humanStatus(provider.attributes.status)}</Status></dd><dt>Lifecycle revision</dt><dd>{provider.attributes.lifecycle_revision ?? 0}</dd><dt>Business verification</dt><dd><Status>{humanStatus(provider.attributes.business_verification_status)}</Status></dd></dl>
    {!available.length ? <p className="platform-muted">No lifecycle action is available for your platform permissions and the current status.</p> : <form className="platform-lifecycle-form" onSubmit={submit}><label>Action<select value={selectedAction} onChange={(event) => { setSelectedAction(event.target.value as ProviderLifecycleAction); setError(''); }}><option value="">Select action</option>{available.map((item) => <option key={item.action} value={item.action}>{item.label}</option>)}</select></label><label>Reason code<input value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} placeholder="COMPLIANCE_REVIEW" /></label><label className="platform-lifecycle-reason">Explanation <span className="platform-muted">(optional)</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} /></label>{blocker && <p className="platform-field-error" role="alert">{blocker}</p>}{error && <p className="platform-field-error" role="alert">{error}</p>}<div className="platform-form-actions"><Button type="submit" variant={option?.danger ? 'danger' : 'primary'} disabled={!option || busy || Boolean(blocker)} busy={busy}>{option?.label || 'Apply lifecycle action'}</Button></div></form>}
  </DetailSection>;
}

function ProviderOnboardingReview({ provider, business, documents, reviews, capabilities, lifecycleBusy, onDecision, onTransition }: { provider: Resource<PlatformProviderAttributes>; business: ProviderBusinessProfile | null; documents: ProviderDocument[]; reviews: ProviderVerificationReview[]; capabilities: string[]; lifecycleBusy: boolean; onDecision: (review: ProviderVerificationReview, decision: string, reason: string) => Promise<void>; onTransition: (action: ProviderLifecycleAction, reasonCode: string, reason: string) => Promise<void> }) {
  const [contacts, setContacts] = useState<Resource<ProviderOnboardingContactAttributes>[]>([]);
  const [locations, setLocations] = useState<Resource<ProviderOfficeLocationAttributes>[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    Promise.all([operationsData.platformOnboardingContacts(provider.id), operationsData.platformOnboardingLocations(provider.id)])
      .then(([contactPage, locationPage]) => { if (!cancelled) { setContacts(contactPage.data); setLocations(locationPage.data); } })
      .catch((cause) => { if (!cancelled) setError(errorText(cause)); });
    return () => { cancelled = true; };
  }, [provider.id]);
  const pendingReviews = reviews.filter((review) => review.attributes.status === 'PENDING_REVIEW').length;
  return <div className="platform-detail-stack">
    <DetailSection title="Provider identity" description="The provider remains a pending operational boundary until a separately authorized lifecycle command exists.">
      <dl className="platform-definition-list"><dt>Provider</dt><dd>{provider.attributes.display_name}</dd><dt>Provider code</dt><dd>{provider.attributes.provider_code || 'Not supplied'}</dd><dt>Lifecycle</dt><dd><Status>{humanStatus(provider.attributes.status)}</Status></dd><dt>Business verification</dt><dd><Status>{humanStatus(provider.attributes.business_verification_status)}</Status></dd></dl>
    </DetailSection>
    <DetailSection title="Contacts and locations" description="These records support provider coordination only; they create no login, membership, customer access, or service coverage.">
      {error ? <StatePanel title="Onboarding details unavailable"><span>{error}</span></StatePanel> : <dl className="platform-definition-list"><dt>Saved contacts</dt><dd>{contacts.length}</dd><dt>Saved office locations</dt><dd>{locations.length}</dd></dl>}
      <div className="platform-form-actions"><Button variant="secondary" onClick={() => go(`platform/providers/${provider.id}/onboarding/contacts`)}>Review contacts</Button><Button variant="secondary" onClick={() => go(`platform/providers/${provider.id}/onboarding/locations`)}>Review offices</Button></div>
    </DetailSection>
    <ProviderBusinessSections business={business} documents={documents} reviews={reviews} canDecide={capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE')} onDecision={onDecision} />
    <DetailSection title="Readiness" description="Complete evidence review before making a separate operational lifecycle decision.">
      <dl className="platform-definition-list"><dt>Business profile</dt><dd>{humanStatus(business?.verification_status)}</dd><dt>Pending review items</dt><dd>{pendingReviews}</dd><dt>Documents</dt><dd>{documents.length}</dd></dl>
      <p className="platform-form-note">Activation requires a verified business profile. Contacts, offices, documents, administrator setup, and future subscription policy remain visible readiness evidence and do not silently activate the provider.</p>
    </DetailSection>
    <ProviderLifecyclePanel provider={provider} capabilities={capabilities} busy={lifecycleBusy} onTransition={onTransition} />
  </div>;
}

export function PlatformAdminPage({ platformCapabilities = [] }: { platformCapabilities?: string[] } = {}) {
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [providers, setProviders] = useState<Resource<PlatformProviderAttributes>[]>([]);
  const [selected, setSelected] = useState<Resource<PlatformProviderAttributes> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<ProviderBusinessProfile | null>(null);
  const [documents, setDocuments] = useState<ProviderDocument[]>([]);
  const [reviews, setReviews] = useState<ProviderVerificationReview[]>([]);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const route = parsePlatformProviderRoute(window.location.hash);
  const providerId = 'providerId' in route ? route.providerId : '';
  const isNew = route.kind === 'new';
  const isEdit = route.kind === 'edit';
  const isBusinessEdit = route.kind === 'business-profile';
  const isContacts = route.kind === 'contacts';
  const isLocations = route.kind === 'locations';
  const isOnboarding = isContacts || isLocations;
  const isDocuments = route.kind === 'documents';
  const isSubscription = route.kind === 'subscription';
  const isReview = route.kind === 'review';
  const isDetail = route.kind === 'detail';
  const isDirectory = route.kind === 'directory';
  const isUnknown = route.kind === 'unknown';
  async function refreshProvider() {
    if (!providerId) return;
    const [record, profile, documentPage, reviewPage] = await Promise.all([operationsData.platformProvider(providerId), operationsData.platformBusinessProfile(providerId), operationsData.platformDocuments(providerId), operationsData.platformVerificationReviews(providerId)]);
    setSelected(record); setBusiness(profile.data); setDocuments(documentPage.data as ProviderDocument[]); setReviews(reviewPage.data as ProviderVerificationReview[]);
  }
  useEffect(() => { let cancelled = false; if (isNew || isDetail || isEdit || isBusinessEdit || isOnboarding || isDocuments || isSubscription || isReview || isUnknown) return () => { cancelled = true; }; setLoading(true); setError(''); const reads: Promise<unknown>[] = [operationsData.platformProviders()]; if (!isDirectory) reads.push(operationsData.platformOverview()); Promise.all(reads).then((results) => { if (cancelled) return; const collection = results[0] as { data: Resource<PlatformProviderAttributes>[] }; setProviders(collection.data); if (results[1]) setOverview(results[1] as PlatformOverview); setLoading(false); }).catch((cause) => { if (!cancelled) { setError(errorText(cause)); setLoading(false); } }); return () => { cancelled = true; }; }, [isDirectory, isDetail, isDocuments, isEdit, isBusinessEdit, isNew, isOnboarding, isSubscription, isReview, isUnknown]);
  useEffect(() => { if (!providerId) { setSelected(null); setBusiness(null); setDocuments([]); setReviews([]); return; } let cancelled = false; setLoading(true); setError(''); Promise.all([operationsData.platformProvider(providerId), operationsData.platformBusinessProfile(providerId), operationsData.platformDocuments(providerId), operationsData.platformVerificationReviews(providerId)]).then(([record, profile, documentPage, reviewPage]) => { if (!cancelled) { setSelected(record); setBusiness(profile.data); setDocuments(documentPage.data as ProviderDocument[]); setReviews(reviewPage.data as ProviderVerificationReview[]); setLoading(false); } }).catch((cause) => { if (!cancelled) { setError(errorText(cause)); setLoading(false); } }); return () => { cancelled = true; }; }, [providerId]);
  async function decideReview(review: ProviderVerificationReview, decision: string, reason: string) { if (decision !== 'VERIFY' && !reason.trim()) { setError('Add a reason for corrections or rejection.'); return; } try { await operationsData.decideProviderVerificationReview(providerId, review.id, { decision, ...(reason.trim() ? { reason: reason.trim() } : {}), expected_revision: review.attributes.revision }, crypto.randomUUID()); await refreshProvider(); } catch (cause) { setError(errorText(cause)); } }
  async function transitionLifecycle(action: ProviderLifecycleAction, reasonCode: string, reason: string) { if (!selected) return; setLifecycleBusy(true); setError(''); try { const result = await operationsData.transitionPlatformProviderLifecycle(selected.id, action, { expected_revision: selected.attributes.lifecycle_revision ?? 0, reason_code: reasonCode, ...(reason ? { reason } : {}) }, crypto.randomUUID()); setSelected(result.provider); await refreshProvider(); } catch (cause) { setError(errorText(cause)); throw cause; } finally { setLifecycleBusy(false); } }
  const isProviderRecordRoute = isDetail || isEdit || isBusinessEdit || isOnboarding || isDocuments || isSubscription || isReview;
  if (isNew) return <section className="platform-page"><ProviderForm /></section>;
  if (isUnknown) return <section className="platform-page"><PlatformBreadcrumb current="Page not found" /><StatePanel title="Provider page not found"><span>This provider administration route is not available.</span><Button variant="secondary" onClick={() => go('platform/providers')}>Back to providers</Button></StatePanel></section>;
  if (isProviderRecordRoute && loading && !selected) return <StatePanel title="Loading provider profile">Retrieving the latest provider revision…</StatePanel>;
  if (isProviderRecordRoute && error && !selected) return <StatePanel title="Provider profile unavailable"><span>{error}</span><Button onClick={() => window.location.reload()}>Retry</Button></StatePanel>;
  if (isEdit || isBusinessEdit) { if (loading && !selected) return <StatePanel title="Loading provider profile">Retrieving the latest provider revision…</StatePanel>; if (error && !selected) return <StatePanel title="Provider profile unavailable"><span>{error}</span><Button onClick={() => window.location.reload()}>Retry</Button></StatePanel>; return isBusinessEdit && business && selected ? <PlatformBusinessProfileForm providerId={providerId} providerName={selected.attributes.display_name} profile={business} onSaved={refreshProvider} /> : <section className="platform-page"><ProviderForm record={selected || undefined} /></section>; }
  if (isOnboarding && selected) return <ProviderContactsLocationsStep providerId={providerId} providerName={selected.attributes.display_name} tab={isLocations ? 'locations' : 'contacts'} />;
  if (isDocuments && selected) return <section className="platform-page"><PlatformBreadcrumb current={`Documents · ${selected.attributes.display_name}`} /><ProviderOnboardingSteps current={3} providerId={providerId} /><PageHeader eyebrow="Provider onboarding" title="Documents" description="Upload private business-verification evidence, then preview supported images or PDFs and download an authorized attachment." /><ProviderDocumentsStep providerId={providerId} canUpload={platformCapabilities.includes('PLATFORM_PROVIDER_DOCUMENTS')} onChanged={refreshProvider} showDocumentList={false} /><DetailSection title="Preview and download" description="Each action obtains a fresh, short-lived authorization. PDF and image content is loaded into a local browser object URL."><PlatformDocumentList providerId={providerId} documents={documents} /></DetailSection><div className="platform-form-actions"><Button variant="secondary" onClick={() => go(`platform/providers/${providerId}/onboarding/locations`)}>Back to contacts and locations</Button><Button onClick={() => go(`platform/providers/${providerId}/onboarding/subscription`)}>Continue to plan selection</Button></div></section>;
  if (isSubscription && selected) return <section className="platform-page"><PlatformBreadcrumb current={`Plan & approval · ${selected.attributes.display_name}`} /><ProviderOnboardingSteps current={4} providerId={providerId} /><PageHeader eyebrow="Provider onboarding" title="Plan and approval" description="Select a published plan and submit a provider-targeted request. Approval, verified payment, subscription activation, and provider activation remain separate." /><PlatformProviderSubscription providerId={providerId} capabilities={platformCapabilities} onboarding /><div className="platform-form-actions"><Button variant="secondary" onClick={() => go(`platform/providers/${providerId}/onboarding/documents`)}>Back to documents</Button><Button onClick={() => go(`platform/providers/${providerId}/onboarding/review`)}>Continue to final review</Button></div></section>;
  if (isReview && selected) return <section className="platform-page"><PlatformBreadcrumb current={`Review & activate · ${selected.attributes.display_name}`} /><ProviderOnboardingSteps current={5} providerId={providerId} /><PageHeader eyebrow="Provider onboarding" title="Review and activate" description="Review exact submitted evidence, subscription approval status, then make a separate authorized operational lifecycle decision." /><ProviderOnboardingReview provider={selected} business={business} documents={documents} reviews={reviews} capabilities={platformCapabilities} lifecycleBusy={lifecycleBusy} onDecision={decideReview} onTransition={transitionLifecycle} /><PlatformProviderSubscription providerId={providerId} capabilities={platformCapabilities} />{error && <StatePanel title="Provider action needs attention"><span>{error}</span></StatePanel>}<div className="platform-form-actions"><Button variant="secondary" onClick={() => go(`platform/providers/${providerId}/onboarding/subscription`)}>Back to plan selection</Button><Button onClick={() => go(`platform/providers/${providerId}`)}>View provider details</Button></div></section>;
  if (loading && (isDetail ? !selected : !providers.length && !overview)) return <StatePanel title="Loading platform data">Retrieving authorized provider information…</StatePanel>;
  if (error && (isDetail || (!overview && !providers.length))) return <StatePanel title="Platform data is unavailable"><span>{error}</span><Button onClick={() => window.location.reload()}>Retry</Button></StatePanel>;
  if (isDetail && !selected) return <StatePanel title="Provider not found"><span>This provider is not available in the platform directory.</span><Button variant="secondary" onClick={() => go('platform/providers')}>Back to providers</Button></StatePanel>;
  if (isDetail && selected) return <section className="platform-page"><PlatformBreadcrumb current="Provider detail" /><ProviderOnboardingSteps current={-1} providerId={selected.id} /><button className="platform-back" onClick={() => go('platform/providers')}><SvgIcon name="arrow-left" size={16} /> Provider directory</button><PageHeader eyebrow="Provider detail" title={selected.attributes.display_name} description="Lifecycle, business verification, documents and platform history. Use the onboarding steps above to review or edit each section." action={<div className="platform-review-actions"><Button variant="secondary" onClick={() => go(`platform/providers/${selected.id}/onboarding`)}><SvgIcon name="building" size={16} /> Continue onboarding</Button><Button variant="secondary" onClick={() => go(`platform/providers/${selected.id}/edit`)}><SvgIcon name="pencil" size={16} /> Edit provider</Button>{platformCapabilities.includes('PLATFORM_PROVIDER_PROFILE_WRITE') && <Button onClick={() => go(`platform/providers/${selected.id}/business-profile/edit`)}><SvgIcon name="pencil" size={16} /> Edit business profile</Button>}</div>} /><div className="platform-detail-grid"><DetailSection title="Provider summary"><dl className="platform-definition-list"><dt>Status</dt><dd><Status>{humanStatus(selected.attributes.status)}</Status></dd><dt>Business verification</dt><dd><Status>{humanStatus(selected.attributes.business_verification_status)}</Status></dd><dt>Provider code</dt><dd>{selected.attributes.provider_code || 'Not supplied'}</dd><dt>Representation</dt><dd>{selected.attributes.representation || 'Not supplied'}</dd><dt>Administrator setup</dt><dd>{selected.attributes.provider_admin_setup === 'configured' ? 'Configured' : 'Not configured'}</dd><dt>Registered</dt><dd>{formatDate(selected.attributes.effective_from)}</dd></dl></DetailSection><DetailSection title="Platform audit history" description="Readable platform actions are shown with their recorded time.">{selected.attributes.audit_history?.length ? <ul className="platform-audit-list">{selected.attributes.audit_history.map((item, index) => <li key={`${item.action}-${index}`}><div><strong>{auditLabel(item.action)}</strong><small>Platform record</small></div><span>{formatDate(item.occurred_at)}</span></li>)}</ul> : <p className="platform-muted">No platform audit events are available for this provider.</p>}</DetailSection></div><div className="platform-detail-stack"><PlatformProviderSubscription providerId={selected.id} capabilities={platformCapabilities} /><ProviderBusinessSections business={business} documents={documents} reviews={reviews} canDecide={platformCapabilities.includes('PLATFORM_PROVIDER_LIFECYCLE')} onDecision={decideReview} /></div></section>;
  if (isDirectory) return <section className="platform-page"><ProviderDirectory initialProviders={providers} initialError={error} /></section>;
  return <section className="platform-page"><PlatformBreadcrumb current="Overview" /><PageHeader eyebrow="Platform administration" title="Provider overview" description="Authoritative provider status summaries and a read-only directory. This view never changes provider workspace context." action={<Button variant="secondary" onClick={() => go('platform/providers')}><SvgIcon name="building" size={16} /> View provider directory</Button>} />{error && <StatePanel title="Provider overview unavailable"><span>{error}</span><Button onClick={() => window.location.reload()}>Retry</Button></StatePanel>}{overview && <ProviderSummaryCards overview={overview} />}<DetailSection title="Provider directory preview" description="Open the directory for search, filters, and bounded pagination."><ProviderTable providers={providers} /></DetailSection></section>;
}

export function PlatformRoute({ session }: { session: { platformAdmin?: boolean; platformCapabilities?: string[] }; providerId?: string; providerName?: string }) { if (!session.platformAdmin) return <Forbidden />; if (window.location.hash.startsWith('#platform/plans')) return <PlatformPlansPage capabilities={session.platformCapabilities || []} />; if (window.location.hash.startsWith('#platform/subscription')) return <PlatformSubscriptionsPage capabilities={session.platformCapabilities || []} />; return <PlatformAdminPage platformCapabilities={session.platformCapabilities} />; }

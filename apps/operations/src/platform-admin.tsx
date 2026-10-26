import { PlatformRolesPage } from './platform-roles';
import { OperationsDialog } from './operations-dialog';
import { useReviewReason } from './subscription-review';
import { useSubscriptionActions } from './use-subscription-actions';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, DetailSection, FilterToolbar, PageHeader, StatePanel } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { operationsData, type BusinessAuditEvent, type BusinessOperation, type BusinessSummary, type PlatformOverview, type PlatformPlan, type PlatformProviderAdminInvitationAttributes, type PlatformProviderAttributes, type PlatformProviderIdentityDomain, type PlatformProviderMemberAttributes, type PlatformSubscription, type PlatformSubscriptionRequest, type PlatformUsage, type ProviderBusinessProfile, type ProviderDocument, type ProviderLifecycleApproval, type ProviderOnboardingContactAttributes, type ProviderOfficeLocationAttributes, type ProviderOperation, type ProviderVerificationReview, type Resource } from './data';
import { SvgIcon } from './icons';
import { normalizePlatformHash, parsePlatformProviderRoute, providerOnboardingRoute } from './platform-provider-routing';
import { stableSubmissionKey, validateOnboardingContact, validateOnboardingLocation, type FieldErrors } from './provider-onboarding-validation';
import { ProviderBusinessProfileReadDetails, ProviderLogoEditor } from './provider-business-profile';
import { ProviderDocumentsStep } from './provider-documents';
import { activationBlocker, lifecycleActions, type ProviderLifecycleAction } from './provider-lifecycle';
import { PlatformPlansPage } from './platform-plans';
import { PlatformSubscriptionsPage } from './platform-subscriptions';
import { PlatformProviderUsersPage } from './platform-provider-users';
import { ProviderAdminInviteRecipientPicker, type ProviderAdminInviteRecipient } from './provider-admin-invite-recipient';
import { PlatformTeamPage } from './platform-team';
import { formatIndiaDateTime, indiaDateTimeToIso } from './subscription-support';
import { PlatformTaxesPage } from './platform-taxes';
import { PlatformApprovalInbox } from './platform-approval-inbox';
import { PlatformCompliancePage } from './platform-compliance';
import { BusinessCompliancePage } from './business-compliance';
import { RequestGeneration } from './subscription-support';
import { PlatformProviderSubscription } from './platform-provider-subscription';
import { collectPages } from './subscription-support';
import { SearchableSelect } from './searchable-select';
import { administratorSetupLabel, onboardingStateLabel, providerDetailAccess, providerOnboardingStates, providerSetupSummary, usageLimitWarning, type OnboardingState } from './provider-detail-model';
import { confirmOnboardingNavigation, OnboardingEmptyState, OnboardingErrorSummary, OnboardingFormSection, ProviderOnboardingStepper, useOnboardingUnsavedChanges } from './provider-onboarding-ui';
import { ProviderOnboardingReviewDashboard } from './provider-onboarding-review';
import { AdminActionMenu, AdminEmptyState, AdminPageHeader } from './platform-admin-ui';
import { ConfigurationAdmin, ConfigurationAuditInbox, ConfigurationReviewInbox, PLATFORM_CONFIGURATION_TYPES } from './configuration';
import { ReferenceDataAdmin } from './reference-data-admin';
import { PlatformBusinessOperationsPage } from './platform-business-operations';
import { useIndiaGeography } from './use-india-geography';
import { PlatformConfigurationRegistry } from './platform-configuration-reference';
import { ProviderOverridesAdmin } from './provider-overrides-admin';
import { PlatformMaintenancePage } from './platform-maintenance';

const errorText = (error: unknown) => (error as { message?: string })?.message || 'The platform request could not be completed.';
const go = (hash: string) => { if (confirmOnboardingNavigation()) window.location.hash = hash; };
const formatDate = (value?: string | null) => value ? formatIndiaDateTime(value) : 'Not available';
const humanStatus = (value?: string) => value ? value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not submitted';
const commonOperationalStatus = (value?: string) => value === 'ACTIVE' ? 'ACTIVE' : value === 'PENDING' || value === 'PENDING_ACTIVATION' ? 'PENDING' : value === 'CLOSED' ? 'CLOSED' : value === 'BLOCKED' ? 'BLOCKED' : ['ON_HOLD', 'SUSPENDED'].includes(value || '') ? 'RESTRICTED' : 'UNKNOWN';
const auditLabel = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const FieldError = ({ message }: { message?: string }) => message ? <small className="platform-field-error" role="alert">{message}</small> : null;

function Forbidden() {
  return <StatePanel title="Platform administration is restricted">
    <span>Your authenticated account is not an explicit platform administrator.</span>
    <Button variant="secondary" onClick={() => go('overview')}>Back to overview</Button>
  </StatePanel>;
}

function ProviderSummaryCards({ overview }: { overview: PlatformOverview }) {
  const counts = overview.data.provider_counts;
  const cards = [
    ['grid', 'Total providers', overview.data.total_providers, 'All registered provider accounts'],
    ['activity', 'Active', counts.ACTIVE || 0, 'Ready for provider operations'],
    ['activity', 'Pending setup', (counts.PENDING || 0) + (counts.PENDING_ACTIVATION || 0), 'Awaiting onboarding or activation'],
    ['shield', 'Restricted', (counts.ON_HOLD || 0) + (counts.SUSPENDED || 0) + (counts.BLOCKED || 0), 'Held by lifecycle or policy control'],
  ] as const;
  return <div className="platform-summary-grid">
    {cards.map(([icon, label, count, note]) => <article className="platform-summary-card" key={label}><span className="platform-summary-icon"><SvgIcon name={icon} size={18} /></span><div><span>{label}</span><strong>{count}</strong></div><small>{note}</small></article>)}
  </div>;
}

function PlatformOverviewActions() {
  const actions = [
    ['building', 'Service Providers', 'Search accounts, review onboarding and manage lifecycle.', 'platform/providers'],
    ['grid', 'Business Operations', 'Manage business availability and provider access.', 'platform/business-operations'],
    ['settings', 'Configuration', 'Govern governed catalogues, reviews and reference data.', 'platform/configuration'],
    ['shield', 'Approval Inbox', 'Review pending platform changes and requests.', 'platform/compliance'],
  ] as const;
  return <div className="platform-overview-actions">{actions.map(([icon, title, description, route]) => <button type="button" className="platform-overview-action" key={title} onClick={() => go(route)}><span className="platform-summary-icon"><SvgIcon name={icon} size={17} /></span><span><strong>{title}</strong><small>{description}</small></span><SvgIcon name="chevron-right" size={16} /></button>)}</div>;
}

function ProviderTable({ providers, capabilities = [] }: { providers: Resource<PlatformProviderAttributes>[]; capabilities?: string[] }) {
  const canManageLifecycle = capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE') || capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE_REQUEST') || capabilities.includes('PLATFORM_PROVIDER_RESTRICT') || capabilities.includes('PLATFORM_PROVIDER_ACTIVATE');
  if (!providers.length) return <StatePanel title="No providers found">Try a different search or status filter.</StatePanel>;
  return <div className="platform-provider-table-wrap"><table className="platform-provider-table"><caption className="sr-only">Provider directory. Showing loaded records only.</caption><thead><tr><th scope="col">Provider</th><th scope="col">Status</th><th scope="col">Admin setup</th><th scope="col">Registered</th><th scope="col">Actions</th></tr></thead><tbody>{providers.map((item) => <tr key={item.id}><td><div className="platform-record-name"><span className="platform-record-icon" aria-hidden="true"><SvgIcon name="building" size={17} /></span><span><strong>{item.attributes.display_name}</strong></span></div></td><td><Status>{humanStatus(item.attributes.operational_status || commonOperationalStatus(item.attributes.status))}</Status><small className="platform-muted">Lifecycle: {humanStatus(item.attributes.status)}</small></td><td>{item.attributes.provider_admin_setup === 'configured' ? 'Configured' : 'Not configured'}</td><td>{formatDate(item.attributes.effective_from)}</td><td><AdminActionMenu label={`Actions for ${item.attributes.display_name}`}><button type="button" onClick={() => go(`platform/providers/${item.id}`)}>View details</button>{canManageLifecycle && <button type="button" onClick={() => go(`platform/providers/${item.id}/lifecycle`)}>Manage operational lifecycle</button>}<button type="button" onClick={() => go(`platform/providers/${item.id}?tab=business`)}>Business profile</button><button type="button" onClick={() => go(`platform/providers/${item.id}?tab=access`)}>Team &amp; access</button><button type="button" onClick={() => go(`platform/providers/${item.id}?tab=audit`)}>Activity history</button></AdminActionMenu></td></tr>)}</tbody></table></div>;
}

function PlatformBreadcrumb({ current }: { current: string }) {
  return <div className="platform-breadcrumb"><span>Platform administration</span><SvgIcon name="chevron-right" size={14} /><strong>{current}</strong></div>;
}

function ProviderContactsLocationsStep({ providerId, providerName, tab, capabilities, onboardingStates }: { providerId: string; providerName: string; tab: 'contacts' | 'locations'; capabilities: string[]; onboardingStates: OnboardingState[] }) {
  const [contacts, setContacts] = useState<Resource<ProviderOnboardingContactAttributes>[]>([]);
  const [locations, setLocations] = useState<Resource<ProviderOfficeLocationAttributes>[]>([]);
  const [error, setError] = useState('');
  const [contactDialog, setContactDialog] = useState(false);
  const [locationDialog, setLocationDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Resource<ProviderOnboardingContactAttributes> | null>(null);
  const [editingLocation, setEditingLocation] = useState<Resource<ProviderOfficeLocationAttributes> | null>(null);
  const [contactCursor, setContactCursor] = useState<string | null>(null);
  const [locationCursor, setLocationCursor] = useState<string | null>(null);
  const [paging, setPaging] = useState(false);
  const reads = useRef(new RequestGeneration());
  const review = useReviewReason(providerId);
  const ending = useSubscriptionActions(providerId);

  const [busy, setBusy] = useState('');
  const [contactErrors, setContactErrors] = useState<FieldErrors>({});
  const [locationErrors, setLocationErrors] = useState<FieldErrors>({});
  const [contact, setContact] = useState({ display_name: '', email: '', mobile: '', landline: '', phone: '', designation: 'PRIMARY', responsibility_type: 'BUSINESS_CONTACT', invite_as_provider_admin: false });
  const [location, setLocation] = useState({ name: '', location_kind: 'REGISTERED_OFFICE', country: 'India', address_line: '', locality: '', city: '', city_code: '', district: '', district_code: '', state: '', state_code: '', pin_code: '', landmark: '', latitude: '', longitude: '' });
  const geography = useIndiaGeography(location);
  const { stateOptions, districtOptions, cityOptions, stateSearch, setStateSearch, districtSearch, setDistrictSearch, citySearch, setCitySearch, stateCode: selectedStateCode, districtCode: selectedDistrictCode, cityCode: selectedCityCode } = geography;
  const contactKey = useRef<string | null>(null);
  const locationKey = useRef<string | null>(null);
  const contactInitial = useRef('');
  const locationInitial = useRef('');
  const contactInFlight = useRef(false);
  const locationInFlight = useRef(false);

  async function load() {
    const valid = reads.current.next(); setError('');
    try {
      const [contactPage, locationPage] = await Promise.all([operationsData.platformOnboardingContacts(providerId), operationsData.platformOnboardingLocations(providerId)]);
      if (!valid()) return;
      setContacts(contactPage.data); setLocations(locationPage.data); setContactCursor(contactPage.page?.next || null); setLocationCursor(locationPage.page?.next || null);
    } catch (cause) { if (valid()) setError(errorText(cause)); }
  }
  useEffect(() => { void load(); const generation = reads.current; return () => generation.invalidate(); }, [providerId]);
  async function loadMore() {
    if (paging || busy || ending.busy) return;
    const cursor = tab === 'contacts' ? contactCursor : locationCursor; if (!cursor) return;
    const valid = reads.current.next(); setPaging(true); setError('');
    try {
      if (tab === 'contacts') { const page = await operationsData.platformOnboardingContacts(providerId, cursor); if (valid()) { setContacts(rows => [...new Map([...rows, ...page.data].map(row => [row.id, row])).values()]); setContactCursor(page.page?.next || null); } }
      else { const page = await operationsData.platformOnboardingLocations(providerId, cursor); if (valid()) { setLocations(rows => [...new Map([...rows, ...page.data].map(row => [row.id, row])).values()]); setLocationCursor(page.page?.next || null); } }
    } catch (cause) { if (valid()) setError(errorText(cause)); }
    finally { if (valid()) setPaging(false); }
  }
  function editContact(item: Resource<ProviderOnboardingContactAttributes> | null) {
    contactKey.current = null; setContactDialog(true); setEditingContact(item); setContactErrors({});
    const next = item ? { display_name: item.attributes.display_name, email: item.attributes.contact_methods.email || '', mobile: item.attributes.contact_methods.mobile || '', landline: item.attributes.contact_methods.landline || '', phone: item.attributes.contact_methods.phone || '', designation: item.attributes.designation, responsibility_type: item.attributes.responsibility_type, invite_as_provider_admin: false } : { display_name: '', email: '', mobile: '', landline: '', phone: '', designation: 'PRIMARY', responsibility_type: 'BUSINESS_CONTACT', invite_as_provider_admin: false };
    setContact(next); contactInitial.current = JSON.stringify(next);
  }
  function editLocation(item: Resource<ProviderOfficeLocationAttributes> | null) {
    locationKey.current = null; setEditingLocation(item); setLocationErrors({}); setLocationDialog(true);
    const address = item?.attributes.address || {};
    const next = { name: item?.attributes.name || '', location_kind: item?.attributes.location_kind || 'REGISTERED_OFFICE', country: 'India', address_line: address.address_line || '', locality: address.locality || '', city: address.city || '', city_code: address.city_code || '', district: address.district || '', district_code: address.district_code || '', state: address.state || '', state_code: address.state_code || '', pin_code: address.pin_code || '', landmark: address.landmark || '', latitude: item?.attributes.latitude == null ? '' : String(item.attributes.latitude), longitude: item?.attributes.longitude == null ? '' : String(item.attributes.longitude) };
    setLocation(next); locationInitial.current = JSON.stringify(next);
  }
  async function endContact(item: Resource<ProviderOnboardingContactAttributes>) {
    const reason = await review.ask('End onboarding contact'); if (reason === null) return;
    const body = { expected_revision: item.attributes.revision, reason };
    await ending.run(JSON.stringify(['end-contact', providerId, item.attributes.contact_id, body]), key => operationsData.endPlatformOnboardingContact(providerId, item.attributes.contact_id, body, key), async () => { if (editingContact?.id === item.id) { setEditingContact(null); setContactDialog(false); } await load(); });
  }

  async function endLocation(item: Resource<ProviderOfficeLocationAttributes>) {
    const reason = await review.ask('End provider office'); if (reason === null) return;
    const body = { expected_revision: item.attributes.revision, reason };
    await ending.run(JSON.stringify(['end-office', providerId, item.id, body]), key => operationsData.endPlatformOnboardingLocation(providerId, item.id, body, key), async () => { if (editingLocation?.id === item.id) editLocation(null); await load(); });
  }

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
  function chooseLocationReference(key: 'state' | 'district' | 'city', id: string) {
    const options = key === 'state' ? stateOptions : key === 'district' ? districtOptions : cityOptions;
    const selected = options.find((option) => option.id === id);
    setLocation((current) => ({ ...current, [key]: selected?.label || '', [`${key}_code`]: selected?.id || '', ...(key === 'state' ? { district: '', district_code: '', city: '', city_code: '' } : key === 'district' ? { city: '', city_code: '' } : {}) }));
    setLocationErrors((current) => ({ ...current, [key]: '', ...(key === 'state' ? { district: '', city: '' } : key === 'district' ? { city: '' } : {}) }));
    if (key === 'state') { setDistrictSearch(''); setCitySearch(''); }
    if (key === 'district') setCitySearch('');
  }
  const onboardingDirty = (contactDialog && JSON.stringify(contact) !== contactInitial.current) || (locationDialog && JSON.stringify(location) !== locationInitial.current);
  useOnboardingUnsavedChanges(onboardingDirty);
  async function addContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (contactInFlight.current || locationInFlight.current || ending.busy || paging) return;
    const validation = validateOnboardingContact(contact);
    setContactErrors(validation);
    if (Object.keys(validation).length) { setError('Correct the highlighted contact fields.'); return; }
    contactInFlight.current = true; setBusy('contact'); setError('');
    const key = stableSubmissionKey(contactKey.current, () => crypto.randomUUID());
    contactKey.current = key;
    try {
      const body = { ...contact, display_name: contact.display_name.trim(), email: contact.email.trim(), mobile: contact.mobile.trim(), landline: contact.landline.trim() };
      const saved = editingContact ? await operationsData.updatePlatformOnboardingContact(providerId, editingContact.attributes.contact_id, { ...body, expected_revision: editingContact.attributes.revision }, key) : await operationsData.createPlatformOnboardingContact(providerId, body, key);
      setContacts((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      contactKey.current = null;
      setContact({ display_name: '', email: '', mobile: '', landline: '', phone: '', designation: 'PRIMARY', responsibility_type: 'BUSINESS_CONTACT', invite_as_provider_admin: false });
      setContactErrors({}); setEditingContact(null); setContactDialog(false); contactInitial.current = JSON.stringify({ display_name: '', email: '', mobile: '', landline: '', phone: '', designation: 'PRIMARY', responsibility_type: 'BUSINESS_CONTACT', invite_as_provider_admin: false });
      await load();
    } catch (cause) { setError((cause as { message?: string })?.message || 'Contact could not be saved. Retry will reuse the same request key.'); } finally { contactInFlight.current = false; setBusy(''); }
  }
  async function addLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locationInFlight.current || contactInFlight.current || ending.busy || paging) return;
    const validation = validateOnboardingLocation(location);
    setLocationErrors(validation);
    if (Object.keys(validation).length) { setError('Correct the highlighted office fields.'); return; }
    locationInFlight.current = true; setBusy('location'); setError('');
    const latitude = location.latitude.trim() ? Number(location.latitude) : undefined;
    const longitude = location.longitude.trim() ? Number(location.longitude) : undefined;
    const key = stableSubmissionKey(locationKey.current, () => crypto.randomUUID());
    locationKey.current = key;
    try {
      const body = { name: location.name.trim(), location_kind: location.location_kind, address: { country: 'India', country_code: 'IN', address_line: location.address_line.trim(), locality: location.locality.trim(), city: location.city.trim(), city_code: selectedCityCode, district: location.district.trim(), district_code: selectedDistrictCode, state: location.state.trim(), state_code: selectedStateCode, pin_code: location.pin_code.trim(), landmark: location.landmark.trim() }, latitude: latitude ?? null, longitude: longitude ?? null };
      const saved = editingLocation ? await operationsData.updatePlatformOnboardingLocation(providerId, editingLocation.id, { ...body, expected_revision: editingLocation.attributes.revision }, key) : await operationsData.createPlatformOnboardingLocation(providerId, body, key);
      setLocations((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      locationKey.current = null;
      setLocation({ name: '', location_kind: 'REGISTERED_OFFICE', country: 'India', address_line: '', locality: '', city: '', city_code: '', district: '', district_code: '', state: '', state_code: '', pin_code: '', landmark: '', latitude: '', longitude: '' });
      setLocationErrors({}); setEditingLocation(null); setLocationDialog(false);
      await load();
    } catch (cause) { setError((cause as { message?: string })?.message || 'Office location could not be saved. Retry will reuse the same request key.'); } finally { locationInFlight.current = false; setBusy(''); }
  }
  function captureLocation() {
    if (!navigator.geolocation) { setError('This browser does not provide location capture. Enter coordinates manually.'); return; }
    setError(''); navigator.geolocation.getCurrentPosition(({ coords }) => { locationKey.current = null; setLocationErrors((current) => ({ ...current, latitude: '', longitude: '', coordinates: '' })); setLocation((current) => ({ ...current, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) })); }, () => setError('Location permission was not granted. Enter coordinates manually.'));
  }
  return <section className="platform-page">{review.modal}
    <PlatformBreadcrumb current={`Contacts & locations · ${providerName}`} />
    <ProviderOnboardingStepper current={2} providerId={providerId} states={onboardingStates} capabilities={capabilities} />
    <PageHeader eyebrow="Provider onboarding" title={tab === 'contacts' ? 'Provider contacts' : 'Office locations'} description={tab === 'contacts' ? 'Manage provider coordination contacts. These records are separate from authenticated provider members.' : 'Manage registered and operating offices with India address validation and optional coordinates.'} action={tab === 'contacts' ? <Button onClick={() => editContact(null)}>New contact</Button> : <Button onClick={() => editLocation(null)}>New office</Button>} />
    <nav className="platform-onboarding-tabs" aria-label="Onboarding details">
      <button type="button" aria-current={tab === 'contacts' ? 'page' : undefined} className={tab === 'contacts' ? 'active' : ''} onClick={() => go(`platform/providers/${providerId}/onboarding/contacts`)}>Contact details</button>
      <button type="button" aria-current={tab === 'locations' ? 'page' : undefined} className={tab === 'locations' ? 'active' : ''} onClick={() => go(`platform/providers/${providerId}/onboarding/locations`)}>Office location details</button>
    </nav>
    {tab === 'contacts' ? <DetailSection title="Primary and secondary contacts" description="A contact can be used for provider coordination without creating a login or membership.">
      {contactDialog && <OperationsDialog title={editingContact ? 'Edit contact' : 'New contact'} busy={Boolean(busy)} onClose={() => { if (confirmOnboardingNavigation()) setContactDialog(false); }}>{error && <StatePanel title="Contact needs attention">{error}</StatePanel>}<form className="platform-form-grid" onSubmit={addContact}>
        <label>Name <span aria-hidden="true">*</span><input disabled={Boolean(busy) || ending.busy || paging} required aria-invalid={Boolean(contactErrors.display_name)} value={contact.display_name} onChange={(event) => changeContact('display_name', event.target.value)} /><FieldError message={contactErrors.display_name} /></label>
        <label>Designation<select disabled={Boolean(busy) || ending.busy || paging} value={contact.designation} onChange={(event) => changeContact('designation', event.target.value)}><option value="PRIMARY">Primary</option><option value="SECONDARY">Secondary</option></select></label>
        <label>Responsibility<select disabled={Boolean(busy) || ending.busy || paging} value={contact.responsibility_type} onChange={(event) => changeContact('responsibility_type', event.target.value)}><option value="BUSINESS_CONTACT">Business contact</option><option value="CUSTOMER_SUPPORT">Customer support</option></select></label>
        <label>Landline <span className="platform-muted">(optional)</span><input disabled={Boolean(busy) || ending.busy || paging} inputMode="tel" aria-invalid={Boolean(contactErrors.landline)} value={contact.landline} onChange={(event) => changeContact('landline', event.target.value)} /><FieldError message={contactErrors.landline} /></label>
        <label>Mobile <span aria-hidden="true">*</span><input disabled={Boolean(busy) || ending.busy || paging} required inputMode="tel" placeholder="+919876543210" aria-invalid={Boolean(contactErrors.mobile)} value={contact.mobile} onChange={(event) => changeContact('mobile', event.target.value)} /><FieldError message={contactErrors.mobile} /></label>
        <label>Email <span aria-hidden="true">*</span><input disabled={Boolean(busy) || ending.busy || paging} required type="email" aria-invalid={Boolean(contactErrors.email)} value={contact.email} onChange={(event) => changeContact('email', event.target.value)} /><FieldError message={contactErrors.email} /></label>
        {!editingContact && capabilities.includes('PLATFORM_PROVIDER_ADMIN_INVITE') && <label className="platform-checkbox-field"><input type="checkbox" checked={contact.invite_as_provider_admin} disabled={Boolean(busy) || ending.busy || paging} onChange={(event) => setContact((current) => ({ ...current, invite_as_provider_admin: event.target.checked }))} /> Invite as Provider Administrator (requires an existing verified identity)</label>}
        <div className="platform-form-actions"><Button type="submit" busy={busy === 'contact'} disabled={Boolean(busy) || ending.busy || paging}><SvgIcon name="plus" size={16} /> {editingContact ? 'Save contact revision' : 'Add contact'}</Button><Button type="button" variant="secondary" disabled={Boolean(busy) || ending.busy} onClick={() => { if (confirmOnboardingNavigation()) { setContactDialog(false); setEditingContact(null); } }}>Cancel</Button></div>
      </form></OperationsDialog>}
      <div className="platform-provider-table-wrap"><table className="platform-provider-table"><caption className="sr-only">Saved provider onboarding contacts</caption><thead><tr><th scope="col">Name</th><th scope="col">Responsibility</th><th scope="col">Designation</th><th scope="col">Contact</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>{contacts.map((item) => <tr key={item.id}><td><strong>{item.attributes.display_name}</strong></td><td>{item.attributes.responsibility_type.replaceAll('_', ' ')}</td><td>{item.attributes.designation}</td><td>{item.attributes.contact_methods.email || item.attributes.contact_methods.phone}</td><td><Status>{item.attributes.status}</Status></td><td>{item.attributes.status === 'ACTIVE' && <AdminActionMenu label={`Actions for ${item.attributes.display_name}`}><button type="button" disabled={Boolean(busy) || ending.busy || paging} onClick={() => editContact(item)}>Edit</button><button type="button" disabled={Boolean(busy) || ending.busy || paging} onClick={() => void endContact(item)}>End contact</button></AdminActionMenu>}</td></tr>)}</tbody></table>{!contacts.length && <OnboardingEmptyState title="No provider contacts yet" description="Contacts support coordination and do not create a provider login or membership." action={<Button variant="quiet" onClick={() => editContact(null)}>Add contact</Button>} />}</div>
    </DetailSection> : <DetailSection title="Registered and operating offices" description="Select country, State/UT, district and city from canonical India reference data. Enter only the premises-specific address details and PIN.">
      <div className="onboarding-list-toolbar"><span>{locations.length} office records loaded</span><Button onClick={() => editLocation(null)} disabled={Boolean(busy) || ending.busy || paging}>New office</Button></div>
      {locationDialog && <OperationsDialog title={editingLocation ? 'Edit office location' : 'New office location'} busy={Boolean(busy)} onClose={() => { if (confirmOnboardingNavigation()) { setLocationDialog(false); setEditingLocation(null); } }}>{error && <OnboardingErrorSummary title="Office details need attention" errors={[error]} />}<form className="platform-form-grid provider-office-location-form" onSubmit={addLocation}>
        <label>Office name <span aria-hidden="true">*</span><input disabled={Boolean(busy) || ending.busy || paging} required aria-invalid={Boolean(locationErrors.name)} value={location.name} onChange={(event) => changeLocation('name', event.target.value)} /><FieldError message={locationErrors.name} /></label>
        <label>Office type<select disabled={Boolean(busy) || ending.busy || paging} value={location.location_kind} onChange={(event) => changeLocation('location_kind', event.target.value)}><option value="REGISTERED_OFFICE">Registered office</option><option value="OPERATING_OFFICE">Operating office</option></select></label>
        <label className="admin-form-field--full">Address line<input disabled={Boolean(busy) || ending.busy || paging} value={location.address_line} onChange={(event) => changeLocation('address_line', event.target.value)} maxLength={200} /></label>
        <label>Locality / area<input disabled={Boolean(busy) || ending.busy || paging} value={location.locality} onChange={(event) => changeLocation('locality', event.target.value)} maxLength={200} /></label>
        <SearchableSelect label="State / UT" searchLabel="Search Indian states and UTs" search={stateSearch} onSearch={setStateSearch} value={selectedStateCode} onChange={(id) => chooseLocationReference('state', id)} options={stateOptions} placeholder="Select state / UT" required disabled={Boolean(busy) || ending.busy || paging} />
        <SearchableSelect label="District" searchLabel="Search districts in selected state" search={districtSearch} onSearch={setDistrictSearch} value={selectedDistrictCode} onChange={(id) => chooseLocationReference('district', id)} options={districtOptions} placeholder="Select district" required disabled={!selectedStateCode || Boolean(busy) || ending.busy || paging} />
        <SearchableSelect label="City" searchLabel="Search cities in selected district" search={citySearch} onSearch={setCitySearch} value={selectedCityCode} onChange={(id) => chooseLocationReference('city', id)} options={cityOptions} placeholder="Select city" required disabled={!selectedDistrictCode || Boolean(busy) || ending.busy || paging} />
        <label>PIN code <span aria-hidden="true">*</span><input disabled={Boolean(busy) || ending.busy || paging} required aria-invalid={Boolean(locationErrors.pin_code)} value={location.pin_code} onChange={(event) => changeLocation('pin_code', event.target.value)} inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} /><FieldError message={locationErrors.pin_code} /></label>
        <label>Landmark<input disabled={Boolean(busy) || ending.busy || paging} value={location.landmark} onChange={(event) => changeLocation('landmark', event.target.value)} maxLength={200} /></label>
        <label>Country<select disabled={Boolean(busy) || ending.busy || paging} value="IN"><option value="IN">India</option></select></label>
        <label>Latitude <span className="platform-muted">(optional)</span><input disabled={Boolean(busy) || ending.busy || paging} inputMode="decimal" aria-invalid={Boolean(locationErrors.latitude || locationErrors.coordinates)} value={location.latitude} onChange={(event) => changeLocation('latitude', event.target.value)} /><FieldError message={locationErrors.latitude} /></label>
        <label>Longitude <span className="platform-muted">(optional)</span><input disabled={Boolean(busy) || ending.busy || paging} inputMode="decimal" aria-invalid={Boolean(locationErrors.longitude || locationErrors.coordinates)} value={location.longitude} onChange={(event) => changeLocation('longitude', event.target.value)} /><FieldError message={locationErrors.longitude} /></label>
        <div className="platform-form-note">Coordinates are kept as office coordinates. They are not replaced with post-office or PIN coordinates.<FieldError message={locationErrors.coordinates} /></div>
        <div className="platform-form-field-actions"><Button type="button" disabled={Boolean(busy) || ending.busy || paging} variant="secondary" onClick={captureLocation}>Use current location</Button></div>
        <div className="platform-form-actions"><Button type="submit" busy={busy === 'location'} disabled={Boolean(busy) || ending.busy || paging}><SvgIcon name="save" size={16} /> {editingLocation ? 'Save office revision' : 'Save office'}</Button><Button type="button" variant="secondary" disabled={Boolean(busy) || ending.busy} onClick={() => { if (confirmOnboardingNavigation()) { setLocationDialog(false); setEditingLocation(null); } }}>Cancel</Button></div>
      </form></OperationsDialog>}
      <div className="platform-provider-table-wrap"><table className="platform-provider-table"><caption className="sr-only">Saved provider office locations</caption><thead><tr><th scope="col">Office</th><th scope="col">Type</th><th scope="col">Address</th><th scope="col">Coordinates</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>{locations.map((item) => <tr key={item.id}><td><strong>{item.attributes.name}</strong></td><td>{item.attributes.location_kind.replaceAll('_', ' ')}</td><td>{Object.values(item.attributes.address).filter(Boolean).join(', ')}</td><td>{item.attributes.latitude != null && item.attributes.longitude != null ? `${item.attributes.latitude}, ${item.attributes.longitude}` : 'Not captured'}</td><td><Status>{item.attributes.status}</Status></td><td><AdminActionMenu label={`Actions for ${item.attributes.name || 'office'}`}><button type="button" disabled={Boolean(busy) || ending.busy || paging} onClick={() => editLocation(item)}>Edit office</button>{item.attributes.status === 'ACTIVE' && <button type="button" disabled={Boolean(busy) || ending.busy || paging} onClick={() => void endLocation(item)}>End office</button>}</AdminActionMenu></td></tr>)}</tbody></table>{!locations.length && <OnboardingEmptyState title="No offices saved yet" description="Add a registered or operating office to the provider record." action={<Button variant="quiet" onClick={() => editLocation(null)}>Add office</Button>} />}</div>
    </DetailSection>}
    <div className="platform-pagination"><span>{tab === 'contacts' ? contacts.length : locations.length} records loaded</span>{(tab === 'contacts' ? contactCursor : locationCursor) && <Button busy={paging} disabled={Boolean(busy) || ending.busy || paging} onClick={() => void loadMore()}>Load more</Button>}</div>
    {ending.error && <StatePanel title="Contact or office action needs attention">{ending.error}</StatePanel>}
    {error && <StatePanel title="Onboarding change needs attention"><span>{error}</span></StatePanel>}
    <div className="platform-form-actions"><Button type="button" variant="secondary" onClick={() => go(tab === 'locations' ? `platform/providers/${providerId}/onboarding/contacts` : `platform/providers/${providerId}/business-profile/edit`)}><SvgIcon name="arrow-left" size={16} /> Back</Button><Button type="button" onClick={() => go(tab === 'contacts' ? `platform/providers/${providerId}/onboarding/locations` : `platform/providers/${providerId}/onboarding/documents`)}>Continue <SvgIcon name="chevron-right" size={16} /></Button></div>
  </section>;
}

function ProviderDirectory({ initialProviders, initialError }: { initialProviders: Resource<PlatformProviderAttributes>[]; initialError?: string }) {
  const [providers, setProviders] = useState(initialProviders);
  const [creating, setCreating] = useState(false);
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [cursor, setCursor] = useState<{ after: string | null; before: string | null }>({ after: null, before: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || '');
  const [searchError, setSearchError] = useState('');
  const businessId = new URLSearchParams(window.location.hash.split('?')[1] || '').get('business_id') || '';

  const reads = useRef(new RequestGeneration());
  useEffect(() => { void load(); const generation = reads.current; return () => generation.invalidate(); }, []);

  async function load(next: { after?: string | null; before?: string | null; q?: string; status?: string } = {}) {
    const search = (next.q ?? query).trim();
    if (search && search.length < 3) { setSearchError('Enter at least 3 characters to search providers.'); return; }
    setSearchError('');
    const valid = reads.current.next(); setLoading(true); setError('');
    try {
      const result = await operationsData.platformProviders({ q: search, status: next.status ?? status, businessId, after: next.after ?? null, before: next.before ?? null });
      if (!valid()) return;
      setProviders(result.data);
      setCursor({ after: result.page?.next || null, before: result.page?.previous || null });
    } catch (cause) { if (valid()) setError(errorText(cause)); } finally { if (valid()) setLoading(false); }
  }

  function resetFilters() { setQuery(''); setStatus(''); setCursor({ after: null, before: null }); void load({ after: null, before: null, q: '', status: '' }); }
  const resultLabel = loading ? 'Loading providers…' : `Showing ${providers.length} providers on this page`;
  return <>
    {creating && <OperationsDialog title="Register provider" busy={registrationBusy} onClose={() => setCreating(false)}><ProviderForm compact onBusyChange={setRegistrationBusy} onClose={() => setCreating(false)} /></OperationsDialog>}
    <AdminPageHeader breadcrumbs={[{ label: 'Platform Overview', href: 'platform/overview' }, ...(businessId ? [{ label: 'Businesses', href: 'platform/businesses' }] : []), { label: 'Service Providers' }]} eyebrow="Platform" title={businessId ? 'Business service-provider accounts' : 'Service Provider directory'} description={businessId ? 'Service Provider accounts owned by the selected Business. Each account retains its own operation, lifecycle and subscription.' : 'Search and inspect Service Provider metadata without entering provider business data.'} action={<Button onClick={() => { if (businessId) window.location.hash = `platform/providers/new?business_id=${encodeURIComponent(businessId)}`; else setCreating(true); }}><SvgIcon name="plus" size={16} /> Register Service Provider</Button>} />
    {businessId && <p className="platform-form-note">Business filter is applied by the platform API. <Button type="button" variant="quiet" onClick={() => { window.location.hash = 'platform/providers'; }}>Show all providers</Button></p>}
    <FilterToolbar resultLabel={resultLabel}>
      <label>Search providers<input aria-label="Search providers" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void load({ after: null, before: null }); }} placeholder="Name or code · at least 3 characters" /></label>
      <label>Status<select aria-label="Filter providers by status" value={status} onChange={(event) => { setStatus(event.target.value); setCursor({ after: null, before: null }); }}><option value="">All statuses</option><option value="PENDING">Pending</option><option value="PENDING_ACTIVATION">Pending activation</option><option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option><option value="SUSPENDED">Suspended</option><option value="CLOSED">Closed</option></select></label>
      <Button variant="secondary" onClick={() => void load({ after: null, before: null })}><SvgIcon name="filter" size={16} /> Apply filters</Button>
      <Button variant="quiet" onClick={resetFilters}><SvgIcon name="x" size={16} /> Clear</Button>
    </FilterToolbar>
    {searchError && <p role="alert" className="platform-field-error">{searchError}</p>}
    {error && <StatePanel title="Provider directory unavailable"><span>{error}</span><Button onClick={() => void load()}>Retry</Button></StatePanel>}
    {!error && <><ProviderTable providers={providers} /><div className="platform-pagination"><Button variant="secondary" disabled={!cursor.before || loading} onClick={() => { if (cursor.before) void load({ before: cursor.before }); }}><SvgIcon name="chevron-left" size={16} /> Previous</Button><span>{resultLabel}</span><Button variant="secondary" disabled={!cursor.after || loading} onClick={() => { if (cursor.after) void load({ after: cursor.after }); }}>Next <SvgIcon name="chevron-right" size={16} /></Button></div></>}
  </>;
}

function BusinessDirectory({ capabilities = [] }: { capabilities?: string[] }) {
  const operationsMode = true;
  const [businesses, setBusinesses] = useState<Resource<BusinessSummary>[]>([]);
  const [query, setQuery] = useState(new URLSearchParams(window.location.hash.split('?')[1] || '').get('q') || '');
  const [appliedQuery, setAppliedQuery] = useState(query);
  const [status, setStatus] = useState('');
  const [pageCursor, setPageCursor] = useState<{ after: string | null; before: string | null }>({ after: null, before: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reads = useRef(new RequestGeneration());
  const [identityBusiness, setIdentityBusiness] = useState<Resource<BusinessSummary> | null>(null);
  const [businessTransition, setBusinessTransition] = useState<{ business: Resource<BusinessSummary>; action: 'restrict' | 'reactivate' } | null>(null);
  const [businessReason, setBusinessReason] = useState('');
  const [businessRestrictionType, setBusinessRestrictionType] = useState('TEMPORARY_MAINTENANCE');
  const [businessRestrictionEndsAt, setBusinessRestrictionEndsAt] = useState('');
  const [businessTransitionBusy, setBusinessTransitionBusy] = useState(false);
  const [providerBusiness, setProviderBusiness] = useState<Resource<BusinessSummary> | null>(null);
  const [businessProviders, setBusinessProviders] = useState<Resource<PlatformProviderAttributes>[]>([]);
  const [businessProvidersLoading, setBusinessProvidersLoading] = useState(false);
  const [auditBusiness, setAuditBusiness] = useState<Resource<BusinessSummary> | null>(null);
  const [auditEvents, setAuditEvents] = useState<BusinessAuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');

  const load = useCallback(async (search: string, cursor: { after?: string; before?: string } = {}, selectedStatus = status) => {
    const valid = reads.current.next(); setLoading(true); setError('');
    try {
      const page = await operationsData.platformBusinesses({ ...(search ? { q: search } : {}), ...(selectedStatus ? { status: selectedStatus } : {}), ...(cursor.after ? { after: cursor.after } : {}), ...(cursor.before ? { before: cursor.before } : {}) });
      if (!valid()) return;
      setBusinesses(page.data);
      setPageCursor({ after: page.page?.next || null, before: page.page?.previous || null }); setAppliedQuery(search);
    } catch (cause) { if (valid()) setError(errorText(cause)); }
    finally { if (valid()) setLoading(false); }
  }, [status]);

  useEffect(() => { void load(new URLSearchParams(window.location.hash.split('?')[1] || '').get('q') || ''); return () => { reads.current.invalidate(); }; }, [load]);
  function search() {
    const value = query.trim();
    if (value && value.length < 3) { setError('Business search requires at least 3 characters.'); return; }
    void load(value, {}, status);
  }
  async function transitionBusiness() {
    if (!businessTransition || businessReason.trim().length < 3) return;
    setBusinessTransitionBusy(true); setError('');
    try {
      const { business, action } = businessTransition;
      await operationsData.transitionPlatformBusiness(business.id, action, { expected_revision: business.attributes.revision, reason: businessReason.trim(), ...(action === 'restrict' ? { restriction_type: businessRestrictionType, ...(businessRestrictionEndsAt ? { restriction_ends_at: indiaDateTimeToIso(businessRestrictionEndsAt) } : {}) } : {}) }, crypto.randomUUID());
      setBusinessTransition(null); setBusinessReason(''); setBusinessRestrictionEndsAt('');
      await load(appliedQuery);
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusinessTransitionBusy(false); }
  }
  async function openProviders(business: Resource<BusinessSummary>) {
    setProviderBusiness(business); setBusinessProvidersLoading(true); setError('');
    try { setBusinessProviders((await operationsData.platformProviders({ businessId: business.id })).data); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusinessProvidersLoading(false); }
  }
  async function openAudit(business: Resource<BusinessSummary>) {
    setAuditBusiness(business); setAuditEvents([]); setAuditLoading(true); setAuditError('');
    try { setAuditEvents((await operationsData.platformBusinessComplianceHistory(business.id, 'audit', 1, 100)).data as BusinessAuditEvent[]); }
    catch (cause) { setAuditError(errorText(cause)); }
    finally { setAuditLoading(false); }
  }
  return <>
    <AdminPageHeader breadcrumbs={[{ label: 'Platform Overview', href: 'platform/overview' }, { label: operationsMode ? 'Business Operations' : 'Businesses' }]} eyebrow="Platform" title={operationsMode ? 'Business Operations' : 'Businesses'} description={operationsMode ? 'Central maintenance console for Business status, provider access and immutable audit history.' : 'Business directory and identity records. Use Business Operations for maintenance actions and audit history.'} action={operationsMode ? <Button onClick={() => { window.location.hash = 'platform/providers/new'; }}>Register provider account</Button> : undefined} />
    <FilterToolbar resultLabel={loading ? 'Loading businesses…' : `${businesses.length} businesses loaded`}>
      <label>Search businesses<input aria-label="Search businesses" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') search(); }} placeholder="Business name · at least 3 characters" /></label>
      <label>Status<select aria-label="Filter businesses by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option><option value="SUSPENDED">Suspended</option><option value="BLOCKED">Blocked</option><option value="CLOSED">Closed</option></select></label>
      <Button variant="secondary" onClick={search}><SvgIcon name="filter" size={16} /> Search</Button>
      <Button variant="quiet" onClick={() => { setQuery(''); setStatus(''); void load('', {}, ''); }}>Clear</Button>
    </FilterToolbar>
    {error && <StatePanel title="Business directory needs attention"><span>{error}</span><Button variant="secondary" onClick={() => void load(appliedQuery)}>Retry</Button></StatePanel>}
    {!error && businesses.length === 0 && !loading && <AdminEmptyState title="No Businesses found" description={appliedQuery ? 'Try a different Business name.' : 'Businesses are created when the first provider account is registered.'} action={<Button onClick={() => { window.location.hash = 'platform/providers/new'; }}>Register first provider account</Button>} />}
    {!error && businesses.length > 0 && <div className="platform-provider-table-wrap business-directory-table-wrap"><table className="platform-provider-table platform-business-directory-table"><caption className="sr-only">{operationsMode ? 'Business maintenance console' : 'Business directory'}, showing paginated records.</caption><thead><tr><th scope="col">Business</th><th scope="col">Status</th><th scope="col">Provider accounts</th><th scope="col">Account structure</th><th scope="col">Actions</th></tr></thead><tbody>{businesses.map((business) => <tr key={business.id}><td data-label="Business"><div className="platform-record-name"><span className="platform-record-icon" aria-hidden="true"><SvgIcon name="building" size={17} /></span><span><strong>{business.attributes.name}</strong><small>Business profile and provider accounts</small></span></div></td><td data-label="Status"><Status>{humanStatus(business.attributes.operational_status || business.attributes.status)}</Status>{business.attributes.operational_status_reason && <small className="platform-muted">{business.attributes.operational_status_reason}</small>}{business.attributes.operational_status && business.attributes.operational_status !== business.attributes.status && <small className="platform-muted">Lifecycle: {humanStatus(business.attributes.status)}</small>}</td><td data-label="Provider accounts">{business.attributes.provider_count}</td><td data-label="Account structure">Provider access is managed per account</td><td data-label="Actions"><AdminActionMenu label={`Actions for ${business.attributes.name}`}><button type="button" onClick={() => { window.location.hash = `platform/businesses/${encodeURIComponent(business.id)}`; }}>Open Business details</button>{operationsMode && <button type="button" onClick={() => void openAudit(business)}>View audit log</button>}<button type="button" onClick={() => void openProviders(business)}>View provider accounts</button>{capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE') && <button type="button" onClick={() => setIdentityBusiness(business)}>Identity domains</button>}{operationsMode && capabilities.includes('PLATFORM_PROVIDER_RESTRICT') && <><button type="button" onClick={() => { setBusinessReason(''); setBusinessTransition({ business, action: 'restrict' }); }}>Restrict business</button>{business.attributes.business_status && business.attributes.business_status !== 'ACTIVE' && <button type="button" onClick={() => { setBusinessReason(''); setBusinessTransition({ business, action: 'reactivate' }); }}>Reactivate business</button>}</>}<button type="button" onClick={() => { window.location.hash = `platform/providers/new?business_id=${encodeURIComponent(business.id)}`; }}>Add provider account</button></AdminActionMenu></td></tr>)}</tbody></table></div>}
    {providerBusiness && <DetailSection title={`Provider accounts · ${providerBusiness.attributes.name}`} description="Manage provider accounts owned by this Business from the central Business Operations workspace."><div className="platform-form-actions"><Button variant="quiet" onClick={() => setProviderBusiness(null)}>Close provider view</Button><Button onClick={() => { window.location.hash = `platform/providers/new?business_id=${encodeURIComponent(providerBusiness.id)}`; }}>Add provider account</Button></div>{businessProvidersLoading ? <p className="platform-muted">Loading provider accounts…</p> : <ProviderTable providers={businessProviders} capabilities={capabilities} />}</DetailSection>}
    {operationsMode && auditBusiness && <DetailSection title={`Audit log · ${auditBusiness.attributes.name}`} description="Immutable Business and compliance change events for maintenance review."><div className="platform-form-actions"><Button variant="quiet" onClick={() => setAuditBusiness(null)}>Close audit log</Button></div>{auditLoading ? <p className="platform-muted" role="status">Loading audit events…</p> : auditError ? <StatePanel title="Audit log unavailable"><span>{auditError}</span><Button onClick={() => void openAudit(auditBusiness)}>Retry</Button></StatePanel> : auditEvents.length ? <div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Action</th><th>Resource</th><th>Occurred</th><th>Actor</th></tr></thead><tbody>{auditEvents.map((event) => <tr key={event.id}><td>{auditLabel(event.action)}</td><td>{event.resource_kind}</td><td>{formatDate(event.occurred_at)}</td><td>{event.actor_user_id || 'System'}</td></tr>)}</tbody></table></div> : <AdminEmptyState title="No audit events" description="Business maintenance and compliance events will appear here." />}</DetailSection>}
    {identityBusiness && <ProviderIdentityDomainsPanel businessId={identityBusiness.id} businessName={identityBusiness.attributes.name} capabilities={capabilities} />}
    {businessTransition && <OperationsDialog title={`${businessTransition.action === 'reactivate' ? 'Reactivate' : 'Restrict'} · ${businessTransition.business.attributes.name}`} busy={businessTransitionBusy} onClose={() => { if (!businessTransitionBusy) { setBusinessTransition(null); setBusinessReason(''); setBusinessRestrictionEndsAt(''); } }}><form className="platform-form-grid" onSubmit={(event) => { event.preventDefault(); void transitionBusiness(); }}><p className="platform-form-note">This action applies the common Business operational status. A restricted Business blocks provider activity across all provider accounts under it.</p>{businessTransition.action === 'restrict' && <><label>Restriction type *<select value={businessRestrictionType} disabled={businessTransitionBusy} onChange={(event) => setBusinessRestrictionType(event.target.value)}><option value="TEMPORARY_MAINTENANCE">Temporary maintenance</option><option value="POLICY_REVIEW">Policy review</option><option value="SECURITY">Security</option><option value="COMPLIANCE">Compliance</option><option value="ADMINISTRATIVE">Administrative</option></select></label><label>Automatic reactivation (optional)<input type="datetime-local" value={businessRestrictionEndsAt} disabled={businessTransitionBusy} onChange={(event) => setBusinessRestrictionEndsAt(event.target.value)} /></label></>}<label>Reason *<textarea required minLength={3} maxLength={1000} rows={4} value={businessReason} disabled={businessTransitionBusy} onChange={(event) => setBusinessReason(event.target.value)} /></label><div className="platform-form-actions"><Button type="button" variant="secondary" disabled={businessTransitionBusy} onClick={() => { setBusinessTransition(null); setBusinessReason(''); setBusinessRestrictionEndsAt(''); }}>Cancel</Button><Button type="submit" variant={businessTransition.action === 'reactivate' ? 'primary' : 'danger'} busy={businessTransitionBusy} disabled={businessReason.trim().length < 3}>{businessTransition.action === 'reactivate' ? 'Confirm reactivation' : 'Confirm restriction'}</Button></div></form></OperationsDialog>}
    <div className="platform-pagination"><span>{businesses.length} businesses on this page{loading ? ' · loading' : ''}</span><div><Button variant="secondary" disabled={!pageCursor.before || loading} onClick={() => { if (pageCursor.before) void load(appliedQuery, { before: pageCursor.before }); }}><SvgIcon name="chevron-left" size={16} /> Previous</Button><Button variant="secondary" busy={loading} disabled={!pageCursor.after || loading} onClick={() => { if (pageCursor.after) void load(appliedQuery, { after: pageCursor.after }); }}>Next <SvgIcon name="chevron-right" size={16} /></Button></div></div>
  </>;
}

function ProviderForm({ record, compact = false, onClose, onBusyChange, capabilities = [] }: { record?: Resource<PlatformProviderAttributes>; compact?: boolean; onClose?: () => void; onBusyChange?: (busy: boolean) => void; capabilities?: string[] }) {
  const editing = Boolean(record);
  const initialBusinessId = new URLSearchParams(window.location.hash.split('?')[1] || '').get('business_id') || '';
  const [name, setName] = useState(record?.attributes.display_name || '');
  const [code, setCode] = useState(record?.attributes.provider_code || '');
  const representation = 'ORGANIZATION';
  const [businesses, setBusinesses] = useState<Resource<BusinessSummary>[]>([]);
  const [operationCatalog, setOperationCatalog] = useState<BusinessOperation[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(!editing);
  const [catalogError, setCatalogError] = useState('');
  const [useExistingBusiness, setUseExistingBusiness] = useState(Boolean(initialBusinessId));
  const [businessId, setBusinessId] = useState(initialBusinessId);
  const [businessName, setBusinessName] = useState('');
  const [businessSearch, setBusinessSearch] = useState('');
  const [operationId, setOperationId] = useState('');
  const [operationSearch, setOperationSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) return;
    let active = true;
    Promise.all([
      collectPages((after) => operationsData.platformBusinesses({ after })),
      operationsData.businessOperations()
    ]).then(([businessRows, operationRows]) => {
      if (!active) return;
      setBusinesses(businessRows); setOperationCatalog(operationRows.data);
      setUseExistingBusiness(businessRows.length > 0);
    }).catch((cause) => { if (active) setCatalogError(errorText(cause)); })
      .finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [editing]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const trimmedName = name.trim(); const trimmedCode = code.trim();
    if (!trimmedName) { setError('Enter a provider name.'); return; }
    if (trimmedCode && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(trimmedCode)) { setError('Use up to 100 letters, numbers, dots, underscores, or hyphens for the provider code.'); return; }
    if (!editing && catalogLoading) { setError('Wait for Business and Business Operation options to load.'); return; }
    if (!editing && !operationId) { setError('Select one Business Operation for this provider account.'); return; }
    if (!editing && useExistingBusiness && !businessId) { setError('Select an existing Business.'); return; }
    if (!editing && !useExistingBusiness && !businessName.trim()) { setError('Enter the new Business name.'); return; }
    setSaving(true); onBusyChange?.(true);
    try {
      const key = `platform-provider-${editing ? record?.id : 'new'}-${Date.now()}`;
      const result = editing
        ? await operationsData.updatePlatformProvider(record!.id, { name: trimmedName, representation_kind: representation, provider_code: trimmedCode || null, expected_revision: record!.attributes.revision || 0 }, key)
        : await (async () => {
          const session = await operationsData.createPlatformProviderOnboardingSession(useExistingBusiness ? { business_id: businessId, current_step: 'BUSINESS_IDENTIFICATION', draft: { provider_name: trimmedName, provider_code: trimmedCode || null, business_operation_type_id: operationId } } : { business_name: businessName.trim(), current_step: 'BUSINESS_IDENTIFICATION', draft: { provider_name: trimmedName, provider_code: trimmedCode || null, business_operation_type_id: operationId } }, `provider-onboarding-session-${key}`);
          const created = await operationsData.createPlatformProvider({ name: trimmedName, representation_kind: representation, provider_code: trimmedCode || undefined, business_id: session.attributes.business_id, business_operation_type_id: operationId }, key);
          await operationsData.updatePlatformProviderOnboardingSession(session.id, { expected_revision: session.attributes.revision, current_step: 'LEGAL_IDENTITY', status: 'INCOMPLETE', provider_id: created.id }, `provider-onboarding-session-link-${session.id}`);
          return created;
        })();
      go(`platform/providers/${result.id}/business-profile/edit`);
    } catch (cause) { setError(errorText(cause)); } finally { setSaving(false); onBusyChange?.(false); }
  }

  return <section className="platform-form-card">
    {editing && <div className="on-behalf-banner" role="note"><strong>Editing as Platform Administrator</strong><span>Provider account changes are attributed to your platform identity and remain revisioned and audited.</span></div>}
    {!compact && <><PlatformBreadcrumb current={editing ? 'Edit provider account' : 'New provider account'} /><ProviderOnboardingStepper current={0} providerId={record?.id || ''} capabilities={capabilities} /><PageHeader eyebrow="Platform" title={editing ? 'Edit provider profile' : 'Register provider account'} description={initialBusinessId ? 'Add an operation-specific provider account to the selected Business. This account will have one Business Operation and its own subscription.' : 'A Business can have several operation-specific provider accounts. Each account has one Business Operation and one current subscription.'} /></>}
    <form onSubmit={submit} className="platform-form">
      <div className="platform-form-section"><h2>Provider account</h2><p className="platform-muted">Use the operation-specific account name that platform staff will recognize.</p>
        <label className="admin-form-field--full">Provider name <span aria-hidden="true">*</span><input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="organization" /></label>
        <label>Representation kind <span aria-hidden="true">*</span><input value="Organization" readOnly aria-describedby="representation-help" /><span id="representation-help" className="platform-muted">The current provider contract supports organization records.</span></label>
        <label>Provider code <span className="platform-muted">(optional)</span><input value={code} onChange={(event) => setCode(event.target.value)} maxLength={100} placeholder="Example: LIFT-RISE" /></label>
      </div>
      {!editing && <div className="platform-form-section"><h2>Business association</h2><p className="platform-muted">Choose the parent Business and the single operation this provider account will manage.</p>
        {catalogError && <StatePanel title="Registration options unavailable"><span>{catalogError}</span><Button type="button" variant="secondary" onClick={() => window.location.reload()}>Reload</Button></StatePanel>}
        {catalogLoading ? <p className="platform-muted">Loading Business and operation options…</p> : <>
          {businesses.length > 0 && <fieldset className="platform-form-choice"><legend>Business selection</legend><label><input type="radio" name="business-mode" checked={useExistingBusiness} onChange={() => { setUseExistingBusiness(true); setBusinessName(''); setBusinessId(''); }} /> Existing Business</label><label><input type="radio" name="business-mode" checked={!useExistingBusiness} onChange={() => { setUseExistingBusiness(false); setBusinessId(''); }} /> New Business</label></fieldset>}
          {useExistingBusiness && businesses.length > 0 ? <SearchableSelect label="Business" searchLabel="Search Business by name" search={businessSearch} onSearch={setBusinessSearch} value={businessId} onChange={setBusinessId} options={businesses.map((business) => ({ id: business.id, label: business.attributes.name, detail: `${business.attributes.provider_count} provider account${business.attributes.provider_count === 1 ? '' : 's'}` }))} placeholder="Select a Business" required /> : <label>New Business name <span aria-hidden="true">*</span><input required maxLength={200} value={businessName} onChange={(event) => setBusinessName(event.target.value)} autoComplete="organization" /></label>}
          <SearchableSelect label="Business Operation" searchLabel="Search Business Operations" search={operationSearch} onSearch={setOperationSearch} value={operationId} onChange={setOperationId} options={operationCatalog.filter((item) => item.attributes.is_active && item.attributes.is_selectable).map((item) => ({ id: item.id, label: item.attributes.name, detail: item.attributes.industry_key ? humanStatus(item.attributes.industry_key) : 'Industry not specified' }))} placeholder="Select one operation" required />
          <p className="platform-form-note">This provider account will be associated with exactly one operation. Published subscription plans will be filtered to plans applicable to that operation.</p>
        </>}</div>}
      {editing && <p className="platform-form-note">Current lifecycle: <Status>{record?.attributes.status}</Status> Changes here do not activate or suspend the provider.</p>}
      {error && <StatePanel title="Provider profile could not be saved"><span>{error}</span></StatePanel>}
      <div className="platform-form-actions"><Button type="button" variant="secondary" disabled={saving} onClick={() => onClose ? onClose() : go(editing ? `platform/providers/${record!.id}` : initialBusinessId ? 'platform/businesses' : 'platform/providers')}><SvgIcon name="arrow-left" size={16} /> Cancel</Button><Button type="submit" disabled={saving || (!editing && catalogLoading)}>{saving ? 'Saving…' : editing ? <><SvgIcon name="save" size={16} /> Save provider profile</> : <><SvgIcon name="plus" size={16} /> Create provider account</>}</Button></div>
    </form>
  </section>;
}

function PlatformBusinessProfileForm({ providerId, businessId, providerName, providerStatus, profile, onSaved, capabilities, onboardingStates }: { providerId: string; businessId: string; providerName: string; providerStatus: string; profile: ProviderBusinessProfile; onSaved: () => void | Promise<void>; capabilities: string[]; onboardingStates: OnboardingState[] }) {
  const [fields, setFields] = useState({ ...profile.profile, address: { ...(profile.profile.address || {}) } });
  const geography = useIndiaGeography(fields.address as Record<string, unknown>);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [operationCatalog, setOperationCatalog] = useState<BusinessOperation[]>([]);
  const [savedOperation, setSavedOperation] = useState<ProviderOperation['attributes']['business_operation'] | null>(null);
  const [selectedOperationId, setSelectedOperationId] = useState('');
  const [initialOperationId, setInitialOperationId] = useState('');
  const [operationRevision, setOperationRevision] = useState(0);
  const [operationSearch, setOperationSearch] = useState('');
  const [operationLoading, setOperationLoading] = useState(true);
  const [confirmOperationChange, setConfirmOperationChange] = useState(false);
  const [canonicalBusiness, setCanonicalBusiness] = useState<BusinessSummary | null>(null);
  const [legalConstitution, setLegalConstitution] = useState('');
  const [legalCountry, setLegalCountry] = useState('IN');
  const [legalDate, setLegalDate] = useState('');
  const [legalRequest, setLegalRequest] = useState<import('./data').PlatformComplianceRequest | null>(null);
  const [legalSaving, setLegalSaving] = useState(false);
  const canChangeOperation = (capabilities.includes('PLATFORM_PROVIDER_PROFILE_WRITE') || capabilities.includes('PLATFORM_PROVIDER_BUSINESS_WRITE')) && ['PENDING', 'PENDING_ACTIVATION'].includes(providerStatus) && profile.verification_status !== 'PENDING_REVIEW';
  useEffect(() => { let current = true; setOperationLoading(true); Promise.all([operationsData.businessOperations(), operationsData.platformProviderOperations(providerId)]).then(([catalogue, configured]) => { if (!current) return; setOperationCatalog(catalogue.data); const active = configured.data.find((row) => row.attributes.status === 'ACTIVE'); const id = active?.attributes.business_operation.id || ''; setSavedOperation(active?.attributes.business_operation || null); setSelectedOperationId(id); setInitialOperationId(id); setOperationRevision(configured.revision); }).catch((cause) => { if (current) setError(errorText(cause)); }).finally(() => { if (current) setOperationLoading(false); }); return () => { current = false; }; }, [providerId]);
  useEffect(() => { if (!businessId) return undefined; let current = true; Promise.all([operationsData.platformBusiness(businessId), operationsData.platformComplianceRequests(undefined, businessId, { history: true, perPage: 100 })]).then(([business, requests]) => { if (!current) return; const summary = business.data.attributes; setCanonicalBusiness(summary); const pending = requests.data.find((request) => request.attributes.record.attributes.requirement_code === 'BUSINESS_LEGAL_IDENTITY' && ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'CORRECTIONS_REQUESTED'].includes(request.attributes.status)); setLegalRequest(pending || null); const values = pending?.attributes.proposed_values || {}; setLegalConstitution(String(values.business_constitution_code || summary.legal_profile?.business_constitution_code || '')); setLegalCountry(String(values.country_code || summary.legal_profile?.country_code || 'IN')); setLegalDate(String(values.incorporation_or_commencement_date || summary.legal_profile?.incorporation_or_commencement_date || '')); }).catch((cause) => { if (current) setError(errorText(cause)); }); return () => { current = false; }; }, [businessId]);
  const isDirty = JSON.stringify(fields) !== JSON.stringify({ ...profile.profile, address: { ...(profile.profile.address || {}) } });
  const operationsDirty = selectedOperationId !== initialOperationId;
  useOnboardingUnsavedChanges(isDirty || operationsDirty);
  const change = (key: string, value: string) => setFields((current) => ({ ...current, [key]: value }));
  const changeAddress = (key: string, value: string) => setFields((current) => ({ ...current, address: { ...(current.address || {}), [key]: value } }));
  const chooseAddressReference = (key: 'state' | 'district' | 'city', id: string) => {
    const options = key === 'state' ? geography.stateOptions : key === 'district' ? geography.districtOptions : geography.cityOptions;
    const selected = options.find((option) => option.id === id);
    setFields((current) => ({ ...current, address: { ...(current.address || {}), [key]: selected?.label || '', [`${key}_code`]: selected?.id || '', ...(key === 'state' ? { district: '', district_code: '', city: '', city_code: '' } : key === 'district' ? { city: '', city_code: '' } : {}) } }));
    if (key === 'state') { geography.setDistrictSearch(''); geography.setCitySearch(''); }
    if (key === 'district') geography.setCitySearch('');
  };
  const validate = () => !fields.legal_name?.trim() ? 'Legal name is required.' : !fields.address?.city?.trim() ? 'City is required.' : !fields.address?.state?.trim() ? 'State is required.' : !fields.address?.pin_code?.trim() ? 'PIN code is required.' : '';
  async function persistSave() { setError(''); setMessage(''); if (operationsDirty && isDirty) { setError('Save the business-profile fields and Business Operation in separate steps.'); return; } if (!selectedOperationId) { setError('Select one Business Operation for this provider account.'); return; } setSaving(true); try { if (operationsDirty) { const configured = await operationsData.replacePlatformProviderOperations(providerId, { expected_revision: operationRevision, operations: [{ business_operation_type_id: selectedOperationId, is_primary: true }] }, `platform-provider-operations-${providerId}-${operationRevision}`); setOperationRevision(configured.revision); setInitialOperationId(selectedOperationId); } if (isDirty) { const address = { ...(fields.address || {}), country: 'India', country_code: 'IN', ...(geography.stateCode ? { state_code: geography.stateCode } : {}), ...(geography.districtCode ? { district_code: geography.districtCode } : {}), ...(geography.cityCode ? { city_code: geography.cityCode } : {}) }; const result = await operationsData.updatePlatformBusinessProfile(providerId, { business_profile: { ...fields, address }, expected_revision: profile.revision }, `platform-business-profile-${providerId}-${profile.revision}`); setMessage(result.data.verification_status === 'NOT_SUBMITTED' && profile.verification_status === 'VERIFIED' ? 'Draft saved. This material change requires a new review.' : 'Business profile draft saved.'); } else if (operationsDirty) setMessage('Business Operation updated for this provider account.'); setConfirmOperationChange(false); await onSaved(); } catch (cause) { setError(errorText(cause)); } finally { setSaving(false); } }
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(''); const invalid = validate(); if (invalid) { setError(invalid); return; } if (operationLoading) { setError('Wait for the provider Business Operation to load.'); return; } if (!selectedOperationId) { setError('Select one Business Operation for this provider account.'); return; } if (operationsDirty && isDirty) { setError('Save the business-profile fields and Business Operation in separate steps.'); return; } if (operationsDirty) { setConfirmOperationChange(true); return; } await persistSave(); }
  async function submit() { setError(''); setMessage(''); const invalid = validate(); if (invalid) { setError(invalid); return; } if (!selectedOperationId) { setError('Select one Business Operation for this provider account.'); return; } if (isDirty || operationsDirty) { setError('Save the current draft before submitting it for review.'); return; } setSubmitting(true); try { await operationsData.submitPlatformBusinessProfile(providerId, profile.revision, `platform-business-profile-submit-${providerId}-${profile.revision}`); setMessage('Submitted on behalf of the provider for platform review.'); await onSaved(); } catch (cause) { setError(errorText(cause)); } finally { setSubmitting(false); } }
  async function submitLegalIdentity() { setError(''); setMessage(''); if (!businessId || !legalConstitution || !legalCountry) { setError('Business constitution and country are required.'); return; } if (!fields.legal_name?.trim()) { setError('Legal name is required.'); return; } setLegalSaving(true); try { let request = legalRequest; if (!request) { await operationsData.createPlatformBusinessLegalProfile(businessId, { proposed_values: { legal_name: fields.legal_name.trim(), business_constitution_code: legalConstitution, country_code: legalCountry, ...(legalDate ? { incorporation_or_commencement_date: legalDate } : {}) }, reason: 'Provider onboarding legal identity' }, `platform-business-legal-identity-${businessId}`); const refreshed = await operationsData.platformComplianceRequests(undefined, businessId, { history: true, perPage: 100 }); request = refreshed.data.find((candidate) => candidate.attributes.record.attributes.requirement_code === 'BUSINESS_LEGAL_IDENTITY' && ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'CORRECTIONS_REQUESTED'].includes(candidate.attributes.status)) || null; }
    if (!request) throw new Error('The legal identity draft was created, but its review request could not be located.');
    if (request.attributes.status === 'DRAFT' || request.attributes.status === 'CORRECTIONS_REQUESTED') { const submitted = await operationsData.submitPlatformCompliance(request.id, request.attributes.revision); setLegalRequest(submitted.data); } else setLegalRequest(request);
    setMessage('Legal identity submitted for Platform review.'); const refreshedBusiness = await operationsData.platformBusiness(businessId); setCanonicalBusiness(refreshedBusiness.data.attributes); await onSaved();
  } catch (cause) { setError(errorText(cause)); } finally { setLegalSaving(false); } }
  const operationOptions = operationCatalog.filter((item) => item.attributes.is_active && item.attributes.is_selectable).map((item) => ({ id: item.id, label: item.attributes.name, detail: item.attributes.industry_key ? `Industry: ${humanStatus(item.attributes.industry_key)}` : 'Industry not specified' }));
  if (savedOperation && !operationOptions.some((item) => item.id === savedOperation.id)) operationOptions.push({ id: savedOperation.id, label: savedOperation.name, detail: 'Saved operation · no longer selectable for new accounts' });
  const selectedOperation = operationCatalog.find((item) => item.id === selectedOperationId);

  return <section className="platform-page">
    <div className="on-behalf-banner" role="note"><strong>Editing as Platform Administrator</strong><span>Changes apply to the selected provider account and remain subject to Business verification, revision, approval, and audit rules.</span></div>
    <PlatformBreadcrumb current={`Business profile · ${providerName}`} />
    <ProviderOnboardingStepper current={1} providerId={providerId} states={onboardingStates} capabilities={capabilities} />
    <PageHeader eyebrow="Platform provider administration" title="Business profile" description={`Provider account: ${providerName}. Changes are recorded as platform-admin actions and do not require provider membership.`} action={<Button onClick={() => void submit()} disabled={saving || submitting || operationLoading || isDirty || operationsDirty || profile.verification_status === 'PENDING_REVIEW'}>{submitting ? 'Submitting…' : profile.verification_status === 'PENDING_REVIEW' ? 'Awaiting review' : <><SvgIcon name="send" size={16} /> Submit for review</>}</Button>} />
    <div className="platform-onboarding-note"><SvgIcon name="activity" size={18} /><span>Save this revision before submitting. Contacts, locations, document transfer and review decisions use their own authorized operations and are not silently created here.</span></div>
    <form className="platform-form" onSubmit={save}>
      <OnboardingFormSection title="Business Operation" description="Each provider account manages one Business Operation. The selection made during registration is loaded here and determines applicable subscription plans and operational configuration.">
        {operationLoading ? <p className="platform-muted">Loading the provider’s saved Business Operation…</p> : <>
          <SearchableSelect label="Business Operation" searchLabel="Search Business Operations" search={operationSearch} onSearch={setOperationSearch} value={selectedOperationId} onChange={setSelectedOperationId} options={operationOptions} placeholder="Select one Business Operation" disabled={!canChangeOperation} required />
          {selectedOperation ? <p className="platform-operation-selection-summary"><strong>Business Operation:</strong> {selectedOperation.attributes.name}<span><strong>Industry:</strong> {humanStatus(selectedOperation.attributes.industry_key || undefined)}</span></p> : savedOperation && <p className="platform-operation-selection-summary"><strong>Business Operation:</strong> {savedOperation.name}<span><strong>Industry:</strong> Not available</span></p>}
          {!canChangeOperation && !['PENDING', 'PENDING_ACTIVATION'].includes(providerStatus) && <p className="platform-form-note">This provider account has entered its operational lifecycle. Its Business Operation is locked; a controlled operation transition is not currently available.</p>}
          {!canChangeOperation && ['PENDING', 'PENDING_ACTIVATION'].includes(providerStatus) && profile.verification_status === 'PENDING_REVIEW' && <p className="platform-form-note">Business Operation changes are unavailable while the business profile is pending review.</p>}
          {!canChangeOperation && ['PENDING', 'PENDING_ACTIVATION'].includes(providerStatus) && profile.verification_status !== 'PENDING_REVIEW' && <p className="platform-form-note">Changing this selection requires platform provider-profile write permission.</p>}
          {!selectedOperationId && <p className="platform-field-error" role="alert">Select one Business Operation before saving or submitting this provider profile.</p>}
        </>}
      </OnboardingFormSection>
      <OnboardingFormSection title="Business Legal Identity" description="This is the authoritative Business legal identity. Constitution-specific requirements are governed through the canonical Business compliance record; the provider profile below remains a compatibility projection.">
        {canonicalBusiness?.legal_profile?.status === 'APPROVED' ? <dl className="platform-definition-list"><dt>Approval status</dt><dd><Status>{humanStatus(canonicalBusiness.legal_profile.status)}</Status></dd><dt>Legal name</dt><dd>{canonicalBusiness.legal_profile.legal_name}</dd><dt>Constitution</dt><dd>{humanStatus(canonicalBusiness.legal_profile.business_constitution_code)}</dd><dt>Country</dt><dd>{canonicalBusiness.legal_profile.country_code}</dd><dt>Approved revision</dt><dd>{canonicalBusiness.legal_profile.revision}</dd></dl> : <div className="platform-form-grid">
          <label>Business constitution <span aria-hidden="true">*</span><select required value={legalConstitution} onChange={(event) => setLegalConstitution(event.target.value)} disabled={Boolean(legalRequest) || legalSaving}><option value="">Select constitution</option>{['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'OPC', 'LLP', 'PROPRIETORSHIP', 'PARTNERSHIP', 'SECTION_8', 'REGISTERED_SOCIETY', 'TRUST', 'COOPERATIVE', 'HUF', 'OTHER'].map((value) => <option key={value} value={value}>{humanStatus(value)}</option>)}</select></label>
          <label>Country <span aria-hidden="true">*</span><select value="IN" disabled><option value="IN">India</option></select></label>
          <label>Incorporation / commencement date <span className="field-hint">(if applicable)</span><input type="date" value={legalDate} onChange={(event) => setLegalDate(event.target.value)} disabled={Boolean(legalRequest) || legalSaving} /></label>
          <div className="platform-form-actions"><Button type="button" onClick={() => void submitLegalIdentity()} disabled={legalSaving || Boolean(legalRequest) || canonicalBusiness?.legal_profile?.status === 'APPROVED'}>{legalSaving ? 'Submitting…' : legalRequest ? 'Awaiting review' : 'Submit legal identity for review'}</Button></div>
        </div>}
      </OnboardingFormSection>
      <OnboardingFormSection title="Business details" description="Compatibility fields for the provider account. These do not replace the authoritative Business Legal Identity above.">
        <label className="admin-form-field--full">Legal name <span aria-hidden="true">*</span><input value={fields.legal_name || ''} onChange={(event) => change('legal_name', event.target.value)} /></label>
        <label>Registration number <span className="field-hint">(optional)</span><input value={fields.registration_number || ''} onChange={(event) => change('registration_number', event.target.value)} /></label>
      </OnboardingFormSection>
      <OnboardingFormSection title="Business address">
        <div className="platform-form-grid">
          <label className="admin-form-field--full">Address line<input value={String(fields.address?.address_line || '')} onChange={(event) => changeAddress('address_line', event.target.value)} maxLength={200} /></label>
          <label>Locality / area<input value={String(fields.address?.locality || '')} onChange={(event) => changeAddress('locality', event.target.value)} maxLength={200} /></label>
          <SearchableSelect label="State / UT" searchLabel="Search Indian states and UTs" search={geography.stateSearch} onSearch={geography.setStateSearch} value={geography.stateCode} onChange={(id) => chooseAddressReference('state', id)} options={geography.stateOptions} placeholder="Select state / UT" required />
          <SearchableSelect label="District" searchLabel="Search districts in selected state" search={geography.districtSearch} onSearch={geography.setDistrictSearch} value={geography.districtCode} onChange={(id) => chooseAddressReference('district', id)} options={geography.districtOptions} placeholder="Select district" required disabled={!geography.stateCode} />
          <SearchableSelect label="City" searchLabel="Search cities in selected district" search={geography.citySearch} onSearch={geography.setCitySearch} value={geography.cityCode} onChange={(id) => chooseAddressReference('city', id)} options={geography.cityOptions} placeholder="Select city" required disabled={!geography.districtCode} />
          <label>PIN code <span aria-hidden="true">*</span><input value={String(fields.address?.pin_code || '')} onChange={(event) => changeAddress('pin_code', event.target.value)} inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} /></label>
          <label>Landmark<input value={String(fields.address?.landmark || '')} onChange={(event) => changeAddress('landmark', event.target.value)} maxLength={200} /></label>
          <label>Country<select value="IN" disabled><option value="IN">India</option></select></label>
        </div>
      </OnboardingFormSection>
      <OnboardingFormSection title="Indian tax registration" description="Capture GSTIN and PAN when they apply to this provider. Supporting evidence is uploaded in the document section below or from the dedicated Documents step.">
        <label>GSTIN <span className="field-hint">(when applicable)</span><input value={fields.gstin || ''} onChange={(event) => change('gstin', event.target.value.toUpperCase())} maxLength={15} pattern="[0-9A-Z]{15}" /></label>
        <label>PAN <span className="field-hint">(when applicable)</span><input value={fields.pan_number || ''} onChange={(event) => change('pan_number', event.target.value.toUpperCase())} maxLength={10} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" /></label>
        <label>Other tax identifier <span className="field-hint">(optional)</span><input value={fields.tax_identifier || ''} onChange={(event) => change('tax_identifier', event.target.value)} /></label>
      </OnboardingFormSection>
      {error && <OnboardingErrorSummary title="Business profile needs attention" errors={[error]} />}
      {message && <p className="platform-form-note" role="status">{message}</p>}
      <div className="platform-form-actions"><Button type="button" variant="secondary" onClick={() => go(`platform/providers/${providerId}`)} disabled={saving || submitting}><SvgIcon name="arrow-left" size={16} /> Cancel</Button><Button type="submit" disabled={saving || submitting || operationLoading}>{saving ? 'Saving…' : <><SvgIcon name="save" size={16} /> Save draft</>}</Button></div>
    </form>
    <OnboardingFormSection title="Required business documents" description="Upload private verification evidence for the selected provider. Files are validated before upload, versioned, provider-scoped, and available to the review workflow."><ProviderDocumentsStep providerId={providerId} canUpload={capabilities.includes('PLATFORM_PROVIDER_DOCUMENTS')} scope="platform" showUploadHeading={false} showDocumentList={false} onChanged={onSaved} /></OnboardingFormSection>
    <OnboardingFormSection title="Branding and logo" description="Logo files use the existing private, versioned document upload workflow."><ProviderLogoEditor providerId={providerId} platform onChanged={onSaved} /></OnboardingFormSection>
    {confirmOperationChange && <OperationsDialog title="Confirm Business Operation change" busy={saving} onClose={() => setConfirmOperationChange(false)}><p>This changes the operation for this provider account and affects eligible subscription plans. The API validates subscription compatibility and audits the operation change.</p><div className="platform-form-actions"><Button type="button" variant="secondary" disabled={saving} onClick={() => setConfirmOperationChange(false)}>Cancel</Button><Button type="button" busy={saving} onClick={() => void persistSave()}>Confirm and save</Button></div></OperationsDialog>}
  </section>;
}

function VerificationReviewList({ reviews, canDecide, onDecision }: { reviews: ProviderVerificationReview[]; canDecide: boolean; onDecision: (review: ProviderVerificationReview, decision: string, reason: string) => Promise<void> }) {
  const [reason, setReason] = useState<Record<string, string>>({});
  const pending = reviews.filter((review) => review.attributes.status === 'PENDING_REVIEW');
  return <DetailSection title="Review history" description="Each decision applies to the exact submitted profile or document version.">
    {!reviews.length ? <p className="platform-muted">No verification reviews have been submitted.</p> : <ul className="platform-audit-list">{reviews.map((review) => <li key={review.id}><div><strong>{review.attributes.review_kind === 'BUSINESS_PROFILE' ? 'Business profile' : 'Document version'}</strong><span><Status>{humanStatus(review.attributes.status)}</Status></span>{review.attributes.reason && <small>{review.attributes.reason}</small>}</div><span>{formatDate(review.attributes.reviewed_at || review.attributes.submitted_at)}</span>{canDecide && review.attributes.status === 'PENDING_REVIEW' && <div className="platform-review-actions"><input aria-label={`Reason for ${review.id}`} value={reason[review.id] || ''} onChange={(event) => setReason((current) => ({ ...current, [review.id]: event.target.value }))} placeholder="Reason for correction or rejection" /><Button variant="secondary" onClick={() => void onDecision(review, 'VERIFY', reason[review.id] || '')}>Verify</Button><Button variant="secondary" onClick={() => void onDecision(review, 'REQUEST_CORRECTIONS', reason[review.id] || '')}>Request corrections</Button><Button variant="danger" onClick={() => void onDecision(review, 'REJECT', reason[review.id] || '')}>Reject</Button></div>}</li>)}</ul>}
    {pending.length > 0 && !canDecide && <p className="platform-muted">A platform reviewer must decide the pending evidence.</p>}
  </DetailSection>;
}

function PlatformDocumentList({ providerId, documents, canTransfer }: { providerId: string; documents: ProviderDocument[]; canTransfer: boolean }) {
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
  return <><div className="platform-provider-table-wrap"><table className="platform-provider-table"><caption className="sr-only">Provider documents</caption><thead><tr><th scope="col">Document</th><th scope="col">Status</th><th scope="col">Scan</th><th scope="col">Version</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead><tbody>{documents.map((document) => <tr key={document.id}><td><strong>{document.attributes.filename}</strong><small>{document.attributes.classification}</small></td><td><Status>{humanStatus(document.attributes.status)}</Status></td><td>{humanStatus(document.attributes.scan_state)}</td><td>{document.attributes.current_version || 'Not available'}</td><td>{canTransfer && <AdminActionMenu label={`Actions for ${document.attributes.filename}`}><button type="button" onClick={() => { setError(''); setSelected(document); }}>Preview</button></AdminActionMenu>}</td></tr>)}</tbody></table></div>{!canTransfer && <p className="platform-muted">Document preview and download require the explicit provider-document capability.</p>}{selected && canTransfer && <div className="platform-modal-backdrop" role="presentation"><section className="platform-document-modal" role="dialog" aria-modal="true" aria-labelledby="provider-document-title"><div className="platform-modal-header"><div><p className="platform-eyebrow">Private provider document</p><h2 id="provider-document-title">{selected.attributes.filename}</h2></div><button type="button" className="logo-crop-close" aria-label="Close document preview" onClick={() => setSelected(null)}><SvgIcon name="x" size={18} /></button></div>{previewing && <p className="platform-muted">Loading secure preview…</p>}{previewUrl && selected.attributes.media_type.startsWith('image/') && <img className="platform-document-image-preview" src={previewUrl} alt={`Preview of ${selected.attributes.filename}`} />}{previewUrl && selected.attributes.media_type === 'application/pdf' && <object className="platform-document-pdf-preview" data={previewUrl} type="application/pdf" aria-label={`Preview of ${selected.attributes.filename}`}><p>PDF preview is unavailable in this browser. Use Download to open the authorized attachment.</p></object>}<dl className="platform-definition-list"><dt>Classification</dt><dd>{humanStatus(selected.attributes.classification)}</dd><dt>Media type</dt><dd>{selected.attributes.media_type}</dd><dt>Size</dt><dd>{Math.ceil(selected.attributes.size_bytes / 1024)} KB</dd><dt>Lifecycle</dt><dd>{humanStatus(selected.attributes.status)}</dd><dt>Scan policy</dt><dd>{humanStatus(selected.attributes.scan_state)}{selected.attributes.scan_reason ? ` — ${selected.attributes.scan_reason}` : ''}</dd><dt>Version</dt><dd>{selected.attributes.current_version || 'Not available'}</dd></dl><p className="platform-form-note">Preview is limited to PDF, PNG, JPEG, and WebP after fresh authorization. Download remains a separately authorized attachment.</p>{error && <p className="error" role="alert">{error}</p>}<div className="platform-form-actions"><Button variant="secondary" onClick={() => setSelected(null)}>Close</Button><Button busy={busy} disabled={busy || !selected.attributes.current_version_id || selected.attributes.status.toLowerCase() !== 'available'} onClick={() => void download()}><SvgIcon name="download" size={16} /> Download</Button></div></section></div>}</>;
}

function ProviderBusinessSections({ section = 'all', business, documents, reviews, canDecide, canTransfer = false, onDecision }: { section?: 'all' | 'business' | 'documents' | 'reviews'; business: ProviderBusinessProfile | null; documents: ProviderDocument[]; reviews: ProviderVerificationReview[]; canDecide: boolean; canTransfer?: boolean; onDecision: (review: ProviderVerificationReview, decision: string, reason: string) => Promise<void> }) {
  if (section === 'all') return <><ProviderBusinessSections section="business" business={business} documents={documents} reviews={reviews} canDecide={canDecide} canTransfer={canTransfer} onDecision={onDecision} /><ProviderBusinessSections section="documents" business={business} documents={documents} reviews={reviews} canDecide={canDecide} canTransfer={canTransfer} onDecision={onDecision} /><ProviderBusinessSections section="reviews" business={business} documents={documents} reviews={reviews} canDecide={canDecide} canTransfer={canTransfer} onDecision={onDecision} /></>;
  if (section === 'business') return !business ? <DetailSection title="Business details" description="Review the submitted provider information. Verification does not activate the provider or grant access."><p className="platform-muted">Business profile is not available.</p></DetailSection> : <ProviderBusinessProfileReadDetails profile={business} />;
  if (section === 'documents') return <DetailSection title="Provider documents" description="Review authoritative metadata. Preview and download require the explicit provider-document capability."><PlatformDocumentList providerId={business?.provider_id || ''} documents={documents} canTransfer={canTransfer} /></DetailSection>;
  return <VerificationReviewList reviews={reviews} canDecide={canDecide} onDecision={onDecision} />;
}

type ProviderDetailTab = 'overview' | 'business' | 'operations' | 'subscription' | 'documents' | 'access' | 'reviews' | 'audit';
function PlatformProviderAuditHistory({ events = [], partyName }: { events?: NonNullable<PlatformProviderAttributes['audit_history']>; partyName: string }) {
  const [page, setPage] = useState(0);
  const [from, setFrom] = useState('');
  const [through, setThrough] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const pageSize = 10;
  const filteredEvents = [...events].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
    .filter((event) => {
      const time = Date.parse(event.occurred_at);
      const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity;
      const throughTime = through ? new Date(`${through}T23:59:59.999`).getTime() : Infinity;
      return time >= fromTime && time <= throughTime
        && event.action.toLowerCase().includes(actionFilter.trim().toLowerCase())
        && (event.actor_kind || '').toLowerCase().includes(actorFilter.trim().toLowerCase());
    });
  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageEvents = filteredEvents.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  return <DetailSection title="Platform audit history" description="Platform provider details return bounded audit history. The API records an actor type, but not an individual user identity.">
    <div className="platform-audit-filters"><label>From date<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(0); }} /></label><label>Through date<input type="date" value={through} onChange={(event) => { setThrough(event.target.value); setPage(0); }} /></label><label>Filter action<input type="search" value={actionFilter} onChange={(event) => { setActionFilter(event.target.value); setPage(0); }} placeholder="Filter actions" /></label><label>Filter actor type<input type="search" value={actorFilter} onChange={(event) => { setActorFilter(event.target.value); setPage(0); }} placeholder="Filter actor type" /></label><span>Filters apply to the audit records returned with this platform provider record.</span></div>
    {!pageEvents.length ? <p className="platform-muted">No platform audit events match these filters.</p> : <div className="platform-provider-table-wrap"><table className="platform-provider-table platform-audit-table"><caption className="sr-only">Platform audit events for this provider</caption><thead><tr><th scope="col">Date</th><th scope="col">Action</th><th scope="col">Actor type</th><th scope="col">Provider / party</th></tr></thead><tbody>{pageEvents.map((event, index) => <tr key={`${event.occurred_at}-${event.action}-${event.request_id || index}`}><td>{formatDate(event.occurred_at)}</td><td><strong>{auditLabel(event.action)}</strong></td><td>{event.actor_kind ? auditLabel(event.actor_kind) : 'Not supplied'}</td><td>{partyName}</td></tr>)}</tbody></table></div>}
    <div className="platform-pagination"><span>{pageEvents.length} shown / {filteredEvents.length} matching audit events</span><div className="platform-form-actions"><Button variant="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><span>Page {currentPage + 1} of {pageCount}</span><Button variant="secondary" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button></div></div>
  </DetailSection>;
}

type ProviderDetailData = {
  contacts: Resource<ProviderOnboardingContactAttributes>[] | null;
  locations: Resource<ProviderOfficeLocationAttributes>[] | null;
  subscription: Resource<PlatformSubscription> | null;
  requests: Resource<PlatformSubscriptionRequest>[] | null;
  plans: Resource<PlatformPlan>[];
  usage: PlatformUsage | null;
  loading: boolean;
  errors: Record<string, string>;
};

type ProviderOnboardingProgressData = {
  contacts: Resource<ProviderOnboardingContactAttributes>[] | null;
  locations: Resource<ProviderOfficeLocationAttributes>[] | null;
  subscription: Resource<PlatformSubscription> | null;
  requests: Resource<PlatformSubscriptionRequest>[] | null;
  loading: boolean;
};

const providerTabs: { id: ProviderDetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' }, { id: 'business', label: 'Business details' }, { id: 'operations', label: 'Operations' }, { id: 'subscription', label: 'Subscription & Billing' },
  { id: 'documents', label: 'Documents' }, { id: 'access', label: 'Team & Access' }, { id: 'reviews', label: 'Reviews & Approvals' }, { id: 'audit', label: 'Activity History' },
];
const validProviderTab = (value: string | null): ProviderDetailTab => {
  const legacyAliases: Record<string, ProviderDetailTab> = { tax: 'business', access: 'access', audit: 'audit', subscription: 'subscription' };
  const normalized = value ? legacyAliases[value] || value : 'overview';
  return providerTabs.some((item) => item.id === normalized) ? normalized as ProviderDetailTab : 'overview';
};
const tabFromHash = (providerId: string) => {
  const [path, queryString = ''] = window.location.hash.slice(1).split('?');
  return path === `platform/providers/${providerId}` ? validProviderTab(new URLSearchParams(queryString).get('tab')) : 'overview';
};
const providerStepLabels = ['Provider identity', 'Business profile', 'Contacts & locations', 'Documents', 'Plan & approval', 'Review & activate'];
const firstActive = <T extends { attributes: { status: string } }>(rows: T[] | null): T | undefined => rows?.find((row) => row.attributes.status === 'ACTIVE');
const subscriptionPlanName = (subscription: Resource<PlatformSubscription> | null, plans: Resource<PlatformPlan>[]) => {
  if (!subscription) return '';
  for (const plan of plans) {
    const versions = plan.attributes.versions || (plan.attributes.latest_version ? [plan.attributes.latest_version] : []);
    const match = versions.find((version) => version.id === subscription.attributes.plan_version_id);
    if (match) return `${plan.attributes.name} · v${match.attributes.version_number}`;
  }
  return 'Plan name unavailable';
};
const subscriptionPlanVersion = (subscription: Resource<PlatformSubscription> | null, plans: Resource<PlatformPlan>[]) => {
  if (!subscription) return undefined;
  return plans.flatMap((plan) => plan.attributes.versions || (plan.attributes.latest_version ? [plan.attributes.latest_version] : []))
    .find((version) => version.id === subscription.attributes.plan_version_id)?.attributes;
};
const formatLimit = (value: { value: number | null; unlimited: boolean } | undefined) => !value ? 'Limit unavailable' : value.unlimited ? 'Unlimited' : value.value ?? 'Not configured';

function ProviderDetailStepper({ provider, states, providerId, loading }: { provider: Resource<PlatformProviderAttributes>; states: OnboardingState[]; providerId: string; loading: boolean }) {
  const summary = providerSetupSummary(provider.attributes, states);
  if (summary.complete) return <div className="provider-onboarding-summary"><div><span className="provider-onboarding-check" aria-hidden="true">✓</span><span><strong>Onboarding complete</strong><small>All six steps have recorded completion evidence.</small></span></div><Button variant="quiet" onClick={() => go(`platform/providers/${providerId}/onboarding`)}>View onboarding</Button></div>;
  return <nav className="provider-detail-stepper" aria-label="Provider onboarding steps">{providerStepLabels.map((label, index) => {
    const state = states[index]; const route = providerOnboardingRoute(providerId, index);
    return <button type="button" key={label} className={`provider-step provider-step-${state}`} aria-current={summary.firstIncomplete === index ? 'step' : undefined} onClick={() => route && go(route)}>
      <span className="provider-step-index">{index + 1}</span><strong>{label}</strong><small>{loading && state === 'not_available' && (index === 2 || index === 4) ? 'Loading' : onboardingStateLabel(state)}</small>
    </button>;
  })}</nav>;
}

function ProviderStatusSummary({ label, value, explanation, action }: { label: string; value: string; explanation: string; action?: () => void }) {
  return <article className="provider-status-card"><span>{label}</span><Status>{value}</Status><small>{explanation}</small>{action && <button type="button" onClick={action}>View details <SvgIcon name="chevron-right" size={13} /></button>}</article>;
}

function ProviderOverviewDashboard({ selected, business, documents, capabilities, data, sectionErrors, onRetry }: { selected: Resource<PlatformProviderAttributes>; business: ProviderBusinessProfile | null; documents: ProviderDocument[]; capabilities: string[]; data: ProviderDetailData; sectionErrors: Record<string, string>; onRetry: () => void }) {
  const provider = selected.attributes;
  const activeLocation = data.locations?.find((row) => row.attributes.status === 'ACTIVE' && row.attributes.location_kind === 'REGISTERED_OFFICE') || firstActive(data.locations);
  const verification = business?.verification_status || provider.business_verification_status;
  const subscriptionStatus = !capabilities.includes('PLATFORM_SUBSCRIPTION_READ') ? 'Not available'
    : data.loading ? 'Loading'
      : data.errors.subscription || data.errors.requests ? 'Unavailable'
        : data.subscription ? humanStatus(data.subscription.attributes.status)
          : data.requests?.some((request) => ['PENDING_REVIEW', 'APPROVED'].includes(request.attributes.status)) ? 'Request in review' : 'No subscription';
  const adminStatus = administratorSetupLabel(provider.provider_admin_setup);
  const profile = business?.profile;
  const locationAddress = activeLocation?.attributes.address;
  const addressText = locationAddress ? Object.values(locationAddress).filter(Boolean).join(', ') : Object.values(profile?.address || {}).filter(Boolean).join(', ');
  const plan = subscriptionPlanName(data.subscription, data.plans);
  const planVersion = subscriptionPlanVersion(data.subscription, data.plans);
  const snapshot = data.subscription?.attributes.commercial_snapshot;
  const usage = capabilities.includes('PLATFORM_SUBSCRIPTION_USAGE_READ') ? data.usage : null;
  const entitlementKeys = [...new Set([...(snapshot?.limits || []).map((limit) => limit.metric_key), ...Object.keys(usage?.metrics || {})])];
  const audit = [...(provider.audit_history || [])].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at)).slice(0, 5);
  const setupItems = [
    { label: 'Business verification', status: sectionErrors.business ? 'Not available' : verification ? humanStatus(verification) : 'Not available', route: `platform/providers/${selected.id}/business-profile/edit` },
    { label: 'Administrator setup', status: adminStatus, route: `platform/providers/${selected.id}/onboarding/review` },
    { label: 'Contacts & locations', status: data.loading ? 'Loading' : data.errors.contacts || data.errors.locations ? 'Not available' : `${data.contacts?.filter((row) => row.attributes.status === 'ACTIVE').length || 0} active contacts · ${data.locations?.filter((row) => row.attributes.status === 'ACTIVE').length || 0} active locations`, route: `platform/providers/${selected.id}/onboarding` },
    { label: 'Business documents', status: sectionErrors.documents ? 'Not available' : `${documents.length} records loaded`, route: `platform/providers/${selected.id}/onboarding/documents` },
    { label: 'Licences & compliance', status: 'Review requirements and evidence', route: `platform/compliance?provider_id=${encodeURIComponent(selected.id)}` },
    { label: 'Subscription review', status: subscriptionStatus, route: `platform/providers/${selected.id}?tab=subscription` },
  ];
  return <div className="provider-overview-dashboard">
    <section aria-labelledby="provider-status-heading"><div className="provider-dashboard-section-heading"><div><p className="platform-eyebrow">Current state</p><h2 id="provider-status-heading">Status summary</h2></div></div><div className="provider-status-grid">
      <ProviderStatusSummary label="Provider status" value={humanStatus(provider.status)} explanation="Operational lifecycle and provider-scoped access" action={() => go(`platform/providers/${selected.id}/lifecycle`)} />
      <ProviderStatusSummary label="Business verification" value={sectionErrors.business ? 'Unavailable' : verification ? humanStatus(verification) : 'Not available'} explanation={sectionErrors.business || 'Verification is separate from activation'} action={() => go(`platform/providers/${selected.id}?tab=business`)} />
      <ProviderStatusSummary label="Subscription" value={subscriptionStatus} explanation={data.errors.subscription ? data.errors.subscription : 'Plan state and payment approval are separate'} action={capabilities.includes('PLATFORM_SUBSCRIPTION_READ') && capabilities.includes('PLATFORM_PLAN_READ') ? () => go(`platform/providers/${selected.id}?tab=subscription`) : undefined} />
      <ProviderStatusSummary label="Administrator setup" value={adminStatus} explanation={adminStatus === 'Not configured' ? 'No provider administrator setup is recorded' : 'Provider login setup is independent of platform status'} action={() => go(`platform/providers/${selected.id}/onboarding/review`)} />
    </div></section>

    <div className="provider-dashboard-columns">
      <DetailSection title="Provider information" description="Read-only details returned by the provider and business profile APIs."><dl className="provider-information-grid">
        <dt>Provider code</dt><dd title={provider.provider_code || undefined}>{provider.provider_code || 'Not supplied'}</dd>
        <dt>Provider type</dt><dd>{provider.representation || provider.representation_kind || 'Not available'}</dd>
        <dt>Linked Business</dt><dd title={selected.attributes.business_name || profile?.legal_name || undefined}>{selected.attributes.business_name || profile?.legal_name || 'Business name not supplied'}</dd>
        <dt>Business identity</dt><dd>{sectionErrors.business ? 'Profile unavailable' : 'Read-only summary · manage in Business'}</dd>
        <dt>Contact names</dt><dd>{sectionErrors.business ? 'Profile unavailable' : business?.contacts?.length ? business.contacts.map((contact) => contact.display_name).join(', ') : 'Not supplied'}</dd>
        <dt>Registered / office address</dt><dd>{addressText || (data.errors.locations ? 'Location data unavailable' : 'Not supplied')}</dd>
        <dt>Business registration</dt><dd>{sectionErrors.business ? 'Profile unavailable' : [profile?.registration_number && `Registration ${profile.registration_number}`, profile?.gstin && `GSTIN ${profile.gstin}`].filter(Boolean).join(' · ') || 'Not supplied · manage in Business'}</dd>
        <dt>Registered</dt><dd>{formatDate(provider.effective_from)}</dd>
      </dl></DetailSection>

      <DetailSection title="Subscription & entitlements" description="Current plan and usage shown only when the platform APIs and grants return them.">
        {data.loading && <p className="provider-dashboard-muted" role="status">Loading authorized subscription data…</p>}
        {(data.errors.subscription || data.errors.requests) && <div className="provider-dashboard-error" role="alert"><span>{data.errors.subscription || data.errors.requests}</span><Button variant="quiet" onClick={onRetry}>Retry</Button></div>}
        {!data.loading && !data.errors.subscription && !capabilities.includes('PLATFORM_SUBSCRIPTION_READ') && <p className="provider-dashboard-muted">Subscription details are unavailable to this account.</p>}
        {!data.loading && !data.errors.subscription && capabilities.includes('PLATFORM_SUBSCRIPTION_READ') && !data.subscription && <p className="provider-dashboard-muted">{subscriptionStatus === 'Request in review' ? 'A subscription request is awaiting its authorized review.' : 'No current subscription is recorded.'}</p>}
        {data.subscription && <><div className="provider-subscription-heading"><div><strong>{plan || 'Subscription plan'}</strong><small>{humanStatus(data.subscription.attributes.status)} · {humanStatus(data.subscription.attributes.approval_state)} approval</small></div><Status>{humanStatus(data.subscription.attributes.status)}</Status></div><dl className="provider-subscription-facts">
          <dt>Billing</dt><dd>{snapshot?.billing_interval ? humanStatus(snapshot.billing_interval) : 'Not available'}</dd>
          <dt>Price</dt><dd>{snapshot?.price_amount !== undefined ? `${snapshot.currency_code || 'Currency unavailable'} ${Number(snapshot.price_amount).toLocaleString('en-IN')}${Number(snapshot.price_amount) === 0 ? ' · no charge' : ''}` : 'Not available'}</dd>
          <dt>Tax treatment</dt><dd>{planVersion?.tax_treatment ? humanStatus(planVersion.tax_treatment) : 'Accepted tax terms unavailable'}</dd>
          <dt>Billing period</dt><dd>{formatDate(data.subscription.attributes.effective_from)} – {data.subscription.attributes.effective_to ? formatDate(data.subscription.attributes.effective_to) : 'No fixed end date'}</dd>
        </dl>
        <div className="provider-usage-grid">{entitlementKeys.length ? entitlementKeys.map((key) => { const configured = snapshot?.limits?.find((limit) => limit.metric_key === key); const metric = usage?.metrics[key]; const limit = metric?.limit || configured; const warning = usageLimitWarning(metric?.exceeded); return <article key={key} className={warning ? 'usage-exceeded' : ''}><div><strong>{humanStatus(key)}</strong><span>{metric ? `${metric.value} / ${limit?.unlimited ? 'Unlimited' : formatLimit(limit)}` : `${formatLimit(configured)} included`}</span></div>{metric && limit && !limit.unlimited && limit.value !== null && <progress max={Math.max(1, limit.value)} value={Math.min(metric.value, limit.value)} aria-label={`${humanStatus(key)} usage`} />}{warning && <small role="status">{warning}</small>}</article>; }) : <p className="provider-dashboard-muted">Configured entitlements are not available in the subscription record.</p>}{capabilities.includes('PLATFORM_SUBSCRIPTION_USAGE_READ') && !usage && <p className="provider-dashboard-muted">{data.errors.usage || 'Usage data is not available.'}</p>}{!capabilities.includes('PLATFORM_SUBSCRIPTION_USAGE_READ') && <p className="provider-dashboard-muted">Usage is not available to this account.</p>}</div>
        <div className="provider-dashboard-actions"><Button variant="secondary" onClick={() => go(`platform/providers/${selected.id}?tab=subscription`)}>Manage subscription</Button></div></>}
      </DetailSection>
    </div>

    <div className="provider-dashboard-columns provider-dashboard-lower">
        <DetailSection title="Setup & compliance" description="Evidence summary from the current platform provider, business, document, contacts and subscription records."><ul className="provider-setup-list">{setupItems.map((item) => <li key={item.label}><span>{item.label}</span><Status>{item.status}</Status><button type="button" onClick={() => go(item.route)}>Review <SvgIcon name="chevron-right" size={13} /></button></li>)}</ul>{Object.values({ ...data.errors, ...sectionErrors }).length > 0 && <p className="provider-dashboard-muted">Some provider sections could not be loaded. Available sections remain visible.</p>}</DetailSection>
      <DetailSection title="Recent activity" description="Latest events included in the bounded provider audit response.">{audit.length ? <ol className="provider-recent-activity">{audit.map((event, index) => <li key={`${event.occurred_at}-${event.action}-${index}`}><span className="provider-activity-mark" aria-hidden="true" /><div><strong>{auditLabel(event.action)}</strong><small>{event.actor_kind ? `Recorded actor type: ${auditLabel(event.actor_kind)}` : 'Actor type not supplied'}</small></div><time dateTime={event.occurred_at}>{formatDate(event.occurred_at)}</time></li>)}</ol> : <p className="provider-dashboard-muted">No recent audit events were returned for this provider.</p>}<div className="provider-dashboard-actions"><Button variant="quiet" onClick={() => go(`platform/providers/${selected.id}?tab=audit`)}>View audit history</Button></div></DetailSection>
    </div>
  </div>;
}

function ProviderOperationsPanel({ providerId, providerStatus, verificationStatus, capabilities, subscription, subscriptionError }: { providerId: string; providerStatus: string; verificationStatus?: string; capabilities: string[]; subscription: Resource<PlatformSubscription> | null; subscriptionError?: string }) {
  const [catalog, setCatalog] = useState<BusinessOperation[]>([]);
  const [operation, setOperation] = useState<ProviderOperation | null>(null);
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hasOperationWrite = capabilities.includes('PLATFORM_PROVIDER_PROFILE_WRITE') || capabilities.includes('PLATFORM_PROVIDER_BUSINESS_WRITE');
  const initialActiveAssignment = providerStatus === 'ACTIVE' && operation === null;
  const canChange = hasOperationWrite && (initialActiveAssignment || (['PENDING', 'PENDING_ACTIVATION'].includes(providerStatus) && verificationStatus !== undefined && verificationStatus !== 'PENDING_REVIEW'));

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [types, configured] = await Promise.all([operationsData.businessOperations(), operationsData.platformProviderOperations(providerId)]);
      const active = configured.data.find((row) => row.attributes.status === 'ACTIVE') || null;
      setCatalog(types.data); setOperation(active); setSelection(active?.attributes.business_operation.id || ''); setRevision(configured.revision);
    } catch (cause) { setError(errorText(cause)); }
    finally { setLoading(false); }
  }, [providerId]);
  useEffect(() => { void load(); }, [load]);

  const current = operation?.attributes.business_operation;
  const industry = catalog.find((item) => item.id === current?.id)?.attributes.industry_key;
  const options = catalog.filter((item) => item.attributes.is_active && item.attributes.is_selectable).map((item) => ({ id: item.id, label: item.attributes.name, detail: item.attributes.industry_key ? `Industry: ${humanStatus(item.attributes.industry_key)}` : 'Industry not specified' }));
  async function save() {
    if (!selection || selection === current?.id) { setEditing(false); return; }
    setBusy(true); setError('');
    try {
      await operationsData.replacePlatformProviderOperations(providerId, { expected_revision: revision, operations: [{ business_operation_type_id: selection, is_primary: true }] }, `provider-operation-change-${providerId}-${revision}`);
      setConfirmOpen(false); setEditing(false); await load();
    } catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  }

  if (loading) return <DetailSection title="Business Operation"><p className="platform-muted">Loading the provider’s Business Operation…</p></DetailSection>;
  if (error && !operation) return <DetailSection title="Business Operation"><StatePanel title="Business Operation unavailable"><span>{error}</span><Button onClick={() => void load()}>Retry</Button></StatePanel></DetailSection>;
  return <DetailSection title="Business Operation" description="One provider account has one operation, its own subscription lifecycle and its own authorized workspace. Business grouping does not grant access to sibling accounts.">
    {error && <p className="platform-field-error" role="alert">{error}</p>}
    {operation && current ? <div className="provider-operation-detail-card"><dl className="platform-definition-list"><dt>Business Operation</dt><dd><strong>{current.name}</strong><small>{current.code}</small></dd><dt>Industry</dt><dd>{industry ? humanStatus(industry) : 'Not available'}</dd><dt>Operation status</dt><dd><Status>{humanStatus(operation.attributes.status)}</Status></dd><dt>Subscription</dt><dd>{!capabilities.includes('PLATFORM_SUBSCRIPTION_READ') ? 'Not available to this role' : subscriptionError ? 'Unavailable' : subscription ? humanStatus(subscription.attributes.status) : 'No current subscription'}</dd><dt>Workspace readiness</dt><dd>Not available from the current API</dd></dl></div> : <AdminEmptyState title="No Business Operation assigned" description="Select one Business Operation before this provider account is submitted or activated." />}
    {editing && canChange && <div className="provider-operation-edit"><SearchableSelect label="Business Operation" searchLabel="Search Business Operations" search={search} onSearch={setSearch} value={selection} onChange={setSelection} options={options} placeholder="Select one Business Operation" required /><div className="platform-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => { setEditing(false); setSelection(current?.id || ''); }}>Cancel</Button><Button type="button" disabled={busy || !selection || selection === current?.id} onClick={() => setConfirmOpen(true)}>Save Business Operation</Button></div></div>}
    {!editing && canChange && <div className="provider-operation-actions"><Button variant="secondary" onClick={() => setEditing(true)}>Change Business Operation</Button></div>}
    {initialActiveAssignment && canChange && <p className="platform-muted">This active provider has never had an operation assigned. Assigning its first operation repairs setup; changing an existing operation remains locked after activation.</p>}
    {!canChange && !['PENDING', 'PENDING_ACTIVATION'].includes(providerStatus) && <p className="platform-muted">Business Operation changes are locked after provider activation. A controlled transition workflow is not currently available.</p>}
    {!canChange && ['PENDING', 'PENDING_ACTIVATION'].includes(providerStatus) && verificationStatus === 'PENDING_REVIEW' && <p className="platform-muted">Business Operation changes are unavailable while the business profile is pending review.</p>}
    {!canChange && ['PENDING', 'PENDING_ACTIVATION'].includes(providerStatus) && verificationStatus === undefined && <p className="platform-muted">Business Operation changes are unavailable until the business review state can be verified.</p>}
    {!canChange && ['PENDING', 'PENDING_ACTIVATION'].includes(providerStatus) && verificationStatus !== 'PENDING_REVIEW' && <p className="platform-muted">Changing this value requires platform provider-profile write permission.</p>}
    {confirmOpen && <OperationsDialog title="Confirm Business Operation change" busy={busy} onClose={() => setConfirmOpen(false)}><p>This changes the Business Operation for this provider account and can change eligible subscription plans. The API validates current subscription compatibility and records the change in audit history.</p><div className="platform-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirmOpen(false)}>Cancel</Button><Button type="button" busy={busy} onClick={() => void save()}>Confirm change</Button></div></OperationsDialog>}
  </DetailSection>;
}

function ProviderAdministratorsPanel({ providerId, businessId, capabilities }: { providerId: string; businessId?: string; capabilities: string[] }) {
  const [members, setMembers] = useState<Resource<PlatformProviderMemberAttributes>[]>([]);
  const [invitations, setInvitations] = useState<Resource<PlatformProviderAdminInvitationAttributes>[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState<{ member: Resource<PlatformProviderMemberAttributes>; action: 'suspend' | 'restore' | 'revoke' } | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendForm, setSendForm] = useState({ full_name: '', email: '', mobile: '' });
  const [selectedRecipient, setSelectedRecipient] = useState<ProviderAdminInviteRecipient | null>(null);
  const [manualRecipient, setManualRecipient] = useState(false);
  const canManage = capabilities.includes('PLATFORM_PROVIDER_ADMIN_ACCESS') || capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE');
  async function load() { try { const [page, invitationPage] = await Promise.all([operationsData.platformProviderAdminMembers(providerId), operationsData.platformProviderAdminInvitations(providerId)]); setMembers(page.data); setInvitations(invitationPage.data as Resource<PlatformProviderAdminInvitationAttributes>[]); } catch (cause) { setError(errorText(cause)); } }
  useEffect(() => { void load(); }, [providerId]);
  async function transition() {
    if (!pending || !reason.trim()) return;
    setBusy(pending.member.id); setError('');
    try { const result = await operationsData.transitionPlatformProviderAdminMember(providerId, pending.member.id, pending.action, { expected_revision: pending.member.attributes.revision, reason: reason.trim() }, crypto.randomUUID()); setMembers((current) => current.map((item) => item.id === result.id ? result : item)); setPending(null); setReason(''); }
    catch (cause) { setError(errorText(cause)); } finally { setBusy(''); }
  }
  async function sendInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy('send'); setError('');
    try { await operationsData.createPlatformProviderAdminInvitationByEmail(providerId, { ...(selectedRecipient ? { user_id: selectedRecipient.user_id } : {}), ...sendForm, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), reason: 'Platform administrator invitation' }, crypto.randomUUID()); setSendOpen(false); setSendForm({ full_name: '', email: '', mobile: '' }); setSelectedRecipient(null); setManualRecipient(false); await load(); }
    catch (cause) { setError(errorText(cause)); } finally { setBusy(''); }
  }
  async function resend(invitation: Resource<PlatformProviderAdminInvitationAttributes>) { setBusy(invitation.id); setError(''); try { const result = await operationsData.resendPlatformProviderAdminInvitation(providerId, invitation.id, crypto.randomUUID()); setInvitations((current) => current.map((item) => item.id === result.id ? result : item)); } catch (cause) { setError(errorText(cause)); } finally { setBusy(''); } }
  async function cancelInvitation(invitation: Resource<PlatformProviderAdminInvitationAttributes>) { const reason = window.prompt('Reason for cancelling this invitation'); if (!reason?.trim()) return; setBusy(invitation.id); setError(''); try { const result = await operationsData.revokePlatformProviderAdminInvitation(providerId, invitation.id, { expected_revision: invitation.attributes.revision, reason: reason.trim() }, crypto.randomUUID()); const updated = result.data as unknown as Resource<PlatformProviderAdminInvitationAttributes>; setInvitations((current) => current.map((item) => item.id === updated.id ? updated : item)); } catch (cause) { setError(errorText(cause)); } finally { setBusy(''); } }
  return <DetailSection title="Administrators & access" description="Provider administrator memberships are managed independently from contacts and provider lifecycle status.">
    {error && <StatePanel title="Administrator access needs attention">{error}</StatePanel>}
    {!canManage ? <p className="platform-muted">Your platform grant does not include administrator access management.</p> : <><div className="platform-form-actions"><Button onClick={() => setSendOpen(true)}>Send invitation</Button></div><div className="platform-provider-table-wrap"><table className="platform-provider-table"><caption className="sr-only">Provider administrator memberships</caption><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Role</th><th>Actions</th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td><strong>{member.attributes.name || 'Unnamed user'}</strong></td><td>{member.attributes.email}</td><td><Status>{humanStatus(member.attributes.status)}</Status></td><td>{humanStatus(member.attributes.role_context)}</td><td><AdminActionMenu label={`Actions for ${member.attributes.name || member.attributes.email}`} >{member.attributes.status === 'ACTIVE' && <button type="button" disabled={Boolean(busy)} onClick={() => setPending({ member, action: 'suspend' })}>Suspend access</button>}{member.attributes.status === 'SUSPENDED' && <button type="button" disabled={Boolean(busy)} onClick={() => setPending({ member, action: 'restore' })}>Restore access</button>}{['ACTIVE', 'SUSPENDED'].includes(member.attributes.status) && <button type="button" disabled={Boolean(busy)} onClick={() => setPending({ member, action: 'revoke' })}>Revoke</button>}</AdminActionMenu></td></tr>)}</tbody></table>{!members.length && <p className="platform-muted">No active or historical provider administrator memberships were returned.</p>}</div><div className="platform-provider-table-wrap"><h3>Invitation history</h3><table className="platform-provider-table"><thead><tr><th>Status</th><th>Created</th><th>Last sent</th><th>Delivery</th><th>Actions</th></tr></thead><tbody>{invitations.map((invitation) => <tr key={invitation.id}><td><Status>{invitation.attributes.expired ? 'Expired' : humanStatus(invitation.attributes.status)}</Status></td><td>{formatDate(invitation.attributes.created_at)}</td><td>{formatDate(invitation.attributes.last_sent_at || undefined)}</td><td><Status>{humanStatus(invitation.attributes.delivery_status)}</Status></td><td>{invitation.attributes.status === 'PENDING' && <AdminActionMenu label="Invitation actions"><button type="button" disabled={Boolean(busy)} onClick={() => void resend(invitation)}>Resend</button><button type="button" disabled={Boolean(busy)} onClick={() => void cancelInvitation(invitation)}>Cancel</button></AdminActionMenu>}</td></tr>)}</tbody></table>{!invitations.length && <p className="platform-muted">No administrator invitations have been recorded.</p>}</div></>}
    {sendOpen && <OperationsDialog title="Send Provider Administrator invitation" busy={busy === 'send'} onClose={() => setSendOpen(false)}><form className="platform-form-grid" onSubmit={sendInvitation}>
      {!manualRecipient && <ProviderAdminInviteRecipientPicker providerId={providerId} businessId={businessId} selectedUserId={selectedRecipient?.user_id} onSelect={(recipient) => { setSelectedRecipient(recipient); setSendForm({ full_name: recipient.full_name, email: recipient.email, mobile: recipient.mobile }); }} onCreateUser={() => { setSendOpen(false); go(`platform/providers/${providerId}/onboarding/contacts`); }} />}
      {selectedRecipient && !manualRecipient && <div className="platform-invite-selected"><strong>Selected recipient</strong><span>{selectedRecipient.full_name} · {selectedRecipient.email}</span><Button type="button" variant="quiet" onClick={() => { setSelectedRecipient(null); setSendForm({ full_name: '', email: '', mobile: '' }); }}>Change user</Button></div>}
      {!manualRecipient && <Button type="button" variant="quiet" onClick={() => { setManualRecipient(true); setSelectedRecipient(null); setSendForm({ full_name: '', email: '', mobile: '' }); }}>Enter recipient details manually</Button>}
      {manualRecipient && <><p className="platform-form-note">Enter details only for an active, verified TRISE identity. If the identity does not exist yet, use “Create or verify a user first”.</p><label>Full name *<input required value={sendForm.full_name} onChange={(event) => setSendForm((current) => ({ ...current, full_name: event.target.value }))} /></label><label>Email address *<input required type="email" value={sendForm.email} onChange={(event) => setSendForm((current) => ({ ...current, email: event.target.value }))} /></label><label>Mobile number *<input required inputMode="tel" value={sendForm.mobile} onChange={(event) => setSendForm((current) => ({ ...current, mobile: event.target.value }))} /></label><Button type="button" variant="quiet" onClick={() => { setManualRecipient(false); setSendForm({ full_name: '', email: '', mobile: '' }); }}>Choose an existing user instead</Button></>}
      <p className="platform-muted">The invitation grants no access until the recipient accepts and the server completes the audited membership activation.</p><div className="platform-form-actions"><Button type="submit" busy={busy === 'send'} disabled={!sendForm.full_name.trim() || !sendForm.email.trim() || !sendForm.mobile.trim()}>Send invitation</Button><Button type="button" variant="secondary" onClick={() => setSendOpen(false)}>Cancel</Button></div>
    </form></OperationsDialog>}
    {pending && <OperationsDialog title={`${pending.action === 'restore' ? 'Restore' : pending.action === 'suspend' ? 'Suspend' : 'Revoke'} administrator access`} busy={Boolean(busy)} onClose={() => { setPending(null); setReason(''); }}><p>{pending.member.attributes.name || pending.member.attributes.email} will receive the selected membership state. Other provider memberships and the user identity remain unchanged.</p><label>Reason <textarea required rows={3} value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="platform-form-actions"><Button variant="secondary" disabled={Boolean(busy)} onClick={() => setPending(null)}>Cancel</Button><Button variant={pending.action === 'suspend' || pending.action === 'revoke' ? 'danger' : 'primary'} disabled={!reason.trim()} busy={Boolean(busy)} onClick={() => void transition()}>Confirm</Button></div></OperationsDialog>}
  </DetailSection>;
}

export function ProviderIdentityDomainsPanel({ businessId, businessName, capabilities }: { businessId: string; businessName?: string; capabilities: string[] }) {
  return <CombinedProviderIdentityDomainsPanel businessId={businessId} businessName={businessName} capabilities={capabilities} />;
}

function CombinedProviderIdentityDomainsPanel({ businessId, businessName, capabilities }: { businessId: string; businessName?: string; capabilities: string[] }) {
  const [domains, setDomains] = useState<PlatformProviderIdentityDomain[]>([]); const [error, setError] = useState(''); const [formError, setFormError] = useState(''); const [domainError, setDomainError] = useState(''); const [emailError, setEmailError] = useState(''); const [busy, setBusy] = useState(false); const [addOpen, setAddOpen] = useState(false); const [deleteDomain, setDeleteDomain] = useState<PlatformProviderIdentityDomain | null>(null); const [deleteReason, setDeleteReason] = useState(''); const [resendDomain, setResendDomain] = useState<PlatformProviderIdentityDomain | null>(null); const [resendReason, setResendReason] = useState(''); const [resendError, setResendError] = useState(''); const [transitionRequest, setTransitionRequest] = useState<{ row: PlatformProviderIdentityDomain; action: 'approve' | 'suspend' } | null>(null); const [transitionReason, setTransitionReason] = useState(''); const [transitionError, setTransitionError] = useState(''); const [form, setForm] = useState({ domain: '', verification_email: '', reason: '' });
  const canManage = capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE');
  const load = async () => { try { setDomains((await operationsData.platformBusinessIdentityDomains(businessId)).data); } catch (cause) { setError(errorText(cause)); } };
  useEffect(() => {
    void load();
    const poll = window.setInterval(() => { void load(); }, 5000);
    return () => window.clearInterval(poll);
  }, [businessId]);
  const add = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setFormError(''); setDomainError(''); setEmailError(''); const domain = form.domain.trim().toLowerCase().replace(/\.$/, ''); const email = form.verification_email.trim().toLowerCase(); if (domain.includes('@')) { setDomainError('Enter the domain only, for example sahayya.in. Do not enter an email address.'); return; } if (email.split('@').at(-1) !== domain) { setEmailError('Verification email must belong to the requested domain.'); return; } setBusy(true); try { const result = await operationsData.createPlatformBusinessIdentityDomain(businessId, { domain, verification_email: email, reason: form.reason.trim() }, crypto.randomUUID()); setAddOpen(false); setForm({ domain: '', verification_email: '', reason: '' }); if (result.data.attributes.verification_delivery_status === 'FAILED') setError('The request was recorded, but the verification email could not be delivered.'); await load(); } catch (cause) { setFormError(errorText(cause)); } finally { setBusy(false); } };
  const transition = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!transitionRequest || transitionReason.trim().length < 3) return; setBusy(true); setTransitionError(''); try { await operationsData.transitionPlatformBusinessIdentityDomain(businessId, transitionRequest.row.id, transitionRequest.action, { expected_revision: transitionRequest.row.attributes.revision, reason: transitionReason.trim() }, crypto.randomUUID()); setTransitionRequest(null); setTransitionReason(''); await load(); } catch (cause) { setTransitionError(errorText(cause)); } finally { setBusy(false); } };
  const remove = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!deleteDomain || deleteReason.trim().length < 3) return; setBusy(true); try { await operationsData.deletePlatformBusinessIdentityDomain(businessId, deleteDomain.id, { expected_revision: deleteDomain.attributes.revision, reason: deleteReason.trim() }, crypto.randomUUID()); setDeleteDomain(null); setDeleteReason(''); await load(); } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); } };
  const resend = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!resendDomain || resendReason.trim().length < 3) return; setBusy(true); setResendError(''); try { await operationsData.resendPlatformBusinessIdentityDomain(businessId, resendDomain.id, { expected_revision: resendDomain.attributes.revision, reason: resendReason.trim() }, crypto.randomUUID()); setResendDomain(null); setResendReason(''); await load(); } catch (cause) { setResendError(errorText(cause)); } finally { setBusy(false); } };
  return <DetailSection title={`Identity domains${businessName ? ` · ${businessName}` : ''}`} description="Verified corporate domains belong to the Business and apply to its provider accounts for Google identity linking. They never grant provider membership or roles."><div className="platform-form-actions">{canManage && <Button disabled={busy} onClick={() => { setFormError(''); setDomainError(''); setEmailError(''); setForm({ domain: '', verification_email: '', reason: '' }); setAddOpen(true); }}>Add identity domain</Button>}</div>{error && <p className="platform-field-error" role="alert">{error}</p>}{domains.length ? <div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Domain</th><th>Verification email</th><th>Status</th><th>Revision</th><th>Action</th></tr></thead><tbody>{domains.map((row) => <tr key={row.id}><td>{row.attributes.domain}</td><td>{row.attributes.verification_email || 'Not recorded'}</td><td><Status>{humanStatus(row.attributes.status)}</Status>{row.attributes.status === 'pending_verification' && <small className="platform-muted">Check the mailbox for the verification link.</small>}</td><td>{row.attributes.revision}</td><td><AdminActionMenu label={`Actions for ${row.attributes.domain}`}>{row.attributes.status === 'pending_verification' && canManage && <button type="button" disabled={busy} onClick={() => { setResendDomain(row); setResendReason(''); setResendError(''); }}>Resend verification email</button>}{row.attributes.status === 'pending_approval' && canManage && <button type="button" disabled={busy} onClick={() => { setTransitionRequest({ row, action: 'approve' }); setTransitionReason(''); setTransitionError(''); }}>Approve</button>}{row.attributes.status === 'active' && canManage && <button type="button" disabled={busy} onClick={() => { setTransitionRequest({ row, action: 'suspend' }); setTransitionReason(''); setTransitionError(''); }}>Suspend</button>}{['pending_verification', 'pending_approval', 'suspended', 'rejected'].includes(row.attributes.status) && canManage && <button type="button" disabled={busy} onClick={() => { setDeleteDomain(row); setDeleteReason(''); }}>Delete</button>}</AdminActionMenu></td></tr>)}</tbody></table></div> : <p className="platform-muted">No Business identity domains configured.</p>}{addOpen && <OperationsDialog title="Add Business identity domain" busy={busy} onClose={() => setAddOpen(false)}><form className="platform-form-grid" onSubmit={(event) => void add(event)}><p className="platform-form-note">TRISE will send a one-time verification link to an email address at the requested domain. A Global Administrator must still approve the domain after email verification.</p><label>Corporate domain *<input required pattern="[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+" placeholder="company.in" value={form.domain} disabled={busy} aria-describedby={domainError ? 'identity-domain-domain-error' : undefined} onChange={(event) => { const value = event.target.value; setDomainError(value.includes('@') ? 'Enter the domain only, for example sahayya.in. Do not enter an email address.' : ''); setEmailError(''); setForm((current) => ({ ...current, domain: value })); }} />{domainError && <span id="identity-domain-domain-error" className="platform-field-error" role="alert">{domainError}</span>}</label><label>Verification email *<input required type="email" maxLength={320} placeholder="admin@company.in" aria-describedby={emailError ? 'identity-domain-email-error' : undefined} value={form.verification_email} disabled={busy} onChange={(event) => { const value = event.target.value; const domain = form.domain.trim().toLowerCase().replace(/\.$/, ''); setEmailError(value && value.split('@').at(-1)?.toLowerCase() !== domain ? 'Verification email must belong to the requested domain.' : ''); setForm((current) => ({ ...current, verification_email: value })); }} />{emailError && <span id="identity-domain-email-error" className="platform-field-error" role="alert">{emailError}</span>}</label><label>Reason *<textarea required minLength={3} maxLength={500} rows={4} value={form.reason} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></label>{formError && <p className="platform-field-error" role="alert">{formError}</p>}<div className="platform-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit" busy={busy} disabled={form.reason.trim().length < 3 || Boolean(domainError) || Boolean(emailError)}>Send verification email</Button></div></form></OperationsDialog>}{resendDomain && <OperationsDialog title={`Resend verification email · ${resendDomain.attributes.domain}`} busy={busy} onClose={() => setResendDomain(null)}><form className="platform-form-grid" onSubmit={(event) => void resend(event)}><p className="platform-form-note">A new one-time link will be sent to {resendDomain.attributes.verification_email || 'the recorded verification address'}. The previous link stops working and the 24–48 hour expiry window restarts.</p><label>Reason *<textarea required minLength={3} maxLength={500} rows={4} value={resendReason} disabled={busy} onChange={(event) => setResendReason(event.target.value)} /></label>{resendError && <p className="platform-field-error" role="alert">{resendError}</p>}<div className="platform-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setResendDomain(null)}>Cancel</Button><Button type="submit" busy={busy} disabled={resendReason.trim().length < 3}>Resend verification email</Button></div></form></OperationsDialog>}{deleteDomain && <OperationsDialog title={`Delete ${deleteDomain.attributes.domain}`} busy={busy} onClose={() => setDeleteDomain(null)}><form className="platform-form-grid" onSubmit={(event) => void remove(event)}><p className="platform-form-note">Pending or suspended domains can be deleted to release the domain reservation. Active domains must be suspended first.</p><label>Reason *<textarea required minLength={3} maxLength={500} rows={4} value={deleteReason} disabled={busy} onChange={(event) => setDeleteReason(event.target.value)} /></label><div className="platform-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setDeleteDomain(null)}>Cancel</Button><Button type="submit" variant="danger" busy={busy} disabled={deleteReason.trim().length < 3}>Delete domain</Button></div></form></OperationsDialog>}{transitionRequest && <OperationsDialog title={`${transitionRequest.action === 'approve' ? 'Approve' : 'Suspend'} identity domain · ${transitionRequest.row.attributes.domain}`} busy={busy} onClose={() => setTransitionRequest(null)}><form className="platform-form-grid" onSubmit={(event) => void transition(event)}><p className="platform-form-note">{transitionRequest.action === 'approve' ? 'This domain will become active for Business identity linking after approval.' : 'Suspending this domain stops it from being used for Business identity linking. Existing provider access is not changed.'}</p><label>Reason *<textarea required minLength={3} maxLength={500} rows={4} value={transitionReason} disabled={busy} onChange={(event) => setTransitionReason(event.target.value)} />{transitionError && <span className="platform-field-error" role="alert">{transitionError}</span>}</label><div className="platform-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setTransitionRequest(null)}>Cancel</Button><Button type="submit" variant={transitionRequest.action === 'suspend' ? 'danger' : 'primary'} busy={busy} disabled={transitionReason.trim().length < 3}>{transitionRequest.action === 'approve' ? 'Confirm approval' : 'Confirm suspension'}</Button></div></form></OperationsDialog>}</DetailSection>;
}

/* These legacy identity-domain panels remain retained for historical route compatibility; the combined panel above is the active renderer. */
/* eslint-disable @typescript-eslint/no-unused-vars */
function IdentityDomainResendPanel({ businessId, capabilities }: { businessId: string; capabilities: string[] }) {
  const [domains, setDomains] = useState<PlatformProviderIdentityDomain[]>([]);
  const [selected, setSelected] = useState<PlatformProviderIdentityDomain | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canManage = capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE');
  const load = async () => { try { setDomains((await operationsData.platformBusinessIdentityDomains(businessId)).data); } catch (cause) { setError(errorText(cause)); } };
  useEffect(() => { void load(); }, [businessId]);
  if (!canManage || !domains.some((row) => row.attributes.status === 'pending_verification')) return null;
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!selected || reason.trim().length < 3) return; setBusy(true); setError(''); try { await operationsData.resendPlatformBusinessIdentityDomain(businessId, selected.id, { expected_revision: selected.attributes.revision, reason: reason.trim() }, crypto.randomUUID()); setSelected(null); setReason(''); await load(); } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); } };
  return <DetailSection title="Verification delivery" description="Resend a pending domain verification email. Resending rotates the previous token and restarts the configured 24–48 hour expiry window."><p className="platform-form-note">Pending domains need email confirmation before they can be approved.</p><div className="platform-form-actions">{domains.filter((row) => row.attributes.status === 'pending_verification').map((row) => <Button key={row.id} variant="quiet" disabled={busy} onClick={() => { setSelected(row); setReason(''); setError(''); }}>Resend verification email</Button>)}</div>{error && <p className="platform-field-error" role="alert">{error}</p>}{selected && <OperationsDialog title={`Resend verification email · ${selected.attributes.domain}`} busy={busy} onClose={() => setSelected(null)}><form className="platform-form-grid" onSubmit={(event) => void submit(event)}><p className="platform-form-note">A new one-time link will be sent to {selected.attributes.verification_email || 'the recorded verification address'}. The previous link stops working.</p><label>Reason *<textarea required minLength={3} maxLength={500} rows={4} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} /></label>{error && <p className="platform-field-error" role="alert">{error}</p>}<div className="platform-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setSelected(null)}>Cancel</Button><Button type="submit" busy={busy} disabled={reason.trim().length < 3}>Resend verification email</Button></div></form></OperationsDialog>}</DetailSection>;
}

function LegacyProviderIdentityDomainsPanelV2({ businessId, businessName, capabilities }: { businessId: string; businessName?: string; capabilities: string[] }) {
  const [domains, setDomains] = useState<PlatformProviderIdentityDomain[]>([]);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteDomain, setDeleteDomain] = useState<PlatformProviderIdentityDomain | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [resendDomain, setResendDomain] = useState<PlatformProviderIdentityDomain | null>(null);
  const [resendReason, setResendReason] = useState('');
  const [resendError, setResendError] = useState('');
  const [form, setForm] = useState({ domain: '', verification_email: '', reason: '' });
  const canManage = capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE');
  const load = async () => { try { setDomains((await operationsData.platformBusinessIdentityDomains(businessId)).data); } catch (cause) { setError(errorText(cause)); } };
  useEffect(() => { void load(); }, [businessId]);
  const openAdd = () => { setFormError(''); setEmailError(''); setForm({ domain: '', verification_email: '', reason: '' }); setAddOpen(true); };
  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(''); setEmailError('');
    const domain = form.domain.trim().toLowerCase().replace(/\.$/, '');
    const email = form.verification_email.trim().toLowerCase();
    const emailDomain = email.split('@').at(-1) || '';
    if (emailDomain !== domain) { setEmailError('Verification email must belong to the requested domain.'); return; }
    setBusy(true);
    try {
      const result = await operationsData.createPlatformBusinessIdentityDomain(businessId, { domain, verification_email: email, reason: form.reason.trim() }, crypto.randomUUID());
      setAddOpen(false); setForm({ domain: '', verification_email: '', reason: '' });
      if (result.data.attributes.verification_delivery_status === 'FAILED') setError('The request was recorded, but the verification email could not be delivered.');
      await load();
    } catch (cause) { setFormError(errorText(cause)); }
    finally { setBusy(false); }
  };
  const transition = async (row: PlatformProviderIdentityDomain, action: 'approve' | 'suspend') => { const reason = window.prompt(`${action === 'approve' ? 'Approval' : 'Suspension'} reason`)?.trim() || ''; if (!reason) return; setBusy(true); try { await operationsData.transitionPlatformBusinessIdentityDomain(businessId, row.id, action, { expected_revision: row.attributes.revision, reason }, crypto.randomUUID()); await load(); } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); } };
  const remove = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!deleteDomain || !deleteReason.trim()) return; setBusy(true); try { await operationsData.deletePlatformBusinessIdentityDomain(businessId, deleteDomain.id, { expected_revision: deleteDomain.attributes.revision, reason: deleteReason.trim() }, crypto.randomUUID()); setDeleteDomain(null); setDeleteReason(''); await load(); } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); } };
  const resend = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!resendDomain || !resendReason.trim()) return; setBusy(true); setResendError(''); try { await operationsData.resendPlatformBusinessIdentityDomain(businessId, resendDomain.id, { expected_revision: resendDomain.attributes.revision, reason: resendReason.trim() }, crypto.randomUUID()); setResendDomain(null); setResendReason(''); await load(); } catch (cause) { setResendError(errorText(cause)); } finally { setBusy(false); } };
  return <DetailSection title={`Identity domains${businessName ? ` · ${businessName}` : ''}`} description="Verified corporate domains belong to the Business and apply to its provider accounts for Google identity linking. They never grant provider membership or roles."><div className="platform-form-actions">{canManage && <Button disabled={busy} onClick={openAdd}>Add identity domain</Button>}</div>{error && <p className="platform-field-error" role="alert">{error}</p>}{domains.length ? <div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Domain</th><th>Verification email</th><th>Status</th><th>Revision</th><th>Action</th></tr></thead><tbody>{domains.map((row) => <tr key={row.id}><td>{row.attributes.domain}</td><td>{row.attributes.verification_email || 'Not recorded'}</td><td><Status>{humanStatus(row.attributes.status)}</Status>{row.attributes.status === 'pending_verification' && <small className="platform-muted">Check the mailbox for the verification link.</small>}</td><td>{row.attributes.revision}</td><td><AdminActionMenu label={`Actions for ${row.attributes.domain}`}>{row.attributes.status === 'pending_approval' && canManage && <button type="button" disabled={busy} onClick={() => void transition(row, 'approve')}>Approve</button>}{row.attributes.status === 'active' && canManage && <button type="button" disabled={busy} onClick={() => void transition(row, 'suspend')}>Suspend</button>}{['pending_verification', 'pending_approval', 'suspended', 'rejected'].includes(row.attributes.status) && canManage && <button type="button" disabled={busy} onClick={() => { setDeleteDomain(row); setDeleteReason(''); }}>Delete</button>}{row.attributes.status === 'pending_verification' && <span className="platform-muted">Awaiting email verification</span>}</AdminActionMenu></td></tr>)}</tbody></table></div> : <p className="platform-muted">No Business identity domains configured.</p>}{addOpen && <OperationsDialog title="Add Business identity domain" busy={busy} onClose={() => setAddOpen(false)}><form className="platform-form-grid" onSubmit={(event) => void add(event)}><p className="platform-form-note">TRISE will send a one-time verification link to an email address at the requested domain. A Global Administrator must still approve the domain after email verification.</p><label>Corporate domain *<input required pattern="[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+" placeholder="company.in" value={form.domain} disabled={busy} onChange={(event) => { setEmailError(''); setForm((current) => ({ ...current, domain: event.target.value })); }} /></label><label>Verification email *<input required type="email" maxLength={320} placeholder="admin@company.in" aria-describedby={emailError ? 'identity-domain-email-error' : undefined} value={form.verification_email} disabled={busy} onChange={(event) => { setEmailError(''); setForm((current) => ({ ...current, verification_email: event.target.value })); }} />{emailError && <span id="identity-domain-email-error" className="platform-field-error" role="alert">{emailError}</span>}</label><p className="platform-form-note">The email domain must exactly match the requested corporate domain.</p><label>Reason *<textarea required minLength={3} maxLength={500} rows={4} value={form.reason} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></label>{formError && <p className="platform-field-error" role="alert">{formError}</p>}<div className="platform-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit" busy={busy} disabled={!form.domain.trim() || !form.verification_email.trim() || !form.reason.trim()}>Send verification email</Button></div></form></OperationsDialog>}{deleteDomain && <OperationsDialog title={`Delete ${deleteDomain.attributes.domain}`} busy={busy} onClose={() => setDeleteDomain(null)}><form className="platform-form-grid" onSubmit={(event) => void remove(event)}><p className="platform-form-note">This releases the Business domain reservation so it can be added again. Active domains cannot be deleted.</p><label>Reason *<textarea required minLength={3} maxLength={500} rows={4} value={deleteReason} disabled={busy} onChange={(event) => setDeleteReason(event.target.value)} /></label><div className="platform-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setDeleteDomain(null)}>Cancel</Button><Button type="submit" variant="danger" busy={busy} disabled={!deleteReason.trim()}>Delete domain</Button></div></form></OperationsDialog>}</DetailSection>;
}

function LegacyProviderIdentityDomainsPanel({ businessId, businessName, capabilities }: { businessId: string; businessName?: string; capabilities: string[] }) {
  const [domains, setDomains] = useState<PlatformProviderIdentityDomain[]>([]); const [error, setError] = useState(''); const [formError, setFormError] = useState(''); const [emailError, setEmailError] = useState(''); const [busy, setBusy] = useState(false); const [addOpen, setAddOpen] = useState(false); const [deleteDomain, setDeleteDomain] = useState<PlatformProviderIdentityDomain | null>(null); const [deleteReason, setDeleteReason] = useState(''); const [form, setForm] = useState({ domain: '', verification_email: '', reason: '' });
  const canManage = capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE');
  const load = async () => { try { setDomains((await operationsData.platformBusinessIdentityDomains(businessId)).data); } catch (cause) { setError(errorText(cause)); } };
  useEffect(() => { void load(); }, [businessId]);
  const add = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setFormError(''); setEmailError(''); const domain = form.domain.trim().toLowerCase().replace(/\.$/, ''); const email = form.verification_email.trim().toLowerCase(); const emailDomain = email.split('@').at(-1) || ''; if (!domain || !email || !form.reason.trim()) return; if (emailDomain !== domain) { setEmailError('Verification email must belong to the requested domain.'); return; } setBusy(true); setError(''); try { const result = await operationsData.createPlatformBusinessIdentityDomain(businessId, { domain, verification_email: email, reason: form.reason.trim() }, crypto.randomUUID()); setForm({ domain: '', verification_email: '', reason: '' }); setAddOpen(false); if (result.data.attributes.verification_delivery_status === 'FAILED') setError('The domain request was recorded, but the verification email could not be delivered. Check the email delivery configuration before asking the mailbox owner to verify.'); await load(); } catch (cause) { setFormError(errorText(cause)); } finally { setBusy(false); } };
  const transition = async (row: PlatformProviderIdentityDomain, action: 'approve' | 'suspend') => { const reason = window.prompt(`${action === 'approve' ? 'Approval' : 'Suspension'} reason`)?.trim() || ''; if (!reason) return; setBusy(true); try { await operationsData.transitionPlatformBusinessIdentityDomain(businessId, row.id, action, { expected_revision: row.attributes.revision, reason }, crypto.randomUUID()); await load(); } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); } };
  const remove = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!deleteDomain || !deleteReason.trim()) return; setBusy(true); setError(''); try { await operationsData.deletePlatformBusinessIdentityDomain(businessId, deleteDomain.id, { expected_revision: deleteDomain.attributes.revision, reason: deleteReason.trim() }, crypto.randomUUID()); setDeleteDomain(null); setDeleteReason(''); await load(); } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); } };
  return <DetailSection title={`Identity domains${businessName ? ` · ${businessName}` : ''}`} description="Verified corporate domains belong to the Business and apply to its provider accounts for Google identity linking. They never grant provider membership or roles."><div className="platform-form-actions">{canManage && <Button disabled={busy} onClick={() => setAddOpen(true)}>Add identity domain</Button>}</div>{error && <p className="platform-field-error" role="alert">{error}</p>}{domains.length ? <div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Domain</th><th>Verification email</th><th>Status</th><th>Revision</th><th>Action</th></tr></thead><tbody>{domains.map((row) => <tr key={row.id}><td>{row.attributes.domain}</td><td>{row.attributes.verification_email || 'Not recorded'}</td><td><Status>{humanStatus(row.attributes.status)}</Status>{row.attributes.status === 'pending_verification' && <small className="platform-muted">Check the mailbox for the verification link.</small>}</td><td>{row.attributes.revision}</td><td>{row.attributes.pending_status}{row.attributes.status === 'pending_approval' && canManage && <Button disabled={busy} onClick={() => void transition(row, 'approve')}>Approve</Button>}{row.attributes.status === 'active' && canManage && <Button variant="danger" disabled={busy} onClick={() => void transition(row, 'suspend')}>Suspend</Button>}{['pending_verification', 'pending_approval', 'suspended', 'rejected'].includes(row.attributes.status) && canManage && <Button variant="quiet" disabled={busy} onClick={() => { setDeleteDomain(row); setDeleteReason(''); }}>Delete</Button>}{row.attributes.status === 'pending_verification' && <span className="platform-muted">Awaiting email verification</span>}</td></tr>)}</tbody></table></div> : <p className="platform-muted">No Business identity domains configured.</p>}{addOpen && <OperationsDialog title="Add Business identity domain" busy={busy} onClose={() => setAddOpen(false)}><form className="platform-form-grid" onSubmit={(event) => void add(event)}><p className="platform-form-note">TRISE will send a one-time verification link to an email address at the requested domain. The link only confirms mailbox control; a Global Administrator must still approve the domain.</p><label>Corporate domain *<input required pattern="[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+" placeholder="company.in" value={form.domain} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))} /></label><label>Verification email *<input required type="email" maxLength={320} placeholder="admin@company.in" value={form.verification_email} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, verification_email: event.target.value }))} /></label><p className="platform-form-note">The email domain must exactly match the requested corporate domain.</p><label>Reason *<textarea required minLength={3} maxLength={500} rows={4} value={form.reason} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></label><div className="platform-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit" busy={busy} disabled={!form.domain.trim() || !form.verification_email.trim() || !form.reason.trim()}>Send verification email</Button></div></form></OperationsDialog>}{deleteDomain && <OperationsDialog title={`Delete ${deleteDomain.attributes.domain}`} busy={busy} onClose={() => setDeleteDomain(null)}><form className="platform-form-grid" onSubmit={(event) => void remove(event)}><p className="platform-form-note">This releases the Business domain reservation so it can be added again. Active domains cannot be deleted.</p><label>Reason *<textarea required minLength={3} maxLength={500} rows={4} value={deleteReason} disabled={busy} onChange={(event) => setDeleteReason(event.target.value)} /></label><div className="platform-form-actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setDeleteDomain(null)}>Cancel</Button><Button type="submit" variant="danger" busy={busy} disabled={!deleteReason.trim()}>Delete domain</Button></div></form></OperationsDialog>}</DetailSection>;
}

/* eslint-enable @typescript-eslint/no-unused-vars */
function ProviderSetupReturnBanner() {
  const returnTo = new URLSearchParams(window.location.hash.split('?')[1] || '').get('return_to');
  if (!returnTo) return null;
  return <div className="configuration-return-banner" role="status"><div><strong>Provider setup in progress</strong><small>Resolve this requirement, then return to the selected provider’s readiness checklist.</small></div><Button type="button" variant="secondary" onClick={() => { window.location.hash = returnTo; }}>Back to provider setup</Button></div>;
}

function ProviderDetailView({ selected, business, documents, reviews, capabilities, sectionErrors, onDecision }: { selected: Resource<PlatformProviderAttributes>; business: ProviderBusinessProfile | null; documents: ProviderDocument[]; reviews: ProviderVerificationReview[]; capabilities: string[]; sectionErrors: Record<string, string>; onDecision: (review: ProviderVerificationReview, decision: string, reason: string) => Promise<void> }) {
  const access = providerDetailAccess(capabilities);
  const [tab, setTab] = useState<ProviderDetailTab>(() => { const requested = tabFromHash(selected.id); return requested === 'subscription' && !access.manageSubscription ? 'overview' : requested; });
  const [detailData, setDetailData] = useState<ProviderDetailData>({ contacts: null, locations: null, subscription: null, requests: null, plans: [], usage: null, loading: true, errors: {} });
  const canReadSubscription = capabilities.includes('PLATFORM_SUBSCRIPTION_READ');
  const canReadPlans = capabilities.includes('PLATFORM_PLAN_READ');
  const canReadUsage = access.readUsage;
  const detailGeneration = useRef(0);
  const loadDetailData = () => {
    const generation = ++detailGeneration.current;
    setDetailData((previous) => ({ ...previous, loading: true, errors: {} }));
    void (async () => {
      const tasks = await Promise.allSettled([
        collectPages((after) => operationsData.platformOnboardingContacts(selected.id, after)),
        collectPages((after) => operationsData.platformOnboardingLocations(selected.id, after)),
        canReadSubscription ? collectPages((after) => operationsData.platformSubscriptions({ providerId: selected.id, after })) : Promise.resolve([]),
        canReadSubscription ? collectPages((after) => operationsData.platformSubscriptionRequests({ providerId: selected.id, after })) : Promise.resolve([]),
        canReadPlans ? collectPages((after) => operationsData.platformPlans({ status: 'ACTIVE', after })) : Promise.resolve([]),
      ] as const);
      if (detailGeneration.current !== generation) return;
      const errors: Record<string, string> = {};
      const contacts = tasks[0].status === 'fulfilled' ? tasks[0].value : null;
      const locations = tasks[1].status === 'fulfilled' ? tasks[1].value : null;
      const subscriptions = tasks[2].status === 'fulfilled' ? tasks[2].value : [];
      const requests = tasks[3].status === 'fulfilled' ? tasks[3].value : null;
      const plans = tasks[4].status === 'fulfilled' ? tasks[4].value : [];
      if (tasks[0].status === 'rejected') errors.contacts = errorText(tasks[0].reason);
      if (tasks[1].status === 'rejected') errors.locations = errorText(tasks[1].reason);
      if (tasks[2].status === 'rejected') errors.subscription = errorText(tasks[2].reason);
      if (tasks[3].status === 'rejected') errors.requests = errorText(tasks[3].reason);
      if (tasks[4].status === 'rejected') errors.plans = errorText(tasks[4].reason);
      const activeSubscription = subscriptions.find((row) => row.attributes.status === 'ACTIVE') || subscriptions[0] || null;
      let usage: PlatformUsage | null = null;
      if (activeSubscription && canReadUsage) {
        try { usage = (await operationsData.platformSubscriptionUsage(selected.id)).data; }
        catch (cause) { errors.usage = errorText(cause); }
      }
      if (detailGeneration.current !== generation) return;
      setDetailData({ contacts, locations, subscription: activeSubscription, requests, plans, usage, loading: false, errors });
    })();
    return () => { if (detailGeneration.current === generation) detailGeneration.current += 1; };
  };
  useEffect(() => loadDetailData(), [selected.id, capabilities.join('|')]);
  useEffect(() => { const onHash = () => { const requested = tabFromHash(selected.id); setTab(requested === 'subscription' && !access.manageSubscription ? 'overview' : requested); }; window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash); }, [selected.id, access.manageSubscription]);
  const states = providerOnboardingStates({ provider: selected.attributes, business, businessUnavailable: Boolean(sectionErrors.business), documents, documentsUnavailable: Boolean(sectionErrors.documents), contacts: detailData.contacts?.map((row) => row.attributes) ?? null, locations: detailData.locations?.map((row) => row.attributes) ?? null, subscription: detailData.subscription?.attributes || null, requests: detailData.requests ?? null });
  const lifecycleOptions = access.reviewLifecycle ? lifecycleActions(selected.attributes.status) : [];
  const incompleteIndex = providerSetupSummary(selected.attributes, states).firstIncomplete;
  const needsSetupReview = selected.attributes.status !== 'ACTIVE' || selected.attributes.provider_admin_setup === 'not_configured' || !providerSetupSummary(selected.attributes, states).complete;
  const primaryStep = selected.attributes.status === 'ACTIVE' && selected.attributes.provider_admin_setup === 'not_configured' ? 5 : incompleteIndex;
  const stepPermissions = [access.editProvider, access.editBusiness, true, access.transferDocuments, access.manageSubscription, true];
  const primaryAction = needsSetupReview && stepPermissions[primaryStep] ? providerOnboardingRoute(selected.id, primaryStep) : undefined;
  const providerRegistrationAllowed = access.editProvider;
  const profileWriteAllowed = access.editBusiness;
  const subscriptionReadAllowed = access.manageSubscription;
  const panelId = `provider-detail-${tab}`;
  function selectTab(next: ProviderDetailTab) {
    setTab(next);
    const returnTo = new URLSearchParams(window.location.hash.split('?')[1] || '').get('return_to');
    const returnQuery = returnTo ? `&return_to=${encodeURIComponent(returnTo)}` : '';
    go(`platform/providers/${selected.id}?tab=${next}${returnQuery}`);
  }
  function retryDetailData() { void loadDetailData(); }
  const setupComplete = providerSetupSummary(selected.attributes, states).complete;
  const readinessLabel = selected.attributes.provider_admin_setup === 'not_configured' || states.some((state) => state === 'rejected' || state === 'needs_attention') ? 'Needs attention' : setupComplete ? 'Complete' : states.includes('not_available') ? 'Evidence unavailable' : 'In progress';
  const primaryLabel = selected.attributes.status === 'ACTIVE' ? 'Review setup' : 'Continue setup';
  return <section className="platform-page provider-detail-page">
      <div className="provider-detail-breadcrumb"><button type="button" onClick={() => go('platform/overview')}>Platform administration</button><SvgIcon name="chevron-right" size={14} /><button type="button" onClick={() => go('platform/providers')}>Service Providers</button><SvgIcon name="chevron-right" size={14} /><strong>{selected.attributes.display_name}</strong></div>
    <ProviderSetupReturnBanner />
    <header className="provider-identity-panel">
      <div className="provider-identity-copy"><p className="platform-eyebrow">Provider administration</p><h1 title={selected.attributes.display_name}>{selected.attributes.display_name}</h1><p className="provider-identity-meta"><span>{selected.attributes.provider_code || 'Provider code not supplied'}</span><span>{selected.attributes.representation || selected.attributes.representation_kind || 'Provider type unavailable'}</span><span>Registered {formatDate(selected.attributes.effective_from)}</span></p><div className="provider-identity-badges"><span><small>Lifecycle</small><Status>{humanStatus(selected.attributes.status)}</Status></span><span><small>Business verification</small><Status>{sectionErrors.business ? 'Unavailable' : selected.attributes.business_verification_status ? humanStatus(selected.attributes.business_verification_status) : 'Not available'}</Status></span><span><small>Onboarding readiness</small><Status>{readinessLabel}</Status></span></div></div>
      <div className="provider-identity-actions">{needsSetupReview && primaryAction && <Button onClick={() => go(primaryAction)}><SvgIcon name="arrow-right" size={15} /> {primaryLabel}</Button>}<details className="provider-actions-menu"><summary><span aria-hidden="true">•••</span> Actions</summary><div>
        {providerRegistrationAllowed && <button type="button" onClick={() => go(`platform/providers/${selected.id}/edit`)}>Edit provider</button>}
        {profileWriteAllowed && <button type="button" onClick={() => go(`platform/providers/${selected.id}/business-profile/edit`)}>Edit business profile</button>}
        {subscriptionReadAllowed && <button type="button" onClick={() => go(`platform/providers/${selected.id}?tab=subscription`)}>Manage subscription</button>}
        <button type="button" onClick={() => selectTab('audit')}>View audit history</button>
        {lifecycleOptions.length > 0 && <button type="button" onClick={() => go(`platform/providers/${selected.id}/lifecycle`)}>Manage operational lifecycle</button>}
      </div></details></div>
    </header>
    {tab === 'overview' && <details className="provider-review-setup"><summary>Review setup checklist</summary><ProviderDetailStepper provider={selected} states={states} providerId={selected.id} loading={detailData.loading} /></details>}
    <nav className="provider-detail-tabs" role="tablist" aria-label="Provider detail sections">{providerTabs.filter((item) => item.id !== 'subscription' || access.manageSubscription).map((item, index, tabs) => <button key={item.id} id={`provider-tab-${item.id}`} role="tab" tabIndex={tab === item.id ? 0 : -1} aria-selected={tab === item.id} aria-controls={`provider-detail-${item.id}`} type="button" className={tab === item.id ? 'active' : ''} onClick={() => selectTab(item.id)} onKeyDown={(event) => { if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length; document.getElementById(`provider-tab-${tabs[next].id}`)?.focus(); selectTab(tabs[next].id); }}>{item.label}</button>)}</nav>
    <div id={panelId} className="platform-provider-detail-panel" role="tabpanel" aria-labelledby={`provider-tab-${tab}`}>
      {tab === 'overview' && <ProviderOverviewDashboard selected={selected} business={business} documents={documents} capabilities={capabilities} data={detailData} sectionErrors={sectionErrors} onRetry={retryDetailData} />}
      {tab === 'business' && (sectionErrors.business ? <StatePanel title="Business profile unavailable"><span>{sectionErrors.business}</span><Button onClick={() => window.location.reload()}>Retry</Button></StatePanel> : <ProviderBusinessSections section="business" business={business} documents={documents} reviews={reviews} canDecide={capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE')} canTransfer={capabilities.includes('PLATFORM_PROVIDER_DOCUMENTS')} onDecision={onDecision} />)}
      {tab === 'subscription' && <PlatformProviderSubscription key={selected.id} providerId={selected.id} capabilities={capabilities} />}
      {tab === 'operations' && <ProviderOperationsPanel providerId={selected.id} providerStatus={selected.attributes.status} verificationStatus={business?.verification_status} capabilities={capabilities} subscription={detailData.subscription} subscriptionError={detailData.errors.subscription} />}
      {tab === 'documents' && (sectionErrors.documents ? <StatePanel title="Documents unavailable"><span>{sectionErrors.documents}</span><Button onClick={() => window.location.reload()}>Retry</Button></StatePanel> : <ProviderBusinessSections section="documents" business={business} documents={documents} reviews={reviews} canDecide={capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE')} canTransfer={capabilities.includes('PLATFORM_PROVIDER_DOCUMENTS')} onDecision={onDecision} />)}
      {tab === 'reviews' && (sectionErrors.reviews ? <StatePanel title="Reviews unavailable"><span>{sectionErrors.reviews}</span><Button onClick={() => window.location.reload()}>Retry</Button></StatePanel> : <ProviderBusinessSections section="reviews" business={business} documents={documents} reviews={reviews} canDecide={capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE')} canTransfer={capabilities.includes('PLATFORM_PROVIDER_DOCUMENTS')} onDecision={onDecision} />)}
      {tab === 'access' && <ProviderAdministratorsPanel providerId={selected.id} businessId={selected.attributes.business_id} capabilities={capabilities} />}
      {tab === 'audit' && <PlatformProviderAuditHistory events={selected.attributes.audit_history || []} partyName={selected.attributes.display_name} />}
    </div>
  </section>;
}

function ProviderLifecyclePanel({ provider, capabilities, busy, onTransition, onRequest, requests, onReview }: { provider: Resource<PlatformProviderAttributes>; capabilities: string[]; busy: boolean; onTransition: (action: ProviderLifecycleAction, reasonCode: string, reason: string) => Promise<void>; onRequest: (action: ProviderLifecycleAction, reasonCode: string, reason: string) => Promise<void>; requests: ProviderLifecycleApproval[]; onReview: (requestId: string, outcome: 'approve' | 'reject') => Promise<void> }) {
  const [selectedAction, setSelectedAction] = useState<ProviderLifecycleAction | ''>('');
  const [reasonCode, setReasonCode] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const requesting = capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE_REQUEST') && !capabilities.includes('PLATFORM_PROVIDER_RESTRICT') && !capabilities.includes('PLATFORM_PROVIDER_ACTIVATE');
  const available = lifecycleActions(provider.attributes.status).filter((option) => requesting || capabilities.includes(option.capability));
  const option = available.find((item) => item.action === selectedAction);
  const blocker = selectedAction === 'activate' || selectedAction === 'reactivate' ? activationBlocker(provider.attributes.business_verification_status) : '';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!option) { setError('Select an available lifecycle action.'); return; }
    const normalizedCode = reasonCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(normalizedCode)) { setError('Enter a reason code using letters, numbers, and underscores.'); return; }
    if (!reason.trim()) { setError('Enter a reason before confirming this lifecycle action.'); return; }
    if (blocker) { setError(blocker); return; }
    setConfirmOpen(true);
  }
  async function confirmTransition() {
    if (!option) return;
    const normalizedCode = reasonCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    try {
      if (requesting) await onRequest(option.action, normalizedCode, reason.trim()); else await onTransition(option.action, normalizedCode, reason.trim());
      setSelectedAction(''); setReasonCode(''); setReason(''); setConfirmOpen(false);
    } catch {
      // The parent exposes the authoritative API error without losing the entered reason.
    }
  }
  return <DetailSection title="Operational lifecycle" description={requesting ? 'Submit a lifecycle request for Global Administrator approval. The provider status will not change until approved.' : 'Lifecycle changes take effect immediately for Global Administrators and are audited.'}>
    <dl className="platform-definition-list"><dt>Current status</dt><dd><Status>{humanStatus(provider.attributes.status)}</Status></dd><dt>Lifecycle revision</dt><dd>{provider.attributes.lifecycle_revision ?? 0}</dd><dt>Business verification</dt><dd><Status>{humanStatus(provider.attributes.business_verification_status)}</Status></dd></dl>
    {!available.length ? <p className="platform-muted">No lifecycle action is available for your platform permissions and the current status.</p> : <form className="platform-lifecycle-form" onSubmit={submit}><label>Action<select value={selectedAction} onChange={(event) => { setSelectedAction(event.target.value as ProviderLifecycleAction); setError(''); }}><option value="">Select action</option>{available.map((item) => <option key={item.action} value={item.action}>{item.label}</option>)}</select></label><label>Reason code<input value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} placeholder="COMPLIANCE_REVIEW" required /></label><label className="platform-lifecycle-reason">Reason <span className="platform-muted">(required)</span><textarea required value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} /></label>{blocker && <p className="platform-field-error" role="alert">{blocker}</p>}{error && <p className="platform-field-error" role="alert">{error}</p>}<div className="platform-form-actions"><Button type="submit" variant={option?.danger ? 'danger' : 'primary'} disabled={!option || busy || Boolean(blocker)} busy={busy}>{requesting ? 'Submit for Global Admin approval' : option?.label || 'Apply lifecycle action'}</Button></div></form>}
    {confirmOpen && option && <OperationsDialog title={requesting ? 'Submit Service Provider Lifecycle Request' : option.action === 'restrict' ? 'Restrict Service Provider' : option.action === 'reactivate' ? 'Reactivate Service Provider' : `Confirm ${option.label.toLowerCase()}`} busy={busy} onClose={() => setConfirmOpen(false)}><p><strong>{provider.attributes.display_name}</strong> {requesting ? `will receive a pending ${option.label.toLowerCase()} request for Global Administrator approval.` : `will change from ${humanStatus(provider.attributes.status)} to ${humanStatus(option.action === 'restrict' ? 'SUSPENDED' : option.action === 'reactivate' ? 'ACTIVE' : option.action.toUpperCase())}.`}</p><p>{requesting ? 'The provider remains in its current state until a Global Administrator approves the request.' : option.action === 'restrict' ? 'Provider-scoped operations, provider workspace selection and new operational requests will be blocked. Stored provider data and historical records remain preserved.' : option.action === 'reactivate' ? 'Only independently active memberships regain effective provider access. Restricted memberships remain blocked.' : 'This lifecycle action is authorized and audited by the server.'}</p><dl className="platform-definition-list"><dt>Reason code</dt><dd>{reasonCode.trim().toUpperCase()}</dd><dt>Reason</dt><dd>{reason.trim()}</dd></dl><div className="platform-form-actions"><Button variant="secondary" disabled={busy} onClick={() => setConfirmOpen(false)}>Cancel</Button><Button variant={option.danger ? 'danger' : 'primary'} busy={busy} onClick={() => void confirmTransition()}>{requesting ? 'Submit Request' : option.action === 'restrict' ? 'Confirm Restriction' : option.action === 'reactivate' ? 'Confirm Reactivation' : option.label}</Button></div></OperationsDialog>}
    {capabilities.includes('PLATFORM_PROVIDER_LIFECYCLE') && requests.some((request) => request.attributes.status === 'PENDING') && <DetailSection title="Pending approval requests" description="Only a Global Administrator can approve or reject these requests."><div className="platform-form-actions">{requests.filter((request) => request.attributes.status === 'PENDING').map((request) => <div key={request.id}><Status>{humanStatus(request.attributes.action)}</Status><span className="platform-muted"> · {request.attributes.reason}</span><Button disabled={busy} onClick={() => void onReview(request.id, 'approve')}>Approve</Button><Button variant="danger" disabled={busy} onClick={() => void onReview(request.id, 'reject')}>Reject</Button></div>)}</div></DetailSection>}
  </DetailSection>;
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
  const [providerSectionErrors, setProviderSectionErrors] = useState<Record<string, string>>({});
  const [onboardingProgressData, setOnboardingProgressData] = useState<ProviderOnboardingProgressData>({ contacts: null, locations: null, subscription: null, requests: null, loading: true });
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [lifecycleRequests, setLifecycleRequests] = useState<ProviderLifecycleApproval[]>([]);
  const route = parsePlatformProviderRoute(window.location.hash);
  const providerId = 'providerId' in route ? route.providerId : '';
  const capabilityKey = platformCapabilities.join('|');
  const currentProvider = useRef(providerId); currentProvider.current = providerId;
  const isNew = route.kind === 'new';
  const isEdit = route.kind === 'edit';
  const isBusinessEdit = route.kind === 'business-profile';
  const isContacts = route.kind === 'contacts';
  const isLocations = route.kind === 'locations';
  const isOnboarding = isContacts || isLocations;
  const isDocuments = route.kind === 'documents';
  const isSubscription = route.kind === 'subscription';
  const isReview = route.kind === 'review';
  const isLifecycle = route.kind === 'lifecycle';
  const isDetail = route.kind === 'detail';
  const isDirectory = route.kind === 'directory';
  const isBusinessDirectory = route.kind === 'businesses';
  const isUnknown = route.kind === 'unknown';
  const refreshProvider = useCallback(async () => {
    if (!providerId) return;
    const canReadOnboarding = platformCapabilities.some((capability) => ['PLATFORM_PROVIDER_REGISTER', 'PLATFORM_PROVIDER_PROFILE_WRITE', 'PLATFORM_PROVIDER_BUSINESS_WRITE', 'PLATFORM_PROVIDER_ONBOARD'].includes(capability));
    const canReadSubscriptions = platformCapabilities.includes('PLATFORM_SUBSCRIPTION_READ');
    setOnboardingProgressData((previous) => ({ ...previous, loading: true }));
    const [record, profile, documentPage, reviewPage, contactPage, locationPage, subscriptions, requests] = await Promise.allSettled([
      operationsData.platformProvider(providerId), operationsData.platformBusinessProfile(providerId), operationsData.platformDocuments(providerId), operationsData.platformVerificationReviews(providerId),
      canReadOnboarding ? collectPages((after) => operationsData.platformOnboardingContacts(providerId, after)) : Promise.resolve(null),
      canReadOnboarding ? collectPages((after) => operationsData.platformOnboardingLocations(providerId, after)) : Promise.resolve(null),
      canReadSubscriptions ? collectPages((after) => operationsData.platformSubscriptions({ providerId, after })) : Promise.resolve(null),
      canReadSubscriptions ? collectPages((after) => operationsData.platformSubscriptionRequests({ providerId, after })) : Promise.resolve(null),
    ]);
    if (currentProvider.current !== providerId) return;
    if (record.status === 'rejected') throw record.reason;
    const sectionErrors: Record<string, string> = {};
    setSelected(record.value);
    setBusiness(profile.status === 'fulfilled' ? profile.value.data : null);
    setDocuments(documentPage.status === 'fulfilled' ? documentPage.value.data as ProviderDocument[] : []);
    setReviews(reviewPage.status === 'fulfilled' ? reviewPage.value.data as ProviderVerificationReview[] : []);
    if (profile.status === 'rejected') sectionErrors.business = errorText(profile.reason);
    if (documentPage.status === 'rejected') sectionErrors.documents = errorText(documentPage.reason);
    if (reviewPage.status === 'rejected') sectionErrors.reviews = errorText(reviewPage.reason);
    setProviderSectionErrors(sectionErrors);
    const subscriptionRows = subscriptions.status === 'fulfilled' ? subscriptions.value : null;
    setOnboardingProgressData({
      contacts: contactPage.status === 'fulfilled' ? contactPage.value : null,
      locations: locationPage.status === 'fulfilled' ? locationPage.value : null,
      subscription: subscriptionRows?.find((item) => item.attributes.status === 'ACTIVE') || subscriptionRows?.[0] || null,
      requests: requests.status === 'fulfilled' ? requests.value : null,
      loading: false,
    });
  }, [providerId, capabilityKey]);
  useEffect(() => { let cancelled = false; if (isNew || isDetail || isEdit || isBusinessEdit || isOnboarding || isDocuments || isSubscription || isReview || isLifecycle || isUnknown || isBusinessDirectory) return () => { cancelled = true; }; setLoading(true); setError(''); const request = isDirectory ? operationsData.platformProviders() : operationsData.platformOverview(); request.then((result) => { if (cancelled) return; if (isDirectory) setProviders((result as { data: Resource<PlatformProviderAttributes>[] }).data); else setOverview(result as PlatformOverview); setLoading(false); }).catch((cause) => { if (!cancelled) { setError(errorText(cause)); setLoading(false); } }); return () => { cancelled = true; }; }, [isDirectory, isDetail, isDocuments, isEdit, isBusinessEdit, isNew, isOnboarding, isSubscription, isReview, isLifecycle, isUnknown, isBusinessDirectory]);
  useEffect(() => {
    let cancelled = false;
    if (!providerId) { setSelected(null); setBusiness(null); setDocuments([]); setReviews([]); setProviderSectionErrors({}); setOnboardingProgressData({ contacts: null, locations: null, subscription: null, requests: null, loading: false }); setLoading(false); return () => { cancelled = true; }; }
    setLifecycleBusy(false); setLoading(true); setError(''); setOnboardingProgressData({ contacts: null, locations: null, subscription: null, requests: null, loading: true });
    void refreshProvider().catch((cause) => { if (!cancelled && currentProvider.current === providerId) { setError(errorText(cause)); setSelected(null); } }).finally(() => { if (!cancelled && currentProvider.current === providerId) setLoading(false); });
    return () => { cancelled = true; };
  }, [providerId, refreshProvider]);
  async function decideReview(review: ProviderVerificationReview, decision: string, reason: string) { if (decision !== 'VERIFY' && !reason.trim()) { setError('Add a reason for corrections or rejection.'); return; } try { await operationsData.decideProviderVerificationReview(providerId, review.id, { decision, ...(reason.trim() ? { reason: reason.trim() } : {}), expected_revision: review.attributes.revision }, crypto.randomUUID()); await refreshProvider(); } catch (cause) { if (currentProvider.current === providerId) setError(errorText(cause)); } }
  async function transitionLifecycle(action: ProviderLifecycleAction, reasonCode: string, reason: string) { if (!selected) return; setLifecycleBusy(true); setError(''); try { const result = await operationsData.transitionPlatformProviderLifecycle(selected.id, action, { expected_revision: selected.attributes.lifecycle_revision ?? 0, reason_code: reasonCode, ...(reason ? { reason } : {}) }, crypto.randomUUID()); if (currentProvider.current !== providerId) return; setSelected(result.provider); await refreshProvider(); } catch (cause) { if (currentProvider.current === providerId) setError(errorText(cause)); throw cause; } finally { if (currentProvider.current === providerId) setLifecycleBusy(false); } }
  async function requestLifecycle(action: ProviderLifecycleAction, reasonCode: string, reason: string) { if (!selected) return; setLifecycleBusy(true); setError(''); try { await operationsData.createPlatformProviderLifecycleRequest(selected.id, { action: action.toUpperCase(), expected_revision: selected.attributes.lifecycle_revision ?? 0, reason_code: reasonCode, reason }, crypto.randomUUID()); setLifecycleRequests((await operationsData.platformProviderLifecycleRequests(selected.id)).data); } catch (cause) { setError(errorText(cause)); throw cause; } finally { setLifecycleBusy(false); } }
  async function reviewLifecycle(requestId: string, outcome: 'approve' | 'reject') { if (!selected) return; const reviewReason = window.prompt(outcome === 'approve' ? 'Approval reason' : 'Rejection reason')?.trim() || ''; if (!reviewReason) return; setLifecycleBusy(true); try { const result = outcome === 'approve' ? await operationsData.approvePlatformProviderLifecycleRequest(selected.id, requestId, reviewReason, crypto.randomUUID()) : await operationsData.rejectPlatformProviderLifecycleRequest(selected.id, requestId, reviewReason, crypto.randomUUID()); const reviewed = result as { data: ProviderLifecycleApproval; provider?: Resource<PlatformProviderAttributes> }; setLifecycleRequests((current) => current.map((request) => request.id === requestId ? reviewed.data : request)); if (reviewed.provider) { setSelected(reviewed.provider); await refreshProvider(); } } catch (cause) { setError(errorText(cause)); } finally { setLifecycleBusy(false); } }
  useEffect(() => { if (!isLifecycle || !selected) return; void operationsData.platformProviderLifecycleRequests(selected.id).then((response) => setLifecycleRequests(response.data)).catch(() => setLifecycleRequests([])); }, [isLifecycle, selected?.id, capabilityKey]);
  const onboardingStates = selected ? providerOnboardingStates({
    provider: selected.attributes, business, businessUnavailable: Boolean(providerSectionErrors.business), documents, documentsUnavailable: Boolean(providerSectionErrors.documents),
    contacts: onboardingProgressData.contacts?.map((item) => item.attributes) ?? null,
    locations: onboardingProgressData.locations?.map((item) => item.attributes) ?? null,
    subscription: onboardingProgressData.subscription?.attributes || null,
    requests: onboardingProgressData.requests,
  }) : undefined;
  const stepStates = onboardingStates || (['not_available', 'not_available', 'not_available', 'not_available', 'not_available', 'not_available'] as OnboardingState[]);
  const isProviderRecordRoute = isDetail || isEdit || isBusinessEdit || isOnboarding || isDocuments || isSubscription || isReview || isLifecycle;
  if (isNew && !platformCapabilities.includes('PLATFORM_PROVIDER_REGISTER')) return <section className="platform-page"><StatePanel title="Provider registration is restricted">Your active platform grant does not include provider registration.</StatePanel></section>;
  if (isNew) return <section className="platform-page"><ProviderForm capabilities={platformCapabilities} /></section>;
  if (isBusinessDirectory) return <section className="platform-page"><BusinessDirectory capabilities={platformCapabilities} /></section>;
  if (isUnknown) return <section className="platform-page"><PlatformBreadcrumb current="Page not found" /><StatePanel title="Provider page not found"><span>This provider administration route is not available.</span><Button variant="secondary" onClick={() => go('platform/providers')}>Back to providers</Button></StatePanel></section>;
  if (isProviderRecordRoute && !error && (loading || selected?.id !== providerId)) return <StatePanel title="Loading provider profile">Retrieving the latest provider revision…</StatePanel>;
  if (isProviderRecordRoute && error && selected?.id !== providerId) return <StatePanel title="Provider profile unavailable"><span>{error}</span><Button onClick={() => window.location.reload()}>Retry</Button></StatePanel>;
  if (isEdit && !platformCapabilities.includes('PLATFORM_PROVIDER_REGISTER')) return <section className="platform-page"><StatePanel title="Provider editing is restricted">Your active platform grant does not include provider registration and profile editing.</StatePanel></section>;
  if (isBusinessEdit && !platformCapabilities.some((capability) => ['PLATFORM_PROVIDER_PROFILE_WRITE', 'PLATFORM_PROVIDER_BUSINESS_WRITE'].includes(capability))) return <section className="platform-page"><StatePanel title="Business profile editing is restricted">Your active platform grant does not include provider business-profile editing.</StatePanel></section>;
  if (isEdit || isBusinessEdit) { if (loading && !selected) return <StatePanel title="Loading provider profile">Retrieving the latest provider revision…</StatePanel>; if (error && !selected) return <StatePanel title="Provider profile unavailable"><span>{error}</span><Button onClick={() => window.location.reload()}>Retry</Button></StatePanel>; if (isBusinessEdit && providerSectionErrors.business) return <StatePanel title="Business profile unavailable"><span>{providerSectionErrors.business}</span><Button onClick={() => window.location.reload()}>Retry</Button></StatePanel>; return isBusinessEdit && business && selected ? <PlatformBusinessProfileForm providerId={providerId} businessId={selected.attributes.business_id || ''} providerName={selected.attributes.display_name} providerStatus={selected.attributes.status} profile={business} onSaved={refreshProvider} capabilities={platformCapabilities} onboardingStates={stepStates} /> : <section className="platform-page"><ProviderForm record={selected || undefined} capabilities={platformCapabilities} /></section>; }
  if (isOnboarding && selected) return <ProviderContactsLocationsStep key={providerId} providerId={providerId} providerName={selected.attributes.display_name} tab={isLocations ? 'locations' : 'contacts'} capabilities={platformCapabilities} onboardingStates={stepStates} />;
  if (isDocuments && selected) return <section className="platform-page"><PlatformBreadcrumb current={`Documents · ${selected.attributes.display_name}`} /><ProviderOnboardingStepper current={3} providerId={providerId} states={stepStates} capabilities={platformCapabilities} /><PageHeader eyebrow="Provider onboarding" title="Documents" description="Upload private business-verification evidence, then preview supported images or PDFs and download an authorized attachment." /><ProviderDocumentsStep providerId={providerId} canUpload={platformCapabilities.includes('PLATFORM_PROVIDER_DOCUMENTS')} onChanged={refreshProvider} showDocumentList={false} /><DetailSection title="Preview and download" description="Each action obtains a fresh, short-lived authorization. PDF and image content is loaded into a local browser object URL."><PlatformDocumentList providerId={providerId} documents={documents} canTransfer={platformCapabilities.includes('PLATFORM_PROVIDER_DOCUMENTS')} /></DetailSection><div className="platform-form-actions"><Button variant="secondary" onClick={() => go(`platform/providers/${providerId}/onboarding/locations`)}>Back to contacts and locations</Button><Button onClick={() => go(`platform/providers/${providerId}/onboarding/subscription`)}>Continue to plan selection</Button></div></section>;
  if (isSubscription && selected) return <section className="platform-page"><PlatformBreadcrumb current={`Plan & approval · ${selected.attributes.display_name}`} /><ProviderOnboardingStepper current={4} providerId={providerId} states={stepStates} capabilities={platformCapabilities} /><PageHeader eyebrow="Provider onboarding" title="Plan and approval" description="The published demonstration plan is selected by default and will be assigned after activation from the business verification date. Selecting another plan keeps its existing review and payment steps." /><PlatformProviderSubscription key={providerId} providerId={providerId} capabilities={platformCapabilities} onboarding /><div className="platform-form-actions"><Button variant="secondary" onClick={() => go(`platform/providers/${providerId}/onboarding/documents`)}>Back to documents</Button><Button onClick={() => go(`platform/providers/${providerId}/onboarding/review`)}>Continue to final review</Button></div></section>;
  if (isReview && selected) return <section className="platform-page"><PlatformBreadcrumb current={`Review & activate · ${selected.attributes.display_name}`} /><ProviderOnboardingStepper current={5} providerId={providerId} states={stepStates} capabilities={platformCapabilities} /><PageHeader eyebrow="Provider onboarding" title="Review and activate" description="Review backend-recorded onboarding evidence. Operational activation remains a separate audited lifecycle action." /><ProviderOnboardingReviewDashboard provider={selected} business={business} documents={documents} reviews={reviews} capabilities={platformCapabilities} />{error && <StatePanel title="Provider review needs attention"><span>{error}</span></StatePanel>}<div className="platform-form-actions"><Button variant="secondary" onClick={() => go(`platform/providers/${providerId}/onboarding/subscription`)}>Back to Plan & Approval</Button><Button onClick={() => go(`platform/providers/${providerId}`)}>View provider details</Button></div></section>;
  if (isLifecycle && selected) return <section className="platform-page"><PlatformBreadcrumb current={`Service Provider Access & Lifecycle · ${selected.attributes.display_name}`} /><PageHeader eyebrow="Platform Service Provider administration" title="Service Provider Access & Lifecycle" description="Manage the Service Provider account lifecycle. Changes affect provider-scoped access immediately and are recorded separately from registration review." /><DetailSection title="Service Provider activation and lifecycle" description="The API enforces current verification, revision, authorization and audit requirements."><ProviderLifecyclePanel provider={selected} capabilities={platformCapabilities} busy={lifecycleBusy} onTransition={transitionLifecycle} onRequest={requestLifecycle} requests={lifecycleRequests} onReview={reviewLifecycle} /></DetailSection><div className="platform-form-actions"><Button variant="secondary" onClick={() => go(`platform/providers/${providerId}/onboarding/review`)}>Back to registration review</Button><Button onClick={() => go(`platform/providers/${providerId}`)}>Service Provider details</Button></div></section>;
  if (loading && (isDetail ? !selected : !providers.length && !overview)) return <StatePanel title="Loading platform data">Retrieving authorized provider information…</StatePanel>;
  if (error && (isDetail || (!overview && !providers.length))) return <StatePanel title="Platform data is unavailable"><span>{error}</span><Button onClick={() => window.location.reload()}>Retry</Button></StatePanel>;
  if (isDetail && !selected) return <StatePanel title="Provider not found"><span>This provider is not available in the platform directory.</span><Button variant="secondary" onClick={() => go('platform/providers')}>Back to providers</Button></StatePanel>;
  if (isDetail && selected) return <ProviderDetailView key={selected.id} selected={selected} business={business} documents={documents} reviews={reviews} capabilities={platformCapabilities} sectionErrors={providerSectionErrors} onDecision={decideReview} />;
  if (isDirectory) return <section className="platform-page"><ProviderDirectory initialProviders={providers} initialError={error} /></section>;
  return <section className="platform-page"><PlatformBreadcrumb current="Overview" /><PageHeader eyebrow="Platform administration" title="Platform overview" description="Monitor provider readiness and open the platform controls you are authorized to manage." />{error && <StatePanel title="Platform overview unavailable"><span>{error}</span><Button onClick={() => window.location.reload()}>Retry</Button></StatePanel>}{overview && <><ProviderSummaryCards overview={overview} /><DetailSection title="Quick actions" description="Jump directly to the platform area that needs attention."><PlatformOverviewActions /></DetailSection></>}</section>;
}

export function PlatformRoute({ session }: { session: { userId?: string; platformAdmin?: boolean; platformCapabilities?: string[] }; providerId?: string; providerName?: string }) {
  if (!session.platformAdmin) return <Forbidden />;
  const hash = normalizePlatformHash(window.location.hash);
  const path = hash.split('?')[0];
  const capabilities = session.platformCapabilities || [];
  const platformConfigurationKinds = new Set<string>(PLATFORM_CONFIGURATION_TYPES);
  const businessDetailsMatch = path.match(/^#platform\/businesses\/([^/]+)$/);
  if (businessDetailsMatch) return <BusinessCompliancePage businessId={decodeURIComponent(businessDetailsMatch[1])} capabilities={capabilities} />;
  if (hash.startsWith('#platform/configuration/reviews')) {
    if (!capabilities.includes('PLATFORM_CONFIGURATION_READ')) return <section className="platform-page"><StatePanel title="Configuration access is restricted"><span>Your platform grant does not include catalogue read access.</span></StatePanel></section>;
    return <ConfigurationReviewInbox platformCapabilities={capabilities} currentUserId={session.userId} />;
  }
  if (hash.startsWith('#platform/configuration/audit')) {
    if (!capabilities.includes('PLATFORM_CONFIGURATION_READ')) return <section className="platform-page"><StatePanel title="Configuration access is restricted"><span>Your platform grant does not include catalogue read access.</span></StatePanel></section>;
    return <ConfigurationAuditInbox />;
  }
  if (hash.startsWith('#platform/configuration/reference-data')) {
    if (!capabilities.includes('PLATFORM_CONFIGURATION_READ')) return <section className="platform-page"><StatePanel title="Reference-data access is restricted"><span>Your platform grant does not include catalogue read access.</span></StatePanel></section>;
    return <ReferenceDataAdmin platformCapabilities={capabilities} currentUserId={session.userId} />;
  }
  if (hash.startsWith('#platform/configuration/elevator')) {
    if (!capabilities.includes('PLATFORM_CONFIGURATION_READ')) return <section className="platform-page"><StatePanel title="Configuration access is restricted"><span>Your platform grant does not include catalogue read access.</span></StatePanel></section>;
    return <PlatformBusinessOperationsPage capabilities={capabilities} currentUserId={session.userId} />;
  }
  if (hash.startsWith('#platform/configuration/provider-overrides')) {
    if (!capabilities.includes('PLATFORM_CONFIGURATION_READ')) return <section className="platform-page"><StatePanel title="Configuration access is restricted"><span>Your platform grant does not include catalogue read access.</span></StatePanel></section>;
    return <ProviderOverridesAdmin platformCapabilities={capabilities} currentUserId={session.userId} />;
  }
  if (hash.startsWith('#platform/business-operations')) {
    if (!capabilities.includes('PLATFORM_CONFIGURATION_READ')) return <section className="platform-page"><StatePanel title="Business catalogue access is restricted"><span>Your platform grant does not include catalogue read access.</span></StatePanel></section>;
    return <PlatformBusinessOperationsPage capabilities={capabilities} currentUserId={session.userId} />;
  }
  if (hash.startsWith('#platform/maintenance')) {
    if (!capabilities.includes('PLATFORM_MAINTENANCE_READ')) return <section className="platform-page"><StatePanel title="Maintenance access is restricted"><span>Your platform grant does not include maintenance control read access.</span></StatePanel></section>;
    return <PlatformMaintenancePage capabilities={capabilities} />;
  }
  if (hash.startsWith('#platform/configuration')) {
    const kind = path.split('/')[2];
    if (!capabilities.includes('PLATFORM_CONFIGURATION_READ')) {
      return <section className="platform-page"><StatePanel title="Configuration access is restricted"><span>Your platform grant does not include catalogue read access.</span></StatePanel></section>;
    }
    if (!path.split('/')[2]) return <PlatformConfigurationRegistry />;
    if (!platformConfigurationKinds.has(kind || '')) return <section className="platform-page"><StatePanel title="Configuration area not found"><span>This configuration area is not part of the platform catalogue. Use the registry to open an available, API-backed area.</span><Button variant="secondary" onClick={() => go('platform/configuration')}>Back to configuration</Button></StatePanel></section>;
    return <section className="platform-page"><PlatformBreadcrumb current="Business configuration" /><ConfigurationAdmin providerId="" t={(key) => key} initialKind={kind} platformOnly platformCapabilities={capabilities} /></section>;
  }
  if (hash.startsWith('#platform/compliance')) { const params = new URLSearchParams(hash.split('?')[1] || ''); const businessId = params.get('business_id'); const providerId = params.get('provider_id'); return businessId ? <BusinessCompliancePage businessId={businessId} capabilities={capabilities} /> : providerId ? <PlatformCompliancePage capabilities={capabilities} /> : <PlatformApprovalInbox capabilities={capabilities} />; }
  if (hash.startsWith('#platform/team')) return <PlatformTeamPage capabilities={capabilities} />;
  if (hash.startsWith('#platform/provider-users')) return <PlatformProviderUsersPage capabilities={capabilities} />;
  if (hash.startsWith('#platform/roles')) return <PlatformRolesPage capabilities={capabilities} />;
  if (hash.startsWith('#platform/plans')) return <PlatformPlansPage capabilities={capabilities} />;
  if (hash.startsWith('#platform/taxes')) return <PlatformTaxesPage capabilities={capabilities} />;
  if (hash.startsWith('#platform/subscription')) return <PlatformSubscriptionsPage capabilities={capabilities} />;
  return <PlatformAdminPage platformCapabilities={session.platformCapabilities} />;
}

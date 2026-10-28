import { useEffect, useState, type FormEvent } from 'react';
import { Button, DetailSection, StatePanel, SortedSelect } from '@trise/ui';
import { OperationsDialog } from './operations-dialog';
import { operationsData, type ProviderOnboardingContactAttributes, type ProviderOfficeLocationAttributes, type Resource } from './data';
import { SearchableSelect } from './searchable-select';
import { useIndiaGeography } from './use-india-geography';
import { normalizeIndianMobile, validateOnboardingContact, validateOnboardingLocation, type FieldErrors } from './provider-onboarding-validation';
import { SvgIcon } from './icons';
import { formatIndiaDateTime } from './subscription-support';

type ContactForm = { display_name: string; email: string; mobile: string; landline: string; designation: string; responsibility_type: string };
type LocationForm = { name: string; location_kind: string; address_line: string; locality: string; city: string; city_code: string; district: string; district_code: string; state: string; state_code: string; pin_code: string; landmark: string; latitude: string; longitude: string };
const emptyContact: ContactForm = { display_name: '', email: '', mobile: '', landline: '', designation: 'PRIMARY', responsibility_type: 'BUSINESS_CONTACT' };
const emptyLocation: LocationForm = { name: '', location_kind: 'REGISTERED_OFFICE', address_line: '', locality: '', city: '', city_code: '', district: '', district_code: '', state: '', state_code: '', pin_code: '', landmark: '', latitude: '', longitude: '' };
const errorText = (cause: unknown) => (cause as { message?: string })?.message || 'The provider contact or office action could not be completed.';

export function ProviderContactLocationDetails({ providerId }: { providerId: string }) {
  const [tab, setTab] = useState<'contacts' | 'locations'>('contacts');
  const [contacts, setContacts] = useState<Resource<ProviderOnboardingContactAttributes>[]>([]);
  const [locations, setLocations] = useState<Resource<ProviderOfficeLocationAttributes>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contactDialog, setContactDialog] = useState(false);
  const [locationDialog, setLocationDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Resource<ProviderOnboardingContactAttributes> | null>(null);
  const [editingLocation, setEditingLocation] = useState<Resource<ProviderOfficeLocationAttributes> | null>(null);
  const [contact, setContact] = useState<ContactForm>(emptyContact);
  const [location, setLocation] = useState<LocationForm>(emptyLocation);
  const [contactErrors, setContactErrors] = useState<FieldErrors>({});
  const [locationErrors, setLocationErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const geography = useIndiaGeography(location);

  async function load() {
    setLoading(true); setError('');
    try {
      const [contactResult, locationResult] = await Promise.all([operationsData.providerOnboardingContacts(providerId), operationsData.providerOnboardingLocations(providerId)]);
      setContacts(contactResult.data); setLocations(locationResult.data);
    } catch (cause) { setError(errorText(cause)); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [providerId]);

  function openContact(item: Resource<ProviderOnboardingContactAttributes> | null) {
    setEditingContact(item); setContactErrors({}); setError('');
    setContact(item ? { display_name: item.attributes.display_name, email: item.attributes.contact_methods.email || '', mobile: item.attributes.contact_methods.mobile || '', landline: item.attributes.contact_methods.landline || '', designation: item.attributes.designation, responsibility_type: item.attributes.responsibility_type } : { ...emptyContact });
    setContactDialog(true);
  }
  function openLocation(item: Resource<ProviderOfficeLocationAttributes> | null) {
    const address = item?.attributes.address || {};
    setEditingLocation(item); setLocationErrors({}); setError('');
    setLocation(item ? { name: item.attributes.name, location_kind: item.attributes.location_kind, address_line: address.address_line || '', locality: address.locality || '', city: address.city || '', city_code: address.city_code || '', district: address.district || '', district_code: address.district_code || '', state: address.state || '', state_code: address.state_code || '', pin_code: address.pin_code || '', landmark: address.landmark || '', latitude: item.attributes.latitude == null ? '' : String(item.attributes.latitude), longitude: item.attributes.longitude == null ? '' : String(item.attributes.longitude) } : { ...emptyLocation });
    setLocationDialog(true);
  }
  function chooseLocationReference(key: 'state' | 'district' | 'city', id: string) {
    const options = key === 'state' ? geography.stateOptions : key === 'district' ? geography.districtOptions : geography.cityOptions;
    const selected = options.find((option) => option.id === id);
    setLocation((current) => ({ ...current, [key]: selected?.label || '', [`${key}_code`]: selected?.id || '', ...(key === 'state' ? { district: '', district_code: '', city: '', city_code: '' } : key === 'district' ? { city: '', city_code: '' } : {}) }));
    if (key === 'state') { geography.setDistrictSearch(''); geography.setCitySearch(''); }
    if (key === 'district') geography.setCitySearch('');
  }
  function captureLocation() {
    if (!navigator.geolocation) { setError('This browser does not provide location capture. Enter coordinates manually.'); return; }
    setError(''); navigator.geolocation.getCurrentPosition(({ coords }) => setLocation((current) => ({ ...current, latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) })), () => setError('Location permission was not granted. Enter coordinates manually.'));
  }
  async function saveContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const invalid = validateOnboardingContact(contact); setContactErrors(invalid); if (Object.keys(invalid).length) return;
    setBusy(true); setError('');
    try {
      const body = { ...contact, display_name: contact.display_name.trim(), email: contact.email.trim(), mobile: normalizeIndianMobile(contact.mobile)!, landline: contact.landline.trim() };
      if (editingContact) await operationsData.updateProviderOnboardingContact(providerId, editingContact.attributes.contact_id, { ...body, expected_revision: editingContact.attributes.revision }, crypto.randomUUID());
      else await operationsData.createProviderOnboardingContact(providerId, body, crypto.randomUUID());
      setContactDialog(false); await load();
    } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }
  async function saveLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const invalid = validateOnboardingLocation(location); setLocationErrors(invalid); if (Object.keys(invalid).length) return;
    setBusy(true); setError('');
    try {
      const body = { name: location.name.trim(), location_kind: location.location_kind, address: { country: 'India', country_code: 'IN', address_line: location.address_line.trim(), locality: location.locality.trim(), city: location.city.trim(), city_code: geography.cityCode, district: location.district.trim(), district_code: geography.districtCode, state: location.state.trim(), state_code: geography.stateCode, pin_code: location.pin_code.trim(), landmark: location.landmark.trim() }, latitude: location.latitude.trim() ? Number(location.latitude) : null, longitude: location.longitude.trim() ? Number(location.longitude) : null };
      if (editingLocation) await operationsData.updateProviderOnboardingLocation(providerId, editingLocation.id, { ...body, expected_revision: editingLocation.attributes.revision }, crypto.randomUUID());
      else await operationsData.createProviderOnboardingLocation(providerId, body, crypto.randomUUID());
      setLocationDialog(false); await load();
    } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  }

  const contactForm = contactDialog && <OperationsDialog title={editingContact ? 'Edit business contact' : 'Add business contact'} busy={busy} onClose={() => setContactDialog(false)}><form className="platform-form-grid" onSubmit={(event) => void saveContact(event)}>
    <label>Full name *<input required value={contact.display_name} disabled={busy} onChange={(event) => setContact((current) => ({ ...current, display_name: event.target.value }))} aria-invalid={Boolean(contactErrors.display_name)} />{contactErrors.display_name && <small className="platform-field-error">{contactErrors.display_name}</small>}</label>
    <label>Designation<SortedSelect value={contact.designation} disabled={busy} onChange={(event) => setContact((current) => ({ ...current, designation: event.target.value }))}><option value="PRIMARY">Primary</option><option value="SECONDARY">Secondary</option></SortedSelect></label>
    <label>Responsibility<SortedSelect value={contact.responsibility_type} disabled={busy} onChange={(event) => setContact((current) => ({ ...current, responsibility_type: event.target.value }))}><option value="BUSINESS_CONTACT">Business contact</option><option value="CUSTOMER_SUPPORT">Customer support</option></SortedSelect></label>
    <label>Mobile *<input required inputMode="tel" placeholder="9876543210" value={contact.mobile} disabled={busy} onChange={(event) => setContact((current) => ({ ...current, mobile: event.target.value }))} aria-invalid={Boolean(contactErrors.mobile)} />{contactErrors.mobile && <small className="platform-field-error">{contactErrors.mobile}</small>}{!contactErrors.mobile && <small>10-digit Indian number; +91 is added automatically.</small>}</label>
    <label>Email *<input required type="email" value={contact.email} disabled={busy} onChange={(event) => setContact((current) => ({ ...current, email: event.target.value }))} aria-invalid={Boolean(contactErrors.email)} />{contactErrors.email && <small className="platform-field-error">{contactErrors.email}</small>}</label>
    <label>Landline <span className="platform-muted">(optional)</span><input inputMode="tel" value={contact.landline} disabled={busy} onChange={(event) => setContact((current) => ({ ...current, landline: event.target.value }))} /></label>
    <div className="platform-form-actions"><Button type="button" variant="secondary" onClick={() => setContactDialog(false)} disabled={busy}>Cancel</Button><Button type="submit" busy={busy}>{editingContact ? 'Update contact' : 'Save contact'}</Button></div>
  </form></OperationsDialog>;
  const locationForm = locationDialog && <OperationsDialog title={editingLocation ? 'Edit office location' : 'Add office location'} busy={busy} onClose={() => setLocationDialog(false)}><form className="platform-form-grid provider-office-location-form" onSubmit={(event) => void saveLocation(event)}>
    <label>Office name *<input required value={location.name} disabled={busy} onChange={(event) => setLocation((current) => ({ ...current, name: event.target.value }))} /></label>
    <label>Office type<SortedSelect value={location.location_kind} disabled={busy} onChange={(event) => setLocation((current) => ({ ...current, location_kind: event.target.value }))}><option value="REGISTERED_OFFICE">Registered office</option><option value="OPERATING_OFFICE">Operating office</option></SortedSelect></label>
    <label className="admin-form-field--full">Address line *<input required value={location.address_line} disabled={busy} onChange={(event) => setLocation((current) => ({ ...current, address_line: event.target.value }))} aria-invalid={Boolean(locationErrors.address_line)} />{locationErrors.address_line && <small className="platform-field-error">{locationErrors.address_line}</small>}</label>
    <label>Locality / area<input value={location.locality} disabled={busy} onChange={(event) => setLocation((current) => ({ ...current, locality: event.target.value }))} /></label>
    <SearchableSelect label="State / UT" searchLabel="Search Indian states and UTs" search={geography.stateSearch} onSearch={geography.setStateSearch} value={geography.stateCode} onChange={(id) => chooseLocationReference('state', id)} options={geography.stateOptions} placeholder="Select state / UT" required disabled={busy} />
    <SearchableSelect label="District" searchLabel="Search districts in selected state" search={geography.districtSearch} onSearch={geography.setDistrictSearch} value={geography.districtCode} onChange={(id) => chooseLocationReference('district', id)} options={geography.districtOptions} placeholder="Select district" required disabled={!geography.stateCode || busy} />
    <SearchableSelect label="City" searchLabel="Search cities in selected district" search={geography.citySearch} onSearch={geography.setCitySearch} value={geography.cityCode} onChange={(id) => chooseLocationReference('city', id)} options={geography.cityOptions} placeholder="Select city" required disabled={!geography.districtCode || busy} />
    <label>PIN code *<input required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} value={location.pin_code} disabled={busy} onChange={(event) => setLocation((current) => ({ ...current, pin_code: event.target.value }))} aria-invalid={Boolean(locationErrors.pin_code)} />{locationErrors.pin_code && <small className="platform-field-error">{locationErrors.pin_code}</small>}</label>
    <label>Landmark<input value={location.landmark} disabled={busy} onChange={(event) => setLocation((current) => ({ ...current, landmark: event.target.value }))} /></label>
    <label>Country<SortedSelect value="IN" disabled><option value="IN">India</option></SortedSelect></label>
    <label>Latitude <span className="platform-muted">(optional)</span><input inputMode="decimal" value={location.latitude} disabled={busy} onChange={(event) => setLocation((current) => ({ ...current, latitude: event.target.value }))} /></label>
    <label>Longitude <span className="platform-muted">(optional)</span><input inputMode="decimal" value={location.longitude} disabled={busy} onChange={(event) => setLocation((current) => ({ ...current, longitude: event.target.value }))} /></label>
    <div className="platform-form-actions"><Button type="button" variant="secondary" onClick={captureLocation} disabled={busy}><SvgIcon name="map-pin" size={15} /> Capture device location</Button><span className="platform-form-note">Coordinates are optional and can be added later.</span></div>
    <div className="platform-form-actions"><Button type="button" variant="secondary" onClick={() => setLocationDialog(false)} disabled={busy}>Cancel</Button><Button type="submit" busy={busy}>{editingLocation ? 'Update office' : 'Save office'}</Button></div>
  </form></OperationsDialog>;

  return <section className="provider-contact-location-page">{contactForm}{locationForm}
    {error && <StatePanel title="Business contact and office action needs attention"><span>{error}</span><Button variant="secondary" onClick={() => void load()}>Retry</Button></StatePanel>}
    <div className="provider-contact-location-tabs" role="tablist" aria-label="Business contacts and office locations"><button type="button" role="tab" aria-selected={tab === 'contacts'} className={tab === 'contacts' ? 'active' : ''} onClick={() => setTab('contacts')}><SvgIcon name="users" size={15} /> Contacts <small>{contacts.length}</small></button><button type="button" role="tab" aria-selected={tab === 'locations'} className={tab === 'locations' ? 'active' : ''} onClick={() => setTab('locations')}><SvgIcon name="map-pin" size={15} /> Office locations <small>{locations.length}</small></button></div>
    {tab === 'contacts' ? <DetailSection title="Business contacts" description="Provider coordination contacts are separate from authenticated team members. Provider administrators can add or update the active records."><div className="provider-contact-location-actions"><Button onClick={() => openContact(null)}><SvgIcon name="plus" size={15} /> Add contact</Button></div>{loading ? <p className="platform-muted">Loading contacts…</p> : contacts.length ? <div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Name</th><th>Responsibility</th><th>Contact</th><th>Status</th><th>Action</th></tr></thead><tbody>{contacts.map((item) => <tr key={item.id}><td><strong>{item.attributes.display_name}</strong><small>{item.attributes.designation.replaceAll('_', ' ')}</small></td><td>{item.attributes.responsibility_type.replaceAll('_', ' ')}</td><td>{item.attributes.contact_methods.email || 'No email'}<small>{item.attributes.contact_methods.mobile || item.attributes.contact_methods.phone || 'No mobile'}</small></td><td><span className="status status-success">{item.attributes.status}</span><small>{item.attributes.effective_from ? formatIndiaDateTime(item.attributes.effective_from) : ''}</small></td><td><Button variant="quiet" onClick={() => openContact(item)}>Edit</Button></td></tr>)}</tbody></table></div> : <p className="platform-empty-inline">No provider business contacts have been added.</p>}</DetailSection> : <DetailSection title="Office locations" description="Registered and operating offices use India reference geography. Coordinates are optional and can be captured from the device when available."><div className="provider-contact-location-actions"><Button onClick={() => openLocation(null)}><SvgIcon name="plus" size={15} /> Add office</Button></div>{loading ? <p className="platform-muted">Loading office locations…</p> : locations.length ? <div className="platform-provider-table-wrap"><table className="platform-provider-table"><thead><tr><th>Office</th><th>Type</th><th>Address</th><th>Coordinates</th><th>Status</th><th>Action</th></tr></thead><tbody>{locations.map((item) => <tr key={item.id}><td><strong>{item.attributes.name}</strong></td><td>{item.attributes.location_kind.replaceAll('_', ' ')}</td><td>{[item.attributes.address.address_line, item.attributes.address.city, item.attributes.address.district, item.attributes.address.state, item.attributes.address.pin_code].filter(Boolean).join(', ') || 'Not supplied'}</td><td>{item.attributes.latitude != null && item.attributes.longitude != null ? `${item.attributes.latitude}, ${item.attributes.longitude}` : 'Not captured'}</td><td><span className={`status ${item.attributes.status === 'ACTIVE' ? 'status-success' : 'status-muted'}`}>{item.attributes.status}</span></td><td><Button variant="quiet" onClick={() => openLocation(item)}>Edit</Button></td></tr>)}</tbody></table></div> : <p className="platform-empty-inline">No provider office locations have been added.</p>}</DetailSection>}
  </section>;
}

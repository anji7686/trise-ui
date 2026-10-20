import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { operationsData, type Collection, type GenericAttributes, type Resource } from './data';
import { SearchableSelect } from './searchable-select';
import { useIndiaGeography } from './use-india-geography';

type Step = 'customer' | 'property' | 'elevators' | 'people' | 'access';
type PropertyTemplate = 'community' | 'standalone' | 'existing';
type Link = { id: string; type: string };

const DEFAULT_COMMUNITY = 'Green Meadows Walkthrough';
const DEFAULT_BUILDINGS = ['Building A', 'Building B', 'Building C'];

function messageFor(error: unknown) { return (error as { message?: string })?.message || 'The operation could not be completed.'; }
function titleOf(item: Resource<GenericAttributes>) { return String(item.attributes.name || item.attributes.display_name || item.attributes.title || item.attributes.code || item.id); }
function linkOf(item: Resource<GenericAttributes> | undefined, name: string) { return item?.relationships[name] as Link | null | undefined; }

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="detail-card onboarding-panel"><div className="section-heading"><div><h3>{title}</h3><p>{description}</p></div></div>{children}</section>;
}

export function PropertyOnboarding({ providerId }: { providerId: string }) {
  const [step, setStep] = useState<Step>('customer');
  const [communityName, setCommunityName] = useState(DEFAULT_COMMUNITY);
  const [propertyTemplate, setPropertyTemplate] = useState<PropertyTemplate>('community');
  const [standaloneName, setStandaloneName] = useState('Standalone Building');
  const [address, setAddress] = useState({ line1: '', locality: '', city: '', cityCode: '', district: '', districtCode: '', state: '', stateCode: '', postalCode: '', country: 'India', landmark: '' });
  const geography = useIndiaGeography(address);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [buildingNames, setBuildingNames] = useState([DEFAULT_BUILDINGS[0]]);
  const [customers, setCustomers] = useState<Collection<GenericAttributes> | null>(null);
  const [definitions, setDefinitions] = useState<Collection<GenericAttributes> | null>(null);
  const [relationshipId, setRelationshipId] = useState('');
  const [partyId, setPartyId] = useState('');
  const [definitionId, setDefinitionId] = useState('');
  const [attributeDefinitions, setAttributeDefinitions] = useState<Collection<GenericAttributes> | null>(null);
  const [savedLocations, setSavedLocations] = useState<Record<string, Resource<GenericAttributes>>>({});
  const [availableLocations, setAvailableLocations] = useState<Resource<GenericAttributes>[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<Record<string, string>>({});
  const [partyKind, setPartyKind] = useState('PERSON');
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerKind, setNewCustomerKind] = useState('PERSON');
  const [createdCustomer, setCreatedCustomer] = useState<Resource<GenericAttributes> | null>(null);
  const [partyName, setPartyName] = useState('');
  const [contactPartyId, setContactPartyId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactKind, setContactKind] = useState('PERSON');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [responsibilityType, setResponsibilityType] = useState('BUILDING_IN_CHARGE');
  const [designation, setDesignation] = useState('PRIMARY');
  const [scopeId, setScopeId] = useState('');
  const [accessScopeId, setAccessScopeId] = useState('');
  const [accessRole, setAccessRole] = useState('MEMBER');
  const [accessInheritance, setAccessInheritance] = useState('DESCENDANTS');
  const [accessCapabilities, setAccessCapabilities] = useState(['VIEW_LOCATION', 'VIEW_ASSET', 'VIEW_SERVICE']);
  const [savedAssets, setSavedAssets] = useState<Resource<GenericAttributes>[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const idempotencyKeys = useRef<Record<string, string>>({});
  function keyFor(command: string) { return idempotencyKeys.current[command] ||= crypto.randomUUID(); }
  const selectedDefinition = definitions?.data.find((item) => item.id === definitionId);
  function chooseAddressReference(key: 'state' | 'district' | 'city', id: string) {
    const options = key === 'state' ? geography.stateOptions : key === 'district' ? geography.districtOptions : geography.cityOptions;
    const selected = options.find((option) => option.id === id);
    setAddress((current) => ({ ...current, [key]: selected?.label || '', [`${key}Code`]: selected?.id || '', ...(key === 'state' ? { district: '', districtCode: '', city: '', cityCode: '' } : key === 'district' ? { city: '', cityCode: '' } : {}) }));
    if (key === 'state') { geography.setDistrictSearch(''); geography.setCitySearch(''); }
    if (key === 'district') geography.setCitySearch('');
  }

  useEffect(() => {
    let live = true;
    Promise.all([operationsData.customersForOnboarding(providerId), operationsData.locations(providerId), operationsData.assetDefinitions(providerId)])
      .then(([customerResult, locationResult, definitionResult]) => {
        if (!live) return;
        setCustomers(customerResult); setDefinitions(definitionResult); setAvailableLocations(locationResult.data);
        setSavedLocations(Object.fromEntries(locationResult.data.map((item) => [String(item.attributes.name), item])));
      }).catch((cause) => live && setError(messageFor(cause)));
    return () => { live = false; };
  }, [providerId]);

  useEffect(() => {
    if (!definitionId) { setAttributeDefinitions(null); return; }
    let live = true;
    operationsData.attributeDefinitions(providerId).then((result) => {
      const links = selectedDefinition?.relationships.attributes;
      const allowedIds = Array.isArray(links) ? links.map((link) => link.id) : [];
      if (live) setAttributeDefinitions({ ...result, data: result.data.filter((item) => allowedIds.includes(item.id)) });
    }).catch((cause) => live && setError(messageFor(cause)));
    return () => { live = false; };
  }, [definitionId, providerId, selectedDefinition]);

  const selectedCustomer = createdCustomer || customers?.data.find((item) => linkOf(item, 'customer_relationship')?.id === relationshipId);
  const existingCommunities = availableLocations.filter((item) => String(item.attributes.classification || '').toUpperCase() === 'COMMUNITY');
  const selectedCommunity = availableLocations.find((item) => item.id === selectedCommunityId);
  const community = selectedCommunity || savedLocations[communityName];
  const standaloneBuilding = propertyTemplate === 'standalone' ? savedLocations[standaloneName] : undefined;
  const buildingLocations = propertyTemplate === 'standalone' ? (standaloneBuilding ? [standaloneBuilding] : []) : buildingNames.map((name) => {
    const selected = availableLocations.find((item) => item.id === selectedBuildingIds[name]);
    return selected || savedLocations[`${communityName} · ${name}`];
  }).filter(Boolean) as Resource<GenericAttributes>[];
  const existingBuildings = availableLocations.filter((item) => ['BUILDING', 'BLOCK', 'TOWER', 'COMMERCIAL_BUILDING', 'INDUSTRIAL_SITE', 'TECH_PARK'].includes(String(item.attributes.classification || '').toUpperCase()) && linkOf(item, 'parent')?.id === community?.id);
  const propertyReady = propertyTemplate === 'standalone' ? buildingLocations.length > 0 : Boolean(community) && buildingLocations.length > 0;

  useEffect(() => {
    if (!selectedCommunity) return;
    setBuildingNames(existingBuildings.map(titleOf));
    setSelectedBuildingIds(Object.fromEntries(existingBuildings.map((item) => [titleOf(item), item.id])));
  }, [selectedCommunityId, availableLocations]);

  function selectCustomer(value: string) {
    const customer = customers?.data.find((item) => item.id === value);
    const relationship = customer && linkOf(customer, 'customer_relationship');
    const nextRelationshipId = relationship?.id || '';
    setCreatedCustomer(null); setRelationshipId(nextRelationshipId); setPartyId(linkOf(customer as Resource<GenericAttributes> | undefined, 'party')?.id || customer?.id || '');
    setSelectedCommunityId(''); setSelectedBuildingIds({}); setError('');
    if (nextRelationshipId) operationsData.locations(providerId, nextRelationshipId).then((result) => setAvailableLocations(result.data)).catch((cause) => setError(messageFor(cause)));
  }

  async function createOnboardingCustomer(event: FormEvent) {
    event.preventDefault();
    if (!newCustomerName.trim()) return;
    setBusy('customer'); setError(''); setMessage('');
    try {
      const result = await operationsData.createCustomer(providerId, { party_kind: newCustomerKind, display_name: newCustomerName.trim() }, keyFor(`customer:${newCustomerName.trim()}`));
      const relationship = linkOf(result, 'customer_relationship');
      setCreatedCustomer(result); setRelationshipId(relationship?.id || ''); setPartyId(result.id); setAvailableLocations([]); setMessage(`${newCustomerName.trim()} created. Continue with the property setup.`);
    } catch (cause) { setError(messageFor(cause)); } finally { setBusy(''); }
  }

  function addBuilding() {
    setBuildingNames((current) => [...current, `Building ${String.fromCharCode(65 + current.length)}`]);
  }

  function removeBuilding(index: number) {
    setBuildingNames((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function saveLocation(name: string, classification: string, parentId?: string) {
    if (!relationshipId) return;
    if (savedLocations[name]) return;
    if (!name.trim()) { setError('Enter a name before saving.'); return; }
    setBusy(name); setError(''); setMessage('');
    try {
      const addressLines = [address.line1, address.locality, address.city, address.district, address.state, address.postalCode, address.country, address.landmark].map((item) => item.trim()).filter(Boolean);
      const hasCoordinates = Boolean(latitude && longitude);
      const result = await operationsData.createLocation(providerId, { customer_relationship_id: relationshipId, classification, name, address_lines: addressLines.length ? addressLines : [name], address_references: { country_code: 'IN', state_code: address.stateCode, district_code: address.districtCode, city_code: address.cityCode }, latitude: latitude ? Number(latitude) : undefined, longitude: longitude ? Number(longitude) : undefined, coordinate_source: hasCoordinates ? 'MANUAL' : undefined, coordinates_captured_at: hasCoordinates ? new Date().toISOString() : undefined, parent_id: parentId }, keyFor(`location:${name}`));
      setSavedLocations((current) => ({ ...current, [name]: result }));
      setMessage(`${name} saved. Continue with the next property step.`);
    } catch (cause) { setError(messageFor(cause)); } finally { setBusy(''); }
  }

  async function saveElevator(event: FormEvent) {
    event.preventDefault();
    if (!relationshipId || !partyId || !definitionId) return;
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const buildingName = String(form.get('building') || '');
    const elevatorName = String(form.get('elevator') || '');
    const values = (attributeDefinitions?.data || []).flatMap((definition) => {
      const raw = String(form.get(`attribute:${definition.id}`) || '').trim();
      if (!raw) return [];
      const valueType = String(definition.attributes.value_type || 'string');
      const value = valueType === 'number' ? Number(raw) : valueType === 'integer' ? Number.parseInt(raw, 10) : valueType === 'boolean' ? raw === 'true' : raw;
      return Number.isNaN(value as number) ? [] : [{ definition_id: definition.id, value }];
    });
    const location = availableLocations.find((item) => item.id === selectedBuildingIds[buildingName]) || savedLocations[`${communityName} · ${buildingName}`] || savedLocations[standaloneName];
    if (!location) { setError('Create the selected building before registering an elevator.'); return; }
    if (!elevatorName.trim()) { setError('Enter an elevator name or code before saving.'); return; }
    const name = `${buildingName} · ${elevatorName}`;
    if (savedAssets.some((asset) => titleOf(asset) === name)) return;
    setBusy(name); setError(''); setMessage('');
    try {
      const result = await operationsData.createAsset(providerId, { name, asset_definition_id: definitionId, definition_version: Number(selectedDefinition?.attributes.version || 1), customer_relationship_id: relationshipId, owner_party_id: partyId, location_id: linkOf(location, 'service_location')?.id || location.id, values, identifier_inputs: [] }, keyFor(`asset:${name}`));
      setSavedAssets((current) => [...current, result]); setMessage(`${name} saved with its selected building context.`);
    } catch (cause) { setError(messageFor(cause)); } finally { setBusy(''); }
  }

  async function createContactParty(event: FormEvent) {
    event.preventDefault();
    if (!partyName.trim()) return;
    setBusy('party'); setError(''); setMessage('');
    try {
      const result = await operationsData.createCustomer(providerId, { party_kind: partyKind, display_name: partyName.trim() }, keyFor(`party:${partyName.trim()}`));
      setContactPartyId(result.id); setMessage(`${partyName.trim()} is ready for contact details.`);
    } catch (cause) { setError(messageFor(cause)); } finally { setBusy(''); }
  }

  async function createContact(event: FormEvent) {
    event.preventDefault();
    if (!contactPartyId || !contactName.trim()) return;
    const contactMethods = { ...(contactEmail.trim() ? { email: contactEmail.trim() } : {}), ...(contactPhone.trim() ? { phone: contactPhone.trim() } : {}) };
    setBusy('contact'); setError(''); setMessage('');
    try {
      const result = await operationsData.createContact(providerId, { party_id: contactPartyId, contact_kind: contactKind, display_name: contactName.trim(), contact_methods: contactMethods }, keyFor(`contact:${contactPartyId}:${contactName.trim()}`));
      setContactPartyId(result.attributes.party_id ? String(result.attributes.party_id) : contactPartyId); setMessage(`${contactName.trim()} contact saved.`);
    } catch (cause) { setError(messageFor(cause)); } finally { setBusy(''); }
  }

  async function createResponsibility(event: FormEvent) {
    event.preventDefault();
    if (!contactPartyId || !scopeId) return;
    setBusy('responsibility'); setError(''); setMessage('');
    try {
      const contacts = await operationsData.contacts(providerId);
      const contact = contacts.data.find((item) => String(item.attributes.party_id || '') === contactPartyId && String(item.attributes.display_name || '') === contactName.trim());
      if (!contact) throw new Error('Save the contact details before assigning a responsibility.');
      await operationsData.createResponsibility(providerId, { contact_point_id: contact.id, service_location_id: scopeId, responsibility_type: responsibilityType, designation, effective_from: new Date().toISOString(), availability: {}, communication_preferences: {} }, keyFor(`responsibility:${contact.id}:${scopeId}:${responsibilityType}`));
      setMessage('Responsibility saved for the selected property scope.');
    } catch (cause) { setError(messageFor(cause)); } finally { setBusy(''); }
  }

  async function createPropertyRelationship(kind: 'representation' | 'management', event: FormEvent) {
    event.preventDefault();
    if (!contactPartyId || !scopeId) return;
    setBusy(kind); setError(''); setMessage('');
    try {
      const body = { service_location_id: scopeId, ...(kind === 'representation' ? { representing_party_id: contactPartyId } : { managing_party_id: contactPartyId }), scope_mode: 'EXACT', effective_from: new Date().toISOString(), authority_basis: 'Created by authorized provider operations during property onboarding', delegated_capabilities: [] };
      if (kind === 'representation') await operationsData.createRepresentation(providerId, body, keyFor(`representation:${contactPartyId}:${scopeId}`));
      else await operationsData.createManagementEngagement(providerId, body, keyFor(`management:${contactPartyId}:${scopeId}`));
      setMessage(`${kind === 'representation' ? 'Representation' : 'Management relationship'} saved.`);
    } catch (cause) { setError(messageFor(cause)); } finally { setBusy(''); }
  }

  async function grantCustomerAccess(event: FormEvent) {
    event.preventDefault();
    if (!selectedCustomer?.id || !accessScopeId || accessCapabilities.length === 0) return;
    setBusy('access'); setError(''); setMessage('');
    try {
      await operationsData.createResourceMembership(providerId, { party_id: selectedCustomer.id, service_location_id: accessScopeId, role: accessRole, inheritance_mode: accessInheritance, capabilities: accessCapabilities, effective_from: new Date().toISOString() }, keyFor(`membership:${selectedCustomer.id}:${accessScopeId}`));
      setMessage('Customer access saved. The customer must still sign in with the linked Google account to verify visibility.');
    } catch (cause) { setError(messageFor(cause)); } finally { setBusy(''); }
  }

  function toggleAccessCapability(capability: string) {
    setAccessCapabilities((current) => current.includes(capability) ? current.filter((item) => item !== capability) : [...current, capability]);
  }

  const existingElevators = useMemo(() => savedAssets.map(titleOf), [savedAssets]);
  return <section className="content feature-page onboarding-page">
    <div className="feature-heading"><div><Status>Step-by-step setup</Status><h2>Set up a customer property</h2><p>Choose the customer, enter the property details, then add buildings and elevators. We save each step so you can safely continue later.</p></div></div>
    <nav className="onboarding-steps" aria-label="Onboarding steps">{([['customer', '1. Customer'], ['property', '2. Property'], ['elevators', '3. Elevators'], ['people', '4. People'], ['access', '5. Access']] as const).map(([key, label]) => <button className={step === key ? 'active' : ''} key={key} onClick={() => setStep(key)}>{label}</button>)}</nav>
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}
    {step === 'customer' && <Panel title="1. Choose or add a customer" description="Start with the person or organization that owns, manages, or uses this property. Creating a customer record does not create a Google login."><label>What would you like to do? <span className="required">Required</span><select value={customerMode} onChange={(event) => setCustomerMode(event.target.value as 'existing' | 'new')}><option value="existing">Use an existing customer</option><option value="new">Add a new customer</option></select></label>{customerMode === 'existing' ? <label>Customer <span className="required">Required</span><select aria-required="true" value={createdCustomer ? '' : selectedCustomer?.id || ''} onChange={(event) => selectCustomer(event.target.value)}><option value="">Select a customer</option>{customers?.data.map((item) => <option key={item.id} value={item.id}>{titleOf(item)}</option>)}</select></label> : <form className="onboarding-form" onSubmit={createOnboardingCustomer}><label>Customer name <span className="required">Required</span><input required value={newCustomerName} onChange={(event) => setNewCustomerName(event.target.value)} placeholder="Example: Green Meadows Residents Association" /></label><label>Customer type <span className="required">Required</span><select value={newCustomerKind} onChange={(event) => setNewCustomerKind(event.target.value)}><option value="PERSON">Person</option><option value="ORGANIZATION">Organization</option></select></label><Button type="submit" busy={busy === 'customer'}>{createdCustomer ? 'Customer saved' : 'Save new customer'}</Button></form>}{selectedCustomer && <p className="success" role="status">Customer ready: <strong>{titleOf(selectedCustomer)}</strong></p>}<Button disabled={!relationshipId} onClick={() => setStep('property')}>Continue to property</Button></Panel>}
    {step === 'property' && <Panel title="2. Add the property" description="Choose the property template first. A community may contain one or many buildings; a standalone building does not need a community parent."><label>Property template <span className="required">Required</span><select value={propertyTemplate} onChange={(event) => setPropertyTemplate(event.target.value as PropertyTemplate)}><option value="community">Community with one or more buildings</option><option value="standalone">Standalone building</option><option value="existing">Use an existing community</option></select></label><fieldset><legend>Address and map location</legend><label>Address line <span className="required">Required</span><input required value={address.line1} onChange={(event) => setAddress((current) => ({ ...current, line1: event.target.value }))} placeholder="Door/building number and street" /></label><label>Locality or area <span className="required">Required</span><input required value={address.locality} onChange={(event) => setAddress((current) => ({ ...current, locality: event.target.value }))} placeholder="Example: Whitefield" /></label><div className="onboarding-grid"><SearchableSelect label="City or town" searchLabel="Search Indian cities" search={geography.citySearch} onSearch={geography.setCitySearch} value={geography.cityCode} onChange={(id) => chooseAddressReference('city', id)} options={geography.cityOptions} placeholder="Select city" required disabled={!geography.districtCode} /><SearchableSelect label="District" searchLabel="Search districts in selected state" search={geography.districtSearch} onSearch={geography.setDistrictSearch} value={geography.districtCode} onChange={(id) => chooseAddressReference('district', id)} options={geography.districtOptions} placeholder="Select district" required disabled={!geography.stateCode} /><SearchableSelect label="State or UT" searchLabel="Search Indian states and UTs" search={geography.stateSearch} onSearch={geography.setStateSearch} value={geography.stateCode} onChange={(id) => chooseAddressReference('state', id)} options={geography.stateOptions} placeholder="Select state / UT" required /><label>PIN code <span className="required">Required</span><input required inputMode="numeric" pattern="[0-9]{6}" value={address.postalCode} onChange={(event) => setAddress((current) => ({ ...current, postalCode: event.target.value }))} placeholder="6-digit PIN" /></label></div><label>Landmark <span className="optional">Optional</span><input value={address.landmark} onChange={(event) => setAddress((current) => ({ ...current, landmark: event.target.value }))} placeholder="Nearby landmark" /></label><div className="onboarding-grid"><label>Latitude <span className="optional">Optional</span><input type="number" step="0.000001" min="-90" max="90" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="Example: 12.9698" /></label><label>Longitude <span className="optional">Optional</span><input type="number" step="0.000001" min="-180" max="180" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="Example: 77.7500" /></label></div><small>Coordinates are used to show an external map link and help authorized agents find the service location. They do not provide live tracking.</small></fieldset>{propertyTemplate !== 'standalone' && <label>Existing community <span className="optional">Optional</span><select value={selectedCommunityId} onChange={(event) => { setSelectedCommunityId(event.target.value); setSelectedBuildingIds({}); }}><option value="">I want to create a new community</option>{existingCommunities.map((item) => <option key={item.id} value={item.id}>{titleOf(item)}</option>)}</select></label>}{propertyTemplate === 'standalone' ? <><label>Building name <span className="required">Required</span><input required value={standaloneName} onChange={(event) => setStandaloneName(event.target.value)} placeholder="Example: Main Street Building" /></label><div className="action-footer"><Button busy={busy === standaloneName} disabled={!relationshipId || Boolean(standaloneBuilding) || !standaloneName.trim()} onClick={() => void saveLocation(standaloneName, 'BUILDING')}>{standaloneBuilding ? 'Building saved' : 'Save standalone building'}</Button></div></> : !selectedCommunity && <><label>Community name <span className="required">Required</span><input required value={communityName} onChange={(event) => setCommunityName(event.target.value)} placeholder="Example: Green Meadows Walkthrough" /></label><div className="onboarding-grid">{buildingNames.map((name, index) => { const fullName = `${communityName} · ${name}`; const record = savedLocations[fullName]; return <article className="record-card" key={index}><label>Building {index + 1} name <span className="required">Required</span><input required value={name} onChange={(event) => setBuildingNames((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Example: Building ${String.fromCharCode(65 + index)}`} /></label><small>{record ? 'Already saved' : 'Will be created under this community'}</small><div className="inline-actions"><Button variant="secondary" disabled={!community || Boolean(record) || Boolean(busy) || !name.trim()} onClick={() => void saveLocation(fullName, 'BUILDING', linkOf(community!, 'service_location')?.id || community?.id)}>{record ? 'Saved' : 'Save building'}</Button>{!record && buildingNames.length > 1 && <Button variant="secondary" onClick={() => removeBuilding(index)}>Remove</Button>}</div></article>; })}</div><div className="action-footer"><Button variant="secondary" onClick={addBuilding}>Add another building</Button><Button busy={busy === communityName} disabled={!relationshipId || Boolean(community) || !communityName.trim()} onClick={() => void saveLocation(communityName, 'COMMUNITY')}>{community ? 'Community saved' : 'Save community'}</Button></div></>}{selectedCommunity && <><article className="record-card"><strong>{titleOf(selectedCommunity)}</strong><small>Existing authorized community selected</small></article><div className="onboarding-grid">{existingBuildings.map((item) => <article className="record-card" key={item.id}><strong>{titleOf(item)}</strong><small>Existing authorized building</small></article>)}</div></>}<Button disabled={!propertyReady} onClick={() => setStep('elevators')}>Continue to elevators</Button></Panel>}
    {step === 'elevators' && <Panel title="3. Add elevators" description="Enter the elevator label people will recognize. Choose its building and the approved equipment type. Any configured capacity, floor-count, manufacturer, model, or other market fields will appear below."><label>Equipment type <span className="required">Required</span><select required value={definitionId} onChange={(event) => setDefinitionId(event.target.value)}><option value="">Select equipment type</option>{definitions?.data.map((item) => <option key={item.id} value={item.id}>{titleOf(item)} · version {String(item.attributes.version || 1)}</option>)}</select></label><form onSubmit={saveElevator} className="onboarding-form"><label>Building <span className="required">Required</span><select name="building" required defaultValue={propertyTemplate === 'standalone' ? standaloneName : buildingNames[0]}>{(propertyTemplate === 'standalone' ? [standaloneName] : buildingNames).map((name) => <option key={name}>{name}</option>)}</select></label><label>Elevator name or code <span className="required">Required</span><input name="elevator" required defaultValue="Passenger Lift 01" placeholder="Example: Passenger Lift 01" /></label>{attributeDefinitions?.data.length ? <fieldset><legend>Elevator details</legend>{attributeDefinitions.data.map((definition) => { const type = String(definition.attributes.value_type || 'string'); return <label key={definition.id}>{String(definition.attributes.label || definition.attributes.key)}{definition.attributes.required ? <span className="required">Required</span> : <span className="optional">Optional</span>}<input name={`attribute:${definition.id}`} type={type === 'number' || type === 'integer' ? 'number' : type === 'date' ? 'date' : 'text'} required={Boolean(definition.attributes.required)} min={type === 'number' || type === 'integer' ? 0 : undefined} placeholder={definition.attributes.unit ? String(definition.attributes.unit) : undefined} /></label>; })}</fieldset> : definitionId ? <p className="notice">This equipment definition has no additional typed fields configured. Add capacity, floors served, manufacturer, model, and other market details through the approved asset-definition configuration before onboarding them.</p> : null}<Button type="submit" busy={Boolean(busy)} disabled={!definitionId}>Save elevator</Button></form><div className="record-grid">{existingElevators.map((name) => <article className="record-card" key={name}><Status>Saved</Status><strong>{name}</strong><small>Building context saved</small></article>)}</div><p className="notice">Add each elevator once. The system keeps the building relationship; you do not need to enter an internal ID.</p></Panel>}
    {step === 'people' && <Panel title="4. Add people and responsibilities" description="Create a person or organization, add their contact details, then assign what they are responsible for and where. These records do not create login access or permissions."><form className="onboarding-form" onSubmit={createContactParty}><label>Person or organization name <span className="required">Required</span><input required value={partyName} onChange={(event) => setPartyName(event.target.value)} placeholder="Example: Green Meadows Residents Association" /></label><label>Record type <span className="required">Required</span><select value={partyKind} onChange={(event) => setPartyKind(event.target.value)}><option value="PERSON">Person</option><option value="ORGANIZATION">Organization</option></select></label><Button type="submit" busy={busy === 'party'}>{contactPartyId ? 'Party saved' : 'Save person or organization'}</Button></form>{contactPartyId && <><p className="success" role="status">Party saved. Now add a contact method.</p><form className="onboarding-form" onSubmit={createContact}><label>Contact display name <span className="required">Required</span><input required value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Example: Security desk" /></label><label>Contact type <span className="required">Required</span><select value={contactKind} onChange={(event) => setContactKind(event.target.value)}><option value="PERSON">Person</option><option value="ORGANIZATION">Organization contact point</option></select></label><label>Email <span className="optional">Optional</span><input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="name@example.test" /></label><label>Phone <span className="optional">Optional</span><input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="Local contact number" /></label><Button type="submit" busy={busy === 'contact'}>Save contact details</Button></form><form className="onboarding-form" onSubmit={createResponsibility}><label>Property scope <span className="required">Required</span><select required value={scopeId} onChange={(event) => setScopeId(event.target.value)}><option value="">Choose community or building</option>{community && <option value={community.id}>{titleOf(community)} — community</option>}{buildingLocations.map((item) => <option value={item.id} key={item.id}>{titleOf(item)}</option>)}</select></label><label>Responsibility <span className="required">Required</span><select value={responsibilityType} onChange={(event) => setResponsibilityType(event.target.value)}><option value="COMMUNITY_MANAGER">Community manager</option><option value="BUILDING_IN_CHARGE">Building in-charge</option><option value="MAINTENANCE_COORDINATOR">Maintenance coordinator</option><option value="SITE_ACCESS">Site access contact</option><option value="SECURITY_DESK">Security desk</option><option value="EMERGENCY_ESCALATION">Emergency contact</option><option value="ALTERNATE_CONTACT">Alternate contact</option></select></label><label>Primary or alternate <span className="required">Required</span><select value={designation} onChange={(event) => setDesignation(event.target.value)}><option value="PRIMARY">Primary</option><option value="ALTERNATE">Alternate</option></select></label><Button type="submit" busy={busy === 'responsibility'} disabled={!scopeId || !contactName.trim()}>Assign responsibility</Button></form><div className="action-footer"><form onSubmit={(event) => void createPropertyRelationship('representation', event)}><Button type="submit" variant="secondary" busy={busy === 'representation'} disabled={!scopeId}>Add representation</Button></form><form onSubmit={(event) => void createPropertyRelationship('management', event)}><Button type="submit" variant="secondary" busy={busy === 'management'} disabled={!scopeId}>Add management relationship</Button></form></div></>}<Button variant="secondary" onClick={() => setStep('access')}>Continue to access review</Button></Panel>}
    {step === 'access' && <Panel title="5. Give the customer access" description="Property creation does not give anyone access. Choose exactly what the selected customer may see, then save the membership. This does not create a login or change Google identity mappings."><p className="notice">Selected customer: <strong>{selectedCustomer ? titleOf(selectedCustomer) : 'Choose a customer first'}</strong></p><form className="onboarding-form" onSubmit={grantCustomerAccess}><label>Access scope <span className="required">Required</span><select required value={accessScopeId} onChange={(event) => setAccessScopeId(event.target.value)}><option value="">Choose community or building</option>{community && <option value={community.id}>{titleOf(community)} — community</option>}{buildingLocations.map((item) => <option value={item.id} key={item.id}>{titleOf(item)}</option>)}</select></label><label>Customer role <span className="required">Required</span><select value={accessRole} onChange={(event) => setAccessRole(event.target.value)}><option value="MEMBER">Member</option><option value="OWNER">Owner</option><option value="COMMITTEE">Committee</option></select></label><label>Include child buildings and assets <span className="required">Required</span><select value={accessInheritance} onChange={(event) => setAccessInheritance(event.target.value)}><option value="DESCENDANTS">Yes — include children</option><option value="NONE">No — selected location only</option></select></label><fieldset><legend>What can this customer do? <span className="required">Choose at least one</span></legend>{[['VIEW_LOCATION', 'View property'], ['VIEW_ASSET', 'View elevators and assets'], ['VIEW_SERVICE', 'View service history'], ['RAISE_SERVICE', 'Report a service problem'], ['VIEW_DOCUMENTS', 'View documents']].map(([value, label]) => <label className="checkbox-row" key={value}><input type="checkbox" checked={accessCapabilities.includes(value)} onChange={() => toggleAccessCapability(value)} />{label}</label>)}</fieldset><Button type="submit" busy={busy === 'access'} disabled={!selectedCustomer || !accessScopeId || accessCapabilities.length === 0}>Save customer access</Button></form><p className="notice">After saving, sign in as the linked customer through normal Google authentication and verify that only this scope is visible.</p><Button variant="secondary" onClick={() => setStep('customer')}>Change customer</Button></Panel>}
  </section>;
}

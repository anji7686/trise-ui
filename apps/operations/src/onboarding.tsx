import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button, SortedSelect, InfoNotice } from '@trise/ui';
import { OperationsStatus as Status } from './operations-status';
import { operationsData, type Collection, type GenericAttributes, type IndiaPincodeLookup, type RequirementCatalogue, type Resource } from './data';
import { SearchableSelect } from './searchable-select';
import { useIndiaGeography } from './use-india-geography';
import { ActionNotification } from './operations-shared';
import { SvgIcon } from './icons';
import { canVisitOnboardingStep, elevatorAssetName, existingCommunityReady, hasDuplicateElevatorAssetName, hasDuplicateLocationName, nextOnboardingStep, onboardingStepLabels, onboardingStepOrder, pincodeOfficeKey, previousOnboardingStep, validatePropertyAddress, type Step } from './onboarding-flow';

type PropertyTemplate = 'community' | 'standalone' | 'existing';
type Link = { id: string; type: string };

const DEFAULT_COMMUNITY = 'Green Meadows Walkthrough';
const DEFAULT_BUILDINGS = ['Building A', 'Building B', 'Building C'];

function messageFor(error: unknown) { return (error as { message?: string })?.message || 'The operation could not be completed.'; }
function titleOf(item: Resource<GenericAttributes>) { return String(item.attributes.name || item.attributes.display_name || item.attributes.title || item.attributes.code || item.id); }
function linkOf(item: Resource<GenericAttributes> | undefined, name: string) { return item?.relationships[name] as Link | null | undefined; }

function Panel({ title, description, children, collapsible = false, className = '', titleInfo }: { title: string; description: string; children: ReactNode; collapsible?: boolean; className?: string; titleInfo?: ReactNode }) {
  if (collapsible) return <details className="detail-card onboarding-panel onboarding-optional-panel"><summary className="section-heading"><div><div className="trise-info-heading-row"><h3>{title}</h3>{titleInfo}</div><p>{description}</p></div><span className="optional">Optional · add now or later</span></summary><div className="onboarding-panel-content">{children}</div></details>;
  return <section className={`detail-card onboarding-panel ${className}`}><div className="section-heading"><div><div className="trise-info-heading-row"><h3>{title}</h3>{titleInfo}</div><p>{description}</p></div></div>{children}</section>;
}

export function PropertyOnboarding({ providerId }: { providerId: string }) {
  const [step, setStep] = useState<Step>('customer');
  const [furthestStep, setFurthestStep] = useState(0);
  const [communityName, setCommunityName] = useState(DEFAULT_COMMUNITY);
  const [propertyTemplate, setPropertyTemplate] = useState<PropertyTemplate>('community');
  const [standaloneName, setStandaloneName] = useState('Standalone Building');
  const [address, setAddress] = useState({ line1: '', locality: '', city: '', cityCode: '', district: '', districtCode: '', state: '', stateCode: '', postalCode: '', country: 'India', landmark: '' });
  const geography = useIndiaGeography(address);
  const [communityPinFilter, setCommunityPinFilter] = useState('');
  const [communityPinResults, setCommunityPinResults] = useState<Resource<GenericAttributes>[] | null>(null);
  const [searchedCommunityPin, setSearchedCommunityPin] = useState('');
  const [communityPinSearchBusy, setCommunityPinSearchBusy] = useState(false);
  const [communityPinSearchError, setCommunityPinSearchError] = useState('');
  const [pincodeLookup, setPincodeLookup] = useState<IndiaPincodeLookup['data'] | null>(null);
  const [pincodeLookupBusy, setPincodeLookupBusy] = useState(false);
  const [pincodeLookupError, setPincodeLookupError] = useState('');
  const [selectedPostOffice, setSelectedPostOffice] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [buildingNames, setBuildingNames] = useState([DEFAULT_BUILDINGS[0]]);
  const [buildingEntryNotes, setBuildingEntryNotes] = useState(['']);
  const [standaloneEntryNote, setStandaloneEntryNote] = useState('');
  const [customers, setCustomers] = useState<Collection<GenericAttributes> | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [communitySearch, setCommunitySearch] = useState('');
  const [communityLookup, setCommunityLookup] = useState<{ query: string; results: Resource<GenericAttributes>[] } | null>(null);
  const [communityLookupBusy, setCommunityLookupBusy] = useState(false);
  const [communityLookupError, setCommunityLookupError] = useState('');
  const [definitions, setDefinitions] = useState<Collection<GenericAttributes> | null>(null);
  const [definitionsProviderId, setDefinitionsProviderId] = useState('');
  const [definitionsLoading, setDefinitionsLoading] = useState(false);
  const [requirementCatalogue, setRequirementCatalogue] = useState<RequirementCatalogue | null>(null);
  const [requirementCatalogueProviderId, setRequirementCatalogueProviderId] = useState('');
  const [requirementCatalogueLoading, setRequirementCatalogueLoading] = useState(false);
  const [requirementCatalogueError, setRequirementCatalogueError] = useState('');
  const [attributeDefinitionsKey, setAttributeDefinitionsKey] = useState('');
  const [attributeDefinitionsLoading, setAttributeDefinitionsLoading] = useState(false);
  const [relationshipId, setRelationshipId] = useState('');
  const [partyId, setPartyId] = useState('');
  const [definitionId, setDefinitionId] = useState('');
  const [assetNameDraft, setAssetNameDraft] = useState('Passenger Lift 01');
  const [attributeCatalogue, setAttributeCatalogue] = useState<Collection<GenericAttributes> | null>(null);
  const [savedLocations, setSavedLocations] = useState<Record<string, Resource<GenericAttributes>>>({});
  const [availableLocations, setAvailableLocations] = useState<Resource<GenericAttributes>[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [selectedBuildingIds, setSelectedBuildingIds] = useState<Record<string, string>>({});
  const [partyKind, setPartyKind] = useState('PERSON');
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerKind, setNewCustomerKind] = useState('PERSON');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerEmail, setNewCustomerEmail] = useState('');
  const [createdCustomer, setCreatedCustomer] = useState<Resource<GenericAttributes> | null>(null);
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyEmail, setPartyEmail] = useState('');
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
  const locationsRequestId = useRef(0);
  const pincodeLookupRequestId = useRef(0);
  const communityPinSearchRequestId = useRef(0);
  const communityLookupRequestId = useRef(0);
  const communityPinResultCache = useRef(new Map<string, Resource<GenericAttributes>[]>());
  function keyFor(command: string) { return idempotencyKeys.current[command] ||= crypto.randomUUID(); }
  const selectedDefinition = definitions?.data.find((item) => item.id === definitionId);
  const allowedAttributeIds = Array.isArray(selectedDefinition?.relationships.attributes) ? selectedDefinition.relationships.attributes.map((link) => link.id) : [];
  const attributeDefinitions = attributeCatalogue ? { ...attributeCatalogue, data: attributeCatalogue.data.filter((item) => allowedAttributeIds.includes(item.id)) } : null;
  const normalizedAttributeCode = (item: Resource<GenericAttributes>) => String(item.attributes.key || item.attributes.code || '').trim().toLowerCase();
  const findAttributeDefinition = (codes: string[]) => attributeDefinitions?.data.find((item) => codes.includes(normalizedAttributeCode(item)));
  const coreElevatorDefinitions = {
    equipmentType: findAttributeDefinition(['equipment_type_code', 'equipment_type', 'lift_type']),
    capacity: findAttributeDefinition(['capacity_kg', 'rated_load_kg', 'rated_capacity']),
    stops: findAttributeDefinition(['stops', 'number_of_stops', 'floors_served']),
  };
  const coreElevatorDefinitionIds = new Set(Object.values(coreElevatorDefinitions).flatMap((item) => item ? [item.id] : []));
  const otherAssetDefinitions = attributeDefinitions?.data.filter((item) => !coreElevatorDefinitionIds.has(item.id) && !['rated_load_kg', 'rated_capacity', 'number_of_stops', 'floors_served'].includes(normalizedAttributeCode(item))) || [];
  const equipmentTypeOptions = requirementCatalogue?.groups.find((group) => group.code === 'EQUIPMENT_TYPE')?.options || [];
  const coreElevatorSpecsReady = Boolean(coreElevatorDefinitions.equipmentType && coreElevatorDefinitions.capacity && coreElevatorDefinitions.stops && equipmentTypeOptions.length);
  function chooseAddressReference(key: 'state' | 'district' | 'city', id: string) {
    const options = key === 'state' ? geography.stateOptions : key === 'district' ? geography.districtOptions : geography.cityOptions;
    const selected = options.find((option) => option.id === id);
    setAddress((current) => ({ ...current, [key]: selected?.label || '', [`${key}Code`]: selected?.id || '', ...(key === 'state' ? { district: '', districtCode: '', city: '', cityCode: '' } : key === 'district' ? { city: '', cityCode: '' } : {}) }));
    if (key === 'state') { geography.setDistrictSearch(''); geography.setCitySearch(''); }
    if (key === 'district') geography.setCitySearch('');
  }

  useEffect(() => {
    setAddress((current) => ({
      ...current,
      ...(current.state && !current.stateCode && geography.stateCode ? { stateCode: geography.stateCode } : {}),
      ...(current.district && !current.districtCode && geography.districtCode ? { districtCode: geography.districtCode } : {}),
    }));
  }, [address.state, address.stateCode, address.district, address.districtCode, geography.stateCode, geography.districtCode]);

  useEffect(() => {
    if (!pincodeLookup?.found || !selectedPostOffice || !geography.districtCode || geography.cityOptions.length !== 1) return;
    const [onlyCity] = geography.cityOptions;
    setAddress((current) => current.cityCode || current.city ? current : { ...current, city: onlyCity.label, cityCode: onlyCity.id });
  }, [geography.cityOptions, geography.districtCode, pincodeLookup, selectedPostOffice]);

  async function lookupPincode() {
    const pincode = address.postalCode.trim();
    if (!/^[1-9]\d{5}$/.test(pincode)) {
      setPincodeLookup(null);
      setPincodeLookupError('Enter a valid six-digit Indian PIN code first.');
      return;
    }
    const requestId = ++pincodeLookupRequestId.current;
    setPincodeLookupBusy(true);
    setPincodeLookupError('');
    try {
      const result = await operationsData.indiaPincode(pincode);
      if (pincodeLookupRequestId.current !== requestId || address.postalCode.trim() !== pincode) return;
      setPincodeLookup(result.data);
      setSelectedPostOffice('');
      setAddress((current) => ({
        ...current,
        postalCode: pincode,
        ...(result.data.state ? { state: result.data.state } : {}),
        ...(result.data.district ? { district: result.data.district } : {}),
        stateCode: result.data.state ? '' : current.stateCode,
        districtCode: result.data.district ? '' : current.districtCode,
        city: result.data.state && (current.state !== result.data.state || current.district !== result.data.district) ? '' : current.city,
        cityCode: result.data.state && (current.state !== result.data.state || current.district !== result.data.district) ? '' : current.cityCode,
      }));
    } catch (cause) {
      if (pincodeLookupRequestId.current === requestId) {
        setPincodeLookup(null);
        setPincodeLookupError(messageFor(cause));
      }
    } finally {
      if (pincodeLookupRequestId.current === requestId) setPincodeLookupBusy(false);
    }
  }

  async function searchCommunitiesByPin() {
    const pincode = communityPinFilter.trim();
    if (!relationshipId || !/^[1-9]\d{5}$/.test(pincode)) return;
    const cacheKey = `${relationshipId}:${pincode}`;
    const cachedResults = communityPinResultCache.current.get(cacheKey);
    if (cachedResults) {
      setCommunityPinResults(cachedResults);
      setSearchedCommunityPin(pincode);
      return;
    }
    const requestId = ++communityPinSearchRequestId.current;
    const relationshipAtRequest = relationshipId;
    setCommunityPinSearchBusy(true);
    setCommunityPinSearchError('');
    try {
      const result = await operationsData.locations(providerId, relationshipAtRequest, { query: pincode, limit: 100, classification: ['COMMUNITY'] });
      if (communityPinSearchRequestId.current !== requestId || relationshipId !== relationshipAtRequest || communityPinFilter.trim() !== pincode) return;
      setCommunityPinResults(result.data);
      setSearchedCommunityPin(pincode);
      communityPinResultCache.current.set(cacheKey, result.data);
      setAvailableLocations((current) => [...current.filter((item) => !result.data.some((match) => match.id === item.id)), ...result.data]);
      setSavedLocations((current) => ({ ...current, ...Object.fromEntries(result.data.map((item) => [String(item.attributes.name), item])) }));
    } catch (cause) {
      if (communityPinSearchRequestId.current === requestId) setCommunityPinSearchError(messageFor(cause));
    } finally {
      if (communityPinSearchRequestId.current === requestId) setCommunityPinSearchBusy(false);
    }
  }

  useEffect(() => {
    let live = true;
    operationsData.customersForOnboarding(providerId)
      .then((customerResult) => {
        if (!live) return;
        setCustomers(customerResult);
      }).catch((cause) => live && setError(messageFor(cause)));
    return () => { live = false; };
  }, [providerId]);

  useEffect(() => {
    if (step !== 'assets' || definitionsProviderId === providerId) return;
    let live = true;
    setDefinitionsLoading(true);
    setDefinitions(null);
    void operationsData.assetDefinitions(providerId)
      .then((result) => { if (live) { setDefinitions(result); setDefinitionsProviderId(providerId); } })
      .catch((cause) => { if (live) setError(messageFor(cause)); })
      .finally(() => { if (live) setDefinitionsLoading(false); });
    return () => { live = false; };
  }, [definitionsProviderId, providerId, step]);

  useEffect(() => {
    if (step !== 'assets' || requirementCatalogueProviderId === providerId) return;
    let live = true;
    setRequirementCatalogueLoading(true);
    setRequirementCatalogueError('');
    setRequirementCatalogue(null);
    operationsData.elevatorRequirementCatalogue(providerId)
      .then((result) => { if (live) { setRequirementCatalogue(result); setRequirementCatalogueProviderId(providerId); } })
      .catch((cause) => { if (live) setRequirementCatalogueError(messageFor(cause)); })
      .finally(() => { if (live) setRequirementCatalogueLoading(false); });
    return () => { live = false; };
  }, [providerId, requirementCatalogueProviderId, step]);

  useEffect(() => {
    if (step !== 'assets') return;
    if (!definitionId) { setAttributeCatalogue(null); return; }
    const requestKey = `${providerId}:${definitionId}`;
    if (attributeDefinitionsKey === requestKey) return;
    let live = true;
    setAttributeDefinitionsLoading(true);
    setAttributeCatalogue(null);
    operationsData.attributeDefinitions(providerId, definitionId)
      .then((result) => { if (live) { setAttributeCatalogue(result); setAttributeDefinitionsKey(requestKey); } })
      .catch((cause) => { if (live) setError(messageFor(cause)); })
      .finally(() => { if (live) setAttributeDefinitionsLoading(false); });
    return () => { live = false; };
  }, [attributeDefinitionsKey, definitionId, providerId, step]);

  const selectedCustomer = createdCustomer || customers?.data.find((item) => linkOf(item, 'customer_relationship')?.id === relationshipId);
  const selectedCustomerEmail = String(((selectedCustomer?.attributes.contact || {}) as Record<string, unknown>).email || '').trim();
  const existingCommunities = availableLocations.filter((item) => String(item.attributes.classification || '').toUpperCase() === 'COMMUNITY');
  const communityLookupQuery = propertyTemplate === 'existing' ? communitySearch.trim() : propertyTemplate === 'community' ? communityName.trim() : '';
  const communityLookupResults = communityLookup?.query === communityLookupQuery ? communityLookup.results : [];
  const selectedCommunity = (propertyTemplate === 'existing' ? availableLocations.find((item) => item.id === selectedCommunityId) : undefined)
    || (propertyTemplate === 'community' && String(savedLocations[communityName]?.attributes.classification || '').toUpperCase() === 'COMMUNITY' ? savedLocations[communityName] : undefined);
  const community = selectedCommunity || savedLocations[communityName];
  const standaloneBuilding = propertyTemplate === 'standalone' ? savedLocations[standaloneName] : undefined;
  const buildingParentName = propertyTemplate === 'existing' && selectedCommunity ? titleOf(selectedCommunity) : communityName;
  const buildingLocations = propertyTemplate === 'standalone' ? (standaloneBuilding ? [standaloneBuilding] : []) : buildingNames.map((name) => {
    const selected = availableLocations.find((item) => item.id === selectedBuildingIds[name]);
    return selected || savedLocations[`${buildingParentName} · ${name}`];
  }).filter(Boolean) as Resource<GenericAttributes>[];
  const existingBuildings = availableLocations.filter((item) => ['BUILDING', 'BLOCK', 'TOWER', 'COMMERCIAL_BUILDING', 'INDUSTRIAL_SITE', 'TECH_PARK'].includes(String(item.attributes.classification || '').toUpperCase()) && linkOf(item, 'parent')?.id === community?.id);
  const propertyAddressIssues = validatePropertyAddress({ ...address, latitude, longitude });
  const propertyAddressReady = propertyAddressIssues.length === 0;
  const communityReady = propertyTemplate === 'standalone'
    ? propertyAddressReady && Boolean(standaloneName.trim())
    : propertyTemplate === 'existing'
    ? Boolean(selectedCommunity)
    : Boolean(community) && (Boolean(selectedCommunity) || propertyAddressReady);
  const propertyReady = propertyTemplate === 'standalone'
    ? buildingLocations.length > 0
    : propertyTemplate === 'existing'
    ? existingCommunityReady(selectedCommunity?.id || '', buildingLocations.length)
      : Boolean(community) && buildingLocations.length > 0 && (Boolean(selectedCommunity) || propertyAddressReady);
  const communityNameMatch = [...existingCommunities, ...communityLookupResults].find((item) => hasDuplicateLocationName(communityName, [titleOf(item)]));
  const communityNameDuplicate = Boolean(communityNameMatch);
  const communitySearchPool = searchedCommunityPin === communityPinFilter.trim() && communityPinResults
    ? communityPinResults.filter((item) => String(item.attributes.classification || '').toUpperCase() === 'COMMUNITY')
    : communityLookupQuery.length >= 2 && communityLookup?.query === communityLookupQuery
    ? communityLookupResults
    : existingCommunities;
  const communitySearchOptions = communitySearchPool.map((item) => ({
    id: item.id,
    label: titleOf(item),
    detail: [item.attributes.service_location_code, Array.isArray(item.attributes.address_lines) ? item.attributes.address_lines.map(String).join(', ') : '', `ID ${item.id.slice(-8)}`].filter(Boolean).join(' · '),
  }));
  const pinFilteredCommunityOptions = communitySearchOptions.filter((option) => {
    const item = communitySearchPool.find((candidate) => candidate.id === option.id);
    if (!item || communityPinFilter.trim().length !== 6) return true;
    const references = item.attributes.address_references && typeof item.attributes.address_references === 'object'
      ? item.attributes.address_references as Record<string, unknown>
      : {};
    const referencePin = String(references.pin_code || references.pincode || '');
    const addressText = Array.isArray(item.attributes.address_lines) ? item.attributes.address_lines.join(' ') : '';
    const addressPins: string[] = addressText.match(/\b[1-9]\d{5}\b/g) || [];
    return referencePin === communityPinFilter.trim() || addressPins.includes(communityPinFilter.trim());
  });
  const stepIndex = onboardingStepOrder.indexOf(step);

  useEffect(() => {
    const query = communityLookupQuery;
    if (!relationshipId || query.length < 2 || propertyTemplate === 'standalone') {
      communityLookupRequestId.current += 1;
      setCommunityLookupBusy(false);
      setCommunityLookupError('');
      return;
    }
    const requestId = ++communityLookupRequestId.current;
    const relationshipAtRequest = relationshipId;
    const timer = window.setTimeout(() => {
      setCommunityLookupBusy(true);
      setCommunityLookupError('');
      void operationsData.locations(providerId, relationshipAtRequest, { query, limit: 100, classification: ['COMMUNITY'] })
        .then((result) => {
          if (communityLookupRequestId.current !== requestId || relationshipId !== relationshipAtRequest) return;
          setCommunityLookup({ query, results: result.data });
          setAvailableLocations((current) => [...current.filter((item) => !result.data.some((match) => match.id === item.id)), ...result.data]);
          setSavedLocations((current) => ({ ...current, ...Object.fromEntries(result.data.map((item) => [String(item.attributes.name), item])) }));
        })
        .catch((cause) => { if (communityLookupRequestId.current === requestId) setCommunityLookupError(messageFor(cause)); })
        .finally(() => { if (communityLookupRequestId.current === requestId) setCommunityLookupBusy(false); });
    }, 300);
    return () => { window.clearTimeout(timer); if (communityLookupRequestId.current === requestId) communityLookupRequestId.current += 1; };
  }, [communityLookupQuery, propertyTemplate, providerId, relationshipId]);

  function useExistingCommunity(item: Resource<GenericAttributes>) {
    setAvailableLocations((current) => current.some((record) => record.id === item.id) ? current : [...current, item]);
    setSavedLocations((current) => ({ ...current, [String(item.attributes.name)]: item }));
    setPropertyTemplate('existing');
    setSelectedCommunityId(item.id);
    setSelectedBuildingIds({});
    setCommunitySearch('');
    setError('');
  }
  const customerOptions = (customers?.data || []).map((item) => ({
    id: item.id,
    label: titleOf(item),
    detail: [
      String(item.attributes.party_kind || 'Customer').replaceAll('_', ' ').toLowerCase(),
      typeof item.attributes.created_at === 'string' && Number.isFinite(Date.parse(item.attributes.created_at))
        ? `added ${new Date(item.attributes.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
        : '',
    ].filter(Boolean).join(' · '),
  }));

  function resetPropertyAndLater() {
    setStep('customer'); setFurthestStep(0); setSelectedCommunityId(''); setSelectedBuildingIds({}); setCommunitySearch('');
    communityLookupRequestId.current += 1; setCommunityLookup(null); setCommunityLookupBusy(false); setCommunityLookupError('');
    setAvailableLocations([]); setSavedLocations({}); setSavedAssets([]); setBuildingNames([DEFAULT_BUILDINGS[0]]); setBuildingEntryNotes(['']); setStandaloneEntryNote(''); setLocationsLoading(false);
    setCommunityName(DEFAULT_COMMUNITY); setPropertyTemplate('community'); setStandaloneName('Standalone Building');
    setAddress({ line1: '', locality: '', city: '', cityCode: '', district: '', districtCode: '', state: '', stateCode: '', postalCode: '', country: 'India', landmark: '' });
    setCommunityPinFilter(''); setPincodeLookup(null); setPincodeLookupError(''); setSelectedPostOffice(''); setPincodeLookupBusy(false); pincodeLookupRequestId.current += 1;
    setCommunityPinResults(null); setSearchedCommunityPin(''); setCommunityPinSearchError(''); setCommunityPinSearchBusy(false); communityPinSearchRequestId.current += 1;
    communityPinResultCache.current.clear();
    setLatitude(''); setLongitude(''); setDefinitionId('');
    setPartyId(''); setContactPartyId(''); setContactName(''); setScopeId(''); setAccessScopeId('');
    setPartyName(''); setPartyPhone(''); setPartyEmail(''); setContactKind('PERSON'); setContactEmail(''); setContactPhone('');
    setAccessCapabilities(['VIEW_LOCATION', 'VIEW_ASSET', 'VIEW_SERVICE']);
  }

  function changeCustomerMode(mode: 'existing' | 'new') {
    if (mode === customerMode) return;
    locationsRequestId.current += 1;
    setCustomerMode(mode); setCreatedCustomer(null); setRelationshipId(''); setPartyId(''); setNewCustomerName(''); setNewCustomerPhone(''); setNewCustomerEmail('');
    resetPropertyAndLater(); setCustomerSearch(''); setError(''); setMessage('');
  }

  function openStep(target: Step) {
    if (canVisitOnboardingStep(target, furthestStep)) setStep(target);
  }

  function advanceStep(ready: boolean) {
    const next = nextOnboardingStep(step);
    if (!ready || !next) return;
    setFurthestStep((current) => Math.max(current, onboardingStepOrder.indexOf(next)));
    setStep(next);
  }

  function renderStepActions(ready: boolean, nextLabel?: string) {
    const previous = previousOnboardingStep(step);
    const next = nextOnboardingStep(step);
    return <div className="onboarding-step-actions">
      {previous ? <Button type="button" variant="secondary" onClick={() => openStep(previous)}>Back to {onboardingStepLabels[previous].toLowerCase()}</Button> : <span />}
      <span className="onboarding-step-position">Step {stepIndex + 1} of {onboardingStepOrder.length}</span>
      {next && <Button type="button" disabled={!ready} onClick={() => advanceStep(ready)}>{nextLabel || `Continue to ${onboardingStepLabels[next].toLowerCase()}`}</Button>}
    </div>;
  }

  useEffect(() => {
    if (!selectedCommunity) return;
    const prefix = `${titleOf(selectedCommunity)} · `;
    const names = existingBuildings.map((item) => titleOf(item).startsWith(prefix) ? titleOf(item).slice(prefix.length) : titleOf(item));
    setBuildingNames(names.length ? names : [DEFAULT_BUILDINGS[0]]);
    setBuildingEntryNotes(names.map(() => ''));
    setSelectedBuildingIds(Object.fromEntries(existingBuildings.map((item, index) => [names[index], item.id])));
  }, [selectedCommunityId, availableLocations]);

  function selectCustomer(value: string) {
    const customer = customers?.data.find((item) => item.id === value);
    const relationship = customer && linkOf(customer, 'customer_relationship');
    const nextRelationshipId = relationship?.id || '';
    const requestId = ++locationsRequestId.current;
    resetPropertyAndLater(); setCreatedCustomer(null); setRelationshipId(nextRelationshipId); setPartyId(linkOf(customer as Resource<GenericAttributes> | undefined, 'party')?.id || customer?.id || ''); setError(''); setMessage('');
    if (nextRelationshipId) {
      setLocationsLoading(true);
      operationsData.locations(providerId, nextRelationshipId, { limit: 100 }).then((result) => {
      if (locationsRequestId.current !== requestId) return;
      setAvailableLocations(result.data);
      setSavedLocations(Object.fromEntries(result.data.map((item) => [String(item.attributes.name), item])));
      }).catch((cause) => { if (locationsRequestId.current === requestId) setError(messageFor(cause)); }).finally(() => { if (locationsRequestId.current === requestId) setLocationsLoading(false); });
    }
  }

  async function createOnboardingCustomer(event: FormEvent) {
    event.preventDefault();
    if (!newCustomerName.trim()) return;
    setBusy('customer'); setError(''); setMessage('');
    try {
      const result = await operationsData.createCustomer(providerId, { party_kind: newCustomerKind, display_name: newCustomerName.trim(), contact: { phone: newCustomerPhone.trim(), email: newCustomerEmail.trim() } }, keyFor(`customer:${newCustomerName.trim()}`));
      const relationship = linkOf(result, 'customer_relationship');
      setCreatedCustomer(result); setRelationshipId(relationship?.id || ''); setPartyId(result.id); setAvailableLocations([]); setMessage(`${newCustomerName.trim()} created. Continue with the property setup.`);
    } catch (cause) { setError(messageFor(cause)); } finally { setBusy(''); }
  }

  function addBuilding() {
    setBuildingNames((current) => {
      let number = 1;
      let candidate = `Building ${number}`;
      while (hasDuplicateLocationName(candidate, current)) candidate = `Building ${++number}`;
      return [...current, candidate];
    });
    setBuildingEntryNotes((current) => [...current, '']);
  }

  function removeBuilding(index: number) {
    setBuildingNames((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setBuildingEntryNotes((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function saveLocation(name: string, classification: string, parentId?: string, internalPlacement?: string) {
    if (!relationshipId) return;
    if (savedLocations[name]) return;
    if (!name.trim()) { setError('Enter a name before saving.'); return; }
    if (classification.toUpperCase() === 'COMMUNITY' && hasDuplicateLocationName(name, existingCommunities.map(titleOf))) {
      setError('A community with this name already exists for this customer. Select the saved community or choose a unique name.'); return;
    }
    if (classification.toUpperCase() === 'BUILDING' && parentId) {
      const buildingName = name.split(' · ').at(-1) || name;
      if (['community', 'existing'].includes(propertyTemplate) && buildingNames.filter((candidate) => hasDuplicateLocationName(candidate, [buildingName])).length > 1) {
        setError('Building names must be unique within this community. Choose a unique name.'); return;
      }
      const siblingNames = availableLocations.filter((item) => linkOf(item, 'parent')?.id === parentId).map(titleOf);
      if (hasDuplicateLocationName(name.split(' · ').at(-1) || name, siblingNames)) {
        setError('A building with this name already exists in this community. Choose a unique building name.'); return;
      }
    }
    if (propertyTemplate !== 'existing') {
      const addressIssues = validatePropertyAddress({ ...address, latitude, longitude });
      if (addressIssues.length) { setError(addressIssues.join(' ')); return; }
    }
    setBusy(name); setError(''); setMessage('');
    try {
      const reuseCommunityAddress = classification.toUpperCase() === 'BUILDING' && propertyTemplate === 'existing' && Boolean(community);
      const communityAddressLines = Array.isArray(community?.attributes.address_lines) ? community.attributes.address_lines.map(String).filter(Boolean) : [];
      const inheritedReferences = community?.attributes.address_references && typeof community.attributes.address_references === 'object' ? community.attributes.address_references as Record<string, unknown> : {};
      const addressLines = reuseCommunityAddress && communityAddressLines.length ? communityAddressLines : [address.line1, address.locality, address.city, address.district, address.state, address.postalCode, address.country, address.landmark].map((item) => item.trim()).filter(Boolean);
      const addressReferences = reuseCommunityAddress ? inheritedReferences : { country_code: 'IN', state_code: address.stateCode, district_code: address.districtCode, city_code: address.cityCode, pin_code: address.postalCode };
      const inheritedLatitude = Number(community?.attributes.latitude);
      const inheritedLongitude = Number(community?.attributes.longitude);
      const latitudeValue = reuseCommunityAddress && Number.isFinite(inheritedLatitude) ? inheritedLatitude : latitude ? Number(latitude) : undefined;
      const longitudeValue = reuseCommunityAddress && Number.isFinite(inheritedLongitude) ? inheritedLongitude : longitude ? Number(longitude) : undefined;
      const hasCoordinates = latitudeValue !== undefined && longitudeValue !== undefined;
      const result = await operationsData.createLocation(providerId, { customer_relationship_id: relationshipId, classification, name, address_lines: addressLines.length ? addressLines : [name], address_references: addressReferences, latitude: latitudeValue, longitude: longitudeValue, coordinate_source: hasCoordinates && !reuseCommunityAddress ? 'MANUAL' : undefined, coordinates_captured_at: hasCoordinates && !reuseCommunityAddress ? new Date().toISOString() : undefined, internal_placement: internalPlacement?.trim() || undefined, parent_id: parentId }, keyFor(`location:${name}`));
      setSavedLocations((current) => ({ ...current, [name]: result }));
      communityPinResultCache.current.clear(); setCommunityPinResults(null); setSearchedCommunityPin('');
      setMessage(`${name} saved. Continue with the next property step.`);
    } catch (cause) { setError(messageFor(cause)); } finally { setBusy(''); }
  }

  async function saveElevator(event: FormEvent) {
    event.preventDefault();
    if (!relationshipId || !partyId || !definitionId) return;
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const buildingName = String(form.get('building') || '');
    const assetName = String(form.get('asset_name') || '').trim();
    const values = (attributeDefinitions?.data || []).flatMap((definition) => {
      const raw = String(form.get(`attribute:${definition.id}`) || '').trim();
      if (!raw) return [];
      const valueType = String(definition.attributes.value_type || 'string');
      const value = valueType === 'number' ? Number(raw) : valueType === 'integer' ? Number.parseInt(raw, 10) : valueType === 'boolean' ? raw === 'true' : raw;
      return Number.isNaN(value as number) ? [] : [{ definition_id: definition.id, value }];
    });
    const location = availableLocations.find((item) => item.id === selectedBuildingIds[buildingName]) || savedLocations[`${buildingParentName} · ${buildingName}`] || savedLocations[standaloneName];
    if (!location) { setError('Create the selected building before registering an elevator.'); return; }
    const serviceLocationId = linkOf(location, 'service_location')?.id;
    if (!serviceLocationId) { setError('The selected building is missing its service-location link. Refresh the customer locations and try again.'); return; }
    if (!assetName.trim()) { setError('Enter an asset name before saving.'); return; }
    const name = elevatorAssetName(buildingName, assetName);
    if (hasDuplicateElevatorAssetName(buildingName, assetName, savedAssets.map(titleOf))) { setError('This building already has an elevator asset with that name. Enter a unique asset name or code for each lift.'); return; }
    setBusy(name); setError(''); setMessage('');
    try {
      const result = await operationsData.createAsset(providerId, { name, asset_definition_id: definitionId, definition_version: Number(selectedDefinition?.attributes.version || 1), customer_relationship_id: relationshipId, owner_party_id: partyId, location_id: serviceLocationId, values, identifier_inputs: [] }, keyFor(`asset:${name}`));
      const identifiers = Array.isArray(result.attributes.identifiers) ? result.attributes.identifiers as Array<Record<string, unknown>> : [];
      const generatedCode = String(identifiers.find((item) => String(item.identifier_type_code || '').toUpperCase() === 'EQUIPMENT_CODE')?.value || '');
      setSavedAssets((current) => [...current, result]); setAssetNameDraft(''); setMessage(`${name} saved with its selected building context.${generatedCode ? ` E-Code: ${generatedCode}.` : ''} Add the next lift with a unique name.`);
    } catch (cause) { setError(messageFor(cause)); } finally { setBusy(''); }
  }

  async function createContactParty(event: FormEvent) {
    event.preventDefault();
    if (!partyName.trim()) return;
    setBusy('party'); setError(''); setMessage('');
    try {
      const result = await operationsData.createCustomer(providerId, { party_kind: partyKind, display_name: partyName.trim(), contact: { phone: partyPhone.trim(), email: partyEmail.trim() } }, keyFor(`party:${partyName.trim()}`));
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
    if (!selectedCustomerEmail) { setError('Add an email address to the customer before enabling portal access or email notifications.'); return; }
    setBusy('access'); setError(''); setMessage('');
    try {
      await operationsData.createResourceMembership(providerId, { party_id: selectedCustomer.id, service_location_id: accessScopeId, role: accessRole, inheritance_mode: accessInheritance, capabilities: accessCapabilities, effective_from: new Date().toISOString(), portal_access: true }, keyFor(`membership:${selectedCustomer.id}:${accessScopeId}`));
      setMessage('Customer access saved. The customer must still sign in with the linked Google account to verify visibility.');
    } catch (cause) { setError(messageFor(cause)); } finally { setBusy(''); }
  }

  function toggleAccessCapability(capability: string) {
    setAccessCapabilities((current) => current.includes(capability) ? current.filter((item) => item !== capability) : [...current, capability]);
  }

  const existingElevators = useMemo(() => savedAssets.map(titleOf), [savedAssets]);
  return <section className="content feature-page onboarding-page">
    <header className="onboarding-page-heading">
      <div><p className="onboarding-eyebrow">CUSTOMER SETUP</p><h2>Set up a customer property</h2><p>Choose a customer, save the property, then add any useful details when you’re ready.</p></div>
      <Status>Step {stepIndex + 1} of {onboardingStepOrder.length}</Status>
    </header>
    <div className="onboarding-progress" role="progressbar" aria-label="Property setup progress" aria-valuemin={1} aria-valuemax={onboardingStepOrder.length} aria-valuenow={stepIndex + 1}>
      <span style={{ width: `${((stepIndex + 1) / onboardingStepOrder.length) * 100}%` }} />
    </div>
    <nav className="onboarding-steps" aria-label="Onboarding steps"><ol>{onboardingStepOrder.map((key, index) => {
      const accessible = canVisitOnboardingStep(key, furthestStep);
      const current = step === key;
      const complete = index < furthestStep;
      return <li key={key}><button type="button" className={`${current ? 'active' : ''}${complete ? ' complete' : ''}`} aria-current={current ? 'step' : undefined} aria-disabled={!accessible} disabled={!accessible} onClick={() => openStep(key)}><span className="onboarding-step-number" aria-hidden="true">{complete ? '✓' : index + 1}</span><span className="onboarding-step-copy"><strong>{onboardingStepLabels[key]}</strong><small>{current ? 'Current step' : complete ? 'Visited' : 'Next step'}</small></span></button></li>;
    })}</ol></nav>
    {error && <ActionNotification kind="error" title="Onboarding action needs attention" onClose={() => setError('')}>{error}</ActionNotification>}{message && <ActionNotification title="Onboarding update completed" onClose={() => setMessage('')}>{message}</ActionNotification>}
    {step === 'customer' && <Panel title="Choose or add a customer" description="Start with the person or organization that owns, manages, or uses this property. A phone number is needed for service coordination; email is optional."><div className="onboarding-customer-choice"><label>Customer source <span className="required">Required</span><SortedSelect value={customerMode} onChange={(event) => changeCustomerMode(event.target.value as 'existing' | 'new')}><option value="existing">Use an existing customer</option><option value="new">Add a new customer</option></SortedSelect></label>{customerMode === 'existing' ? customers === null ? <p className="onboarding-inline-note" role="status">Loading customers…</p> : customers.data.length ? <SearchableSelect label="Customer" searchLabel="Search customers by name or type" search={customerSearch} onSearch={setCustomerSearch} value={createdCustomer ? '' : selectedCustomer?.id || ''} onChange={selectCustomer} options={customerOptions} placeholder="Search or choose a customer" required searchRequired /> : <p className="onboarding-inline-note">No customer records are available in this provider context. Choose “Add a new customer” to continue.</p> : null}</div>{customerMode === 'new' ? <form className="onboarding-form" onSubmit={createOnboardingCustomer}><label>Customer name <span className="required">Required</span><input required value={newCustomerName} onChange={(event) => setNewCustomerName(event.target.value)} placeholder="Example: Green Meadows Residents Association" /></label><label>Customer type <span className="required">Required</span><SortedSelect value={newCustomerKind} onChange={(event) => setNewCustomerKind(event.target.value)}><option value="PERSON">Person</option><option value="ORGANIZATION">Organization</option></SortedSelect></label><label>Phone number <span className="required">Required</span><input required type="tel" inputMode="tel" value={newCustomerPhone} onChange={(event) => setNewCustomerPhone(event.target.value)} placeholder="e.g. +91 88925 76065" /></label><label>Email address <span className="optional">Optional</span><input type="email" value={newCustomerEmail} onChange={(event) => setNewCustomerEmail(event.target.value)} placeholder="name@example.com" /></label><Button type="submit" busy={busy === 'customer'}>{createdCustomer ? 'Customer saved' : 'Save new customer'}</Button></form> : null}{selectedCustomer && <p className="success" role="status">Customer ready: <strong>{titleOf(selectedCustomer)}</strong></p>}{renderStepActions(Boolean(relationshipId), 'Continue to community')}</Panel>}
    {step === 'community' && <Panel className="onboarding-property-panel" title="Choose or create a community" description="Search a saved community or add its address once. The address and locality will be reused for its buildings.">
      {!relationshipId && <p className="onboarding-inline-note" role="status">Choose or add a customer in step 1 before creating a property.</p>}
      <fieldset className="onboarding-property-type">
        <legend>How would you like to add this property? <span className="required">Required</span></legend>
        <p className="onboarding-property-type-help">Choose a starting point. You can add buildings and assets in the next steps.</p>
        <div className="onboarding-property-type-options" role="radiogroup" aria-label="Property type">
          {([
            { value: 'community', icon: 'building', title: 'Create a community', description: 'Set up a community and reuse its address for buildings.' },
            { value: 'standalone', icon: 'map-pin', title: 'Standalone building', description: 'Add a building that does not belong to a community.' },
            { value: 'existing', icon: 'grid', title: 'Use a saved community', description: 'Find a community already linked to this customer.' }
          ] as const).map((option) => <label className={`onboarding-property-option${propertyTemplate === option.value ? ' selected' : ''}`} key={option.value}>
            <input type="radio" name="onboarding-property-type" value={option.value} checked={propertyTemplate === option.value} onChange={() => { setPropertyTemplate(option.value); setSelectedCommunityId(''); setSelectedBuildingIds({}); }} />
            <span className="onboarding-property-option-icon"><SvgIcon name={option.icon} size={21} /></span>
            <span className="onboarding-property-option-copy"><strong>{option.title}</strong><small>{option.description}</small></span>
            <span className="onboarding-property-option-indicator" aria-hidden="true" />
          </label>)}
        </div>
      </fieldset>
      {propertyTemplate !== 'existing' && <fieldset className="onboarding-address-fields"><legend>{propertyTemplate === 'community' ? 'Community address' : 'Building address'} <span className="required">Required</span></legend>{propertyTemplate === 'community' && <small>Enter this once. The community address and locality are reused for its buildings.</small>}
        <div className="onboarding-pincode-control"><label>PIN code<input required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} value={address.postalCode} onChange={(event) => { const postalCode = event.target.value.replace(/\D/g, '').slice(0, 6); pincodeLookupRequestId.current += 1; setPincodeLookupBusy(false); setPincodeLookup(null); setPincodeLookupError(''); setSelectedPostOffice(''); setAddress((current) => ({ ...current, postalCode, locality: '', state: '', stateCode: '', district: '', districtCode: '', city: '', cityCode: '' })); }} placeholder="6-digit PIN" /></label><Button type="button" variant="secondary" busy={pincodeLookupBusy} disabled={pincodeLookupBusy || !/^[1-9]\d{5}$/.test(address.postalCode.trim())} onClick={() => void lookupPincode()}>Look up PIN</Button><small>Look up the PIN, then choose the postal area that matches the entrance. Its locality, State/UT and district are filled from the postal record.</small></div>
        {pincodeLookupError && <p className="onboarding-inline-note onboarding-pincode-message" role="alert">{pincodeLookupError}</p>}
        {pincodeLookup && <div className="onboarding-pincode-results" role="status"><strong>{pincodeLookup.found ? `${pincodeLookup.post_offices.length} postal area${pincodeLookup.post_offices.length === 1 ? '' : 's'} found` : 'No postal data found for this PIN'}</strong>{pincodeLookup.found && pincodeLookup.post_offices.length > 0 && <><label>Post office / locality<SortedSelect value={selectedPostOffice} onChange={(event) => { const selected = pincodeLookup.post_offices.find((office) => pincodeOfficeKey(office) === event.target.value); setSelectedPostOffice(event.target.value); if (selected) setAddress((current) => ({ ...current, locality: selected.name, state: selected.state || pincodeLookup.state || current.state, district: selected.district || pincodeLookup.district || current.district, stateCode: '', districtCode: '', city: '', cityCode: '' })); }}><option value="">Choose a postal area</option>{pincodeLookup.post_offices.map((office) => <option key={pincodeOfficeKey(office)} value={pincodeOfficeKey(office)}>{office.name} · {office.district}, {office.state}{office.office_type ? ` · ${office.office_type}` : ''}</option>)}</SortedSelect></label><small>Choose the postal area for this entrance. We fill its State/UT and district; choose the matching city from the reference list.</small></>}{!pincodeLookup.found && <small>You can still enter the locality and select the State/UT, district and city manually.</small>}</div>}
        {pincodeLookup?.found && address.district && geography.stateCode && !geography.districtCode && <p className="onboarding-inline-note" role="status">The postal dataset reports district “{address.district}”, which does not exactly match a district label in the geography list. Choose its canonical district below; matching city options will then load.</p>}
        <div className="onboarding-grid"><SearchableSelect label="State or UT" searchLabel="Search Indian states and UTs" search={geography.stateSearch} onSearch={geography.setStateSearch} value={geography.stateCode} onChange={(id) => chooseAddressReference('state', id)} options={geography.stateOptions} placeholder="Select state / UT" required /><SearchableSelect label="District" searchLabel="Search districts in selected state" search={geography.districtSearch} onSearch={geography.setDistrictSearch} value={geography.districtCode} onChange={(id) => chooseAddressReference('district', id)} options={geography.districtOptions} placeholder="Select district" required disabled={!geography.stateCode} /><SearchableSelect label="City or town" searchLabel="Search Indian cities" search={geography.citySearch} onSearch={geography.setCitySearch} value={geography.cityCode} onChange={(id) => chooseAddressReference('city', id)} options={geography.cityOptions} placeholder="Select city" required disabled={!geography.districtCode} /></div>
        <label>Address line<input required value={address.line1} onChange={(event) => setAddress((current) => ({ ...current, line1: event.target.value }))} placeholder="Door/building number and street" /></label>
        <label>Locality or area<input required value={address.locality} onChange={(event) => setAddress((current) => ({ ...current, locality: event.target.value }))} placeholder="Example: Whitefield" /></label>
        <details className="onboarding-address-extra"><summary>Optional details · landmark and map coordinates</summary><div className="onboarding-grid"><label>Landmark<input value={address.landmark} onChange={(event) => setAddress((current) => ({ ...current, landmark: event.target.value }))} placeholder="Nearby landmark" /></label><label>Latitude<input type="number" step="0.000001" min="-90" max="90" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="12.9698" /></label><label>Longitude<input type="number" step="0.000001" min="-180" max="180" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="77.7500" /></label></div></details>
        {!propertyAddressReady && <small className="onboarding-address-validation" role="status">To save this location: {propertyAddressIssues.join(' ')}</small>}
      </fieldset>}
      {propertyTemplate === 'existing' && relationshipId && !locationsLoading && <><div className="onboarding-community-pin-search"><label>Filter saved communities by PIN <span className="optional">Optional</span><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={communityPinFilter} onChange={(event) => { communityPinSearchRequestId.current += 1; setCommunityPinSearchBusy(false); setCommunityPinFilter(event.target.value.replace(/\D/g, '').slice(0, 6)); setCommunityPinSearchError(''); }} placeholder="Enter a six-digit PIN" /><small>Searches this customer’s communities by their saved postal address.</small></label><Button type="button" variant="secondary" busy={communityPinSearchBusy} disabled={communityPinSearchBusy || !/^[1-9]\d{5}$/.test(communityPinFilter.trim())} onClick={() => void searchCommunitiesByPin()}>Find by PIN</Button></div>{communityPinSearchError && <p className="onboarding-inline-note" role="alert">{communityPinSearchError}</p>}{communityLookupError && <p className="onboarding-inline-note" role="alert">Community search failed: {communityLookupError}</p>}{communityLookupBusy && <p className="onboarding-inline-note" role="status">Searching this customer’s saved communities…</p>}{(existingCommunities.length > 0 || communitySearchPool.length > 0) && <SearchableSelect label="Search saved communities" searchLabel="Search this customer’s communities by name, code or address" search={communitySearch} onSearch={setCommunitySearch} value={selectedCommunityId} onChange={(id) => { setSelectedCommunityId(id); setSelectedBuildingIds({}); }} options={pinFilteredCommunityOptions} placeholder="Type a name, code, address or PIN" required />}{communityPinFilter.length === 6 && searchedCommunityPin === communityPinFilter && pinFilteredCommunityOptions.length === 0 && <div className="onboarding-inline-note onboarding-empty-communities"><span>No saved community matches PIN {communityPinFilter}.</span><Button type="button" variant="secondary" onClick={() => { setSelectedCommunityId(''); setPropertyTemplate('community'); setAddress((current) => ({ ...current, postalCode: communityPinFilter })); }}>Create a community with this PIN</Button></div>}</>}
      {propertyTemplate === 'existing' && locationsLoading && <p className="onboarding-inline-note" role="status">Loading this customer’s saved communities…</p>}
      {propertyTemplate === 'existing' && !locationsLoading && existingCommunities.length === 0 && <div className="onboarding-inline-note onboarding-empty-communities"><span>No saved communities are available for this customer yet.</span><Button type="button" variant="secondary" onClick={() => { setSelectedCommunityId(''); setPropertyTemplate('community'); }}>Create a community</Button></div>}
      {propertyTemplate === 'existing' && !locationsLoading && existingCommunities.length > 0 && !selectedCommunity && <p className="onboarding-inline-note">Select a saved community to use its buildings.</p>}
      {propertyTemplate === 'community' && <><label>New community name <span className="required">Required</span><input required aria-invalid={communityNameDuplicate} value={communityName} onChange={(event) => { setCommunityName(event.target.value); setCommunityLookup(null); setCommunityLookupBusy(event.target.value.trim().length >= 2); setCommunityLookupError(''); }} placeholder="Example: Green Meadows" /></label>{communityLookupError && <p className="onboarding-inline-note" role="alert">Could not check saved communities: {communityLookupError}. You can retry by editing the name.</p>}{communityLookupBusy && <p className="onboarding-inline-note" role="status">Checking this customer’s saved communities…</p>}{communityNameDuplicate && <div className="onboarding-inline-note onboarding-name-conflict" role="alert"><span>This customer already has “{titleOf(communityNameMatch!)}”. Use the saved record to continue without re-entering its address.</span><Button type="button" variant="secondary" onClick={() => useExistingCommunity(communityNameMatch!)}>Use existing community</Button></div>}{communityLookup && communityLookup.query === communityName.trim() && !communityNameDuplicate && <p className="onboarding-inline-note" role="status">No exact name match found for this customer. You can create this community.</p>}<div className="action-footer"><Button busy={busy === communityName || communityLookupBusy} disabled={!relationshipId || Boolean(community) || !communityName.trim() || communityNameDuplicate || communityLookupBusy || !propertyAddressReady} onClick={() => void saveLocation(communityName, 'COMMUNITY')}>{community ? 'Community saved' : 'Save community'}</Button></div></>}
      {communityReady && <p className="onboarding-ready-banner" role="status"><strong>{propertyTemplate === 'standalone' ? 'Building address ready' : 'Community ready'}</strong><span>{propertyTemplate === 'existing' ? `Selected ${titleOf(selectedCommunity!)}.` : propertyTemplate === 'community' ? `${communityName} is saved and ready for buildings.` : 'Add the standalone building in the next step.'}</span></p>}
      {renderStepActions(communityReady && (propertyTemplate !== 'community' || !communityNameDuplicate), 'Continue to buildings')}
    </Panel>}
    {step === 'buildings' && <Panel className="onboarding-property-panel" title="Add building details" description="Add each building under the selected community. A standalone property is saved as one building.">
      {propertyTemplate === 'standalone' ? <><label>Building name <span className="required">Required</span><input required value={standaloneName} onChange={(event) => setStandaloneName(event.target.value)} placeholder="Example: Main Street Building" /></label>{!standaloneBuilding && <label>Building entry / access details <span className="optional">Optional</span><input maxLength={200} value={standaloneEntryNote} onChange={(event) => setStandaloneEntryNote(event.target.value)} placeholder="Example: Service entrance beside the south gate" /></label>}<div className="action-footer"><Button busy={busy === standaloneName} disabled={!relationshipId || Boolean(standaloneBuilding) || !standaloneName.trim() || !propertyAddressReady} onClick={() => void saveLocation(standaloneName, 'BUILDING', undefined, standaloneEntryNote)}>{standaloneBuilding ? 'Building saved' : 'Save building'}</Button></div></> : <>
        {community && <article className="record-card"><strong>{titleOf(community)}</strong><small>{buildingLocations.length} saved building{buildingLocations.length === 1 ? '' : 's'} · Add another building below.</small></article>}
        <div className="onboarding-grid">{buildingNames.map((name, index) => { const fullName = `${buildingParentName} · ${name}`; const record = availableLocations.find((item) => item.id === selectedBuildingIds[name]) || savedLocations[fullName]; const duplicateBuildingName = hasDuplicateLocationName(name, buildingNames.filter((candidate, candidateIndex) => candidateIndex !== index)); return <article className="record-card" key={`${community?.id || 'new'}:${index}`}>{record ? <><strong>{titleOf(record)}</strong><small>Saved building in this community</small></> : <><label>Building {index + 1}<input required aria-invalid={duplicateBuildingName} value={name} onChange={(event) => setBuildingNames((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder="Example: Tower A" /></label><label>Building entry / access details <span className="optional">Optional</span><textarea rows={2} maxLength={200} value={buildingEntryNotes[index] || ''} onChange={(event) => setBuildingEntryNotes((current) => current.map((note, noteIndex) => noteIndex === index ? event.target.value : note))} placeholder="Example: Service entrance beside the south gate" /></label></>}{duplicateBuildingName && <small className="onboarding-name-conflict">Building names must be unique in this community.</small>}{!record && <><Button variant="secondary" disabled={!community || Boolean(busy) || !name.trim() || duplicateBuildingName} onClick={() => void saveLocation(fullName, 'BUILDING', linkOf(community!, 'service_location')?.id || community?.id, buildingEntryNotes[index])}>{busy === fullName ? 'Saving…' : 'Save building'}</Button>{buildingNames.length > 1 && <Button type="button" variant="quiet" onClick={() => removeBuilding(index)}>Remove</Button>}</>}</article>; })}</div><Button type="button" variant="secondary" onClick={addBuilding} disabled={!community}>Add building</Button>
      </>}
      {propertyReady && <p className="onboarding-ready-banner" role="status"><strong>Buildings ready</strong><span>{buildingLocations.length} building{buildingLocations.length === 1 ? '' : 's'} saved. Continue to register assets or skip to contacts and access.</span></p>}
      {renderStepActions(propertyReady, 'Continue to assets')}
    </Panel>}
    {step === 'assets' && <Panel className="onboarding-property-panel" title="Register elevators" description="Register every elevator as an asset. Each lift uses the same type, stops and rated capacity fields carried through project requirements, plus the specifications configured for its asset definition." titleInfo={<InfoNotice>Each saved elevator is one unit in the building inventory. Manufacturer, model, serial number, installation date and other fields come from the selected asset definition.</InfoNotice>}>
      {definitionsLoading && <p className="onboarding-inline-note" role="status">Loading available asset types…</p>}
      {requirementCatalogueLoading && <p className="onboarding-inline-note" role="status">Loading the elevator type catalogue…</p>}
      {requirementCatalogueError && <p className="onboarding-inline-note" role="alert">Elevator type options could not be loaded: {requirementCatalogueError}</p>}
      <label>Asset definition <span className="required">Required to add an elevator</span><SortedSelect value={definitionId} onChange={(event) => setDefinitionId(event.target.value)} disabled={definitionsLoading}><option value="">Select asset definition</option>{definitions?.data.map((item) => <option key={item.id} value={item.id}>{titleOf(item)} · version {String(item.attributes.version || 1)}</option>)}</SortedSelect></label>
      {definitionId && <form onSubmit={saveElevator} className="onboarding-form">
        <label>Building <span className="required">Required</span><SortedSelect name="building" required defaultValue={propertyTemplate === 'standalone' ? standaloneName : buildingNames[0]}>{(propertyTemplate === 'standalone' ? [standaloneName] : buildingNames).map((name) => <option key={name}>{name}</option>)}</SortedSelect></label>
        <label>Asset name or code <span className="required">Required</span><input name="asset_name" required value={assetNameDraft} onChange={(event) => setAssetNameDraft(event.target.value)} placeholder="Example: Passenger Lift 02" /><small>Use a unique label for each lift, such as Passenger Lift 01, Passenger Lift 02, or the equipment code.</small></label>
        {attributeDefinitions === null ? <p className="onboarding-inline-note" role="status">{attributeDefinitionsLoading ? 'Loading elevator specifications…' : 'Specification fields are unavailable. Reopen this step to retry.'}</p> : <>
          {coreElevatorSpecsReady ? <fieldset className="onboarding-elevator-core-specs"><legend>Core elevator specifications <span className="required">Required</span></legend><p>These per-lift values use the same equipment type catalogue and requirements as project intake.</p>
            <label>Equipment type <span className="required">Required</span><SortedSelect name={`attribute:${coreElevatorDefinitions.equipmentType!.id}`} required defaultValue=""><option value="">Select elevator type</option>{equipmentTypeOptions.map((option) => <option value={option.code} key={option.code}>{option.label}</option>)}</SortedSelect></label>
            <label>Stops / floors served <span className="required">Required</span><input name={`attribute:${coreElevatorDefinitions.stops!.id}`} type="number" required min={1} max={300} step={1} placeholder="e.g. 12" /></label>
            <label>Rated capacity (kg) <span className="required">Required</span><input name={`attribute:${coreElevatorDefinitions.capacity!.id}`} type="number" required min={1} max={10000} step={1} placeholder="e.g. 680" /></label>
          </fieldset> : <p className="onboarding-inline-note" role="alert">This asset definition is missing one or more core elevator fields. Publish an asset definition with equipment type, stops and capacity before registering this lift.</p>}
          <fieldset><legend>Asset identification and other specifications</legend>{otherAssetDefinitions.length ? otherAssetDefinitions.map((definition) => { const type = String(definition.attributes.value_type || 'string'); const label = String(definition.attributes.label || definition.attributes.key || definition.attributes.code); const required = Boolean(definition.attributes.required); const inputType = type === 'number' || type === 'integer' ? 'number' : type === 'date' ? 'date' : 'text'; return <label key={definition.id}>{label} {required ? <span className="required">Required</span> : <span className="optional">Optional</span>}{type === 'boolean' ? <SortedSelect name={`attribute:${definition.id}`} required={required} defaultValue=""><option value="">Select</option><option value="true">Yes</option><option value="false">No</option></SortedSelect> : <input name={`attribute:${definition.id}`} type={inputType} required={required} min={type === 'number' || type === 'integer' ? 0 : undefined} placeholder={definition.attributes.unit ? String(definition.attributes.unit) : undefined} />}</label>; }) : <p className="onboarding-inline-note">This asset definition has no additional identification fields.</p>}</fieldset>
        </>}
        <Button type="submit" busy={Boolean(busy)} disabled={!definitionId || definitionsLoading || attributeDefinitionsLoading || attributeDefinitions === null || requirementCatalogueLoading || !coreElevatorSpecsReady}>Save elevator asset</Button>
      </form>}
      <div className="record-grid">{existingElevators.map((name) => <article className="record-card" key={name}><Status>Saved</Status><strong>{name}</strong><small>Building context saved</small></article>)}</div>
      {renderStepActions(true, 'Continue to contacts & access')}
    </Panel>}
    {step === 'finish' && <section className="onboarding-finish-summary"><div><p className="onboarding-eyebrow">OPTIONAL NEXT STEPS</p><h3>Contacts and customer access</h3><p>Add people responsible for the property or configure the customer’s scoped portal access.</p></div></section>}
    {step === 'finish' && <Panel collapsible title="Add people and responsibilities" description="Add a site contact and their responsibility when you have those details. This does not grant account access."><form className="onboarding-form" onSubmit={createContactParty}><label>Person or organization name <span className="required">Required</span><input required value={partyName} onChange={(event) => setPartyName(event.target.value)} placeholder="Example: Green Meadows Residents Association" /></label><label>Record type <span className="required">Required</span><SortedSelect value={partyKind} onChange={(event) => setPartyKind(event.target.value)}><option value="PERSON">Person</option><option value="ORGANIZATION">Organization</option></SortedSelect></label><label>Phone number <span className="required">Required</span><input required type="tel" inputMode="tel" value={partyPhone} onChange={(event) => setPartyPhone(event.target.value)} placeholder="e.g. +91 88925 76065" /></label><label>Email address <span className="optional">Optional</span><input type="email" value={partyEmail} onChange={(event) => setPartyEmail(event.target.value)} placeholder="name@example.com" /></label><Button type="submit" busy={busy === 'party'}>{contactPartyId ? 'Party saved' : 'Save person or organization'}</Button></form>{contactPartyId && <><p className="success" role="status">Party saved. Now add an optional role contact point.</p><form className="onboarding-form" onSubmit={createContact}><label>Contact display name <span className="required">Required</span><input required value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Example: Security desk" /></label><label>Contact type <span className="required">Required</span><SortedSelect value={contactKind} onChange={(event) => setContactKind(event.target.value)}><option value="PERSON">Person</option><option value="ORGANIZATION">Organization contact point</option></SortedSelect></label><label>Email <span className="optional">Optional</span><input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="name@example.test" /></label><label>Phone <span className="optional">Optional</span><input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="Local contact number" /></label><Button type="submit" busy={busy === 'contact'}>Save contact details</Button></form><form className="onboarding-form" onSubmit={createResponsibility}><label>Property scope <span className="required">Required</span><SortedSelect required value={scopeId} onChange={(event) => setScopeId(event.target.value)}><option value="">Choose community or building</option>{community && <option value={community.id}>{titleOf(community)} — community</option>}{buildingLocations.map((item) => <option value={item.id} key={item.id}>{titleOf(item)}</option>)}</SortedSelect></label><label>Responsibility <span className="required">Required</span><SortedSelect value={responsibilityType} onChange={(event) => setResponsibilityType(event.target.value)}><option value="COMMUNITY_MANAGER">Community manager</option><option value="BUILDING_IN_CHARGE">Building in-charge</option><option value="MAINTENANCE_COORDINATOR">Maintenance coordinator</option><option value="SITE_ACCESS">Site access contact</option><option value="SECURITY_DESK">Security desk</option><option value="EMERGENCY_ESCALATION">Emergency contact</option><option value="ALTERNATE_CONTACT">Alternate contact</option></SortedSelect></label><label>Primary or alternate <span className="required">Required</span><SortedSelect value={designation} onChange={(event) => setDesignation(event.target.value)}><option value="PRIMARY">Primary</option><option value="ALTERNATE">Alternate</option></SortedSelect></label><Button type="submit" busy={busy === 'responsibility'} disabled={!scopeId || !contactName.trim()}>Assign responsibility</Button></form><div className="action-footer"><form onSubmit={(event) => void createPropertyRelationship('representation', event)}><Button type="submit" variant="secondary" busy={busy === 'representation'} disabled={!scopeId}>Add representation</Button></form><form onSubmit={(event) => void createPropertyRelationship('management', event)}><Button type="submit" variant="secondary" busy={busy === 'management'} disabled={!scopeId}>Add management relationship</Button></form></div></>}</Panel>}
    {step === 'finish' && <Panel collapsible title="Give the customer access" description="Grant the customer scoped portal access after confirming their email and permissions."><p className="notice">Selected customer: <strong>{selectedCustomer ? titleOf(selectedCustomer) : 'Choose a customer first'}</strong>{selectedCustomer && <><br />Email for portal invitation and notifications: <strong>{selectedCustomerEmail || 'Not supplied'}</strong></>}</p><form className="onboarding-form" onSubmit={grantCustomerAccess}><label>Access scope <span className="required">Required</span><SortedSelect required value={accessScopeId} onChange={(event) => setAccessScopeId(event.target.value)}><option value="">Choose community or building</option>{community && <option value={community.id}>{titleOf(community)} — community</option>}{buildingLocations.map((item) => <option value={item.id} key={item.id}>{titleOf(item)}</option>)}</SortedSelect></label><label>Customer role <span className="required">Required</span><SortedSelect value={accessRole} onChange={(event) => setAccessRole(event.target.value)}><option value="MEMBER">Member</option><option value="OWNER">Owner</option><option value="COMMITTEE">Committee</option></SortedSelect></label><label>Include child buildings and assets <span className="required">Required</span><SortedSelect value={accessInheritance} onChange={(event) => setAccessInheritance(event.target.value)}><option value="DESCENDANTS">Yes — include children</option><option value="NONE">No — selected location only</option></SortedSelect></label><fieldset><legend>What can this customer do? <span className="required">Choose at least one</span></legend>{[['VIEW_LOCATION', 'View property'], ['VIEW_ASSET', 'View elevators and assets'], ['VIEW_SERVICE', 'View service history'], ['RAISE_SERVICE', 'Report a service problem'], ['VIEW_DOCUMENTS', 'View documents']].map(([value, label]) => <label className="checkbox-row" key={value}><input type="checkbox" checked={accessCapabilities.includes(value)} onChange={() => toggleAccessCapability(value)} />{label}</label>)}</fieldset><Button type="submit" busy={busy === 'access'} disabled={!selectedCustomer || !selectedCustomerEmail || !accessScopeId || accessCapabilities.length === 0}>Save customer access</Button></form><p className="notice">An email address is required before portal access or email notifications can be enabled. After saving, sign in as the linked customer through normal Google authentication and verify that only this scope is visible.</p></Panel>}
  </section>;
}

import { useEffect, useState } from 'react';
import { operationsData, type IndiaGeographyEntry } from './data';
import { SearchableSelect, type LookupOption } from './searchable-select';

const optionsFor = (items: IndiaGeographyEntry[]): LookupOption[] => items.map((item) => ({
  id: item.attributes.code,
  label: item.attributes.name,
  detail: item.attributes.kind === 'STATE_UT' ? (item.attributes.state_code || item.attributes.code) : item.attributes.code,
}));
const normalizeReferenceName = (value: string) => value.trim().toLocaleLowerCase('en-IN').replace(/[^a-z0-9]/g, '');
const indiaReferenceNameAliases: Record<string, string> = { bangalore: 'bengaluruurban' };
export function matchesIndiaReferenceName(referenceName: string, sourceName: string) {
  const reference = normalizeReferenceName(referenceName);
  const source = normalizeReferenceName(sourceName);
  return reference === source || reference === indiaReferenceNameAliases[source];
}
let geographyCataloguePromise: Promise<IndiaGeographyEntry[]> | null = null;
function loadGeographyCatalogue() {
  if (!geographyCataloguePromise) {
    geographyCataloguePromise = operationsData.indiaLocations({ limit: 500 }).then((result) => result.data).catch((error) => {
      geographyCataloguePromise = null;
      throw error;
    });
  }
  return geographyCataloguePromise;
}

const entriesFor = (entries: IndiaGeographyEntry[], kind: IndiaGeographyEntry['attributes']['kind'], parentCode?: string) => entries.filter((entry) => entry.attributes.kind === kind && (!parentCode || entry.attributes.parent_code === parentCode));

export function useIndiaGeography(address: Record<string, unknown> = {}) {
  const stateName = String(address.state || '');
  // Customer edit forms keep the selected reference IDs in camelCase local
  // state, while API payloads use snake_case. Accept both shapes so dependent
  // District and City lookups remain usable when an existing billing address
  // is opened for editing.
  const stateIdentity = String(address.state_code || address.stateCode || '');
  const districtName = String(address.district || '');
  const districtIdentity = String(address.district_code || address.districtCode || '');
  const cityName = String(address.city || '');
  const cityIdentity = String(address.city_code || address.cityCode || '');
  const [stateOptions, setStateOptions] = useState<LookupOption[]>([]);
  const [districtOptions, setDistrictOptions] = useState<LookupOption[]>([]);
  const [cityOptions, setCityOptions] = useState<LookupOption[]>([]);
  const [stateSearch, setStateSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');

  useEffect(() => {
    let current = true;
    void loadGeographyCatalogue().then((entries) => {
      if (current) setStateOptions(optionsFor(entriesFor(entries, 'STATE_UT')));
    }).catch(() => undefined);
    return () => { current = false; };
  }, []);

  const selectedState = stateOptions.find((option) => matchesIndiaReferenceName(option.label, stateName) || option.id === stateIdentity);
  const stateCode = selectedState?.id || '';
  const districtCode = districtOptions.find((option) => matchesIndiaReferenceName(option.label, districtName) || option.id === districtIdentity)?.id || '';
  const cityCode = cityOptions.find((option) => matchesIndiaReferenceName(option.label, cityName) || option.id === cityIdentity)?.id || '';

  useEffect(() => {
    if (!stateCode) { setDistrictOptions([]); setCityOptions([]); return undefined; }
    let current = true;
    void loadGeographyCatalogue().then((entries) => {
      if (current) setDistrictOptions(optionsFor(entriesFor(entries, 'DISTRICT', stateCode)));
    }).catch(() => undefined);
    return () => { current = false; };
  }, [stateCode]);

  useEffect(() => {
    if (!stateCode || !districtCode) { setCityOptions([]); return undefined; }
    let current = true;
    void loadGeographyCatalogue().then((entries) => {
      if (current) setCityOptions(optionsFor(entriesFor(entries, 'CITY', districtCode)));
    }).catch(() => undefined);
    return () => { current = false; };
  }, [districtCode, stateCode]);

  return { stateOptions, districtOptions, cityOptions, stateSearch, setStateSearch, districtSearch, setDistrictSearch, citySearch, setCitySearch, stateCode, districtCode, cityCode };
}

export function IndiaStateSelect({ label = 'State / UT', value, onChange, required = false, disabled = false }: { label?: string; value: string; onChange: (value: string) => void; required?: boolean; disabled?: boolean }) {
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [search, setSearch] = useState('');
  useEffect(() => {
    let current = true;
    void loadGeographyCatalogue().then((entries) => {
      if (current) setOptions(optionsFor(entriesFor(entries, 'STATE_UT')));
    }).catch(() => undefined);
    return () => { current = false; };
  }, []);
  const selected = options.find((option) => option.label === value);
  return <SearchableSelect label={label} searchLabel="Search Indian states and UTs" search={search} onSearch={setSearch} value={selected?.id || ''} onChange={(id) => onChange(options.find((option) => option.id === id)?.label || '')} options={options} placeholder="Select state / UT" required={required} disabled={disabled} />;
}

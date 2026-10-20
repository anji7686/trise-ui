import { useEffect, useState } from 'react';
import { operationsData, type IndiaGeographyEntry } from './data';
import { SearchableSelect, type LookupOption } from './searchable-select';

const optionsFor = (items: IndiaGeographyEntry[]): LookupOption[] => items.map((item) => ({
  id: item.attributes.code,
  label: item.attributes.name,
  detail: item.attributes.kind === 'STATE_UT' ? (item.attributes.state_code || item.attributes.code) : item.attributes.code,
}));
let stateOptionsPromise: Promise<LookupOption[]> | null = null;
function loadStateOptions() {
  if (!stateOptionsPromise) {
    stateOptionsPromise = operationsData.indiaLocations({ kind: 'STATE_UT', limit: 50 }).then((result) => optionsFor(result.data)).catch((error) => {
      stateOptionsPromise = null;
      throw error;
    });
  }
  return stateOptionsPromise;
}

export function useIndiaGeography(address: Record<string, unknown> = {}) {
  const stateName = String(address.state || '');
  const stateIdentity = String(address.state_code || '');
  const districtName = String(address.district || '');
  const districtIdentity = String(address.district_code || '');
  const cityName = String(address.city || '');
  const cityIdentity = String(address.city_code || '');
  const [stateOptions, setStateOptions] = useState<LookupOption[]>([]);
  const [districtOptions, setDistrictOptions] = useState<LookupOption[]>([]);
  const [cityOptions, setCityOptions] = useState<LookupOption[]>([]);
  const [stateSearch, setStateSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [citySearch, setCitySearch] = useState('');

  useEffect(() => {
    let current = true;
    void loadStateOptions().then((options) => {
      if (current) setStateOptions(options);
    }).catch(() => undefined);
    return () => { current = false; };
  }, []);

  const selectedState = stateOptions.find((option) => option.label === stateName || option.id === stateIdentity);
  const stateCode = selectedState?.id || '';
  const districtCode = districtOptions.find((option) => option.label === districtName || option.id === districtIdentity)?.id || '';
  const cityCode = cityOptions.find((option) => option.label === cityName || option.id === cityIdentity)?.id || '';

  useEffect(() => {
    if (!stateCode) { setDistrictOptions([]); setCityOptions([]); return undefined; }
    let current = true;
    void operationsData.indiaLocations({ kind: 'DISTRICT', parentCode: stateCode, limit: 50 }).then((result) => {
      if (current) setDistrictOptions(optionsFor(result.data));
    }).catch(() => undefined);
    return () => { current = false; };
  }, [stateCode]);

  useEffect(() => {
    const query = districtSearch.trim();
    if (query.length < 3 || !stateCode) return undefined;
    let current = true;
    void operationsData.indiaLocations({ kind: 'DISTRICT', q: query, parentCode: stateCode, limit: 50 }).then((result) => {
      if (current) setDistrictOptions(optionsFor(result.data));
    }).catch(() => undefined);
    return () => { current = false; };
  }, [districtSearch, stateCode]);

  useEffect(() => {
    if (!stateCode || !districtCode) { setCityOptions([]); return undefined; }
    let current = true;
    void operationsData.indiaLocations({ kind: 'CITY', parentCode: districtCode, limit: 50 }).then((result) => {
      if (current) setCityOptions(optionsFor(result.data));
    }).catch(() => undefined);
    return () => { current = false; };
  }, [districtCode, stateCode]);

  useEffect(() => {
    const query = citySearch.trim();
    if (query.length < 3 || !stateCode || !districtCode) return undefined;
    let current = true;
    void operationsData.indiaLocations({ kind: 'CITY', q: query, parentCode: districtCode, limit: 50 }).then((result) => {
      if (current) setCityOptions(optionsFor(result.data));
    }).catch(() => undefined);
    return () => { current = false; };
  }, [citySearch, districtCode, stateCode]);

  return { stateOptions, districtOptions, cityOptions, stateSearch, setStateSearch, districtSearch, setDistrictSearch, citySearch, setCitySearch, stateCode, districtCode, cityCode };
}

export function IndiaStateSelect({ label = 'State / UT', value, onChange, required = false, disabled = false }: { label?: string; value: string; onChange: (value: string) => void; required?: boolean; disabled?: boolean }) {
  const [options, setOptions] = useState<LookupOption[]>([]);
  const [search, setSearch] = useState('');
  useEffect(() => {
    let current = true;
    void loadStateOptions().then((options) => {
      if (current) setOptions(options);
    }).catch(() => undefined);
    return () => { current = false; };
  }, []);
  const selected = options.find((option) => option.label === value);
  return <SearchableSelect label={label} searchLabel="Search Indian states and UTs" search={search} onSearch={setSearch} value={selected?.id || ''} onChange={(id) => onChange(options.find((option) => option.id === id)?.label || '')} options={options} placeholder="Select state / UT" required={required} disabled={disabled} />;
}

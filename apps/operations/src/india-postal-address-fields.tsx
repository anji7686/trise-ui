import { useEffect, useRef, useState } from 'react';
import { Button, SortedSelect } from '@trise/ui';
import { operationsData } from './data';
import { SearchableSelect } from './searchable-select';
import { useIndiaGeography } from './use-india-geography';
import './india-postal-address-fields.css';

export type IndiaPostalAddress = {
  pin_code: string;
  post_office: string;
  address_line: string;
  locality: string;
  city: string;
  district: string;
  state: string;
};

export const emptyIndiaPostalAddress = (): IndiaPostalAddress => ({
  pin_code: '', post_office: '', address_line: '', locality: '', city: '', district: '', state: '',
});

export function indiaPostalAddressComplete(address: IndiaPostalAddress) {
  return /^[1-9]\d{5}$/.test(address.pin_code) && Boolean(
    address.post_office.trim() && address.locality.trim() && address.city.trim() && address.district.trim() && address.state.trim(),
  );
}

export function localityLabel(postOfficeName: string) {
  return postOfficeName.replace(/\s+(?:S\.O|B\.O|H\.O)\.?$/i, '').trim();
}

export function suggestedCityForLocality(locality: string, cities: Array<{ id: string; label: string }>) {
  const normalize = (value: string) => value.toLocaleLowerCase('en-IN').replace(/[^a-z0-9]/g, '');
  const match = cities.find((city) => normalize(city.label) === normalize(localityLabel(locality)));
  return match?.label || (cities.length === 1 ? cities[0].label : '');
}

export function formatIndiaPostalAddress(address: IndiaPostalAddress) {
  return [address.address_line, address.locality, address.city, address.district, address.state, address.pin_code]
    .map((part) => part.trim()).filter(Boolean).join(', ');
}

export function parseIndiaPostalAddressSummary(summary: string) {
  const [siteName, rawAddress = ''] = summary.split(' · ', 2);
  const parts = rawAddress.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 5 || !/^[1-9]\d{5}$/.test(parts.at(-1) || '')) {
    return { siteName: summary.trim(), postalAddress: emptyIndiaPostalAddress() };
  }
  const pin_code = parts.at(-1) || '';
  const state = parts.at(-2) || '';
  const district = parts.at(-3) || '';
  const city = parts.at(-4) || '';
  const locality = parts.at(-5) || '';
  return {
    siteName: siteName.trim(),
    postalAddress: {
      ...emptyIndiaPostalAddress(),
      pin_code,
      state,
      district,
      city,
      locality,
      post_office: locality,
      address_line: parts.slice(0, -5).join(', '),
    },
  };
}

export function IndiaPostalAddressFields({
  value,
  onChange,
  required,
}: {
  value: IndiaPostalAddress;
  onChange: (value: IndiaPostalAddress) => void;
  required: boolean;
}) {
  const [lookup, setLookup] = useState<Awaited<ReturnType<typeof operationsData.indiaPincode>>['data'] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const geography = useIndiaGeography({ state: value.state, district: value.district, city: value.city });

  useEffect(() => {
    if (!value.post_office || !value.locality || value.city || geography.cityOptions.length === 0) return;
    const city = suggestedCityForLocality(value.locality, geography.cityOptions);
    if (city) onChange({ ...value, city });
  }, [geography.cityOptions, onChange, value]);

  useEffect(() => {
    if (!/^[1-9]\d{5}$/.test(value.pin_code) || !value.post_office || lookup) return;
    let active = true;
    void operationsData.indiaPincode(value.pin_code).then((result) => {
      if (active) setLookup(result.data);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [lookup, value.pin_code, value.post_office]);

  async function findAddress() {
    const pin = value.pin_code.trim();
    if (!/^[1-9]\d{5}$/.test(pin)) {
      setLookup(null);
      setError('Enter a valid six-digit Indian PIN code first.');
      return;
    }
    const sequence = ++requestId.current;
    setBusy(true);
    setError('');
    try {
      const result = await operationsData.indiaPincode(pin);
      if (requestId.current !== sequence) return;
      setLookup(result.data);
      onChange({
        ...value,
        district: result.data.district || '',
        state: result.data.state || '',
        post_office: '',
        locality: '',
        city: '',
      });
      if (!result.data.found || !result.data.post_offices.length) setError('No post office was found for this PIN code.');
    } catch (cause) {
      if (requestId.current === sequence) {
        setLookup(null);
        setError((cause as Error).message || 'Address lookup failed. Try again or check the PIN code.');
      }
    } finally {
      if (requestId.current === sequence) setBusy(false);
    }
  }

  function updatePin(pin: string) {
    requestId.current += 1;
    setBusy(false);
    setLookup(null);
    setError('');
    onChange({ ...emptyIndiaPostalAddress(), pin_code: pin.replace(/\D/g, '').slice(0, 6) });
  }

  return (
    <div className="india-postal-address-fields">
      <div className="india-postal-pin-control">
        <label>
          PIN code{required ? ' *' : ' (optional)'}
          <input
            inputMode="numeric"
            pattern="[1-9][0-9]{5}"
            maxLength={6}
            required={required}
            value={value.pin_code}
            placeholder="6-digit Indian PIN code"
            onChange={(event) => updatePin(event.target.value)}
          />
        </label>
        <Button type="button" variant="secondary" busy={busy} disabled={busy || !/^[1-9]\d{5}$/.test(value.pin_code)} onClick={() => void findAddress()}>
          Find address
        </Button>
      </div>
      {error && <small className="india-postal-address-message" role="alert">{error}</small>}
      {lookup?.found && (
        <div className="india-postal-address-grid">
          <label>
            Locality / area{required ? ' *' : ''}
            <SortedSelect
              required={required}
              value={value.post_office}
              onChange={(event) => {
                const office = lookup.post_offices.find((entry) => entry.name === event.target.value);
                onChange({ ...value, post_office: event.target.value, locality: localityLabel(office?.name || '') });
              }}
            >
              <option value="">Select locality / area</option>
              {lookup.post_offices.map((office, index) => <option key={`${office.name}-${index}`} value={office.name}>{localityLabel(office.name)}</option>)}
            </SortedSelect>
          </label>
          <label>
            Address line / building / street
            <input maxLength={80} value={value.address_line} onChange={(event) => onChange({ ...value, address_line: event.target.value })} placeholder="Door, building, street, or landmark" />
          </label>
          {geography.cityOptions.length ? (
            <SearchableSelect
              label={`City / town${required ? ' *' : ''}`}
              searchLabel="Search Indian cities"
              search={geography.citySearch}
              onSearch={geography.setCitySearch}
              value={geography.cityOptions.find((option) => option.label === value.city)?.id || ''}
              onChange={(id) => onChange({ ...value, city: geography.cityOptions.find((option) => option.id === id)?.label || '' })}
              options={geography.cityOptions}
              placeholder="Select city / town"
              required={required}
            />
          ) : (
            <label>
              City / town{required ? ' *' : ''}
              <input required={required} maxLength={40} value={value.city} onChange={(event) => onChange({ ...value, city: event.target.value })} />
            </label>
          )}
          <label>District<input readOnly value={value.district} /></label>
          <label>State / UT<input readOnly value={value.state} /></label>
          <small className="india-postal-address-help">PIN lookup supplies the state, district, and post offices. Select the correct post office and confirm the locality and city.</small>
        </div>
      )}
    </div>
  );
}

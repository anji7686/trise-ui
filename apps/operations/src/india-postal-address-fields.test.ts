import { describe, expect, it } from 'vitest';
import {
  emptyIndiaPostalAddress,
  formatIndiaPostalAddress,
  indiaPostalAddressComplete,
  localityLabel,
  parseIndiaPostalAddressSummary,
  suggestedCityForLocality,
} from './india-postal-address-fields';

describe('India PIN based postal address', () => {
  it('formats the PIN lookup and user confirmed locality into the site summary', () => {
    const address = {
      ...emptyIndiaPostalAddress(),
      pin_code: '560036',
      post_office: 'Mahadevapura',
      address_line: 'Tower A, Outer Ring Road',
      locality: 'Mahadevapura',
      city: 'Bengaluru',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
    };

    expect(indiaPostalAddressComplete(address)).toBe(true);
    expect(formatIndiaPostalAddress(address)).toBe('Tower A, Outer Ring Road, Mahadevapura, Bengaluru, Bengaluru Urban, Karnataka, 560036');
  });

  it('restores a lookup address from an existing Work Intake site summary', () => {
    const parsed = parseIndiaPostalAddressSummary('Anjan Site · Tower A, Mahadevapura, Bengaluru, Bengaluru Urban, Karnataka, 560036');

    expect(parsed.siteName).toBe('Anjan Site');
    expect(parsed.postalAddress.post_office).toBe('Mahadevapura');
    expect(parsed.postalAddress.locality).toBe('Mahadevapura');
    expect(parsed.postalAddress.pin_code).toBe('560036');
    expect(indiaPostalAddressComplete(parsed.postalAddress)).toBe(true);
  });

  it('leaves legacy site names address-optional', () => {
    const parsed = parseIndiaPostalAddressSummary('Anjan Site or project name');

    expect(parsed.siteName).toBe('Anjan Site or project name');
    expect(indiaPostalAddressComplete(parsed.postalAddress)).toBe(false);
  });

  it('cleans postal office suffixes from locality choices', () => {
    expect(localityLabel('Devasandra S.O')).toBe('Devasandra');
    expect(localityLabel('Whitefield B.O.')).toBe('Whitefield');
  });

  it('fills a uniquely resolved city and preserves ambiguous city choices', () => {
    expect(suggestedCityForLocality('Devasandra', [{ id: 'blr', label: 'Bengaluru' }])).toBe('Bengaluru');
    expect(suggestedCityForLocality('Devasandra', [
      { id: 'blr', label: 'Bengaluru' },
      { id: 'kri', label: 'Krishnarajapuram' },
    ])).toBe('');
  });
});

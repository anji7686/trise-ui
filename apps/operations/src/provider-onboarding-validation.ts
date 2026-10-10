export type ContactDraft = {
  display_name: string;
  email: string;
  mobile: string;
  landline: string;
};

export type LocationDraft = {
  name: string;
  city: string;
  district: string;
  state: string;
  pin_code: string;
  latitude: string;
  longitude: string;
};

export type FieldErrors = Record<string, string>;

export function validateOnboardingContact(contact: ContactDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!contact.display_name.trim()) errors.display_name = 'Enter a contact name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) errors.email = 'Enter a valid email address.';
  if (!/^\+91[6-9]\d{9}$/.test(contact.mobile.trim())) errors.mobile = 'Enter an Indian mobile number in +91XXXXXXXXXX format.';
  if (contact.landline.trim() && !/^(?:\+91|0)?[1-9]\d{7,11}$/.test(contact.landline.trim())) errors.landline = 'Enter a valid Indian landline number.';
  return errors;
}

export function validateOnboardingLocation(location: LocationDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!location.name.trim()) errors.name = 'Enter an office name.';
  if (!location.city.trim()) errors.city = 'Enter a city.';
  if (!location.district.trim()) errors.district = 'Enter a district.';
  if (!location.state.trim()) errors.state = 'Enter a state.';
  if (!/^[1-9]\d{5}$/.test(location.pin_code.trim())) errors.pin_code = 'Enter a valid 6-digit Indian PIN code.';

  const latitude = location.latitude.trim();
  const longitude = location.longitude.trim();
  if ((latitude && !longitude) || (!latitude && longitude)) {
    errors.coordinates = 'Supply both latitude and longitude, or leave both empty.';
  } else if (latitude && longitude) {
    const latitudeNumber = Number(latitude);
    const longitudeNumber = Number(longitude);
    if (!Number.isFinite(latitudeNumber) || latitudeNumber < -90 || latitudeNumber > 90) errors.latitude = 'Latitude must be between -90 and 90.';
    if (!Number.isFinite(longitudeNumber) || longitudeNumber < -180 || longitudeNumber > 180) errors.longitude = 'Longitude must be between -180 and 180.';
  }
  return errors;
}

export function stableSubmissionKey(current: string | null, create: () => string): string {
  return current || create();
}

import { describe, expect, it, vi } from 'vitest';
import { normalizeIndianMobile, stableSubmissionKey, validateOnboardingContact, validateOnboardingLocation } from './provider-onboarding-validation';

describe('provider onboarding validation', () => {
  it('accepts the authoritative India contact shape', () => {
    expect(validateOnboardingContact({ display_name: 'Primary contact', email: 'primary@example.test', mobile: '+919888888888', landline: '08040000000' })).toEqual({});
  });

  it('accepts local 10-digit and country-code mobile inputs and normalizes them on save', () => {
    for (const mobile of ['9198765432', '919198765432', '+919198765432']) {
      expect(validateOnboardingContact({ display_name: 'Test User', email: 'demo@example.test', mobile, landline: '' })).toEqual({});
    }
    expect(normalizeIndianMobile('9198765432')).toBe('+919198765432');
    expect(normalizeIndianMobile('919198765432')).toBe('+919198765432');
    expect(normalizeIndianMobile('+919198765432')).toBe('+919198765432');
  });

  it('returns field-level contact errors', () => {
    expect(validateOnboardingContact({ display_name: ' ', email: 'invalid', mobile: '123', landline: 'bad' })).toEqual({
      display_name: 'Enter a contact name.',
      email: 'Enter a valid email address.',
      mobile: 'Enter a 10-digit Indian mobile number. You can also include the +91 country code.',
      landline: 'Enter a valid Indian landline number.'
    });
  });

  it('validates office fields, coordinate pairs, and numeric bounds', () => {
    expect(validateOnboardingLocation({ name: '', city: '', district: '', state: '', pin_code: '012345', latitude: '91', longitude: '' })).toMatchObject({
      name: expect.any(String), city: expect.any(String), district: expect.any(String), state: expect.any(String), pin_code: expect.any(String), coordinates: expect.any(String)
    });
    expect(validateOnboardingLocation({ name: 'Office', city: 'Bengaluru', district: 'Bengaluru Urban', state: 'Karnataka', pin_code: '560001', latitude: '91', longitude: '181' })).toMatchObject({ latitude: expect.any(String), longitude: expect.any(String) });
  });

  it('accepts a complete office without coordinates', () => {
    expect(validateOnboardingLocation({ name: 'Office', city: 'Bengaluru', district: 'Bengaluru Urban', state: 'Karnataka', pin_code: '560001', latitude: '', longitude: '' })).toEqual({});
  });

  it('reuses an existing idempotency key for a retry', () => {
    const create = vi.fn(() => '00000000-0000-4000-8000-000000000001');
    expect(stableSubmissionKey(null, create)).toBe('00000000-0000-4000-8000-000000000001');
    expect(stableSubmissionKey('00000000-0000-4000-8000-000000000001', create)).toBe('00000000-0000-4000-8000-000000000001');
    expect(create).toHaveBeenCalledTimes(1);
  });
});

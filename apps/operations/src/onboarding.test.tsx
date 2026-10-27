import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PropertyOnboarding } from './onboarding';
import { matchesIndiaReferenceName } from './use-india-geography';
import {
  canVisitOnboardingStep,
  elevatorAssetName,
  existingCommunityReady,
  hasDuplicateElevatorAssetName,
  hasDuplicateLocationName,
  nextOnboardingStep,
  onboardingStepOrder,
  pincodeOfficeKey,
  previousOnboardingStep,
  validatePropertyAddress,
} from './onboarding-flow';

describe('property onboarding flow', () => {
  it('starts at customer selection and prevents jumping ahead', () => {
    const markup = renderToStaticMarkup(<PropertyOnboarding providerId="provider-1" />);

    expect(markup).toContain('Set up a customer property');
    expect(markup).toContain('aria-label="Property setup progress"');
    expect(markup).toContain('aria-valuenow="1"');
    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain('Loading customers…');
    expect(markup).toContain('Continue to community');
    expect(markup).toContain('disabled="" type="button">Continue to community</button>');
    expect(markup).toContain('aria-disabled="true" disabled=""');
    expect(markup).toContain('Community</strong><small>Next step</small>');
    expect(markup).toContain('disabled="" type="button">Continue to community</button>');
  });

  it('keeps community, buildings, assets and optional access in a sequential wizard', () => {
    expect(onboardingStepOrder).toEqual(['customer', 'community', 'buildings', 'assets', 'finish']);
    expect(canVisitOnboardingStep('customer', 0)).toBe(true);
    expect(canVisitOnboardingStep('community', 0)).toBe(false);
    expect(canVisitOnboardingStep('finish', 3)).toBe(false);
    expect(canVisitOnboardingStep('community', 1)).toBe(true);
    expect(canVisitOnboardingStep('buildings', 2)).toBe(true);
    expect(canVisitOnboardingStep('assets', 3)).toBe(true);
    expect(canVisitOnboardingStep('finish', 4)).toBe(true);
    expect(nextOnboardingStep('customer')).toBe('community');
    expect(nextOnboardingStep('community')).toBe('buildings');
    expect(nextOnboardingStep('buildings')).toBe('assets');
    expect(nextOnboardingStep('assets')).toBe('finish');
    expect(nextOnboardingStep('finish')).toBeUndefined();
    expect(previousOnboardingStep('community')).toBe('customer');
    expect(previousOnboardingStep('buildings')).toBe('community');
    expect(previousOnboardingStep('assets')).toBe('buildings');
    expect(previousOnboardingStep('finish')).toBe('assets');
    expect(previousOnboardingStep('customer')).toBeUndefined();
  });

  it('requires a complete Indian address and validates optional coordinates before location creation', () => {
    const address = {
      line1: '12 Main Road',
      locality: 'Whitefield',
      stateCode: 'KA',
      districtCode: 'BLR_URBAN',
      cityCode: 'BENGALURU',
      postalCode: '560066',
    };
    expect(validatePropertyAddress({ ...address, latitude: '', longitude: '' })).toEqual([]);
    expect(validatePropertyAddress({ ...address, postalCode: '56006' })).toContain('Enter a valid six-digit PIN code.');
    expect(validatePropertyAddress({ ...address, stateCode: '', districtCode: '', cityCode: '' })).toHaveLength(3);
    expect(validatePropertyAddress({ ...address, latitude: '12.9', longitude: '' })).toContain('Enter both latitude and longitude, or leave both blank.');
    expect(validatePropertyAddress({ ...address, latitude: '91', longitude: '77.5' })).toContain('Enter a latitude between -90 and 90.');
  });

  it('maps the verified Bangalore postal district label to the Bengaluru Urban reference entry', () => {
    expect(matchesIndiaReferenceName('Bengaluru Urban', 'Bangalore')).toBe(true);
    expect(matchesIndiaReferenceName('Bengaluru', 'Bangalore')).toBe(false);
    expect(matchesIndiaReferenceName('Bengaluru Rural', 'Bangalore Rural')).toBe(false);
  });

  it('detects duplicate location names without treating case or repeated spaces as unique', () => {
    expect(hasDuplicateLocationName(' Green   Meadows ', ['green meadows'])).toBe(true);
    expect(hasDuplicateLocationName('Green Meadows II', ['Green Meadows'])).toBe(false);
    expect(hasDuplicateLocationName(' ', ['Green Meadows'])).toBe(false);
  });

  it('allows a selected saved community to continue once it has a saved building', () => {
    expect(existingCommunityReady('', 1)).toBe(false);
    expect(existingCommunityReady('community-1', 0)).toBe(false);
    expect(existingCommunityReady('community-1', 1)).toBe(true);
  });

  it('supports multiple lift assets in one building while preventing a duplicate name there', () => {
    const existing = ['Tower A · Passenger Lift 01'];
    expect(elevatorAssetName('Tower A', 'Passenger Lift 02')).toBe('Tower A · Passenger Lift 02');
    expect(hasDuplicateElevatorAssetName('Tower A', 'Passenger Lift 01', existing)).toBe(true);
    expect(hasDuplicateElevatorAssetName('Tower A', 'Passenger Lift 02', existing)).toBe(false);
    expect(hasDuplicateElevatorAssetName('Tower B', 'Passenger Lift 01', existing)).toBe(false);
  });

  it('keeps PIN post-office choices distinct when names repeat in different districts', () => {
    const bangaloreOffice = { name: 'Main Office', district: 'Bengaluru Urban', state: 'Karnataka', office_type: 'HO', delivery_status: 'Delivery' };
    const ruralOffice = { ...bangaloreOffice, district: 'Bengaluru Rural' };
    expect(pincodeOfficeKey(bangaloreOffice)).not.toBe(pincodeOfficeKey(ruralOffice));
    expect(pincodeOfficeKey(bangaloreOffice)).toBe(pincodeOfficeKey({ ...bangaloreOffice }));
  });
});

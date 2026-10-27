export const onboardingStepOrder = [
  'customer',
  'community',
  'buildings',
  'assets',
  'finish',
] as const;

export type Step = (typeof onboardingStepOrder)[number];

export const onboardingStepLabels: Record<Step, string> = {
  customer: 'Customer',
  community: 'Community',
  buildings: 'Buildings',
  assets: 'Assets',
  finish: 'Contacts & access',
};

export function canVisitOnboardingStep(step: Step, furthestStep: number) {
  return onboardingStepOrder.indexOf(step) <= furthestStep;
}

export function nextOnboardingStep(step: Step): Step | undefined {
  return onboardingStepOrder[onboardingStepOrder.indexOf(step) + 1];
}

export function previousOnboardingStep(step: Step): Step | undefined {
  return onboardingStepOrder[onboardingStepOrder.indexOf(step) - 1];
}

export function hasDuplicateLocationName(name: string, existingNames: string[]) {
  const normalize = (value: string) => value.trim().normalize('NFKC').replace(/\s+/g, ' ').toLocaleLowerCase('en-IN');
  const candidate = normalize(name);
  return Boolean(candidate) && existingNames.some((existing) => normalize(existing) === candidate);
}

export function existingCommunityReady(communityId: string, buildingCount: number) {
  return Boolean(communityId.trim()) && buildingCount > 0;
}

export function elevatorAssetName(buildingName: string, assetName: string) {
  return `${buildingName.trim()} · ${assetName.trim()}`;
}

export function hasDuplicateElevatorAssetName(buildingName: string, assetName: string, existingNames: string[]) {
  return hasDuplicateLocationName(elevatorAssetName(buildingName, assetName), existingNames);
}

export function pincodeOfficeKey(office: {
  name: string;
  district: string;
  state: string;
  office_type?: string | null;
  delivery_status?: string | null;
}) {
  return JSON.stringify([office.name, office.district, office.state, office.office_type || '', office.delivery_status || '']);
}

export type PropertyAddress = {
  line1: string;
  locality: string;
  stateCode: string;
  districtCode: string;
  cityCode: string;
  postalCode: string;
  latitude?: string;
  longitude?: string;
};

export function validatePropertyAddress(address: PropertyAddress) {
  const issues: string[] = [];
  if (!address.line1.trim()) issues.push('Enter the address line.');
  if (!address.locality.trim()) issues.push('Enter the locality or area.');
  if (!address.stateCode) issues.push('Select a state or union territory.');
  if (!address.districtCode) issues.push('Select a district.');
  if (!address.cityCode) issues.push('Select a city or town.');
  if (!/^\d{6}$/.test(address.postalCode.trim())) issues.push('Enter a valid six-digit PIN code.');
  const hasLatitude = Boolean(address.latitude?.trim());
  const hasLongitude = Boolean(address.longitude?.trim());
  if (hasLatitude !== hasLongitude) issues.push('Enter both latitude and longitude, or leave both blank.');
  if (hasLatitude && (!Number.isFinite(Number(address.latitude)) || Number(address.latitude) < -90 || Number(address.latitude) > 90)) issues.push('Enter a latitude between -90 and 90.');
  if (hasLongitude && (!Number.isFinite(Number(address.longitude)) || Number(address.longitude) < -180 || Number(address.longitude) > 180)) issues.push('Enter a longitude between -180 and 180.');
  return issues;
}

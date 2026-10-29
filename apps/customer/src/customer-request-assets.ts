export function customerRequestAssetContext(locationName?: string | null, assetCode?: string | null, providerAccount?: string | null, locationCode?: string | null): string {
  return [providerAccount?.trim(), locationCode?.trim() ? `Site code ${locationCode.trim()}` : '', locationName?.trim() || 'Service location not supplied', assetCode?.trim() || 'Asset code not supplied'].filter(Boolean).join(' · ');
}

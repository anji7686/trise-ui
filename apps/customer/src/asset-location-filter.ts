import type { AssetAttributes, ProviderAttributes, Resource } from './data';
import { customerReadableName } from './coverage-list';
import { customerVisibleAddressText } from './customer-display';

export type AssetLocationOption = { id: string; name: string; label: string };

export function assetLocationOptions(
  assets: Resource<AssetAttributes>[],
  providers: Resource<ProviderAttributes>[],
): AssetLocationOption[] {
  const providerNames = new Map(providers.map((provider) => [provider.id, provider.attributes.display_name || 'Service provider']));
  const byId = new Map<string, { name: string; providerName: string; address: string; code: string }>();
  for (const asset of assets) {
    const id = asset.relationships.location && !Array.isArray(asset.relationships.location) ? asset.relationships.location.id : undefined;
    const name = asset.attributes.service_location_name ? customerReadableName(asset.attributes.service_location_name) : '';
    if (!id || !name) continue;
    byId.set(id, {
      name,
      providerName: providerNames.get(asset.attributes.provider_id) || 'Service provider',
      address: customerVisibleAddressText(asset.attributes.service_location_address),
      code: asset.attributes.service_location_code || '',
    });
  }

  const rows = [...byId].map(([id, value]) => ({ id, ...value }));
  const sameName = (name: string) => rows.filter((row) => row.name === name);
  const options = rows.map((row) => {
    const matching = sameName(row.name);
    let label = row.name;
    if (matching.length > 1) {
      const address = row.address;
      const matchingAddress = matching.filter((candidate) => candidate.address === address);
      if (address && matching.some((candidate) => candidate.address !== address)) label = `${label} · ${address}`;
      else if (row.code && matchingAddress.some((candidate) => candidate.code !== row.code)) label = `${label} · ${row.code}`;
      else label = `${label} · ${row.providerName}`;
    }
    return { id: row.id, name: row.name, label };
  });
  const labelCounts = new Map<string, number>();
  options.forEach(({ label }) => labelCounts.set(label, (labelCounts.get(label) || 0) + 1));
  return options.map((option) => labelCounts.get(option.label)! > 1
    ? { ...option, label: `${option.label} · ${rows.find((row) => row.id === option.id)?.code || 'Additional location'}` }
    : option).sort((left, right) => left.label.localeCompare(right.label));
}

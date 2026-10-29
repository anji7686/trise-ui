import type { ContractAttributes, Resource, WarrantyAttributes } from './data';

type ProviderName = string;
export type CoverageListRecord =
  | { kind: 'warranty'; providerId: string; providerName: ProviderName; resource: Resource<WarrantyAttributes> }
  | { kind: 'contract'; providerId: string; providerName: ProviderName; resource: Resource<ContractAttributes> };

export function customerPlanDisplayName(planName: string | undefined, recordName: string): string {
  const name = planName?.trim() || recordName.trim();
  if (!name || /^[a-z]+-[a-f0-9]{8,}$/i.test(name)) return 'Maintenance agreement';
  if (/^[A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(name)) {
    return name.split('_').map((part) => ['AMC', 'OEM', 'SLA'].includes(part) || /^\d+[A-Z]+$/.test(part) ? part : `${part[0]}${part.slice(1).toLowerCase()}`).join(' ');
  }
  return name;
}

export function warrantyDisplayName(recordName: string): string {
  const value = recordName.trim();
  if (/^(?:DEMO|TEST|QA)[-_].*(?:WARRANTY|WTY)(?:[-_].*)?$/i.test(value)) return 'Warranty coverage';
  return value || 'Warranty coverage';
}

export function coverageReferenceCode(kind: CoverageListRecord['kind'], recordName: string, planCode?: string): string {
  if (planCode?.trim()) return planCode.trim();
  return kind === 'warranty' && /^(?:DEMO|TEST|QA)[-_].*(?:WARRANTY|WTY)(?:[-_].*)?$/i.test(recordName.trim()) ? recordName.trim() : '';
}

export function coverageLiftDetailsFallback(coveredLiftCount: number | undefined, hasCustomerSummary: boolean): string {
  if (!hasCustomerSummary || coveredLiftCount === undefined) return 'Details not shared';
  if (coveredLiftCount === 0) return 'No covered lifts listed';
  if (coveredLiftCount > 0) return `${coveredLiftCount} covered lift${coveredLiftCount === 1 ? '' : 's'}; names not shared`;
  return 'Details not shared';
}

export function customerCoverageStatus(status: string, effectiveFrom?: string | null, effectiveTo?: string | null, now = new Date()): string {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'active') {
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const startDay = effectiveFrom?.slice(0, 10);
    const endDay = effectiveTo?.slice(0, 10);
    if (startDay && /^\d{4}-\d{2}-\d{2}$/.test(startDay) && startDay > today) return 'upcoming';
    if (endDay && /^\d{4}-\d{2}-\d{2}$/.test(endDay) && endDay < today) return 'expired';
  }
  return normalized.replaceAll('_', ' ');
}

export function customerReadableName(value: string): string {
  const name = value.trim();
  if (/^codex flow verification(?:\s+\d{8,})?(?:\s*[·—-].*)?$/i.test(name)) return 'Service location';
  const readable = name.replace(/\s+\d{10,}$/, '').trim();
  return readable || name;
}

export function coverageListRecords(
  warranties: Array<{ providerId: string; providerName: ProviderName; resource: Resource<WarrantyAttributes> }>,
  contracts: Array<{ providerId: string; providerName: ProviderName; resource: Resource<ContractAttributes> }>,
): CoverageListRecord[] {
  const sorted = [
    ...warranties.map((item): CoverageListRecord => ({ ...item, kind: 'warranty' })),
    ...contracts.map((item): CoverageListRecord => ({ ...item, kind: 'contract' })),
  ].sort((left, right) => (right.resource.attributes.effective_from || '').localeCompare(left.resource.attributes.effective_from || '') || left.resource.id.localeCompare(right.resource.id));
  const warrantyRecords = sorted.filter((record) => record.kind === 'warranty');
  const contractRecords = sorted.filter((record) => record.kind === 'contract');
  const interleaved: CoverageListRecord[] = [];
  for (let index = 0; index < Math.max(warrantyRecords.length, contractRecords.length); index += 1) {
    if (warrantyRecords[index]) interleaved.push(warrantyRecords[index]);
    if (contractRecords[index]) interleaved.push(contractRecords[index]);
  }
  return interleaved;
}

export function filterCoverageRecords(records: CoverageListRecord[], query: string, status: string, warrantyAssetNames: Record<string, string> = {}): CoverageListRecord[] {
  const needle = query.trim().toLocaleLowerCase();
  return records.filter((record) => {
    const attributes = record.resource.attributes;
    const summary = record.kind === 'contract' ? record.resource.attributes.customer_safe_summary : undefined;
    const displayName = record.kind === 'contract' ? customerPlanDisplayName(summary?.plan_name, attributes.name) : warrantyDisplayName(attributes.name);
    const coveredAssets = record.kind === 'contract'
      ? (summary?.covered_assets || []).map((asset) => customerReadableName(asset.display_name))
      : (() => {
        const relationship = record.resource.relationships.asset;
        const asset = Array.isArray(relationship) ? relationship[0] : relationship;
        const name = asset?.id ? warrantyAssetNames[`${record.providerId}:${asset.id}`] : undefined;
        return name ? [name] : [];
      })();
    const matchesStatus = !status || customerCoverageStatus(attributes.status, attributes.effective_from, attributes.effective_to).toLocaleLowerCase() === status.toLocaleLowerCase();
    const searchable = [
      displayName,
      attributes.name,
      attributes.status,
      attributes.effective_from,
      attributes.effective_to,
      record.providerName,
      summary?.plan_name,
      summary?.plan_code,
      ...coveredAssets,
    ].filter(Boolean).join(' ').toLocaleLowerCase();
    return matchesStatus && (!needle || searchable.includes(needle));
  });
}

export function coverageStatuses(records: CoverageListRecord[]): string[] {
  return [...new Set(records.map((record) => customerCoverageStatus(record.resource.attributes.status, record.resource.attributes.effective_from, record.resource.attributes.effective_to)))].sort((left, right) => left.localeCompare(right));
}

export function visibleCoverageRecords(records: CoverageListRecord[], limit: number): CoverageListRecord[] {
  return records.slice(0, limit);
}

export function coverageCountLabel(visibleCount: number, loadedMatchCount: number, hasMorePages: boolean): string {
  const shown = `${visibleCount} of ${loadedMatchCount} loaded`;
  return hasMorePages ? `${shown} · more pages available` : shown;
}

export function coverageEmptyMessage(query: string, status: string, hasMorePages: boolean): string {
  if (query.trim() || status) {
    return hasMorePages
      ? 'No matches in the coverage loaded so far. Load more to check older records.'
      : 'No coverage records match these filters.';
  }
  return 'No warranty or maintenance coverage is available yet.';
}


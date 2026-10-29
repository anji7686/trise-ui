export type ConfirmedAssetVisit = {
  providerId: string;
  assetId: string;
  summary: string;
  startsAt: string;
  status: string;
};
export type CustomerAssetCoverageEntry = {
  providerId: string;
  kind: 'AMC' | 'Warranty';
  status: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  assetId: string;
};

export const customerAssetKey = (providerId: string, assetId: string) => `${providerId}:${assetId}`;

export function customerUpcomingBookingWindow(now = Date.now()): { startsAtGte: string; startsAtLt: string } {
  const startsAtGte = new Date(now).toISOString();
  const startsAtLt = new Date(now + 31 * 86_400_000).toISOString();
  return { startsAtGte, startsAtLt };
}

export function assetLocationFilterFromHash(hash: string): string {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : hash.replace(/^#\/?/, '');
  return new URLSearchParams(query).get('location_id')?.trim() || '';
}

export function customerAssetPlaceLabel(placeName?: string | null, siteCode?: string | null): string {
  return [placeName?.trim(), siteCode?.trim() ? `Site code ${siteCode.trim()}` : ''].filter(Boolean).join(' · ') || 'Not supplied';
}

/** Keep the earliest future confirmed visit for each authorized provider/asset pair. */
export function nextConfirmedAssetVisits(visits: ConfirmedAssetVisit[], now = Date.now()) {
  const nextByAsset = new Map<string, ConfirmedAssetVisit>();
  for (const visit of visits) {
    const startsAt = Date.parse(visit.startsAt);
    if (!Number.isFinite(startsAt) || startsAt <= now || !['CONFIRMED', 'SCHEDULED', 'RESCHEDULED'].includes(visit.status.toUpperCase())) continue;
    const key = customerAssetKey(visit.providerId, visit.assetId);
    const current = nextByAsset.get(key);
    if (!current || startsAt < Date.parse(current.startsAt)) nextByAsset.set(key, visit);
  }
  return nextByAsset;
}

export function customerAssetCoverageLabels(entries: CustomerAssetCoverageEntry[], providerId: string, assetId: string, now = Date.now()) {
  const active = entries.filter((entry) => {
    if (entry.providerId !== providerId || entry.assetId !== assetId || entry.status.toUpperCase() !== 'ACTIVE') return false;
    if (entry.effectiveFrom) {
      const startsAt = Date.parse(entry.effectiveFrom);
      if (!Number.isFinite(startsAt) || startsAt > now) return false;
    }
    if (entry.effectiveTo) {
      const endsAt = Date.parse(entry.effectiveTo);
      if (!Number.isFinite(endsAt) || endsAt < now) return false;
    }
    return true;
  });
  return [...new Set(active.map((entry) => `${entry.kind} active`))].sort((left, right) => left.localeCompare(right));
}

export function customerAssetCoverageSummary(
  entries: CustomerAssetCoverageEntry[],
  providerId: string,
  assetId: string,
  options: { failed?: boolean; hasMore?: boolean; loading?: boolean; now?: number } = {},
) {
  const labels = customerAssetCoverageLabels(entries, providerId, assetId, options.now);
  if (labels.length) return labels.join(' · ');
  if (options.loading) return 'Loading coverage…';
  if (options.failed) return 'Coverage unavailable';
  if (options.hasMore) return 'Coverage status not confirmed';
  return 'Coverage not listed';
}

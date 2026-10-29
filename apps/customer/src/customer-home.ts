import type { AssetAttributes, BookingAttributes, ContractAttributes, QuotationAttributes, Resource, ServiceJobAttributes, WarrantyAttributes } from './data';
import { quotationNeedsCustomerDecision } from './quotation-review';
import { customerReadableName } from './coverage-list';
import { customerVisibleAddressLines } from './customer-display';

const activeServiceStates = new Set(['CREATED', 'SCHEDULED', 'ON_THE_WAY', 'ARRIVED', 'WORK_STARTED', 'IN_PROGRESS']);
const activeCoverageStates = new Set(['ACTIVE', 'CURRENT', 'IN_FORCE']);

export function activeServiceCount(jobs: Array<Resource<ServiceJobAttributes>>): number {
  return jobs.filter((job) => activeServiceStates.has(job.attributes.status.toUpperCase())).length;
}

function currentCoverage(attributes: WarrantyAttributes | ContractAttributes, now: Date): boolean {
  if (!activeCoverageStates.has(attributes.status.toUpperCase())) return false;
  if (!attributes.effective_to) return true;
  const end = Date.parse(attributes.effective_to);
  return Number.isFinite(end) && end >= now.getTime();
}

export function activeCoverageCount(
  warranties: Array<Resource<WarrantyAttributes>>,
  contracts: Array<Resource<ContractAttributes>>,
  now = new Date(),
): number {
  return warranties.filter((record) => currentCoverage(record.attributes, now)).length
    + contracts.filter((record) => currentCoverage(record.attributes, now)).length;
}

export function nextConfirmedBookingForAsset(
  assetId: string,
  bookings: Array<{ booking: Resource<BookingAttributes>; providerId: string }>,
  now = new Date(),
) {
  return bookings.filter(({ booking }) => {
    if (!['CONFIRMED', 'RESCHEDULED'].includes(booking.attributes.status.toUpperCase())) return false;
    const start = Date.parse(booking.attributes.requested_window.starts_at);
    if (!Number.isFinite(start) || start < now.getTime()) return false;
    const relation = booking.relationships.asset;
    const linkedAsset = Array.isArray(relation) ? relation[0]?.id : relation?.id;
    return linkedAsset === assetId;
  }).sort((left, right) => Date.parse(left.booking.attributes.requested_window.starts_at)
    - Date.parse(right.booking.attributes.requested_window.starts_at)
    || left.booking.id.localeCompare(right.booking.id))[0];
}

export function customerAssetCoverageLabel(
  assetId: string,
  warranties: Array<Resource<WarrantyAttributes>>,
  contracts: Array<Resource<ContractAttributes>>,
  now = new Date(),
): string | undefined {
  const current = (attributes: WarrantyAttributes | ContractAttributes) => {
    if (!activeCoverageStates.has(attributes.status.toUpperCase())) return false;
    const starts = attributes.effective_from ? Date.parse(attributes.effective_from) : Number.NEGATIVE_INFINITY;
    const ends = attributes.effective_to ? Date.parse(attributes.effective_to) : Number.POSITIVE_INFINITY;
    return Number.isFinite(starts) || starts === Number.NEGATIVE_INFINITY
      ? (Number.isFinite(ends) || ends === Number.POSITIVE_INFINITY) && starts <= now.getTime() && ends >= now.getTime()
      : false;
  };
  if (contracts.some(({ attributes }) => current(attributes) && attributes.customer_safe_summary?.covered_assets?.some((asset) => asset.asset_id === assetId && asset.status.toUpperCase() === 'ACTIVE'))) return 'AMC active';
  if (warranties.some((warranty) => {
    const relation = warranty.relationships.asset;
    const linkedAsset = Array.isArray(relation) ? relation[0]?.id : relation?.id;
    return linkedAsset === assetId && current(warranty.attributes);
  })) return 'Warranty active';
  return undefined;
}

export function customerAssetCoverageStatus(
  assetId: string,
  warranties: Array<Resource<WarrantyAttributes>> | null,
  contracts: Array<Resource<ContractAttributes>> | null,
  state: { loading?: boolean; failed?: boolean; hasMore?: boolean } = {},
  now = new Date(),
): string {
  if (state.loading || (!warranties && !state.failed) || (!contracts && !state.failed)) return 'Checking coverage…';
  const currentLabel = customerAssetCoverageLabel(assetId, warranties || [], contracts || [], now);
  if (currentLabel) return currentLabel;
  if (state.failed || !warranties || !contracts) return 'Coverage unavailable';
  return state.hasMore ? 'Coverage status not confirmed' : 'Coverage not listed';
}

export function homeAssetLocation(attributes: AssetAttributes): string {
  return [attributes.service_location_name ? customerReadableName(attributes.service_location_name) : '', attributes.service_location_code ? `Site code ${attributes.service_location_code}` : '', ...customerVisibleAddressLines(attributes.service_location_address)]
    .filter(Boolean)
    .join(' · ');
}

export function customerDecisionQuotes(quotes: Array<{ providerId: string; quote: Resource<QuotationAttributes> }>) {
  return quotes.filter(({ quote }) => quotationNeedsCustomerDecision(quote.attributes))
    .sort((left, right) => {
      const leftExpiry = left.quote.attributes.valid_until ? Date.parse(left.quote.attributes.valid_until) : Number.MAX_SAFE_INTEGER;
      const rightExpiry = right.quote.attributes.valid_until ? Date.parse(right.quote.attributes.valid_until) : Number.MAX_SAFE_INTEGER;
      return leftExpiry - rightExpiry || left.quote.id.localeCompare(right.quote.id);
    });
}

export function customerHomeProviderName(providerId: string, providers: Array<{ id: string; attributes: { display_name?: string } }>, quoteProviderName?: string): string {
  return providers.find((provider) => provider.id === providerId)?.attributes.display_name?.trim()
    || quoteProviderName?.trim()
    || 'Service provider';
}

export function homeCountLabel(count: number, hasMore: boolean): string {
  return `${count}${hasMore ? '+' : ''}`;
}

export function customerGreeting(displayName: string, now = new Date()): string {
  const firstName = displayName.trim().split(/\s+/)[0] || 'there';
  const hour = Number(new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(now));
  const greeting = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${greeting}, ${firstName}.`;
}

export function customerHomeDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(now).toLocaleUpperCase('en-IN');
}

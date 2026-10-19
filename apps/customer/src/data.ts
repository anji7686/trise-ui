import { apiClient } from '@trise/api-client';

export type Link = { id: string; type: string };
export type Resource<T> = { id: string; type: string; attributes: T; relationships: Record<string, Link | Link[] | null | undefined> };
export type Collection<T> = { data: Resource<T>[]; page?: { next?: string | null; previous?: string | null } };
export type AssetAttributes = { name: string; status: string; provider_id: string; definition_version: number; revision: number; created_at: string; identifiers?: Array<{ value?: string; kind?: string }> };
export type ProviderAttributes = { display_name: string; representation?: string };
export type ServiceTypeAttributes = { name?: string; code?: string; status?: string; revision?: number };
export type LocationAttributes = { name?: string; location_kind?: string; timezone_name?: string; address?: { lines?: string[] }; latitude?: number | null; longitude?: number | null };
export type BookingAttributes = { summary: string; status: string; revision: number; requested_window: { starts_at: string; ends_at: string; time_zone: string } };
export type ServiceRequestAttributes = { summary: string; description?: string; status: string; revision: number; created_at: string };
export type RequestAttributes = { summary: string; description?: string; status: string; revision: number; created_at: string };
export type ServiceJobAttributes = { summary?: string; status: string; revision: number; scheduled_window?: { start_at?: string; end_at?: string; timezone_name?: string } };
export type InstallationProjectAttributes = { title: string; status: string; revision: number; project_classification_key?: string | null; progress_percent: number; stage_count: number; completed_stage_count: number; project_assets?: Array<{ id: string; display_name: string; role: string; status: string }>; unit_progress?: Array<{ asset_id: string; stage_count: number; completed_stage_count: number; progress_percent: number }>; stages?: Array<{ id: string; code: string; title: string; status: string; mandatory: boolean; asset_id?: string | null }> };
export type NotificationAttributes = { category: string; title: string; body: string; read_at?: string | null };
export type QuotationLine = { description: string; quantity: string; unit_price: string; amount: string };
export type QuotationAttributes = { status: string; currency: string; lines: QuotationLine[]; total: string; revision: number };
export type UserAttributes = { display_name?: string; locale?: string | null; revision: number };
export type WarrantyAttributes = { name: string; status: string; effective_from?: string | null; effective_to?: string | null; revision: number };
export type ContractAttributes = { name: string; status: string; version: number; effective_from?: string | null; effective_to?: string | null; revision: number };
export type DocumentAttributes = { filename: string; media_type: string; size_bytes: number; checksum: string; classification: string; status: string; scan_state: string; scan_reason?: string | null; scan_recorded_at?: string | null; revision: number; visibility: string };
export type DocumentVersionAttributes = { version: number; filename: string; media_type: string; size_bytes: number; checksum: string; scan_state: string; scan_reason?: string | null; scan_recorded_at?: string | null };

export function buildBookingPayload(input: { summary: string; customerRelationshipId: string; assetId: string; locationId: string; serviceTypeId: string; startsAt: string; endsAt: string; timeZone: string }) {
  return { summary: input.summary, customer_relationship_id: input.customerRelationshipId, asset_id: input.assetId, location_id: input.locationId, service_type_id: input.serviceTypeId, requested_window: { starts_at: input.startsAt, ends_at: input.endsAt, time_zone: input.timeZone } };
}

const query = (path: string, providerId?: string) => apiClient.request(path, {}, { providerId });
function normalizeCollection<T>(payload: { data: Array<Resource<T> | { data: Resource<T> }>; page?: Collection<T>['page'] }): Collection<T> {
  return { ...payload, data: payload.data.map((item) => 'data' in item ? item.data : item) };
}
export const customerData = {
  me: () => apiClient.request<Resource<UserAttributes>>('/me'),
  updateMe: (body: Record<string, unknown>) => apiClient.request<Resource<UserAttributes>>('/me', { method: 'PATCH', body: JSON.stringify(body) }),
  providers: () => query('/providers') as Promise<Collection<ProviderAttributes>>,
  customers: (providerId: string) => query('/customers?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<{ display_name: string }>>,
  assets: (providerId: string) => query('/assets?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<AssetAttributes>>,
  asset: (providerId: string, id: string) => query(`/assets/${encodeURIComponent(id)}`, providerId) as Promise<Resource<AssetAttributes>>,
  serviceTypes: (providerId: string) => query('/service-types?page[limit]=100&sort=-created_at,id', providerId) as Promise<Collection<ServiceTypeAttributes>>,
  location: (providerId: string, id: string) => query(`/locations/${encodeURIComponent(id)}`, providerId) as Promise<Resource<LocationAttributes>>,
  requests: (providerId: string) => query('/service-requests?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<RequestAttributes>>,
  request: (providerId: string, id: string) => query(`/service-requests/${encodeURIComponent(id)}`, providerId) as Promise<Resource<ServiceRequestAttributes>>,
  bookings: (providerId: string) => query('/service-bookings?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<BookingAttributes>>,
  jobs: (providerId: string) => query('/service-jobs?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<ServiceJobAttributes>>,
  installationProjects: async (providerId: string) => normalizeCollection<InstallationProjectAttributes>(await query('/service-cases?page[limit]=25&sort=-created_at,id', providerId) as { data: Array<Resource<InstallationProjectAttributes> | { data: Resource<InstallationProjectAttributes> }>; page?: Collection<InstallationProjectAttributes>['page'] }),
  notifications: (providerId: string) => query('/notifications?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<NotificationAttributes>>,
  markNotificationRead: (providerId: string, id: string, key: string) => apiClient.request<Resource<NotificationAttributes>>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', headers: { 'Idempotency-Key': key } }, { providerId }),
  quotations: (providerId: string) => query('/quotations?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<QuotationAttributes>>,
  quotation: (providerId: string, id: string) => query(`/quotations/${encodeURIComponent(id)}`, providerId) as Promise<Resource<QuotationAttributes>>,
  approveQuotation: (providerId: string, id: string, expectedRevision: number, key: string) => apiClient.request<Resource<QuotationAttributes>>(`/quotations/${encodeURIComponent(id)}/approve`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ expected_revision: expectedRevision }) }, { providerId }),
  rejectQuotation: (providerId: string, id: string, expectedRevision: number, reason: string, key: string) => apiClient.request<Resource<QuotationAttributes>>(`/quotations/${encodeURIComponent(id)}/reject`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ expected_revision: expectedRevision, reason }) }, { providerId }),
  warranties: (providerId: string) => query('/warranties?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<WarrantyAttributes>>,
  contracts: (providerId: string) => query('/maintenance-contracts?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<ContractAttributes>>,
  documents: (providerId: string) => query('/documents?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<DocumentAttributes>>,
  document: (providerId: string, id: string) => query(`/documents/${encodeURIComponent(id)}`, providerId) as Promise<Resource<DocumentAttributes>>,
  documentVersions: (providerId: string, id: string) => query(`/documents/${encodeURIComponent(id)}/versions?page[limit]=25&sort=-created_at,id`, providerId) as Promise<Collection<DocumentVersionAttributes>>,
  createDocument: (providerId: string, body: Record<string, unknown>, key: string) => apiClient.request<{ document: Resource<DocumentAttributes>; version: Resource<DocumentVersionAttributes>; transfer: { url: string; method: string; headers: Record<string, string>; expires_at: string } }>(`/documents`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId }),
  finalizeDocument: (providerId: string, id: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<DocumentAttributes>>(`/documents/${encodeURIComponent(id)}/upload-finalization`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId }),
  authorizeDownload: (providerId: string, id: string, body: Record<string, unknown>) => apiClient.request<{ url: string; expires_at: string; expires_in: number }>(`/documents/${encodeURIComponent(id)}/download`, { method: 'POST', body: JSON.stringify(body) }, { providerId }),
  resolveIdentifier: (providerId: string, identifier: string) => apiClient.request<{ status: string; resource_type: string; resource?: Resource<AssetAttributes> }>('/identifier-resolutions', { method: 'POST', body: JSON.stringify({ identifier, resource_hint: 'auto', provider_context_id: providerId }) }, { providerId }),
  createRequest: (providerId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<RequestAttributes>>('/service-requests', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId }),
  createBooking: (providerId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<BookingAttributes>>('/service-bookings', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
};

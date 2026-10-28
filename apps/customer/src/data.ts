import { apiClient } from '@trise/api-client';

export type Link = { id: string; type: string };
export type Resource<T> = { id: string; type: string; attributes: T; relationships: Record<string, Link | Link[] | null | undefined> };
export type Collection<T> = { data: Resource<T>[]; page?: { next?: string | null; previous?: string | null } };
export type CollectionPage = { limit?: number; after?: string };
export type AssetAttributes = { name: string; status: string; provider_id: string; definition_version: number; revision: number; created_at: string; identifiers?: Array<{ value?: string; kind?: string }> };
export type ProviderAttributes = { display_name: string; representation?: string };
export type ServiceTypeAttributes = { name?: string; code?: string; status?: string; revision?: number };
export type LocationAttributes = { name?: string; location_kind?: string; timezone_name?: string; address?: { lines?: string[] }; latitude?: number | null; longitude?: number | null };
export type BookingAttributes = { summary: string; status: string; revision: number; requested_window: { starts_at: string; ends_at: string; time_zone: string } };
export type ServiceRequestAttributes = { summary: string; description?: string; status: string; revision: number; created_at: string };
export type RequestAttributes = { summary: string; description?: string; status: string; revision: number; created_at: string };
export type ServiceJobAttributes = { summary?: string; status: string; revision: number; scheduled_window?: { start_at?: string; end_at?: string; timezone_name?: string } };
export type InstallationProjectAttributes = { title: string; status: string; revision: number; project_classification_key?: string | null; progress_percent: number; stage_count: number; completed_stage_count: number; project_assets?: Array<{ id: string; display_name: string; role: string; status: string }>; unit_progress?: Array<{ asset_id: string; stage_count: number; completed_stage_count: number; progress_percent: number }>; stages?: Array<{ id: string; code: string; title: string; status: string; mandatory: boolean; asset_id?: string | null }>; handover_events?: Array<{ id: string; event_kind: string; asset_id?: string | null; service_case_revision?: number; occurred_at?: string | null }> };
export type NotificationAttributes = { category: string; title: string; body: string; read_at?: string | null; created_at?: string | null };
export type QuotationLine = { description: string; quantity: string; unit_price: string; amount: string; tax_amount?: string; taxable_amount?: string; amc?: Record<string, unknown>; unit_codes?: string[] };
export type QuotationAttributes = { status: string; currency: string; lines: QuotationLine[]; total: string; revision: number; quotation_number?: string; provider_name?: string; customer_relationship_name?: string | null; issued_at?: string | null; valid_until?: string | null; subtotal?: string; discount_total?: string; tax_total?: string; provider_review?: { decision: string; quotation_revision: number; decided_at: string; reason?: string | null } | null; customer_approval?: { mode?: string; status?: string; accepted_at?: string }; terms?: Record<string, unknown> };
export type QuotationApprovalAttributes = { decision: string; decided_at: string; quotation_revision: number; reason?: string; approver_name?: string; approver_role?: string };
export type QuotationCommunicationAttributes = { quotation_revision: number; author_side: 'customer' | 'provider'; message_type: 'question' | 'change_request' | 'reply'; body: string; created_at: string; author_name: string };
export type UserAttributes = { display_name?: string; locale?: string | null; revision: number };
export type WarrantyAttributes = { name: string; status: string; effective_from?: string | null; effective_to?: string | null; revision: number };
export type ContractAttributes = { name: string; status: string; version: number; effective_from?: string | null; effective_to?: string | null; revision: number; customer_safe_summary?: { plan_name?: string; plan_code?: string; plan_version?: number; covered_elevator_count?: number; preventive_frequency?: string; scheduled_visits?: number; service_priority?: string } };
export type DocumentAttributes = { filename: string; media_type: string; size_bytes: number; checksum: string; classification: string; status: string; scan_state: string; scan_reason?: string | null; scan_recorded_at?: string | null; revision: number; visibility: string };
export type DocumentVersionAttributes = { version: number; filename: string; media_type: string; size_bytes: number; checksum: string; scan_state: string; scan_reason?: string | null; scan_recorded_at?: string | null };

export function buildBookingPayload(input: { summary: string; customerRelationshipId: string; assetId: string; locationId: string; serviceTypeId: string; startsAt: string; endsAt: string }) {
  return { summary: input.summary, customer_relationship_id: input.customerRelationshipId, asset_id: input.assetId, location_id: input.locationId, service_type_id: input.serviceTypeId, requested_window: { starts_at: input.startsAt, ends_at: input.endsAt } };
}

const query = (path: string, providerId?: string) => apiClient.request(path, {}, { providerId });
const pagedPath = (path: string, page: CollectionPage = {}, sort = '-created_at,id') => {
  const params = new URLSearchParams({ 'page[limit]': String(page.limit ?? 10), sort });
  if (page.after) params.set('page[after]', page.after);
  return `${path}?${params.toString()}`;
};
function normalizeCollection<T>(payload: { data: Array<Resource<T> | { data: Resource<T> }>; page?: Collection<T>['page'] }): Collection<T> {
  return { ...payload, data: payload.data.map((item) => 'data' in item ? item.data : item) };
}
export const customerData = {
  me: () => apiClient.request<Resource<UserAttributes>>('/me'),
  updateMe: (body: Record<string, unknown>) => apiClient.request<Resource<UserAttributes>>('/me', { method: 'PATCH', body: JSON.stringify(body) }),
  providers: () => query('/providers') as Promise<Collection<ProviderAttributes>>,
  customers: (providerId: string) => query('/customers?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<{ display_name: string }>>,
  assets: (providerId: string, page?: CollectionPage) => query(pagedPath('/assets', page), providerId) as Promise<Collection<AssetAttributes>>,
  asset: (providerId: string, id: string) => query(`/assets/${encodeURIComponent(id)}`, providerId) as Promise<Resource<AssetAttributes>>,
  serviceTypes: (providerId: string) => query('/service-types?page[limit]=100&sort=-created_at,id', providerId) as Promise<Collection<ServiceTypeAttributes>>,
  location: (providerId: string, id: string) => query(`/locations/${encodeURIComponent(id)}`, providerId) as Promise<Resource<LocationAttributes>>,
  requests: (providerId: string, page?: CollectionPage) => query(pagedPath('/service-requests', page), providerId) as Promise<Collection<RequestAttributes>>,
  request: (providerId: string, id: string) => query(`/service-requests/${encodeURIComponent(id)}`, providerId) as Promise<Resource<ServiceRequestAttributes>>,
  bookings: (providerId: string, page?: CollectionPage) => query(pagedPath('/service-bookings', page), providerId) as Promise<Collection<BookingAttributes>>,
  jobs: (providerId: string) => query('/service-jobs?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<ServiceJobAttributes>>,
  installationProjects: async (providerId: string) => normalizeCollection<InstallationProjectAttributes>(await query('/service-cases?page[limit]=25&sort=-created_at,id', providerId) as { data: Array<Resource<InstallationProjectAttributes> | { data: Resource<InstallationProjectAttributes> }>; page?: Collection<InstallationProjectAttributes>['page'] }),
  acceptHandover: (providerId: string, caseId: string, body: Record<string, unknown>, key: string) => apiClient.request<{ data: Resource<{ event_kind: string; asset_id?: string | null; service_case_revision?: number; occurred_at?: string | null }> }>(`/service-cases/${encodeURIComponent(caseId)}/handover/accept`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId }).then((payload) => payload.data),
  notifications: (providerId: string, force = false) => apiClient.request<Collection<NotificationAttributes>>('/notifications?page[limit]=25&sort=-created_at,id', {}, { providerId, cacheTtlMs: 15_000, forceRefresh: force }),
  markNotificationRead: (providerId: string, id: string, key: string) => apiClient.request<Resource<NotificationAttributes>>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', headers: { 'Idempotency-Key': key } }, { providerId }),
  quotations: (providerId: string) => query('/quotations?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<QuotationAttributes>>,
  quotation: (providerId: string, id: string) => query(`/quotations/${encodeURIComponent(id)}`, providerId) as Promise<Resource<QuotationAttributes>>,
  quotationApprovals: (providerId: string, id: string) => query(`/quotations/${encodeURIComponent(id)}/approvals?page[limit]=25`, providerId) as Promise<Collection<QuotationApprovalAttributes>>,
  approveQuotation: (providerId: string, id: string, expectedRevision: number, key: string, evidence: { approver_name: string; approver_role: string; authority_attested: true }) => apiClient.request<Resource<QuotationAttributes>>(`/quotations/${encodeURIComponent(id)}/approve`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ expected_revision: expectedRevision, ...evidence }) }, { providerId }),
  quotationCommunications: (providerId: string, id: string) => query(`/quotations/${encodeURIComponent(id)}/communications?page[limit]=100&sort=created_at,id`, providerId) as Promise<Collection<QuotationCommunicationAttributes>>,
  createQuotationCommunication: (providerId: string, id: string, body: { expected_revision: number; message_type: 'QUESTION' | 'CHANGE_REQUEST'; body: string }, key: string) => apiClient.request<Resource<QuotationCommunicationAttributes>>(`/quotations/${encodeURIComponent(id)}/communications`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId }),
  quotationProviderLogo: (providerId: string, id: string) => query(`/quotations/${encodeURIComponent(id)}/provider-logo`, providerId) as Promise<{ data: { quotation_id: string; media_type: string; filename: string }; transfer: { url: string } }>,
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

import { apiClient } from '@trise/api-client';

export type Link = { id: string; type: string };
export type Resource<T> = { id: string; type: string; attributes: T; relationships: Record<string, Link | Link[] | null | undefined> };
export type Collection<T> = { data: Resource<T>[]; page?: { next?: string | null; previous?: string | null } };
export type CollectionPage = { limit?: number; after?: string };
export type AssetAttributes = { name: string; status: string; provider_id: string; definition_version: number; revision: number; created_at: string; service_location_name?: string; service_location_code?: string; service_location_address?: string[]; identifiers?: Array<{ value?: string; kind?: string }> };
export function assetDisplaySubtitle(identifier?: string | null): string {
  return identifier?.trim() || 'Asset code not supplied';
}
export type ProviderAttributes = { display_name: string; representation?: string };
export type ProviderSupportContact = { id: string; type: 'provider-support-contacts'; attributes: { provider_id: string; provider_name: string; display_name: string; contact_methods: { email?: string; mobile?: string; landline?: string } } };
export type ServiceTypeAttributes = { name?: string; code?: string; status?: string; revision?: number };
export type LocationAttributes = { provider_id?: string; name?: string; classification?: string; address_lines?: string[]; address_references?: Record<string, string>; time_zone?: string; latitude?: number | null; longitude?: number | null; service_location_code?: string; service_location_type?: string; service_location_status?: string; revision?: number; created_at?: string };
export type ResourceMembershipAttributes = { role?: string; inheritance_mode?: string; capabilities?: string[]; status?: string; member_display_name?: string; effective_from?: string; effective_to?: string | null; revoked_at?: string | null };
export type MembershipInvitationAttributes = { status: string; role: string; capabilities: string[]; effective_from: string; effective_to?: string | null; expires_at: string; revision: number; can_accept?: boolean };
export type ServiceLocationAttributes = { service_location_code?: string; location_type?: string; display_name?: string; status?: string; revision?: number };
export type NotificationPreferenceAttributes = { category: string; channel: string; enabled: boolean; revision: number; provider_id?: string };
export type NotificationPreferenceOption = { category: string; channel: string; enabled: boolean; preference_id: string | null; revision: number | null; provider_id: string };
export type TimelineEntryAttributes = { created_at: string; provider_id: string; event_name: string; occurred_at: string; summary: string };
export type BookingAttributes = { summary: string; status: string; revision: number; created_at?: string; service_request_reference_code?: string; requested_window: { starts_at: string; ends_at: string; time_zone: string }; scheduled_window?: { starts_at: string; ends_at: string; time_zone: string } | null };
export type ServiceRequestAttributes = { summary: string; description?: string; status: string; reference_code?: string; revision: number; created_at: string };
export type RequestAttributes = { summary: string; description?: string; status: string; reference_code?: string; customer_emergency_signal?: boolean; revision: number; created_at: string };
export type PreferredWindowSlot = '09:00-12:00' | '12:00-15:00' | '15:00-18:00' | 'ASAP';
export function buildPreferredWindow(date: string, slot: PreferredWindowSlot): { starts_at: string; ends_at: string } | undefined {
  if (slot === 'ASAP') return undefined;
  const [start, end] = slot.split('-');
  return {
    starts_at: new Date(`${date}T${start}:00+05:30`).toISOString(),
    ends_at: new Date(`${date}T${end}:00+05:30`).toISOString(),
  };
}
export type ServiceJobAttributes = { summary?: string; status: string; customer_status?: string; revision: number; created_at?: string; completed_at?: string | null; eta_at?: string | null; assigned_technician?: { display_name: string } | null; scheduled_window?: { starts_at?: string; ends_at?: string; time_zone?: string } | null; historical_location?: { name?: string; service_location_name?: string; address?: string; address_lines?: string[]; service_location_id?: string; [key: string]: unknown } | null };
export type InstallationProjectAttributes = { title: string; status: string; revision: number; project_classification_key?: string | null; source_quotation_id?: string | null; service_location_name?: string | null; progress_percent: number; stage_count: number; completed_stage_count: number; project_assets?: Array<{ id: string; display_name: string; role: string; status: string }>; unit_progress?: Array<{ asset_id: string; stage_count: number; completed_stage_count: number; progress_percent: number }>; stages?: Array<{ id: string; code: string; title: string; status: string; mandatory: boolean; asset_id?: string | null }>; handover_events?: Array<{ id: string; event_kind: string; asset_id?: string | null; service_case_revision?: number; evidence_count?: number; evidence_documents?: Array<{ id: string; filename: string; media_type: string; classification: string; created_at?: string | null }>; occurred_at?: string | null }> };
export type NotificationAttributes = { category: string; title: string; body: string; read_at?: string | null; created_at?: string | null };
export type QuotationLine = { description: string; quantity: string; unit_price: string; amount: string; tax_amount?: string; taxable_amount?: string; amc?: Record<string, unknown>; unit_codes?: string[] };
export type QuotationAttributes = { status: string; currency: string; lines: QuotationLine[]; total: string; revision: number; quotation_number?: string; provider_name?: string; customer_relationship_name?: string | null; issued_at?: string | null; valid_until?: string | null; subtotal?: string; discount_total?: string; tax_total?: string; tax_summary?: { status: string; tax_total: string; components: Array<{ code: string; amount: string }> }; provider_review?: { decision: string; quotation_revision: number; decided_at: string; reason?: string | null } | null; customer_approval?: { mode?: string; status?: string; accepted_at?: string }; terms?: Record<string, unknown> };
export type QuotationApprovalAttributes = { decision: string; decided_at: string; quotation_revision: number; reason?: string; approver_name?: string; approver_role?: string };
export type QuotationCommunicationAttributes = { quotation_revision: number; author_side: 'customer' | 'provider'; message_type: 'question' | 'change_request' | 'reply'; body: string; created_at: string; author_name: string };
export type UserAttributes = { display_name?: string; email?: string | null; email_verified?: boolean; phone?: string | null; locale?: string | null; revision: number };
export type WarrantyAttributes = { name: string; status: string; effective_from?: string | null; effective_to?: string | null; revision: number };
export type ContractAttributes = { name: string; status: string; version: number; effective_from?: string | null; effective_to?: string | null; revision: number; customer_safe_summary?: { plan_name?: string; plan_code?: string; plan_version?: number; covered_elevator_count?: number; covered_assets?: Array<{ asset_id: string; display_name: string; status: string; effective_from: string; effective_to?: string | null; service_location_name?: string }>; covered_assets_truncated?: boolean; customer_terms?: Record<string, unknown>; upcoming_service?: { due_at: string; status: string; asset_id?: string; asset_name?: string; service_location_name?: string }; preventive_frequency?: string; scheduled_visits?: number; service_priority?: string } };
export type FeedbackAttributes = { created_at: string; provider_id: string; rating: number; comment: string; submitted_at: string };
export type DocumentAttributes = { created_at?: string; filename: string; media_type: string; size_bytes: number; checksum: string; classification: string; status: string; scan_state: string; scan_reason?: string | null; scan_recorded_at?: string | null; revision: number; visibility: string };
export type DocumentVersionAttributes = { created_at?: string; version: number; filename: string; media_type: string; size_bytes: number; checksum: string; scan_state: string; scan_reason?: string | null; scan_recorded_at?: string | null };
export type CustomerServiceReportPreviewAttributes = { provider_name: string; title: string; summary: string; work_performed: string; observations: string | null; asset_name: string | null; site_name: string | null; technician_name: string | null; service_date: string | null; submitted_at: string | null; version: number };

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
  revokeOtherSessions: () => apiClient.request<void>('/sessions/revoke', { method: 'POST', body: JSON.stringify({ scope: 'others' }) }),
  providers: () => query('/providers') as Promise<Collection<ProviderAttributes>>,
  supportContact: (providerId: string) => query(`/providers/${encodeURIComponent(providerId)}/support-contact`, providerId) as Promise<{ data: ProviderSupportContact | null }>,
  customers: (providerId: string) => query('/customers?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<{ display_name: string }>>,
  assets: (providerId: string, page?: CollectionPage, filters: { locationId?: string; query?: string } = {}) => {
    const params = new URLSearchParams(pagedPath('/assets', page).split('?')[1]);
    if (filters.locationId) params.set('filter[location_id]', filters.locationId);
    if (filters.query?.trim()) params.set('filter[q]', filters.query.trim());
    return query(`/assets?${params.toString()}`, providerId) as Promise<Collection<AssetAttributes>>;
  },
  asset: (providerId: string, id: string) => query(`/assets/${encodeURIComponent(id)}`, providerId) as Promise<Resource<AssetAttributes>>,
  updateAsset: (providerId: string, id: string, body: { name: string; expected_revision: number }, idempotencyKey: string) => apiClient.request<Resource<AssetAttributes>>(`/assets/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(body) }, { providerId }),
  serviceTypes: (providerId: string) => query('/service-types?page[limit]=100&sort=-created_at,id', providerId) as Promise<Collection<ServiceTypeAttributes>>,
  location: (providerId: string, id: string) => query(`/locations/${encodeURIComponent(id)}`, providerId) as Promise<Resource<LocationAttributes>>,
  locations: (providerId: string, page: CollectionPage = {}, filters: { query?: string; classification?: string } = {}) => {
    const params = new URLSearchParams({ 'page[limit]': String(page.limit ?? 15), sort: '-created_at,id' });
    if (page.after) params.set('page[after]', page.after);
    if (filters.query?.trim()) params.set('filter[q]', filters.query.trim());
    if (filters.classification) params.set('filter[classification]', filters.classification);
    return query(`/locations?${params.toString()}`, providerId) as Promise<Collection<LocationAttributes>>;
  },
  resourceMemberships: (providerId: string, page?: CollectionPage) => query(pagedPath('/resource-memberships', page), providerId) as Promise<Collection<ResourceMembershipAttributes>>,
  serviceLocation: (providerId: string, id: string) => query(`/service-locations/${encodeURIComponent(id)}`, providerId) as Promise<Resource<ServiceLocationAttributes>>,
  membershipInvitations: (providerId: string, page?: CollectionPage) => query(pagedPath('/resource-membership-invitations', page), providerId) as Promise<Collection<MembershipInvitationAttributes>>,
  acceptMembershipInvitation: (providerId: string, id: string) => apiClient.request<Resource<MembershipInvitationAttributes>>(`/resource-membership-invitations/${encodeURIComponent(id)}/accept`, { method: 'POST', body: JSON.stringify({}) }, { providerId }),
  notificationPreferences: (providerId: string) => query('/notification-preferences?page[limit]=100&sort=-created_at,id', providerId) as Promise<Collection<NotificationPreferenceAttributes>>,
  notificationPreferenceOptions: (providerId: string) => query('/notification-preference-options', providerId) as Promise<{ data: NotificationPreferenceOption[] }>,
  setNotificationPreference: (providerId: string, body: { category: string; channel: string; enabled: boolean; expected_revision: number | null }, idempotencyKey: string) => apiClient.request<Resource<NotificationPreferenceAttributes>>('/notification-preferences', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(body) }, { providerId }),
  updateNotificationPreference: (providerId: string, id: string, body: { enabled: boolean; expected_revision: number }) => apiClient.request<Resource<NotificationPreferenceAttributes>>(`/notification-preferences/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) }, { providerId }),
  timeline: (providerId: string, page?: CollectionPage) => query(pagedPath('/timeline', page), providerId) as Promise<Collection<TimelineEntryAttributes>>,
  timelineForSource: (providerId: string, sourceId: string) => {
    const params = new URLSearchParams({ 'page[limit]': '25', 'filter[source_id]': sourceId, sort: 'created_at,id' });
    return query(`/timeline?${params.toString()}`, providerId) as Promise<Collection<TimelineEntryAttributes>>;
  },
  requests: (providerId: string, page?: CollectionPage) => query(pagedPath('/service-requests', page), providerId) as Promise<Collection<RequestAttributes>>,
  request: (providerId: string, id: string) => query(`/service-requests/${encodeURIComponent(id)}`, providerId) as Promise<Resource<ServiceRequestAttributes>>,
  bookings: (providerId: string, page?: CollectionPage) => query(pagedPath('/service-bookings', page), providerId) as Promise<Collection<BookingAttributes>>,
  upcomingBookings: (providerId: string, page: CollectionPage, startsAtGte: string, startsAtLt: string) => {
    const params = new URLSearchParams({ 'page[limit]': String(page.limit ?? 100), sort: '-created_at,id', 'filter[starts_at_gte]': startsAtGte, 'filter[starts_at_lt]': startsAtLt });
    if (page.after) params.set('page[after]', page.after);
    for (const status of ['CONFIRMED', 'RESCHEDULED']) params.append('filter[status][]', status);
    return query(`/service-bookings?${params.toString()}`, providerId) as Promise<Collection<BookingAttributes>>;
  },
  booking: (providerId: string, id: string) => query(`/service-bookings/${encodeURIComponent(id)}`, providerId) as Promise<Resource<BookingAttributes>>,
  jobs: (providerId: string, page?: CollectionPage, status?: string) => {
    const path = pagedPath('/service-jobs', page, '-created_at,id');
    const filters = new URLSearchParams();
    if (status) filters.set('filter[status]', status);
    return query(filters.size ? `${path}&${filters.toString()}` : path, providerId) as Promise<Collection<ServiceJobAttributes>>;
  },
  job: (providerId: string, id: string) => query(`/service-jobs/${encodeURIComponent(id)}`, providerId) as Promise<Resource<ServiceJobAttributes>>,
  installationProjects: async (providerId: string, page?: CollectionPage) => normalizeCollection<InstallationProjectAttributes>(await query(pagedPath('/service-cases', page, '-created_at,id'), providerId) as { data: Array<Resource<InstallationProjectAttributes> | { data: Resource<InstallationProjectAttributes> }>; page?: Collection<InstallationProjectAttributes>['page'] }),
  installationProject: async (providerId: string, id: string) => {
    const payload = await query(`/service-cases/${encodeURIComponent(id)}`, providerId) as Resource<InstallationProjectAttributes> | { data: Resource<InstallationProjectAttributes> };
    return 'data' in payload ? payload.data : payload;
  },
  acceptHandover: (providerId: string, caseId: string, body: Record<string, unknown>, key: string) => apiClient.request<{ data: Resource<{ event_kind: string; asset_id?: string | null; service_case_revision?: number; occurred_at?: string | null }> }>(`/service-cases/${encodeURIComponent(caseId)}/handover/accept`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId }).then((payload) => payload.data),
  notifications: (providerId: string, force = false, page?: CollectionPage, unread?: boolean) => {
    const params = new URLSearchParams({ 'page[limit]': String(page?.limit ?? 15), sort: '-created_at,id' });
    if (page?.after) params.set('page[after]', page.after);
    if (unread !== undefined) params.set('filter[unread]', String(unread));
    return apiClient.request<Collection<NotificationAttributes>>(`/notifications?${params.toString()}`, {}, { providerId, cacheTtlMs: 15_000, forceRefresh: force });
  },
  markNotificationRead: (providerId: string, id: string, key: string) => apiClient.request<Resource<NotificationAttributes>>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', headers: { 'Idempotency-Key': key } }, { providerId }),
  quotations: (providerId: string, page?: CollectionPage, filters: { quotationId?: string; status?: string[] } = {}) => {
    const params = new URLSearchParams(pagedPath('/quotations', page, '-created_at,id').split('?')[1]);
    if (filters.quotationId?.trim()) params.set('filter[quotation_id]', filters.quotationId.trim());
    filters.status?.forEach((status) => params.append('filter[status][]', status));
    return query(`/quotations?${params.toString()}`, providerId) as Promise<Collection<QuotationAttributes>>;
  },
  quotation: (providerId: string, id: string) => query(`/quotations/${encodeURIComponent(id)}`, providerId) as Promise<Resource<QuotationAttributes>>,
  quotationApprovals: (providerId: string, id: string) => query(`/quotations/${encodeURIComponent(id)}/approvals?page[limit]=25`, providerId) as Promise<Collection<QuotationApprovalAttributes>>,
  approveQuotation: (providerId: string, id: string, expectedRevision: number, key: string, evidence: { approver_name: string; approver_role: string; authority_attested: true }) => apiClient.request<Resource<QuotationAttributes>>(`/quotations/${encodeURIComponent(id)}/approve`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ expected_revision: expectedRevision, ...evidence }) }, { providerId }),
  quotationCommunications: (providerId: string, id: string) => query(`/quotations/${encodeURIComponent(id)}/communications?page[limit]=100&sort=created_at,id`, providerId) as Promise<Collection<QuotationCommunicationAttributes>>,
  createQuotationCommunication: (providerId: string, id: string, body: { expected_revision: number; message_type: 'QUESTION' | 'CHANGE_REQUEST'; body: string }, key: string) => apiClient.request<Resource<QuotationCommunicationAttributes>>(`/quotations/${encodeURIComponent(id)}/communications`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId }),
  quotationProviderLogo: (providerId: string, id: string) => query(`/quotations/${encodeURIComponent(id)}/provider-logo`, providerId) as Promise<{ data: { quotation_id: string; media_type: string; filename: string }; transfer: { url: string } }>,
  rejectQuotation: (providerId: string, id: string, expectedRevision: number, reason: string, key: string) => apiClient.request<Resource<QuotationAttributes>>(`/quotations/${encodeURIComponent(id)}/reject`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ expected_revision: expectedRevision, reason }) }, { providerId }),
  warranties: (providerId: string, page?: CollectionPage) => query(pagedPath('/warranties', page, '-created_at,id'), providerId) as Promise<Collection<WarrantyAttributes>>,
  warranty: (providerId: string, id: string) => query(`/warranties/${encodeURIComponent(id)}`, providerId) as Promise<Resource<WarrantyAttributes>>,
  contracts: (providerId: string, page?: CollectionPage) => query(pagedPath('/maintenance-contracts', page, '-created_at,id'), providerId) as Promise<Collection<ContractAttributes>>,
  contract: (providerId: string, id: string) => query(`/maintenance-contracts/${encodeURIComponent(id)}`, providerId) as Promise<Resource<ContractAttributes>>,
  feedback: (providerId: string, page?: CollectionPage) => query(pagedPath('/feedback', page, '-created_at,id'), providerId) as Promise<Collection<FeedbackAttributes>>,
  submitFeedback: (providerId: string, jobId: string, body: { rating: number; comment?: string }, key: string) => apiClient.request<Resource<FeedbackAttributes>>(`/service-jobs/${encodeURIComponent(jobId)}/feedback`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId }),
  documents: (providerId: string, page?: CollectionPage, sourceId?: string) => {
    const params = new URLSearchParams({ 'page[limit]': String(page?.limit ?? 15), sort: '-created_at,id' });
    if (page?.after) params.set('page[after]', page.after);
    if (sourceId) params.set('filter[source_id]', sourceId);
    return query(`/documents?${params.toString()}`, providerId) as Promise<Collection<DocumentAttributes>>;
  },
  document: (providerId: string, id: string) => query(`/documents/${encodeURIComponent(id)}`, providerId) as Promise<Resource<DocumentAttributes>>,
  customerDocumentPreview: (providerId: string, id: string) => query(`/documents/${encodeURIComponent(id)}/customer-preview`, providerId) as Promise<{ data: Resource<CustomerServiceReportPreviewAttributes> | null }>,
  documentVersions: (providerId: string, id: string) => query(`/documents/${encodeURIComponent(id)}/versions?page[limit]=25&sort=-created_at,id`, providerId) as Promise<Collection<DocumentVersionAttributes>>,
  createDocument: (providerId: string, body: Record<string, unknown>, key: string) => apiClient.request<{ document: Resource<DocumentAttributes>; version: Resource<DocumentVersionAttributes>; transfer: { url: string; method: string; headers: Record<string, string>; expires_at: string } }>(`/documents`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId }),
  finalizeDocument: (providerId: string, id: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<DocumentAttributes>>(`/documents/${encodeURIComponent(id)}/upload-finalization`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId }),
  authorizeDownload: (providerId: string, id: string, body: Record<string, unknown>) => apiClient.request<{ url: string; expires_at: string; expires_in: number }>(`/documents/${encodeURIComponent(id)}/download`, { method: 'POST', body: JSON.stringify(body) }, { providerId }),
  resolveIdentifier: (providerId: string, identifier: string, key: string) => apiClient.request<{ status: string; resource_type: string; resource?: Resource<AssetAttributes> }>('/identifier-resolutions', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ identifier, resource_hint: 'auto', provider_context_id: providerId }) }, { providerId }),
  createRequest: (providerId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<RequestAttributes>>('/service-requests', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId }),
  createBooking: (providerId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<BookingAttributes>>('/service-bookings', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId }),
  rescheduleAppointment: (providerId: string, id: string, body: { expected_revision: number; starts_at: string; ends_at: string }, key: string) => apiClient.request<Resource<BookingAttributes>>(`/appointments/${encodeURIComponent(id)}/reschedule`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId }),
  cancelAppointment: (providerId: string, id: string, body: { expected_revision: number; reason: string }, key: string) => apiClient.request<Resource<BookingAttributes>>(`/appointments/${encodeURIComponent(id)}/cancel`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
};

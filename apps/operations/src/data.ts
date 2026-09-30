import { apiClient } from '@trise/api-client';

export type Link = { id: string; type: string };
export type Resource<T> = { id: string; type: string; attributes: T; relationships: Record<string, Link | Link[] | null | undefined> };
export type Collection<T> = { data: Resource<T>[]; page?: { next?: string | null; previous?: string | null } };
export type ProviderAttributes = { display_name: string; representation?: string };
export type RequestAttributes = { summary: string; description?: string; status: string; revision: number; created_at: string };
export type BookingAttributes = { summary: string; status: string; revision: number; requested_window: { starts_at: string; ends_at: string; time_zone: string } };
export type CapacityPoolAttributes = { name: string; capacity_units: number; status: string; revision?: number };
export type JobAttributes = { summary?: string; status: string; revision: number; scheduled_at?: string };
export type AgentAttributes = { display_name?: string; status?: string; revision?: number };
export type JobActionAttributes = { visit_id: string; effective_at: string; expected_revision: number; report_ids?: string[]; proof_ids?: string[] };
export type AssignmentAttributes = { status: string; revision?: number; scheduled_start_at?: string; scheduled_end_at?: string };
export type VisitAttributes = { status: string; arrived_at?: string; started_at?: string; ended_at?: string };
export type WorkNoteAttributes = { text: string; visibility: string; recorded_at: string };
export type PartUsageAttributes = { description: string; quantity: string; unit: string; usage_kind: string; recorded_at: string };
export type GenericAttributes = Record<string, unknown>;
export type ChecklistAttributes = { status: string; revision?: number; answers?: Array<{ key: string; value: unknown; required?: boolean }>; items?: Array<Record<string, unknown>> };
export type WorkSessionAttributes = { status: string; started_at?: string; ended_at?: string; revision?: number };

const query = (path: string, providerId: string) => apiClient.request(path, {}, { providerId });
export const operationsData = {
  providers: () => apiClient.request<Collection<ProviderAttributes>>('/providers'),
  requests: (providerId: string) => query('/service-requests?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<RequestAttributes>>,
  request: (providerId: string, id: string) => query(`/service-requests/${encodeURIComponent(id)}`, providerId) as Promise<Resource<RequestAttributes>>,
  bookings: (providerId: string) => query('/service-bookings?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<BookingAttributes>>,
  capacityPools: (providerId: string) => query('/capacity-pools?page[limit]=100&sort=-created_at,id', providerId) as Promise<Collection<CapacityPoolAttributes>>,
  createAppointment: (providerId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<BookingAttributes>>('/appointments', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId }),
  confirmAppointment: (providerId: string, bookingId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<BookingAttributes>>(`/appointments/${encodeURIComponent(bookingId)}/confirm`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId }),
  rescheduleAppointment: (providerId: string, bookingId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<BookingAttributes>>(`/appointments/${encodeURIComponent(bookingId)}/reschedule`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId }),
  jobs: (providerId: string) => query('/service-jobs?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<JobAttributes>>,
  agents: (providerId: string) => query('/agents?page[limit]=100&sort=-created_at,id', providerId) as Promise<Collection<AgentAttributes>>,
  createJob: (providerId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<JobAttributes>>('/service-jobs', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId }),
  assign: (providerId: string, jobId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<unknown>>(`/service-jobs/${encodeURIComponent(jobId)}/assignments`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,assignments: (providerId: string) => query('/assignments?page[limit]=100&sort=-created_at,id', providerId) as Promise<Collection<AssignmentAttributes>>
  ,acceptAssignment: (providerId: string, assignmentId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<AssignmentAttributes>>(`/assignments/${encodeURIComponent(assignmentId)}/accept`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,declineAssignment: (providerId: string, assignmentId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<AssignmentAttributes>>(`/assignments/${encodeURIComponent(assignmentId)}/decline`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,visits: (providerId: string, jobId: string) => query(`/service-jobs/${encodeURIComponent(jobId)}/visits?page[limit]=25&sort=-created_at,id`, providerId) as Promise<Collection<VisitAttributes>>
  ,createVisit: (providerId: string, jobId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<VisitAttributes>>(`/service-jobs/${encodeURIComponent(jobId)}/visits`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,checkIn: (providerId: string, jobId: string, body: JobActionAttributes, key: string) => apiClient.request<Resource<JobAttributes>>(`/service-jobs/${encodeURIComponent(jobId)}/check-in`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,start: (providerId: string, jobId: string, body: JobActionAttributes, key: string) => apiClient.request<Resource<JobAttributes>>(`/service-jobs/${encodeURIComponent(jobId)}/start`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,complete: (providerId: string, jobId: string, body: JobActionAttributes, key: string) => apiClient.request<Resource<JobAttributes>>(`/service-jobs/${encodeURIComponent(jobId)}/complete`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,notes: (providerId: string, jobId: string) => query(`/service-jobs/${encodeURIComponent(jobId)}/notes?page[limit]=25&sort=-created_at,id`, providerId) as Promise<Collection<WorkNoteAttributes>>
  ,createNote: (providerId: string, jobId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<WorkNoteAttributes>>(`/service-jobs/${encodeURIComponent(jobId)}/notes`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,parts: (providerId: string, jobId: string) => query(`/service-jobs/${encodeURIComponent(jobId)}/parts-used?page[limit]=25&sort=-created_at,id`, providerId) as Promise<Collection<PartUsageAttributes>>
  ,recordPart: (providerId: string, jobId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<PartUsageAttributes>>(`/service-jobs/${encodeURIComponent(jobId)}/parts-used`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,customers: (providerId: string) => query('/customers?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<GenericAttributes>>
  ,teams: (providerId: string) => query('/teams?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<GenericAttributes>>
  ,agentsDirectory: (providerId: string) => query('/agents?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<GenericAttributes>>
  ,skills: (providerId: string) => query('/skills?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<GenericAttributes>>
  ,territories: (providerId: string) => query('/service-territories?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<GenericAttributes>>
  ,leaveRequests: (providerId: string) => query('/leave-requests?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<GenericAttributes>>
  ,quotations: (providerId: string) => query('/quotations?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<GenericAttributes>>
  ,configuration: (providerId: string, type: string) => query(`/configuration/${encodeURIComponent(type)}?page[limit]=25&sort=-created_at,id`, providerId) as Promise<Collection<GenericAttributes>>
  ,configurationDetail: (providerId: string, type: string, id: string) => query(`/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, providerId) as Promise<Resource<GenericAttributes>>
  ,createConfiguration: (providerId: string, type: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<GenericAttributes>>(`/configuration/${encodeURIComponent(type)}`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,updateConfiguration: (providerId: string, type: string, id: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<GenericAttributes>>(`/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,submitConfigurationReview: (providerId: string, type: string, id: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<GenericAttributes>>(`/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}/reviews`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,approveConfigurationReview: (providerId: string, type: string, id: string, reviewId: string, key: string) => apiClient.request<Resource<GenericAttributes>>(`/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}/reviews/${encodeURIComponent(reviewId)}/approve`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({}), }, { providerId })
  ,revokeConfigurationReview: (providerId: string, type: string, id: string, reviewId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<GenericAttributes>>(`/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}/reviews/${encodeURIComponent(reviewId)}/revoke`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,activateConfiguration: (providerId: string, type: string, id: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<GenericAttributes>>(`/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}/activate`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,archiveConfiguration: (providerId: string, type: string, id: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<GenericAttributes>>(`/configuration/${encodeURIComponent(type)}/${encodeURIComponent(id)}/archive`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,timeline: (providerId: string) => query('/timeline?page[limit]=25&sort=-created_at,id', providerId) as Promise<Collection<GenericAttributes>>
  ,checklists: (providerId: string, jobId: string) => query(`/service-jobs/${encodeURIComponent(jobId)}/checklists?page[limit]=25&sort=-created_at,id`, providerId) as Promise<Collection<ChecklistAttributes>>
  ,createChecklist: (providerId: string, jobId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<ChecklistAttributes>>(`/service-jobs/${encodeURIComponent(jobId)}/checklists`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,updateChecklist: (providerId: string, jobId: string, checklistId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<ChecklistAttributes>>(`/service-jobs/${encodeURIComponent(jobId)}/checklists/${encodeURIComponent(checklistId)}`, { method: 'PATCH', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,completeChecklist: (providerId: string, jobId: string, checklistId: string, key: string) => apiClient.request<Resource<ChecklistAttributes>>(`/service-jobs/${encodeURIComponent(jobId)}/checklists/${encodeURIComponent(checklistId)}/complete`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({}), }, { providerId })
  ,checklistTemplates: (providerId: string) => query('/configuration/checklist-templates?page[limit]=100&sort=-created_at,id', providerId) as Promise<Collection<GenericAttributes>>
  ,workSessions: (providerId: string, agentId: string) => query(`/agents/${encodeURIComponent(agentId)}/work-sessions?page[limit]=25&sort=-created_at,id`, providerId) as Promise<Collection<WorkSessionAttributes>>
  ,startWorkSession: (providerId: string, agentId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<WorkSessionAttributes>>(`/agents/${encodeURIComponent(agentId)}/work-sessions`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
  ,endWorkSession: (providerId: string, agentId: string, sessionId: string, body: Record<string, unknown>, key: string) => apiClient.request<Resource<WorkSessionAttributes>>(`/agents/${encodeURIComponent(agentId)}/work-sessions/${encodeURIComponent(sessionId)}/end`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(body) }, { providerId })
};

type FeedbackJob = { providerId: string; providerName: string; resource: { id: string; attributes: { status: string; summary?: string; created_at?: string; completed_at?: string | null } } };
type SubmittedFeedback = { providerId: string; resource: { relationships: Record<string, { id: string } | Array<{ id: string }> | null | undefined> } };

export function pendingFeedbackJobs(jobs: FeedbackJob[], feedback: SubmittedFeedback[]): FeedbackJob[] {
  return jobs.filter(({ providerId, resource }) => serviceFeedbackEligible(resource.attributes.status) && !feedback.some((entry) => {
    const relation = entry.resource.relationships.job;
    const jobId = Array.isArray(relation) ? relation[0]?.id : relation?.id;
    return entry.providerId === providerId && jobId === resource.id;
  })).sort((a, b) => (b.resource.attributes.completed_at || b.resource.attributes.created_at || '').localeCompare(a.resource.attributes.completed_at || a.resource.attributes.created_at || ''));
}

export function serviceStatusLabel(value: string): string {
  switch (value.toUpperCase()) {
    case 'NEW':
    case 'REQUESTED': return 'Request received';
    case 'CREATED': return 'Awaiting provider scheduling';
    case 'CONFIRMED':
    case 'SCHEDULED':
    case 'RESCHEDULED': return 'Scheduled';
    case 'ON_THE_WAY': return 'Technician on the way';
    case 'ARRIVED': return 'Technician arrived';
    case 'WORK_STARTED':
    case 'IN_PROGRESS': return 'In progress';
    case 'COMPLETED':
    case 'CLOSED':
    case 'DONE': return 'Completed';
    case 'CANCELLED': return 'Cancelled';
    default: return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}

export function serviceScheduleLabel(status: string, startsAt?: string): string {
  if (status.toUpperCase() === 'CANCELLED') return startsAt ? `Cancelled · ${startsAt}` : 'Visit cancelled';
  if (startsAt) return `${status.toUpperCase() === 'REQUESTED' ? 'Preferred window' : 'Scheduled'} · ${startsAt}`;
  if (status.toUpperCase() === 'CREATED') return 'The provider has not shared a time yet';
  return 'Visit time not provided';
}

type ServiceRequestLink = { id: string };
type LinkedBooking = {
  attributes: { status: string; requested_window: { starts_at: string }; scheduled_window?: { starts_at: string } | null };
  relationships: Record<string, ServiceRequestLink | ServiceRequestLink[] | null | undefined>;
};

export function serviceBookingWindowLabel(
  booking: LinkedBooking,
  formatDate: (value: string) => string,
): string {
  const requested = booking.attributes.status.toUpperCase() === 'REQUESTED';
  const window = requested ? booking.attributes.requested_window : booking.attributes.scheduled_window;
  return serviceScheduleLabel(booking.attributes.status, window?.starts_at ? formatDate(window.starts_at) : undefined);
}

export function isRequestedBookingRepresentedByRequest(
  providerId: string,
  booking: LinkedBooking,
  requests: Array<{ providerId: string; id: string }>,
): boolean {
  if (booking.attributes.status.toUpperCase() !== 'REQUESTED') return false;
  const relation = booking.relationships.service_request;
  const requestId = Array.isArray(relation) ? relation[0]?.id : relation?.id;
  return Boolean(requestId && requests.some((request) => request.providerId === providerId && request.id === requestId));
}

type LinkedServiceJob = {
  providerId: string;
  relationships: Record<string, ServiceRequestLink | ServiceRequestLink[] | null | undefined>;
};

export function isBookingRepresentedByJob(providerId: string, bookingId: string, jobs: LinkedServiceJob[]): boolean {
  return jobs.some((job) => {
    const relation = job.relationships.booking;
    const linkedBookingId = Array.isArray(relation) ? relation[0]?.id : relation?.id;
    return job.providerId === providerId && linkedBookingId === bookingId;
  });
}

export function serviceActivityReference(reference: string | undefined, fallback: string): string {
  return reference?.trim() ? `${reference.trim()} · ${fallback}` : fallback;
}

export function serviceFeedbackEligible(status: string): boolean {
  return ['COMPLETED', 'CLOSED', 'DONE'].includes(status.toUpperCase());
}

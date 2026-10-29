import { describe, expect, it } from 'vitest';
import { isBookingRepresentedByJob, isRequestedBookingRepresentedByRequest, pendingFeedbackJobs, serviceActivityReference, serviceBookingWindowLabel, serviceFeedbackEligible, serviceScheduleLabel, serviceStatusLabel } from './customer-services';

describe('customer service labels', () => {
  it('does not describe a created job as scheduled', () => {
    expect(serviceStatusLabel('CREATED')).toBe('Awaiting provider scheduling');
    expect(serviceScheduleLabel('CREATED')).toBe('The provider has not shared a time yet');
  });

  it('uses consistent customer-friendly labels for request, visit and completion states', () => {
    expect(['NEW', 'REQUESTED'].map(serviceStatusLabel)).toEqual(['Request received', 'Request received']);
    expect(['CONFIRMED', 'SCHEDULED', 'RESCHEDULED'].map(serviceStatusLabel)).toEqual(['Scheduled', 'Scheduled', 'Scheduled']);
    expect(['ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(serviceStatusLabel)).toEqual([
      'Technician on the way', 'Technician arrived', 'In progress', 'Completed', 'Cancelled'
    ]);
  });

  it('shows requested windows as preferences rather than confirmed appointments', () => {
    expect(serviceScheduleLabel('REQUESTED', '29 Oct, 9:00 AM')).toBe('Preferred window · 29 Oct, 9:00 AM');
    expect(serviceScheduleLabel('CONFIRMED')).toBe('Visit time not provided');
    expect(serviceScheduleLabel('CANCELLED', '12 Nov, 10:00')).toBe('Cancelled · 12 Nov, 10:00');
    expect(serviceScheduleLabel('CANCELLED')).toBe('Visit cancelled');
  });

  it('uses the provider-confirmed time for appointments and the requested time for pending bookings', () => {
    const format = (value: string) => value;
    const requested = { attributes: { status: 'REQUESTED', requested_window: { starts_at: 'customer preference' }, scheduled_window: null }, relationships: {} };
    const confirmed = { attributes: { status: 'CONFIRMED', requested_window: { starts_at: 'old preference' }, scheduled_window: { starts_at: 'provider confirmation' } }, relationships: {} };
    expect(serviceBookingWindowLabel(requested, format)).toBe('Preferred window · customer preference');
    expect(serviceBookingWindowLabel(confirmed, format)).toBe('Scheduled · provider confirmation');
    expect(serviceBookingWindowLabel({ ...confirmed, attributes: { ...confirmed.attributes, scheduled_window: null } }, format)).toBe('Visit time not provided');
    expect(serviceBookingWindowLabel({ ...confirmed, attributes: { ...confirmed.attributes, status: 'CANCELLED' } }, format)).toBe('Cancelled · provider confirmation');
  });

  it('merges only a pending booking linked to a request in the same provider account', () => {
    const booking = (status: string, requestId?: string) => ({
      attributes: { status, requested_window: { starts_at: '2026-10-30T03:30:00Z' } },
      relationships: { service_request: requestId ? { id: requestId } : null },
    });
    const requests = [{ providerId: 'provider-a', id: 'request-a' }];
    expect(isRequestedBookingRepresentedByRequest('provider-a', booking('REQUESTED', 'request-a'), requests)).toBe(true);
    expect(isRequestedBookingRepresentedByRequest('provider-b', booking('REQUESTED', 'request-a'), requests)).toBe(false);
    expect(isRequestedBookingRepresentedByRequest('provider-a', booking('CONFIRMED', 'request-a'), requests)).toBe(false);
    expect(isRequestedBookingRepresentedByRequest('provider-a', booking('REQUESTED', 'request-other'), requests)).toBe(false);
  });

  it('represents a booking once through its linked service job in the same provider account', () => {
    const jobs = [
      { providerId: 'provider-a', relationships: { booking: { id: 'booking-a' } } },
      { providerId: 'provider-b', relationships: { booking: { id: 'booking-b' } } },
    ];
    expect(isBookingRepresentedByJob('provider-a', 'booking-a', jobs)).toBe(true);
    expect(isBookingRepresentedByJob('provider-a', 'booking-b', jobs)).toBe(false);
    expect(isBookingRepresentedByJob('provider-a', 'unlinked', jobs)).toBe(false);
  });

  it('uses a customer-readable request reference in service activity', () => {
    expect(serviceActivityReference('SR-261029-DFFEA7DA2C49720C', 'Service request')).toBe('SR-261029-DFFEA7DA2C49720C · Service request');
    expect(serviceActivityReference(undefined, 'Appointment')).toBe('Appointment');
  });

  it('allows feedback only for completed service work', () => {
    expect(['COMPLETED', 'CLOSED', 'DONE'].map(serviceFeedbackEligible)).toEqual([true, true, true]);
    expect(['CREATED', 'IN_PROGRESS', 'CANCELLED'].map(serviceFeedbackEligible)).toEqual([false, false, false]);
  });

  it('lists only completed visits without feedback in the same provider account', () => {
    const visit = (id: string, providerId: string, status: string, created_at?: string) => ({ providerId, providerName: providerId, resource: { id, attributes: { status, created_at } } });
    const jobA = visit('job-a', 'provider-a', 'COMPLETED', '2026-10-28');
    const jobB = visit('job-b', 'provider-a', 'CLOSED', '2026-10-29');
    const otherProvider = visit('job-a', 'provider-b', 'COMPLETED');
    const inProgress = visit('job-c', 'provider-a', 'IN_PROGRESS');
    const feedback = [{ providerId: 'provider-a', resource: { relationships: { job: { id: 'job-a' } } } }];
    expect(pendingFeedbackJobs([jobA, jobB, otherProvider, inProgress], feedback)).toEqual([jobB, otherProvider]);
  });
});

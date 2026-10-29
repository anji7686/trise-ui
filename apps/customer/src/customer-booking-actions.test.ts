import { describe, expect, it } from 'vitest';
import { appointmentActionsAvailable, appointmentIsConfirmed, appointmentStageDescription, customerCancellationNotice, indiaDateTimeLocal, indiaDateTimeToIso, serviceTrackingEventTitle, serviceTrackingStage, serviceTrackingTitle, validFutureAppointmentWindow } from './customer-booking-actions';

describe('customer appointment actions', () => {
  it('describes the recorded provider-visible cancellation without promising an unconfigured notification', () => {
    expect(customerCancellationNotice).toContain('Your provider can see this cancellation in the service record.');
    expect(customerCancellationNotice).toContain('held appointment capacity will be released.');
  });

  it('allows changes only for confirmed visits', () => {
    expect(appointmentActionsAvailable('CONFIRMED')).toBe(true);
    expect(appointmentActionsAvailable('rescheduled')).toBe(true);
    expect(appointmentActionsAvailable('REQUESTED')).toBe(false);
    expect(appointmentActionsAvailable('CANCELLED')).toBe(false);
  });

  it('distinguishes confirmed appointment windows from customer preferences', () => {
    expect(appointmentIsConfirmed('CONFIRMED')).toBe(true);
    expect(appointmentIsConfirmed('SCHEDULED')).toBe(true);
    expect(appointmentIsConfirmed('RESCHEDULED')).toBe(true);
    expect(appointmentIsConfirmed('COMPLETED')).toBe(true);
    expect(appointmentIsConfirmed('MISSED')).toBe(true);
    expect(appointmentIsConfirmed('REQUESTED')).toBe(false);
    expect(appointmentIsConfirmed('CANCELLED')).toBe(false);
  });

  it('keeps tracking history truthful after edits are no longer available', () => {
    expect(appointmentStageDescription('CONFIRMED', 'CREATED', 'Visit confirmed · 30 Oct')).toBe('Visit confirmed · 30 Oct');
    expect(appointmentStageDescription('SCHEDULED', 'CREATED', 'Visit confirmed · 30 Oct')).toBe('Visit confirmed · 30 Oct');
    expect(appointmentStageDescription('COMPLETED', 'COMPLETED', 'Visit confirmed · 30 Oct')).toBe('Visit confirmed · 30 Oct');
    expect(appointmentStageDescription('MISSED', 'CREATED', 'Visit confirmed · 30 Oct')).toBe('Visit confirmed · 30 Oct');
    expect(appointmentStageDescription(null, 'SCHEDULED', 'Visit confirmed · 30 Oct')).toBe('Visit confirmed · 30 Oct');
    expect(appointmentStageDescription('REQUESTED', 'CREATED', 'Preferred window · 30 Oct')).toBe('Waiting for the provider to confirm your preferred time.');
    expect(appointmentStageDescription('CANCELLED', 'CREATED', 'Appointment cancelled')).toBe('This appointment has been cancelled.');
  });

  it('maps provider job and appointment states to the truthful tracking step', () => {
    expect(serviceTrackingStage('CREATED', 'REQUESTED')).toBe(-1);
    expect(serviceTrackingStage('CREATED', 'CONFIRMED')).toBe(0);
    expect(serviceTrackingStage('ARRIVED', 'CONFIRMED')).toBe(1);
    expect(serviceTrackingStage('IN_PROGRESS', 'CONFIRMED')).toBe(2);
    expect(serviceTrackingStage('COMPLETED')).toBe(3);
  });

  it('uses a concise title when the live fixture has a synthetic label', () => {
    expect(serviceTrackingTitle('DEMO ONLY · Preventive maintenance visit')).toBe('Preventive maintenance visit');
    expect(serviceTrackingTitle('Synthetic linked execution job 1793121538363')).toBe('Service visit');
    expect(serviceTrackingTitle('Preventive AMC browser verification 1793120956003')).toBe('Preventive AMC browser verification');
    expect(serviceTrackingTitle('Installation execution — Synthetic execution project 1793121409816')).toBe('Installation execution');
    expect(serviceTrackingTitle('Preventive maintenance')).toBe('Preventive maintenance');
    expect(serviceTrackingTitle('Preventive maintenance visit for Continuous Elevator A 1792745454677', 'Continuous Elevator A 1792745454677')).toBe('Preventive maintenance');
    expect(serviceTrackingTitle('Preventive maintenance visit for another elevator', 'Continuous Elevator A')).toBe('Preventive maintenance visit for another elevator');
    expect(serviceTrackingTitle('  ')).toBe('Service visit');
  });

  it('uses customer-readable provider update titles', () => {
    expect(serviceTrackingEventTitle('service_job_created')).toBe('Service visit created');
    expect(serviceTrackingEventTitle('SERVICE_JOB_ARRIVED')).toBe('Service team arrived');
    expect(serviceTrackingEventTitle('service.report.submitted')).toBe('Service report submitted');
    expect(serviceTrackingEventTitle('custom_provider_event')).toBe('Custom provider event');
    expect(serviceTrackingEventTitle('')).toBe('Service update');
  });

  it('round trips India-local appointment times as RFC3339 instants', () => {
    expect(indiaDateTimeToIso('2026-10-30T09:30')).toBe('2026-10-30T04:00:00.000Z');
    expect(indiaDateTimeLocal('2026-10-30T04:00:00.000Z')).toBe('2026-10-30T09:30');
    expect(validFutureAppointmentWindow('2026-10-30T09:30', '2026-10-30T10:30', Date.parse('2026-10-29T12:00:00Z'))).toBe(true);
    expect(validFutureAppointmentWindow('2026-10-30T10:30', '2026-10-30T09:30', Date.parse('2026-10-29T12:00:00Z'))).toBe(false);
    expect(validFutureAppointmentWindow('2026-10-29T09:30', '2026-10-29T10:30', Date.parse('2026-10-29T12:00:00Z'))).toBe(false);
  });
});

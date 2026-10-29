const INDIA_OFFSET = '+05:30';

export const customerCancellationNotice = 'Your provider can see this cancellation in the service record. The held appointment capacity will be released.';

const trackingEventTitles: Record<string, string> = {
  SERVICE_REQUEST_CREATED: 'Service request submitted',
  SERVICE_REQUEST_UPDATED: 'Service request updated',
  SERVICE_REQUEST_TRANSITIONED: 'Service request status changed',
  SERVICE_BOOKING_CREATED: 'Appointment requested',
  SERVICE_BOOKING_UPDATED: 'Appointment updated',
  SERVICE_JOB_CREATED: 'Service visit created',
  SERVICE_JOB_ASSIGNED: 'Service team assigned',
  SERVICE_JOB_ARRIVED: 'Service team arrived',
  SERVICE_JOB_WORK_STARTED: 'Service work started',
  SERVICE_JOB_TRANSITIONED: 'Service status updated',
  SERVICE_REPORT_CREATED: 'Service report prepared',
  SERVICE_REPORT_SUBMITTED: 'Service report submitted',
};

export function serviceTrackingEventTitle(eventName: string): string {
  const normalized = eventName.trim().toUpperCase();
  if (trackingEventTitles[normalized]) return trackingEventTitles[normalized];
  const readable = eventName.replaceAll('.', ' ').replaceAll('_', ' ').trim().toLowerCase();
  return readable.replace(/^\w/, (letter) => letter.toUpperCase()) || 'Service update';
}

export function serviceTrackingTitle(summary?: string | null, assetName?: string | null): string {
  const value = summary?.trim().replace(/^DEMO ONLY\s*[·—-]\s*/i, '');
  if (!value || /^synthetic linked execution job\s+\d+$/i.test(value)) return 'Service visit';
  let readable = value
    .replace(/\s+[—–-]\s+synthetic execution project\s+\d+$/i, '')
    .replace(/\s+\d{10,}$/, '')
    .trim();
  const cleanAssetName = assetName?.trim().replace(/\s+\d{10,}$/, '').trim();
  const assetSuffix = cleanAssetName ? ` for ${cleanAssetName}` : '';
  if (assetSuffix && readable.toLocaleLowerCase().endsWith(assetSuffix.toLocaleLowerCase())) {
    readable = readable.slice(0, -assetSuffix.length).replace(/\s+visit$/i, '').trim();
  }
  return readable || 'Service visit';
}

export function appointmentActionsAvailable(status?: string | null): boolean {
  return ['CONFIRMED', 'RESCHEDULED'].includes((status || '').trim().toUpperCase());
}

export function appointmentIsConfirmed(status?: string | null): boolean {
  return ['CONFIRMED', 'SCHEDULED', 'RESCHEDULED', 'COMPLETED', 'MISSED'].includes((status || '').trim().toUpperCase());
}

export function appointmentStageDescription(bookingStatus: string | null | undefined, jobStatus: string | null | undefined, scheduleLabel: string): string {
  const booking = (bookingStatus || '').trim().toUpperCase();
  const job = (jobStatus || '').trim().toUpperCase();
  if (booking === 'CANCELLED') return 'This appointment has been cancelled.';
  if (appointmentIsConfirmed(booking) || ['SCHEDULED', 'ON_THE_WAY', 'ARRIVED', 'WORK_STARTED', 'IN_PROGRESS', 'COMPLETED', 'RESOLVED', 'CLOSED'].includes(job)) return scheduleLabel;
  return 'Waiting for the provider to confirm your preferred time.';
}

export function serviceTrackingStage(jobStatus: string, bookingStatus?: string | null): number {
  const job = jobStatus.trim().toUpperCase();
  const booking = (bookingStatus || '').trim().toUpperCase();
  if (['COMPLETED', 'CLOSED', 'DONE'].includes(job)) return 3;
  if (['WORK_STARTED', 'IN_PROGRESS'].includes(job)) return 2;
  if (['ARRIVED', 'ON_THE_WAY'].includes(job)) return 1;
  if (['CONFIRMED', 'SCHEDULED', 'RESCHEDULED'].includes(job) || appointmentActionsAvailable(booking)) return 0;
  return -1;
}

export function indiaDateTimeLocal(value: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

export function indiaDateTimeToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Enter a valid date and time.');
  const parsed = new Date(`${value}:00${INDIA_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) throw new Error('Enter a valid date and time.');
  return parsed.toISOString();
}

export function validFutureAppointmentWindow(startsAt: string, endsAt: string, now = Date.now()): boolean {
  try {
    const start = Date.parse(indiaDateTimeToIso(startsAt));
    const end = Date.parse(indiaDateTimeToIso(endsAt));
    return start > now && end > start;
  } catch {
    return false;
  }
}

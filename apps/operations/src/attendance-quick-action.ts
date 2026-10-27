export type AttendanceQuickActionState = 'check-in' | 'check-out' | 'complete';

export function attendanceQuickActionState(input: {
  hasAttendanceCapability: boolean;
  profileId?: string | null;
  profileStatus?: unknown;
  attendanceStatus?: unknown;
}): AttendanceQuickActionState | null {
  if (!input.hasAttendanceCapability || !input.profileId || String(input.profileStatus || '').toUpperCase() !== 'ACTIVE') return null;
  const status = String(input.attendanceStatus || 'NOT_RECORDED').toUpperCase();
  if (status === 'NOT_RECORDED') return 'check-in';
  if (status === 'CHECKED_IN') return 'check-out';
  if (status === 'CHECKED_OUT') return 'complete';
  return null;
}

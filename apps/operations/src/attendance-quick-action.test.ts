import { describe, expect, it } from 'vitest';
import { attendanceQuickActionState } from './attendance-quick-action';

const activeProfile = { hasAttendanceCapability: true, profileId: 'profile-1', profileStatus: 'ACTIVE' };

describe('attendanceQuickActionState', () => {
  it('hides the action when the attendance capability is unavailable', () => {
    expect(attendanceQuickActionState({ ...activeProfile, hasAttendanceCapability: false })).toBeNull();
  });

  it('hides the action when there is no active personal workforce profile', () => {
    expect(attendanceQuickActionState({ ...activeProfile, profileId: null })).toBeNull();
    expect(attendanceQuickActionState({ ...activeProfile, profileStatus: 'SUSPENDED' })).toBeNull();
  });

  it('offers check in when no attendance has been recorded today', () => {
    expect(attendanceQuickActionState(activeProfile)).toBe('check-in');
    expect(attendanceQuickActionState({ ...activeProfile, attendanceStatus: 'NOT_RECORDED' })).toBe('check-in');
  });

  it('offers check out only while today is checked in and marks checked out as complete', () => {
    expect(attendanceQuickActionState({ ...activeProfile, attendanceStatus: 'CHECKED_IN' })).toBe('check-out');
    expect(attendanceQuickActionState({ ...activeProfile, attendanceStatus: 'CHECKED_OUT' })).toBe('complete');
  });

  it('hides unsupported server attendance states', () => {
    expect(attendanceQuickActionState({ ...activeProfile, attendanceStatus: 'CANCELLED' })).toBeNull();
  });
});

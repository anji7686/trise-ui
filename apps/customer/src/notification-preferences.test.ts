import { describe, expect, it } from 'vitest';
import { notificationPreferenceChannel, notificationPreferenceTitle } from './notification-preferences';

describe('customer notification preference labels', () => {
  it('uses customer-friendly labels for known policy categories and channels', () => {
    expect(notificationPreferenceTitle('SERVICE')).toBe('Service updates');
    expect(notificationPreferenceTitle('QUOTATION')).toBe('Quotation reminders');
    expect(notificationPreferenceTitle('MAINTENANCE')).toBe('Maintenance reminders');
    expect(notificationPreferenceChannel('IN_APP')).toBe('In-app notifications');
    expect(notificationPreferenceChannel('EMAIL')).toBe('Email');
  });

  it('keeps future policy labels readable without hiding their meaning', () => {
    expect(notificationPreferenceTitle('SERVICE_ALERT')).toBe('Service Alert');
    expect(notificationPreferenceChannel('VOICE_CALL')).toBe('Voice Call');
  });
});

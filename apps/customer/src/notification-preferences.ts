const CATEGORY_LABELS: Record<string, string> = {
  SERVICE: 'Service updates',
  TRANSACTIONAL: 'Service updates',
  QUOTATION: 'Quotation reminders',
  COMMERCIAL: 'Quotation reminders',
  MAINTENANCE: 'Maintenance reminders',
  OPERATIONAL: 'Account updates',
  MARKETING: 'Product updates',
};

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: 'Email',
  IN_APP: 'In-app notifications',
  SMS: 'Text message',
  PUSH: 'Push notification',
  WHATSAPP: 'WhatsApp',
};

export function notificationPreferenceTitle(category: string): string {
  const normalized = category.trim().replaceAll('-', '_').toUpperCase();
  return CATEGORY_LABELS[normalized] ?? normalized.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, value => value.toUpperCase());
}

export function notificationPreferenceChannel(channel: string): string {
  const normalized = channel.trim().replaceAll('-', '_').toUpperCase();
  return CHANNEL_LABELS[normalized] ?? normalized.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, value => value.toUpperCase());
}

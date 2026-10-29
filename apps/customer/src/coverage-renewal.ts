export function renewalEnquiryMailto(email: string | undefined, subject: string, message: string): string | null {
  const recipient = email?.trim() || '';
  const trimmedSubject = subject.trim();
  const trimmedMessage = message.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || !trimmedSubject || trimmedSubject.length > 200 || !trimmedMessage || trimmedMessage.length > 4000) return null;
  return `mailto:${recipient}?subject=${encodeURIComponent(trimmedSubject)}&body=${encodeURIComponent(trimmedMessage)}`;
}

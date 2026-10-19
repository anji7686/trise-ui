import type { ReactNode } from 'react';

export function statusTone(value: string) {
  const state = value.trim().toUpperCase().replaceAll('_', ' ');
  if (['ACTIVE', 'ENABLED', 'VERIFIED', 'APPROVED', 'REVIEW APPROVED', 'PAID', 'PUBLISHED', 'APPLIED', 'VALID', 'COMPLETE', 'COMPLETED', 'CONFIGURED'].includes(state)) return 'success';
  if (['REJECTED', 'SUSPENDED', 'DISABLED', 'EXPIRED', 'FAILED', 'LIMIT EXCEEDED', 'OVERDUE', 'NOT GRANTED'].includes(state)) return 'danger';
  if (state.includes('PENDING') || state.includes('UNDER REVIEW') || state.includes('CORRECTION') || ['ON HOLD', 'EVIDENCE SUBMITTED', 'DUE', 'GRACE'].includes(state)) return 'warning';
  if (['DRAFT', 'SCHEDULED', 'UPCOMING', 'IN PROGRESS', 'RECORDED'].includes(state)) return 'info';
  return 'neutral';
}

export function OperationsStatus({ children }: { children: ReactNode }) {
  return <span className={`status status-${typeof children === 'string' ? statusTone(children) : 'neutral'}`}>{children}</span>;
}

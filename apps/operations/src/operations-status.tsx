import type { ReactNode } from 'react';

export function statusTone(value: string) {
  const state = value.trim().toUpperCase().replaceAll('_', ' ');
  if (['ACTIVE', 'ENABLED', 'VERIFIED', 'APPROVED', 'REVIEW APPROVED', 'PAID', 'PUBLISHED', 'APPLIED', 'VALID', 'COMPLETE', 'COMPLETED', 'CONFIGURED', 'CONFIRMED', 'RESOLVED', 'CLOSED', 'AVAILABLE', 'SETTLED', 'READY', 'WON', 'QUALIFIED'].includes(state)) return 'success';
  if (['REJECTED', 'SUSPENDED', 'DISABLED', 'EXPIRED', 'TERMINATED', 'FAILED', 'LIMIT EXCEEDED', 'OVERDUE', 'NOT GRANTED', 'CANCELLED', 'CANCELED', 'ABANDONED', 'BLOCKED', 'INELIGIBLE', 'LOST'].includes(state)) return 'danger';
  if (state.includes('PENDING') || state.includes('UNDER REVIEW') || state.includes('CORRECTION') || ['ON HOLD', 'EVIDENCE SUBMITTED', 'DUE', 'GRACE', 'REQUESTED', 'PROPOSED', 'ASSESSMENT', 'QUOTATION PENDING'].includes(state)) return 'warning';
  if (['DRAFT', 'SCHEDULED', 'UPCOMING', 'IN PROGRESS', 'RECORDED', 'NEW', 'CONTACTED', 'ASSIGNED', 'ON THE WAY', 'ARRIVED', 'WORK STARTED', 'EXECUTION', 'OPEN'].includes(state)) return 'info';
  if (['CRITICAL', 'URGENT', 'EMERGENCY', 'HIGH', 'P0', 'P1'].includes(state)) return 'danger';
  if (['MEDIUM', 'MODERATE', 'P2'].includes(state)) return 'warning';
  if (['LOW', 'P3'].includes(state)) return 'success';
  if (['NORMAL'].includes(state)) return 'info';
  return 'neutral';
}

export function priorityTone(value: string) {
  const priority = value.trim().toUpperCase().replaceAll('_', ' ');
  if (['CRITICAL', 'URGENT', 'EMERGENCY', 'P0'].includes(priority)) return 'critical';
  if (['HIGH', 'P1'].includes(priority)) return 'high';
  if (['MEDIUM', 'MODERATE', 'P2'].includes(priority)) return 'medium';
  if (['LOW', 'P3'].includes(priority)) return 'low';
  return 'normal';
}

export function OperationsStatus({ children }: { children: ReactNode }) {
  return <span className={`status status-${typeof children === 'string' ? statusTone(children) : 'neutral'}`}>{children}</span>;
}

export function OperationsPriority({ children }: { children: ReactNode }) {
  return <span className={`priority priority-${typeof children === 'string' ? priorityTone(children) : 'normal'}`}>{children}</span>;
}

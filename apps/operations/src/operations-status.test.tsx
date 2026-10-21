import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OperationsPriority, OperationsStatus, priorityTone, statusTone } from './operations-status';

describe('Operations semantic status and priority tones', () => {
  it('maps lifecycle states to consistent status tones', () => {
    expect(statusTone('APPROVED')).toBe('success');
    expect(statusTone('IN_PROGRESS')).toBe('info');
    expect(statusTone('UNDER_REVIEW')).toBe('warning');
    expect(statusTone('CANCELLED')).toBe('danger');
  });

  it('maps priorities to an ordered visual scale', () => {
    expect(priorityTone('LOW')).toBe('low');
    expect(priorityTone('NORMAL')).toBe('normal');
    expect(priorityTone('HIGH')).toBe('high');
    expect(priorityTone('CRITICAL')).toBe('critical');
    expect(renderToStaticMarkup(<OperationsPriority>HIGH</OperationsPriority>)).toContain('priority-high');
    expect(renderToStaticMarkup(<OperationsStatus>APPROVED</OperationsStatus>)).toContain('status-success');
  });
});

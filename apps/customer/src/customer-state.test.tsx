import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { classifyCustomerState, CustomerStatePanel } from './customer-state';

describe('customer state classification', () => {
  it('distinguishes loading and empty states from recoverable failures', () => {
    expect(classifyCustomerState('Loading…')).toBe('loading');
    expect(classifyCustomerState('No service history is available yet.')).toBe('empty');
    expect(classifyCustomerState('Nothing here yet')).toBe('empty');
    expect(classifyCustomerState('Choose a provider to load authorized records.')).toBe('empty');
    expect(classifyCustomerState('Feedback for your completed service visits will appear here.')).toBe('empty');
    expect(classifyCustomerState('Thank you for sharing feedback. It has been recorded for this visit.')).toBe('success');
    expect(classifyCustomerState('Invalid request')).toBe('error');
    expect(classifyCustomerState('We could not load your places.')).toBe('error');
  });

  it('maps authorization, revision and connectivity failures to their recovery state', () => {
    expect(classifyCustomerState('This record is not available in your customer account.')).toBe('denied');
    expect(classifyCustomerState('The revision is stale; load the latest version.')).toBe('conflict');
    expect(classifyCustomerState('Network error. Please retry.')).toBe('offline');
    expect(classifyCustomerState('Request context changed before the response completed.')).toBe('conflict');
  });

  it('exposes loading and failure states with the right live-region semantics and recovery action', () => {
    const loading = renderToStaticMarkup(<CustomerStatePanel kind="loading" message="Your place and provider context are preserved." />);
    expect(loading).toContain('role="status"');
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain('Try again');
    expect(loading).toContain('disabled=""');
    const failure = renderToStaticMarkup(<CustomerStatePanel kind="error" message="The service could not be loaded." onAction={() => undefined} />);
    expect(failure).toContain('role="alert"');
    expect(failure).toContain('Try again');
    const denied = renderToStaticMarkup(<CustomerStatePanel kind="denied" message="This record is unavailable." onAction={() => undefined} />);
    expect(denied).toContain('Back to overview');
    const success = renderToStaticMarkup(<CustomerStatePanel kind="success" message="Thank you for sharing feedback." />);
    expect(success).toContain('role="status"');
    expect(success).toContain('Thanks for sharing.');
    expect(success).not.toContain('disabled=""');
  });
});

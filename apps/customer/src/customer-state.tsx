import { Button } from '@trise/ui';

export type CustomerStateKind = 'loading' | 'empty' | 'success' | 'error' | 'denied' | 'conflict' | 'offline';

const stateCopy: Record<CustomerStateKind, { title: string; symbol: string; action?: string }> = {
  loading: { title: 'Loading your service…', symbol: '…', action: 'Try again' },
  empty: { title: 'A clean slate.', symbol: '○' },
  success: { title: 'Thanks for sharing.', symbol: '✓' },
  error: { title: 'We couldn’t load this information.', symbol: '!', action: 'Try again' },
  denied: { title: 'This record isn’t available.', symbol: '×', action: 'Back to overview' },
  conflict: { title: 'There’s a newer update.', symbol: '↻', action: 'Load latest version' },
  offline: { title: 'You’re offline.', symbol: '⌁', action: 'Reconnect' },
};

export function classifyCustomerState(message: string, loadingMessage?: string): CustomerStateKind {
  const value = message.trim().toLowerCase();
  if ((loadingMessage && message === loadingMessage) || /^(loading|retrieving|please wait)/.test(value)) return 'loading';
  if (/^(thank you|thanks for|successfully )/.test(value)) return 'success';
  if (/\b(conflict|stale|newer version|revision mismatch|context changed)\b/.test(value)) return 'conflict';
  if (/\b(offline|network error|failed to fetch|local api is unavailable)\b/.test(value)) return 'offline';
  if (/\b(forbidden|not authorized|unauthorized|access denied|not available in your customer account|not found)\b/.test(value)) return 'denied';
  if (/\b(could not|couldn’t|unable to|failed|error|unavailable)\b/.test(value)) return 'error';
  if (/^(no\b|nothing\b|choose a provider\b|a clean slate\b|feedback becomes available\b|feedback for your completed service visits will appear here\b)/.test(value)) return 'empty';
  return 'error';
}

export function CustomerStatePanel({
  kind,
  message,
  actionLabel,
  onAction,
}: {
  kind: CustomerStateKind;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const copy = stateCopy[kind];
  const actionable = Boolean(actionLabel || copy.action);
  return <section className={`customer-state customer-state-${kind}`} role={kind === 'loading' || kind === 'empty' || kind === 'success' ? 'status' : 'alert'} aria-live="polite" aria-busy={kind === 'loading' ? 'true' : undefined}>
    <span className="customer-state-symbol" aria-hidden="true">{copy.symbol}</span>
    <div className="customer-state-copy"><h2>{copy.title}</h2><p>{message}</p></div>
    {actionable && <Button onClick={onAction} disabled={!onAction}>{actionLabel || copy.action}</Button>}
  </section>;
}
